import { useContentArea } from "@/blocks/lib/content";

/**
 * The words the Casework review pages show on their own: the queue table and
 * its views, Take next, the task's status line and its hold controls. Kept apart from
 * `CaseworkContent` (`@/blocks/casework/casework-content`), which already
 * carries the review task's context, decision, draft, notes, history and
 * clocks wording for the blocks those panels render; these words are only
 * meaningful to this page composition's own queue and status line.
 */
export interface ReviewPageContent {
  queueTitle: string;
  queueDescription: string;
  queueCaption: string;
  queueEmpty: string;
  queueReference: string;
  /** Names a task in the queue by the request it reviews: "Review {reference}". */
  queueRowReference: string;
  /**
   * Names a task in the queue by its place in the list: "Review task {number}",
   * when the host could not name the request it reviews.
   */
  queueRowName: string;
  /**
   * Heads the column naming what each task asks: the label of the request
   * entity the host joins onto it, or the generic request word.
   */
  queueKind: string;
  queueQueue: string;
  /** The queue filter's choice of no one queue. */
  queueAll: string;
  /** Names the chosen queue in its filter chip: "Queue: {queue}". */
  queueChip: string;
  /** Heads the column saying how long each task has waited since Casework opened it. */
  queueWaiting: string;
  /** Read to a screen reader in place of a wait the host could not date. */
  queueWaitingUnknown: string;
  queueStatus: string;
  /** Heading of the column that shows the supporting reference of a task. */
  queueSupporting: string;
  /** How many tasks the list holds (`{count}`), said only when the whole list is on the page. */
  queueCount: string;
  /** How many tasks this page shows (`{count}`), when more pages follow or came before. */
  queueCountOnPage: string;
  /** Opens the task Casework names as next; it never claims it. */
  takeNext: string;
  /** Why Take next cannot be used: Casework has no task waiting. */
  nextNone: string;
  /** Why Take next cannot be used: Casework could not say. */
  nextUnavailable: string;
  nextRetry: string;
  back: string;
  /** The task page's title, filled with the request's own reference: "Review {reference}". */
  taskTitle: string;
  /**
   * The task page's title for a request of the register, filled with its
   * reference and the label of its request entity: "Review {reference} ({kind})".
   */
  taskTitleKind: string;
  /** The task page's title when nothing the host serves names the task or its kind. */
  taskTitleUnnamed: string;
  /** Heads the panel when Casework cannot find the task, or does not show it to this officer. */
  taskUnavailable: string;
  /**
   * Opens the request the task reviews on the app's own request page, where
   * the reviewer reads what it changes and its supporting documents.
   */
  viewRequest: string;
  /** Heading over the link to the request's documents and evidence. */
  documentsHeading: string;
  documentsHint: string;
  statusOpen: string;
  /** A held task's status, whoever holds it. */
  statusInReview: string;
  /** Who holds a held task, on a line of its own beside its status. */
  statusHeldByYou: string;
  /** Filled with who holds the task: "Held by {holder}". */
  statusHeldBy: string;
  statusHeldElsewhere: string;
  statusDecided: string;
  claim: string;
  /** Beside the claim button: the decision controls appear only once the task is claimed. */
  claimHint: string;
  release: string;
  claimUnconfirmed: string;
  releaseUnconfirmed: string;
  retryClaim: string;
  retryRelease: string;

  /** Names the owner choice of the queue view: all reviews, those assigned to you, or unassigned ones. */
  ownerLabel: string;
  ownerAll: string;
  ownerMine: string;
  ownerUnassigned: string;

  /** The supervisor's accountability list of every review in the queues they supervise. */
  teamTitle: string;
  teamDescription: string;
  teamStaffingLink: string;
  teamCaption: string;
  teamEmpty: string;
  teamQueue: string;
  teamState: string;
  teamStateOpen: string;
  teamStateHeld: string;
  teamStateDecided: string;
  /** Casework's statement that no one is available to take a review. */
  teamNoCover: string;
  /** Casework's statement that too few reviewers can give a review's approvals. */
  teamTooFewApprovers: string;
  /** Said when a page of the list is cut short, empty or not. */
  teamPartial: string;
  /** `{count}`: the reviews on the page. */
  teamCount: string;
  /** Leads the per-queue links to the reviews still waiting for a decision. */
  teamWaitingIntro: string;
  /** `{queue}`, `{count}`: one link, to Your work on that queue. */
  teamWaitingLine: string;

