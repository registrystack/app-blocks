import { useContentArea } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";

/**
 * The words the record and request pages show on their own: generic
 * defaults an app replaces with its own content through the `pages` area of
 * `ContentProvider`. Fields such as `cancel` and `back` are plain interface
 * words; the rest name a register concept (a record, a request, a document
 * slot), and an app's own content supplies the register's real nouns and any
 * wording specific to its domain.
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
  /**
   * The title of a records place whose entity the session can find a record
   * of but not list. `{records}` is the entity's plural label.
   */
  findRecordTitle: string;
  findRecordDescription: string;
  openByIdHeading: string;
  openByIdLabel: string;
  openByIdSubmit: string;
  /** Said, before any request, when the identifier box holds a value that is not a record identifier. */
  openByIdNotIdentifier: string;
  /** Follows openByIdNotIdentifier where the page also has a lookup. `{selector}` is the first lookup's heading. */
  openByIdUseLookup: string;
  /** The button of a lookup form, and the heading over the fields a lookup discloses. */
  lookupSubmit: string;
  lookupResultHeading: string;
  /** The one answer when a record cannot be shown, whether it does not exist, lies outside the session's boundary or is refused. */
  findNoMatch: string;
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
  /** The heading over what a landing page offers to start. */
  startsHeading: string;
  /** Under the heading of the page that lists what the session may start. */
  startsDescription: string;
  /** Heading of that page when the session may start nothing. */
  startsNothingTitle: string;
  /** Body of that page when the session may also read no record. */
  startsNothingBody: string;
  /** Body of that page when the session reads records, followed by a link to them. */
  startsReadOnlyBody: string;

  // Record detail: the record's own notice, its history and its requests.
  /** The back link to the register's own list, where the app words it; unset, it reads as every other list's (`backToList`). */
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
  /** Opens the ordinary request list when this session cannot filter that request kind by record; `{label}` is its plural label. */
  recordRequestsBrowse: string;
  /** The back link to a record entity's list; `{label}` is its plural label. */
  backToList: string;
  /** Shown in a related records section with no record and nothing to add. */
  relatedEmpty: string;
  /** Said once more records refer to this one than the section shows; `{count}` is how many it shows. */
  relatedBounds: string;
  /** Opens the list of every record that refers to this one; `{label}` is the entity's plural label. */
  relatedShowAll: string;
  /** Heads a related records section when several fields of its entity refer to this record; `{records}` is the entity's plural label, `{field}` the referring field's label. */
  relatedRecordsBy: string;
  /** Under the history heading. */
  historyIntro: string;
  /** Marks the state the record holds now. */
  historyCurrent: string;
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
  /** Labels the new record's identifier when a confirmed write cannot be opened by the person who made it. */
  registryReference: string;
  /** Says what that identifier is for. */
  registryReferenceHelp: string;
  /** Clears a confirmed action form so the same action can be entered again. */
  recordAnother: string;
  /** What the button that leaves a confirmed write says when the write was opened from another page. */
  continueAfterWrite: string;
  /**
   * An input the registry fills from a field of a record: where its value is
   * read from, and what the form says while it has none. `{field}` is the
   * field's label and `{input}` the label of the input that chooses the record.
   */
  anchorFromChosen: string;
  anchorFromThis: string;
  anchorWaiting: string;
  anchorLoading: string;
  anchorUnavailable: string;
  anchorFailed: string;
  anchorExpired: string;

  // The change request form: the before/after comparison, checking and saving.
  changeFormTitle: string;
  changeFormDescription: string;
  checkTitle: string;
  checkDescription: string;
  before: string;
  after: string;
  originalValueUnavailable: string;
  /** Names a table's scroll region by the side of the form it sits on (the record's rows beside the form). */
  scopeBesideForm: string;
  /** Names a table's scroll region in the review: the rows as they were. */
  scopeReviewBefore: string;
  /** Names a table's scroll region in the review: the rows as the change would leave them. */
  scopeReviewAfter: string;
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
  /** `revisionDescription` for staff reading a request that is not their own. */
  staffRevisionDescription: string;
  approvalExpiredDescription: string;
  approvedDescription: string;
  appliedDescription: string;
  appliedOnLabel: string;
  appliedByLabel: string;
  rejectedDescription: string;
  cancelledDescription: string;
  actionExplanation: string;
  confirmSubmit: string;
  /** `confirmSubmit` for staff submitting on a requester's behalf. */
  staffConfirmSubmit: string;
  confirmApply: string;
  confirmRevision: string;
  confirmRebase: string;
  confirmCancel: string;
  reviewApprovedPendingApplicationTitle: string;
  reviewApprovedPendingApplicationBody: string;
  submittedReviewDescription: string;
  revisionReason: string;
  /** `revisionReason` for staff, who are not the one asked to correct. */
  staffRevisionReason: string;
  rejectionReason: string;
  /** Returns a contextual-only request to the record where it started. */
  backToRecord: string;
  viewRecordLink: string;
  requestResultsHeading: string;
  /** Opens a readable record produced by this applied request; `{label}` is its entity label. */
  viewRequestResult: string;
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
  applyReasonLabel: string;
  applyReasonHint: string;
  unnamedRequest: string;
  reviewWithdrawalPendingTitle: string;
  reviewWithdrawalPendingBody: string;
  reviewSubmissionUnknownTitle: string;
  reviewSubmissionUnknownBody: string;
  reviewOperatorAttentionTitle: string;
  reviewOperatorAttentionBody: string;
  /** The operator-attention body by BReg's recovery code, in place of `reviewOperatorAttentionBody` for a code listed here. */
  reviewOperatorAttentionBodies: Readonly<Record<string, string>>;
  applicationOperatorAttentionTitle: string;
  applicationOperatorAttentionBody: string;
  /** The automatic-application body by BReg's reason, in place of `applicationOperatorAttentionBody` for a reason listed here. */
  applicationOperatorAttentionBodies: Readonly<Record<string, string>>;
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
  /** Labels the links that choose among several request entities. */
  requestKindsLabel: string;
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
  /** Announced when an expired page reference returns a record list to its first page. */
  listRecoveredAnnouncement: string;

  // The holder's steps: choose the record, choose what to change, enter it,
  // add documents, review and submit; and the drafts a holder resumes.
  holderStepsLabel: string;
  /** The step names in order; `{current}` and `{total}` give a step's place. */
  holderStepRecord: string;
  holderStepChange: string;
  holderStepAnswers: string;
  holderStepDocuments: string;
  holderStepReview: string;
  holderStepPosition: string;
  chooseRecordTitle: string;
  chooseRecordDescription: string;
  /** The button on one record of the list; `{title}` names the record. */
  chooseRecordButton: string;
  chooseRecordEmptyTitle: string;
  chooseRecordEmptyBody: string;
  chooseChangeTitle: string;
  chooseChangeDescription: string;
  chooseChangeNoneTitle: string;
  chooseChangeNoneBody: string;
  documentsTitle: string;
  documentsDescription: string;
  documentsNone: string;
  documentsContinue: string;
  documentsBack: string;
  reviewTitle: string;
  reviewDescription: string;
  reviewChangeAnswers: string;
  reviewChangeDocuments: string;
  reviewSubmitFallback: string;
  reviewSubmitUnavailable: string;
  reviewDiscard: string;
  reviewDiscardQuestion: string;
  reviewDiscardConfirm: string;
  reviewDiscardKeep: string;
  reviewSentTitle: string;
  reviewSentBody: string;
  reviewDiscardedTitle: string;
  reviewDiscardedBody: string;
  /** Heads a step that finds its request no longer a draft and cannot tell which state it is in. */
  reviewNotDraftTitle: string;
  reviewNotDraftBody: string;
  /** The same notice's heading by the request's state, where the registry reports one. */
  reviewNotDraftTitles: Readonly<Record<string, string>>;
  /** The same notice's body by the request's state. */
  reviewNotDraftBodies: Readonly<Record<string, string>>;
  reviewViewRequest: string;
  draftsHeading: string;
  draftsDescription: string;
  draftsResume: string;
  draftsUnnamed: string;
  draftsStart: string;
  draftsUnavailable: string;
}

