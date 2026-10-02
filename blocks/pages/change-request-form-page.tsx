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
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { FieldControl } from "@/blocks/fields/field-control";
import { FieldValue } from "@/blocks/fields/field-value";
import { ErrorSummary } from "@/blocks/record/record-form";
import { AnswerList } from "@/blocks/request/request-form";
import { VerifiedPrefillSection } from "@/blocks/request/verified-prefill";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  readableTarget,
  recordPath,
  recordTitle,
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
  writtenFields,
  type WrittenField,
} from "@/blocks/request/request-changes";

/** The write `ChangeRequestFormPage` submits: a plain record task, unadapted. */
export type ChangeRequestTask = RecordTaskState<RecordTask>;

/**
 * A request to change one register record: a create from the record the
 * request changes, or the edit of a draft the session may still change. The
 * fields, their words and what the request writes come from the model,
 * never from an entity or field id in this file.
 */
export function ChangeRequestFormPage({
  recordId,
  requestId,
  useTask,
}: {
  /** The record this request changes; given when starting a new request. */
  recordId?: string;
  /** The draft being edited; given when opening a saved one. */
  requestId?: string;
  /** The write this page submits; a page instantiates it over its own host command. */
  useTask: () => ChangeRequestTask;
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
    />
  ) : (
    <NewRequestForm
      entities={entities}
      request={request}
      id={recordId!}
      useTask={useTask}
    />
  );
}

/**
 * The action a write form opened with, for as long as the form stays open.
 * The reread after a confirmed write may stop offering it (the request now
 * exists), and the form's outcome must outlive that.
 */
function useOpenedAction(action: RecordActionReference | undefined) {
  const opened = useRef(action);
  if (action) opened.current = action;
  return opened.current;
}

function NewRequestForm({
  entities,
  request,
  id,
  useTask,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  id: string;
  useTask: () => ChangeRequestTask;
}) {
  const query = useRecord(entities.record.id, id);
  const action = useOpenedAction(
    query.data?.actions.find(
      (item) => item.name === "create" && item.entity === request.id,
    ),
  );
  if (query.isPending) return <Loading />;
  if (!query.data || query.error) return <ErrorPanel error={query.error} />;
  if (!action) return <UnavailableWrite />;
  return (
    <RequestForm
      key={query.data.id}
      entities={entities}
      request={request}
      action={action}
      target={query.data}
      useTask={useTask}
    />
  );
}

function DraftRequestForm({
  entities,
  request,
  id,
  useTask,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  id: string;
  useTask: () => ChangeRequestTask;
}) {
  const pages = usePagesContent(),
    session = useAuthority(),
    query = useRecord(request.id, id);
  if (query.isPending) return <Loading />;
  if (!query.data || query.error)
    return (
      <ErrorPanel
        error={query.error}
        unavailableTitle={
          session.role === "holder" ? pages.requestUnavailable : undefined
        }
      />
    );
  return (
    <DraftWithTarget
      entities={entities}
      request={request}
      draft={query.data}
      useTask={useTask}
    />
  );
}

/** Reads the record a draft changes; a target that cannot be read leaves the form to say so. */
function DraftWithTarget({
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
  const query = useRecord(
    entities.record.id,
    readableTarget(entities, draft.request),
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
      request={request}
      action={action}
      target={query.data}
      draft={draft}
      useTask={useTask}
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
  request,
  action,
  target,
  draft,
  useTask,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  action: RecordActionReference;
  /** The record the request changes, when it could be read. */
  target?: RecordView;
  /** The draft being edited; absent for a create. */
  draft?: RecordView;
  useTask: () => ChangeRequestTask;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    routes = useRegisterRoutes(),
    session = useAuthority(),
    task = useTask();
  const fields = (action.fields ?? []).filter((field) => !field.readOnly);
  const written = writtenFields({ record: entities.record, request }, fields);
  const writtenIds = written.map((item) => item.field.id);
  const others = fields.filter((field) => !writtenIds.includes(field.id));
  const [values, setValues] = useState<Record<string, JsonValue>>(() =>
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
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [checking, setChecking] = useState(false);
  const returnToField = useRef<string | null>(null);
  useEffect(() => {
    if (checking || !returnToField.current) return;
    document.getElementById(returnToField.current)?.focus();
    returnToField.current = null;
  }, [checking]);
  const canChange = !task.locked;
  function changeAnswer(field: string) {
    if (!canChange) return;
    returnToField.current = field;
    setChecking(false);
  }
  function setValue(field: FieldModel, value: JsonValue | undefined) {
    setValues((previous) => {
      const next = { ...previous };
      if (value === undefined) delete next[field.id];
      else next[field.id] = value;
      return next;
    });
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
    const next = valueErrors(fields, values, request.rules, block);
    const first = written[0];
    if (
      first &&
      written.every((item) => {
        const known = current(item);
        return known !== undefined && sameAnswer(values[item.field.id], known);
      })
    )
      next[first.field.id] = pages.unchangedError;
    setErrors(next);
    return !Object.keys(next).length;
  }
  async function save() {
    if (!validate()) return;
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
  const back =
    (draft
      ? recordPath(routes, entities, draft.entity, draft.id)
      : target && recordPath(routes, entities, target.entity, target.id)) ??
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
      <PageHeading
        eyebrow={
          (target && recordTitle(entities.record, target)) ??
          (draft && recordTitle(request, draft))
        }
        title={checking ? pages.checkTitle : pages.changeFormTitle}
        description={
          checking ? pages.checkDescription : pages.changeFormDescription
        }
      />
      <div className="task-layout">
        <div className="card form-card">
          <ErrorSummary errors={{ ...errors, ...problems }} />
          {checking ? (
            <>
              <div className="comparison">
                <section>
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
                </section>
                <section>
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
                          {fill(block.changeAnswer, {
                            field: item.field.label.toLowerCase(),
                          })}
                        </Button>
                      )}
                    </Fragment>
                  ))}
                </section>
              </div>
              <AnswerList
                items={others.map((field) => ({
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
                          {block.prefillVerified}:{" "}
                          {verified.value ? block.yes : block.no}.{" "}
                          {diverged(field) ? block.prefillChanged : ""}
                        </p>
                      )}
                      {canChange && (
                        <Button
                          variant="ghost"
                          className="change-answer"
                          onClick={() => changeAnswer(field.id)}
                        >
                          {fill(block.changeAnswer, {
                            field: field.label.toLowerCase(),
                          })}
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
                {session.role === "holder" &&
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
          <TaskFeedback
            task={task}
            onConfirmed={(id) => {
              const path = recordPath(routes, entities, request.id, id);
              if (path) navigate(path);
            }}
          />
        </div>
        <aside className="card context-card" aria-label={pages.before}>
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
          <p className="muted">{pages.recordNotice}</p>
        </aside>
      </div>
    </>
  );
}
