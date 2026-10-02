import { createContext, useContext, type ReactNode } from "react";
import { fill } from "@/blocks/lib/format";

/**
 * The words the record and request pages show on their own: generic
 * defaults an app replaces with its own content through
 * `PagesContentProvider`. Every field names a register concept (a record, a
 * request, a document slot); an app's own content supplies the register's
 * real nouns and any wording specific to its domain.
 */
export interface PagesContent {
  // Record list: title, search and the empty states a list can be in.
  recordListTitle: string;
  ownRecordListTitle: string;
  listDescription: string;
  ownListDescription: string;
  searchLabel: string;
  searchHint: string;
  createRecord: string;
  noRecords: string;
  noOwnRecords: string;
  noOwnRecordsBody: string;
  noSearchResults: string;
  noStaffRecordsBody: string;
  /**
   * The search box of an entity that searches several fields at once. The
   * registry matches capitals exactly, so the default says so.
   */
  searchWordsHint: string;
  /** A filter select's choice that applies no filter. */
  filterAll: string;
  /** The create button of a record entity beside the register's own; `{label}` is the entity's singular label. */
  addRecord: string;

  // Record detail: the record's own notice, its history and its requests.
  backToRecords: string;
  requestChange: string;
  requestChangeOf: string;
  recordNotice: string;
  historyHeading: string;
  historyGapTitle: string;
  historyGapBody: string;
  recordRequestsHeading: string;
  recordRequestsNote: string;
  recordRequestsEmpty: string;
  /** The back link of a record entity beside the register's own; `{label}` is its plural label. */
  backToList: string;
  /** Shown in a related records section with no record and nothing to add. */
  relatedEmpty: string;
  /** Between a revision's new value and the value it replaced. */
  historyWas: string;
  historyUnchanged: string;
  historyNone: string;

  // Creating a record.
  createTitle: string;
  createDescription: string;
  createSubmit: string;
  required: string;
  cancel: string;

  // A governed action's form: the action's own label is its heading.
  actionDescription: string;
  actionSubmit: string;
  /** What the button that leaves a confirmed write says when the write was opened from another page. */
  continueAfterWrite: string;

  // The change request form: the before/after comparison, checking and saving.
  changeFormTitle: string;
  changeFormDescription: string;
  checkTitle: string;
  checkDescription: string;
  before: string;
  after: string;
  originalValueUnavailable: string;
  submitNotice: string;
  saveDraft: string;
  saveChanges: string;
  checkAnswers: string;
  changeAnswers: string;
  back: string;
  cancelEditing: string;
  unchangedError: string;
  prefillDisclosure: string;
  confirmPrefillRequest: string;

  // The request detail page: state descriptions, actions and its recovery notices.
  requestTitle: string;
  reviewQueue: string;
  ownRequests: string;
  requestsHome: string;
  draftDescription: string;
  submittedDescription: string;
  revisionDescription: string;
  approvalExpiredDescription: string;
  approvedDescription: string;
  appliedDescription: string;
  rejectedDescription: string;
  cancelledDescription: string;
  actionExplanation: string;
  confirmSubmit: string;
  confirmApply: string;
  confirmRevision: string;
  confirmRebase: string;
  confirmCancel: string;
  reviewApprovedPendingApplicationTitle: string;
  reviewApprovedPendingApplicationBody: string;
  submittedReviewDescription: string;
  revisionReason: string;
  rejectionReason: string;
  viewRecordLink: string;
  editDraft: string;
  decideHeading: string;
  /** The actions panel's heading and hint on a holder's own request, in place of `decideHeading`. */
  holderActionsHeading: string;
  holderActionsHint: string;
  decidedBody: string;
  /** Shown in place of `decidedBody` once the server reports the request applied. */
  decidedAppliedBody: string;
  applyApproved: string;
  applyApprovedHint: string;
  unnamedRequest: string;
  reviewWithdrawalPendingTitle: string;
  reviewWithdrawalPendingBody: string;
  reviewSubmissionUnknownTitle: string;
  reviewSubmissionUnknownBody: string;
  reviewOperatorAttentionTitle: string;
  reviewOperatorAttentionBody: string;
  /** The operator-attention body by BREG's recovery code, in place of `reviewOperatorAttentionBody` for a code listed here. */
  reviewOperatorAttentionBodies: Readonly<Record<string, string>>;
  /** A request action's label, by its lifecycle action, before the action's own. */
  actionLabels: Readonly<Record<string, string>>;
  /** A lifecycle action's label, by action, where neither `actionLabels` nor the action names it. */
  lifecycleActionLabels: Readonly<Record<string, string>>;
  /** Shown where a holder's session finds this request unavailable. */
  requestUnavailable: string;

