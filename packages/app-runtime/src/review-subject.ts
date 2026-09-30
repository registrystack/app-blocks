/**
 * A review task's subject read against the registry model. BREG submits a
 * review under its registry identifier as the subject's source and the
 * entity as its type, and projects the request's values keyed by each
 * field's API name. A subject another producer submitted is not the
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

/** The register entity the subject is, when this registry submitted it. */
export function reviewSubjectEntity(
  subject: ReviewSubject,
  model: RegistryModel,
): EntityModel | undefined {
  return reviewSubjectFromRegister(subject, model)
    ? model.entities.find((entity) => entity.id === subject.type)
    : undefined;
}

/** What the task shows: the submitted snapshot, or what the source projected. */
export function reviewShownValues(
  context: ReviewContext,
): Record<string, ReviewJson> {
  return context.strategy === "submitted"
    ? context.snapshot
    : (context.display ?? {});
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

/** The subject's own title, as the task shows the entity's title field. */
export function reviewSubjectTitle(
  task: ReviewTaskDetail,
  entity: EntityModel,
): string | undefined {
  return entity.title === undefined
    ? undefined
    : shownValue(task, entity, entity.title);
}
