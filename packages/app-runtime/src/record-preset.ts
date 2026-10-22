/**
 * The answers an action taken on a record is given from that record. The
 * action form and the host read the same rule, so the host asks whether the
 * action is available with the answers the form would send.
 */
import type { EntityModel, FieldModel, JsonValue, RecordView } from "./model.js";

/**
 * The answers an action taken on `record` is given. An input the UI model
 * says is entered or chosen is left to the person. Otherwise every input that
 * names this entity holds the record's id, and every input that shares its id
 * with a field of the record naming the same entity holds the record's value;
 * an input the UI model says is taken from the record also takes the record's
 * value of the same id, whatever its type. A fill names only the record, never
 * the session's actor, profile or owner.
 */
export function recordPreset(
  entity: EntityModel,
  record: Pick<RecordView, "id" | "values">,
  fields: readonly FieldModel[],
): Record<string, JsonValue> {
  const preset: Record<string, JsonValue> = {};
  for (const field of fields) {
    if (field.fill === "enter" || field.fill === "choose") continue;
    const target = field.reference?.entity;
    const held = record.values[field.id];
    if (target === entity.id) preset[field.id] = record.id;
    else if (
      held !== undefined &&
      held !== null &&
      (field.fill === "record" ||
        (target !== undefined &&
          entity.fields.find((own) => own.id === field.id)?.reference
            ?.entity === target))
    )
      preset[field.id] = held;
  }
  return preset;
}
