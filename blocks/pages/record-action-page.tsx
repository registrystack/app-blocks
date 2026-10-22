import { useState, type FormEvent } from "react";
import {
  recordPreset,
  type EntityModel,
  type RecordActionReference,
  type RecordTask,
  type RecordView,
} from "@registrystack/app-runtime";
import {
  formValues,
  recordTask,
  useRecord,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
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
  ActionWriteForm,
  OfferedStart,
  readableRecordPath,
  useFormRoute,
  useOpenedAction,
} from "@/blocks/pages/write-form-core";
import { backToListOf, usePagesContent } from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  entityRoutes,
  fieldOf,
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
  return (
    <OfferedStart
      entity={entity.id}
      matches={(item) =>
        item.name === "invoke" &&
        item.entity === entity.id &&
        item.actionId === actionId
      }
    >
      {(action) => (
        <RecordActionForm
          entities={entities}
          entity={entity}
          action={action}
          useTask={useTask}
        />
      )}
    </OfferedStart>
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
  // An action the registry would refuse for this record now is not opened.
  if (!action || action.availability) return <UnavailableWrite />;
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
    locale = useLocale(),
    appRoutes = useRegisterRoutes(),
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
  // An input filled from the record the action is taken on reads that record;
  // a source input the form holds names its own record, even of this type.
  const anchorSources = Object.fromEntries(
    record
      ? fields.flatMap((field) =>
          field.fillFrom?.entity === entity.id &&
          !fields.some((item) => item.id === field.fillFrom!.input)
            ? [[field.fillFrom.input, record.id]]
            : [],
        )
      : [],
  );
  if (!routes) return <UnavailableWrite />;
  // Where the page leaves to: the path a link asked for, else the page it was
  // opened from, else the record the action is taken on, else the entity's list.
  const leaveTo =
    returnPath ??
    asked.backPath ??
    (record ? routes.record(record.id) : routes.records);
  return (
    <>
      <BackLink href={leaveTo}>
        {returnPath || asked.backPath || record
          ? pages.back
          : backToListOf(pages, entity, entity.id === entities.record.id, locale)}
      </BackLink>
      <PageHeading
        eyebrow={
          record ? (recordTitle(entity, record, locale) ?? entity.label) : undefined
        }
        title={action.label ?? action.actionId ?? ""}
        description={pages.actionDescription}
      />
      <ActionWriteForm
        action={action}
        fields={fields}
        preset={preset}
        anchorSources={anchorSources}
        anchorLabel={(field) => {
          const from = field.fillFrom!;
          const owner = [
            entities.record,
            ...(entities.records ?? []),
            ...(entities.requests ?? []),
          ].find((item) => item.id === from.entity);
          return (owner && fieldOf(owner, from.field)?.label) ?? from.field;
        }}
        task={task}
        submitLabel={pages.actionSubmit}
        cancelHref={leaveTo}
        returnPath={returnPath}
        confirmedPath={(resource) =>
          readableRecordPath(appRoutes, entities, resource)
        }
      />
    </>
  );
}
