import { createContext, useContext, type ReactNode } from "react";
import type { CaseworkStaffingCaseloadItemResult } from "@registrystack/app-runtime";

/**
 * The words Casework blocks show on their own: generic defaults an app
 * replaces with its own content through `CaseworkContentProvider`. Kept apart
 * from `BlockContent` (`@/blocks/lib/content`) because these words are only
 * meaningful to a Casework work item or review task; a record or request
 * block never reads them.
 */
export interface CaseworkContent {
  /**
   * Labels for a work item's or a review task's state, by its state code. An
   * apply item's state is looked up as `apply:<state>` first
   * (`workItemStateKeys`), for the states that mean something else there.
   */
  stateLabels: Readonly<Record<string, string>>;
  /** Shown for a state code no label is recorded for. */
  unknownStatus: string;
  /** The officer reading the page, wherever a holder or a decider is named as themself. */
  you: string;
  /** An item or a task nobody currently holds. */
  unclaimed: string;
  /** Stands in for a request's own reference when Casework could not join one. */
  unnamedRequest: string;
  due: string;
  noDueDate: string;
  /** The items table's column naming what the item asks of the officer. */
  taskColumn: string;
  /** The items table's column naming how long an item has been waiting. */
  waitingColumn: string;
  /** The items table's column naming an item's reference. */
  refColumn: string;
  /** The items table's column naming who holds an item. */
  holderColumn: string;
  /** The items table's column holding what an officer can open from a row. */
  actionsColumn: string;
  /** The link from an item to the review of its request. */
  openReview: string;
  /** The link's name for assistive technology: "Open review for {reference}". */
  openReviewFor: (reference: string) => string;
  /** The items table's column naming an item's stage. */
  stageFilterLabel: string;
  /** The marker shown beside the task when an item carries a return note. */
  returned: string;
  /** The title on the return-note marker, read out on hover and by assistive technology. */
  caseworkReturned: string;
  /** Selects every item on the current page, read by assistive technology. */
  selectAll: string;
  /** Selects one item, named by its reference: "Select {reference}". */
  selectItem: (reference: string) => string;
  relativeToday: string;
  relativeYesterday: string;
  relativeTomorrow: string;
  /** `{days}` ago, for a date more than a day in the past. */
  relativeDaysAgo: string;
  /** In `{days}` days, for a date more than a day in the future. */
  relativeInDays: string;
  /** A full date with its relative form beside it: `{when} ({relative})`. */
  caseworkHistoryWhen: string;
  /** `{days}` late, for a due date already passed. */
  whenLate: string;
  whenToday: string;
  whenTomorrow: string;
  /** In `{days}` days, the short form a dense cell uses. */
  whenInDays: string;
  whenJustNow: string;
  /** `{minutes}` minutes ago. */
  whenMinutesAgo: string;
  /** `{hours}` hours ago. */
  whenHoursAgo: string;
  whenYesterday: string;
  /** `{days}` days ago, the short form a dense cell uses. */
  whenDaysAgo: string;
  waitingJustNow: string;
  waitingOneMinute: string;
  /** `{minutes}` minutes. */
  waitingMinutes: string;
  waitingOneHour: string;
  /** `{hours}` hours. */
  waitingHours: string;
  waitingOneDay: string;
  /** `{days}` days. */
  waitingDays: string;
  /** The heading over what a reviewer sees of a task's subject. */
  contextHeading: string;
  /** Shown when a projected source changed after the request was submitted. */
  contextSourceChanged: string;
  /** Shown when the subject carries no field to show. */
  contextEmpty: string;
  /** Shown when the record behind a BREG subject could not be read. */
  recordUnavailable: string;
  /** The task's policy, named for the record: `Review policy {id}, version {version}`. */
  policyLine: string;
  /** Closes a dialog or a drawer, read by assistive technology. */
  close: string;
  /** The keyboard-shortcuts dialog's title, opened with `?`. */
  shortcutsTitle: string;
  /** The keyboard-shortcuts dialog's explanation of when a single key fires. */
  shortcutsDescription: string;
  /** The keyboard-shortcuts table's column naming the key. */
  shortcutKey: string;
  /** The keyboard-shortcuts table's column naming what the key does. */
  shortcutDoes: string;
  /** Opens the jump palette, read by assistive technology. */
  goTo: string;
  /** The jump palette's search field placeholder. */
  goToPlaceholder: string;
  /** Shown in the jump palette when nothing matches the typed text. */
  noMatchingPlace: string;
  /** Names the jump palette's list of places, for assistive technology. */
  goToList: string;
  /** Names the shell's main navigation landmark, for assistive technology. */
  navMain: string;
  /** Opens the mobile navigation drawer, read by assistive technology. */
  navMenu: string;
  /** Jumps past the header to the page's main content. */
  skip: string;
  /** The badge beside the service name marking it as not yet finished. */
  beta: string;
  /** Names the sidebar landmark, for assistive technology. */
  staffName: string;
  /** Shown under the places list in the sidebar and the mobile drawer. */
  footerNote: string;
  /** Shown across the page while the browser reports no connection. */
  offline: string;
  /** Signs the officer out, in the account menu. */
  signOut: string;
  /** Names the account menu when the session has no display name. */
  account: string;
  /** Shown when signing out failed and the officer is still signed in. */
  signOutFailed: string;
  /** The place label for an officer's own casework inbox. */
  navInbox: string;
  /** The place label for casework setup, shown only to an administrator. */
  navSetup: string;
  /** The place label for a supervisor's team view. */
  navTeam: string;
  /** The place label for help, in the staff work shell. */
  navHelp: string;
  /** The place label for the register's own records, for a session with a casework profile. */
  navRecords: string;
  /** The account menu's switch for single-key shortcuts. */
  shortcutsSetting: string;
  /** What the `mod+K` shortcut does, for the shortcuts list. */
  shortcutGoTo: string;
  /** What the `?` shortcut does, for the shortcuts list. */
  shortcutHelp: string;

