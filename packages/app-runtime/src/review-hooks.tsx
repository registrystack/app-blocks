/**
 * Hooks for Casework review tasks and the BREG change request they review. Every write
 * goes through `useCommand`, keyed by an attempt id the host retains; nothing here retries
 * on its own. A read back after a refused resend is a read, not a write.
 */
import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  type QueryKey,
} from "@tanstack/react-query";
import {
  useCommand,
  useReadBackAfterRetry,
  useRestoredOperation,
  type CommandSpec,
} from "./command-hooks.js";
import type { CommandMarker, CommandState, ProbeVerdict } from "./commands.js";
import { notAuthorized } from "./problems.js";
import type { HostClient } from "./index.js";
import { useAuthority, useHost } from "./react.js";
import type {
  CaseworkTaskApprovalResult,
  CaseworkTaskGrantList,
  CaseworkTaskPreviewList,
  CaseworkTaskDispatchResult,
} from "./casework-task-types.js";
import type {
  ReviewCommandResult,
  ReviewDecision,
  ReviewDraftResult,
  ReviewHistoryEntry,
  ReviewHoldOperation,
  ReviewJson,
  ReviewNoteAudience,
  ReviewQueueFilters,
  ReviewReadBack,
  ReviewTask,
} from "./review-types.js";

/** Everything a review write can change on the page. */
function reviewKeys(scope: string, taskId: string): QueryKey[] {
  return [
    [scope, "review-task", taskId],
    [scope, "review-queue"],
    [scope, "review-history"],
  ];
}

export function useReviewQueue(filters: ReviewQueueFilters = {}) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "review-queue", filters],
    queryFn: () => host.reviewQueue(filters),
  });
}

export function useReviewTask(taskId: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "review-task", taskId],
    queryFn: () => host.reviewTask(taskId),
  });
}

interface HoldInput {
  taskId: string;
  operation: ReviewHoldOperation;
  revision: string;
}
/** Whether a read task shows the hold the attempt asked for. */
export function holdVerdict(
  marker: Pick<CommandMarker, "operation" | "expectedRevision">,
  task: ReviewTask,
): ProbeVerdict<ReviewCommandResult> {
  const done =
    marker.operation === "claim"
      ? task.heldByYou
      : task.status === "open" || (task.status === "held" && !task.heldByYou);
  if (done)
    return { settled: "confirmed", value: { outcome: "confirmed", task } };
  if (task.revision === marker.expectedRevision)
    return { settled: "not-applied" };
  return { settled: "unknown" };
}
/**
 * A claim or release body is the revision and the operation, nothing else, so the marker
 * alone can resend it, even from the officer's next session.
 */
const holdCommand: CommandSpec<HoldInput, ReviewCommandResult> = {
  scope: "review-task-hold",
  operation: (input) => input.operation,
  expectedRevision: (input) => input.revision,
  send: (host, input, attemptId) =>
    host.holdReviewTask(input.taskId, input.operation, {
      attemptId,
      expectedRevision: input.revision,
    }),
  retry: (host, attemptId, marker) =>
    host.holdReviewTask(
      marker.target.id,
      marker.operation === "release" ? "release" : "claim",
      { attemptId, expectedRevision: marker.expectedRevision ?? "" },
    ),
  probe: async (host, marker) =>
    holdVerdict(marker, await host.reviewTask(marker.target.id)),
  invalidates: (_value, scope) => [
    [scope, "review-task"],
    [scope, "review-queue"],
  ],
  recoverAcrossSessions: true,
};
export function useReviewTaskHold(taskId: string) {
  const command = useCommand(holdCommand, taskId);
  const retry = useReadBackAfterRetry(command);
  const restoredOperation = useRestoredOperation(
    holdCommand.scope,
    command.state,
  );
  return {
    ...command,
    retry,
    /**
     * The operation an unconfirmed attempt restored from an earlier page was sent as, read
     * from its marker.
     */
    restoredOperation,
    claim: (task: Pick<ReviewTask, "revision">) =>
      command.run({ taskId, operation: "claim", revision: task.revision }),
    release: (task: Pick<ReviewTask, "revision">) =>
      command.run({ taskId, operation: "release", revision: task.revision }),
  };
}

interface DecisionInput {
  taskId: string;
  revision: string;
  decision: ReviewDecision;
}
/**
 * How a read back settles an unconfirmed decision. Only a decision attributed to this
 * officer confirms; a task still undecided at the revision the attempt named was not
 * decided by it. A task decided without that attribution stays unconfirmed.
 */
