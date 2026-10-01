import type { CaseworkStaffingActionReference } from "./casework-staffing-types.js";

export interface AuthenticatedSession {
  authenticated: true;
  scope: string;
  /** Absent when the identity provider releases no name for the person. */
  displayName?: string;
  role: "holder" | "registrar" | "reviewer" | "supervisor" | "administrator";
  caseworkProfile?: "staff" | "supervisor" | "administrator";
  /** Opaque display discriminator. Casework remains authoritative for recovery. */
  caseworkRecoveryContext?: string;
  csrfToken: string;
  contractRevision?: string;
  capabilities: {
    verifiedPrefill?: boolean;
  };
}
export type CaseworkProfile = "staff" | "supervisor" | "administrator";
export const CASEWORK_PROBLEM_STATUSES = Object.freeze({
  "authentication.refused": 401,
  "idempotency.expired": 410,
  "idempotency.key-reused": 409,
  "operation.not-authorized": 403,
  "precondition.failed": 412,
  "precondition.required": 428,
  "profile.not-authorized": 403,
  "profile.not-human": 403,
  "request.body-too-large": 413,
  "request.invalid": 400,
  "request.method-not-allowed": 405,
  "request.not-found": 404,
  "request.unprocessable": 422,
  "request.unsupported-media-type": 415,
  "review.initiator-excluded": 403,
  "review.initiator-required": 422,
  "review.result-expired": 410,
  "review.submission-conflict": 409,
  "review.task-not-held": 409,
  "runtime.failure": 500,
  "service.unavailable": 503,
  "source-profile.required": 400,
  "source.bad-gateway": 502,
  "source.not-found": 404,
  "source.signature-invalid": 400,
  "work-item.already-claimed": 409,
  "work-item.not-holder": 409,
  "work-item.not-offered": 409,
  "work-item.not-visible": 404,
  "work-item.proposal-changed": 409,
  "work-item.recovery-pending": 409,
  "work-item.source-unavailable": 503,
  "work-item.superseded": 409,
} as const);
export type CaseworkProblemCode = keyof typeof CASEWORK_PROBLEM_STATUSES;
export const CASEWORK_PROBLEM_CODES = Object.freeze(
  Object.keys(CASEWORK_PROBLEM_STATUSES) as CaseworkProblemCode[],
);
export function isCaseworkProblemCode(
  code: string,
): code is CaseworkProblemCode {
  return Object.hasOwn(CASEWORK_PROBLEM_STATUSES, code);
}
export function caseworkProblemStatus(code: CaseworkProblemCode): number {
  return CASEWORK_PROBLEM_STATUSES[code];
}
export type CaseworkActionName = "claim" | "release" | "apply";
export type CaseworkDecisionOperation =
  Exclude<CaseworkActionName, "claim" | "release"> | (string & {});
export interface CaseworkActionReference {
  ref: string;
  bindingReference: string;
  name: CaseworkActionName;
  label: string;
}
export interface CaseworkWorkItem {
  id: string;
  revision: string;
  bindingReference: string;
  sourceRequestId: string;
  activity: "review" | "apply";
  state: string;
  queue: string;
  queueLabel: string;
  holder?: string | null;
  /**
   * The holder's account, with their directory name when Casework serves one,
   * so a name can be traced to the account that holds the item.
   */
  holderPrincipal?: CaseworkPrincipal | null;
  heldByMe: boolean;
  firstObservedAt: string;
  dueAt?: string | null;
  dueState?: "on-track" | "at-risk" | "overdue" | string;
  /**
   * Human references the officer chooses work by, read from the source
   * request on the host as a best-effort join. Casework itself never copies
   * BReg values, so both stay absent when the source could not be read.
   */
  reference?: string | null;
  supportingReference?: string | null;
  /** Why this item is in front of the officer, read from the observed event. */
  routing?: CaseworkRouting | null;
  /** The assignment context safe to display. These references never authorize an action. */
  assignment?: CaseworkAssignment | null;
  /** Current clock facts reduced to what an officer can act on. */
  clock?: CaseworkClock | null;
  /** Present when the item came back from the applicant with a note. */
  returned?: CaseworkReturnNote | null;
  /** When the current holder took or was assigned the item, recorded by Casework. */
  heldSince?: string | null;
  liveAttempt?: CaseworkAttemptStatus;
  actions: CaseworkActionReference[];
  staffingActions?: CaseworkStaffingActionReference[];
}
/**
 * The content keys a work item's state is worded by, most specific first.
 * Casework's states say something else on an apply item: it holds one `open`
 * (and its holder keeps it `claimed`) once the change can be applied, and
 * `waiting-application` while it cannot, whether it awaits its review, its
 * approval expired or applying it is blocked. So an apply item's state is
 * looked up as `apply:<state>` before the state alone.
 */
