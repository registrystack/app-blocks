import { Suspense, useMemo, type ReactNode } from "react";
import { FileCheck2, HelpCircle, Library } from "lucide-react";
import { useAuthority } from "@registrystack/app-runtime/react";
import { unavailableError } from "@registrystack/app-runtime";
import { BackLink } from "@/blocks/shell/back-link";
import { Navigation, type ShellNavItem } from "@/blocks/shell/navigation";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { HelpPage } from "@/blocks/shell/help-page";
import { Introduction } from "@/blocks/shell/introduction";
import { Loading } from "@/blocks/shell/loading";
import { PublicShell } from "@/blocks/shell/public";
import { Shell } from "@/blocks/shell/chrome";
import { splitRoute, useRoute } from "@/blocks/shell/routing";
import { useShellContent, type ShellContent } from "@/blocks/shell/shell-content";
import {
  exactPath,
  navGroups,
  registerPath,
  renderRoute,
  route,
  type AppParts,
  type AppRoute,
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
import { navigationRequests, useRegister } from "@/blocks/pages/record";
import {
  ChangeRequestFormPage,
  CreateRecordPage,
  HolderChooseChangePage,
  HolderChooseRecordPage,
  HolderDocumentsPage,
  HolderRecordListPage,
  HolderReviewPage,
  RecordActionPage,
  RecordDetailPage,
  RequestDetailPage,
  RequestQueuePage,
} from "@/blocks/pages/lazy-pages";
import {
  matchHolderStep,
  type HolderStepMatch,
} from "@/blocks/pages/holder-step-routes";
import { useRegisterRoutes, type RegisterRoutes } from "@/blocks/pages/register-routes";
import type { RequestDecisionTask } from "@/blocks/pages/request-detail-page";
import { SessionBoundary } from "@/blocks/shell/session-boundary";
import type { DocumentSource } from "@/blocks/documents/document-view";
import type { RemovalOutcome } from "@/blocks/pages/record-attachments";
import type { UploadOutcome } from "@/blocks/request/attachment-slots";

/** Labels the register's own service names its two nav places with. */
export interface ServiceAppLabels {
  records: string;
  requests: string;
}

/**
 * Every part an app may bind itself. Each one it leaves out is the blocks'
 * own: the nav names its places by the model's plural labels, the pages use
 * `@/blocks/pages/default-tasks` and the notices come from
 * `@/blocks/pages/default-notices`. A notice passed as `null` or `false`
 * renders none.
 */
export interface ServiceAppProps {
  labels?: ServiceAppLabels;
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
  /** The pages, tried in order; left out, `serviceRoutes`. */
  routes?: readonly AppRoute[];
  /** The places in the nav; left out, `serviceNavigation`. */
  navigation?: NavTable<ServiceNavContext, ShellNavItem>;
}

/** What the service navigation entries read to decide their items. */
export interface ServiceNavContext {
  shell: ShellContent;
  labels: ServiceAppLabels;
  routes: RegisterRoutes;
  hasRequests: boolean;
}

/** The places a holder can go, as data: one group of entries, in order. */
export const serviceNavigation: NavTable<ServiceNavContext, ShellNavItem> = [
  [
    {
      id: "records",
      items: ({ labels, routes }) => [
        { path: "/", label: labels.records, icon: Library, under: [routes.records] },
      ],
    },
    {
      id: "requests",
      items: ({ labels, routes, hasRequests }) =>
        hasRequests
          ? [{ path: routes.requests, label: labels.requests, icon: FileCheck2 }]
          : [],
    },
    {
      id: "help",
      items: ({ shell }) => [{ path: "/help", label: shell.help, icon: HelpCircle }],
    },
  ],
];

/**
 * The service app's routes, in the order they are tried. An app replaces one
 * with `replaceRoute(serviceRoutes, route("record", ...))` or adds a page by
 * listing its own route beside these.
 */
export const serviceRoutes: AppRoute[] = [
  route("help", exactPath("/help"), () => <HelpPage />),
  route("records", (path, routes) => (path === "/" || path === routes.records ? {} : null), () => (
    <HolderRecordListPage />
  )),
  route("create-record", registerPath("createRecord"), (_, c) => (
    <CreateRecordPage useTask={c.useCreateTask} />
  )),
  route("record-action", registerPath("recordAction"), (m, c) => (
    <RecordActionPage actionId={m.id} useTask={c.useCreateTask} />
  )),
  route("change-record", registerPath("changeRecord"), (m, c) => (
    <ChangeRequestFormPage recordId={m.id} useTask={c.useChangeTask} />
  )),
  route("record", registerPath("record"), (m) => <RecordDetailPage id={m.id} />),
  route("requests", registerPath("requests"), () => <RequestQueuePage />),
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
  // Last, so a path the app's own routes answer is never taken by a step.
  route(
    "holder-step",
    (path, routes): HolderStepMatch | null => matchHolderStep(routes, path),
    (m, c) =>
      m.kind === "chooseRecord" ? (
        <HolderChooseRecordPage />
      ) : m.kind === "chooseChange" ? (
        <HolderChooseChangePage id={m.id} />
      ) : m.kind === "documents" ? (
        <HolderDocumentsPage id={m.id} />
      ) : (
        <HolderReviewPage id={m.id} useTask={c.useChangeTask} />
      ),
  ),
];

/**
 * The places named by the model's plural labels, and by the pages' own
 * titles while the model is not read yet.
 */
function ModelLabelledServiceApp(props: ServiceAppProps) {
  const pages = usePagesContent();
  const entities = useRegister().entities;
  const records = entities?.record.pluralLabel ?? pages.ownRecordListTitle;
  const requestEntities = entities ? navigationRequests(entities) : [];
  const requests =
    requestEntities.length === 1
      ? requestEntities[0]!.pluralLabel
      : pages.holderRequestsTitle;
  const labels = useMemo(() => ({ records, requests }), [records, requests]);
  return <ServiceWork {...props} labels={labels} />;
}

function ProtectedServiceApp(props: ServiceAppProps) {
  return props.labels ? (
    <ServiceWork {...props} labels={props.labels} />
  ) : (
    <ModelLabelledServiceApp {...props} />
  );
}

function ServiceWork(props: ServiceAppProps & { labels: ServiceAppLabels }) {
  const session = useAuthority();
  const entities = useRegister().entities;
  const route = useRoute();
  const { path } = splitRoute(route);
  const routes = useRegisterRoutes();
  const shell = useShellContent();
  const parts: AppParts = {
    useCreateTask: props.useCreateTask ?? defaultTasks.useCreateTask,
    useChangeTask: props.useChangeTask ?? defaultTasks.useChangeTask,
    useRequestTask: props.useRequestTask ?? defaultTasks.useRequestTask,
    useUpload: props.useUpload ?? defaultTasks.useUpload,
    useRemoval: props.useRemoval ?? defaultTasks.useRemoval,
    openPdf: props.openPdf,
  };
  const page = renderRoute(props.routes ?? serviceRoutes, path, routes, {
    ...parts,
    session,
    redirecting: false,
  }) ?? (
    <ErrorPanel
      error={unavailableError(shell.unavailable)}
      unavailableTitle={shell.unavailable}
    />
  );
  const items = navGroups(props.navigation ?? serviceNavigation, {
    shell,
    labels: props.labels,
    routes,
    hasRequests: Boolean(entities && navigationRequests(entities).length > 0),
  }).flat();
  return (
    <Shell
      audience="service"
      session={session}
      navigation={<Navigation items={items} current={path} />}
    >
      {props.recoveryNotice === undefined ? <RecoveryNotice /> : props.recoveryNotice}
      {props.pendingUploadsNotice === undefined ? <PendingUploadsNotice /> : props.pendingUploadsNotice}
      <Suspense fallback={<Loading />}>
        <div key={route}>{page}</div>
      </Suspense>
    </Shell>
  );
}

/**
 * A holder-facing register service: introduction, session boundary, public
 * help, the register's own records and requests. It takes no register nouns
 * of its own; `useRegisterRoutes()` supplies the paths and `labels`, or the
 * model without them, supplies the nav wording, so an app names both once
 * and this composes the rest.
 */
export function ServiceApp(props: ServiceAppProps) {
  const route = useRoute();
  return (
    <SessionBoundary
      audience="service"
      introduction={
        splitRoute(route).path === "/help" ? (
          <ServiceHelpIntroduction />
        ) : (
          <Introduction audience="service" />
        )
      }
    >
      <ProtectedServiceApp {...props} />
    </SessionBoundary>
  );
}

function ServiceHelpIntroduction() {
  const shell = useShellContent();
  return (
    <PublicShell audience="service">
      <BackLink href="/">{shell.back}</BackLink>
      <HelpPage />
    </PublicShell>
  );
}