export const pagesContent: PagesContent = {
  recordListTitle: "Records",
  ownRecordListTitle: "Your records",
  listDescription: "Find and inspect records held by your institution.",
  ownListDescription: "Open a record to check its details or request a change.",
  searchLabel: "Search",
  searchHint: "Enter the complete identifier.",
  createRecord: "Create a record",
  findRecordTitle: "Find {records}",
  findRecordDescription: "Find one record from what you already hold.",
  openByIdHeading: "Open by identifier",
  openByIdLabel: "Identifier",
  openByIdSubmit: "Open record",
  openByIdNotIdentifier:
    "This box takes the record identifier, a long code the registry assigns, not the record's own code.",
  openByIdUseLookup:
    "To find the record from what you hold, use {selector} above.",
  lookupSubmit: "Find record",
  lookupResultHeading: "Record found",
  findNoMatch: "No record is available for what you entered.",
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
  startsHeading: "Start",
  startsDescription:
    "Choose what to start. The registry checks what you enter.",
  startsNothingTitle: "Nothing to start here",
  startsNothingBody:
    "Your account can neither read records nor start anything in this app. Ask the team that gave you access which access it holds.",
  startsReadOnlyBody:
    "Your account can read records here but has nothing to start. Find them in",

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
  recordRequestsBrowse: "Browse {label}",
  backToList: "Back to {label}",
  relatedEmpty: "None recorded.",
  relatedBounds: "Showing the first {count}. More are recorded.",
  relatedShowAll: "Show all {label}",
  relatedRecordsBy: "{records} ({field})",
  historyIntro: "Changes the registry returned, newest first.",
  historyCurrent: "Current",
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
  registryReference: "Record identifier",
  registryReferenceHelp:
    "This account cannot open the record it wrote. Someone who can read it finds it by this identifier.",
  recordAnother: "Record another",
  continueAfterWrite: "Continue",
  anchorFromChosen: "Read from {field} of the record chosen in {input}.",
  anchorFromThis: "Read from {field} of this record.",
  anchorWaiting: "Filled in once a record is chosen in {input}.",
  anchorLoading: "Reading the value from the chosen record.",
  anchorUnavailable:
    "The value could not be read from the chosen record. Choose the record again.",
  anchorFailed: "The value could not be read just now. Try again in a moment.",
  anchorExpired:
    "This form has expired. Open the action again to read the value.",

  changeFormTitle: "Request a change",
  changeFormDescription:
    "Complete this request using the fields below, then check your answers before saving.",
  checkTitle: "Check your request",
  checkDescription:
    "Review this proposal before saving it. You can submit the saved draft on the next page.",
  before: "Currently recorded",
  after: "Proposed change",
  originalValueUnavailable:
    "The original value is not included in this request view.",
  scopeBesideForm: "record now, beside the form",
  scopeReviewBefore: "change under review, before",
  scopeReviewAfter: "change under review, after",
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
  staffRevisionDescription:
    "The reviewer sent this request back to the requester to change. The recorded values have not changed.",
  approvalExpiredDescription:
    "The approval expired before it was applied. The recorded values have not changed. Revise the proposal to send it for review again, or cancel it.",
  approvedDescription:
    "This proposal is approved. The recorded values change only once it is applied.",
  appliedDescription: "This request has been applied to the record.",
  appliedOnLabel: "Applied on",
  appliedByLabel: "Applied by actor reference",
  rejectedDescription:
    "The reviewer rejected this proposal. The recorded values have not changed.",
  cancelledDescription:
    "This request was cancelled. The recorded values have not changed.",
  actionExplanation: "Choose a permitted action for this request.",
  confirmSubmit:
    "Send this proposal to a reviewer. You will be able to edit it again only when the workflow permits.",
  staffConfirmSubmit:
    "Send this proposal to a reviewer. It can be edited again only when the workflow permits.",
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
  staffRevisionReason: "What the reviewer asked the requester to correct",
  rejectionReason: "Why the reviewer rejected this request",
  backToRecord: "Back to record",
  viewRecordLink: "View record",
  requestResultsHeading: "Result",
  viewRequestResult: "View {label}",
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
  applyReasonLabel: "Reason (optional)",
  applyReasonHint: "Kept with the application in the registry's audit record.",
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
  applicationOperatorAttentionTitle: "Recording needs attention",
  applicationOperatorAttentionBody:
    "Automatic recording stopped. An operator must reconcile this request before it continues.",
  // BReg's recovery for these two reasons is `correct-input`: the person who
  // made the request updates it or cancels it, so they must not tell the
  // reader an operator will fix it. They name no lifecycle action: BReg offers
  // revise or rebase after a refusal but only rebase after a rules change, and
  // a register may grant the owner neither.
  applicationOperatorAttentionBodies: {
    "application-refused":
      "The registry refused to record this request, for example because the record changed after the request was made. The person who made the request must update it and submit it again or, if that is not offered, cancel it.",
    "contract-changed":
      "The rules for this request changed before the registry recorded it. The person who made the request must update it to the current rules and submit it again or, if that is not offered, cancel it.",
  },
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
  attachmentTypes: {
    "application/pdf": "PDF",
    "image/png": "PNG image",
    "image/jpeg": "JPEG image",
  },
  attachmentStatus: {},
  attachmentPendingTitle: "A document upload needs checking",
  attachmentPendingBody:
    "A file sent to {document} was not confirmed. Open the request to retry the same file before adding another.",
  attachmentPendingPrevious:
    "A file sent in a previous sign-in session was not confirmed. Check the request's documents before adding it again.",
  attachmentPendingOpen: "Open the request",

  requestListTitle: "Requests",
  requestKindsLabel: "Request type",
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
  listRecoveredAnnouncement:
    "That page reference had expired, so the list returned to the first page.",

  holderStepsLabel: "Steps in this change",
  holderStepRecord: "Choose the record",
  holderStepChange: "Choose what to change",
  holderStepAnswers: "Enter the change",
  holderStepDocuments: "Add documents",
  holderStepReview: "Review and submit",
  holderStepPosition: "Step {current} of {total}",
  chooseRecordTitle: "Choose the record to change",
  chooseRecordDescription:
    "Pick the record you want to ask a change to. Only records you can see are listed.",
  chooseRecordButton: "Choose {title}",
  chooseRecordEmptyTitle: "No records to change",
  chooseRecordEmptyBody:
    "No record is available to your account, so there is nothing to ask a change to.",
  chooseChangeTitle: "Choose what to change",
  chooseChangeDescription:
    "These are the changes the registry offers you for this record. Nothing is sent until you submit the request.",
  chooseChangeNoneTitle: "No change is offered for this record",
  chooseChangeNoneBody:
    "The registry offers your account no change to this record. Ask the team that runs this service if you expected one.",
  documentsTitle: "Add supporting documents",
  documentsDescription:
    "Attach the documents that support this request, then continue to review. The registry keeps them with your draft.",
  documentsNone: "This request takes no documents.",
  documentsContinue: "Continue to review",
  documentsBack: "Back to your answers",
  reviewTitle: "Review and submit",
  reviewDescription:
    "This draft is held by the registry, not by this browser. Check it, then submit it for review. Submitting does not change the record.",
  reviewChangeAnswers: "Change your answers",
  reviewChangeDocuments: "Change documents",
  reviewSubmitFallback: "Submit request",
  reviewSubmitUnavailable:
    "The registry does not offer you the submission of this draft.",
  reviewDiscard: "Discard this draft",
  reviewDiscardQuestion:
    "Discard this draft? You will not be able to submit it afterwards.",
  reviewDiscardConfirm: "Yes, discard it",
  reviewDiscardKeep: "Keep the draft",
  reviewSentTitle: "Your request was sent for review",
  reviewSentBody:
    "The registry has your request. The record does not change until it is reviewed and applied.",
  reviewDiscardedTitle: "Draft discarded",
  reviewDiscardedBody:
    "The registry no longer holds this draft for submission.",
  reviewNotDraftTitle: "This request is no longer a draft",
  reviewNotDraftBody:
    "The registry no longer holds it as a draft. Open the request to see where it stands.",
  reviewNotDraftTitles: {
    submitted: "Your request was sent for review",
    "changes-requested": "A reviewer asked for changes",
    approved: "Your request was approved",
    rejected: "Your request was not approved",
    applied: "Your request was applied",
    cancelled: "This draft was discarded",
    "approval-expired": "The approval expired",
  },
  reviewNotDraftBodies: {
    submitted:
      "This request is no longer a draft. The registry has your request, and the record does not change until it is reviewed and applied.",
    "changes-requested":
      "This request is no longer a draft. A reviewer asked for changes before it can go on.",
    approved:
      "This request is no longer a draft. The record changes when the approved change is applied.",
    rejected:
      "This request is no longer a draft, and the record was not changed.",
    applied:
      "This request is no longer a draft. The record now shows the change.",
    cancelled:
      "The registry no longer holds it for submission. The record was not changed.",
    "approval-expired":
      "This request is no longer a draft. The approval lapsed before the change was applied.",
  },
  reviewViewRequest: "View your request",
  draftsHeading: "Changes in progress",
  draftsDescription:
    "The registry holds these drafts for you. Pick one up where you left it.",
  draftsResume: "Continue {title}",
  draftsUnnamed: "Draft change",
  draftsStart: "Request a change",
  draftsUnavailable: "Your drafts could not be read.",
};

export function usePagesContent(): PagesContent {
  return useContentArea("pages", pagesContent);
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
    | "requestChangeOf"
    | "changeFormTitle"
    | "changeFormDescription",
  served: string | undefined,
  entityLabel: string,
  locale: string,
): string {
  return pages[key] === pagesContent[key] && served
    ? served
    : fill(pages[key], { label: entityLabel }, locale);
}

/**
 * The back link to an entity's list, in `locale`. The register's own list
 * keeps the app's own wording where its content sets one; otherwise every
 * list is named by its plural label, the name the nav gives the same place.
 */
export function backToListOf(
  pages: PagesContent,
  entity: { pluralLabel: string },
  own: boolean,
  locale: string,
): string {
  if (own && pages.backToRecords !== pagesContent.backToRecords)
    return pages.backToRecords;
  return fill(pages.backToList, { label: entity.pluralLabel }, locale);
}