export function workItemStateKeys(item: CaseworkWorkItem): string[] {
  return item.activity === "apply"
    ? [`apply:${item.state}`, item.state]
    : [item.state];
}
/**
 * Why the item was routed here, as Casework recorded it. Every field is
 * optional in Casework itself, so a routing that carries only the policy
 * digest is a real state the screen must be able to explain.
 */
export interface CaseworkRouting {
  ruleId?: string;
  because?: string;
  policyDigest?: string;
}
export interface CaseworkAssignment {
  owner?: CaseworkPrincipal | null;
  assignedBy?: CaseworkPrincipal | null;
  absenceCover: boolean;
  staffingDiagnostic?: "no-cover-available" | null;
}
export type CaseworkClockState =
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "verification-pending"
  | "source-facts-missing";
export type CaseworkClockEffect =
  | { kind: "reminder"; at: string }
  | {
      kind: "reassign";
      at: string;
      because: string;
      queue: string;
      queueLabel: string;
    };
export interface CaseworkClock {
  state: CaseworkClockState;
  atRiskAt?: string | null;
  upcomingEffects: CaseworkClockEffect[];
}
export interface CaseworkReturnNote {
  reason?: string | null;
  flaggedFields: string[];
}
export type CaseworkItemView =
  "mine" | "my_teams" | "team_holdings" | "overdue" | "completed_by_me";
/** Filters the browser may send; the host forwards them to Casework as given. */
export interface CaseworkItemFilters {
  view?: CaseworkItemView;
  queue?: string;
  cursor?: string;
  limit?: string;
}
export interface CaseworkAttemptStatus {
  attemptId: string;
  itemId: string;
  state: "pending" | "uncertain";
  itemRevision: string;
  operation: CaseworkDecisionOperation;
  createdAt: string;
  receipt?: CaseworkSourceReceipt;
}
export interface CaseworkDraft {
  itemId: string;
  itemRevision: string;
  text: string;
  updatedAt?: string | null;
}
/**
 * A person as Casework identifies them. `displayName` is filled by the host
 * when the Casework directory carries one; until then screens show the subject.
 */
export interface CaseworkPrincipal {
  issuer: string;
  subject: string;
  displayName?: string;
}
/**
 * Accountable history kinds from Casework, minus the private ones the host
 * drops (observed, opened, draft_saved). `decision_refused` is an
 * `attempt_uncertain` entry Casework marked definitively refused, and
 * `attempt_settled` is an operator's settlement of an attempt Casework could not
 * confirm. A kind this host does not know is emitted as `other`, never as the
 * raw kind.
 */
export type CaseworkHistoryAction =
  | "claimed"
  | "assigned"
  | "delegated"
  | "caseload_moved"
  | "clock_reminder"
  | "clock_step_applied"
  | "clock_recomputed"
  | "released"
  | "attempt_reserved"
  | "attempt_uncertain"
  | "attempt_settled"
  | "decision_refused"
  | "action_completed"
  | "superseded"
  | "completed"
  | "other";
export interface CaseworkHistoryEntry {
  id: string;
  actor: string;
  actorPrincipal?: CaseworkPrincipal;
  action: CaseworkHistoryAction;
  operation?: CaseworkDecisionOperation;
  reason?: string;
  itemRevision: string;
  occurredAt: string;
  attemptReference?: string | null;
  bindingReference?: string | null;
  sourceReceipt?: CaseworkSourceReceipt | null;
}
export type CaseworkPageStatus =
  "complete" | "budget_exhausted" | "source_unavailable";