  // A submission this session left unresolved.
  recoveryBody: string;
  checkOutcome: string;
  leaveRecovery: string;

  // Supporting documents: slot and file-type names, and an unresolved upload's notice.
  attachmentSlots: Readonly<Record<string, string>>;
  attachmentSlotFallback: string;
  attachmentTypes: Readonly<Record<string, string>>;
  attachmentStatus: Readonly<Record<string, string>>;
  attachmentPendingTitle: string;
  attachmentPendingBody: string;
  attachmentPendingPrevious: string;
  attachmentPendingOpen: string;

  // The request queue: its title by role, filter, columns and its own empty states.
  requestListTitle: string;
  holderRequestsTitle: string;
  queueTitle: string;
  requestsDescription: string;
  queueDescription: string;
  allStates: string;
  stageFilterLabel: string;
  waitingOnColumn: string;
  waitingOnOffice: string;
  waitingOnSubject: string;
  referenceColumn: string;
  resultCountAnnouncement: string;
  queueCaption: string;
  holderQueueCaption: string;
  defaultOrderNote: string;
  queueEmptyTitle: string;
  queueEmptyBody: string;
  holderQueueEmptyTitle: string;
  holderQueueEmptyBody: string;
  /** The empty request list of a role that is neither reviewer nor holder, which sees only the requests its access allows. */
  requestsEmptyTitle: string;
  requestsEmptyBody: string;
  queueFilteredEmptyTitle: string;
  queueFilteredEmptyBody: string;
  queueRecoveredAnnouncement: string;
}

