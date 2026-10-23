import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MessagesContext, withMessages } from "@/blocks/lib/content";

/**
 * The words Casework blocks show on their own: generic defaults an app
 * replaces with its own content through `CaseworkContentProvider`. Kept apart
 * from `BlockContent` (`@/blocks/lib/content`) because these words are only
 * meaningful to a Casework review task; a record or request
 * block never reads them.
 */
export interface CaseworkContent {
  /** Labels for a review task's state or a due state, by its state code. */
  stateLabels: Readonly<Record<string, string>>;
  /** Shown for a state code no label is recorded for. */
  unknownStatus: string;
  /** "{name} (you)": a holder's name when the officer reading the page holds the task. */
  heldByYou: string;
  /** A task nobody currently holds. */
  unclaimed: string;
  /** Stands in for a request's own reference when Casework could not join one. */
  unnamedRequest: string;
  due: string;
  noDueDate: string;
  /** A table's column holding what an officer can do from a row. */
  actionsColumn: string;
  relativeToday: string;
  relativeYesterday: string;
  relativeTomorrow: string;
  /** `{days}` ago, for a date more than a day in the past. */
  relativeDaysAgo: string;
  /** In `{days}` days, for a date more than a day in the future. */
  relativeInDays: string;
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
  /** `{minutes}` minutes. */
  waitingMinutes: string;
  /** `{hours}` hours. */
  waitingHours: string;
  /** `{days}` days. */
  waitingDays: string;
  /** The heading over what a reviewer sees of a task's subject. */
  contextHeading: string;
  /** Shown when a projected source changed after the request was submitted. */
  contextSourceChanged: string;
  /** Shown when the subject carries no field to show. */
  contextEmpty: string;
  /** Shown when the record behind a BReg subject could not be read. */
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
  /** The modifier key's name on platforms other than the Mac, whose `⌘` is a symbol. */
  shortcutControl: string;
  /** The space bar's name in the keyboard-shortcuts table. */
  shortcutSpace: string;
  /** "{modifier} {key}": a shortcut pressed with the modifier key. */
  shortcutChord: string;
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
  /** The place label for the review task queue, where a casework session opens. */
  navReviews: string;
  /** The place label for casework setup, shown only to an administrator. */
  navSetup: string;
  /** The place label for a supervisor's staffing page. */
  navStaffing: string;
  /** The place label for a supervisor's accountability list of every review in their teams. */
  navTeamReviews: string;
  /** The place label for the reviews the officer has decided. */
  navMyDecisions: string;
  /** The place label for the page saying how review works here. */
  navHowReviewWorks: string;
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

  // A support reference's copy control
  /** Copies the support reference to the clipboard, read by assistive technology. */
  copy: string;
  copied: string;

  // A short or incomplete page Casework served
  /** What Casework said about a short or incomplete page (a review list or the staffing directory), by its status code. */
  caseworkPageStatus: Readonly<Record<string, string>>;

  // UncertainCommand (a write whose outcome Casework has not confirmed)
  /** Shown while an unconfirmed write is still being checked. */
  checking: string;
  withoutAuthority: string;
  stopWaiting: string;
  retryForbidden: string;
  caseworkRefusedTitle: string;
  unknownTitle: string;
  /** Resends a staffing write whose outcome is unknown, as the same attempt. */
  exactRetry: string;

  // Confirm steps
  /** Cancels the panel's own confirm step. */
  cancel: string;

  // Unconfirmed (shared by the review panels; UncertainCommand reads its own checking, withoutAuthority, stopWaiting and retryForbidden above)
  /** Checks an unconfirmed attempt directly, when the command offers it. */
  check: string;

  // Refusal reasons shared by the review panels
  heldElsewhere: string;
  changed: string;
  gone: string;
  notAuthorized: string;
  /** A review stage that excludes its initiator: someone else must take the task. */
  initiatorExcluded: string;
  /** A reviewer who already reviewed the stage: someone else must give the approval. */
  distinctApproverRequired: string;
  keyReused: string;

