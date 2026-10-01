/**
 * The words a record is named by, read from its entity's title template or
 * title field. The caller supplies how a field's value is read, since a
 * record keys its values by field id and a review task by API name.
 */
import type { EntityModel, FieldModel } from "./model.js";

const placeholder = /\{([^{}]+)\}/g;

/** The field ids a title template names, each `{field-id}` in it. */
export function templateFields(template: string): string[] {
  return [...template.matchAll(placeholder)].map((match) => match[1]!);
}

/** A field value as title text: an option's words for a code, a number as written. */
function titleText(field: FieldModel, value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string" || value === "") return undefined;
  return (
    field.options?.find((option) => option.value === value)?.label ?? value
  );
}

/**
 * The record's title: its entity's template with each `{field-id}` filled in,
 * or the title field's value when there is no template or a field it names
 * has no value. Undefined when neither gives one.
 */
export function entityTitle(
  entity: EntityModel,
  valueOf: (field: FieldModel) => unknown,
): string | undefined {
  const fieldOf = (id: string) =>
    entity.fields.find((field) => field.id === id);
  if (entity.titleTemplate) {
    let complete = true;
    const filled = entity.titleTemplate.replace(
      placeholder,
      (_, id: string) => {
        const field = fieldOf(id);
        const text = field ? titleText(field, valueOf(field)) : undefined;
        if (text === undefined) complete = false;
        return text ?? "";
      },
    );
    if (complete) return filled;
  }
  const field = entity.title ? fieldOf(entity.title) : undefined;
  const value = field ? valueOf(field) : undefined;
  return typeof value === "string" && value !== "" ? value : undefined;
}
