import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type {
  EntityModel,
  FieldModel,
  JsonValue,
  RecordActionReference,
  RecordTask,
  RecordView,
  VerifiedPrefill,
} from "@registrystack/app-runtime";
import {
  formValues,
  recordTask,
  useAuthority,
  usePrefill,
  useRecord,
  useStarts,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { fill, inSentence } from "@/blocks/lib/format";
import { FieldControl } from "@/blocks/fields/field-control";
import { FieldValue } from "@/blocks/fields/field-value";
import { ChosenReferencesProvider } from "@/blocks/fields/reference-value";
import { ValueScope } from "@/blocks/fields/group-field";
import {
  ConflictComparison,
  conflictRows,
} from "@/blocks/record/conflict-comparison";
import { ErrorSummary } from "@/blocks/record/record-form";
import { HolderSteps } from "@/blocks/request/holder-steps";
import { AnswerList } from "@/blocks/request/request-form";
import { VerifiedPrefillSection } from "@/blocks/request/verified-prefill";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { createWords, usePagesContent } from "@/blocks/pages/pages-content";
import { documentsRoute, reviewRoute } from "@/blocks/pages/holder-step-routes";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { backPathOf } from "@/blocks/pages/record-route-query";
import { startsPath } from "@/blocks/pages/start-places";
import {
  useFormAnswers,
  useOpenedAction,
} from "@/blocks/pages/write-form-core";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  readableTarget,
  recordPath,
  recordTitle,
  requestRoute,
  routedRequest,
  sameAnswer,
  useRegister,
  UnavailableWrite,
  type RecordTaskState,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { valueErrors } from "@/blocks/fields/value-errors";
import {
  currentValue,
  recordOfRequest,
  writtenFields,
  type WrittenField,
} from "@/blocks/request/request-changes";

/** The write `ChangeRequestFormPage` submits: a plain record task, unadapted. */
export type ChangeRequestTask = RecordTaskState<RecordTask>;

/**
 * A request to the register: a create from the record the request
 * changes, a create from the start place, or the edit of a draft the
 * session may still change. A create from the start place is a request that
 * only creates, or one whose record is picked on its form. The fields, their
 * words and what the request writes come from the model, never from an
 * entity or field id in this file.
 */
export function ChangeRequestFormPage({
  recordId,
  requestId,
  useTask,
  onDirtyChange,
}: {
  /**
   * The record this request changes; given when starting a new request from
   * that record. With neither id, the request is started from the start place.
   */
  recordId?: string;
  /** The draft being edited; given when opening a saved one. */
  requestId?: string;
  /** The write this page submits; a page instantiates it over its own host command. */
  useTask: () => ChangeRequestTask;
  /** Let the containing app protect unsaved answers when the user leaves this page. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const register = useRegister();
  const { query } = splitRoute(useRoute());
  if (register.isPending) return <Loading />;
  const entities = register.entities;
  const request = entities && routedRequest(entities, query);
  if (register.error || !entities || !request)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  return requestId ? (
    <DraftRequestForm
      entities={entities}
      request={request}
      id={requestId}
      useTask={useTask}
      onDirtyChange={onDirtyChange}
    />
  ) : (
    <NewRequestForm
      entities={entities}
      request={request}
      id={recordId}
      useTask={useTask}
      onDirtyChange={onDirtyChange}
    />
  );
}

/**
 * A new request: offered among the actions of the record it changes, or,
 * with no record, among the starts, where the host leaves any record it
 * changes to be picked on the form.
 */
function NewRequestForm({
  entities,
  request,
  id,
  useTask,
  onDirtyChange,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  /** The record the request changes; absent for a request started from the start place. */
  id?: string;
  useTask: () => ChangeRequestTask;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const record = recordOfRequest(
    entities,
    request,
    request.request?.entry?.entity,
  );
  const query = useRecord(record.id, id ?? "");
  const starts = useStarts({ enabled: id === undefined });
  const offered = id === undefined ? starts.data : query.data?.actions;
  const action = useOpenedAction(
    offered?.find(
      (item) => item.name === "create" && item.entity === request.id,
    ),
  );
  if (id === undefined ? starts.isPending : query.isPending) return <Loading />;
  if (id === undefined && !starts.data)
    return (
      <ErrorPanel error={starts.error} retry={() => void starts.refetch()} />
    );
  if (id !== undefined && (!query.data || query.error))
    return <ErrorPanel error={query.error} />;
  if (!action) return <UnavailableWrite />;
  // Records picked on the form keep their titles for the check step, where the
  // picker is gone and the session may list the record but not open it.
  return (
    <ChosenReferencesProvider key={query.data?.id ?? request.id}>
      <RequestForm
        entities={entities}
        record={record}
        request={request}
        action={action}
        target={query.data}
        useTask={useTask}
        onDirtyChange={onDirtyChange}
      />
    </ChosenReferencesProvider>
  );
}

function DraftRequestForm({
  entities,
  request,
  id,
  useTask,
  onDirtyChange,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  id: string;
  useTask: () => ChangeRequestTask;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const pages = usePagesContent(),
    session = useAuthority(),
    query = useRecord(request.id, id);
  if (query.isPending) return <Loading />;
  if (!query.data || query.error)
    return (
      <ErrorPanel
        error={query.error}
        unavailableTitle={session.holder ? pages.requestUnavailable : undefined}
      />
    );
  return (
    <DraftWithTarget
      entities={entities}
      request={request}
      draft={query.data}
      reread={() => void query.refetch()}
      useTask={useTask}
      onDirtyChange={onDirtyChange}
    />
  );
}

/** Reads the record a draft changes; a target that cannot be read leaves the form to say so. */
function DraftWithTarget({
  entities,
  request,
  draft,
  reread,
  useTask,
  onDirtyChange,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  draft: RecordView;
  /** Reads the draft again, for the comparison a stale refusal shows. */
  reread: () => void;
  useTask: () => ChangeRequestTask;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const record = recordOfRequest(
    entities,
    request,
    (draft.request?.entry ?? draft.request?.target)?.entity,
  );
  const query = useRecord(
    record.id,
    readableTarget({ ...entities, record }, draft.request),
  );
  const action = useOpenedAction(
    draft.actions.find((item) => item.name === "patch"),
  );
  if (query.isLoading) return <Loading />;
  if (!action) return <UnavailableWrite />;
  return (
    <RequestForm
      key={draft.id}
      entities={entities}
      record={record}
      request={request}
      action={action}
      target={query.data}
      draft={draft}
      reread={reread}
      useTask={useTask}
      onDirtyChange={onDirtyChange}
    />
  );
}

/** The request field a verified answer names, by its id or its wire name. */
function evidenceFieldOf(
  fields: readonly FieldModel[],
  name: string | undefined,
): FieldModel | undefined {
  return name === undefined
    ? undefined
    : fields.find((field) => field.id === name || field.apiName === name);
}

/** A value in the words its field model describes, as a block. */
function ValueBlock({
  field,
  value,
}: {
  field: FieldModel;
  value: JsonValue | undefined;
}) {
  return (
    <div>
      <FieldValue field={field} value={value} />
    </div>
  );
}

function RequestForm({
  entities,
  record,
  request,
  action,
  target,
  draft,
  reread,
  useTask,
  onDirtyChange,
}: {
  entities: RegisterEntities;
  /** The record entity the request changes. */
  record: EntityModel;
  request: EntityModel;
  action: RecordActionReference;
  /** The record the request changes, when it could be read. */
  target?: RecordView;
  /** The draft being edited; absent for a create. */
  draft?: RecordView;
  /** Reads the draft again; given with a draft. */
  reread?: () => void;
  useTask: () => ChangeRequestTask;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    locale = useLocale(),
    routes = useRegisterRoutes(),
    route = useRoute(),
    session = useAuthority(),
    task = useTask();
  const fields = (action.fields ?? []).filter((field) => !field.readOnly);
  const written = writtenFields({ record, request }, fields);
  const comparesExisting = written.length > 0;
  const writtenIds = written.map((item) => item.field.id);
  const others = fields.filter((field) => !writtenIds.includes(field.id));
  const { values, errors, errorFocusRequest, setValue, showErrors } =
    useFormAnswers(() =>
      formValues(
        fields,
        draft
          ? draft.values
          : Object.fromEntries(
              written.map((item) => [
                item.field.id,
                target?.values[item.target.id],
              ]),
            ),
      ),
    );
  const prefill = usePrefill(action.ref);
  const { evidenceRef, accepted: acceptedPrefill } = prefill;
  const initialValues = useRef(values);
  // The revision the last save was sent against, so a refusal's comparison
  // waits for the reread that carries what the registry holds now.
  const sentRevision = useRef<string | undefined>(undefined);
  const [resolution, setResolution] = useState<"kept" | "taken" | null>(null);
  const resolutionNote = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (resolution) resolutionNote.current?.focus();
  }, [resolution]);
  // A save refused as stale reads the draft once, for what it holds now.
  useEffect(() => {
    if (task.staleConflict) reread?.();
  }, [task.staleConflict]);
  const conflict =
    draft !== undefined &&
    task.staleConflict === true &&
    draft.revision !== sentRevision.current;
  const latestValues = draft && formValues(fields, draft.values);
  const dirty =
    task.result?.outcome !== "confirmed" &&
    (fields.some(
      (field) => !sameAnswer(values[field.id], initialValues.current[field.id]),
    ) ||
      evidenceRef !== undefined);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );
  const [checking, setChecking] = useState(false);
  const returnToField = useRef<string | null>(null);
  useEffect(() => {
    if (checking || !returnToField.current) return;
    document.getElementById(returnToField.current)?.focus();
    returnToField.current = null;
  }, [checking]);
  // A refusal of a field arrives once the save settles. The check step has no
  // inputs to carry it, so the form returns with a fresh summary, which takes focus.
  const [refusals, setRefusals] = useState(0);
  const refusedFields = JSON.stringify(task.fieldErrors);
  useEffect(() => {
    if (task.pending || !checking || !Object.keys(task.fieldErrors).length)
      return;
    setChecking(false);
    setRefusals((count) => count + 1);
  }, [task.pending, refusedFields]);
  const canChange = !task.locked;
  function changeAnswer(field: string) {
    if (!canChange) return;
    returnToField.current = field;
    setChecking(false);
  }
  const current = (item: WrittenField) =>
    currentValue(item.target, target, draft?.request);
  // The verified answer this form holds: one accepted now, or one the draft retained.
  const draftEvidence = draft?.request?.evidence;
  const verified = acceptedPrefill
    ? { field: acceptedPrefill.field, value: acceptedPrefill.value }
    : draftEvidence?.status === "verified"
      ? { field: draftEvidence.field, value: draftEvidence.sourceValue }
      : null;
  const verifiedField = evidenceFieldOf(fields, verified?.field);
  const diverged = (field: FieldModel) =>
    verified !== null &&
    field.id === verifiedField?.id &&
    values[field.id] !== verified.value;
  function acceptProposal(proposal: VerifiedPrefill) {
    const field = evidenceFieldOf(fields, proposal.field);
    if (prefill.accept(proposal, field !== undefined) && field)
      setValue(field, proposal.value);
  }
  function validate() {
    const next = valueErrors(fields, values, block, locale);
    const first = written[0];
    if (
      first &&
      written.every((item) => {
        const known = current(item);
        return known !== undefined && sameAnswer(values[item.field.id], known);
      })
    )
      next[first.field.id] = pages.unchangedError;
    return showErrors(next);
  }
  function keepMine() {
    if (latestValues) initialValues.current = latestValues;
    task.reset?.();
    setResolution("kept");
  }
  function takeLatest() {
    if (!latestValues) return;
    for (const field of fields) setValue(field, latestValues[field.id]);
    initialValues.current = latestValues;
    task.reset?.();
    setResolution("taken");
  }
  async function save() {
    if (!validate()) return;
    sentRevision.current = draft?.revision;
    setResolution(null);
    await task.submit(
      draft
        ? recordTask(
            action,
            { entity: draft.entity, id: draft.id },
            { values, expectedRevision: draft.revision, evidenceRef },
          )
        : recordTask(
            action,
            target && { entity: target.entity, id: target.id },
            { values, evidenceRef },
          ),
    );
  }
  const locked = task.locked;
  // The steps are a holder's own; staff keep the form on its own.
  const takesDocuments = Boolean(request.operations.attachments?.length);
  // A create with no record it changes was opened from the start place. It
  // has no recorded values to show or compare against, and the host serves
  // no verified prefill for a start.
  const started = !draft && !target;
  // The form leads back to the page its route says it was opened from, else
  // to the record it changes, and a start to the start place, which only the
  // staff app has; a holder's app goes home.
  const back =
    backPathOf(splitRoute(route).query) ??
    (draft
      ? recordPath(routes, entities, draft.entity, draft.id)
      : target
        ? recordPath(routes, entities, target.entity, target.id)
        : session.holder
          ? "/"
          : startsPath) ??
    "/";
  const problems = task.fieldErrors;
  function input(field: FieldModel) {
    return (
      <FieldControl
        key={field.id}
        field={field}
        value={values[field.id]}
        onChange={(value) => setValue(field, value)}
        error={errors[field.id] ?? problems[field.id]}
        note={diverged(field) && <p>{block.prefillChanged}</p>}
      />
    );
  }
  return (
    <>
      <BackLink href={back}>{pages.back}</BackLink>
      {session.holder && (
        <HolderSteps current="answers" documents={takesDocuments} />
      )}
      <PageHeading
        eyebrow={
          (target && recordTitle(record, target, locale)) ??
          (draft && recordTitle(request, draft, locale))
        }
        title={
          checking
            ? pages.checkTitle
            : createWords(
                pages,
                "changeFormTitle",
                action.label ?? request.label,
                request.label,
                locale,
              )
        }
        description={
          checking
            ? pages.checkDescription
            : createWords(
                pages,
                "changeFormDescription",
                request.createDescription,
                request.label,
                locale,
              )
        }
      />
      <div className="task-layout">
        <div className="card form-card">
          {resolution && (
            <p
              ref={resolutionNote}
              role="status"
              tabIndex={-1}
              className="muted"
            >
              {resolution === "kept" ? block.conflictKept : block.conflictTaken}
            </p>
          )}
          <ErrorSummary
            key={refusals}
            errors={{ ...errors, ...problems }}
            fields={fields}
            focusRequest={errorFocusRequest}
          />
          {checking ? (
            <>
              {!started && comparesExisting && (
                <div className="comparison">
                  <section>
                    <ValueScope label={pages.scopeReviewBefore}>
                      <h2 className="eyebrow">{pages.before}</h2>
                      {written.map((item) => {
                        const known = current(item);
                        return (
                          <Fragment key={item.field.id}>
                            <h3>{item.target.label}</h3>
                            {known === undefined ? (
                              <p>{pages.originalValueUnavailable}</p>
                            ) : (
                              <ValueBlock field={item.target} value={known} />
                            )}
                          </Fragment>
                        );
                      })}
                    </ValueScope>
                  </section>
                  <section>
                    <ValueScope label={pages.scopeReviewAfter}>
                      <h2 className="eyebrow">{pages.after}</h2>
                      {written.map((item) => (
                        <Fragment key={item.field.id}>
                          <h3>{item.target.label}</h3>
                          <ValueBlock
                            field={item.target}
                            value={values[item.field.id]}
                          />
                          {canChange && (
                            <Button
                              variant="ghost"
                              className="change-answer"
                              onClick={() => changeAnswer(item.field.id)}
                            >
                              {fill(
                                block.changeAnswer,
                                { field: inSentence(item.field.label, locale) },
                                locale,
                              )}
                            </Button>
                          )}
                        </Fragment>
                      ))}
                    </ValueScope>
                  </section>
                </div>
              )}
              <AnswerList
                items={(started ? fields : others).map((field) => ({
                  key: field.id,
                  label: field.label,
                  value:
                    field.type === "boolean" &&
                    values[field.id] === undefined ? (
                      block.notSupplied
                    ) : (
                      <FieldValue field={field} value={values[field.id]} />
                    ),
                  note: (
                    <>
                      {verified && field.id === verifiedField?.id && (
                        <p className="muted">
                          {fill(
                            block.labelledSentence,
                            {
                              label: block.prefillVerified,
                              value: verified.value ? block.yes : block.no,
                            },
                            locale,
                          )}{" "}
                          {diverged(field) ? block.prefillChanged : ""}
                        </p>
                      )}
                      {canChange && (
                        <Button
                          variant="ghost"
                          className="change-answer"
                          onClick={() => changeAnswer(field.id)}
                        >
                          {fill(
                            block.changeAnswer,
                            { field: inSentence(field.label, locale) },
                            locale,
                          )}
                        </Button>
                      )}
                    </>
                  ),
                }))}
              />
              <p className="muted">{pages.submitNotice}</p>
              <div className="actions">
                <Button disabled={locked} onClick={() => void save()}>
                  {draft ? pages.saveChanges : pages.saveDraft}
                </Button>
                <Button
                  variant="outline"
                  disabled={locked}
                  onClick={() => setChecking(false)}
                >
                  {pages.changeAnswers}
                </Button>
              </div>
            </>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (validate()) setChecking(true);
              }}
            >
              <fieldset disabled={locked}>
                {!started &&
                  session.holder &&
                  session.capabilities.verifiedPrefill && (
                    <VerifiedPrefillSection
                      heading={block.getVerifiedInformation}
                      disclosure={pages.prefillDisclosure}
                      requestLabel={pages.confirmPrefillRequest}
                      prefill={prefill}
                      onAccept={acceptProposal}
                      accepted={
                        acceptedPrefill && verifiedField
                          ? acceptedPrefill
                          : null
                      }
                      acceptedDiverged={
                        verifiedField ? diverged(verifiedField) : false
                      }
                      draftEvidence={draftEvidence}
                      draftDiverged={
                        verifiedField ? diverged(verifiedField) : false
                      }
                    />
                  )}
                <p className="muted">{pages.required}</p>
                {fields.map(input)}
                <div className="actions">
                  <Button type="submit">
                    {pages.checkAnswers}
                    <ArrowRight />
                  </Button>
                  <Button variant="outline" onClick={() => void save()}>
                    {pages.saveDraft}
                  </Button>
                  <Button render={<a href={`#${back}`} />} variant="ghost">
                    {pages.cancelEditing}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {conflict && latestValues ? (
            <ConflictComparison
              rows={conflictRows(
                fields,
                initialValues.current,
                values,
                latestValues,
              )}
              onKeepMine={keepMine}
              onTakeLatest={takeLatest}
            />
          ) : (
            <TaskFeedback
              task={task}
              reconcileHref={`#${requestRoute(entities, routes.requests, request.id)}`}
              confirmedLabel={
                session.holder ? pages.continueAfterWrite : pages.continueToSend
              }
              onConfirmed={(id) => {
                const path = session.holder
                  ? (takesDocuments ? documentsRoute : reviewRoute)(
                      routes,
                      entities,
                      request.id,
                      id,
                    )
                  : recordPath(routes, entities, request.id, id);
                if (path) navigate(path);
              }}
            />
          )}
        </div>
        {!started && comparesExisting && (
          <aside className="card context-card" aria-label={pages.before}>
            <ValueScope label={pages.scopeBesideForm}>
              <p className="eyebrow">{pages.before}</p>
              {written.map((item) => {
                const known = current(item);
                return (
                  <Fragment key={item.field.id}>
                    <h2>{item.target.label}</h2>
                    {known === undefined ? (
                      <p>{pages.originalValueUnavailable}</p>
                    ) : (
                      <ValueBlock field={item.target} value={known} />
                    )}
                  </Fragment>
                );
              })}
            </ValueScope>
            <p className="muted">{pages.recordNotice}</p>
          </aside>
        )}
      </div>
    </>
  );
}