  // DecisionPanel
  decisionHeading: string;
  outcomeLegend: string;
  approve: string;
  reason: string;
  reasonHint: string;
  reasonRequired: string;
  /** The reason the requester will see, when the chosen outcome asks for or allows one. */
  publicReason: string;
  publicReasonHint: string;
  publicReasonRequired: string;
  chooseOutcome: string;
  resultHeading: string;
  /** A declared result field left empty: "Fill in {field}." */
  resultMissing: string;
  /** An outcome a plan blocked: "{outcome} cannot be recorded here..." */
  outcomeBlocked: string;
  record: string;
  decided: string;
  /** "It now waits for the next review stage: {stage}.": a confirmed decision after which the review moved on. */
  nextStage: string;
  /** The same, when the page cannot name the next stage. */
  nextStageUnnamed: string;
  /** "Approving sends it on to the next review stage: {stage}.": beside the outcomes, where approving leads from a stage one approval settles. */
  approvesToStage: string;
  /** The same, when the page cannot name the next stage. */
  approvesToStageUnnamed: string;
  /** The same at the policy's last stage, where approving settles the review. */
  approvesSettles: string;
  /** A confirmed decision that settled the review as approved. */
  settledApproved: string;
  /** A confirmed decision that settled the review as rejected. */
  settledRejected: string;
  /** A confirmed decision that sent the request back to be revised. */
  sentBack: string;
  decisionUnconfirmed: string;
  retryDecision: string;
  decisionUnattributed: string;
  decisionNotApplied: string;
  /**
   * ReviewDecisionPendingNotice: a decision this session sent that Casework
   * has not confirmed, said on any page but its own task's.
   */
  decisionPendingBody: string;
  /** Leads from that notice to the task, where the same decision can be retried. */
  resumeDecision: string;
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
  /** What a failed read of who decided says when the host gave no words of its own. */
  accountabilityNotRead: string;

  // Unavailable actions and refused handoffs, in the products' own reasons
  /**
   * Why a proposal link is unavailable, by the reason BReg's client reports.
   * A reason with no words here is not named: `unavailableNoReason` stands in.
   */
  unavailableReasons: Readonly<Record<string, string>>;
  /** What to do next, by the recovery the client reports. */
  unavailableRecoveries: Readonly<Record<string, string>>;
  unavailableNoReason: string;
  /** "{reason} {recovery}" */
  unavailableLine: string;
  /** What an administrator reads when a review handoff was refused. */
  handoffRefusedAdministrator: string;
  /** What anyone else reads when a review handoff was refused. */
  handoffRefusedOther: string;

  // ClocksPanel
  clocksHeading: string;
  clocksEmpty: string;
  /**
   * "Deadline {number}": a deadline's name, by its place in the list, where the
   * review page names none for its clock id (`howDeadlineNames`). Casework
   * serves no name for a clock, only its configuration id.
   */
  clockName: string;
  /**
   * "{name} ({stage})": a stage clock's name with the stage it runs for, so the
   * same deadline in two stages reads apart. `{name}` is the deadline's name or
   * `clockName` filled; `{stage}` the stage's name on the review page.
   */
  clockStageName: string;
  /** "{name}: {state}": a clock with no due time, `{name}` being `clockName` filled. */
  clockLine: string;
  /** "{name}: {state}, due {time}": a clock with a due time, `{name}` being `clockName` filled. */
  clockLineDue: string;
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
  /** `{count}` more colleagues were loaded into the list. */
  moreTargetsLoaded: string;
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
  /** `{zone}`: the device's time zone. */
  zoneHint: string;
  /** `{person}`: the person away. */
  heldWork: string;
  saveAbsence: string;
  saveAbsenceChanges: string;
  absenceConfirmed: string;
  absenceEnded: string;
  absenceUnknown: string;
  confirmEndAbsenceTitle: string;
  /** `{person}` is covered from `{from}` until `{until}`. */
  confirmEndAbsenceBody: string;
  confirmEndAbsence: string;
  invalidInterval: string;
  /** The offer, once a cover is saved, to move what the person away (`{person}`) holds in one queue (`{queue}`). */
  caseloadTitle: string;
  caseloadHeading: string;
  caseloadDescription: string;
  caseloadQueue: string;
  moveFrom: string;
  moveTo: string;
  movementReason: string;
  /** The person an absence offer named (`{person}`) is not among the colleagues Casework lists for the queue. */
  caseloadNoMove: string;
  previewCaseload: string;
  /** What a preview fenced: how many review tasks (`{count}`), in which queue (`{queue}`), from whom (`{from}`), to whom (`{to}`). */
  caseloadPreviewSummary: string;
  /** `{when}`: the moment the preview expires. */
  caseloadPreviewExpires: string;
  /** `{from}` holds nothing to move in `{queue}`. */
  caseloadPreviewNothing: string;
  /** Casework no longer holds the preview a confirm named. */
  caseloadPreviewGone: string;
  /** A colleague a preview named whom the loaded list no longer carries. */
  caseloadUnlisted: string;
  /** `{count}`: the review tasks the preview fenced. */
  confirmCaseload: string;
  /** Casework's own `{count}`, shown only once it confirmed the move. */
  caseloadMoved: string;
  caseloadUnknown: string;
  unknownStuck: string;
  stopShowing: string;
  pendingTitle: string;
  /** `{count}`: the staffing changes Casework may have recorded. */
  pendingBody: string;
  pendingRetry: string;
  pendingStill: string;
  pendingRefused: string;
  pendingRecorded: string;
  pendingWithoutAuthority: string;

