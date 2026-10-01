import type {
  EntityModel,
  FieldModel,
  JsonSchema,
  RegistryModel,
  ReviewJson,
  ReviewTaskDetail,
} from "@registrystack/app-runtime";
import {
  bregReviewSubjectSource,
  entityTitle,
  fieldsFromJsonSchema,
  reviewShownValues,
  reviewSubjectEntity,
  reviewSubjectFromRegister,
  reviewSubjectTarget,
  reviewSubjectTitle,
} from "@registrystack/app-runtime";
import { useModel, useRecord } from "@registrystack/app-runtime/react";
import { FieldValue } from "@/blocks/fields/field-value";
import { Loading, Notice } from "@/blocks/casework/shared";
import { useCaseworkContent } from "@/blocks/casework/casework-content";

/**
 * What a reviewer sees of a task's subject. A BREG record reads its own live
 * fields; anything else, including a Casework queue with no BREG behind it at
 * all, reads the values the requester submitted or the source projected,
 * through the review kind's own display schema. A request of the register
 * reads those values under the model's own labels, option words and item
 * fields, and a value that names a register record reads as that record's
 * title. Given no model, only `BregSubject` calls `useModel`, and only a
 * register subject calls `useRecord`: a host with no BREG never mounts
 * either, so it never needs the model or record routes.
 */

/** The display schema as an object schema, whatever shape a policy served it in. */
function asObjectSchema(value: ReviewJson): JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
}

/** A record's title: its entity's title template or field, as a record page titles it. */
function titleOf(
  entity: EntityModel,
  values: Readonly<Record<string, unknown>>,
): string | undefined {
  return entityTitle(entity, (field) => values[field.id]);
}

/** A register record a submitted value names, read as its title. */
function ReferencedRecord({ entity, id }: { entity: EntityModel; id: string }) {
  const c = useCaseworkContent();
  const record = useRecord(entity.id, id);
  if (record.isPending) return <Loading />;
  if (record.error || !record.data) return <>{c.referenceUnavailable}</>;
  return <>{titleOf(entity, record.data.values) ?? entity.label}</>;
}

/** One value of the subject; one that names a register record reads as that record. */
function SubjectValue({
  field,
  value,
  model,
}: {
  field: FieldModel;
  value: ReviewJson | undefined;
  model?: RegistryModel;
}) {
  const c = useCaseworkContent();
  if (field.reference && model && typeof value === "string" && value !== "") {
    const entity = model.entities.find((e) => e.id === field.reference?.entity);
    return entity ? (
      <ReferencedRecord entity={entity} id={value} />
    ) : (
      <>{c.referenceUnavailable}</>
    );
  }
  return <FieldValue field={field} value={value} />;
}

function SchemaSubject({
  task,
  entity,
  model,
}: {
  task: ReviewTaskDetail;
  entity?: EntityModel;
  model?: RegistryModel;
}) {
  const c = useCaseworkContent();
  // The register's own field, where it has one by the same API name, carries
  // the model's label, option words and item fields; the schema has only names.
  const fields = fieldsFromJsonSchema(
    asObjectSchema(task.policy.displaySchema),
  ).map(
    (field) =>
      entity?.fields.find((own) => own.apiName === field.apiName) ?? field,
  );
  const shown = reviewShownValues(task.context);
  if (fields.length === 0) return <p className="muted">{c.contextEmpty}</p>;
  return (
    <dl>
      {fields.map((field) => (
        <div key={field.id}>
          <dt>{field.label}</dt>
          <dd>
            <SubjectValue
              field={field}
              value={shown[field.apiName]}
              model={model}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BregRecordSubject({
  entity,
  subjectId,
  model,
}: {
  entity: EntityModel;
  subjectId: string;
  model: RegistryModel;
}) {
  const c = useCaseworkContent();
  const record = useRecord(entity.id, subjectId);
  if (record.isPending) return <Loading />;
  if (record.error || !record.data)
    return <Notice tone="warning">{c.recordUnavailable}</Notice>;
  if (entity.fields.length === 0) return <p className="muted">{c.contextEmpty}</p>;
  const values = record.data.values;
  return (
    <dl>
      {entity.fields.map((field) => (
        <div key={field.id}>
          <dt>{field.label}</dt>
          <dd>
            <SubjectValue field={field} value={values[field.id]} model={model} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A subject read against the registry model: the register's own, or anything else. */
function RegisterSubject({
  task,
  model,
}: {
  task: ReviewTaskDetail;
  model: RegistryModel;
}) {
  const entity = reviewSubjectEntity(task.subject, model);
  if (entity?.kind === "record")
    return (
      <BregRecordSubject entity={entity} subjectId={task.subject.id} model={model} />
    );
  return (
    <SchemaSubject task={task} entity={entity} model={entity ? model : undefined} />
  );
}

function BregSubject({ task }: { task: ReviewTaskDetail }) {
  const model = useModel();
  // A model still loading, or one with no matching record entity, falls back
  // to what the task itself carries: a task always has a submitted snapshot
  // or a source projection, so the reviewer is never left with nothing.
  if (model.isPending) return <Loading />;
  if (!model.data) return <SchemaSubject task={task} />;
  return <RegisterSubject task={task} model={model.data} />;
}

/**
 * The task's subject, rendered for a reviewer to read before deciding. A page
 * that already read the registry model passes it; without one, a subject
 * whose source is not BREG's never reads the model.
 */
export function Subject({
  task,
  model,
}: {
  task: ReviewTaskDetail;
  model?: RegistryModel;
}) {
  if (model) return <RegisterSubject task={task} model={model} />;
  return task.subject.source === bregReviewSubjectSource ? (
    <BregSubject task={task} />
  ) : (
    <SchemaSubject task={task} />
  );
}

/**
 * The words a review task is named by, from what the host serves: the source's
 * own display reference, then for a subject of the register the title of the
 * record it is about, then its own title. A subject another producer
 * submitted may be named by its requester reference, which such a producer
 * sets to its own reference; BREG sets it to a keyed pseudonym, which names
 * nobody a reviewer knows, so a subject of the register never is.
 * `loading` holds while the record's title is read.
 */
export function useSubjectReference(
  task: ReviewTaskDetail,
  model: RegistryModel | undefined,
): {
  reference: string | undefined;
  entity: EntityModel | undefined;
  loading: boolean;
} {
  const fromRegister =
    model !== undefined && reviewSubjectFromRegister(task.subject, model);
  const entity = model ? reviewSubjectEntity(task.subject, model) : undefined;
  const target = entity ? reviewSubjectTarget(task, entity) : undefined;
  const targetEntity = target
    ? model?.entities.find((e) => e.id === target.entity)
    : undefined;
  const record = useRecord(
    targetEntity?.id ?? "",
    targetEntity && target ? target.id : "",
  );
  const displayReference =
    task.context.strategy === "source" && task.context.displayReference
      ? task.context.displayReference
      : undefined;
  const title =
    targetEntity && record.data
      ? titleOf(targetEntity, record.data.values)
      : undefined;
  const reference = fromRegister
    ? (displayReference ??
      title ??
      (entity ? reviewSubjectTitle(task, entity) : undefined))
    : (displayReference ?? (task.requesterReference || undefined));
  return {
    reference,
    entity,
    loading: Boolean(targetEntity) && record.isLoading,
  };
}