export function decisionVerdict(
  marker: Pick<CommandMarker, "expectedRevision">,
  readBack: ReviewReadBack,
): ProbeVerdict<ReviewCommandResult> {
  if (readBack.status === "decided" && readBack.decidedByYou)
    return { settled: "confirmed", value: { outcome: "confirmed" } };
  if (
    readBack.status !== "decided" &&
    readBack.revision === marker.expectedRevision
  )
    return { settled: "not-applied" };
  return { settled: "unknown" };
}
export function useReviewDecision(taskId: string) {
  const [readBack, setReadBack] = useState<ReviewReadBack | null>(null);
  const spec: CommandSpec<DecisionInput, ReviewCommandResult> = {
    scope: "review-decision",
    operation: (input) => input.decision.type,
    expectedRevision: (input) => input.revision,
    send: (host, input, attemptId) =>
      host.decideReviewTask(input.taskId, {
        attemptId,
        expectedRevision: input.revision,
        decision: input.decision,
      }),
    retry: (host, attemptId) =>
      host.retryCommand<ReviewCommandResult>(attemptId),
    probe: async (host, marker) => {
      const read = await host.reviewReadBack(marker.target.id);
      setReadBack(read);
      return decisionVerdict(marker, read);
    },
    invalidates: (_value, scope) => reviewKeys(scope, taskId),
    // The officer's next session can still read the task back and attribute the decision.
    recoverAcrossSessions: true,
  };
  const command = useCommand(spec, taskId);
  const retry = useReadBackAfterRetry(command);
  return {
    ...command,
    retry,
    /** The last read back of an unconfirmed decision, if one was made. */
    readBack,
    /** The task was decided, but not provably by this officer's send. */
    decidedUnattributed:
      command.state.state === "unknown" &&
      readBack?.status === "decided" &&
      !readBack.decidedByYou,
    decide: (task: Pick<ReviewTask, "revision">, decision: ReviewDecision) => {
      setReadBack(null);
      return command.run({ taskId, revision: task.revision, decision });
    },
  };
}

function draftKeys(scope: string): QueryKey[] {
  return [
    [scope, "review-draft"],
    [scope, "review-task"],
  ];
}
interface DraftInput {
  taskId: string;
  revision: string;
  body: ReviewJson;
}
const draftSave: CommandSpec<DraftInput, ReviewDraftResult> = {
  scope: "review-draft-save",
  operation: () => "save",
  expectedRevision: (input) => input.revision,
  send: (host, input, attemptId) =>
    host.saveReviewDraft(input.taskId, {
      attemptId,
      expectedRevision: input.revision,
      body: input.body,
    }),
  retry: (host, attemptId) => host.retryCommand<ReviewDraftResult>(attemptId),
  // Casework moves the task revision when a draft is saved or deleted, so the
  // task is read again before the next claim, release or decision.
  invalidates: (value, scope) =>
    value.outcome === "confirmed" ? draftKeys(scope) : [],
};
const draftDelete: CommandSpec<
  { taskId: string; revision: string },
  ReviewDraftResult
> = {
  scope: "review-draft-delete",
  operation: () => "delete",
  expectedRevision: (input) => input.revision,
  send: (host, input, attemptId) =>
    host.deleteReviewDraft(input.taskId, {
      attemptId,
      expectedRevision: input.revision,
    }),
  retry: (host, attemptId, marker) =>
    host.deleteReviewDraft(marker.target.id, {
      attemptId,
      expectedRevision: marker.expectedRevision ?? "",
    }),
  invalidates: (_value, scope) => draftKeys(scope),
  recoverAcrossSessions: true,
};
/**
 * The officer's draft on a task. A later save supersedes an unconfirmed one: the earlier
 * attempt is given up and the later body is sent as a new attempt.
 */
export function useReviewDraft(taskId: string) {
  const host = useHost(),
    session = useAuthority();
  const draft = useQuery({
    queryKey: [session.scope, "review-draft", taskId],
    queryFn: async () => (await host.reviewDraft(taskId)).draft,
  });
  const save = useCommand(draftSave, taskId);
  const remove = useCommand(draftDelete, taskId);
  const [queued, setQueued] = useState<DraftInput | null>(null);
  useEffect(() => {
    if (queued && save.state.state === "idle") {
      setQueued(null);
      void save.run(queued);
    }
  }, [queued, save]);
  return {
    draft,
    save: {
      ...save,
      run: (task: Pick<ReviewTask, "revision">, body: ReviewJson) => {
        const input = { taskId, revision: task.revision, body };
        if (save.state.state === "unknown") {
          save.dismissUnknown();
          setQueued(input);
          return;
        }
        void save.run(input);
      },
    },
    remove: {
      ...remove,
      run: (task: Pick<ReviewTask, "revision">) =>
        remove.run({ taskId, revision: task.revision }),
    },
  };
}

