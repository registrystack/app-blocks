import { createContext, useContext, type ReactNode } from "react";

/**
 * The words blocks show on their own: generic defaults an app replaces with
 * its own content through `BlockContentProvider`.
 */
export interface BlockContent {
  notRecorded: string;
  yes: string;
  no: string;
  notSupplied: string;
  optional: string;
  selectOption: string;
  errorPrefix: string;
  /** Shown while a block waits on data it cannot yet render. */
  loading: string;
  /** The hint of a checkbox group whose field carries none. */
  choicesHint: string;
  /** The words for a recorded blank answer, by field id. */
  blankValues: Readonly<Record<string, string>>;
  /** Words for coded values, by code, before the words a field model carries. */
  terms: Readonly<Record<string, string>>;

  // Record blocks: a list's search and paging, a table's row action, a
  // form's validation banner. Generic defaults; an app's own wording (which
  // may name its register) reaches these through `blockContentOf`.
  search: string;
  clearSearch: string;
  previous: string;
  next: string;
  page: string;
  viewRecord: string;
  actions: string;
  validationTitle: string;
  requiredError: string;
  /** The check message for one field, by field id, before the generic wording below. */
  fieldErrors: Readonly<Record<string, string>>;
  dateError: string;
  invalidError: string;

  // Request blocks: a command's outcome, a decision, a change comparison,
  // reviewer notes, verified prefill and supporting documents. Generic
  // defaults; wording that names the register (a decision's own body text, a
  // recovery notice's product name, the "before"/"after" column headings)
  // reaches these blocks as required props instead, supplied by the app.
  saving: string;
  unknownTitle: string;
  unknownBody: string;
  retryRefused: string;
  receipt: string;
  exactRetry: string;
  reconcile: string;
  confirmed: string;
  openRequest: string;
  decisionCheckHeading: string;
  decisionConfirm: string;
  decisionChange: string;
  decisionContinue: string;
  decisionReasonLabel: string;
  decisionReasonAudience: string;
  decisionReasonHint: string;
  noActions: string;
  staleDecidedTitle: string;
  staleDecidedBody: string;
  reloadRequest: string;
  decidedTitle: string;
  /** Announced to assistive technology once a decision is confirmed; the decision's own body text is the caller's, since it may name what the decision changes. */
  decisionAnnounced: string;
  proposedHeading: string;
  fieldColumn: string;
  currentColumn: string;
  proposedColumn: string;
  changedMarker: string;
  showUnchanged: string;
  hideUnchanged: string;
  currentUnavailable: string;
  whyAskedHeading: string;
  /** `whyAskedHeading` on a holder's own request. */
  holderWhyAskedHeading: string;
  changeAnswer: string;
  prefillVerified: string;
  prefillChanged: string;
  prefillInvalid: string;
  prefillLoading: string;
  prefillProposed: string;
  acceptPrefill: string;
  prefillUnavailable: string;
  prefillUncertain: string;
  prefillDenied: string;
  prefillExpired: string;
  getVerifiedInformation: string;
  revisionNoNote: string;
  undisclosedRevisionReason: string;
  attachmentsHeading: string;
  attachmentReadiness: string;
  attachmentNone: string;
  attachmentRequired: string;
  attachmentRemove: string;
  attachmentChoose: string;
  attachmentChooseReplacement: string;
  attachmentAllowed: string;
  attachmentUpload: string;
  attachmentReplace: string;
  attachmentWrongType: string;
  attachmentTooLarge: string;
  attachmentDownload: string;
  attachmentNotRetainedTitle: string;
  attachmentNotRetained: string;
  attachmentStopWaiting: string;
  attachmentFileLost: string;
  attachmentFileLine: string;
  attachmentFileLineUndated: string;
  fileSizeKilobytes: string;
  fileSizeMegabytes: string;
  /** "View {document}", the document's own name filled in by the caller. */
  documentView: string;
  documentSelected: string;
  documentSelectedReplacement: string;

  // Repeatable groups: the words for adding and removing an item, and for
  // naming one item by its position among the others. Optional: an app that
  // builds its BlockContent from its own content type may not carry these
  // yet, so the group control falls back to its own default wording.
  addGroupItem?: string;
  removeGroupItem?: (index: number) => string;
  groupItemLegend?: (index: number) => string;
}