export const pagesContent: PagesContent = {
  recordListTitle: "Records",
  ownRecordListTitle: "Your records",
  listDescription: "Find and inspect records held by your institution.",
  ownListDescription: "Open a record to check its details or request a change.",
  searchLabel: "Search",
  searchHint: "Enter the complete identifier.",
  createRecord: "Create a record",
  noRecords: "No records to show",
  noOwnRecords: "No records are linked to your account",
  noOwnRecordsBody:
    "If you expected to see a record, ask the team that gave you access to check which records are linked to your account.",
  noSearchResults:
    "No matching record was found. Check the identifier or clear the filter.",
  noStaffRecordsBody: "Records you are allowed to inspect will appear here.",
  searchWordsHint: "Enter words to search for. Capitals count.",
  filterAll: "All",
  addRecord: "Add {label}",

  backToRecords: "Back to records",
  requestChange: "Request a change",
  requestChangeOf: "Request {label}",
  recordNotice:
    "These are recorded facts, not a determination of current standing.",
  historyHeading: "History",
  historyGapTitle: "Revision history is not available in this release",
  historyGapBody:
    "This release cannot show who changed the record, when, or under which request. If you need the full revision history, contact the registry team that maintains this service.",
  recordRequestsHeading: "Requests for this record",
  recordRequestsNote:
    "Requests for this record are shown in the registry's default order.",
  recordRequestsEmpty: "There are no requests for this record.",
  backToList: "Back to {label}",
  relatedEmpty: "None recorded.",
  historyWas: "was",
  historyUnchanged: "No recorded value changed.",
  historyNone: "No earlier states are recorded.",

  createTitle: "Create a record",
  createDescription:
    "Record the institution's existing decision. Creating this record does not grant an entitlement.",
  createSubmit: "Create record",
  required: "All fields are required unless marked optional.",
  cancel: "Cancel",

  actionDescription:
    "Enter what this action asks for. The registry checks your answers and makes the change only once it accepts them.",
  actionSubmit: "Submit",
  continueAfterWrite: "Continue",

  changeFormTitle: "Request a change",
  changeFormDescription:
    "Select the fields to change and explain what was recorded incorrectly.",
  checkTitle: "Check your request",
  checkDescription:
    "Review this proposal before saving it. You can submit the saved draft on the next page.",
  before: "Currently recorded",
  after: "Proposed change",
  originalValueUnavailable:
    "The original value is not included in this request view.",
  submitNotice:
    "Submitting sends this proposal for review. It does not change the record.",
  saveDraft: "Save draft",
  saveChanges: "Save draft changes",
  checkAnswers: "Check your answers",
  changeAnswers: "Change your answers",
  back: "Back",
  cancelEditing: "Discard unsaved changes",
  unchangedError: "Change the recorded values to correct the existing record.",
  prefillDisclosure:
    "The portal will ask the accepted evidence provider to verify this answer. The portal makes the request for you, using your signed-in identity and this record.",
  confirmPrefillRequest: "Request verified information",

  requestTitle: "Request",
  reviewQueue: "Review queue",
  ownRequests: "Your requests",
  requestsHome: "Requests",
  draftDescription:
    "This is a saved draft. Check the proposed change before submitting it for review.",
  submittedDescription:
    "Your request is awaiting review. The recorded values have not changed.",
  revisionDescription:
    "The reviewer has asked for a revision. Use the available revise action to prepare a new draft, then check and submit it again.",
  approvalExpiredDescription:
    "The approval expired before it was applied. The recorded values have not changed. Revise the proposal to send it for review again, or cancel it.",
  approvedDescription:
    "This proposal is approved. The recorded values change only after a reviewer applies it successfully.",
  appliedDescription: "This request has been applied to the record.",
  rejectedDescription:
    "The reviewer rejected this proposal. The recorded values have not changed.",
  cancelledDescription:
    "This request was cancelled. The recorded values have not changed.",
  actionExplanation: "Choose a permitted action for this request.",
  confirmSubmit:
    "Send this proposal to a reviewer. You will be able to edit it again only when the workflow permits.",
  confirmApply:
    "Applying this approved proposal changes the values recorded for this record according to the reviewed proposal.",
  confirmRevision:
    "The owner will need to prepare and resubmit a revised proposal.",
  confirmRebase:
    "Prepare a new draft against the current record. The previous approval will not authorize the revised proposal.",
  confirmCancel: "Cancel this request without changing the record.",
  reviewApprovedPendingApplicationTitle: "Approved, not yet applied",
  reviewApprovedPendingApplicationBody:
    "This proposal is approved. The record is unchanged until an authorized registry action applies it.",
  submittedReviewDescription:
    "This proposal is awaiting review. The record has not changed.",
  revisionReason: "What the reviewer asked to correct",
  rejectionReason: "Why the reviewer rejected this request",
  viewRecordLink: "View record",
  editDraft: "Edit draft",
  decideHeading: "Decide",
  holderActionsHeading: "What you can do",
  holderActionsHint: "Choose what to do with your request.",
  decidedBody:
    "The request has been updated. The record changes only when an approved change is applied.",
  decidedAppliedBody:
    "The request has been applied. The record now holds the change.",
  applyApproved: "Apply approved request",
  applyApprovedHint:
    "Approval is complete. Apply the request to update the record.",
  unnamedRequest: "Request",
  reviewWithdrawalPendingTitle: "Withdrawal is pending",
  reviewWithdrawalPendingBody:
    "The registry asked its casework service to cancel this review. Keep treating the request as submitted until the cancellation is confirmed.",
  reviewSubmissionUnknownTitle: "Review submission is not confirmed",
  reviewSubmissionUnknownBody:
    "The registry cannot confirm whether this submission was accepted. Do not submit a replacement request.",
  reviewOperatorAttentionTitle: "Review recovery needs attention",
  reviewOperatorAttentionBody:
    "Automatic review recovery stopped. An operator must reconcile this request before it continues.",
  reviewOperatorAttentionBodies: {},
  actionLabels: {},
  lifecycleActionLabels: {
    submit: "Submit request",
    cancel: "Cancel request",
    revise: "Revise request",
    rebase: "Review against latest record",
    apply: "Apply approved change",
  },
  requestUnavailable: "This request is unavailable",

  recoveryBody:
    "This tab has a reference to an interrupted submission. Check its outcome before starting another. If the original submission is no longer available, current records may help, but similar content alone does not prove it succeeded.",
  checkOutcome: "Check submission outcome",
  leaveRecovery: "I have noted the reference; close this notice",

  attachmentSlots: {},
  attachmentSlotFallback: "Document",
  attachmentTypes: {},
  attachmentStatus: {},
  attachmentPendingTitle: "A document upload needs checking",
  attachmentPendingBody:
    "A file sent to {document} was not confirmed. Open the request to retry the same file before adding another.",
  attachmentPendingPrevious:
    "A file sent in a previous sign-in session was not confirmed. Check the request's documents before adding it again.",
  attachmentPendingOpen: "Open the request",

  requestListTitle: "Requests",
  holderRequestsTitle: "Your requests",
  queueTitle: "Review queue",
  requestsDescription:
    "Follow each request from draft through review and application.",
  queueDescription:
    "Review submitted proposals, then apply approved requests as a separate action.",
  allStates: "All available states",
  stageFilterLabel: "Stage",
  waitingOnColumn: "Waiting on",
  waitingOnOffice: "Office",
  waitingOnSubject: "Subject",
  referenceColumn: "Reference",
  resultCountAnnouncement: "Showing {count} requests",
  queueCaption: "Review queue: requests waiting for a decision",
  holderQueueCaption: "Your requests and where each one stands",
  defaultOrderNote: "Requests are shown in the registry's default order.",
  queueEmptyTitle: "There are no requests waiting for review",
  queueEmptyBody: "Requests appear here once they are sent for review.",
  holderQueueEmptyTitle: "You have no requests",
  holderQueueEmptyBody:
    "When you ask for a change to one of your records, it appears here.",
  requestsEmptyTitle: "No requests to show",
  requestsEmptyBody: "This list shows only the requests your account can see.",
  queueFilteredEmptyTitle: "No requests match the filters: {filters}",
  queueFilteredEmptyBody:
    "Remove one of these filters, or clear all of them, to see more requests.",
  queueRecoveredAnnouncement:
    "That page reference had expired, so the queue returned to the first page.",
};

