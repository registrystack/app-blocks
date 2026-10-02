import {
  validateValues,
  type EntityModel,
  type FieldModel,
  type JsonValue,
  type ValueIssue,
} from "@registrystack/app-runtime";
import type { BlockContent } from "@/blocks/lib/content";

/**
 * What an answer check says about one field: the content's wording for that
 * field first, then the wording for the kind of problem, then the registry's
 * own message for a rule.
 */
export function issueMessage(
  field: FieldModel,
  issue: Pick<ValueIssue, "code" | "message">,
  c: BlockContent,
): string {
  return (
    c.fieldErrors[field.id] ??
    (issue.code === "required"
      ? c.requiredError
      : issue.code === "format" && field.format === "date"
        ? c.dateError
        : (issue.message ?? c.invalidError))
  );
}

/**
 * What a check of these answers finds, one message per field: the registry's
 * rules and schema, and a required list left empty or holding a value its
 * field does not offer.
 */
export function valueErrors(
  fields: readonly FieldModel[],
  values: Readonly<Record<string, JsonValue>>,
  rules: EntityModel["rules"],
  c: BlockContent,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const issue of validateValues(fields, values, rules)) {
    const field = fields.find((item) => item.id === issue.field);
    if (field && !next[field.id])
      next[field.id] = issueMessage(field, issue, c);
  }
  for (const field of fields) {
    const value = values[field.id];
    if (next[field.id] || field.type !== "array") continue;
    if (field.required && (!Array.isArray(value) || value.length === 0))
      next[field.id] = issueMessage(field, { code: "required" }, c);
    else if (
      field.options &&
      Array.isArray(value) &&
      value.some(
        (item) => !field.options!.some((option) => option.value === item),
      )
    )
      next[field.id] = issueMessage(field, { code: "enum" }, c);
  }
  return next;
}