  // ItemRail
  /** The rail's own landmark name, read by assistive technology. */
  railHeading: string;
  railHolder: string;
  /** The holder's name and when they took it: "{holder} since {time}". */
  heldSinceLine: string;
  railAssignedBy: string;
  railQueue: string;
  railDue: string;
  railClock: string;
  railRoutedBy: string;
  /** Names the disclosure that holds the routing rule and the policy digest. */
  railRoutingDetails: string;
  railSourceRef: string;
  railSupportRef: string;
  /** Copies the support reference to the clipboard, read by assistive technology. */
  copy: string;
  copied: string;
  copyFailed: string;
  /** A colleague covering the item for its usual owner: "You are covering this item for {owner}." */
  caseworkCoveringFor: string;
  /** The item's usual owner, when nobody is covering it: "This item is assigned to {owner}." */
  caseworkAssignedTo: string;
  /** Who assigned the item: "Assigned by {person}." */
  caseworkAssignedBy: string;
  caseworkNoCoverAvailable: string;
  /** A service clock at risk from a given time: "At risk from {when}." */
  caseworkAtRiskAt: string;
  /** Labels for a service clock's state, by its state code, "running" excepted. */
  caseworkClockStates: Readonly<Record<string, string>>;
  caseworkWhatHappensNext: string;
  /** A reminder due at a given time: "Reminder {when}." */
  caseworkReminderAt: string;
  /** A pending reassignment: "Reassign to {queue} {when}, because {because}". */
  caseworkReassignAt: string;
  /** Routing named only by its reason: "Routed here because {because}". */
  caseworkRoutedBecauseOnly: string;
  /** Routing named by its rule: "Routed by the rule {rule}." */
  caseworkRoutedBy: string;
  caseworkRoutedNoRule: string;
  /** The routing policy Casework recorded when it observed the item: "Routing policy {digest}". */
  caseworkRoutingPolicy: string;

  // CaseHistory
  /** What a history entry's operation reads as, keyed by its code. */
  caseworkHistoryOperations: Readonly<Record<string, string>>;
  /** What a history entry's action reads as, keyed by its code. */
  caseworkHistoryActions: Readonly<Record<string, string>>;
  /** One history entry: "{actor} {what}, {when}." */
  caseworkHistoryLine: string;
  /** Who an entry names when Casework gave the acting account no display name. */
  caseworkHistoryUnnamedActor: string;
  /** One history entry with its reason: "{actor} {what}, {when}. Reason: {reason}". */
  caseworkHistoryLineWithReason: string;
  /** Opens an entry's attempt reference, in a disclosure. */
  caseworkHistoryDetails: string;
  /** An entry's attempt reference: "Attempt reference: {reference}". */
  caseworkAttemptLine: string;
  /** What Casework said about a short or incomplete page of history, by its status code. */
  caseworkPageStatus: Readonly<Record<string, string>>;
  caseworkLoadMoreHistory: string;
  caseworkOneEntryShown: string;
  /** `{count}` entries shown. */
  caseworkEntriesShown: string;

  // PrivateNotes
  caseworkNotesHeading: string;
  privateDraftHint: string;
  privateDraftLabel: string;
  /** Notes saved at a given time: "Saved {time}". */
  caseworkNotesSaved: string;
  caseworkNotesFailed: string;
  deletePrivateDraft: string;
  deletePrivateDraftTitle: string;
  deletePrivateDraftBody: string;
  confirmDeletePrivateDraft: string;
  keepPrivateDraft: string;

  // WorkItemOutcome
  /** Shown while an unconfirmed write is still being checked. */
  checking: string;
  withoutAuthority: string;
  stopWaiting: string;
  retryForbidden: string;
  caseworkActionsUnavailable: string;
  caseworkReadItemAgain: string;
  caseworkRefusedTitle: string;
  notApplied: string;
  unknownTitle: string;
  unconfirmed: string;
  retrySame: string;
  /** Resends a staffing write whose outcome is unknown, as the same attempt. */
  exactRetry: string;
  checkItem: string;

  // WorkItemPendingNotice (an item write this session left unresolved, pointed
  // to from any other page). Optional: an app that builds its CaseworkContent
  // from its own content type may not carry these yet, so the notice falls
  // back to `caseworkContent`'s own wording.
  /** Says an action on an item was not confirmed, and that its page settles it. */
  caseworkUnknown?: string;
  /** Opens the oldest item whose action was not confirmed. */
  resumeCasework?: string;

  // ApplyPanel
  /** Cancels the panel's own confirm step. */
  cancel: string;

  // Unconfirmed (shared by the review panels; WorkItemOutcome reads its own checking, withoutAuthority, stopWaiting and retryForbidden above)
  /** Checks an unconfirmed attempt directly, when the command offers it. */
  check: string;

  // Refusal reasons shared by the review panels
  heldElsewhere: string;
  changed: string;
  gone: string;
  notAuthorized: string;
  /** A review stage that excludes its initiator: someone else must take the task. */
  initiatorExcluded: string;
  keyReused: string;

  // DecisionPanel
  decisionHeading: string;
  outcomeLegend: string;
  approve: string;
  reason: string;
  reasonHint: string;
  reasonRequired: string;
  chooseOutcome: string;
  resultHeading: string;
  /** A declared result field left empty: "Fill in {field}." */
  resultMissing: string;
  /** An outcome a plan blocked: "{outcome} cannot be recorded here..." */
  outcomeBlocked: string;
  record: string;
  decided: string;
  decisionUnconfirmed: string;
  retryDecision: string;
  decisionUnattributed: string;
  decisionNotApplied: string;
  requesterNote: string;
  requesterNoteHint: string;
  requesterNoteRequired: string;
  requesterNoteSent: string;
  requesterNoteNotSent: string;
  resendRequesterNote: string;
  requesterNoteUnconfirmed: string;
  retryRequesterNote: string;

  // DraftPanel
  draftHeading: string;
  draftLabel: string;
  draftHint: string;
  saveDraft: string;
  deleteDraft: string;
  draftSaved: string;
  draftDeleted: string;
  draftUnconfirmed: string;
  draftDeleteUnconfirmed: string;
  retryDraft: string;
  retryDraftDelete: string;
  /** A task read back after a claim, release or draft write that was not applied. */
  taskNotApplied: string;

