import { useState, type FormEvent } from "react";
import type {
  EntityModel,
  FieldModel,
  JsonValue,
  RecordActionReference,
  RecordTask,
  RecordView,
} from "@registrystack/app-runtime";
import {
  formValues,
  recordTask,
  useRecord,
  useRecords,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import {
  ErrorSummary,
  RecordFormFields,
  soleChoice,
} from "@/blocks/record/record-form";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate } from "@/blocks/shell/routing";
import {
  useFormRoute,
  useOpenedAction,
} from "@/blocks/pages/create-record-page";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  entityRoutes,
  fieldOf,
  recordPath,
  RecordEntityGate,
  recordTitle,
  useOptionLabel,
  UnavailableWrite,
  type RecordTaskState,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { valueErrors } from "@/blocks/fields/value-errors";

/** The write `RecordActionPage` submits: a plain record task, unadapted. */
export type RecordActionTask = RecordTaskState<RecordTask>;

/**
 * One of the registry's governed actions, invoked with the inputs the host
 * offers it with. Without `recordId` it is one whose result lands in the
 * entity's records, offered by the entity's record list; with it, one taken
 * on that record, offered by the record read, and every input that names this
 * record is preset and shown read-only. Its label, its inputs and their words
 * come from the action the host serves, never from an action, entity or field
 * id in this file; the registry checks the inputs and decides what the action
 * writes.
 */
export function RecordActionPage({
  actionId,
  recordId,
  entity,
  useTask,
}: {
  /** The governed action's id, as the route names it. */
  actionId: string;
  /** The record the action is taken on, for an action offered on a record. */
  recordId?: string;
  /** The entity's id; the register's own record entity when left out. */
  entity?: string;
  /** The write this page submits; a page instantiates it over its own host command. */
  useTask: () => RecordActionTask;
}) {
  return (
    <RecordEntityGate entity={entity}>
      {(entities, model) =>
        recordId === undefined ? (
          <RecordAction
            entities={entities}
            entity={model}
            actionId={actionId}
            useTask={useTask}
          />
        ) : (
          <RecordScopedAction
            entities={entities}
            entity={model}
            recordId={recordId}
            actionId={actionId}
            useTask={useTask}
          />
        )
      }
    </RecordEntityGate>
  );
}

function RecordAction({
  entities,
  entity,
  actionId,
  useTask,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  actionId: string;
  useTask: () => RecordActionTask;
}) {
  // The same read as the record list, so the action it offered is the one used.
  const query = useRecords(entity.id, {});
  const action = useOpenedAction(
    query.data?.actions?.find(
      (item) =>
        item.name === "invoke" &&
        item.entity === entity.id &&
        item.actionId === actionId,
    ),
  );
  if (query.isPending) return <Loading />;
  if (!query.data || query.error)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  if (!action) return <UnavailableWrite />;
  return (
    <RecordActionForm
      entities={entities}
      entity={entity}
      action={action}
      useTask={useTask}
    />
  );
}

function RecordScopedAction({
  entities,
  entity,
  recordId,
  actionId,
  useTask,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  recordId: string;
  actionId: string;
  useTask: () => RecordActionTask;
}) {
  // The same read as the record page, so the action it offered is the one used.
  const query = useRecord(entity.id, recordId);
  const action = useOpenedAction(
    query.data?.actions.find(
      (item) => item.name === "invoke" && item.actionId === actionId,
    ),
  );
  if (query.isPending) return <Loading />;
  if (!query.data || query.error)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  if (!action) return <UnavailableWrite />;
  return (
    <RecordActionForm
      entities={entities}
      entity={entity}
      action={action}
      record={query.data}
      useTask={useTask}
    />
  );
}

/**
 * The answers an action taken on `record` is given: every input that names
 * this entity holds the record's id, and every input that shares its id with
 * a field of the record naming the same entity holds the record's value.
 */