type NoteResult =
  | { outcome: "confirmed"; entry: ReviewHistoryEntry }
  | { outcome: "unknown"; attemptId: string; supportReference: string };
const noteCommand: CommandSpec<
  { requestId: string; audience: ReviewNoteAudience; note: string },
  NoteResult
> = {
  scope: "review-note",
  operation: (input) => input.audience,
  send: (host, input, attemptId) =>
    host.addReviewNote(input.requestId, {
      attemptId,
      audience: input.audience,
      note: input.note,
    }),
  retry: (host, attemptId) => host.retryCommand<NoteResult>(attemptId),
  invalidates: (_value, scope) => [[scope, "review-history"]],
};
export function useReviewNote(requestId: string) {
  const command = useCommand(noteCommand, requestId);
  const state = command.state;
  return {
    ...command,
    /**
     * The request's result retention ended, so the note can no longer be added and the
     * resend cannot say whether it was. The officer dismisses it explicitly.
     */
    expired:
      state.state === "unknown" &&
      state.lastRefusal?.code === "review.result-expired",
    add: (audience: ReviewNoteAudience, note: string) =>
      command.run({ requestId, audience, note }),
  };
}

/**
 * What a send-back does with its queued note as its decision settles. The note is sent
 * only after the decision is confirmed, and not while a note is still in flight, so it is
 * never sent twice; a decision refused or given up takes its note with it.
 */
export function sendBackStep(
  decision: CommandState<unknown>["state"],
  note: CommandState<unknown>["state"],
): "send" | "wait" | "drop" {
  if (decision === "confirmed")
    return note === "sending" || note === "recovering" || note === "unknown"
      ? "wait"
      : "send";
  if (decision === "refused" || decision === "idle") return "drop";
  return "wait";
}
interface RequesterNoteInput {
  requestId: string;
  note: string;
}
const requesterNoteCommand: CommandSpec<RequesterNoteInput, NoteResult> = {
  scope: "review-send-back-note",
  operation: () => "requester",
  send: (host, input, attemptId) =>
    host.addReviewNote(input.requestId, {
      attemptId,
      audience: "requester",
      note: input.note,
    }),
  retry: (host, attemptId) => host.retryCommand<NoteResult>(attemptId),
  invalidates: (_value, scope) => [[scope, "review-history"]],
};
/**
 * Sends a task back for changes with a note its requester reads. The decision and the
 * note are separate writes, each its own attempt: the note is sent once the decision is
 * confirmed, including after a lost decision is recovered on this page. A note refused
 * after the decision was recorded stays visible and can be sent again as a new attempt.
 * A note queued behind a decision is held in this page only; after a reload, the
 * officer adds it from the notes panel.
 */
export function useSendBack(taskId: string) {
  const decision = useReviewDecision(taskId);
  const note = useCommand(requesterNoteCommand, taskId);
  const [queued, setQueued] = useState<RequesterNoteInput | null>(null);
  const [sent, setSent] = useState<RequesterNoteInput | null>(null);
  const step = queued
    ? sendBackStep(decision.state.state, note.state.state)
    : "wait";
  useEffect(() => {
    if (!queued || step === "wait") return;
    setQueued(null);
    if (step === "send") {
      setSent(queued);
      void note.run(queued);
    }
  }, [queued, step, note]);
  const noteState = note.state;
  return {
    decision,
    note: {
      ...note,
      /** The request's result retention ended; see `useReviewNote`. */
      expired:
        noteState.state === "unknown" &&
        noteState.lastRefusal?.code === "review.result-expired",
      /** Sends a refused note again, as a new attempt. */
      resend: () => (sent ? note.run(sent) : Promise.resolve(noteState)),
    },
    sendBack: (
      task: Pick<ReviewTask, "revision" | "requestId">,
      next: ReviewDecision,
      requesterNote: string,
    ) => {
      setQueued({ requestId: task.requestId, note: requesterNote });
      return decision.decide(task, next);
    },
  };
}