  /** The reviews the officer has decided. */
  decisionsTitle: string;
  decisionsDescription: string;
  decisionsCaption: string;
  decisionsEmpty: string;
  decisionsEmptyHint: string;
  /** An empty page that is not the end of the list. */
  decisionsEmptyPage: string;
  decisionsNextPageHint: string;
  decisionsPartial: string;
  decisionsOutcome: string;
  /** Said where the pinned policy named no label for the outcome; the outcome is never guessed from a code. */
  decisionsOutcomeUnavailable: string;
  decisionsDecidedAt: string;
  /** `{count}`: the decisions on the page. */
  decisionsCount: string;
  decisionsRefresh: string;
  /** Said where the list's place has expired and the first page is read again. */
  decisionsPositionExpired: string;
  decisionsFirstPage: string;
  /** Names a decision's link for a screen reader: "{outcome}, {time}". */
  decisionsRowName: string;

  /** How review works here: the stages, deadlines and outcomes of each review policy. */
  howTitle: string;
  howDescription: string;
  howNone: string;
  /** Names a review policy by the id Casework serves; an id is never shown, so a policy with no entry is numbered. */
  howPolicyNames: Readonly<Record<string, string>>;
  /** "Review {number}" */
  howPolicyUnnamed: string;
  /** "Stage {number}: {name}" */
  howStage: string;
  /** "Stage {number}", for a stage with neither a wording nor a queue label. */
  howStageUnnamed: string;
  /**
   * Names a stage by its id, on How review works and beside a stage deadline on
   * the task; a stage with no entry is named by its queue label where the page
   * knows it (on the task, only the task's own stage).
   */
  howStageNames: Readonly<Record<string, string>>;
  /** "Queue: {queue}" */
  howQueue: string;
  /** "Reviewed by {profiles}" */
  howReviewedBy: string;
  /** Names the profile ids Casework serves; a profile with no entry is shown as howProfileUnnamed. */
  howProfiles: Readonly<Record<string, string>>;
  howProfileUnnamed: string;
  /** "{count} approvals needed" */
  howApprovals: string;
  howExcludesSubmitter: string;
  howExcludesEarlier: string;
  howDeadlines: string;
  howDeadlinesNone: string;
  /**
   * Names a deadline by its id, on How review works and on the task's
   * deadlines; on How review works, deadlines with no entry are covered by one
   * sentence, howDeadlineUnnamed, and on the task each is numbered (`clockName`).
   */
  howDeadlineNames: Readonly<Record<string, string>>;
  howDeadlineUnnamed: string;
  howOutcomes: string;
  /** What each way a review settles means for the request. */
  howSettlements: Readonly<Record<string, string>>;
  /** "{label}: {meaning}" */
  howOutcome: string;
  /** Leads the page's unreadable-policies state. */
  howUnavailable: string;
}

