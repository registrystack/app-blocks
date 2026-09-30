/**
 * Casework review tasks as the browser sees them. The host reads them with the
 * officer's own Casework profile; nothing here authorizes an action, because
 * Casework checks authority on every write.
 */
import type { CaseworkPrincipal } from "./types.js";

export type ReviewJson =
  | string
  | number
  | boolean
  | null
  | ReviewJson[]
  | { [key: string]: ReviewJson };

export type ReviewTaskStatus = "open" | "held" | "decided";
export interface ReviewTask {
  taskId: string;
  requestId: string;
  stageIndex: number;
  stageId: string;
  queue: string;
  queueLabel: string;
  /** Casework's revision as text; every write names the revision it was read at. */
  revision: string;
  eligibleProfiles: string[];
  status: ReviewTaskStatus;
  holder?: CaseworkPrincipal;
  heldByYou: boolean;
}
export interface ReviewTaskPage {
  items: ReviewTask[];
  nextCursor?: string | null;
}
export interface ReviewQueueFilters {
  queue?: string;
  cursor?: string;
  limit?: string;
}
export type ReviewSettlement = "rejected" | "changes_requested" | "answered";
/** One declared outcome other than approval, from the task's policy snapshot. */
export interface ReviewOutcome {
  id: string;
  label: string;
  settlement: ReviewSettlement;
  reasonRequired: boolean;
  resultRequired: boolean;
}
export interface ReviewPolicy {
  id: string;
  version: string;
  purpose: "approval" | "answer";
  outcomes: ReviewOutcome[];
  /** The closed result schema, when the kind declares structured results. */
  resultSchema?: ReviewJson;
  displaySchema: ReviewJson;
  retention: { terminalDays: number; accountabilityDays: number };
}
export interface ReviewSubject {
  source: string;
  type: string;
  id: string;
  version: string;
}
/** The `ReviewSubject.source` value naming a record the base registry engine manages. */
export const bregReviewSubjectSource = "breg";
export type ReviewContext =
  | { strategy: "submitted"; snapshot: Record<string, ReviewJson> }
  | {
      strategy: "source";
      reference: string;
      bindingStatus: "current" | "binding_changed";
      displayReference?: string;
      display?: Record<string, ReviewJson>;
    };
/** A task with what the officer needs to decide it. */
export interface ReviewTaskDetail extends ReviewTask {
  subject: ReviewSubject;
  requesterReference: string;
  policy: ReviewPolicy;
  /** Per-request limits on structured results, as the requester set them. */
  resultConstraints?: Record<string, ReviewJson>;
  context: ReviewContext;
}
export type ReviewDecision =
  | { type: "approve" }
  | {
      type: "reject" | "changes_requested" | "answer";
      outcome: string;
      reason?: string;
      result?: Record<string, ReviewJson>;
    };
/** Every review write names the attempt and the task revision it was read at. */
export interface ReviewWrite {
  attemptId: string;
  expectedRevision: string;
}
export type ReviewHoldOperation = "claim" | "release";
export interface ReviewDecisionCommand extends ReviewWrite {
  decision: ReviewDecision;
}
export interface ReviewAssignmentCommand extends ReviewWrite {
  operation: "assign" | "delegate";
  to: { issuer: string; subject: string };
  reason?: string;
}
export type ReviewCommandResult =
  | { outcome: "confirmed"; task?: ReviewTask }
  | { outcome: "unknown"; attemptId: string; supportReference: string };
/**
 * A read back of a decision whose send was not confirmed. `decidedByYou` is
 * true only when Casework reports the decided task as decided by the caller
 * (`decidedByCaller`); any other decided task is not attributed to this officer.
 */
export interface ReviewReadBack {
  taskId: string;
  status: ReviewTaskStatus;
  revision: string;
  heldByYou: boolean;
  decidedByYou: boolean;
}
export interface ReviewDraft {
  taskId: string;
  body: ReviewJson;
  revision: string;
  updatedAt: string;
}
export interface ReviewDraftCommand extends ReviewWrite {
  body: ReviewJson;
}
export type ReviewDraftResult =
  | { outcome: "confirmed"; draft: ReviewDraft | null }
  | { outcome: "unknown"; attemptId: string; supportReference: string };
export type ReviewNoteAudience = "reviewers" | "requester";
export interface ReviewNoteCommand {
  attemptId: string;
  audience: ReviewNoteAudience;
  note: string;
}
export interface ReviewHistoryEntry {
  eventId: string;
  taskId?: string;
  kind: string;
  /** True when the entry's actor reference is this officer's. */
  byYou: boolean;
  detail: ReviewJson;
  occurredAt: string;
}
export interface ReviewHistoryPage {
  items: ReviewHistoryEntry[];
  nextCursor?: string | null;
}
/** A note a reviewer left for the person who submitted the request. */
export interface RequesterReviewNote {
  eventId: string;
  note: string;
  occurredAt: string;
}
/**
 * What the person who submitted a request may read of its review: the notes
 * left for them and how the review settled. `not-submitted` means the request
 * never reached review; `expired` that the review is no longer kept;
 * `unavailable` that the review authority shows this person no history.
 */
export interface RequesterReviewNotes {
  state: "available" | "none" | "not-submitted" | "expired" | "unavailable";
  notes: RequesterReviewNote[];
  settled?: { status: string; occurredAt: string };
}
export interface ReviewClock {
  clockOccurrenceId: string;
  clockId: string;
  state:
    "running" | "paused" | "completed" | "cancelled" | "source_facts_missing";
  anchorAt: string;
  dueAt?: string;
  atRiskAt?: string;
  completedAt?: string;
}
/** Readable by supervisors of the task's queue team only. */
export interface ReviewAccountability {
  eventId: string;
  taskId: string;
  actor: CaseworkPrincipal;
  profileId: string;
  decision: string;
  privateReason?: string;
  occurredAt: string;
  retainedUntil: string;
}