export const blockContent: BlockContent = {
  notRecorded: "Not recorded",
  yes: "Yes",
  no: "No",
  notSupplied: "Not supplied",
  optional: "optional",
  selectOption: "Choose an option",
  errorPrefix: "Error:",
  loading: "Loading…",
  choicesHint: "Select all that apply.",
  blankValues: {},
  terms: {},

  search: "Search",
  clearSearch: "Clear search",
  previous: "Previous",
  next: "Next",
  page: "Page",
  viewRecord: "View record",
  actions: "Actions",
  validationTitle: "Check the information you entered",
  requiredError: "Enter a value for this field.",
  fieldErrors: {},
  dateError: "Enter a valid date.",
  invalidError: "Enter a valid value.",

  saving: "Sending…",
  unknownTitle: "We could not confirm the result",
  unknownBody:
    "Your request may have reached the registry. Do not start a replacement submission. You can retry this exact submission while its original session and authority remain available.",
  retryRefused:
    "The service refused this retry. The earlier submission outcome is still not confirmed.",
  receipt: "Support reference",
  exactRetry: "Retry this exact submission",
  reconcile: "Check current records",
  confirmed: "Confirmed by the registry",
  openRequest: "Open request",
  decisionCheckHeading: "Check this decision",
  decisionConfirm: "Confirm decision",
  decisionChange: "Change decision",
  decisionContinue: "Continue",
  decisionReasonLabel: "Reason",
  decisionReasonAudience: "The subject reads this.",
  decisionReasonHint:
    "Say what is wrong with the request and what the subject needs to change or provide, in words they will understand.",
  noActions: "There are no actions available to your account for this request.",
  staleDecidedTitle: "This request was decided while you had it open",
  staleDecidedBody:
    "Another reviewer has recorded a decision. Check what changed, then reload this request.",
  reloadRequest: "Reload this request",
  decidedTitle: "Decision recorded",
  decisionAnnounced: "Your decision was recorded.",
  proposedHeading: "What is proposed",
  fieldColumn: "Field",
  currentColumn: "Current",
  proposedColumn: "Proposed",
  changedMarker: "Changed",
  showUnchanged: "Show unchanged fields ({count})",
  hideUnchanged: "Hide unchanged fields",
  currentUnavailable:
    "The recorded values at the time of this decision are not held with the request.",
  whyAskedHeading: "Why the subject asked",
  holderWhyAskedHeading: "Why you asked",
  changeAnswer: "Change {field}",
  prefillVerified: "Verified source answer",
  prefillChanged: "Changed after verification",
  prefillInvalid:
    "The retained evidence could not be re-verified. Treat this answer as unverified.",
  prefillLoading: "Requesting verified information…",
  prefillProposed: "Proposed verified answer",
  acceptPrefill: "Use this answer",
  prefillUnavailable:
    "Verified information is unavailable. Enter your answer yourself or attach a supporting document.",
  prefillUncertain:
    "The request outcome is uncertain. Retrying this reference will not request the information again. You can enter it yourself.",
  prefillDenied:
    "The provider could not release this information. Enter it yourself or attach a document.",
  prefillExpired:
    "This verified answer has expired. Request it again or enter your answer yourself.",
  getVerifiedInformation: "Get verified information",
  revisionNoNote: "The reviewer did not leave a note for you.",
  undisclosedRevisionReason: "The reviewer reason is not available to this account.",
  attachmentsHeading: "Supporting documents",
  attachmentReadiness: "{ready} of {total} required documents ready",
  attachmentNone: "No document attached.",
  attachmentRequired: "Needed before the request can be submitted.",
  attachmentRemove: "Remove document",
  attachmentChoose: "Choose a file",
  attachmentChooseReplacement: "Choose a replacement file",
  attachmentAllowed: "{types}, up to {size}.",
  attachmentUpload: "Add document",
  attachmentReplace: "Replace document",
  attachmentWrongType: "This file is not a {types}. Choose another file.",
  attachmentTooLarge: "This file is {size}. Choose one up to {limit}.",
  attachmentDownload: "Download {document}",
  attachmentNotRetainedTitle: "The file was not sent",
  attachmentNotRetained:
    "This browser could not keep a copy of the file for an exact retry, so it was not sent. Free some browser storage or use another browser, then try again.",
  attachmentStopWaiting:
    "I have checked the documents; stop waiting for this upload",
  attachmentFileLost:
    "This browser no longer holds the exact file, so it cannot be sent again. Check the documents on this request before adding it again.",
  attachmentFileLine: "{type}, {size}, added {date}",
  attachmentFileLineUndated: "{type}, {size}",
  fileSizeKilobytes: "{size} KB",
  fileSizeMegabytes: "{size} MB",
  documentView: "View {document}",
  documentSelected:
    "Selected: {name} ({type}, {size}). Choose Add document to save it.",
  documentSelectedReplacement:
    "Selected: {name} ({type}, {size}). Choose Replace document to save it.",

  addGroupItem: "Add item",
  removeGroupItem: (index) => `Remove item ${index}`,
  groupItemLegend: (index) => `Item ${index}`,
};

const BlockContentContext = createContext<BlockContent>(blockContent);

export function BlockContentProvider({
  content,
  children,
}: {
  content: BlockContent;
  children: ReactNode;
}) {
  return (
    <BlockContentContext.Provider value={content}>
      {children}
    </BlockContentContext.Provider>
  );
}

export function useBlockContent(): BlockContent {
  return useContext(BlockContentContext);
}
