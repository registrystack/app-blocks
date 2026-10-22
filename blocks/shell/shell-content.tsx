import { useContentArea } from "@/blocks/lib/content";

/**
 * The words the shell blocks show on their own: generic defaults an app
 * replaces with its own content through `ShellContentProvider`. These cover
 * the chrome around a session (the header, the sidebar, the public pages
 * before sign-in) and the small pieces most pages reach for (loading, an
 * error, a status badge).
 */
export interface ShellContent {
  /** Shown while a block waits on data it cannot yet render. */
  loading: string;
  /** Shown on a status badge whose code has no label. */
  unknownStatus: string;
  /** Words for a casework state, by its code. */
  stateLabels: Readonly<Record<string, string>>;
  /** Words for a recorded, post-decision status, by its code. */
  recordedStatuses: Readonly<Record<string, string>>;

  // ErrorPanel: a problem's title and body, by the kind `problemView` gives it.
  serviceUnavailable: string;
  serviceUnavailableBody: string;
  unknownTitle: string;
  caseworkRefusedTitle: string;
  /** A Casework refusal for an account with no registry profile to review with. */
  sourceProfileRequired: string;
  unavailable: string;
  unavailableBody: string;
  staleTitle: string;
  staleBody: string;
  /** A write the registry refused because the action is not allowed for the record as it is now. */
  actionUnavailableTitle: string;
  actionUnavailableBody: string;
  conflictTitle: string;
  conflictBody: string;
  /** A record write the registry refused because its values clash with a record or rule in place. */
  valuesConflictTitle: string;
  valuesConflictBody: string;
  /** Submitted values the registry could not accept as they stand. */
  invalidTitle: string;
  invalidBody: string;
  refusedTitle: string;
  refusedBody: string;
  /** Heads a write the registry refused in its own words, which follow as the body. */
  registryRefusedTitle: string;
  /** A create the registry refused because it falls outside the caller's row boundary. */
  outsideBoundaryBody: string;
  contractChangedTitle: string;
  contractChangedBody: string;
  expiredTitle: string;
  expiredBody: string;
  capacityTitle: string;
  capacityBody: string;
  receipt: string;
  /** "{label}: {value}": the support reference line, `{label}` being `receipt` and `{value}` the reference. */
  receiptLine: string;
  /** Says what the support reference under a problem is for. */
  receiptHelp: string;
  retry: string;

  // The signed-in chrome: the skip link, the header, the sidebar landmark.
  navMain: string;
  skip: string;
  brand: string;
  beta: string;
  signedInAs: string;
  staffName: string;
  serviceName: string;
  offline: string;
  footer: string;
  footerNote: string;
  help: string;
  staffEntryLink: string;
  serviceEntryLink: string;
  signOut: string;
  switchAccount: string;
  /** Names the choice of the language the app is read in; each language is named in itself. */
  language: string;
  /** A link back to an enclosing page, worded generically for any register. */
  back: string;

  // The public pages before sign-in.
  introduction: string;
  staffIntroduction: string;
  introBody: string;
  staffIntroBody: string;
  /** A policy note under the introduction; the generic default leaves it blank. */
  introScope: string;
  serviceAccess: string;
  staffAccess: string;
  signIn: string;
  helpTitle: string;
  helpBody: string;
  helpReference: string;
  helpRecovery: string;
  loginFailureTitle: string;
  loginUnmapped: string;
  loginExpired: string;
  loginAccess: string;
  loginUnavailable: string;
  recoveryTitle: string;
  previousContextBody: string;
}

export const shellContent: ShellContent = {
  loading: "Loading…",
  unknownStatus: "Status not available",
  // A Casework review task's open state, then its due states: the same words
  // as `caseworkContent.stateLabels`, which words them everywhere else.
  stateLabels: {
    open: "Waiting for review",
    "on-track": "On track",
    "at-risk": "Due soon",
    overdue: "Overdue",
  },
  recordedStatuses: {},

  serviceUnavailable: "We could not load this page",
  serviceUnavailableBody:
    "Try again in a moment. If this keeps happening, contact support.",
  unknownTitle: "We could not confirm the result",
  caseworkRefusedTitle: "This action could not be completed",
  sourceProfileRequired:
    "This account is not set up to review requests here. Ask whoever manages accounts for this service to set it up.",
  unavailable: "This is unavailable",
  unavailableBody:
    "It may have been removed, or you may not have access to it.",
  staleTitle: "This changed before the action completed",
  staleBody: "Reload the page to see what changed, then try again.",
  actionUnavailableTitle: "This action is not available for this record now",
  actionUnavailableBody: "Reload the page to see the current state of the record.",
  conflictTitle: "This conflicts with the current record",
  conflictBody: "This action is no longer available. The request has moved on.",
  valuesConflictTitle: "The registry did not accept these values",
  valuesConflictBody:
    "They clash with a record or rule already in place. Check the values and try again.",
  invalidTitle: "Check your answers",
  invalidBody:
    "The registry could not accept these values. Check them and try again.",
  refusedTitle: "This action is not available here",
  refusedBody: "Reload the page to see its current state.",
  registryRefusedTitle: "The registry did not accept this",
  outsideBoundaryBody:
    "You cannot create this record. It is outside the records you may change.",
  contractChangedTitle: "The service has changed since you signed in",
  contractChangedBody: "Sign in again to pick up the change.",
  expiredTitle: "Your session has ended",
  expiredBody: "Sign in again to continue.",
  capacityTitle: "The service is busy",
  capacityBody: "Try again shortly.",
  receipt: "Support reference",
  receiptLine: "{label}: {value}",
  receiptHelp:
    "Quote this reference if you contact support about this problem.",
  retry: "Try again",

  navMain: "Main",
  skip: "Skip to main content",
  brand: "Registry",
  beta: "BETA",
  signedInAs: "Signed in as",
  staffName: "Staff",
  serviceName: "Service",
  offline:
    "You are offline. Some actions are unavailable until the connection returns.",
  footer: "Registry",
  footerNote: "Test service.",
  help: "Help and support",
  staffEntryLink: "Staff service",
  serviceEntryLink: "Public service",
  signOut: "Sign out",
  switchAccount: "Switch account",
  language: "Language",
  back: "Back",

  introduction: "Welcome",
  staffIntroduction: "Welcome",
  introBody: "Sign in to continue.",
  staffIntroBody: "Sign in to continue.",
  introScope: "",
  serviceAccess: "Use the account linked to your records.",
  staffAccess: "Use your authorized account.",
  signIn: "Sign in",
  helpTitle: "Help",
  helpBody: "Contact support if you need help with this service.",
  helpReference:
    "Keep any support reference you were given; it helps us find your request.",
  helpRecovery:
    "If a submission's result is unclear, do not repeat it as a new request. Use the retry offered on that request instead.",
  loginFailureTitle: "We could not complete sign-in",
  loginUnmapped: "Your account is not recognized by this service.",
  loginExpired: "Your sign-in took too long and has expired. Sign in again.",
  loginAccess: "You do not have access to this service.",
  loginUnavailable: "Sign-in is temporarily unavailable.",
  recoveryTitle: "A previous submission needs checking",
  previousContextBody:
    "You have an earlier submission whose result was not confirmed.",
};

export function useShellContent(): ShellContent {
  return useContentArea("shell", shellContent);
}