  // Staffing page (the supervisor's caseload moves and absence cover)
  staffingTitle: string;
  staffingDescription: string;
  /** No review task the officer supervises names a queue to move work in. */
  caseloadNoQueues: string;
  /** Casework stopped the supervised list early, so a queue may be missing. */
  caseloadQueuesPartial: string;
  absencesHeading: string;
  absencesCaption: string;
  absencesEmpty: string;
  /** The page action that opens the absence drawer with nobody chosen. */
  recordAbsence: string;
  /** `{person}`: the person away. */
  editAbsenceOf: string;
  /** `{person}`: the person away. */
  endAbsenceOf: string;
  /** A generic retry button, offered beside a secondary read that failed. */
  retry: string;

  // Task grants (the agent tasks a review task carries, and their approval)
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
  /** "{service} / {location}: {actions}": one scheduling permission a task is bounded by. */
  taskGrantPermission: string;
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
  setupTeamNameInvalid: string;
  setupStaffRequired: string;
  setupStaffInvalid: string;
  setupStaffDuplicate: string;
  setupStaffTooMany: string;
  setupLeaderRequired: string;
  setupLeaderInvalid: string;
  setupQueueRequired: string;
  setupQueueInvalid: string;
  setupTeamNameTaken: string;
  setupCheckTitle: string;
  setupCheckDescription: string;
  setupCheckStaff: string;
  setupCheckLeader: string;
  setupCheckQueue: string;
  /** The check step's edit button for the team identifier answer. */
  setupChangeTeamName: string;
  /** The check step's edit button for the staff answer. */
  setupChangeStaff: string;
  /** The check step's edit button for the supervisor answer. */
  setupChangeLeader: string;
  /** The check step's edit button for the queue answer. */
  setupChangeQueue: string;
  setupCreate: string;
  setupCreating: string;
  setupBack: string;
  setupDoneTitle: string;
  setupDoneNext: string;
  setupDoneQueue: string;
  setupAnother: string;
}

