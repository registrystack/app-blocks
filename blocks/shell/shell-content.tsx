import { createContext, useContext, type ReactNode } from "react";

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
  /**
   * Words for a casework state, by its code; an apply item's state is looked
   * up as `apply:<state>` first (`workItemStateKeys`).
   */
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
  conflictTitle: string;
  conflictBody: string;
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
  loginAccess: string;
  loginUnavailable: string;
  recoveryTitle: string;
  previousContextBody: string;
}

export const shellContent: ShellContent = {
  loading: "Loading…",
  unknownStatus: "Status not available",
  // A Casework work item's states, then an apply item's where they differ,
  // then its due states: the same words as `caseworkContent.stateLabels`,
  // which words them everywhere else. `cancelled` is left to the model, as a
  // request state; the item page header takes the Casework word for it.
  stateLabels: {
    open: "Waiting for review",
    claimed: "In review",
    synchronizing: "Updating",
    "waiting-applicant": "Waiting for applicant",
    "waiting-application": "Waiting to apply",
    completed: "Completed",
    superseded: "Superseded",
    "apply:open": "Ready to apply",
    "apply:claimed": "Ready to apply",
    "apply:waiting-application": "Not ready to apply",
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
  conflictTitle: "This conflicts with the current record",
  conflictBody: "This action is no longer available. The request has moved on.",
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
  loginAccess: "You do not have access to this service.",
  loginUnavailable: "Sign-in is temporarily unavailable.",
  recoveryTitle: "A previous submission needs checking",
  previousContextBody:
    "You have an earlier submission whose result was not confirmed.",
};

const ShellContentContext = createContext<ShellContent>(shellContent);

export function ShellContentProvider({
  content,
  children,
}: {
  content: ShellContent;
  children: ReactNode;
}) {
  return (
    <ShellContentContext.Provider value={content}>
      {children}
    </ShellContentContext.Provider>
  );
}

export function useShellContent(): ShellContent {
  return useContext(ShellContentContext);
}
