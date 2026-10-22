import type {
  EntityModel,
  JsonSchema,
  RegistryModel,
  ReviewJson,
  ReviewTaskDetail,
} from "@registrystack/app-runtime";
import {
  bregReviewSubjectSource,
  fieldsFromJsonSchema,
  reviewChangedRequestValues,
  reviewShownValues,
  reviewSubjectEntity,
  reviewSubjectFromRegister,
  reviewSubjectTarget,
  reviewSubjectTitle,
} from "@registrystack/app-runtime";
import { useModel, useRecord } from "@registrystack/app-runtime/react";
import { FieldValue } from "@/blocks/fields/field-value";
import { recordTitle } from "@/blocks/fields/reference-value";
import { Loading, Notice } from "@/blocks/casework/shared";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { useLocale } from "@/blocks/lib/content";

/**
 * What a reviewer sees of a task's subject. A BReg record reads its own live
 * fields; anything else, including a Casework queue with no BReg behind it at
 * all, reads the values the requester submitted or the source projected,
 * through the review policy's own display schema. A request of the register
 * reads those values under the model's own labels, option words and item
 * fields, a BReg `changes` field reads as the request fields that write the
 * changed record, and a value that names a register record reads as that
 * record's title (`ReferenceValue`). Given no model, only `BregSubject` calls
 * `useModel`, and only a register subject calls `useRecord`: a host with no
 * BReg never mounts either, so it never needs the model or record routes.
 */

/** The display schema as an object schema, whatever shape a policy served it in. */
function asObjectSchema(value: ReviewJson): JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
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
  const shown = { ...reviewShownValues(task.context) };
  // The register's own field, where it has one by the same API name, carries
  // the model's label, option words and item fields; the schema has only names.
  // A changes field stands for the request's own fields that write it.
  // The UI model may choose which of the policy's display projection to show,
  // and in what order; a name outside the projection is never shown.
  const projection = fieldsFromJsonSchema(
    asObjectSchema(task.policy.displaySchema),
  );
  const chosen = model?.casework?.context?.[task.policy.id];
  const fields = (
    chosen
      ? chosen.flatMap((name) => projection.filter((f) => f.apiName === name))
      : projection
  ).flatMap((field) => {
    const changed =
      entity && model
        ? reviewChangedRequestValues(shown[field.apiName], entity, model)
        : undefined;
    if (entity && changed) {
      Object.assign(shown, changed);
      return entity.fields.filter((own) => own.apiName in changed);
    }
    return [
      entity?.fields.find((own) => own.apiName === field.apiName) ?? field,
    ];
  });
  if (fields.length === 0) return <p className="muted">{c.contextEmpty}</p>;
  return (
    <dl>
      {fields.map((field) => (
        <div className="definition" key={field.id}>
          <dt>{field.label}</dt>
          <dd>
            <FieldValue field={field} value={shown[field.apiName]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BregRecordSubject({
  entity,
  subjectId,
}: {
  entity: EntityModel;
  subjectId: string;
}) {
  const c = useCaseworkContent();
  const record = useRecord(entity.id, subjectId);
  if (record.isPending) return <Loading />;
  if (record.error || !record.data)
    return <Notice tone="warning">{c.recordUnavailable}</Notice>;
  if (entity.fields.length === 0)
    return <p className="muted">{c.contextEmpty}</p>;
  const values = record.data.values;
  return (
    <dl>
      {entity.fields.map((field) => (
        <div className="definition" key={field.id}>
          <dt>{field.label}</dt>
          <dd>
            <FieldValue field={field} value={values[field.id]} />
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
  const entity = reviewSubjectEntity(
    task.subject,
    model,
    task.sourceRequestEntity,
  );
  if (entity?.kind === "record")
    return <BregRecordSubject entity={entity} subjectId={task.subject.id} />;
  return <SchemaSubject task={task} entity={entity} model={model} />;
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
 * whose source is not BReg's never reads the model.
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
 * The words a review task is named by, from what the host serves. A subject
 * of the register is named by the human reference the host joins onto the
 * task, then the title of the record it is about, then its own title; never
 * by the context's display reference, which BReg sets to a machine string
 * (`breg:{registry}:{action}:{proposal}:{version}`). A subject another
 * producer submitted is named by the source's own display reference, then by
 * its requester reference, which such a producer sets to its own reference;
 * BReg sets that to a keyed pseudonym, which names nobody a reviewer knows,
 * so a subject of the register never is.
 * `loading` holds while the record's title is first read. Once that read has
 * settled it never holds again: the subject reads the same record, and when
 * the read failed its own mount reads it once more, which would otherwise
 * take the page away and remount the subject in a loop.
 */
export function useSubjectReference(
  task: ReviewTaskDetail,
  model: RegistryModel | undefined,
): {
  reference: string | undefined;
  entity: EntityModel | undefined;
  loading: boolean;
} {
  const locale = useLocale();
  const fromRegister =
    model !== undefined && reviewSubjectFromRegister(task.subject, model);
  const entity = model
    ? reviewSubjectEntity(task.subject, model, task.sourceRequestEntity)
    : undefined;
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
      ? recordTitle(targetEntity, record.data.values, locale)
      : undefined;
  const reference = fromRegister
    ? ((task.reference?.trim() || undefined) ??
      title ??
      (entity ? reviewSubjectTitle(task, entity, locale) : undefined))
    : (displayReference ?? (task.requesterReference || undefined));
  return {
    reference,
    entity,
    loading:
      Boolean(targetEntity) && record.isLoading && !record.isFetchedAfterMount,
  };
}