export interface CaseworkHistoryPage extends Page<CaseworkHistoryEntry> {
  status: CaseworkPageStatus;
}
export interface CaseworkWorkItemPage extends Page<CaseworkWorkItem> {
  status: CaseworkPageStatus;
  /** Queue labels the caller currently serves, even when this page is empty. */
  servedQueues: string[];
}
export interface CaseworkSourceReceipt {
  sourceRevision: string;
  resultingState: string;
  binding: {
    sourceRevision: string;
    version: string;
    integrity?: string | null;
    generation: string;
  };
  actorReference?: string | null;
  metadata: Readonly<Record<string, string>>;
}
export interface CaseworkHoldings {
  queue: string;
  queueLabel: string;
  visibleTotal: number;
  unclaimed: number;
  claimed: number;
  overdue: number;
  items: CaseworkWorkItem[];
  /** Who holds what, one row per holder and queue, from Casework's summaries. */
  holders?: CaseworkHolderSummary[];
  status: "complete" | "budget_exhausted";
  nextCursor?: string | null;
}
export interface CaseworkHolderSummary {
  /** Exact authority identity. Display names never identify a staffing target. */
  holderPrincipal: CaseworkPrincipal;
  principal: string;
  displayName?: string;
  queue: string;
  queueLabel: string;
  activeItems: number;
  overdueItems: number;
  heldByMe: boolean;
}
/** Queues and teams an administrator can see before creating a team. */
export interface CaseworkDirectory {
  queues: { id: string; label: string }[];
  teams: CaseworkTeam[];
}
export interface CaseworkTeam {
  id: string;
  staff: string[];
  supervisors: string[];
  queues: string[];
}
export interface CaseworkSetupInput {
  teamId: string;
  staffSubjects: string[];
  supervisorSubject: string;
  queueId: string;
}
export interface CaseworkCommand {
  actionRef: string;
}
export type CaseworkCommandResult =
  | {
      outcome: "confirmed";
      itemId: string;
      revision: string;
      /**
       * Casework confirmed the write but the host could not retain the next
       * actions; the item must be read again before the officer can act on it.
       */
      actionsUnavailable?: boolean;
    }
  | { outcome: "unknown"; attemptId: string; supportReference: string };
export type Session =
  AuthenticatedSession | { authenticated: false; loginUrl: string };
/** One governed attachment slot on a request, as this session may see it. */
export interface AttachmentSlot {
  /** The registry's slot identifier, a URL-safe token. */
  slot: string;
  required: boolean;
  maximumBytes: number;
  contentTypes: string[];
  file: AttachmentFile | null;
  /** Present when this session may place a file in the slot, carried back as the upload's action reference. */
  uploadRef?: string;
  /** Present when this session may empty the slot, carried back in a removeAttachment task. */
  removeRef?: string;
}
/** The file in a slot. The host never names it: the bytes download under the slot's name. */
export interface AttachmentFile {
  contentType: string;
  byteSize: number;
  /** Lowercase hex SHA-256 of the bytes, so a browser can recognise its own upload after an unknown outcome. */
  sha256: string;
  uploadedAt: string | null;
  /**
   * available: this session may download it now. pending: waiting for
   * verification. rejected: refused by verification. erased: removed by
   * retention. Only an available file has bytes to download.
   */
  status: "available" | "pending" | "rejected" | "erased";
}
/**
 * BREG's view of a change request's review: submission to the review authority,
 * the result, its delivery back, application and recovery. States are BREG's own.
 */
export interface ChangeRequestReview {
  submission: { state: string; requestId?: string };
  result: { state: string; completedAt?: string };
  delivery: { state: string };
  application: { mode: string; state: string };
  recovery: { state: string };
}
export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}
/** The browser receives only display-safe provenance, never the signed artifact or token. */
export interface VerifiedEvidenceDisplay {
  sourceValue: boolean;
  sourceLabel: string;
  verifiedAt: string;
  expiresAt: string;
  status: "verified" | "unverified";
  changedAfterVerification: boolean;
}
export interface VerifiedPrefill {
  evidenceRef: string;
  field: string;
  value: boolean;
  sourceLabel: string;
  verifiedAt: string;
  expiresAt: string;
}
export interface HostProblem {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  supportReference?: string;
}
