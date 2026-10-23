/**
 * Casework review tasks as the browser sees them. The host reads them with the
 * officer's own Casework profile; nothing here authorizes an action, because
 * Casework checks authority on every write.
 */
import type { CaseworkPageStatus, CaseworkPrincipal } from "./types.js";

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
  /** When the task falls due; absent when Casework sets no deadline. */
  deadlineAt?: string;
  /**
   * When Casework opened the task. The host sends it with every task it reads;
   * it is optional so hand-built tasks (gallery and test fixtures) need not carry it.
   */
  createdAt?: string;
  /**
   * Human references of the request under review, joined on the host from the
   * registry record the task reviews. Absent when the caller cannot read it.
   */
  reference?: string | null;
  supportingReference?: string | null;
  /** The BReg proposal whose exact submission the task's subject binds, joined on the host. */
  sourceRequestId?: string;
  sourceRequestEntity?: string;
}
/** The part of a review task an inbox row needs to point at it. */
export type ReviewTaskLink = Pick<
  ReviewTask,
  "taskId" | "status" | "revision" | "heldByYou"
>;
export interface ReviewTaskPage {
  items: ReviewTask[];
  nextCursor?: string | null;
  /** Anything but complete means the page was cut short; an empty page may still continue. */
  status: CaseworkPageStatus;
}
export interface ReviewQueueFilters {
  queue?: string;
  cursor?: string;
  limit?: string;
  ownership?: "assigned_to_me" | "unclaimed";
  /**
   * Matched exactly against Casework's display reference for each task. For a
   * review BReg submitted, that is BReg's `breg:` binding string, not the
   * reference people see on the request.
   */
  reference?: string;
  sort?: "due" | "subject" | "reference";
}
/** Supervisor discovery carries no reviewer context, holder or decision content. */
export interface SupervisoryReviewTask {
  taskId: string;
  requestId: string;
  queue: string;
  queueLabel: string;
  revision: string;
  state: ReviewTaskStatus;
  /**
   * Casework's own statement that no one is available to take the task, or
   * that too few eligible reviewers remain to give the approvals it needs.
   */
  staffingDiagnostic?: "no-cover-available" | "insufficient-distinct-approvers";
  accountabilityEventId?: string;
}
export interface SupervisoryReviewTaskPage {
  items: SupervisoryReviewTask[];
  nextCursor?: string;
  status: CaseworkPageStatus;
}
export interface SupervisoryReviewFilters
  extends Omit<ReviewQueueFilters, "ownership" | "reference" | "sort"> {
  /** Exact canonical request reference; native authorization still governs every row. */
  requestId?: string;
}
export interface ReviewDecisionReceipt {
  policy: { id: string; version: string; digest: string };
  decision: ReviewDecision["type"];
  outcome?: string;
  /** The outcome label from the decision's immutable pinned policy. */
  outcomeLabel?: string;
  decidedAt: string;
}
/** Current caller's retained decisions, without submitted context or private reasons. */
export interface OwnReviewDecision {
  taskId: string;
  requestId: string;
  queue: string;
  requesterReference: string;
  decisionReceipt: ReviewDecisionReceipt;
}
export interface OwnReviewDecisionPage {
  items: OwnReviewDecision[];
  nextCursor?: string;
  status: CaseworkPageStatus;
}
export type OwnReviewDecisionFilters = Pick<ReviewQueueFilters, "queue" | "cursor" | "limit">;
export type ReviewSettlement =
  | "approved"
  | "rejected"
  | "changes_requested"
  | "answered";
/** Whether an outcome asks for, allows, or refuses a reason the requester will see. */
export type ReviewPublicReason = "required" | "optional" | "none";
/** One declared outcome, approval included, from the task's policy snapshot. */
export interface ReviewOutcome {
  id: string;
  label: string;
  settlement: ReviewSettlement;
  reasonRequired: boolean;
  publicReason: ReviewPublicReason;
  resultRequired: boolean;
}
export interface ReviewPolicy {
  id: string;
  version: string;
  digest?: string;
  purpose: "approval" | "answer";
  outcomes: ReviewOutcome[];
  /** The closed result schema, when the kind declares structured results. */
  resultSchema?: ReviewJson;
  displaySchema: ReviewJson;
  retention: { terminalRetentionDays: number; accountabilityRetentionDays: number };
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
  /** Only the current caller's own retained decision, from the authoritative read. */
  decisionReceipt?: ReviewDecisionReceipt;
  decidedByYou?: boolean;
}
/** `publicReason` is the reason the requester will see, as the chosen outcome allows it. */
export type ReviewDecision =
  | { type: "approve"; outcome: string; publicReason?: string }
  | {
      type: "reject" | "changes_requested" | "answer";
      outcome: string;
      reason?: string;
      publicReason?: string;
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
 * has not reached review; `expired` that the review is no longer kept;
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
  /** The stage a stage clock runs for; a clock on the request's subject has none. */
  stageId?: string;
  state: "running" | "completed" | "cancelled" | "source_facts_missing";
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
  /** Optional retained selection, supplied only by the explicit audited read. */
  decisionReceipt?: ReviewDecisionReceipt;
}

/** One stage of a review policy, as Casework states it. */
export interface ReviewPolicyStage {
  id: string;
  queue: string;
  queueLabel: string;
  decidingProfiles: string[];
  requiredApprovals: number;
  /** The one who submitted the request never reviews it at this stage. */
  excludeInitiator: boolean;
  /** Whoever reviewed an earlier stage does not review this one. */
  excludePreviousStageReviewers: boolean;
}
/** How a decision can end a review, as the policy pins it. */
export interface ReviewPolicyOutcome {
  id: string;
  label: string;
  settlement: "approved" | "rejected" | "changes-requested" | "answered";
}
/** A review policy's stages, deadlines and outcomes; never its schemas. */
export interface ReviewPolicySummary {
  id: string;
  purpose: "approval" | "answer";
  stages: ReviewPolicyStage[];
  /** The ids of the deadlines that run on a review of this policy. */
  clocks: string[];
  outcomes: ReviewPolicyOutcome[];
}
export interface ReviewPolicyList {
  items: ReviewPolicySummary[];
}