export const reviewPageEnglish: ReviewPageContent = {
  queueTitle: "Your work",
  queueDescription: "Requests waiting for a reviewer's decision.",
  queueCaption: "Your work: review tasks you can see",
  queueEmpty: "No review tasks are waiting.",
  queueReference: "Review task",
  queueRowReference: "Review {reference}",
  queueRowName: "Review task {number}",
  queueKind: "What is asked",
  queueQueue: "Queue",
  queueAll: "All queues",
  queueChip: "Queue: {queue}",
  queueWaiting: "Waiting",
  queueWaitingUnknown: "Not known",
  queueStatus: "Status",
  queueSupporting: "Supporting reference",
  queueCount: "{count, plural, one {# review task} other {# review tasks}}",
  queueCountOnPage:
    "{count, plural, one {# review task on this page} other {# review tasks on this page}}",
  takeNext: "Take next",
  nextNone: "No review task is waiting for you.",
  nextUnavailable:
    "Casework could not say which review task is next. Try again, or choose one from the list.",
  nextRetry: "Try again",
  back: "Back to review tasks",
  taskTitle: "Review {reference}",
  taskTitleKind: "Review {reference} ({kind})",
  taskTitleUnnamed: "Review task",
  taskUnavailable: "This review task is unavailable",
  viewRequest: "View the request and its documents",
  documentsHeading: "Documents and evidence",
  documentsHint: "The request page holds what it changes and its supporting documents.",
  statusOpen: "Waiting to be claimed",
  statusInReview: "In review",
  statusHeldByYou: "Held by you",
  statusHeldBy: "Held by {holder}",
  statusHeldElsewhere: "Held by another officer",
  statusDecided: "Decided",
  claim: "Claim this task",
  claimHint: "You can record a decision once you have claimed this task.",
  release: "Release this task",
  claimUnconfirmed:
    "The service could not confirm this claim. Retry sends the same claim again.",
  releaseUnconfirmed:
    "The service could not confirm this release. Retry sends the same release again.",
  retryClaim: "Retry the same claim",
  retryRelease: "Retry the same release",

  ownerLabel: "Show reviews",
  ownerAll: "All",
  ownerMine: "Mine",
  ownerUnassigned: "Unassigned",

  teamTitle: "Team reviews",
  teamDescription:
    "An accountability list of every review in the queues you supervise: its queue, and whether it is open, held or decided. It shows no names, no request details and no decisions. To move work or arrange cover, use Staffing.",
  teamStaffingLink: "Go to Staffing",
  teamCaption: "Reviews in the queues you supervise",
  teamEmpty: "No reviews to show in the queues you supervise.",
  teamQueue: "Queue",
  teamState: "State",
  teamStateOpen: "Open",
  teamStateHeld: "Held",
  teamStateDecided: "Decided",
  teamNoCover: "No one is available to take this review.",
  teamTooFewApprovers:
    "Too few reviewers are available to give the approvals this review needs.",
  teamPartial: "This page may be missing reviews. Try again shortly.",
  teamCount: "{count, plural, one {# review} other {# reviews}}",
  teamWaitingIntro:
    "Waiting for a decision. Each link opens that queue in Your work.",
  teamWaitingLine: "{queue}: {count, plural, one {# review} other {# reviews}}",

  decisionsTitle: "My decisions",
  decisionsDescription:
    "The reviews you have decided. Each stays here, with its history and notes, after the approved change is applied.",
  decisionsCaption: "Reviews you have decided",
  decisionsEmpty: "You have decided no reviews.",
  decisionsEmptyHint: "Reviews you decide are listed here.",
  decisionsEmptyPage: "No decisions on this page",
  decisionsNextPageHint: "More decisions follow on the next page.",
  decisionsPartial:
    "This page may be missing decisions. Try again shortly.",
  decisionsOutcome: "Decision",
  decisionsOutcomeUnavailable: "Decision recorded",
  decisionsDecidedAt: "Decided",
  decisionsCount:
    "{count, plural, one {# decision on this page} other {# decisions on this page}}",
  decisionsRefresh: "Refresh",
  decisionsPositionExpired:
    "Your place in this list has expired. Go back to the first page.",
  decisionsFirstPage: "Back to the first page",
  decisionsRowName: "{outcome}, {time}",

  howTitle: "How review works here",
  howDescription:
    "How a request is reviewed: the stages it passes through, who reviews at each, the deadlines that run, and how a review can end.",
  howNone: "No review is set up yet.",
  howPolicyNames: {},
  howPolicyUnnamed: "Review {number}",
  howStage: "Stage {number}: {name}",
  howStageUnnamed: "Stage {number}",
  howStageNames: {},
  howQueue: "Queue: {queue}",
  howReviewedBy: "Reviewed by {profiles}",
  howProfiles: {
    staff: "reviewers",
    supervisor: "supervisors",
    administrator: "administrators",
  },
  howProfileUnnamed: "the assigned team",
  howApprovals:
    "{count, plural, one {One approval is needed.} other {# approvals are needed.}}",
  howExcludesSubmitter: "The person who submitted the request never reviews it.",
  howExcludesEarlier:
    "Someone who reviewed an earlier stage does not review this one.",
  howDeadlines: "Deadlines",
  howDeadlinesNone: "No deadline runs on this review.",
  howDeadlineNames: {},
  howDeadlineUnnamed: "A deadline applies to this review.",
  howOutcomes: "How a review can end",
  howSettlements: {
    approved: "approves the request",
    rejected: "rejects the request",
    "changes-requested": "sends the request back for changes",
    answered: "answers the request",
  },
  howOutcome: "{label}: {meaning}",
  howUnavailable: "How review works is not available right now.",
};

export function useReviewPageContent(): ReviewPageContent {
  return useContentArea("review", reviewPageEnglish);
}
