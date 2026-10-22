/**
 * The staffing writes: a cover saved or ended, and a movement of a person's caseload.
 * Each is sent through the session's retained commands; a resend is the same attempt,
 * never a second one.
 */
import type { CommandSpec } from "./command-hooks.js";
import type { CommandState, RefusalKind } from "./commands.js";
import type { HostClient } from "./index.js";
import type {
  CaseworkStaffingApplyCaseload,
  CaseworkStaffingCaseloadPreviewInput,
  CaseworkStaffingCreateAbsence,
  CaseworkStaffingDeleteAbsence,
  CaseworkStaffingUpdateAbsence,
} from "./casework-staffing-types.js";

/**
 * What this page sent for each attempt, so a resend goes to the same route
 * with the same body. After a reload the page no longer holds the body, and
 * the host resends the attempt it retained, by its id alone.
 */
const sentBodies = new Map<string, (host: HostClient) => Promise<unknown>>();

/** A command body without its attempt id, which the command hook issues. */
type WithoutAttempt<C> = C extends unknown ? Omit<C, "attemptId"> : never;

/** One kind of staffing write, sent through the session's retained commands. */
function staffingCommand<C extends { attemptId: string }, R>(
  scope: string,
  operation: string,
  route: (host: HostClient, command: C) => Promise<R>,
  invalidates?: CommandSpec<unknown, unknown>["invalidates"],
): CommandSpec<WithoutAttempt<C>, R> {
  const settle = async (attemptId: string, answer: Promise<R>) => {
    const value = await answer;
    if ((value as { outcome?: unknown }).outcome !== "unknown")
      sentBodies.delete(attemptId);
    return value;
  };
  return {
    scope,
    operation: () => operation,
    send(host, input, attemptId) {
      const command = { ...input, attemptId } as unknown as C;
      sentBodies.set(attemptId, (next) => route(next, command));
      return settle(attemptId, route(host, command));
    },
    retry(host, attemptId) {
      const resend = sentBodies.get(attemptId);
      return settle(
        attemptId,
        resend
          ? (resend(host) as Promise<R>)
          : // The host answers a retained staffing write with its own result.
            host.retryCommand<R>(attemptId),
      );
    },
    ...(invalidates ? { invalidates } : {}),
  };
}

const absenceQueries: CommandSpec<unknown, unknown>["invalidates"] = (
  _value,
  scope,
) => [[scope, "casework-staffing-absences"]];

/** Recording a new cover, or changing the dates or colleague of one. */
export const absenceSaveCommand = staffingCommand(
  "staffing-absence",
  "save",
  (
    host,
    command: CaseworkStaffingCreateAbsence | CaseworkStaffingUpdateAbsence,
  ) =>
    "absenceRef" in command
      ? host.staffingUpdateAbsence(command)
      : host.staffingCreateAbsence(command),
  absenceQueries,
);
export const absenceEndCommand = staffingCommand(
  "staffing-absence-end",
  "delete",
  (host, command: CaseworkStaffingDeleteAbsence) =>
    host.staffingDeleteAbsence(command),
  absenceQueries,
);
/**
 * One movement per person and queue. It names the preview alone: Casework moves exactly
 * the set of review tasks that preview fenced, all at once.
 */
export const caseloadCommand = staffingCommand(
  "staffing-caseload",
  "apply",
  (host, command: CaseworkStaffingApplyCaseload) =>
    host.staffingApplyCaseload(command),
);
/** One per scope: a retry is sent by its attempt alone, whatever the kind. */
export const staffingCommands = [
  absenceSaveCommand,
  absenceEndCommand,
  caseloadCommand,
];

/** Refusals of a retry that say the host can no longer resend the attempt. */
const unretriable = new Set<RefusalKind | undefined>([
  "gone",
  "not-authorized",
  "replay-expired",
]);
/**
 * Whether an unconfirmed staffing write is left for the officer to check: it lost its
 * authority, or a resend was refused in a way that ends the attempt.
 */
export function staffingWriteStuck(state: CommandState<unknown>): boolean {
  return (
    state.state === "unknown" &&
    (state.withoutAuthority || unretriable.has(state.lastRefusal?.kind))
  );
}
/** Whether a write's outcome is still open: unknown, or being checked. */
export function commandUnresolved(state: CommandState<unknown>): boolean {
  return state.state === "unknown" || state.state === "recovering";
}

/** The movement a caseload preview asks about. */
export type CaseloadPreviewInput = CaseworkStaffingCaseloadPreviewInput;
