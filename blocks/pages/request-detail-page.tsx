import { Fragment } from "react";
import { ArrowUpRight } from "lucide-react";
import type {
  EntityModel,
  FieldModel,
  RecordActionReference,
  RecordTask,
  RecordView,
  RequestView,
} from "@registrystack/app-runtime";
import { unavailableError } from "@registrystack/app-runtime";
import {
  recordTask,
  useAuthority,
  useRecord,
  useRequesterReviewNotes,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/blocks/lib/notice";
import { useBlockContent, type BlockContent } from "@/blocks/lib/content";
import { FieldValue } from "@/blocks/fields/field-value";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { useShellContent } from "@/blocks/shell/shell-content";
import { PageHeading } from "@/blocks/shell/page-heading";
import { StatusBadge } from "@/blocks/shell/status-badge";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/shell/live-announcer";
import {
  usePagesContent,
  type PagesContent,
} from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import {
  DecisionForm,
  type DecisionOutcome,
} from "@/blocks/request/request-actions";
import { ChangeTable, type ChangeRow } from "@/blocks/request/request-changes";
import {
  StateNotice,
  approvedNotApplied,
} from "@/blocks/request/request-status";
import { ReviewRecoveryNotices } from "@/blocks/request/request-recovery-notices";
import { ReviewNotes } from "@/blocks/request/request-review-notes";
import { VerifiedEvidenceSummary } from "@/blocks/request/verified-prefill";
import { AnswerList } from "@/blocks/request/request-form";
import type { UploadOutcome } from "@/blocks/request/attachment-slots";
import {
  SupportingDocuments,
  type RemovalOutcome,
} from "@/blocks/pages/record-attachments";
import type { DocumentSource } from "@/blocks/documents/document-view";
import {
  currentValue,
  fieldOf,
  readableTarget,
  recordTitle,
  useRegister,
  writtenFields,
  type RegisterEntities,
} from "@/blocks/pages/record";

/** The decision this page submits: a lifecycle action against the request. */
export type RequestDecisionTask = DecisionOutcome & {
  submit: (task: RecordTask) => Promise<unknown>;
};

function stateDescription(state: string, pages: PagesContent): string {
  const map: Record<string, string> = {
    draft: pages.draftDescription,
    submitted: pages.submittedDescription,
    "revision-requested": pages.revisionDescription,
    "changes-requested": pages.revisionDescription,
    "approval-expired": pages.approvalExpiredDescription,
    approved: pages.approvedDescription,
    applied: pages.appliedDescription,
    rejected: pages.rejectedDescription,
    cancelled: pages.cancelledDescription,
  };
  return map[state] ?? pages.actionExplanation;
}

function actionDescription(name: string, pages: PagesContent): string {
  const map: Record<string, string> = {
    submit: pages.confirmSubmit,
    apply: pages.confirmApply,
    revise: pages.confirmRevision,
    rebase: pages.confirmRebase,
    cancel: pages.confirmCancel,
  };
  return map[name] ?? pages.actionExplanation;
}

/** An action's label: the app's own wording for its lifecycle action, before the action's own. */
function choiceLabel(
  action: RecordActionReference,
  pages: PagesContent,
): string {
  const key = action.action ?? action.name;
  return pages.actionLabels[key] ?? action.label ?? key;
}

/** Exact, order-sensitive equality: a reordered list is a change. */
function sameValue(current: unknown, proposed: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(proposed);
}

/**
 * The target record's context fields that the request does not write: the
 * context an officer reads the change against. Without a declared context,
 * the record's list columns other than its title.
 */
function contextFields(
  entities: RegisterEntities,
  written: readonly string[],
): FieldModel[] {
  const record = entities.record;
  const declared = record.context;
  return (declared ?? record.list.columns).flatMap((id) => {
    const field = fieldOf(record, id);
    return field && (declared || id !== record.title) && !written.includes(id)
      ? [field]
      : [];
  });
}

/**
 * The comparison rows for one request, one for each field it writes. Current
 * values come from the live target record, so before-values survive the
 * decision that removes the pending lifecycle action; the values the request
 * retained stand in only while the target is not marked unavailable.
 */
function changeRows(
  entities: RegisterEntities,
  request: EntityModel,
  view: RecordView,
  target: RecordView | undefined,
  c: BlockContent,
): ChangeRow[] {
  const written = writtenFields(entities, request.fields);
  const rows: ChangeRow[] = written.map(({ field, target: targetField }) => {
    const current = currentValue(targetField, target, view.request);
    const proposed = view.values[field.id];
    return {
      key: targetField.id,
      label: targetField.label,
      current:
        current === undefined ? (
          <p className="muted">{c.currentUnavailable}</p>
        ) : (
          <FieldValue field={targetField} value={current} />
        ),
      proposed: <FieldValue field={targetField} value={proposed} />,
      comparison:
        current === undefined
          ? "unknown"
          : sameValue(current, proposed)
            ? "unchanged"
            : "changed",
    };
  });
  if (target)
    for (const field of contextFields(
      entities,
      written.map((item) => item.target.id),
    ))
      rows.push({
        key: field.id,
        label: field.label,
        current: <FieldValue field={field} value={target.values[field.id]} />,
        proposed: <FieldValue field={field} value={target.values[field.id]} />,
        comparison: "unchanged",
      });
  return rows;
}

const otherLifecycleNames = ["submit", "cancel", "revise", "rebase"];

/** This page's own wording for the review's three recovery states, over the block's `ReviewRecoveryNotices`. */
function RequestRecoveryNotices({
  request,
}: {
  request: RequestView | undefined;
}) {
  const pages = usePagesContent();
  return (
    <ReviewRecoveryNotices
      request={request}
      withdrawalPendingTitle={pages.reviewWithdrawalPendingTitle}
      withdrawalPendingBody={pages.reviewWithdrawalPendingBody}
      submissionUnknownTitle={pages.reviewSubmissionUnknownTitle}
      submissionUnknownBody={pages.reviewSubmissionUnknownBody}
      operatorAttentionTitle={pages.reviewOperatorAttentionTitle}
      operatorAttentionBody={pages.reviewOperatorAttentionBody}
      operatorAttentionBodies={pages.reviewOperatorAttentionBodies}
    />
  );
}

/**
 * The request screen for every role: a reviewer applies an approved request,
 * a holder or registrar tracks their own request. Document order: banner,
 * heading, comparison, reason asked, then the controls last.
 */
export function RequestDetailPage({
  id,
  useTask,
  useUpload,
  useRemoval,
  openPdf,
}: {
  id: string;
  /** The decision this page submits; a page instantiates it over its own host command. */
  useTask: () => RequestDecisionTask;
  useUpload: (slot: string) => UploadOutcome;
  useRemoval: (slot: string) => RemovalOutcome;
  /** Opens a supporting PDF's bytes in the preview; without it, a PDF stays download-only. */
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const register = useRegister();
  const shell = useShellContent();
  if (register.isPending) return <Loading />;
  if (register.error)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  const entities = register.entities;
  if (!entities?.followedRequest)
    return <ErrorPanel error={unavailableError(shell.unavailable)} />;
  return (
    <RequestRead
      entities={entities}
      request={entities.followedRequest}
      id={id}
      useTask={useTask}
      useUpload={useUpload}
      useRemoval={useRemoval}
      openPdf={openPdf}
    />
  );
}

function RequestRead({
  entities,
  request,
  id,
  useTask,
  useUpload,
  useRemoval,
  openPdf,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  id: string;
  useTask: () => RequestDecisionTask;
  useUpload: (slot: string) => UploadOutcome;
  useRemoval: (slot: string) => RemovalOutcome;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const pages = usePagesContent(),
    session = useAuthority(),
    query = useRecord(request.id, id);
  if (query.isPending) return <Loading />;
  if (query.error || !query.data)
    return (
      <ErrorPanel
        error={query.error}
        retry={() => void query.refetch()}
        unavailableTitle={
          session.role === "holder" ? pages.requestUnavailable : undefined
        }
      />
    );
  return (
    <RequestWithTarget
      entities={entities}
      request={request}
      view={query.data}
      refetch={() => query.refetch()}
      refreshing={query.refreshing}
      useTask={useTask}
      useUpload={useUpload}
      useRemoval={useRemoval}
      openPdf={openPdf}
    />
  );
}

/** Reads the record the request changes; a target that cannot be read leaves the comparison to say so. */
function RequestWithTarget({
  entities,
  request,
  view,
  refetch,
  refreshing,
  useTask,
  useUpload,
  useRemoval,
  openPdf,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  view: RecordView;
  refetch: () => Promise<unknown>;
  /** The request's own read is stale and already being refetched in the background. */
  refreshing: boolean;
  useTask: () => RequestDecisionTask;
  useUpload: (slot: string) => UploadOutcome;
  useRemoval: (slot: string) => RemovalOutcome;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const target = useRecord(
    entities.record.id,
    readableTarget(entities, view.request),
  );
  if (target.isLoading) return <Loading />;
  return (
    <RequestDetail
      entities={entities}
      request={request}
      view={view}
      target={target.data}
      refetch={refetch}
      refreshing={refreshing}
      useTask={useTask}
      useUpload={useUpload}
      useRemoval={useRemoval}
      openPdf={openPdf}
    />
  );
}

/**
 * What the reviewer wrote for the request's holder, when the review sent it
 * back or rejected it. The host reads the notes from the review the record
 * names; any other account, and any read that fails, gets the not-available
 * wording.
 */
function ReviewerNote({ entity, id }: { entity: string; id: string }) {
  const notes = useRequesterReviewNotes(entity, id);
  if (notes.isPending) return <Loading />;
  // A read that settled without data (a fetch error the hook did not turn
  // into a "not-available" state itself) gets the same undisclosed wording
  // as any other state the block does not name explicitly.
  return (
    <ReviewNotes notes={notes.data ?? { state: "unavailable", notes: [] }} />
  );
}

function RequestDetail({
  entities,
  request,
  view,
  target,
  refetch,
  refreshing,
  useTask,
  useUpload,
  useRemoval,
  openPdf,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  view: RecordView;
  target: RecordView | undefined;
  refetch: () => Promise<unknown>;
  /** The request's own read is stale and already being refetched in the background. */
  refreshing: boolean;
  useTask: () => RequestDecisionTask;
  useUpload: (slot: string) => UploadOutcome;
  useRemoval: (slot: string) => RemovalOutcome;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    routes = useRegisterRoutes(),
    session = useAuthority(),
    task = useTask();
  const [announcement, announce] = useAnnouncement();
  const state = view.request?.state ?? "draft";
  const result = view.request?.review?.result.state;
  // The human reference: the target record's title, never the UUID.
  const reference =
    (target && recordTitle(entities.record, target)) ??
    recordTitle(request, view);

  const lifecycle = view.actions.filter(
    (action) => action.name === "lifecycle",
  );
  const applyAction =
    lifecycle.find((action) => action.action === "apply") ?? null;
  const otherActions = lifecycle.filter((action) =>
    otherLifecycleNames.includes(action.action ?? ""),
  );
  const patchAction = view.actions.find((action) => action.name === "patch");
  const applying = session.role === "reviewer" && applyAction !== null;
  const holder = session.role === "holder";
  const approved = approvedNotApplied(view.request);
  // A send-back leaves the request submitted; its review result says so.
  const sentBack =
    state === "changes-requested" || result === "changesRequested";
  const rejected = !sentBack && (state === "rejected" || result === "rejected");

  const written = writtenFields(entities, request.fields);
  const writtenIds = written.map((item) => item.field.id);
  const asked = request.sections
    .flatMap((section) => section.fields)
    .flatMap((id) => {
      const field = fieldOf(request, id);
      const value = view.values[id];
      return field &&
        !writtenIds.includes(id) &&
        value !== undefined &&
        value !== null
        ? [field]
        : [];
    });
  const evidence = view.request?.evidence;
  const evidenceField = evidence
    ? request.fields.find(
        (field) =>
          field.id === evidence.field || field.apiName === evidence.field,
      )
    : undefined;
  const context = target
    ? contextFields(
        entities,
        written.map((item) => item.target.id),
      )
    : [];

  return (
    <>
      <BackLink href={routes.requests}>
        {session.role === "reviewer"
          ? pages.reviewQueue
          : session.role === "holder"
            ? pages.ownRequests
            : pages.requestsHome}
      </BackLink>
      {/* The state of the case comes before the h1. */}
      {approved ? (
        <Notice title={pages.reviewApprovedPendingApplicationTitle}>
          <p>{pages.reviewApprovedPendingApplicationBody}</p>
        </Notice>
      ) : (
        <StateNotice
          state={state}
          description={
            session.role === "reviewer" && state === "submitted"
              ? pages.submittedReviewDescription
              : stateDescription(state, pages)
          }
        />
      )}
      <RequestRecoveryNotices request={view.request} />
      <PageHeading
        eyebrow={reference}
        title={pages.requestTitle}
        action={
          <StatusBadge
            state={approved ? "approved" : state}
            served={request.request?.stateLabels[approved ? "approved" : state]}
          />
        }
      />
      <LiveAnnouncer message={announcement} />
      {(sentBack || rejected) && (
        <section className="revision-next-step">
          <h2>{sentBack ? pages.revisionReason : pages.rejectionReason}</h2>
          {session.role === "holder" ? (
            <ReviewerNote entity={view.entity} id={view.id} />
          ) : (
            <p>{block.undisclosedRevisionReason}</p>
          )}
        </section>
      )}
      <section>
        <h2>{block.proposedHeading}</h2>
        <ChangeTable rows={changeRows(entities, request, view, target, block)}>
          {view.request?.target && (
            <Button
              render={<a href={`#${routes.record(view.request.target.id)}`} />}
              variant="outline"
            >
              {pages.viewRecordLink}
              <ArrowUpRight />
            </Button>
          )}
        </ChangeTable>
      </section>
      <section>
        <h2>
          {holder ? block.holderWhyAskedHeading : block.whyAskedHeading}
        </h2>
        {asked.length > 0 && (
          <AnswerList
            items={asked.map((field) => ({
              key: field.id,
              label: field.label,
              value: <FieldValue field={field} value={view.values[field.id]} />,
            }))}
          />
        )}
        {evidence && (
          <VerifiedEvidenceSummary
            evidence={evidence}
            changedValue={
              evidence.changedAfterVerification && evidenceField ? (
                <FieldValue
                  field={evidenceField}
                  value={view.values[evidenceField.id]}
                />
              ) : undefined
            }
          />
        )}
      </section>
      <SupportingDocuments
        record={{ entity: view.entity, id: view.id, revision: view.revision }}
        slots={view.attachments}
        useUpload={useUpload}
        useRemoval={useRemoval}
        openPdf={openPdf}
      />
      <DecisionForm
        title={
          applying
            ? pages.applyApproved
            : holder
              ? pages.holderActionsHeading
              : pages.decideHeading
        }
        hint={
          applying
            ? pages.applyApprovedHint
            : holder
              ? pages.holderActionsHint
              : pages.actionExplanation
        }
        reference={reference ?? pages.unnamedRequest}
        choices={[]}
        primaryAction={applyAction}
        secondaryActions={otherActions}
        hasActions={lifecycle.length > 0 || patchAction !== undefined}
        needsReason={() => false}
        describeAction={(action) =>
          actionDescription(action.action ?? action.name, pages)
        }
        checkDetails={
          target &&
          context.length > 0 && (
            <p className="muted">
              {context.map((field, index) => (
                <Fragment key={field.id}>
                  {index > 0 && " · "}
                  <FieldValue field={field} value={target.values[field.id]} />
                </Fragment>
              ))}
            </p>
          )
        }
        header={
          patchAction && (
            <Button
              render={<a href={`#${routes.editRequest(view.id)}`} />}
              variant="outline"
            >
              {pages.editDraft}
            </Button>
          )
        }
        task={task}
        submit={(action: RecordActionReference) =>
          task.submit(
            recordTask(
              action,
              { entity: view.entity, id: view.id },
              { expectedRevision: view.revision },
            ),
          )
        }
        refetch={refetch}
        announce={announce}
        choiceLabel={(action) => choiceLabel(action, pages)}
        reconcileHref={`#${routes.requests}`}
        renderError={(error) => <ErrorPanel error={error} />}
        refreshing={refreshing}
        decidedBody={pages.decidedBody}
      />
    </>
  );
}
