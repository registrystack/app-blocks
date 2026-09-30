import { useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import { FileCheck2, HelpCircle, Inbox, Library, Users } from "lucide-react";
import type { AuthenticatedSession } from "@registrystack/app-runtime";
import { useAuthority } from "@registrystack/app-runtime/react";
import { unavailableError } from "@registrystack/app-runtime";
import { BackLink } from "@/blocks/shell/back-link";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { HelpPage } from "@/blocks/shell/help-page";
import { Introduction } from "@/blocks/shell/introduction";
import { PublicShell } from "@/blocks/shell/public";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { useShellContent } from "@/blocks/shell/shell-content";
import { WorkFrame } from "@/blocks/shell/work-frame";
import type { NavGroup, NavItem } from "@/blocks/casework/work-shell";
import {
  caseworkContent,
  useCaseworkContent,
  type CaseworkContent,
} from "@/blocks/casework/casework-content";
import {
  CaseworkReviewPage,
  CaseworkReviewsPage,
} from "@/blocks/pages/casework-review";
import { CaseworkSetupPage } from "@/blocks/pages/casework-setup";
import { StaffingPendingNotice } from "@/blocks/pages/casework-staffing";
import { ChangeRequestFormPage, type ChangeRequestTask } from "@/blocks/pages/change-request-form-page";
import { CreateRecordPage, type CreateRecordTask } from "@/blocks/pages/create-record-page";
import {
  DefaultCaseworkHoldingsPage,
  DefaultCaseworkInboxPage,
  DefaultCaseworkItemPage,
  WorkItemPendingNotice,
  type TaskHeading,
} from "@/blocks/pages/default-casework";
import {
  PendingUploadsNotice,
  RecoveryNotice,
} from "@/blocks/pages/default-notices";
import * as defaultTasks from "@/blocks/pages/default-tasks";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegister } from "@/blocks/pages/record";
import { RecordDetailPage } from "@/blocks/pages/record-detail-page";
import { RecordListPage } from "@/blocks/pages/record-list-page";
import {
  matchRegisterRoute,
  useRegisterRoutes,
  type RegisterRoutes,
} from "@/blocks/pages/register-routes";
import { RequestDetailPage, type RequestDecisionTask } from "@/blocks/pages/request-detail-page";
import { RequestQueuePage } from "@/blocks/pages/request-queue-page";
import { SessionBoundary } from "@/blocks/shell/session-boundary";
import type { DocumentSource } from "@/blocks/documents/document-view";
import type { RemovalOutcome } from "@/blocks/pages/record-attachments";
import type { UploadOutcome } from "@/blocks/request/attachment-slots";

/** Labels the register's own staff app names its records and requests places with. */
export interface StaffAppLabels {
  records: string;
  requests: string;
  /** The requests place's label for a reviewer, who works the queue rather than "their own" requests. */
  reviewQueue: string;
}

/**
 * Every part an app may bind itself. Each one it leaves out is the blocks'
 * own: the nav names its places by the model's plural labels, the pages use
 * `@/blocks/pages/default-tasks`, the notices come from
 * `@/blocks/pages/default-notices` and `@/blocks/pages/default-casework`, and
 * the Casework pages are that file's defaults, handed `taskHeading` and
 * `openPdf`. A notice passed as `null` or `false` renders none.
 */
export interface StaffAppProps {
  labels?: StaffAppLabels;
  /** What each Casework item asks of the officer, for the default Casework pages. */
  taskHeading?: TaskHeading;
  useCreateTask?: () => CreateRecordTask;
  useChangeTask?: () => ChangeRequestTask;
  useRequestTask?: () => RequestDecisionTask;
  useUpload?: (slot: string) => UploadOutcome;
  useRemoval?: (slot: string) => RemovalOutcome;
  openPdf?: (bytes: ArrayBuffer, signal: AbortSignal) => Promise<DocumentSource>;
  /**
   * The officer's own visible work. Left out, it is `DefaultCaseworkInboxPage`
   * from `@/blocks/pages/default-casework`, headed by `taskHeading`.
   */
  inboxPage?: ComponentType;
  /**
   * One casework item. Left out, it is `DefaultCaseworkItemPage` from
   * `@/blocks/pages/default-casework`, handed `taskHeading` and `openPdf`.
   */
  itemPage?: ComponentType<{ id: string }>;
  /**
   * The supervisor's team page. Left out, it is `DefaultCaseworkHoldingsPage`
   * from `@/blocks/pages/default-casework`, headed by `taskHeading`.
   */
  holdingsPage?: ComponentType;
  /**
   * Rendered ahead of the page on every route. Left out, it is
   * `RecoveryNotice` from `@/blocks/pages/default-notices`; `null` or
   * `false` renders none.
   */
  recoveryNotice?: ReactNode;
  /**
   * Rendered ahead of the page on every route. Left out, it is
   * `PendingUploadsNotice` from `@/blocks/pages/default-notices`; `null` or
   * `false` renders none.
   */
  pendingUploadsNotice?: ReactNode;
  /**
   * Rendered ahead of the page on every route. Left out, it is
   * `WorkItemPendingNotice` from `@/blocks/pages/default-casework`; `null` or
   * `false` renders none.
   */
  workItemPendingNotice?: ReactNode;
}