const PagesContentContext = createContext<PagesContent>(pagesContent);

export function PagesContentProvider({
  content,
  children,
}: {
  content: PagesContent;
  children: ReactNode;
}) {
  return (
    <PagesContentContext.Provider value={content}>
      {children}
    </PagesContentContext.Provider>
  );
}

export function usePagesContent(): PagesContent {
  return useContext(PagesContentContext);
}

/**
 * A list page's heading: the app's own title where its content words one,
 * otherwise the model's plural label, the name the nav gives the same place.
 * A title the app sets to the default's own words reads as unset.
 */
export function listTitle(
  pages: PagesContent,
  key:
    | "recordListTitle"
    | "ownRecordListTitle"
    | "requestListTitle"
    | "holderRequestsTitle",
  pluralLabel: string,
): string {
  return pages[key] === pagesContent[key] ? pluralLabel : pages[key];
}

/**
 * A create control's words: the app's own where its content words them,
 * otherwise the model's words for the create (its label, or the words under
 * the create page's heading), otherwise the generic default. Words the app
 * sets to the default's own read as unset, as in `listTitle`.
 */
export function createWords(
  pages: PagesContent,
  key:
    | "createRecord"
    | "createTitle"
    | "addRecord"
    | "createSubmit"
    | "createDescription"
    | "requestChangeOf",
  served: string | undefined,
  entityLabel: string,
): string {
  return pages[key] === pagesContent[key] && served
    ? served
    : fill(pages[key], { label: entityLabel });
}