function recordPreset(
  entity: EntityModel,
  record: RecordView,
  fields: readonly FieldModel[],
): Record<string, JsonValue> {
  const preset: Record<string, JsonValue> = {};
  for (const field of fields) {
    const target = field.reference?.entity;
    if (!target) continue;
    const held = record.values[field.id];
    if (target === entity.id) preset[field.id] = record.id;
    else if (
      fieldOf(entity, field.id)?.reference?.entity === target &&
      held !== undefined &&
      held !== null
    )
      preset[field.id] = held;
  }
  return preset;
}

function RecordActionForm({
  entities,
  entity,
  action,
  record,
  useTask,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  action: RecordActionReference;
  /** The record the action is taken on, when it is one offered on a record. */
  record?: RecordView;
  useTask: () => RecordActionTask;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    appRoutes = useRegisterRoutes(),
    word = useOptionLabel(),
    task = useTask();
  const routes = entityRoutes(appRoutes, entities, entity.id);
  const fields = (action.fields ?? []).filter((field) => !field.readOnly);
  const asked = useFormRoute(fields);
  const returnPath = asked.returnPath;
  // What the record gives an input wins over what a link asks for.
  const preset = {
    ...asked.preset,
    ...(record ? recordPreset(entity, record, fields) : {}),
  };
  // A required answer that may be blank starts blank, so it is always sent.
  const [values, setValues] = useState<Record<string, JsonValue>>(() =>
    formValues(
      fields,
      Object.fromEntries(
        fields.map((field) => [
          field.id,
          preset[field.id] ??
            soleChoice(field) ??
            (field.required && field.acceptsBlank ? "" : undefined),
        ]),
      ),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  function setValue(field: FieldModel, value: JsonValue | undefined) {
    setValues((previous) => {
      const next = { ...previous };
      if (value === undefined) delete next[field.id];
      else next[field.id] = value;
      return next;
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const sent = { ...values, ...preset };
    // An action's inputs carry their own schema; no entity rule applies to them.
    const next = valueErrors(fields, sent, [], block);
    setErrors(next);
    if (Object.keys(next).length) return;
    await task.submit(recordTask(action, undefined, { values: sent }));
  }
  if (!routes) return <UnavailableWrite />;
  // Where the page leaves to: the path a link asked for, else the record the
  // action is taken on, else the entity's list.
  const leaveTo =
    returnPath ?? (record ? routes.record(record.id) : routes.records);
  return (
    <>
      <BackLink href={leaveTo}>
        {returnPath || record
          ? pages.back
          : entity.id === entities.record.id
            ? pages.backToRecords
            : fill(pages.backToList, { label: entity.pluralLabel })}
      </BackLink>
      <PageHeading
        eyebrow={record ? (recordTitle(entity, record) ?? entity.label) : undefined}
        title={action.label ?? action.actionId ?? ""}
        description={pages.actionDescription}
      />
      <form
        className="card form-card"
        noValidate
        onSubmit={(e) => void submit(e)}
      >
        <ErrorSummary
          errors={{ ...errors, ...task.fieldErrors }}
          fields={fields}
        />
        <p className="muted">{pages.required}</p>
        <fieldset disabled={task.locked}>
          <RecordFormFields
            fields={fields}
            values={values}
            errors={{ ...task.fieldErrors, ...errors }}
            onChange={setValue}
            optionLabel={word}
            preset={preset}
          />
          <div className="actions">
            <Button type="submit">{pages.actionSubmit}</Button>
            <Button render={<a href={`#${leaveTo}`} />} variant="ghost">
              {pages.cancel}
            </Button>
          </div>
        </fieldset>
        <TaskFeedback
          task={task}
          confirmedLabel={
            returnPath ? pages.continueAfterWrite : block.viewRecord
          }
          onConfirmed={(id) => {
            const path =
              returnPath ?? recordPath(appRoutes, entities, entity.id, id);
            if (path) navigate(path);
          }}
        />
      </form>
    </>
  );
}