  // NotesPanel
  notesHeading: string;
  noteLabel: string;
  audienceLegend: string;
  audienceReviewers: string;
  audienceRequester: string;
  addNote: string;
  noteAdded: string;
  noteEmpty: string;
  noteUnconfirmed: string;
  retryNote: string;
  /** Shown when a review record ended before a note could be confirmed. */
  noteExpired: string;
  dismiss: string;

  // HistoryPanel
  historyHeading: string;
  historyEmpty: string;
  historyMore: string;
  historyByYou: string;
  /** What a review history entry's kind reads as, keyed by Casework's code. */
  historyKinds: Readonly<Record<string, string>>;
  /** What an entry whose kind has no words in `historyKinds` reads as. */
  historyUnknownKind: string;
  whoDecided: string;
  /** "{person}, as {profile}: {decision}" */
  accountabilityLine: string;
  accountabilityUnavailable: string;
  accountabilityNotFound: string;

  // ClocksPanel
  clocksHeading: string;
  clocksEmpty: string;
  /**
   * "Clock {number}": a clock's name, by its place in the list. Casework
   * serves no name for a clock, only its configuration id.
   */
  clockName: string;
  /** "due {time}" beside a clock's state. */
  clockDue: string;
  /** Labels for a review clock's state, by its state code. */
  clockStates: Readonly<Record<string, string>>;

  // QueueFilterBar, QueueFilterChips, QueueResultCount, QueuePager (blocks/lib/queue-parts)
  /** Submits a queue's stage filter. */
  filterApply: string;
  /** Names the chip a removed filter's own button carries: "Remove filter: {label}". */
  removeFilter: string;
  /** Clears every applied filter on a queue at once. */
  clearAllFilters: string;
  /** "Showing {start} to {end}", no total: a cursor list never counts one. */
  showingRange: string;
  /** "{size} per page", filled once per page-size option. */
  perPage: string;

  // ErrorSummary
  /** The heading over a form's validation errors, focused when they first appear. */
  validationTitle: string;

  // Staffing (shared by every staffing form's own field validation)
  /** A staffing field left empty. */
  requiredError: string;
  actionLabels: Record<"assign" | "delegate", string>;
  assignmentHeading: string;
  assignmentDescription: string;
  assignmentAction: string;
  assignmentTarget: string;
  assignmentReason: string;
  assignmentReasonHint: string;
  assignmentConfirmed: string;
  assignmentUnknown: string;
  selectTarget: string;
  targetList: string;
  noMatchingColleague: string;
  targetsUnavailable: string;
  moreTargets: string;
  moreTargetsLoaded: (count: number) => string;
  createAbsence: string;
  editAbsence: string;
  person: string;
  cover: string;
  from: string;
  until: string;
  fromDate: string;
  fromTime: string;
  untilDate: string;
  untilTime: string;
  zoneHint: (zone: string) => string;
  heldWork: (person: string) => string;
  saveAbsence: string;
  saveAbsenceChanges: string;
  absenceConfirmed: string;
  absenceEnded: string;
  absenceUnknown: string;
  confirmEndAbsenceTitle: string;
  confirmEndAbsenceBody: (
    person: string,
    from: string,
    until: string,
  ) => string;
  confirmEndAbsence: string;
  invalidInterval: string;
  caseloadTitle: (person: string, queue: string) => string;
  caseloadDescription: string;
  caseloadNoMove: (person: string) => string;
  moveTo: string;
  movementReason: string;
  previewCaseload: string;
  previewChoose: string;
  previewEmpty: string;
  previewCount: (count: number) => string;
  previewMorePages: string;
  loadMorePreview: string;
  cannotMove: (count: number) => string;
  applySelected: (count: number) => string;
  /** Ticks one previewed item to move: "Move {reference}". */
  caseloadSelectItem: (reference: string) => string;
  selectSomething: string;
  caseloadConfirmed: string;
  caseloadUnknown: string;
  caseloadResults: string;
  caseloadResultsAnnouncement: (count: number) => string;
  resultLabels: Record<CaseworkStaffingCaseloadItemResult["result"], string>;
  reassignTitle: (count: number) => string;
  reassignDescription: string;
  reassignSubmit: (count: number) => string;
  reassignReason: string;
  notReassignable: (reference: string) => string;
  otherQueue: (reference: string, queue: string) => string;
  reassignUnknown: string;
  reassignResults: string;
  reassignResultLabels: Record<ReassignResult, string>;
  unknownStuck: string;
  stopShowing: string;
  pendingTitle: string;
  pendingBody: (count: number) => string;
  pendingRetry: string;
  pendingStill: string;
  pendingRefused: string;
  pendingRecorded: string;
  pendingWithoutAuthority: string;

  // Team (the supervisor's board of who holds what, and its absence cover)
  teamTitle: string;
  /** The page action that opens the absence drawer with nobody chosen. */
  teamRecordAbsence: string;
  /**
   * The counts Casework sent for the page it answered. `onPage` is set when
   * Casework says there is more, so a page's count never passes as the whole.
   */
  teamSummary: (
    counts: { items: number; unclaimed: number; held: number; overdue: number },
    onPage: boolean,
  ) => string;
  teamPeopleHeading: string;
  teamItemsHeading: string;
  teamPeopleDescription: string;
  teamPeopleCaption: string;
  teamItemsCaption: string;
  /** The column naming a table's queue, shared with any other queue-scoped table. */
  queueColumn: string;
  teamHeldColumn: string;
  teamOverdueColumn: string;
  teamActionsColumn: string;
  teamPersonActions: (person: string) => string;
  teamMoveWork: string;
  teamRecordAbsenceFor: string;
  teamEditAbsence: string;
  teamEndAbsence: string;
  /** The second line under a person who is away now. Dates are short: "14 Sept". */
  teamAwayUntil: (until: string, cover: string) => string;
  teamAwayFrom: (from: string, until: string, cover: string) => string;
  teamWasAway: (until: string) => string;
  /** The full instants, read on hover. */
  teamAwayTitle: (from: string, until: string) => string;
  teamAbsencesFailed: string;
  teamSelected: (count: number) => string;
  teamReassign: string;
  teamVisibleItems: (count: number) => string;
  teamVisibleItemsAnnouncement: (count: number) => string;
  teamNoHoldersInQueueTitle: string;
  teamNoHoldersInQueueBody: string;
  teamNoItemsInQueueTitle: string;
  teamNoItemsInQueueBody: string;
  /** Nobody holds visible work anywhere the officer supervises. */
  teamNoHolders: string;
  teamNoHoldersBody: string;
  /** A generic retry button, offered beside a secondary read that failed. */
  retry: string;

