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
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import {
  ErrorSummary,
  RecordFormFields,
  soleChoice,
} from "@/blocks/record/record-form";
import { BackLink } from "@/blocks/shell/back-link";
import { PageHeading } from "@/blocks/shell/page-heading";
import {
  backToListOf,
  createWords,
  usePagesContent,
} from "@/blocks/pages/pages-content";
import { presetOf, returnPathOf } from "@/blocks/pages/record-route-query";
import {
  ActionWriteForm,
  OfferedStart,
  readableRecordPath,
  useFormRoute,
} from "@/blocks/pages/write-form-core";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  entityRoutes,
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
 * session. The fields, their words and the schema they are checked against
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

function CreateRecord({
  entities,
  entity,
  useTask,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  useTask: () => CreateRecordTask;
}) {
  return (
    <OfferedStart
      entity={entity.id}
      matches={(item) => item.name === "create" && item.entity === entity.id}
    >
      {(action) => (
        <CreateRecordForm
          entities={entities}
          entity={entity}
          action={action}
          useTask={useTask}
        />
      )}
    </OfferedStart>
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
    locale = useLocale(),
    appRoutes = useRegisterRoutes(),
    task = useTask();
  const routes = entityRoutes(appRoutes, entities, entity.id);
  const fields = (action.fields ?? []).filter((field) => !field.readOnly);
  const { preset, returnPath, backPath } = useFormRoute(fields);
  const leaveTo = returnPath ?? backPath;
  const ownEntity = entity.id === entities.record.id;
  if (!routes) return <UnavailableWrite />;
  return (
    <>
      <BackLink href={leaveTo ?? routes.records}>
        {leaveTo
          ? pages.back
          : backToListOf(pages, entity, ownEntity, locale)}
      </BackLink>
      <PageHeading
        title={
          ownEntity
            ? createWords(
                pages,
                "createTitle",
                action.label,
                entity.label,
                locale,
              )
            : createWords(
                pages,
                "addRecord",
                action.label,
                entity.label,
                locale,
              )
        }
        description={createWords(
          pages,
          "createDescription",
          entity.createDescription,
          entity.label,
          locale,
        )}
      />
      <ActionWriteForm
        action={action}
        fields={fields}
        preset={preset}
        task={task}
        submitLabel={createWords(
          pages,
          "createSubmit",
          action.label,
          entity.label,
          locale,
        )}
        cancelHref={leaveTo ?? (ownEntity ? "/" : routes.records)}
        returnPath={returnPath}
        confirmedPath={(resource) =>
          readableRecordPath(appRoutes, entities, resource)
        }
      />
    </>
  );
}
