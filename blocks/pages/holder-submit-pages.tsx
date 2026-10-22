import { useState, type ReactNode } from "react";
import type {
  EntityModel,
  RecordActionReference,
  RecordView,
} from "@registrystack/app-runtime";
import { recordTask, useRecord } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/blocks/lib/notice";
import { FieldValue } from "@/blocks/fields/field-value";
import { AnswerList } from "@/blocks/request/request-form";
import { HolderSteps } from "@/blocks/request/holder-steps";
import {
  ChangeTable,
  recordOfRequest,
  writtenChangeRows,
  writtenFields,
} from "@/blocks/request/request-changes";
import { BackLink } from "@/blocks/shell/back-link";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { splitRoute, useRoute } from "@/blocks/shell/routing";
import type { ChangeRequestTask } from "@/blocks/pages/change-request-form-page";
import {
  useRecordRemoval,
  useRecordUpload,
} from "@/blocks/pages/default-tasks";
import { documentsRoute, reviewRoute } from "@/blocks/pages/holder-step-routes";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useLocale } from "@/blocks/lib/content";
import { SupportingDocuments } from "@/blocks/pages/record-attachments";
import {
  readableTarget,
  recordPath,
  recordTitle,
  requestRoute,
  routedRequest,
  useRegister,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";

/**
 * Reads the draft a step is about from the registry and hands it on. A reload
 * of any step comes back here, so the draft is always the registry's copy and
 * never one the browser kept.
 */
function DraftGate({
  id,
  children,
}: {
  id: string;
  children: (
    entities: RegisterEntities,
    request: EntityModel,
    draft: RecordView,
  ) => ReactNode;
}) {
  const register = useRegister(),
    pages = usePagesContent(),
    { query } = splitRoute(useRoute());
  const entities = register.entities;
  const request = entities && routedRequest(entities, query);
  const draft = useRecord(request?.id ?? "", request ? id : "");
  if (register.isPending || draft.isLoading) return <Loading />;
  if (register.error || !entities || !request)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  if (!draft.data || draft.error)
    return (
      <ErrorPanel
        error={draft.error}
        unavailableTitle={pages.requestUnavailable}
      />
    );
  return <>{children(entities, request, draft.data)}</>;
}

/** The fourth step: the supporting documents the request takes, attached to the registry's draft. */
export function HolderDocumentsPage({ id }: { id: string }) {
  return (
    <DraftGate id={id}>
      {(entities, request, draft) => (
        <Documents entities={entities} request={request} draft={draft} />
      )}
    </DraftGate>
  );
}

function Documents({
  entities,
  request,
  draft,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  draft: RecordView;
}) {
  const pages = usePagesContent(),
    locale = useLocale(),
    routes = useRegisterRoutes();
  const useUpload = (slot: string) =>
    useRecordUpload(draft.entity, draft.id, slot);
  const useRemoval = (slot: string) =>
    useRecordRemoval(draft.entity, draft.id, slot);
  const editable = draft.actions.some((action) => action.name === "patch");
  return (
    <>
      <BackLink
        href={
          editable
            ? requestRoute(entities, routes.editRequest(draft.id), request.id)
            : routes.records
        }
      >
        {editable ? pages.documentsBack : pages.back}
      </BackLink>
      <HolderSteps current="documents" documents />
      <PageHeading
        eyebrow={recordTitle(request, draft, locale)}
        title={pages.documentsTitle}
        description={pages.documentsDescription}
      />
      {!isDraft(draft) ? (
        <NotADraft entities={entities} draft={draft} />
      ) : (
        <>
          {draft.attachments?.length ? (
            <SupportingDocuments
              record={{
                entity: draft.entity,
                id: draft.id,
                revision: draft.revision,
              }}
              slots={draft.attachments}
              useUpload={useUpload}
              useRemoval={useRemoval}
            />
          ) : (
            <p className="muted">{pages.documentsNone}</p>
          )}
          <div className="actions">
            <Button
              render={
                <a
                  href={`#${reviewRoute(routes, entities, request.id, draft.id)}`}
                />
              }
            >
              {pages.documentsContinue}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

/** Whether the registry still holds the request as a draft a holder can work on. */
const isDraft = (draft: RecordView) => draft.request?.state === "draft";

/** The way from a step to the request's own page. */
function ViewRequest({
  entities,
  draft,
}: {
  entities: RegisterEntities;
  draft: RecordView;
}) {
  const pages = usePagesContent(),
    routes = useRegisterRoutes();
  return (
    <div className="actions">
      <Button
        variant="outline"
        render={
          <a
            href={`#${recordPath(routes, entities, draft.entity, draft.id) ?? routes.requests}`}
          />
        }
      >
        {pages.reviewViewRequest}
      </Button>
    </div>
  );
}

/**
 * What a step shows for a request that is no longer a draft, with the way to
 * its own page: worded for the state the registry reports, or for what is
 * true of every state when the view carries none.
 */
export function NotADraft({
  entities,
  draft,
}: {
  entities: RegisterEntities;
  draft: RecordView;
}) {
  const pages = usePagesContent();
  const state = draft.request?.state ?? "";
  return (
    <Notice
      title={pages.reviewNotDraftTitles[state] ?? pages.reviewNotDraftTitle}
    >
      <p>{pages.reviewNotDraftBodies[state] ?? pages.reviewNotDraftBody}</p>
      <ViewRequest entities={entities} draft={draft} />
    </Notice>
  );
}

type Sent = "submit" | "cancel";

const lifecycle = (draft: RecordView, name: Sent) =>
  draft.actions.find(
    (action) => action.name === "lifecycle" && action.action === name,
  );

/**
 * The last step: the draft as the registry holds it, with the submission and
 * the discard only where its links offer them. Success shows when the
 * registry confirms the write, never on the click.
 */
export function HolderReviewPage({
  id,
  useTask,
}: {
  id: string;
  useTask: () => ChangeRequestTask;
}) {
  return (
    <DraftGate id={id}>
      {(entities, request, draft) => (
        <Review
          entities={entities}
          request={request}
          draft={draft}
          useTask={useTask}
        />
      )}
    </DraftGate>
  );
}

function Review({
  entities,
  request,
  draft,
  useTask,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  draft: RecordView;
  useTask: () => ChangeRequestTask;
}) {
  const pages = usePagesContent(),
    locale = useLocale(),
    routes = useRegisterRoutes(),
    task = useTask();
  const [sending, setSending] = useState<Sent | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const record = recordOfRequest(
    entities,
    request,
    (draft.request?.entry ?? draft.request?.target)?.entity,
  );
  const target = useRecord(
    record.id,
    readableTarget({ ...entities, record }, draft.request),
  );
  const patch = draft.actions.find((action) => action.name === "patch");
  const submit = lifecycle(draft, "submit");
  const cancel = lifecycle(draft, "cancel");
  const confirmed = task.result?.outcome === "confirmed" ? sending : null;
  const fields = (
    patch?.fields ??
    request.sections
      .flatMap((section) => section.fields)
      .flatMap((fieldId) => request.fields.filter((f) => f.id === fieldId))
  ).filter((field) => !field.readOnly);
  const written = writtenFields({ record, request }, fields);
  const writtenIds = written.map((item) => item.field.id);
  const others = fields.filter((field) => !writtenIds.includes(field.id));
  async function send(action: RecordActionReference, name: Sent) {
    setSending(name);
    setDiscarding(false);
    await task.submit(
      recordTask(
        action,
        { entity: draft.entity, id: draft.id },
        { expectedRevision: draft.revision },
      ),
    );
  }
  return (
    <>
      <BackLink href={routes.records}>{pages.back}</BackLink>
      <HolderSteps
        current="review"
        documents={Boolean(request.operations.attachments?.length)}
      />
      <PageHeading
        eyebrow={recordTitle(request, draft, locale)}
        title={pages.reviewTitle}
        description={pages.reviewDescription}
      />
      {confirmed === "submit" ? (
        <Notice tone="success" title={pages.reviewSentTitle}>
          <p>{pages.reviewSentBody}</p>
          <ViewRequest entities={entities} draft={draft} />
        </Notice>
      ) : confirmed === "cancel" ? (
        <Notice tone="success" title={pages.reviewDiscardedTitle}>
          <p>{pages.reviewDiscardedBody}</p>
          <div className="actions">
            <Button
              variant="outline"
              render={<a href={`#${routes.records}`} />}
            >
              {pages.back}
            </Button>
          </div>
        </Notice>
      ) : !isDraft(draft) ? (
        <NotADraft entities={entities} draft={draft} />
      ) : (
        <div className="card form-card">
          {written.length > 0 && (
            <ChangeTable
              rows={writtenChangeRows(
                written,
                draft,
                target.data,
                pages.originalValueUnavailable,
              )}
            />
          )}
          <AnswerList
            items={others.map((field) => ({
              key: field.id,
              label: field.label,
              value: (
                <FieldValue field={field} value={draft.values[field.id]} />
              ),
            }))}
          />
          {draft.attachments?.length ? (
            <SupportingDocuments
              record={{
                entity: draft.entity,
                id: draft.id,
                revision: draft.revision,
              }}
              slots={draft.attachments}
              readOnly
              useUpload={(slot) =>
                useRecordUpload(draft.entity, draft.id, slot)
              }
              useRemoval={(slot) =>
                useRecordRemoval(draft.entity, draft.id, slot)
              }
            />
          ) : null}
          <div className="actions">
            {patch && (
              <Button
                variant="outline"
                render={
                  <a
                    href={`#${requestRoute(entities, routes.editRequest(draft.id), request.id)}`}
                  />
                }
              >
                {pages.reviewChangeAnswers}
              </Button>
            )}
            {request.operations.attachments?.length ? (
              <Button
                variant="outline"
                render={
                  <a
                    href={`#${documentsRoute(routes, entities, request.id, draft.id)}`}
                  />
                }
              >
                {pages.reviewChangeDocuments}
              </Button>
            ) : null}
          </div>
          {submit ? (
            <div className="actions">
              <Button
                disabled={task.locked}
                onClick={() => void send(submit, "submit")}
              >
                {submit.label ?? pages.reviewSubmitFallback}
              </Button>
            </div>
          ) : (
            <p className="muted">{pages.reviewSubmitUnavailable}</p>
          )}
          {cancel &&
            (discarding ? (
              <Notice tone="warning">
                <p>{pages.reviewDiscardQuestion}</p>
                <div className="actions">
                  <Button
                    variant="destructive"
                    disabled={task.locked}
                    onClick={() => void send(cancel, "cancel")}
                  >
                    {pages.reviewDiscardConfirm}
                  </Button>
                  <Button variant="ghost" onClick={() => setDiscarding(false)}>
                    {pages.reviewDiscardKeep}
                  </Button>
                </div>
              </Notice>
            ) : (
              <div className="actions">
                <Button
                  variant="ghost"
                  disabled={task.locked}
                  onClick={() => setDiscarding(true)}
                >
                  {pages.reviewDiscard}
                </Button>
              </div>
            ))}
          {task.result?.outcome !== "confirmed" && (
            <TaskFeedback
              task={task}
              reconcileHref={`#${requestRoute(entities, routes.requests, request.id)}`}
            />
          )}
        </div>
      )}
    </>
  );
}