  // Task grants (the agent tasks a work item or a review task carries, and their approval)
  taskHeading: string;
  /**
   * The count a closed panel carries is how many tasks it would list, revoked
   * and expired ones included, so opening it never contradicts the label.
   * When Casework would not say, the label is the bare words.
   */
  taskHeadingCount: string;
  taskIntro: string;
  taskRefresh: string;
  taskReview: string;
  taskApprove: string;
  taskRetry: string;
  taskRevoke: string;
  taskCancel: string;
  taskAgent: string;
  taskIssuer: string;
  taskClient: string;
  taskResource: string;
  taskPurpose: string;
  taskScopes: string;
  taskEvidenceAudience: string;
  taskRequesterTags: string;
  taskBounds: string;
  taskSubjects: string;
  taskDuration: string;
  taskApproved: string;
  taskRun: string;
  taskRunUnavailable: string;
  taskRevoked: string;
  taskInvalidated: string;
  taskExpired: string;
  taskUntil: string;
  taskNoTemplates: string;
  taskNoGrants: string;
  taskUnavailable: string;
  taskStale: string;
  taskUnconfirmed: string;
  taskRevokeUnconfirmed: string;

  // Setup (the administrator's one-time bootstrap of a team, its staff, its leader and its queue)
  setupHeading: string;
  setupHeadingDescription: string;
  setupExistingTeams: string;
  setupTeamsCaption: string;
  setupNoTeams: string;
  setupTeamColumn: string;
  setupStaffColumn: string;
  setupLeadersColumn: string;
  setupQueuesColumn: string;
  setupCreateHeading: string;
  setupTeamName: string;
  setupTeamNameHint: string;
  setupTeamNameExample: string;
  setupStaff: string;
  setupStaffHint: string;
  setupStaffExample: string;
  setupLeader: string;
  setupLeaderHint: string;
  setupLeaderExample: string;
  setupQueue: string;
  setupQueueHint: string;
  setupQueueTypedHint: string;
  setupQueueExample: string;
  setupContinue: string;
  setupTeamNameRequired: string;
  setupStaffRequired: string;
  setupLeaderRequired: string;
  setupQueueRequired: string;
  setupTeamNameTaken: string;
  setupCheckTitle: string;
  setupCheckDescription: string;
  setupCheckStaff: string;
  setupCheckLeader: string;
  setupCheckQueue: string;
  /** The label on a check-step answer's edit button, naming the field it returns to. */
  setupChangeAnswer: (label: string) => string;
  setupCreate: string;
  setupBack: string;
  setupDoneTitle: string;
  setupDoneNext: string;
  setupDoneQueue: string;
  setupAnother: string;
}

/** What Casework answered for one item in a reassignment. */
export type ReassignResult =
  | "reassigned"
  | "expired"
  | "conflict"
  | "refused"
  | "unknown";

