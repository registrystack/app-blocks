/**
 * The records a record page lists beside one record: those of other record
 * entities that refer to it. The page and the host read the same rule, so the
 * host asks about only the actions the page offers there.
 */
import type { EntityModel, FieldModel } from "./model.js";

/** One field of another record entity that refers to a record of this one, and can list by it. */
export interface RelatedField {
  related: EntityModel;
  field: FieldModel;
  /** Whether the same entity refers to this one through more than one field. */
  several: boolean;
}

/**
 * The record entities other than `entity` that refer to it, each through
 * every field that names it and that the entity's list can be filtered by.
 */
export function relatedFields(
  entities: readonly EntityModel[],
  entity: string,
): RelatedField[] {
  return entities.flatMap((related) => {
    if (related.kind !== "record" || related.id === entity) return [];
    const fields = related.fields.filter(
      (field) =>
        field.reference?.entity === entity &&
        related.list.filters.some((filter) => filter.field === field.id),
    );
    return fields.map((field) => ({
      related,
      field,
      several: fields.length > 1,
    }));
  });
}
