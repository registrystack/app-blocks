import type {
  ReviewJson,
  ReviewOutcome,
  ReviewPolicy,
} from "./review-types.js";

/** One result field the kit can capture, with the control it is captured by. */
export interface ReviewResultField {
  name: string;
  required: boolean;
  control:
    | { kind: "text"; maxLength?: number }
    | { kind: "textarea"; maxLength?: number }
    | { kind: "date" }
    | { kind: "number"; min?: number; max?: number; step?: number }
    | { kind: "checkbox" }
    | {
        kind: "choices";
        options: { value: string; label: string }[];
        /** The JSON type a chosen value converts back to on submit. */
        scalar: "string" | "number" | "boolean";
      };
}

/** Why an outcome cannot be recorded from a screen built on this plan. */
export type ReviewResultBlock =
  | "outcome-not-declared"
  | "result-not-declared"
  | "required-field-uncapturable";

/**
 * How one declared outcome is recorded: whether it needs a reason, whether it
 * needs a result, and one control per top-level result property. A plan with
 * `blocked` set must not be offered as a choice.
 */
export interface ReviewResultPlan {
  outcome: ReviewOutcome;
  reasonRequired: boolean;
  resultRequired: boolean;
  /** Whether the kind declares a result schema, so a result may travel at all. */
  resultDeclared: boolean;
  fields: ReviewResultField[];
  /** Property names no control can capture, in schema order. */
  uncapturable: string[];
  blocked?: ReviewResultBlock;
}

type JsonObject = { [key: string]: ReviewJson };

function object(value: ReviewJson | undefined): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

/**
 * The choice list a field captures: the request's narrowing when it supplied
 * one, else the schema's own enum. Null when neither declares choices.
 */
function choices(
  property: JsonObject,
  constraint: JsonObject | null,
): ReviewResultField["control"] | null {
  const plain = (value: ReviewJson) =>
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
      ? { raw: value, title: undefined as string | undefined }
      : null;
  let entries: { raw: string | number | boolean; title?: string }[] | null =
    null;
  if (constraint && Array.isArray(constraint.enum))
    entries = constraint.enum.flatMap((value) => {
      const entry = plain(value);
      return entry ? [entry] : [];
    });
  else if (constraint && Array.isArray(constraint.oneOf))
    entries = constraint.oneOf.flatMap((value) => {
      const option = object(value);
      const entry = option ? plain(option.const ?? null) : null;
      if (!entry) return [];
      const title =
        option && typeof option.title === "string" ? option.title : undefined;
      return [{ ...entry, ...(title ? { title } : {}) }];
    });
  else if (Array.isArray(property.enum))
    entries = property.enum.flatMap((value) => {
      const entry = plain(value);
      return entry ? [entry] : [];
    });
  if (!entries || entries.length === 0) return null;
  const type = typeof property.type === "string" ? property.type : null;
  const scalar: "string" | "number" | "boolean" =
    type === "boolean"
      ? "boolean"
      : type === "integer" || type === "number"
        ? "number"
        : entries.every((entry) => typeof entry.raw === "boolean")
          ? "boolean"
          : entries.every((entry) => typeof entry.raw === "number")
            ? "number"
            : "string";
  return {
    kind: "choices",
    options: entries.map((entry) => ({
      value: String(entry.raw),
      // A constraint's title is the option's label; otherwise the value reads for itself.
      label: entry.title ?? String(entry.raw),
    })),
    scalar,
  };
}

/** The tighter of the schema's and the narrowing's bound: the one that admits less. */
function tighter(
  keyword: "minimum" | "maximum" | "maxLength",
  property: JsonObject,
  constraint: JsonObject | null,
): number | undefined {
  const read = (holder: JsonObject | null) => {
    const value = holder ? holder[keyword] : undefined;
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  };
  const schema = read(property);
  const narrowed = read(constraint);
  if (schema === undefined) return narrowed;
  if (narrowed === undefined) return schema;
  return keyword === "minimum"
    ? Math.max(schema, narrowed)
    : Math.min(schema, narrowed);
}

