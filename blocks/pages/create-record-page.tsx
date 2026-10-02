import { useRef, useState, type FormEvent } from "react";
import type {
  EntityModel,
  FieldModel,
  JsonValue,
  RecordActionReference,
  RecordTask,
} from "@registrystack/app-runtime";
import {
  formValues,
  recordTask,
  useRecords,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import {
  ErrorSummary,
  RecordFormFields,
  soleChoice,
} from "@/blocks/record/record-form";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { fill } from "@/blocks/lib/format";
import { createWords, usePagesContent } from "@/blocks/pages/pages-content";
import { presetOf, returnPathOf } from "@/blocks/pages/record-route-query";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  entityRoutes,
  recordPath,
  RecordEntityGate,
  useOptionLabel,
  UnavailableWrite,
  type RecordTaskState,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { valueErrors } from "@/blocks/fields/value-errors";

/** The write `CreateRecordPage` submits: a plain record task, unadapted. */
export type CreateRecordTask = RecordTaskState<RecordTask>;

/**
 * A record of one record entity, the register's own when `entity` is left
 * out, created with the create action the entity's record list offers this
 * session. The fields, their words and the rules they are checked against
 * come from the model and the action, never from an entity or field id in
 * this file. The route's query may preset answers, which show read-only and
 * are sent with the submission, and name the path to return to afterwards.
 */
export function CreateRecordPage({
  entity,
  useTask,
}: {
  /** The entity's id; the register's own record entity when left out. */
  entity?: string;
  /** The write this page submits; a page instantiates it over its own host command. */
  useTask: () => CreateRecordTask;
}) {
  return (
    <RecordEntityGate entity={entity}>
      {(entities, model) => (
        <CreateRecord entities={entities} entity={model} useTask={useTask} />
      )}
    </RecordEntityGate>
  );
}

/**
 * The answers a route presets for `fields`, and the path it asks to return
 * to. A preset for a field the form does not offer is dropped, so a link can
 * never send an answer the action does not ask for.
 */
export function useFormRoute(fields: readonly FieldModel[]) {
  const { query } = splitRoute(useRoute());
  const asked = presetOf(query);
  const preset: Record<string, JsonValue> = {};
  for (const field of fields)
    if (field.id in asked) preset[field.id] = asked[field.id]!;
  return { preset, returnPath: returnPathOf(query) };
}

/**
 * The action a write form opened with, for as long as the form stays open.
 * The reread after a confirmed write may stop offering it (the record now
 * exists), and the form's outcome must outlive that.
 */
export function useOpenedAction(action: RecordActionReference | undefined) {
  const opened = useRef(action);
  if (action) opened.current = action;
  return opened.current;
}

function CreateRecord({
  entities,
  entity,
  useTask,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  useTask: () => CreateRecordTask;
}) {
  // The same read as the record list, so the create it offered is the one used.
  const query = useRecords(entity.id, {});
  const action = useOpenedAction(
    query.data?.actions?.find(
      (item) => item.name === "create" && item.entity === entity.id,
    ),
  );
  if (query.isPending) return <Loading />;
  if (!query.data || query.error)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  if (!action) return <UnavailableWrite />;
  return (
    <CreateRecordForm
      entities={entities}
      entity={entity}
      action={action}
      useTask={useTask}
    />
  );
}

function CreateRecordForm({
  entities,
  entity,
  action,
  useTask,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  action: RecordActionReference;
  useTask: () => CreateRecordTask;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    appRoutes = useRegisterRoutes(),
    word = useOptionLabel(),
    task = useTask();
  const routes = entityRoutes(appRoutes, entities, entity.id);
  const fields = (action.fields ?? []).filter((field) => !field.readOnly);
  const { preset, returnPath } = useFormRoute(fields);
  const ownEntity = entity.id === entities.record.id;
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
    const next = valueErrors(fields, sent, entity.rules, block);
    setErrors(next);
    if (Object.keys(next).length) return;
    await task.submit(recordTask(action, undefined, { values: sent }));
  }
  if (!routes) return <UnavailableWrite />;
  return (
    <>
      <BackLink href={returnPath ?? routes.records}>
        {returnPath
          ? pages.back
          : ownEntity
            ? pages.backToRecords
            : fill(pages.backToList, { label: entity.pluralLabel })}
      </BackLink>
      <PageHeading
        title={
          ownEntity
            ? createWords(pages, "createTitle", action.label, entity.label)
            : createWords(pages, "addRecord", action.label, entity.label)
        }
        description={createWords(
          pages,
          "createDescription",
          entity.createDescription,
          entity.label,
        )}
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
            <Button type="submit">
              {createWords(pages, "createSubmit", action.label, entity.label)}
            </Button>
            <Button
              render={
                <a
                  href={`#${returnPath ?? (ownEntity ? "/" : routes.records)}`}
                />
              }
              variant="ghost"
            >
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
