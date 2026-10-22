/**
 * A review task's subject read against the registry model. BReg submits a
 * review under its registry identifier as the subject's source and the
 * entity as its type, or `proposal` for a proposal, and projects the
 * request's values keyed by each field's API name, or, in a `changes` field,
 * the records the request would change. A subject another producer submitted is not the
 * register's, and none of this applies to it.
 */
import type { EntityModel, RegistryModel } from "./model.js";
import type {
  ReviewContext,
  ReviewJson,
  ReviewSubject,
  ReviewTaskDetail,
} from "./review-types.js";
import { bregReviewSubjectSource } from "./review-types.js";
import { entityTitle } from "./record-title.js";

/** Whether this registry submitted the subject, whether or not the model describes its kind. */
export function reviewSubjectFromRegister(
  subject: ReviewSubject,
  model: RegistryModel,
): boolean {
  return (
    subject.source === bregReviewSubjectSource ||
    (model.registry.id !== "" && subject.source === model.registry.id)
  );
}

/** The subject type BReg submits every proposal under, whatever its action. */
const proposalSubjectType = "proposal";

/**
 * The register entity the subject is, when this registry submitted it. A
 * Proposal's type names no entity, so it is the request entity the host
 * joined to the proposal's exact binding (`sourceRequestEntity`), if any.
 */
export function reviewSubjectEntity(
  subject: ReviewSubject,
  model: RegistryModel,
  sourceRequestEntity?: string,
): EntityModel | undefined {
  if (!reviewSubjectFromRegister(subject, model)) return undefined;
  const kind =
    subject.type === proposalSubjectType ? sourceRequestEntity : subject.type;
  return kind === undefined
    ? undefined
    : model.entities.find((entity) => entity.id === kind);
}

/** What the task shows: the submitted snapshot, or what the source projected. */
export function reviewShownValues(
  context: ReviewContext,
): Record<string, ReviewJson> {
  return context.strategy === "submitted"
    ? context.snapshot
    : (context.display ?? {});
}

/** A JSON object, as a context value holds one. */
function isObject(
  value: ReviewJson | undefined,
): value is { [key: string]: ReviewJson } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One record a BReg `changes` context field shows: its id, whether the
 * request creates or patches it, and its projected fields, by the record's
 * field ids (BReg keys them so, not by API name), as they are (`before`, null
 * for a record the request creates) and as they would be (`after`).
 */
function isChange(
  value: ReviewJson,
): value is { recordId: string; operation: string; after: { [key: string]: ReviewJson } } {
  return (
    isObject(value) &&
    typeof value.recordId === "string" &&
    typeof value.operation === "string" &&
    isObject(value.after)
  );
}

/**
 * A BReg `changes` context field read as the request's own fields: each
 * request field that writes a changed record's field, by the request field's
 * API name, with the value that record would hold. Undefined when the value
 * is not a changes field, or shows no field the request writes.
 */
export function reviewChangedRequestValues(
  value: ReviewJson | undefined,
  entity: EntityModel,
  model: RegistryModel,
): Record<string, ReviewJson> | undefined {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isChange))
    return undefined;
  const shown: Record<string, ReviewJson> = {};
  for (const write of entity.request?.writes ?? []) {
    const own = entity.fields.find((field) => field.id === write.requestField);
    const written = model.entities
      .find((target) => target.id === write.targetEntity)
      ?.fields.find((field) => field.id === write.targetField);
    if (!own || !written) continue;
    for (const change of value)
      if (written.id in change.after)
        shown[own.apiName] = change.after[written.id]!;
  }
  return Object.keys(shown).length > 0 ? shown : undefined;
}

/** The value the task shows for one of the entity's fields, by the field's id. */
function shownValue(
  task: ReviewTaskDetail,
  entity: EntityModel,
  fieldId: string,
): string | undefined {
  const field = entity.fields.find((candidate) => candidate.id === fieldId);
  const value = field
    ? reviewShownValues(task.context)[field.apiName]
    : undefined;
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * The record the subject is about: the subject itself when it is a record,
 * or the record a request changes, named by the first target bound to one
 * of the request's fields. Undefined when the task does not show that field.
 */
export function reviewSubjectTarget(
  task: ReviewTaskDetail,
  entity: EntityModel,
): { entity: string; id: string } | undefined {
  if (entity.kind === "record")
    return { entity: entity.id, id: task.subject.id };
  for (const target of entity.request?.targets ?? []) {
    if (target.fromField === undefined) continue;
    const id = shownValue(task, entity, target.fromField);
    if (id !== undefined) return { entity: target.entity, id };
  }
  return undefined;
}

/**
 * The subject's own title, from the entity's title template or field as the
 * task shows them, with a calendar date in `locale`.
 */
export function reviewSubjectTitle(
  task: ReviewTaskDetail,
  entity: EntityModel,
  locale: string,
): string | undefined {
  const shown = reviewShownValues(task.context);
  return entityTitle(entity, (field) => shown[field.apiName], locale);
}