/**
 * One outcome of a task's policy snapshot as a capture plan. The subset is
 * deliberately small: text, long text, date, bounded number, checkbox and
 * choices. A nested object, an array, a `$ref` or a missing type is named
 * uncapturable and never half-captured; when such a field is required, the
 * outcome is blocked rather than recorded with a partial result. Casework
 * validates the result again; this plan only keeps a screen honest.
 */
export function planReviewResult(
  policy: ReviewPolicy,
  outcomeId: string,
  resultConstraints?: Record<string, ReviewJson>,
): ReviewResultPlan {
  const outcome = policy.outcomes.find((entry) => entry.id === outcomeId);
  const schema = object(policy.resultSchema);
  const base = {
    outcome: outcome ?? {
      id: outcomeId,
      label: outcomeId,
      settlement: "rejected" as const,
      reasonRequired: false,
      resultRequired: false,
    },
    reasonRequired: outcome?.reasonRequired ?? false,
    resultRequired: outcome?.resultRequired ?? false,
    resultDeclared: schema !== null,
  };
  if (!outcome)
    return {
      ...base,
      fields: [],
      uncapturable: [],
      blocked: "outcome-not-declared",
    };
  if (!schema)
    return {
      ...base,
      fields: [],
      uncapturable: [],
      ...(outcome.resultRequired
        ? { blocked: "result-not-declared" as const }
        : {}),
    };
  const properties = object(schema.properties) ?? {};
  const constraints = resultConstraints ?? null;
  const required = new Set(
    (Array.isArray(schema.required) ? schema.required : []).filter(
      (name): name is string => typeof name === "string",
    ),
  );
  const fields: ReviewResultField[] = [];
  const uncapturable: string[] = [];
  for (const [name, value] of Object.entries(properties)) {
    const property = object(value) ?? {};
    const constraint = constraints ? object(constraints[name]) : null;
    const field = (control: ReviewResultField["control"]) =>
      fields.push({ name, required: required.has(name), control });
    const listed = choices(property, constraint);
    if (listed) {
      field(listed);
      continue;
    }
    const type = typeof property.type === "string" ? property.type : null;
    if (type === "string") {
      const maxLength = tighter("maxLength", property, constraint);
      field(
        property.format === "date"
          ? { kind: "date" }
          : maxLength !== undefined && maxLength > 200
            ? { kind: "textarea", maxLength }
            : {
                kind: "text",
                ...(maxLength !== undefined ? { maxLength } : {}),
              },
      );
    } else if (type === "integer" || type === "number") {
      const min = tighter("minimum", property, constraint);
      const max = tighter("maximum", property, constraint);
      field({
        kind: "number",
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
        ...(type === "integer" ? { step: 1 } : {}),
      });
    } else if (type === "boolean") field({ kind: "checkbox" });
    else uncapturable.push(name);
  }
  const blocked =
    outcome.resultRequired && uncapturable.some((name) => required.has(name))
      ? ("required-field-uncapturable" as const)
      : undefined;
  return { ...base, fields, uncapturable, ...(blocked ? { blocked } : {}) };
}

/** The answers as they travel with the decision, typed back to the schema. */
export function reviewResultValues(
  plan: ReviewResultPlan,
  values: Record<string, string>,
): Record<string, ReviewJson> {
  const result: Record<string, ReviewJson> = {};
  for (const field of plan.fields) {
    const raw = values[field.name];
    if (raw === undefined) continue;
    switch (field.control.kind) {
      case "checkbox":
        result[field.name] = raw === "true";
        break;
      case "number":
        if (raw.trim() !== "" && Number.isFinite(Number(raw)))
          result[field.name] = Number(raw);
        break;
      case "choices":
        if (raw === "") break;
        result[field.name] =
          field.control.scalar === "boolean"
            ? raw === "true"
            : field.control.scalar === "number"
              ? Number(raw)
              : raw;
        break;
      default:
        if (raw !== "") result[field.name] = raw;
    }
  }
  return result;
}

/**
 * Required fields left unanswered, in schema order. A checkbox is an answer
 * whether or not it is ticked, so it never blocks.
 */
export function reviewResultMissing(
  plan: ReviewResultPlan,
  values: Record<string, string>,
): string[] {
  return plan.fields
    .filter(
      (field) =>
        field.required &&
        field.control.kind !== "checkbox" &&
        (values[field.name] ?? "").trim() === "",
    )
    .map((field) => field.name);
}