export const caseworkContent: Required<CaseworkContent> = {
  // A review task's open state, then the due states, as Casework serves
  // them. The shell's `stateLabels` carries the same words.
  stateLabels: {
    open: "Waiting for review",
    "on-track": "On track",
    "at-risk": "Due soon",
    overdue: "Overdue",
  },
  unknownStatus: "Status not available",
  heldByYou: "{name} (you)",
  unclaimed: "Unclaimed",
  unnamedRequest: "Case",
  due: "Due",
  noDueDate: "No due date",
  actionsColumn: "Actions",
  relativeToday: "today",
  relativeYesterday: "yesterday",
  relativeTomorrow: "tomorrow",
  relativeDaysAgo: "{days} days ago",
  relativeInDays: "in {days} days",
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
  waitingMinutes: "{minutes, plural, one {# minute} other {# minutes}}",
  waitingHours: "{hours, plural, one {# hour} other {# hours}}",
  waitingDays: "{days, plural, one {# day} other {# days}}",
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
  shortcutControl: "Ctrl",
  shortcutSpace: "Space",
  shortcutChord: "{modifier} {key}",
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
  navReviews: "Your work",
  navSetup: "Set up teams",
  navStaffing: "Staffing",
  navTeamReviews: "Team reviews",
  navMyDecisions: "My decisions",
  navHowReviewWorks: "How review works",
  navHelp: "Help",
  navRecords: "Records",
  shortcutsSetting: "Single-key shortcuts",
  shortcutGoTo: "Go to a place",
  shortcutHelp: "Show keyboard shortcuts",
  copy: "Copy the support reference",
  copied: "Copied to the clipboard.",
  caseworkPageStatus: {
    budget_exhausted:
      "Casework stopped before it reached the end, so there may be more than is shown.",
    source_unavailable:
      "Casework could not reach the service, so some of this may be missing.",
  },
  checking: "Checking what the service recorded…",
  withoutAuthority:
    "A send from an earlier session could not be confirmed. Only that session could resend it.",
  stopWaiting: "Stop waiting for this send",
  retryForbidden:
    "The service refused to resend because you may no longer act on this queue. A supervisor of this queue can check whether it was recorded.",
  caseworkRefusedTitle: "This action could not be completed",
  unknownTitle: "We could not confirm the result",
  exactRetry: "Retry this exact submission",
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
  distinctApproverRequired:
    "You have already reviewed this stage, so someone else must give this approval.",
  keyReused:
    "The service refused this send because a different one was already sent under the same attempt. Nothing from this send was recorded.",
  decisionHeading: "Decision",
  outcomeLegend: "Outcome",
  approve: "Approve",
  reason: "Reason",
  reasonHint: "Reviewers see this reason. The requester does not.",
  reasonRequired: "Give a reason for this outcome.",
  publicReason: "Reason the requester will see",
  publicReasonHint:
    "Write it for the person who submitted the request, on one line.",
  publicReasonRequired: "Give the reason the requester will see.",
  chooseOutcome: "Choose an outcome.",
  resultHeading: "Result",
  resultMissing: "Fill in {field}.",
  outcomeBlocked:
    "{outcome} cannot be recorded here: the result it needs has a field this page cannot capture.",
  record: "Record decision",
  decided: "Decision recorded.",
  nextStage: "It now waits for the next review stage: {stage}.",
  nextStageUnnamed: "It now waits for the next review stage.",
  approvesToStage: "Approving sends it on to the next review stage: {stage}.",
  approvesToStageUnnamed: "Approving sends it on to the next review stage.",
  approvesSettles:
    "Approving completes the review and approves the request. The record changes only once the approved request is applied.",
  settledApproved:
    "The review is complete and the request is approved. The record changes only once the approved request is applied.",
  settledRejected: "The review is complete. The request was rejected.",
  sentBack: "The request was sent back for a revision.",
  decisionUnconfirmed:
    "The service could not confirm this decision. Retry sends the same decision again. Do not decide again until this is resolved.",
  retryDecision: "Retry the same decision",
  decisionUnattributed: "The task was decided; this send cannot be confirmed.",
  decisionNotApplied:
    "The task was read back and this decision was not recorded. You can decide again.",
  decisionPendingBody:
    "Casework could not confirm a decision you recorded on a review task. Retry the same decision from the task before deciding on it again.",
  resumeDecision: "Return to the unconfirmed decision",
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
  draftHeading: "Your draft (optional)",
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
  notesHeading: "Notes (optional)",
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
  unavailableReasons: {
    "pending-review": "The request is waiting for its review.",
    "review-rejected": "The review rejected the request.",
    "review-changes-requested": "The review asked for changes.",
    "review-ended": "The review has ended.",
    "stale-revision": "The request changed after you opened it.",
    "contract-changed": "The register's rules changed after the request was made.",
    "dependency-outage": "A service the request depends on is not answering.",
    "invalid-input": "Something in the request is not accepted.",
    "already-applied": "The change has already been applied.",
    "guard-not-satisfied": "This action is not available for this record now.",
  },
  unavailableRecoveries: {
    refresh: "Open the request again to see its latest state.",
    revise: "Revise the request and send it again.",
    retry: "Try again later.",
    "correct-input": "Correct what the request holds and send it again.",
    "receipt-only": "Nothing more can be done here; keep the receipt.",
  },
  unavailableNoReason: "This action is not available.",
  unavailableLine: "{reason} {recovery}",
  handoffRefusedAdministrator:
    "The review service refused this request. The BReg log names the authority that refused it, the HTTP status and the problem code.",
  handoffRefusedOther:
    "The review service refused this request. An administrator can find out why in the BReg log.",
  whoDecided: "Show the reviewer's name",
  accountabilityLine: "{person}, as {profile}: {decision}",
  accountabilityUnavailable:
    "Who decided can only be read by a supervisor of this queue.",
  accountabilityNotFound: "No record of who decided this could be found.",
  accountabilityNotRead: "Who decided this could not be read. Try again.",
  clocksHeading: "Deadlines",
  clocksEmpty: "No deadlines run on this request.",
  clockName: "Deadline {number}",
  clockStageName: "{name} ({stage})",
  clockLine: "{name}: {state}",
  clockLineDue: "{name}: {state}, due {time}",
  clockStates: {
    running: "open",
    completed: "closed",
    cancelled: "no longer applies",
    source_facts_missing: "cannot be worked out yet",
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
  assignmentHeading: "Assign to a colleague",
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
  moreTargetsLoaded:
    "{count, plural, one {# colleague is now in the list.} other {# colleagues are now in the list.}}",
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
  zoneHint: "Times are in your time zone ({zone}).",
  heldWork:
    "New review tasks for {person} go to the cover. Review tasks they already hold stay with them; move them after saving.",
  saveAbsence: "Record",
  saveAbsenceChanges: "Save changes",
  absenceConfirmed: "The absence cover was recorded.",
  absenceEnded: "The absence cover was ended.",
  absenceUnknown:
    "Casework could not confirm the absence change. Retry the same attempt before making another change.",
  confirmEndAbsenceTitle: "End this absence cover?",
  confirmEndAbsenceBody:
    "{person} is covered from {from} until {until}. Once the cover ends, new review tasks go to them again.",
  confirmEndAbsence: "End absence cover",
  invalidInterval: "Cover must end after it starts.",
  caseloadTitle: "Move {person}'s review tasks in {queue}",
  caseloadHeading: "Move a caseload",
  caseloadDescription:
    "Move the review tasks one person holds in a queue to a colleague. Preview the move first: Casework then moves exactly the previewed review tasks, all at once.",
  caseloadQueue: "Queue",
  moveFrom: "From",
  moveTo: "To",
  movementReason: "Reason",
  caseloadNoMove:
    "Casework does not list {person} in this queue, so their review tasks cannot move here. Choose another queue or person.",
  previewCaseload: "Preview",
  caseloadPreviewSummary:
    "{count, plural, one {# review task} other {# review tasks}} in {queue} will move from {from} to {to}.",
  caseloadPreviewExpires:
    "This preview is available until {when}. After that, preview again.",
  caseloadPreviewNothing:
    "{from} holds no review task in {queue} that can move.",
  caseloadPreviewGone: "This preview is no longer available. Preview it again.",
  caseloadUnlisted: "the chosen colleague",
  confirmCaseload:
    "Move {count, plural, one {# review task} other {# review tasks}}",
  caseloadMoved:
    "Casework moved {count, plural, one {# review task} other {# review tasks}}.",
  caseloadUnknown:
    "Casework could not confirm the move. Retry the same attempt before moving anything else.",
  unknownStuck:
    "This change can no longer be retried. Check what Casework now shows before making it again.",
  stopShowing: "Stop showing this change",
  pendingTitle: "A staffing change is not confirmed",
  pendingBody:
    "Casework may have recorded {count, plural, one {# staffing change} other {# staffing changes}}. Retry each as the same attempt before changing staffing again.",
  pendingRetry: "Retry unconfirmed staffing changes",
  pendingStill:
    "Casework still could not confirm every change. Try again shortly.",
  pendingRefused:
    "Casework refused at least one unconfirmed staffing change, so it was not made. Check what Casework now shows.",
  pendingRecorded: "Casework recorded the unconfirmed staffing changes.",
  pendingWithoutAuthority:
    "A staffing change from an earlier session was not confirmed, and it can no longer be retried. Check what Casework now shows before making it again.",

  staffingTitle: "Staffing",
  staffingDescription:
    "Move review tasks between colleagues and record absence cover for the people you supervise.",
  caseloadNoQueues:
    "No review task you supervise names a queue yet, so there is no caseload to move.",
  caseloadQueuesPartial:
    "Casework listed only some of the review tasks you supervise, so a queue may be missing.",
  absencesHeading: "Absence cover",
  absencesCaption: "Absence cover for the people you supervise",
  absencesEmpty: "No absence cover is recorded.",
  recordAbsence: "Record absence",
  editAbsenceOf: "Edit absence for {person}",
  endAbsenceOf: "End absence cover for {person}",
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
  taskGrantPermission: "{service} / {location}: {actions}",
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
  taskNoTemplates: "No task templates are available for you on this review task.",
  taskNoGrants: "No task grants have been recorded for this review task.",
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
  setupTeamName: "Team identifier",
  setupTeamNameHint:
    "Choose a short identifier based on the team name, using hyphens instead of spaces. Use 1 to 128 letters A to Z, numbers, hyphens, underscores or full stops.",
  setupTeamNameExample: "",
  setupStaff: "Staff (one sign-in ID per line)",
  setupStaffHint:
    "A sign-in ID is the subject the identity provider holds for the person, not their display name and not their email address unless the provider uses email as the subject. Read it from the person’s record in the identity provider.",
  setupStaffExample: "",
  setupLeader: "Supervisor (sign-in ID)",
  setupLeaderHint:
    "In Staffing they record absence cover for the people they supervise and move a person’s review tasks to a colleague. In a review task’s history, they can see who decided it.",
  setupLeaderExample: "",
  setupQueue: "Queue this team works",
  setupQueueHint: "The team sees the review tasks waiting in this queue.",
  setupQueueTypedHint:
    "The queues could not be read, so type the queue identifier Casework uses.",
  setupQueueExample: "For example: new-requests",
  setupContinue: "Continue",
  setupTeamNameRequired: "Enter a team identifier.",
  setupTeamNameInvalid:
    "Use 1 to 128 letters A to Z, numbers, hyphens, underscores or full stops for the team identifier. Replace spaces with an allowed character.",
  setupStaffRequired: "Enter at least one sign-in ID for staff.",
  setupStaffInvalid:
    "Check each staff sign-in ID with your identity provider. Each must be at most 2,048 bytes and contain no control characters.",
  setupStaffDuplicate: "Enter each staff sign-in ID once. Remove the repeated line.",
  setupStaffTooMany:
    "Enter no more than 100 staff sign-in IDs for this team's initial setup.",
  setupLeaderRequired: "Enter the supervisor’s sign-in ID.",
  setupLeaderInvalid:
    "Check the supervisor's sign-in ID with your identity provider. It must be at most 2,048 bytes and contain no control characters.",
  setupQueueRequired: "Say which queue this team works.",
  setupQueueInvalid: "Choose a configured queue.",
  setupTeamNameTaken:
    "A team with identifier {name} is already set up. Use a different identifier.",
  setupCheckTitle: "Check the team before you create it",
  setupCheckDescription:
    "Nothing is created until you confirm. Go back if a sign-in ID is not exactly as the identity provider holds it.",
  setupCheckStaff: "Staff",
  setupCheckLeader: "Supervisor",
  setupCheckQueue: "Queue",
  setupChangeTeamName: "Change team identifier",
  setupChangeStaff: "Change staff",
  setupChangeLeader: "Change supervisor",
  setupChangeQueue: "Change queue",
  setupCreate: "Create team",
  setupCreating: "Creating team…",
  setupBack: "Back",
  setupDoneTitle: "Team {name} is ready",
  setupDoneNext:
    "Its staff see this queue’s review tasks in Your work the next time they sign in. They take review tasks from the queue themselves; setting up the team assigns nothing to anyone.",
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
  const content = useContext(CaseworkContentContext);
  const messages = useContext(MessagesContext);
  return useMemo(
    () => withMessages("casework", content, messages),
    [content, messages],
  );
}
