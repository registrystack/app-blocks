import { useMemo, type ReactNode } from "react";
import { FileCheck2, HelpCircle, Library } from "lucide-react";
import { useAuthority } from "@registrystack/app-runtime/react";
import { unavailableError } from "@registrystack/app-runtime";
import { BackLink } from "@/blocks/shell/back-link";
import { Navigation, type ShellNavItem } from "@/blocks/shell/navigation";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { HelpPage } from "@/blocks/shell/help-page";
import { Introduction } from "@/blocks/shell/introduction";
import { PublicShell } from "@/blocks/shell/public";
import { Shell } from "@/blocks/shell/chrome";
import { splitRoute, useRoute } from "@/blocks/shell/routing";
import { useShellContent } from "@/blocks/shell/shell-content";
import { ChangeRequestFormPage, type ChangeRequestTask } from "@/blocks/pages/change-request-form-page";
import { CreateRecordPage, type CreateRecordTask } from "@/blocks/pages/create-record-page";
import {
  PendingUploadsNotice,
  RecoveryNotice,
} from "@/blocks/pages/default-notices";
import * as defaultTasks from "@/blocks/pages/default-tasks";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegister } from "@/blocks/pages/record";
import { RecordDetailPage } from "@/blocks/pages/record-detail-page";
import { RecordListPage } from "@/blocks/pages/record-list-page";
import { matchRegisterRoute, useRegisterRoutes } from "@/blocks/pages/register-routes";
import { RequestDetailPage, type RequestDecisionTask } from "@/blocks/pages/request-detail-page";
import { RequestQueuePage } from "@/blocks/pages/request-queue-page";
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
}

/**
 * The places named by the model's plural labels, and by the pages' own
 * titles while the model is not read yet.
 */
function ModelLabelledServiceApp(props: ServiceAppProps) {
  const pages = usePagesContent();
  const entities = useRegister().entities;
  const records = entities?.record.pluralLabel ?? pages.ownRecordListTitle;
  const requests = entities?.request?.pluralLabel ?? pages.holderRequestsTitle;
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
  const route = useRoute();
  const { path } = splitRoute(route);
  const routes = useRegisterRoutes();
  const shell = useShellContent();
  const match = matchRegisterRoute(routes, path);
  const useCreateTask = props.useCreateTask ?? defaultTasks.useCreateTask;
  const useChangeTask = props.useChangeTask ?? defaultTasks.useChangeTask;
  const useRequestTask = props.useRequestTask ?? defaultTasks.useRequestTask;
  const useUpload = props.useUpload ?? defaultTasks.useUpload;
  const useRemoval = props.useRemoval ?? defaultTasks.useRemoval;
  let page: ReactNode;
  if (path === "/help") page = <HelpPage />;
  else if (path === "/" || match.kind === "records") page = <RecordListPage />;
  else if (match.kind === "createRecord")
    page = <CreateRecordPage useTask={useCreateTask} />;
  else if (match.kind === "changeRecord")
    page = (
      <ChangeRequestFormPage recordId={match.id} useTask={useChangeTask} />
    );
  else if (match.kind === "record") page = <RecordDetailPage id={match.id} />;
  else if (match.kind === "requests") page = <RequestQueuePage />;
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
  else
    page = (
      <ErrorPanel error={unavailableError(shell.unavailable)} />
    );
  const items: ShellNavItem[] = [
    { path: "/", label: props.labels.records, icon: Library, under: [routes.records] },
    { path: routes.requests, label: props.labels.requests, icon: FileCheck2 },
    { path: "/help", label: shell.help, icon: HelpCircle },
  ];
  return (
    <Shell
      audience="service"
      session={session}
      navigation={<Navigation items={items} current={path} />}
    >
      {props.recoveryNotice === undefined ? <RecoveryNotice /> : props.recoveryNotice}
      {props.pendingUploadsNotice === undefined ? <PendingUploadsNotice /> : props.pendingUploadsNotice}
      <div key={route}>{page}</div>
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
