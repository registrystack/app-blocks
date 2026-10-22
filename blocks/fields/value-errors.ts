import {
  validateValues,
  type FieldModel,
  type JsonValue,
  type ValueIssue,
} from "@registrystack/app-runtime";
import type { BlockContent } from "@/blocks/lib/content";
import { fill, recordedNumber } from "@/blocks/lib/format";

/**
 * What an answer check says about one field, in `locale`: the content's
 * wording for that field first, then the wording for the kind of problem,
 * then the registry's own message where an issue carries one.
 */
export function issueMessage(
  field: FieldModel,
  issue: Pick<ValueIssue, "code" | "message" | "limit">,
  c: BlockContent,
  locale: string,
): string {
  return (
    c.fieldErrors[field.id] ??
    (issue.code === "required"
      ? c.requiredError
      : issue.code === "format" && field.format === "date"
        ? c.dateError
        : (issue.message ?? boundMessage(issue, c, locale) ?? c.invalidError))
  );
}

/**
 * The wording for an answer outside a number's bounds or a decimal's places.
 * A decimal's bound arrives as its exact text and is written as recorded.
 */
function boundMessage(
  issue: Pick<ValueIssue, "code" | "limit">,
  c: BlockContent,
  locale: string,
): string | undefined {
  if (issue.limit === undefined) return undefined;
  if (issue.code === "scale")
    return issue.limit === 0
      ? c.wholeNumberError
      : fill(c.decimalPlacesError, { places: issue.limit }, locale);
  const limit =
    typeof issue.limit === "string"
      ? recordedNumber(issue.limit, locale)
      : issue.limit;
  if (issue.code === "minimum") return fill(c.minimumError, { limit }, locale);
  if (issue.code === "maximum") return fill(c.maximumError, { limit }, locale);
  return undefined;
}

/**
 * What a check of these answers finds, one message per field in `locale`:
 * the registry's schema, and a required list left empty or holding a value
 * its field does not offer.
 */
export function valueErrors(
  fields: readonly FieldModel[],
  values: Readonly<Record<string, JsonValue>>,
  c: BlockContent,
  locale: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const issue of validateValues(fields, values)) {
    const field = fields.find((item) => item.id === issue.field);
    if (field && !next[field.id])
      next[field.id] = issueMessage(field, issue, c, locale);
  }
  for (const field of fields) {
    const value = values[field.id];
    if (next[field.id] || field.type !== "array") continue;
    if (field.required && (!Array.isArray(value) || value.length === 0))
      next[field.id] = issueMessage(field, { code: "required" }, c, locale);
    else if (
      field.options &&
      Array.isArray(value) &&
      value.some(
        (item) => !field.options!.some((option) => option.value === item),
      )
    )
      next[field.id] = issueMessage(field, { code: "enum" }, c, locale);
  }
  return next;
}
