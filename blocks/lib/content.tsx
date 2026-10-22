import { createContext, useContext, useMemo } from "react";

/**
 * The wording an app sets, by area. Each area's hook reads its own entry and
 * falls back to its defaults; `ContentProvider` is the one place that fills
 * this in.
 */
export const ContentContext = createContext<Record<string, unknown>>({});

/**
 * The texts the session's UI model sets for the kit's wording, by message id
 * (`<area>.<key>`), in the session's language. They stand over the app's own
 * wording; `ContentProvider` fills this in from the model.
 */
export const MessagesContext = createContext<Readonly<Record<string, string>>>(
  {},
);

/**
 * The locale blocks format dates, numbers and lists in: the session's language
 * as `ModelMessages` sets it, else the kit's English, which is British English.
 */
export const LocaleContext = createContext("en-GB");

/** The locale to pass a formatter, so its dates and numbers read like the words around them. */
export function useLocale(): string {
  return useContext(LocaleContext);
}

/**
 * `node` with the text at `path` replaced, or added under a map of words
 * (an object of words below the area's own), copying only the objects along
 * the path. The rest of a path a map does not divide is one key, since the
 * ids an app chooses, such as a file type, may hold dots.
 */
function withText(
  node: unknown,
  path: string[],
  text: string,
  depth = 0,
): unknown {
  if (!node || typeof node !== "object") return node;
  const record = node as Record<string, unknown>;
  const [key, ...rest] = path;
  const child = record[key!];
  if (rest.length && Object.hasOwn(record, key!) && typeof child === "object") {
    const next = withText(child, rest, text, depth + 1);
    return next === child ? node : { ...record, [key!]: next };
  }
  const whole = path.join(".");
  const words =
    depth > 0 &&
    Object.values(record).every((value) => typeof value === "string");
  if (
    record[whole] === text ||
    (Object.hasOwn(record, whole) ? typeof record[whole] !== "string" : !words)
  )
    return node;
  return { ...record, [whole]: text };
}

/**
 * An area's wording with the model's texts set over it. Only the ids under
 * the area apply, and only to words that are text or to a key of a map of
 * words; the wording given is not changed, and is returned as it is when no
 * text applies.
 */
export function withMessages<T>(
  area: string,
  content: T,
  messages: Readonly<Record<string, string>>,
): T {
  const prefix = `${area}.`;
  return Object.entries(messages)
    .filter(([id]) => id.startsWith(prefix))
    .reduce(
      (words, [id, text]) =>
        withText(words, id.slice(prefix.length).split("."), text) as T,
      content,
    );
}

/** One area's wording from the nearest `ContentProvider`, else its `defaults`, under the model's texts. */
export function useContentArea<T>(area: string, defaults: T): T {
  const content = (useContext(ContentContext)[area] as T | undefined) ?? defaults;
  const messages = useContext(MessagesContext);
  return useMemo(
    () => withMessages(area, content, messages),
    [area, content, messages],
  );
}

/**
 * The words blocks show on their own: generic defaults an app replaces with
 * its own content through `ContentProvider`.
 */
export interface BlockContent {
  notRecorded: string;
  /** The heading that opens a quantity's unit scheme. */
  quantityUnitStandard: string;
  /** The heading that opens the full URI behind a value read as words. */
  fullIdentifier: string;
  yes: string;
  no: string;
  notSupplied: string;
  /** A label and its value read on one line, as in "Receipt: R-1". */
  labelled: string;
  /** `labelled` as a sentence of its own. */
  labelledSentence: string;
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
  /** A filter select's choice that applies no filter. */
  filterAll: string;
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
  /** A decimal answer with more places than the registry keeps; `{places}` is how many it keeps. */
  decimalPlacesError: string;
  /** A decimal answer the registry keeps without places. */
  wholeNumberError: string;
  /** A number below its declared minimum, `{limit}`. */
  minimumError: string;
  /** A number above its declared maximum, `{limit}`. */
  maximumError: string;
  /** Coordinate labels for a CRS84 point, whose order is longitude then latitude. */
  longitudeLabel: string;
  latitudeLabel: string;

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
  /** Why a confirmed write keeps its exact registry reference. */
  receiptHelp: string;
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
  /** The comparison shown when a save is refused because the record changed since it was read. */
  conflictTitle: string;
  conflictBody: string;
  conflictFieldColumn: string;
  conflictStartedColumn: string;
  conflictMineColumn: string;
  conflictLatestColumn: string;
  /** Said in words on a field both the person and the registry changed to different values. */
  conflictBothChanged: string;
  conflictKeepMine: string;
  conflictTakeLatest: string;
  conflictKept: string;
  conflictTaken: string;
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
  /**
   * A verified answer's line: `{label}` is `prefillProposed` or
   * `prefillVerified`, `{answer}` is yes or no, and `{source}` and `{date}`
   * say who verified it and when.
   */
  prefillAnswerLine: string;
  /** A draft's retained evidence: its answer, and when it was verified. */
  prefillDraftLine: string;
  /** A submitted request's retained evidence, under the `prefillVerified` heading. */
  prefillSummaryLine: string;
  getVerifiedInformation: string;
  revisionNoNote: string;
  /** What an officer reads when the reviewer left the requester no note. */
  requesterNoNote: string;
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
  /** Shown when an uploaded file is empty even though its declared type is accepted. */
  attachmentEmpty: string;
  /** Shown when an uploaded file's bytes do not match its declared type. */
  attachmentContentMismatch: string;
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
  /** `{index}`: the item's position, from 1. */
  removeGroupItem?: string;
  /** `{index}`: the item's position, from 1. */
  groupItemLegend?: string;
  /** A repeatable group read in a link or a line of text, by its `{count}` of items. */
  groupEntryCount?: string;
  /**
   * Shown in place of a reference to a record that cannot be read or named.
   * Optional for the same reason; the reference value falls back to its own
   * default wording.
   */
  referenceUnavailable?: string;
  /** Under a reference picker that found no record to offer. */
  referenceNoMatch?: string;
  /** Under a reference picker whose records could not be read. */
  referenceLoadFailed?: string;
  /** The button that clears a chosen record so another can be picked. */
  referenceChange?: string;
  /** The first option of a reference picker that lists records to choose from. */
  referenceChoose?: string;
  /**
   * A record offered in a reference picker's list, by its `{title}` and the
   * `{detail}` that tells it apart from records with the same title.
   */
  referenceOption?: string;
  /** Loads the next authorized page of records in a reference picker. */
  referenceMore?: string;
  /** Restarts a paged reference picker at its authorized first page. */
  referenceRestart?: string;
  /** Finds one authorized record by an exact identifier. */
  referenceFind?: string;
  /** Explains that an exact lookup must succeed before its record can be chosen. */
  referenceLookupHint?: string;
  /** A neutral result for a missing, unreadable or refused exact record lookup. */
  referenceLookupUnavailable?: string;
  /** Names the identifier input of a reference picker that also offers lookup selectors. */
  referenceIdentifier?: string;
  /** Opens the identifier input of a reference picker that also offers lookup selectors, as a separate way in. */
  referenceIdentifierOther?: string;
  /** Sends a reference lookup again after the service did not answer it. */
  referenceRetry?: string;
  /** Shown when this session can neither list nor look up the target. */
  referenceSelectionUnavailable?: string;
}

