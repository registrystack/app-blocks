import { useRef, useState, type FormEvent } from "react";
import type {
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
import { navigate } from "@/blocks/shell/routing";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  recordPath,
  useOptionLabel,
  useRegister,
  UnavailableWrite,
  valueErrors,
  type RecordTaskState,
  type RegisterEntities,
} from "@/blocks/pages/record";

/** The write `CreateRecordPage` submits: a plain record task, unadapted. */
export type CreateRecordTask = RecordTaskState<RecordTask>;

/**
 * A register record, created with the create action the record list offers
 * this session. The fields, their words and the rules they are checked
 * against come from the model and the action, never from an entity or field
 * id in this file.
 */
export function CreateRecordPage({
  useTask,
}: {
  /** The write this page submits; a page instantiates it over its own host command. */
  useTask: () => CreateRecordTask;
}) {
  const register = useRegister();
  if (register.isPending) return <Loading />;
  const entities = register.entities;
  if (register.error || !entities)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  return <CreateRecord entities={entities} useTask={useTask} />;
}

/**
 * The action a write form opened with, for as long as the form stays open.
 * The reread after a confirmed write may stop offering it (the record now
 * exists), and the form's outcome must outlive that.
 */
function useOpenedAction(action: RecordActionReference | undefined) {
  const opened = useRef(action);
  if (action) opened.current = action;
  return opened.current;
}

function CreateRecord({
  entities,
  useTask,
}: {
  entities: RegisterEntities;
  useTask: () => CreateRecordTask;
}) {
  const entity = entities.record;
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
    <CreateRecordForm entities={entities} action={action} useTask={useTask} />
  );
}

function CreateRecordForm({
  entities,
  action,
  useTask,
}: {
  entities: RegisterEntities;
  action: RecordActionReference;
  useTask: () => CreateRecordTask;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    routes = useRegisterRoutes(),
    word = useOptionLabel(),
    task = useTask();
  const entity = entities.record;
  const fields = (action.fields ?? []).filter((field) => !field.readOnly);
  // A required answer that may be blank starts blank, so it is always sent.
  const [values, setValues] = useState<Record<string, JsonValue>>(() =>
    formValues(
      fields,
      Object.fromEntries(
        fields.map((field) => [
          field.id,
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
    const next = valueErrors(fields, values, entity.rules, block);
    setErrors(next);
    if (Object.keys(next).length) return;
    await task.submit(recordTask(action, undefined, { values }));
  }
  return (
    <>
      <BackLink href={routes.records}>{pages.backToRecords}</BackLink>
      <PageHeading
        title={pages.createTitle}
        description={pages.createDescription}
      />
      <form
        className="card form-card"
        noValidate
        onSubmit={(e) => void submit(e)}
      >
        <ErrorSummary errors={{ ...errors, ...task.fieldErrors }} />
        <p className="muted">{pages.required}</p>
        <fieldset disabled={task.locked}>
          <RecordFormFields
            fields={fields}
            values={values}
            errors={{ ...task.fieldErrors, ...errors }}
            onChange={setValue}
            optionLabel={word}
          />
          <div className="actions">
            <Button type="submit">{pages.createSubmit}</Button>
            <Button render={<a href="#/" />} variant="ghost">
              {pages.cancel}
            </Button>
          </div>
        </fieldset>
        <TaskFeedback
          task={task}
          confirmedLabel={block.viewRecord}
          onConfirmed={(id) => {
            const path = recordPath(routes, entities, entity.id, id);
            if (path) navigate(path);
          }}
        />
      </form>
    </>
  );
}