export const caseworkContent: Required<CaseworkContent> = {
  // A work item's states, then an apply item's where they differ, then its
  // due states, as Casework serves them. The shell's `stateLabels` carries
  // the same words for the item page header, all but `cancelled`: that is a
  // request state as well, whose word there would hide the model's, so the
  // header falls back to this one.
  stateLabels: {
    open: "Waiting for review",
    claimed: "In review",
    synchronizing: "Updating",
    "waiting-applicant": "Waiting for applicant",
    "waiting-application": "Waiting to apply",
    completed: "Completed",
    superseded: "Superseded",
    cancelled: "Cancelled",
    "apply:open": "Ready to apply",
    "apply:claimed": "Ready to apply",
    "apply:waiting-application": "Not ready to apply",
    "on-track": "On track",
    "at-risk": "Due soon",
    overdue: "Overdue",
  },
  unknownStatus: "Status not available",
  you: "you",
  unclaimed: "Unclaimed",
  unnamedRequest: "Case",
  due: "Due",
  noDueDate: "No due date",
  taskColumn: "What is asked",
  waitingColumn: "Waiting",
  refColumn: "Ref",
  holderColumn: "Holder",
  actionsColumn: "Actions",
  openReview: "Open review",
  openReviewFor: (reference: string) => `Open review for ${reference}`,
  stageFilterLabel: "Stage",
  returned: "Returned",
  caseworkReturned: "This item came back with a note.",
  selectAll: "Select every item on this page",
  selectItem: (reference: string) => `Select ${reference}`,
  relativeToday: "today",
  relativeYesterday: "yesterday",
  relativeTomorrow: "tomorrow",
  relativeDaysAgo: "{days} days ago",
  relativeInDays: "in {days} days",
  caseworkHistoryWhen: "{when} ({relative})",
  whenLate: "{days}d late",
  whenToday: "today",
  whenTomorrow: "tomorrow",
  whenInDays: "in {days}d",
  whenJustNow: "just now",
  whenMinutesAgo: "{minutes}m ago",
  whenHoursAgo: "{hours}h ago",
  whenYesterday: "yesterday",
  whenDaysAgo: "{days}d ago",
  waitingJustNow: "Just now",
  waitingOneMinute: "1 minute",
  waitingMinutes: "{minutes} minutes",
  waitingOneHour: "1 hour",
  waitingHours: "{hours} hours",
  waitingOneDay: "1 day",
  waitingDays: "{days} days",
  contextHeading: "What was submitted",
  contextSourceChanged:
    "The source record changed after this request was submitted.",
  contextEmpty: "The request carries nothing to show here.",
  recordUnavailable: "The record behind this task could not be read.",
  policyLine: "Review policy {id}, version {version}",
  close: "Close",
  shortcutsTitle: "Keyboard shortcuts",
  shortcutsDescription:
    "Single keys work while no text field has focus. Switch them off from the account menu.",
  shortcutKey: "Key",
  shortcutDoes: "Does",
  goTo: "Go to",
  goToPlaceholder: "Search or jump to…",
  noMatchingPlace: "No matching place",
  goToList: "Places",
  navMain: "Main",
  navMenu: "Menu",
  skip: "Skip to main content",
  beta: "BETA",
  staffName: "Staff service",
  footerNote: "Test service. Records and accounts are fictional.",
  offline:
    "You appear to be offline. Reads and submissions need a connection. Keep this page open to retain unsaved answers.",
  signOut: "Sign out",
  account: "Your account",
  signOutFailed: "Signing out failed. Try again.",
  navInbox: "Inbox",
  navSetup: "Setup",
  navTeam: "Team",
  navHelp: "Help",
  navRecords: "Records",
  shortcutsSetting: "Single-key shortcuts",
  shortcutGoTo: "Go to a place",
  shortcutHelp: "Show keyboard shortcuts",
  railHeading: "About this item",
  railHolder: "Holder",
  heldSinceLine: "{holder} since {time}",
  railAssignedBy: "Assigned by",
  railQueue: "Queue",
  railDue: "Due",
  railClock: "Clock",
  railRoutedBy: "Routed by",
  railRoutingDetails: "Rule and policy",
  railSourceRef: "Source ref",
  railSupportRef: "Support ref",
  copy: "Copy the support reference",
  copied: "Copied to the clipboard.",
  copyFailed: "The reference could not be copied.",
  caseworkCoveringFor: "You are covering this item for {owner}.",
  caseworkAssignedTo: "This item is assigned to {owner}.",
  caseworkAssignedBy: "Assigned by {person}.",
  caseworkNoCoverAvailable:
    "No eligible colleague was available to cover this item.",
  caseworkAtRiskAt: "At risk from {when}.",
  caseworkClockStates: {
    paused: "This service clock is paused.",
    completed: "This service clock is complete.",
    cancelled: "This service clock was cancelled.",
    "verification-pending":
      "Casework is waiting to verify the source facts for this service clock.",
    "source-facts-missing":
      "Casework cannot calculate this service clock until source facts are available.",
  },
  caseworkWhatHappensNext: "What happens next if nothing changes:",
  caseworkReminderAt: "Reminder {when}.",
  caseworkReassignAt: "Reassign to {queue} {when}, because {because}",
  caseworkRoutedBecauseOnly: "Routed here because {because}",
  caseworkRoutedBy: "Routed by the rule {rule}.",
  caseworkRoutedNoRule:
    "Casework did not record which rule sent this item here, only the policy it was applying.",
  caseworkRoutingPolicy: "Routing policy {digest}",
  caseworkHistoryOperations: {
    claim: "took this item",
    release: "put this item back in the queue",
    // Whatever an app's own operation code means, this bare default stays
    // register-neutral; the app's real wording is supplied through
    // CaseworkContentProvider.
    apply: "applied the pending change",
  },
  caseworkHistoryActions: {
    claimed: "took this item",
    assigned: "assigned this item",
    delegated: "delegated this item",
    caseload_moved: "moved this item to another caseload",
    clock_reminder: "was reminded about this item",
    clock_step_applied: "changed the service clock for this item",
    clock_recomputed: "recalculated the service clock for this item",
    released: "put this item back in the queue",
    attempt_reserved: "started an attempt",
    attempt_uncertain: "could not confirm an attempt",
    attempt_settled: "settled an unconfirmed attempt on an operator's decision",
    decision_refused: "was refused a decision on this item",
    action_completed: "completed an action",
    superseded: "superseded an earlier action",
    completed: "finished this item",
    other: "took an action these words do not yet describe",
  },
  caseworkHistoryLine: "{actor} {what}, {when}.",
  caseworkHistoryUnnamedActor: "A colleague",
  caseworkHistoryLineWithReason: "{actor} {what}, {when}. Reason: {reason}",
  caseworkHistoryDetails: "Details for support",
  caseworkAttemptLine: "Attempt reference: {reference}",
  caseworkPageStatus: {
    budget_exhausted:
      "Casework stopped before it reached the end, so there may be more than is shown.",
    source_unavailable:
      "Casework could not reach the service, so some of this may be missing.",
  },
  caseworkLoadMoreHistory: "Show more of what has happened",
  caseworkOneEntryShown: "Showing 1 entry",
  caseworkEntriesShown: "Showing {count} entries",
  caseworkNotesHeading: "Your notes (only you can read these)",
  privateDraftHint:
    "They are not sent to the applicant and do not appear on the team board or in what has happened.",
  privateDraftLabel: "Your private notes",
  caseworkNotesSaved: "Saved {time}",
  caseworkNotesFailed:
    "These notes could not be saved. What you typed is still here; it will be saved again when you next pause.",
  deletePrivateDraft: "Delete these notes",
  deletePrivateDraftTitle: "Delete these notes?",
  deletePrivateDraftBody:
    "The saved notes will be permanently removed from this item.",
  confirmDeletePrivateDraft: "Confirm delete these notes",
  keepPrivateDraft: "Keep these notes",
  checking: "Checking what the service recorded…",
  withoutAuthority:
    "A send from an earlier session could not be confirmed. Only that session could resend it.",
  stopWaiting: "Stop waiting for this send",
  retryForbidden:
    "The service refused to resend because you may no longer act on this queue. A supervisor of this queue can check whether it was recorded.",
  caseworkActionsUnavailable:
    "Your action is recorded. Casework could not say what can be done next, so read this item again before you act on it.",
  caseworkReadItemAgain: "Read this item again",
  caseworkRefusedTitle: "This action could not be completed",
  notApplied:
    "The item was read back and this action was not applied. You can try again.",
  unknownTitle: "We could not confirm the result",
  unconfirmed:
    "The service could not confirm this action. Retry sends the same action again.",
  retrySame: "Retry the same action",
  exactRetry: "Retry this exact submission",
  checkItem: "Check the item",
  caseworkUnknown:
    "Casework could not confirm an action you took on an item. Open the item to retry the same action or check what was recorded.",
  resumeCasework: "Return to the unresolved item",
  cancel: "Cancel",
  check: "Check",
  heldElsewhere:
    "Another officer holds this task. It has been read again; nothing was changed.",
  changed:
    "This task changed since you opened it. It has been read again; review it before you act.",
  gone: "This task is no longer awaiting review.",
  notAuthorized: "You may not do this on this task.",
  initiatorExcluded:
    "You submitted this request, so another reviewer must take it.",
  keyReused:
    "The service refused this send because a different one was already sent under the same attempt. Nothing from this send was recorded.",
  decisionHeading: "Decision",
  outcomeLegend: "Outcome",
  approve: "Approve",
  reason: "Reason",
  reasonHint: "Reviewers see this reason. The requester does not.",
  reasonRequired: "Give a reason for this outcome.",
  chooseOutcome: "Choose an outcome.",
  resultHeading: "Result",
  resultMissing: "Fill in {field}.",
  outcomeBlocked:
    "{outcome} cannot be recorded here: the result it needs has a field this page cannot capture.",
  record: "Record decision",
  decided: "Decision recorded.",
  decisionUnconfirmed:
    "The service could not confirm this decision. Retry sends the same decision again. Do not decide again until this is resolved.",
  retryDecision: "Retry the same decision",
  decisionUnattributed: "The task was decided; this send cannot be confirmed.",
  decisionNotApplied:
    "The task was read back and this decision was not recorded. You can decide again.",
  requesterNote: "Note to the requester",
  requesterNoteHint:
    "The person who submitted the request reads this note. It is sent once the decision is recorded.",
  requesterNoteRequired: "Write the note the requester will read.",
  requesterNoteSent: "Note sent to the requester.",
  requesterNoteNotSent:
    "The decision was recorded, but the note to the requester was not sent.",
  resendRequesterNote: "Send the note to the requester again",
  requesterNoteUnconfirmed:
    "The decision was recorded. The service could not confirm the note to the requester. Retry sends the same note again.",
  retryRequesterNote: "Retry the same note to the requester",
  draftHeading: "Your draft",
  draftLabel: "Private draft",
  draftHint: "Only you see this draft. It is kept with the task.",
  saveDraft: "Save draft",
  deleteDraft: "Delete draft",
  draftSaved: "Draft saved.",
  draftDeleted: "Draft deleted.",
  draftUnconfirmed:
    "The service could not confirm this draft. Retry sends it again; saving again replaces it.",
  draftDeleteUnconfirmed:
    "The service could not confirm the draft was deleted. Retry sends the same deletion again.",
  retryDraft: "Retry the same draft",
  retryDraftDelete: "Retry the same deletion",
  taskNotApplied:
    "The task was read back and this change was not applied. You can try again.",
  notesHeading: "Notes",
  noteLabel: "Note",
  audienceLegend: "Who the note is for",
  audienceReviewers: "Other reviewers",
  audienceRequester: "The requester",
  addNote: "Add note",
  noteAdded: "Note added.",
  noteEmpty: "Write a note.",
  noteUnconfirmed:
    "The service could not confirm this note. Retry sends the same note again.",
  retryNote: "Retry the same note",
  noteExpired:
    "This request's review record has ended, so the note cannot be added and the service cannot say whether it was. Dismiss it to continue.",
  dismiss: "Dismiss",
  historyHeading: "Review history",
  historyEmpty: "Nothing has been recorded on this request yet.",
  historyMore: "Show earlier entries",
  historyByYou: "by you",
  historyKinds: {
    review_created: "Review opened",
    request_created: "Request received",
    review_superseded: "Replaced by a later submission",
    review_cancelled: "Review cancelled",
    review_decided: "Decided",
    review_settled: "Review closed",
    stage_advanced: "Moved to the next review stage",
    task_claimed: "Claimed",
    task_released: "Released",
    task_assigned: "Assigned",
    task_delegated: "Delegated",
    task_draft_saved: "Draft decision saved",
    task_absence_reconciled: "Reassigned to cover an absence",
    clock_reminder: "Deadline reminder",
    clock_step_applied: "Deadline action taken",
    note: "Note added",
    task_grant_approved: "Agent task approved",
    task_grant_revoked: "Agent task revoked",
    task_grant_invalidated: "Agent task no longer valid",
  },
  historyUnknownKind: "Update recorded",
  whoDecided: "Show who decided",
  accountabilityLine: "{person}, as {profile}: {decision}",
  accountabilityUnavailable:
    "Who decided can only be read by a supervisor of this queue.",
  accountabilityNotFound: "No record of who decided this could be found.",
  clocksHeading: "Clocks",
  clocksEmpty: "No clocks run on this request.",
  clockName: "Clock {number}",
  clockDue: "due {time}",
  clockStates: {
    running: "Running",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled",
    source_facts_missing: "Waiting for source facts",
  },
  filterApply: "Apply",
  removeFilter: "Remove filter: {label}",
  clearAllFilters: "Clear all filters",
  showingRange: "Showing {start} to {end}",
  perPage: "{size} per page",
  validationTitle: "Check the information you entered",
  requiredError: "Enter a value for this field.",
  actionLabels: {
    assign: "Assign item",
    delegate: "Delegate item",
  },
  assignmentHeading: "Assign this item",
  assignmentDescription:
    "Choose an eligible colleague. The displayed name does not grant authority; Casework checks the selected reference again.",
  assignmentAction: "Assignment action",
  assignmentTarget: "Assign to",
  assignmentReason: "Reason",
  assignmentReasonHint: "This reason is recorded with the assignment.",
  assignmentConfirmed: "The assignment was recorded.",
  assignmentUnknown:
    "Casework could not confirm the assignment. Retry the same attempt before assigning again.",
  selectTarget: "Search for a colleague",
  targetList: "Matching colleagues",
  noMatchingColleague: "No loaded colleague matches what you typed.",
  targetsUnavailable: "No eligible colleagues are available on this page.",
  moreTargets: "Show more colleagues",
  moreTargetsLoaded: (count) => `${count} colleagues are now in the list.`,
  createAbsence: "Record an absence",
  editAbsence: "Edit absence",
  person: "Person away",
  cover: "Covered by",
  from: "From",
  until: "Until",
  fromDate: "From date",
  fromTime: "From time",
  untilDate: "Until date",
  untilTime: "Until time",
  zoneHint: (zone) => `Times are in your time zone (${zone}).`,
  heldWork: (person) =>
    `New assignments to ${person} go to the cover. Work they already hold stays with them; move it after saving.`,
  saveAbsence: "Record",
  saveAbsenceChanges: "Save changes",
  absenceConfirmed: "The absence cover was recorded.",
  absenceEnded: "The absence cover was ended.",
  absenceUnknown:
    "Casework could not confirm the absence change. Retry the same attempt before making another change.",
  confirmEndAbsenceTitle: "End this absence cover?",
  confirmEndAbsenceBody: (person, from, until) =>
    `${person} is covered from ${from} until ${until}. Once the cover ends, new assignments go to them again.`,
  confirmEndAbsence: "End absence cover",
  invalidInterval: "Cover must end after it starts.",
  caseloadTitle: (person, queue) => `Move ${person}'s work in ${queue}`,
  caseloadDescription:
    "Show what can move, tick the items to move, then move that exact selection.",
  caseloadNoMove: (person) =>
    `Casework offers no colleague to move ${person}'s work to in this queue.`,
  moveTo: "To",
  movementReason: "Reason",
  previewCaseload: "Show items that can move",
  previewChoose: "Items that can move",
  previewEmpty:
    "Nothing this colleague holds in this queue can be moved on this page.",
  previewCount: (count) =>
    count === 1 ? "1 item can move." : `${count} items can move.`,
  previewMorePages: "Load another page if you need to see more items.",
  loadMorePreview: "Load more eligible items",
  cannotMove: (count) =>
    count === 1
      ? "1 more item cannot move."
      : `${count} more items cannot move.`,
  applySelected: (count) =>
    count ? `Move ${count === 1 ? "1 item" : `${count} items`}` : "Move items",
  caseloadSelectItem: (reference) => `Move ${reference}`,
  selectSomething: "Choose at least one item to move.",
  caseloadConfirmed: "Casework processed the selected items.",
  caseloadUnknown:
    "Casework could not confirm the movement. Retry the same attempt before creating another movement.",
  caseloadResults: "Movement results",
  caseloadResultsAnnouncement: (count) =>
    `Casework processed ${count} items. Read the movement results.`,
  resultLabels: {
    moved: "Moved",
    notVisible: "No longer visible",
    notEligible: "No longer eligible",
    attemptInProgress: "Another attempt is in progress",
    conflict: "Changed before it could be moved",
  },
  reassignTitle: (count) =>
    `Reassign ${count === 1 ? "1 item" : `${count} items`}`,
  reassignDescription:
    "Each item is sent to Casework on its own, and Casework checks the colleague again for each one.",
  reassignSubmit: (count) =>
    `Reassign ${count === 1 ? "1 item" : `${count} items`}`,
  reassignReason: "Reason",
  notReassignable: (reference) =>
    `${reference}: Casework offers no reassignment for this item.`,
  otherQueue: (reference, queue) =>
    `${reference}: This item is in ${queue}. Reassign it with the other items from that queue.`,
  reassignUnknown:
    "Casework could not confirm every reassignment. Retry the unconfirmed ones as the same attempts before trying anything else.",
  reassignResults: "Reassignment results",
  reassignResultLabels: {
    reassigned: "Reassigned",
    expired: "No longer available to reassign",
    conflict: "Changed before it could be reassigned",
    refused: "Casework refused this reassignment",
    unknown: "Not confirmed",
  },
  unknownStuck:
    "This change can no longer be retried. Check what Casework now shows before making it again.",
  stopShowing: "Stop showing this change",
  pendingTitle: "A staffing change is not confirmed",
  pendingBody: (count) =>
    `Casework may have recorded ${count === 1 ? "1 staffing change" : `${count} staffing changes`}. Retry each as the same attempt before changing staffing again.`,
  pendingRetry: "Retry unconfirmed staffing changes",
  pendingStill:
    "Casework still could not confirm every change. Try again shortly.",
  pendingRefused:
    "Casework refused at least one unconfirmed staffing change, so it was not made. Check what Casework now shows.",
  pendingRecorded: "Casework recorded the unconfirmed staffing changes.",
  pendingWithoutAuthority:
    "A staffing change from an earlier session was not confirmed, and it can no longer be retried. Check what Casework now shows before making it again.",

  teamTitle: "Team",
  teamRecordAbsence: "Record absence",
  teamSummary: (counts, onPage) =>
    [
      `${counts.items === 1 ? "1 item" : `${counts.items} items`}${onPage ? " on this page" : ""}`,
      `${counts.unclaimed} unclaimed`,
      `${counts.held} held`,
      `${counts.overdue} overdue`,
    ].join(" · "),
  teamPeopleHeading: "People",
  teamItemsHeading: "Items",
  teamPeopleDescription:
    "Visible holdings are grouped by person. Recorded absence cover appears below their name.",
  teamPeopleCaption: "People in your teams",
  teamItemsCaption: "Items in your teams",
  queueColumn: "Queue",
  teamHeldColumn: "Held",
  teamOverdueColumn: "Overdue",
  teamActionsColumn: "Actions",
  teamPersonActions: (person) => `Actions for ${person}`,
  teamMoveWork: "Move all their work…",
  teamRecordAbsenceFor: "Record absence…",
  teamEditAbsence: "Edit absence…",
  teamEndAbsence: "End absence…",
  teamAwayUntil: (until, cover) => `away until ${until}, cover ${cover}`,
  teamAwayFrom: (from, until, cover) =>
    `away from ${from} until ${until}, cover ${cover}`,
  teamWasAway: (until) => `was away until ${until}`,
  teamAwayTitle: (from, until) => `Away from ${from} until ${until}`,
  teamAbsencesFailed: "Absences could not be loaded.",
  teamSelected: (count) => `${count} selected`,
  teamReassign: "Reassign…",
  teamVisibleItems: (count) =>
    count === 1
      ? "1 visible item on this page"
      : `${count} visible items on this page`,
  teamVisibleItemsAnnouncement: (count) =>
    count === 1
      ? "Showing 1 visible item on this page"
      : `Showing ${count} visible items on this page`,
  teamNoHoldersInQueueTitle: "Nobody holds visible work in {queue}",
  teamNoHoldersInQueueBody:
    "No visible holdings are assigned to a person in {queue}. Clear the filter to check every queue.",
  teamNoItemsInQueueTitle: "No visible items in {queue}",
  teamNoItemsInQueueBody:
    "This queue has no items on the page Casework returned. Clear the filter to see every visible item on this page.",
  teamNoHolders: "Nobody is holding work in your teams",
  teamNoHoldersBody:
    "A colleague appears here once they take an item from a queue your teams work.",
  retry: "Retry",

  taskHeading: "Agent tasks",
  taskHeadingCount: "Agent tasks ({count})",
  taskIntro:
    "Review the exact agent, purpose, destination and subject before approving. Each task is limited to the period shown.",
  taskRefresh: "Refresh agent tasks",
  taskReview: "Review {label}",
  taskApprove: "Approve this task",
  taskRetry: "Retry this approval",
  taskRevoke: "Revoke task",
  taskCancel: "Cancel review",
  taskAgent: "Agent",
  taskIssuer: "Agent issuer",
  taskClient: "Registered client",
  taskResource: "Destination",
  taskPurpose: "Purpose",
  taskScopes: "Access scopes",
  taskEvidenceAudience: "Evidence audience",
  taskRequesterTags: "Requester tags",
  taskBounds: "Allowed work",
  taskSubjects: "Subjects from the current source record",
  taskDuration: "Valid for up to {minutes} minutes",
  taskApproved: "Task approved.",
  taskRun: "Run assistant precheck",
  taskRunUnavailable:
    "Assistant precheck is unavailable. Refresh the task or try again.",
  taskRevoked: "Task revoked.",
  taskInvalidated: "Revoked or invalidated",
  taskExpired: "Expired",
  taskUntil: "Valid until {time}",
  taskNoTemplates: "No task templates are available for you on this item.",
  taskNoGrants: "No task grants have been recorded for this item.",
  taskUnavailable: "Agent tasks could not be loaded. Refresh to check again.",
  taskStale:
    "This preview is no longer current or available to you. Refresh and review the task again.",
  taskUnconfirmed:
    "The service could not confirm this approval. Retry uses the same approval reference. Check recorded tasks before starting another approval.",
  taskRevokeUnconfirmed:
    "The service could not confirm revocation. Refresh to check the task, or retry revocation.",

  setupHeading: "Set up teams",
  setupHeadingDescription:
    "Create a team, name the people in it and choose the queue it works.",
  setupExistingTeams: "Teams already set up",
  setupTeamsCaption: "Teams already set up, one row for each team",
  setupNoTeams: "No teams are set up yet.",
  setupTeamColumn: "Team",
  setupStaffColumn: "Staff",
  setupLeadersColumn: "Supervisors",
  setupQueuesColumn: "Queues",
  setupCreateHeading: "Create a team",
  setupTeamName: "Team name",
  setupTeamNameHint:
    "The name Casework records for this team. This page creates teams; it cannot rename one later.",
  setupTeamNameExample: "For example: front-desk-team",
  setupStaff: "Staff (one sign-in ID per line)",
  setupStaffHint:
    "A sign-in ID is the subject the identity provider holds for the person, not their display name and not their email address unless the provider uses email as the subject. Read it from the person’s record in the identity provider.",
  setupStaffExample: "For example: officer-sub-1",
  setupLeader: "Supervisor (sign-in ID)",
  setupLeaderHint:
    "They see the team board: who holds what, and what is waiting or overdue.",
  setupLeaderExample: "For example: supervisor-sub",
  setupQueue: "Queue this team works",
  setupQueueHint: "The team sees the items waiting in this queue.",
  setupQueueTypedHint:
    "The queues could not be read, so type the queue identifier Casework uses.",
  setupQueueExample: "For example: new-requests",
  setupContinue: "Continue",
  setupTeamNameRequired: "Enter a team name.",
  setupStaffRequired: "Enter at least one sign-in ID for staff.",
  setupLeaderRequired: "Enter the supervisor’s sign-in ID.",
  setupQueueRequired: "Say which queue this team works.",
  setupTeamNameTaken:
    "A team called {name} is already set up. Choose a different name.",
  setupCheckTitle: "Check the team before you create it",
  setupCheckDescription:
    "Nothing is created until you confirm. Go back if a sign-in ID is not exactly as the identity provider holds it.",
  setupCheckStaff: "Staff",
  setupCheckLeader: "Supervisor",
  setupCheckQueue: "Queue",
  setupChangeAnswer: (label) => `Change ${label.toLowerCase()}`,
  setupCreate: "Create team",
  setupBack: "Back",
  setupDoneTitle: "Team {name} is ready",
  setupDoneNext:
    "Its staff see this queue’s items in Your work the next time they sign in. They take items from the queue themselves; setting up the team assigns nothing to anyone.",
  setupDoneQueue: "The team works the {queue} queue.",
  setupAnother: "Set up another team",
};

const CaseworkContentContext = createContext<CaseworkContent>(caseworkContent);

export function CaseworkContentProvider({
  content,
  children,
}: {
  content: CaseworkContent;
  children: ReactNode;
}) {
  return (
    <CaseworkContentContext.Provider value={content}>
      {children}
    </CaseworkContentContext.Provider>
  );
}

export function useCaseworkContent(): CaseworkContent {
  return useContext(CaseworkContentContext);
}