export const blockContent: BlockContent = {
  notRecorded: "Not recorded",
  quantityUnitStandard: "Unit standard",
  fullIdentifier: "Full identifier",
  yes: "Yes",
  no: "No",
  notSupplied: "Not supplied",
  labelled: "{label}: {value}",
  labelledSentence: "{label}: {value}.",
  optional: "optional",
  selectOption: "Choose an option",
  errorPrefix: "Error:",
  loading: "Loading…",
  choicesHint: "Select all that apply.",
  blankValues: {},
  terms: {},

  search: "Search",
  clearSearch: "Clear search",
  filterAll: "All",
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
  decimalPlacesError:
    "Enter a number with no more than {places, plural, one {# decimal place} other {# decimal places}}.",
  wholeNumberError: "Enter a whole number.",
  minimumError: "Enter {limit} or more.",
  maximumError: "Enter {limit} or less.",
  longitudeLabel: "Longitude",
  latitudeLabel: "Latitude",

  saving: "Sending…",
  unknownTitle: "We could not confirm the result",
  unknownBody:
    "Your request may have reached the registry. Do not start a replacement submission. You can retry this exact submission while its original session and authority remain available.",
  retryRefused:
    "The service refused this retry. The earlier submission outcome is still not confirmed.",
  receipt: "Support reference",
  receiptHelp:
    "Keep this reference if you need help finding this change in the registry.",
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
  conflictTitle: "This record changed while you had it open",
  conflictBody:
    "Nothing was saved. Compare what you began with, what you entered and what the registry holds now, then choose which to keep. Your entry is not combined with the latest.",
  conflictFieldColumn: "Field",
  conflictStartedColumn: "What you began with",
  conflictMineColumn: "What you entered",
  conflictLatestColumn: "What it is now",
  conflictBothChanged: "Changed by both",
  conflictKeepMine: "Keep my entry",
  conflictTakeLatest: "Take the latest",
  conflictKept: "Your entry is kept. Save it again to send it against the latest version.",
  conflictTaken: "The latest values replace your entry. Review them, then save.",
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
  prefillAnswerLine: "{label}: {answer}. {source}, {date}.",
  prefillDraftLine: "{label}: {answer}. {date}.",
  prefillSummaryLine: "{answer}. {source}, {date}.",
  getVerifiedInformation: "Get verified information",
  revisionNoNote: "The reviewer did not leave a note for you.",
  requesterNoNote: "The reviewer did not leave a note for the requester.",
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
  attachmentEmpty: "This file is empty. Choose another file.",
  attachmentContentMismatch:
    "This file's contents do not match its type. Choose another file.",
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
  removeGroupItem: "Remove item {index}",
  groupItemLegend: "Item {index}",
  groupEntryCount: "{count, plural, one {# item} other {# items}}",
  referenceUnavailable: "A record that could not be read",
  referenceNoMatch: "No matching records",
  referenceLoadFailed: "The records could not be read",
  referenceChange: "Choose a different record",
  referenceChoose: "Choose a record",
  referenceOption: "{title} ({detail})",
  referenceMore: "Show more records",
  referenceRestart: "Start choices again",
  referenceFind: "Find record",
  referenceLookupHint:
    "Enter the record identifier, then find the record before choosing it.",
  referenceLookupUnavailable: "No record is available for that identifier.",
  referenceIdentifier: "Record identifier",
  referenceIdentifierOther: "Or, if you have the record identifier",
  referenceRetry: "Try again",
  referenceSelectionUnavailable:
    "No records are available to choose with this account.",
};

export function useBlockContent(): BlockContent {
  return useContentArea("block", blockContent);
}

/** A confirmed write's exact registry reference, kept as secondary support detail. */
export function ConfirmedReceipt({ receipt }: { receipt: string }) {
  const c = useBlockContent();
  return (
    <details className="reference">
      <summary>{c.receipt}</summary>
      <p>{c.receiptHelp}</p>
      <p className="font-mono">{receipt}</p>
    </details>
  );
}