export function useReviewHistory(requestId: string) {
  const host = useHost(),
    session = useAuthority();
  const history = useInfiniteQuery({
    queryKey: [session.scope, "review-history", requestId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => host.reviewHistory(requestId, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  return {
    ...history,
    data: history.data?.pages.flatMap((page) => page.items),
  };
}

/** What the person who submitted a request may read of its review. */
export function useRequesterReviewNotes(entity: string, id: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "requester-review-notes", entity, id],
    queryFn: () => host.requesterReviewNotes(entity, id),
  });
}

export function useReviewClocks(requestId: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "review-clocks", requestId],
    queryFn: async () => (await host.reviewClocks(requestId)).items,
  });
}

/** Casework answers supervisors of the task's queue team only; read on request. */
export function useReviewAccountability(eventId: string, enabled: boolean) {
  const host = useHost(),
    session = useAuthority();
  const accountability = useQuery({
    queryKey: [session.scope, "review-accountability", eventId],
    queryFn: () => host.reviewAccountability(eventId),
    enabled,
    retry: false,
  });
  // Read on access, so a page that does not ask does not follow the error.
  return Object.defineProperty(accountability, "notAuthorized", {
    get: () => notAuthorized(accountability.error),
  }) as typeof accountability & {
    /** The session is not a supervisor of the task's queue team. */
    readonly notAuthorized: boolean;
  };
}

interface AssignmentInput {
  taskId: string;
  revision: string;
  operation: "assign" | "delegate";
  to: { issuer: string; subject: string };
  reason?: string;
}
const assignmentCommand: CommandSpec<AssignmentInput, ReviewCommandResult> = {
  scope: "review-task-assignment",
  operation: (input) => input.operation,
  expectedRevision: (input) => input.revision,
  send: (host, input, attemptId) =>
    host.assignReviewTask(input.taskId, {
      attemptId,
      expectedRevision: input.revision,
      operation: input.operation,
      to: input.to,
      ...(input.reason ? { reason: input.reason } : {}),
    }),
  retry: (host, attemptId) => host.retryCommand<ReviewCommandResult>(attemptId),
  invalidates: (_value, scope) => [
    [scope, "review-task"],
    [scope, "review-queue"],
  ],
};
export function useReviewTaskAssignment(taskId: string) {
  const command = useCommand(assignmentCommand, taskId);
  return {
    ...command,
    assign: (
      task: Pick<ReviewTask, "revision">,
      operation: "assign" | "delegate",
      to: { issuer: string; subject: string },
      reason?: string,
    ) =>
      command.run({
        taskId,
        revision: task.revision,
        operation,
        to,
        ...(reason ? { reason } : {}),
      }),
  };
}

/** The agent-task calls one panel makes, bound to a work item or a review task. */
export interface TaskGrantCalls {
  previews(): Promise<CaseworkTaskPreviewList>;
  list(): Promise<CaseworkTaskGrantList>;
  revoke(grant: string): Promise<{ id: string; invalidated: boolean }>;
  dispatch(grant: string): Promise<CaseworkTaskDispatchResult>;
}
/**
 * An approval is keyed by its attempt id on the host. An unconfirmed one is resent
 * exactly, however long ago its preview was read.
 */
export function taskApprovalCommand(
  scope: string,
  approve: (
    host: HostClient,
    id: string,
    approvalRef: string,
    attemptId: string,
  ) => Promise<CaseworkTaskApprovalResult>,
): CommandSpec<
  { id: string; approvalRef: string },
  CaseworkTaskApprovalResult
> {
  return {
    scope,
    operation: () => "approve",
    send: (host, input, attemptId) =>
      approve(host, input.id, input.approvalRef, attemptId),
    retry: (host, attemptId) =>
      host.retryCommand<CaseworkTaskApprovalResult>(attemptId),
    // The panel holds its own list; nothing else on the page reads grants.
    invalidates: () => [],
  };
}
const reviewApproval = taskApprovalCommand(
  "review-task-approval",
  (host, id, approvalRef, attemptId) =>
    host.approveReviewTask(id, approvalRef, attemptId),
);
export function useReviewTaskGrants(taskId: string) {
  const host = useHost();
  // One object per task, so a panel that reads on a change of calls reads once.
  const calls = useMemo<TaskGrantCalls>(
    () => ({
      previews: () => host.reviewTaskPreviews(taskId),
      list: () => host.reviewTaskGrants(taskId),
      revoke: (grant) => host.revokeReviewTask(taskId, grant),
      dispatch: (grant) => host.dispatchReviewTask(taskId, grant),
    }),
    [host, taskId],
  );
  return { calls, approval: useCommand(reviewApproval, taskId) };
}