/** The places a session can go, grouped by the dividers between them. */
function placesFor(
  session: AuthenticatedSession,
  casework: CaseworkContent,
  labels: StaffAppLabels,
  routes: RegisterRoutes,
): NavGroup[] {
  const help: NavItem = { path: "/help", label: casework.navHelp, icon: HelpCircle };
  const profile = session.caseworkProfile;
  if (profile === "administrator")
    return [
      [{ path: "/casework/setup", label: casework.navSetup, icon: FileCheck2 }],
      [help],
    ];
  if (profile) {
    const work: NavGroup = [
      { path: "/casework", label: casework.navInbox, icon: Inbox },
    ];
    if (profile === "supervisor")
      work.push({
        path: "/casework/holdings",
        label: casework.navTeam,
        icon: Users,
        under: ["/casework/queues"],
      });
    // The records place carries the name a registrar's nav and the records
    // page give it, unless the app's own content words it.
    const recordsLabel =
      casework.navRecords === caseworkContent.navRecords
        ? labels.records
        : casework.navRecords;
    return [
      work,
      [{ path: routes.records, label: recordsLabel, icon: Library }],
      [help],
    ];
  }
  const records: NavItem = {
    path: session.role === "reviewer" ? routes.records : "/",
    label: labels.records,
    icon: Library,
    under: [routes.records],
  };
  const requests: NavItem = {
    path: routes.requests,
    label: session.role === "reviewer" ? labels.reviewQueue : labels.requests,
    icon: FileCheck2,
  };
  return [
    session.role === "reviewer" ? [requests, records] : [records, requests],
    [help],
  ];
}

/** The place the root route stands for, so it is marked current there. */
function homeOf(session: AuthenticatedSession, routes: RegisterRoutes): string {
  if (session.caseworkProfile === "administrator") return "/casework/setup";
  if (session.caseworkProfile) return "/casework";
  return session.role === "reviewer" ? routes.requests : "/";
}

/**
 * The places named by the model's plural labels, and by the pages' own titles
 * while the model is not read yet; the reviewer's queue is always named as
 * that page is.
 */
function ModelLabelledStaffApp(props: StaffAppProps) {
  const pages = usePagesContent();
  const entities = useRegister().entities;
  const records = entities?.record.pluralLabel ?? pages.recordListTitle;
  const requests = entities?.request?.pluralLabel ?? pages.requestListTitle;
  const labels = useMemo(
    () => ({ records, requests, reviewQueue: pages.queueTitle }),
    [records, requests, pages.queueTitle],
  );
  return <StaffWork {...props} labels={labels} />;
}

function ProtectedStaffApp(props: StaffAppProps) {
  return props.labels ? (
    <StaffWork {...props} labels={props.labels} />
  ) : (
    <ModelLabelledStaffApp {...props} />
  );
}

