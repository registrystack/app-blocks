import { Suspense, useCallback, useEffect, useMemo, type ReactNode } from "react";
import {
  ClipboardList,
  FileCheck2,
  HelpCircle,
  Library,
  Play,
  ScrollText,
  Users,
} from "lucide-react";
import type {
  AuthenticatedSession,
  EntityModel,
  RegistryModel,
} from "@registrystack/app-runtime";
import {
  useAuthority,
  useDashboard,
  useModel,
  useStarts,
} from "@registrystack/app-runtime/react";
import { unavailableError } from "@registrystack/app-runtime";
import {
  dashboardNavEntry,
  dashboardRoutes,
  useDashboardNav,
  type DashboardNavContext,
} from "@/blocks/dashboard/dashboard-routes";
import { ReferenceHrefProvider } from "@/blocks/fields/reference-value";
import { BackLink } from "@/blocks/shell/back-link";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { HelpPage } from "@/blocks/shell/help-page";
import { Introduction } from "@/blocks/shell/introduction";
import { PublicShell } from "@/blocks/shell/public";
import { Loading } from "@/blocks/shell/loading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { useShellContent } from "@/blocks/shell/shell-content";
import { WorkFrame } from "@/blocks/shell/work-frame";
import type { NavItem } from "@/blocks/casework/work-shell";
import {
  caseworkContent,
  useCaseworkContent,
  type CaseworkContent,
} from "@/blocks/casework/casework-content";
import {
  dashboardLanding,
  landingPath,
  workKind,
} from "@/blocks/pages/casework-landing";
import {
  entityPath,
  exactPath,
  navGroups,
  registerPath,
  renderRoute,
  route,
  type AppParts,
  type AppRoute,
  type NavEntry,
  type NavTable,
} from "@/blocks/pages/app-routes";
import type { ChangeRequestTask } from "@/blocks/pages/change-request-form-page";
import type { CreateRecordTask } from "@/blocks/pages/create-record-page";
import {
  PendingUploadsNotice,
  RecoveryNotice,
} from "@/blocks/pages/default-notices";
import * as defaultTasks from "@/blocks/pages/default-tasks";
import { usePagesContent } from "@/blocks/pages/pages-content";
import {
  entityRoutes,
  navigationRequests,
  recordPath,
  registerEntities,
  useRegister,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { listRoute } from "@/blocks/pages/record-route-query";
import {
  listsRecords,
  matchStartRoute,
  opensOnStarts,
  startsPath,
  unlistedStarts,
} from "@/blocks/pages/start-places";
import {
  CaseworkHowReviewWorksPage,
  CaseworkMyDecisionsPage,
  CaseworkReviewPage,
  CaseworkReviewsPage,
  CaseworkSetupPage,
  CaseworkStaffingPage,
  CaseworkTeamReviewsPage,
  ChangeRequestFormPage,
  CreateRecordPage,
  RecordActionPage,
  RecordDetailPage,
  RecordListPage,
  RequestDetailPage,
  RequestQueuePage,
  ReviewDecisionPendingNotice,
  StaffingPendingNotice,
  StartPage,
} from "@/blocks/pages/lazy-pages";
import {
  decodeSegment,
  useRegisterRoutes,
  type RegisterRoutes,
} from "@/blocks/pages/register-routes";
import type { RequestDecisionTask } from "@/blocks/pages/request-detail-page";
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
 * `@/blocks/pages/default-tasks`, and the notices come from
 * `@/blocks/pages/default-notices`. A notice passed as `null` or `false`
 * renders none.
 */
export interface StaffAppProps {
  labels?: StaffAppLabels;
  useCreateTask?: () => CreateRecordTask;
  useChangeTask?: () => ChangeRequestTask;
  useRequestTask?: () => RequestDecisionTask;
  useUpload?: (slot: string) => UploadOutcome;
  useRemoval?: (slot: string) => RemovalOutcome;
  openPdf?: (bytes: ArrayBuffer, signal: AbortSignal) => Promise<DocumentSource>;
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
  /** The pages, tried in order; left out, `staffRoutes`. */
  routes?: readonly AppRoute[];
  /** The places in the nav; left out, `staffNavigation`. */
  navigation?: NavTable<StaffNavContext, NavItem>;
}

/**
 * The record entities the model offers as places: one nav item each, in the
 * model's order, and whether the register has requests to offer beside them.
 * No items means the labels name the one place: the only record entity
 * offered is the register's own, or the model names places it reads none of.
 * `found` holds the places a session that opens on the start place keeps:
 * each one it may open a record of or look one up in, on its own route, the
 * register's own included.
 */
interface RecordPlaces {
  items: NavItem[];
  found: NavItem[];
  hasRequests: boolean;
}

/**
 * The start place's nav item, when the session has starts no record list
 * offers or opens on the start place, and whether it opens there, in which
 * case the records place keeps only the pages that find a record, since the
 * session would be refused a list.
 */
interface StartPlace {
  items: NavItem[];
  landing: boolean;
}

/**
 * The record entities the staff app offers as places, in the model's order:
 * the ones the model's `places` names, else every record entity the session
 * can list or look up. Only a session that can do neither is offered the
 * entities it reads by identifier, since a get-only type is often only a
 * reference or join target that staff would have to paste an id to reach.
 */
function placeEntities(
  entities: RegisterEntities | null,
  model: RegistryModel | undefined,
): EntityModel[] {
  if (!entities?.records) return [];
  const records = entities.records;
  const places = model?.places;
  if (places) {
    return places.flatMap((id) => records.filter((entity) => entity.id === id));
  }
  const found = records.filter(
    (entity) => entity.operations?.list || entity.operations?.lookup,
  );
  return found.length > 0
    ? found
    : records.filter((entity) => entity.operations?.get);
}

/** One nav item per record entity place, each on its own list route. */
function recordPlaces(
  routes: RegisterRoutes,
  entities: RegisterEntities | null,
  model: RegistryModel | undefined,
): RecordPlaces {
  // The register's own record entity, offered alone without `places`, keeps
  // the one place the labels name.
  const named = placeEntities(entities, model);
  const ownOnly =
    !model?.places &&
    named.length === 1 &&
    named[0]!.id === entities?.record.id;
  const places = ownOnly ? [] : named;
  // The root, where it is no other place, is the register's own list.
  const items = places.flatMap((entity) => {
    const at = entities && entityRoutes(routes, entities, entity.id);
    return at
      ? [
          {
            path: at.records,
            label: entity.pluralLabel,
            icon: Library,
            ...(entity.id === entities.record.id ? { under: ["/"] } : {}),
          },
        ]
      : [];
  });
  // The root is the start place for a session that opens there, so no place
  // stands under it.
  const found = named.flatMap((entity) => {
    const at =
      entities &&
      (entity.operations?.get || entity.operations?.lookup) &&
      entityRoutes(routes, entities, entity.id);
    return at
      ? [{ path: at.records, label: entity.pluralLabel, icon: Library }]
      : [];
  });
  return {
    items,
    found,
    hasRequests: Boolean(entities && navigationRequests(entities).length > 0),
  };
}

/**
 * The route the root stands for when the model names where a session opens:
 * its `home` list, else the first place. Null where it names neither, and for
 * a casework session, which opens on the review task queue.
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
  const first = model?.places && placeEntities(entities, model)[0];
  return first ? (entityRoutes(routes, entities, first.id)?.records ?? null) : null;
}

/**
 * Where the root sends a session, or null to stay. A registrar goes to the
 * dashboard where `dashboardLanding` names one. Nothing else is decided while
 * the model is still being read, so a reviewer is not sent to a queue the
 * model's home would have replaced. Without a model home, a reviewer goes to
 * the request queue where the register has requests, or where no model could
 * be read. A session with no home list that can list no record opens on the
 * start place (`startsLanding`) in place of a list it would be refused,
 * including the first configured place.
 */
export function rootRedirect(
  session: AuthenticatedSession,
  routes: RegisterRoutes,
  entities: RegisterEntities | null,
  model: RegistryModel | undefined,
  pending: boolean,
  dashboard: string | null = null,
  startsLanding: string | null = null,
): string | null {
  if (dashboard) return dashboard;
  if (pending) return null;
  // A configured place the session cannot list is not a landing; the model
  // names a home only for a list the session can run, so a home still wins.
  if (startsLanding && !model?.home) return startsLanding;
  const home = modelHomeRoute(session, routes, entities, model);
  if (home) return home;
  return session.decidesRequests &&
    !session.caseworkProfile &&
    (!entities || navigationRequests(entities).length > 0)
    ? routes.requests
    : null;
}

/** What the staff navigation entries read to decide their items. */
export interface StaffNavContext extends DashboardNavContext {
  session: AuthenticatedSession;
  casework: CaseworkContent;
  labels: StaffAppLabels;
  routes: RegisterRoutes;
  record: RecordPlaces;
  starts: StartPlace;
}

type StaffNavEntry = NavEntry<StaffNavContext, NavItem>;

const reviewer = (context: StaffNavContext) =>
  context.session.decidesRequests;

/** The request queue's place, worded for who works it. */
function requestsItem(
  { routes, labels, record }: StaffNavContext,
  label: string,
): NavItem[] {
  return record.hasRequests
    ? [{ path: routes.requests, label, icon: FileCheck2 }]
    : [];
}

/** The records place: one item per model place, else the one place the labels name. */
function recordsItems(context: StaffNavContext): NavItem[] {
  const { session, casework, labels, routes, record, starts } = context;
  if (starts.landing) {
    // With no items, the labels name the register's own record entity.
    return record.found.map((item) =>
      record.items.length === 0 && item.path === routes.records
        ? { ...item, label: labels.records }
        : item,
    );
  }
  if (record.items.length > 0) return [...record.items];
  if (session.caseworkProfile) {
    // The records place carries the name a registrar's nav and the records
    // page give it, unless the app's own content words it.
    const label =
      casework.navRecords === caseworkContent.navRecords
        ? labels.records
        : casework.navRecords;
    return [{ path: routes.records, label, icon: Library }];
  }
  return [
    {
      path: reviewer(context) ? routes.records : "/",
      label: labels.records,
      icon: Library,
      under: [routes.records],
    },
  ];
}

/**
 * The places a session can go, as data: groups drawn between dividers, each
 * a list of entries that give their items to the sessions that have them.
 */
export const staffNavigation: NavTable<StaffNavContext, NavItem> = [
  [
    {
      id: "reviews",
      items: ({ session, casework }) =>
        session.caseworkProfile && session.caseworkProfile !== "administrator"
          ? [{ path: "/casework", label: casework.navReviews, icon: ClipboardList }]
          : [],
    },
    {
      id: "team-reviews",
      items: ({ session, casework }) =>
        session.caseworkProfile === "supervisor"
          ? [
              {
                path: "/casework/team-reviews",
                label: casework.navTeamReviews,
                icon: ClipboardList,
              },
            ]
          : [],
    },
    {
      id: "my-decisions",
      items: ({ session, casework }) =>
        session.caseworkProfile === "staff" ||
        session.caseworkProfile === "supervisor"
          ? [
              {
                path: "/casework/decisions",
                label: casework.navMyDecisions,
                icon: FileCheck2,
              },
            ]
          : [],
    },
    {
      id: "staffing",
      items: ({ session, casework }) =>
        session.caseworkProfile === "supervisor"
          ? [
              {
                path: "/casework/staffing",
                label: casework.navStaffing,
                icon: Users,
              },
            ]
          : [],
    },
    {
      id: "setup",
      items: ({ session, casework }) =>
        session.caseworkProfile === "administrator"
          ? [{ path: "/casework/setup", label: casework.navSetup, icon: FileCheck2 }]
          : [],
    },
  ],
  [
    dashboardNavEntry,
    {
      id: "review-queue",
      items: (context) =>
        !context.session.caseworkProfile && reviewer(context)
          ? requestsItem(context, context.labels.reviewQueue)
          : [],
    },
    {
      id: "records",
      items: (context) =>
        context.session.caseworkProfile === "administrator"
          ? []
          : recordsItems(context),
    },
    {
      id: "start",
      items: (context) => context.starts.items,
    },
    {
      // A Casework reviewer's reviews are the Casework list above, so the
      // request queue is not offered beside it. A reviewer BReg alone knows
      // has the queue as the "review-queue" place.
      id: "requests",
      items: (context) =>
        context.session.caseworkProfile === "administrator" ||
        context.session.caseworkProfile === "staff" ||
        (!context.session.caseworkProfile && reviewer(context))
          ? []
          : requestsItem(context, context.labels.requests),
    },
  ],
  [
    {
      id: "how-review-works",
      items: ({ session, casework }) =>
        session.caseworkProfile
          ? [
              {
                path: "/casework/how-review-works",
                label: casework.navHowReviewWorks,
                icon: ScrollText,
              },
            ]
          : [],
    },
    {
      id: "help",
      items: ({ casework }) => [
        { path: "/help", label: casework.navHelp, icon: HelpCircle },
      ],
    },
  ],
];

/** The place the root route stands for, so it is marked current there. */
function homeOf(
  session: AuthenticatedSession,
  routes: RegisterRoutes,
  modelHome: string | null,
  dashboard: string | null,
): string {
  if (session.caseworkProfile) return landingPath(session);
  if (dashboard) return dashboard;
  if (modelHome) return splitRoute(modelHome).path;
  return session.decidesRequests ? routes.requests : "/";
}

/**
 * The staff app's routes, in the order they are tried. An app replaces one
 * with `replaceRoute(staffRoutes, route("record", ...))` or adds a page by
 * listing its own route beside these.
 */
export const staffRoutes: AppRoute[] = [
  route("home", exactPath("/"), (_, { session, redirecting }) => {
    switch (workKind(session)) {
      case "administrator":
        return <CaseworkSetupPage />;
      case "supervisor":
        return <CaseworkTeamReviewsPage />;
      case "reviewer":
        return <CaseworkReviewsPage />;
      case "registrar":
        return redirecting ? <Loading /> : <RecordListPage />;
    }
  }),
  route("records", registerPath("records"), () => <RecordListPage />),
  route("start", matchStartRoute, (m, c) => (
    <StartPage actionId={m.actionId} useTask={c.useCreateTask} />
  )),
  route("help", exactPath("/help"), () => <HelpPage />),
  ...dashboardRoutes,
  route("create-record", registerPath("createRecord"), (_, c) => (
    <CreateRecordPage useTask={c.useCreateTask} />
  )),
  route("record-action", registerPath("recordAction"), (m, c) => (
    <RecordActionPage actionId={m.id} useTask={c.useCreateTask} />
  )),
  route("action", registerPath("action"), (m, c) => (
    <RecordActionPage actionId={m.actionId} recordId={m.id} useTask={c.useCreateTask} />
  )),
  route("entity-records", entityPath("entityRecords"), (m) => (
    <RecordListPage entity={m.entity} />
  )),
  route("entity-create-record", entityPath("entityCreateRecord"), (m, c) => (
    <CreateRecordPage entity={m.entity} useTask={c.useCreateTask} />
  )),
  route("entity-record-action", entityPath("entityRecordAction"), (m, c) => (
    <RecordActionPage entity={m.entity} actionId={m.actionId} useTask={c.useCreateTask} />
  )),
  route("entity-action", entityPath("entityAction"), (m, c) => (
    <RecordActionPage
      entity={m.entity}
      actionId={m.actionId}
      recordId={m.id}
      useTask={c.useCreateTask}
    />
  )),
  route("entity-record", entityPath("entityRecord"), (m) => (
    <RecordDetailPage entity={m.entity} id={m.id} />
  )),
  route("change-record", registerPath("changeRecord"), (m, c) => (
    <ChangeRequestFormPage recordId={m.id} useTask={c.useChangeTask} />
  )),
  route("create-request", registerPath("createRequest"), (_, c) => (
    <ChangeRequestFormPage useTask={c.useChangeTask} />
  )),
  route("record", registerPath("record"), (m) => <RecordDetailPage id={m.id} />),
  route("requests", registerPath("requests"), () => <RequestQueuePage />),
  route("casework-reviews", exactPath("/casework", "/casework/reviews"), () => (
    <CaseworkReviewsPage />
  )),
  route("casework-team-reviews", exactPath("/casework/team-reviews"), () => (
    <CaseworkTeamReviewsPage />
  )),
  route("casework-my-decisions", exactPath("/casework/decisions"), () => (
    <CaseworkMyDecisionsPage />
  )),
  route(
    "casework-how-review-works",
    exactPath("/casework/how-review-works"),
    () => <CaseworkHowReviewWorksPage />,
  ),
  route("casework-staffing", exactPath("/casework/staffing"), () => (
    <CaseworkStaffingPage />
  )),
  route("casework-setup", exactPath("/casework/setup"), () => <CaseworkSetupPage />),
  route(
    "casework-review",
    (path) => {
      const parts = path.split("/").filter(Boolean).map(decodeSegment);
      return parts[0] === "casework" &&
        parts[1] === "reviews" &&
        parts.length === 3 &&
        parts[2] !== null
        ? { taskId: parts[2] }
        : null;
    },
    (m) => <CaseworkReviewPage taskId={m.taskId} />,
  ),
  route("edit-request", registerPath("editRequest"), (m, c) => (
    <ChangeRequestFormPage requestId={m.id} useTask={c.useChangeTask} />
  )),
  route("request", registerPath("request"), (m, c) => (
    <RequestDetailPage
      id={m.id}
      useTask={c.useRequestTask}
      useUpload={c.useUpload}
      useRemoval={c.useRemoval}
      openPdf={c.openPdf}
    />
  )),
];

/**
 * The places named by the model's plural labels, and by the pages' own titles
 * while the model is not read yet; the reviewer's queue is always named as
 * that page is.
 */
function ModelLabelledStaffApp(props: StaffAppProps) {
  const pages = usePagesContent();
  const entities = useRegister().entities;
  const records = entities?.record.pluralLabel ?? pages.recordListTitle;
  const requestEntities = entities ? navigationRequests(entities) : [];
  const requests =
    requestEntities.length === 1
      ? requestEntities[0]!.pluralLabel
      : pages.requestListTitle;
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
  // The starts are read once the model is, since a session that lists no
  // record may still start something. A Casework session has no registry
  // profile to read them for.
  const startsRead = useStarts({
    enabled: Boolean(model) && !session.caseworkProfile,
  });
  const pages = usePagesContent();
  // A session that decides requests opens on their queue only where it may
  // list one; otherwise it opens where any session that lists nothing does.
  const queuesRequests =
    session.decidesRequests &&
    Boolean(entities && navigationRequests(entities).length > 0);
  const startsLanding =
    !session.caseworkProfile &&
    !queuesRequests &&
    opensOnStarts(
      model,
      startsRead.data,
      startsRead.isError && !startsRead.data,
      routes,
    )
      ? startsPath
      : null;
  // A session that lists no record waits for its starts before it is sent anywhere.
  const startsPending =
    startsRead.isPending &&
    Boolean(model) &&
    !session.caseworkProfile &&
    !queuesRequests &&
    !model?.home &&
    !(model && listsRecords(model.entities));
  // A registrar opens on the dashboard where the host serves one. The root
  // holds on its loading state until that read settles, so the landing is
  // decided once.
  // A read that has failed once is settled: a later refetch of it must not
  // send a registrar back to the loading state.
  const dashboardRead = useDashboard();
  const dashboard = dashboardLanding(session, {
    isPending: dashboardRead.isPending && !dashboardRead.errorUpdateCount,
    data: dashboardRead.data,
  });
  // One page, one URL: the home the model names, or else the reviewer's
  // request queue, is reached by redirect instead of rendering the same page
  // twice in history.
  const redirect = rootRedirect(
    session,
    routes,
    entities,
    model,
    modelRead.isPending || startsPending,
    dashboard,
    startsLanding,
  );
  useEffect(() => {
    if (path === "/" && redirect) navigate(redirect);
  }, [path, redirect]);
  const parts: AppParts = {
    useCreateTask: props.useCreateTask ?? defaultTasks.useCreateTask,
    useChangeTask: props.useChangeTask ?? defaultTasks.useChangeTask,
    useRequestTask: props.useRequestTask ?? defaultTasks.useRequestTask,
    useUpload: props.useUpload ?? defaultTasks.useUpload,
    useRemoval: props.useRemoval ?? defaultTasks.useRemoval,
    openPdf: props.openPdf,
  };
  const page = renderRoute(props.routes ?? staffRoutes, path, routes, {
    ...parts,
    session,
    redirecting: Boolean(redirect) || dashboard === undefined,
  }) ?? (
    <ErrorPanel
      error={unavailableError(shell.unavailable)}
      unavailableTitle={shell.unavailable}
    />
  );
  const dashboardNav = useDashboardNav();
  const groups = useMemo(
    () =>
      navGroups(props.navigation ?? staffNavigation, {
        session,
        casework,
        labels: props.labels,
        routes,
        record: recordPlaces(routes, entities, model),
        starts: {
          items:
            startsLanding ||
            (model &&
              unlistedStarts(startsRead.data ?? [], model.entities, routes)
                .length > 0)
              ? [{ path: startsPath, label: pages.startsHeading, icon: Play }]
              : [],
          landing: startsLanding !== null,
        },
        dashboard: dashboardNav,
      }),
    [
      props.navigation,
      session,
      casework,
      props.labels,
      routes,
      entities,
      model,
      startsRead.data,
      startsLanding,
      pages.startsHeading,
      dashboardNav,
    ],
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
      app={session.app ?? "staff"}
      brand={shell.brand}
      groups={groups}
      homePath={homeOf(session, routes, modelHome, dashboard ?? null)}
      route={route}
    >
      {props.recoveryNotice === undefined ? <RecoveryNotice /> : props.recoveryNotice}
      {props.pendingUploadsNotice === undefined ? <PendingUploadsNotice /> : props.pendingUploadsNotice}
      {session.caseworkProfile && (
        <Suspense fallback={null}>
          <ReviewDecisionPendingNotice />
          <StaffingPendingNotice />
        </Suspense>
      )}
      <ReferenceHrefProvider href={referenceHref}>
        <Suspense fallback={<Loading />}>
          <div key={route}>{page}</div>
        </Suspense>
      </ReferenceHrefProvider>
    </WorkFrame>
  );
}

/**
 * A staff register work app: the work shell's places, the register's own
 * record and request pages, the pages of every other record entity under
 * `routes.entity`, and Casework's review task queue, review, staffing and
 * setup pages. A model that names `places` gets one nav item per place, and
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
