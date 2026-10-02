import { useCallback, useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import { FileCheck2, HelpCircle, Inbox, Library, Users } from "lucide-react";
import type {
  AuthenticatedSession,
  EntityModel,
  RegistryModel,
} from "@registrystack/app-runtime";
import { useAuthority, useModel } from "@registrystack/app-runtime/react";
import { unavailableError } from "@registrystack/app-runtime";
import { ReferenceHrefProvider } from "@/blocks/fields/reference-value";
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
import { RecordActionPage } from "@/blocks/pages/record-action-page";
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
import {
  entityRoutes,
  recordPath,
  registerEntities,
  useRegister,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { listRoute } from "@/blocks/pages/record-route-query";
import { RecordDetailPage } from "@/blocks/pages/record-detail-page";
import { RecordListPage } from "@/blocks/pages/record-list-page";
import {
  matchEntityRoute,
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

/**
 * The record entities the model offers as places: one nav item each, in the
 * model's order, and whether the register has requests to offer beside them.
 * No items means the model names no places and the labels name the one place.
 */
interface RecordPlaces {
  items: NavItem[];
  hasRequests: boolean;
}

/** The record entities the model names as places that the session reads, in the model's order. */
function placeEntities(
  entities: RegisterEntities | null,
  model: RegistryModel | undefined,
): EntityModel[] {
  const places = model?.places;
  if (!entities?.records || !places) return [];
  const records = entities.records;
  return places.flatMap((id) => records.filter((entity) => entity.id === id));
}

/** One nav item per record entity place, each on its own list route. */
function recordPlaces(
  routes: RegisterRoutes,
  entities: RegisterEntities | null,
  model: RegistryModel | undefined,
): RecordPlaces {
  const items = placeEntities(entities, model).flatMap((entity) => {
    const at = entities && entityRoutes(routes, entities, entity.id);
    return at
      ? [{ path: at.records, label: entity.pluralLabel, icon: Library }]
      : [];
  });
  return { items, hasRequests: Boolean(entities?.followedRequest) };
}

/**
 * The route the root stands for when the model names where a session opens:
 * its `home` list, else the first place. Null where it names neither, and for
 * a casework session, which opens on its own inbox.
 */
export function modelHomeRoute(
  session: AuthenticatedSession,
  routes: RegisterRoutes,
  entities: RegisterEntities | null,
  model: RegistryModel | undefined,
): string | null {
  if (session.caseworkProfile || !entities) return null;
  const home = model?.home;
  const at = home && entityRoutes(routes, entities, home.entity);
  if (home && at) return listRoute(at.records, { filters: home.filters });
  const first = placeEntities(entities, model)[0];
  return first ? (entityRoutes(routes, entities, first.id)?.records ?? null) : null;
}

/**
 * Where the root sends a session, or null to stay. Nothing is decided while
 * the model is still being read, so a reviewer is not sent to a queue the
 * model's home would have replaced. Without a model home, a reviewer goes to
 * the request queue where the register has requests, or where no model could
 * be read.
 */
export function rootRedirect(
  session: AuthenticatedSession,
  routes: RegisterRoutes,
  entities: RegisterEntities | null,
  model: RegistryModel | undefined,
  pending: boolean,
): string | null {
  if (pending) return null;
  const home = modelHomeRoute(session, routes, entities, model);
  if (home) return home;
  return session.role === "reviewer" &&
    !session.caseworkProfile &&
    (!entities || entities.followedRequest)
    ? routes.requests
    : null;
}

/** The places a session can go, grouped by the dividers between them. */
function placesFor(
  session: AuthenticatedSession,
  casework: CaseworkContent,
  labels: StaffAppLabels,
  routes: RegisterRoutes,
  record: RecordPlaces,
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
      record.items.length > 0
        ? record.items
        : [{ path: routes.records, label: recordsLabel, icon: Library }],
      [help],
    ];
  }
  if (record.items.length > 0) {
    const requests: NavItem[] = record.hasRequests
      ? [
          {
            path: routes.requests,
            label:
              session.role === "reviewer" ? labels.reviewQueue : labels.requests,
            icon: FileCheck2,
          },
        ]
      : [];
    return [
      session.role === "reviewer"
        ? [...requests, ...record.items]
        : [...record.items, ...requests],
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
function homeOf(
  session: AuthenticatedSession,
  routes: RegisterRoutes,
  modelHome: string | null,
): string {
  if (session.caseworkProfile === "administrator") return "/casework/setup";
  if (session.caseworkProfile) return "/casework";
  if (modelHome) return splitRoute(modelHome).path;
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
  // The model is read here, not through `useRegister`, so an app that names
  // its labels reads nothing it does not use.
  const modelRead = useModel();
  const model = modelRead.data;
  const entities = useMemo(
    () => (model ? registerEntities(model.entities) : null),
    [model],
  );
  const modelHome = modelHomeRoute(session, routes, entities, model);
  // One page, one URL: the home the model names, or else the reviewer's
  // request queue, is reached by redirect instead of rendering the same page
  // twice in history.
  const redirect = rootRedirect(
    session,
    routes,
    entities,
    model,
    modelRead.isPending,
  );
  useEffect(() => {
    if (path === "/" && redirect) navigate(redirect);
  }, [path, redirect]);
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const match = matchRegisterRoute(routes, path);
  const entityMatch = matchEntityRoute(routes, path);
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
      ) : modelHome || session.role === "reviewer" ? null : (
        <RecordListPage />
      );
  else if (match.kind === "records") page = <RecordListPage />;
  else if (path === "/help") page = <HelpPage />;
  else if (match.kind === "createRecord")
    page = <CreateRecordPage useTask={useCreateTask} />;
  else if (match.kind === "recordAction")
    page = <RecordActionPage actionId={match.id} useTask={useCreateTask} />;
  else if (match.kind === "action")
    page = (
      <RecordActionPage
        actionId={match.actionId}
        recordId={match.id}
        useTask={useCreateTask}
      />
    );
  else if (entityMatch.kind === "entityRecords")
    page = <RecordListPage entity={entityMatch.entity} />;
  else if (entityMatch.kind === "entityCreateRecord")
    page = (
      <CreateRecordPage entity={entityMatch.entity} useTask={useCreateTask} />
    );
  else if (entityMatch.kind === "entityRecordAction")
    page = (
      <RecordActionPage
        entity={entityMatch.entity}
        actionId={entityMatch.actionId}
        useTask={useCreateTask}
      />
    );
  else if (entityMatch.kind === "entityAction")
    page = (
      <RecordActionPage
        entity={entityMatch.entity}
        actionId={entityMatch.actionId}
        recordId={entityMatch.id}
        useTask={useCreateTask}
      />
    );
  else if (entityMatch.kind === "entityRecord")
    page = <RecordDetailPage entity={entityMatch.entity} id={entityMatch.id} />;
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
    () =>
      placesFor(
        session,
        casework,
        props.labels,
        routes,
        recordPlaces(routes, entities, model),
      ),
    [session, casework, props.labels, routes, entities, model],
  );
  // A record a field refers to opens on its own page where the app has one.
  const referenceHref = useCallback(
    (entity: string, id: string) => {
      const target = entities && recordPath(routes, entities, entity, id);
      return target ? `#${target}` : null;
    },
    [entities, routes],
  );
  return (
    <WorkFrame
      displayName={session.displayName}
      brand={shell.brand}
      groups={groups}
      homePath={homeOf(session, routes, modelHome)}
      route={route}
    >
      {props.recoveryNotice === undefined ? <RecoveryNotice /> : props.recoveryNotice}
      {props.pendingUploadsNotice === undefined ? <PendingUploadsNotice /> : props.pendingUploadsNotice}
      {props.workItemPendingNotice === undefined ? <WorkItemPendingNotice /> : props.workItemPendingNotice}
      <StaffingPendingNotice />
      <ReferenceHrefProvider href={referenceHref}>
        <div key={route}>{page}</div>
      </ReferenceHrefProvider>
    </WorkFrame>
  );
}

/**
 * A staff register work app: the work shell's places, the register's own
 * record and request pages, the pages of every other record entity under
 * `routes.entity`, and Casework's inbox, item, holdings, setup, reviews and
 * review pages. A model that names `places` gets one nav item per place, and
 * one that names a `home` or places opens there; a register with no request
 * entity offers no requests place. It takes no register nouns of its own;
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
