import type {
  EntityModel,
  FieldModel,
  JsonSchema,
  RegistryModel,
  ReviewChangedField,
  ReviewJson,
  ReviewTaskDetail,
} from "@registrystack/app-runtime";
import {
  bregReviewSubjectSource,
  fieldsFromJsonSchema,
  reviewChangedFields,
  reviewShownValues,
  reviewSubjectEntity,
  reviewSubjectFromRegister,
  reviewSubjectTarget,
  reviewSubjectTitle,
} from "@registrystack/app-runtime";
import { useModel, useRecord } from "@registrystack/app-runtime/react";
import { FieldValue } from "@/blocks/fields/field-value";
import { recordTitle } from "@/blocks/fields/reference-value";
import {
  ChangeTable,
  sameValue,
  type ChangeRow,
} from "@/blocks/request/request-changes";
import { Loading, Notice } from "@/blocks/casework/shared";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { useBlockContent, useLocale } from "@/blocks/lib/content";

/**
 * What a reviewer sees of a task's subject. A BReg record reads its own live
 * fields; anything else, including a Casework queue with no BReg behind it at
 * all, reads the values the requester submitted or the source projected,
 * through the review policy's own display schema. A request of the register
 * reads those values under the model's own labels, option words and item
 * fields, a BReg `changes` field reads as the request fields that write a
 * record it creates, or a record it patches as it was when the request was
 * submitted beside as it would be (`ChangeTable`), and a value that names a
 * register record reads as that record's title (`ReferenceValue`). Given no
 * model, only `BregSubject` calls `useModel`, and only a register subject
 * calls `useRecord`: a host with no BReg never mounts either, so it never
 * needs the model or record routes.
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
  const block = useBlockContent();
  const shown = { ...reviewShownValues(task.context) };
  // The register's own field, where it has one by the same API name, carries
  // the model's label, option words and item fields; the schema has only names.
  // A changes field stands for the record fields the request writes.
  // The UI model may choose which of the policy's display projection to show,
  // and in what order; a name outside the projection is never shown.
  const projection = fieldsFromJsonSchema(
    asObjectSchema(task.policy.displaySchema),
  );
  const chosen = model?.casework?.context?.[task.policy.id];
  const parts = (
    chosen
      ? chosen.flatMap((name) => projection.filter((f) => f.apiName === name))
      : projection
  ).flatMap((field): SubjectPart[] => {
    const changed =
      entity && model
        ? reviewChangedFields(shown[field.apiName], entity, model)
        : undefined;
    if (entity && changed) {
      // A record the request creates reads as the request's own fields; a
      // record it patches, as it was when submitted beside as it would be.
      const created = changed.filter((row) => !("before" in row));
      for (const row of created)
        shown[row.requestField.apiName] = row.after;
      const patched = changed.filter((row) => "before" in row);
      return [
        ...entity.fields
          .filter((own) => created.some((row) => row.requestField.id === own.id))
          .map((own) => ({ field: own })),
        ...[...new Set(patched.map((row) => row.recordId))].map((recordId) => ({
          recordId,
          rows: patched.filter((row) => row.recordId === recordId),
        })),
      ];
    }
    return [
      {
        field:
          entity?.fields.find((own) => own.apiName === field.apiName) ?? field,
      },
    ];
  });
  if (parts.length === 0) return <p className="muted">{c.contextEmpty}</p>;
  return (
    <>
      {segments(parts).map((segment, index) =>
        "fields" in segment ? (
          <dl key={index}>
            {segment.fields.map((field) => (
              <div className="definition" key={field.id}>
                <dt>{field.label}</dt>
                <dd>
                  <FieldValue field={field} value={shown[field.apiName]} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          // BReg froze each patched record's values when the request was
          // submitted: the record as it was then, not as it is now.
          <ChangeTable
            key={index}
            rows={segment.rows.map(changeRow)}
            labels={{
              caption: block.proposedHeading,
              current: block.beforeColumn,
              proposed: block.proposedColumn,
            }}
          />
        ),
      )}
    </>
  );
}

/** A record the request patches, by the fields it writes there. */
interface PatchedRecord {
  recordId: string;
  rows: ReviewChangedField[];
}

/** One thing the subject shows: a field, or a record the request patches. */
type SubjectPart = { field: FieldModel } | PatchedRecord;

/** The parts in order, with each run of fields read as one list. */
function segments(
  parts: readonly SubjectPart[],
): ({ fields: FieldModel[] } | PatchedRecord)[] {
  const all: ({ fields: FieldModel[] } | PatchedRecord)[] = [];
  for (const part of parts) {
    const last = all[all.length - 1];
    if (!("field" in part)) all.push(part);
    else if (last && "fields" in last) last.fields.push(part.field);
    else all.push({ fields: [part.field] });
  }
  return all;
}

/** A patched field as a comparison row, under the record's own label. */
function changeRow(row: ReviewChangedField): ChangeRow {
  return {
    key: `${row.recordId}/${row.targetField.id}`,
    label: row.targetField.label,
    current: <FieldValue field={row.targetField} value={row.before} />,
    proposed: <FieldValue field={row.targetField} value={row.after} />,
    comparison: sameValue(row.before, row.after) ? "unchanged" : "changed",
  };
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
