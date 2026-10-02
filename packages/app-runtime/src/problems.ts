import type { CommandState } from "./commands.js";
import { HostError } from "./errors.js";
import { caseworkProblemStatus, isCaseworkProblemCode } from "./types.js";

/** What a failed read or write amounts to for the person looking at it. */
export type ProblemKind =
  | "recovery-pending"
  | "refused"
  | "contract-changed"
  | "session-ended"
  | "stale"
  | "conflict"
  | "capacity"
  | "unavailable"
  | "service";
export interface ProblemView {
  kind: ProblemKind;
  /** A Casework problem, whose message is maintained page copy. */
  casework: boolean;
  /** A write the registry refused in its UI model's own words, so page copy. */
  worded: boolean;
  /** The service's own answer; null when none came back, such as after a lost connection. */
  status: number | null;
  code: string | null;
  message: string | null;
  fieldErrors: Record<string, string>;
  supportReference: string | null;
}

/**
 * The one reading of any error a host call throws. A typed Casework problem is read by
 * the status its code stands for, and its message is page copy. Any other host answer is
 * read by its code first and its status after, and its message is not page copy, because
 * it can carry registry facts, unless the host marks it worded: a write the registry
 * refused, in its UI model's own words, which reads as refused. Anything that is not a
 * host answer is the service being unavailable.
 */
export function problemView(error: unknown): ProblemView {
  if (!(error instanceof HostError))
    return {
      kind: "service",
      casework: false,
      worded: false,
      status: null,
      code: null,
      message: null,
      fieldErrors: {},
      supportReference: null,
    };
  const { code } = error.problem;
  const { status } = error;
  const worded = error.problem.worded === true;
  const caseworkStatus = isCaseworkProblemCode(code)
    ? caseworkProblemStatus(code)
    : code.startsWith("casework.")
      ? status
      : undefined;
  return {
    kind: worded
      ? "refused"
      : caseworkStatus !== undefined
        ? caseworkKind(code, caseworkStatus)
        : hostKind(code, status),
    casework: !worded && caseworkStatus !== undefined,
    worded,
    status,
    code,
    message: error.message,
    fieldErrors: error.problem.fieldErrors ?? {},
    supportReference: error.problem.supportReference ?? null,
  };
}
function caseworkKind(code: string, status: number): ProblemKind {
  if (code === "work-item.recovery-pending") return "recovery-pending";
  if (status === 403) return "refused";
  if (status === 404) return "unavailable";
  if (status === 412) return "stale";
  if (status === 409) return "conflict";
  if (status < 500) return "refused";
  return "service";
}
function hostKind(code: string, status: number): ProblemKind {
  if (code === "action.refused" || status === 403) return "refused";
  if (code === "session.contract-changed") return "contract-changed";
  if (code === "session.expired" || status === 401) return "session-ended";
  if (code === "precondition.failed" || status === 412) return "stale";
  if (
    code === "action.conflict" ||
    code === "idempotency.conflict" ||
    status === 409
  )
    return "conflict";
  if (code === "service.capacity") return "capacity";
  if (code === "resource.unavailable" || status === 404) return "unavailable";
  return "service";
}

/** The error a page shows where the session is offered nothing to write. */
export function unavailableError(message: string): HostError {
  return new HostError(404, { code: "resource.not_found", message });
}

/** What a refused or unconfirmed record task says about the form that sent it. */
export interface TaskRefusal {
  /** Every field the service refused, keyed by field id. */
  fieldErrors: Record<string, string>;
  /** The fields of a refusal that failed validation alone. */
  validationErrors: Record<string, string>;
  /**
   * Whether the write itself was refused as stale, so the record moved on. A stale
   * refusal of a resend leaves the unconfirmed attempt in charge instead.
   */
  staleConflict: boolean;
}
export function taskRefusal(error: unknown, unknown: boolean): TaskRefusal {
  const problem = problemView(error);
  return {
    fieldErrors: problem.fieldErrors,
    validationErrors:
      problem.code === "validation.failed" ? problem.fieldErrors : {},
    staleConflict:
      problem.status !== null &&
      !unknown &&
      !problem.worded &&
      (problem.code === "precondition.failed" || problem.status === 412),
  };
}

/** The refusals a page words on their own, beyond their kind. */
export type RefusalDetail =
  | "not-applied"
  | "initiator-excluded"
  | "not-retained"
  | "bytes-unavailable"
  | "outside-boundary"
  | "source-profile-required";
const refusalDetails: Record<string, RefusalDetail> = {
  "command.not-applied": "not-applied",
  "review.initiator-excluded": "initiator-excluded",
  "attachment.not-retained": "not-retained",
  "attachment.bytes-unavailable": "bytes-unavailable",
  "source-profile.required": "source-profile-required",
  "write.outside-boundary": "outside-boundary",
};
export function refusalDetail(
  refusal: { code: string | null } | null | undefined,
): RefusalDetail | null {
  const code = refusal?.code;
  return code && Object.hasOwn(refusalDetails, code)
    ? refusalDetails[code]!
    : null;
}

/** What a refused page of records says about the query that asked for it. */
export function recordQueryRefusal(error: unknown): {
  /** The cursor is no longer held, so the list starts again. */
  cursorExpired: boolean;
  /** The query is not offered to this session, so there is no list to show. */
  unsupported: boolean;
} {
  const { code } = problemView(error);
  return {
    cursorExpired: code === "page.expired" || code === "query.invalid",
    unsupported: code === "query.unsupported" || code === "query.invalid",
  };
}

/** Whether the service refused the session this read. */
export function notAuthorized(error: unknown): boolean {
  return problemView(error).status === 403;
}

/**
 * Whether a write was refused because what it wrote to moved on, so the page reads it
 * again: someone else holds it, it changed since it was read, or it is gone.
 */
const rereadKinds = new Set(["held-elsewhere", "stale", "gone"]);
export function rereadsOnRefusal(state: CommandState<unknown>): boolean {
  return state.state === "refused" && rereadKinds.has(state.refusal.kind);
}

/**
 * Why revoking an agent task failed: the list is stale when the service refused the
 * session or no longer has the task; otherwise the revocation may have happened.
 */
export function taskRevokeFailure(
  error: unknown,
): "stale" | "revoke-unconfirmed" {
  return error instanceof HostError && [403, 404].includes(error.status)
    ? "stale"
    : "revoke-unconfirmed";
}

/**
 * Whether a failed read of an item's agent tasks withholds them from this officer: the
 * service refused the session or does not show them the item. Any other failure, a
 * service error or a lost connection, may pass and says nothing about the officer.
 */
export function taskGrantsWithheld(error: unknown): boolean {
  return error instanceof HostError && [403, 404].includes(error.status);
}