function StaffWork(props: StaffAppProps & { labels: StaffAppLabels }) {
  const session = useAuthority();
  const route = useRoute();
  // A queue view carries its filters in the hash query string; the page is
  // decided by the path portion alone.
  const { path } = splitRoute(route);
  const routes = useRegisterRoutes();
  const casework = useCaseworkContent();
  const shell = useShellContent();
  // One page, one URL: the reviewer's home is the request queue only, so /
  // redirects there instead of rendering the same page twice in history.
  useEffect(() => {
    if (path === "/" && session.role === "reviewer" && !session.caseworkProfile)
      navigate(routes.requests);
  }, [path, session.caseworkProfile, session.role, routes.requests]);
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const match = matchRegisterRoute(routes, path);
  const useCreateTask = props.useCreateTask ?? defaultTasks.useCreateTask;
  const useChangeTask = props.useChangeTask ?? defaultTasks.useChangeTask;
  const useRequestTask = props.useRequestTask ?? defaultTasks.useRequestTask;
  const useUpload = props.useUpload ?? defaultTasks.useUpload;
  const useRemoval = props.useRemoval ?? defaultTasks.useRemoval;
  const InboxPage = props.inboxPage;
  const ItemPage = props.itemPage;
  const HoldingsPage = props.holdingsPage;
  const inbox = InboxPage ? (
    <InboxPage />
  ) : (
    <DefaultCaseworkInboxPage heading={props.taskHeading} />
  );
  let page: ReactNode;
  if (path === "/")
    page =
      session.role === "administrator" ? (
        <CaseworkSetupPage />
      ) : session.caseworkProfile ? (
        inbox
      ) : session.role === "reviewer" ? null : (
        <RecordListPage />
      );
  else if (match.kind === "records") page = <RecordListPage />;
  else if (path === "/help") page = <HelpPage />;
  else if (match.kind === "createRecord")
    page = <CreateRecordPage useTask={useCreateTask} />;
  else if (match.kind === "changeRecord")
    page = (
      <ChangeRequestFormPage recordId={match.id} useTask={useChangeTask} />
    );
  else if (match.kind === "record") page = <RecordDetailPage id={match.id} />;
  else if (match.kind === "requests") page = <RequestQueuePage />;
  else if (path === "/casework") page = inbox;
  else if (path === "/casework/holdings")
    page = HoldingsPage ? (
      <HoldingsPage />
    ) : (
      <DefaultCaseworkHoldingsPage heading={props.taskHeading} />
    );
  else if (path === "/casework/setup") page = <CaseworkSetupPage />;
  else if (path === "/casework/reviews") page = <CaseworkReviewsPage />;
  else if (
    parts[0] === "casework" &&
    parts[1] === "reviews" &&
    parts.length === 3
  )
    page = <CaseworkReviewPage taskId={parts[2]} />;
  else if (parts[0] === "casework" && parts.length === 2)
    page = ItemPage ? (
      <ItemPage id={parts[1]} />
    ) : (
      <DefaultCaseworkItemPage
        id={parts[1]}
        heading={props.taskHeading}
        openPdf={props.openPdf}
      />
    );
  else if (match.kind === "editRequest")
    page = (
      <ChangeRequestFormPage requestId={match.id} useTask={useChangeTask} />
    );
  else if (match.kind === "request")
    page = (
      <RequestDetailPage
        id={match.id}
        useTask={useRequestTask}
        useUpload={useUpload}
        useRemoval={useRemoval}
        openPdf={props.openPdf}
      />
    );
  else page = <ErrorPanel error={unavailableError(shell.unavailable)} />;
  const groups = useMemo(
    () => placesFor(session, casework, props.labels, routes),
    [session, casework, props.labels, routes],
  );
  return (
    <WorkFrame
      displayName={session.displayName}
      brand={shell.brand}
      groups={groups}
      homePath={homeOf(session, routes)}
      route={route}
    >
      {props.recoveryNotice === undefined ? <RecoveryNotice /> : props.recoveryNotice}
      {props.pendingUploadsNotice === undefined ? <PendingUploadsNotice /> : props.pendingUploadsNotice}
      {props.workItemPendingNotice === undefined ? <WorkItemPendingNotice /> : props.workItemPendingNotice}
      <StaffingPendingNotice />
      <div key={route}>{page}</div>
    </WorkFrame>
  );
}

/**
 * A staff register work app: the work shell's places, the register's own
 * record and request pages, and Casework's inbox, item, holdings, setup,
 * reviews and review pages. It takes no register nouns of its own;
 * `useRegisterRoutes()` supplies the register's paths and `labels`, or the
 * model without them, supplies the nav wording, so an app names both once
 * and this composes the rest.
 */
export function StaffApp(props: StaffAppProps) {
  const route = useRoute();
  return (
    <SessionBoundary
      audience="staff"
      introduction={
        splitRoute(route).path === "/help" ? (
          <StaffHelpIntroduction />
        ) : (
          <Introduction audience="staff" />
        )
      }
    >
      <ProtectedStaffApp {...props} />
    </SessionBoundary>
  );
}

function StaffHelpIntroduction() {
  const shell = useShellContent();
  return (
    <PublicShell audience="staff">
      <BackLink href="/">{shell.back}</BackLink>
      <HelpPage />
    </PublicShell>
  );
}
