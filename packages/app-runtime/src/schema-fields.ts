/**
 * Fields from JSON Schema, and the checks a form runs before it sends
 * anything. The registry validates every write again; these checks only keep
 * a form honest and name what is wrong, by code, for a block to word.
 */
import type {
  FieldModel,
  FieldOption,
  FieldRule,
  FieldType,
  JsonSchema,
  JsonValue,
} from "./model.js";

/** One field as a registry contract or a schema property describes it. */
export interface FieldSource {
  id: string;
  apiName?: string;
  label?: string;
  schema: JsonSchema;
  required?: boolean;
  nullable?: boolean;
  readOnly?: boolean;
  /** Display words the registry serves for coded values, by code. */
  codeLabels?: Readonly<Record<string, string>>;
  referenceEntity?: string | null;
}

/** Wording and presentation for one field, from the UI model. */
export interface FieldText {
  label?: string;
  hint?: string;
  widget?: string;
  options?: Readonly<Record<string, string>>;
  /** Wording for a group field's item sub-fields, by item property id. */
  items?: Readonly<Record<string, Omit<FieldText, "items">>>;
}

type JsonObject = { [key: string]: JsonValue };

function object(value: JsonValue | undefined): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

const types: readonly FieldType[] = [
  "string",
  "integer",
  "number",
  "boolean",
  "array",
  "object",
];

/** The schema without its null alternative, and whether it had one. */
function withoutNull(schema: JsonSchema): {
  base: JsonSchema;
  nullable: boolean;
} {
  let base: JsonSchema = schema,
    nullable = false;
  if (Array.isArray(schema.type)) {
    const listed = schema.type.filter((type) => type !== "null");
    nullable = listed.length < schema.type.length;
    base = { ...schema, type: listed.length === 1 ? listed[0]! : listed };
  }
  for (const keyword of ["anyOf", "oneOf"] as const) {
    const members = base[keyword];
    if (!Array.isArray(members) || members.length !== 2) continue;
    const other = members.find((member) => object(member)?.type !== "null");
    if (
      members.every((member) => object(member)) &&
      other !== undefined &&
      members.some((member) => object(member)?.type === "null")
    ) {
      const { [keyword]: _members, ...rest } = base;
      base = { ...rest, ...object(other)! };
      nullable = true;
    }
  }
  if (Array.isArray(base.enum) && base.enum.includes(null)) {
    base = { ...base, enum: base.enum.filter((value) => value !== null) };
    nullable = true;
  }
  return { base, nullable };
}

/** The declared choices: an enum, or a oneOf of consts with optional titles. */
function choices(
  schema: JsonSchema,
): { value: JsonValue; title?: string }[] | undefined {
  if (Array.isArray(schema.enum))
    return schema.enum.map((value) => ({ value }));
  const members = schema.oneOf ?? schema.anyOf;
  if (
    Array.isArray(members) &&
    members.length > 0 &&
    members.every((member) => object(member)?.const !== undefined)
  )
    return members.map((member) => {
      const { const: value, title } = object(member)!;
      return {
        value: value!,
        ...(typeof title === "string" ? { title } : {}),
      };
    });
  return undefined;
}

function typeOf(schema: JsonSchema): FieldType | undefined {
  if (typeof schema.type === "string")
    return types.find((type) => type === schema.type);
  if (schema.type !== undefined) return undefined;
  const listed = choices(schema)?.map(({ value }) => value);
  if (!listed?.length) return undefined;
  if (listed.every((value) => typeof value === "string")) return "string";
  if (listed.every((value) => typeof value === "boolean")) return "boolean";
  if (listed.every((value) => Number.isInteger(value))) return "integer";
  if (listed.every((value) => typeof value === "number")) return "number";
  return undefined;
}

/** The array's item schema, when its items are a choice list. */
function choiceItems(schema: JsonSchema): JsonSchema | undefined {
  const items = object(schema.items);
  return items && choices(withoutNull(items).base) ? items : undefined;
}

/**
 * The array's item schema, when its items are a group of scalar sub-fields:
 * an object with at least one declared property. A reference cannot appear
 * here; BREG has no way to mark one inside a structured field's schema
 * (GAPS Finding 4), so there is nothing to detect and nothing to guess at.
 */
function groupItemsSchema(schema: JsonSchema): JsonSchema | undefined {
  const items = object(schema.items);
  const properties = items && object(items.properties);
  return items && properties && Object.keys(properties).length > 0
    ? items
    : undefined;
}

function acceptsEmpty(pattern: JsonValue | undefined): boolean {
  return typeof pattern !== "string" || new RegExp(pattern, "u").test("");
}

/**
 * One field, with labels from the UI model before those the source carries.
 * `topLevel` gates the array shapes only a top-level field may take (a
 * choice list or a repeatable group): a group item's own property is always
 * a plain scalar or, if it is itself an array, object or reference, read
 * only. This is how a nested shape the kit cannot edit stays visibly read
 * only instead of being guessed at.
 */
function buildField(
  source: FieldSource,
  text: FieldText,
  topLevel: boolean,
): FieldModel {
  const { base, nullable } = withoutNull(source.schema);
  const declared = typeOf(base);
  const arrayItems =
    topLevel && declared === "array" ? choiceItems(base) : undefined;
  const groupItems =
    topLevel && declared === "array" ? groupItemsSchema(base) : undefined;
  const type: FieldType = groupItems ? "group" : (declared ?? "object");
  const listed =
    type === "array"
      ? arrayItems && choices(withoutNull(arrayItems).base)
      : type === "group"
        ? undefined
        : choices(base);
  const editable =
    type === "group" ||
    (declared !== undefined &&
      type !== "object" &&
      (type !== "array" || arrayItems !== undefined));
  const format =
    type === "string" && typeof base.format === "string"
      ? base.format
      : undefined;
  const hint =
    text.hint ??
    (typeof base.description === "string" ? base.description : undefined);
  const label = (code: string) =>
    (text.options && Object.hasOwn(text.options, code)
      ? text.options[code]
      : undefined) ??
    (source.codeLabels && Object.hasOwn(source.codeLabels, code)
      ? source.codeLabels[code]
      : undefined);
  const options: FieldOption[] | undefined = listed
    ?.filter(({ value }) => value !== null)
    .map(({ value, title }) => ({
      value: String(value),
      label: label(String(value)) ?? title ?? String(value),
    }));
  const items =
    groupItems &&
    fieldsFromSchemaProperties(groupItems, text.items ?? {}, false);
  return {
    id: source.id,
    apiName: source.apiName ?? source.id,
    label:
      text.label ||
      source.label ||
      (typeof base.title === "string" && base.title) ||
      source.id,
    ...(hint ? { hint } : {}),
    schema: source.schema,
    type,
    ...(format ? { format } : {}),
    ...(text.widget ? { widget: text.widget } : {}),
    required: source.required ?? false,
    acceptsBlank:
      type === "string" &&
      !listed &&
      !format &&
      !((base.minLength as number) > 0) &&
      acceptsEmpty(base.pattern),
    readOnly: source.readOnly === true || base.readOnly === true || !editable,
    nullable: source.nullable === true || nullable,
    ...(options ? { options } : {}),
    ...(source.referenceEntity
      ? { reference: { entity: source.referenceEntity } }
      : {}),
    ...(items ? { items } : {}),
  };
}

/** One field, with labels from the UI model before those the source carries. */
export function fieldFromSchema(
  source: FieldSource,
  text: FieldText = {},
): FieldModel {
  return buildField(source, text, true);
}

/**
 * An object schema's properties as fields, in schema order. `topLevel` is
 * false for a group's item properties, where the array shapes only a
 * top-level field may take are refused rather than guessed at.
 */
function fieldsFromSchemaProperties(
  schema: JsonSchema,
  labels: Readonly<Record<string, FieldText>>,
  topLevel: boolean,
): FieldModel[] {
  const properties = object(schema.properties) ?? {};
  const required = new Set(
    Array.isArray(schema.required) ? schema.required : [],
  );
  return Object.entries(properties).map(([id, property]) =>
    buildField(
      { id, schema: object(property) ?? {}, required: required.has(id) },
      Object.hasOwn(labels, id) ? labels[id] : {},
      topLevel,
    ),
  );
}

/** The properties of an object schema as fields, in schema order. */
export function fieldsFromJsonSchema(
  schema: JsonSchema,
  labels: Readonly<Record<string, FieldText>> = {},
): FieldModel[] {
  return fieldsFromSchemaProperties(schema, labels, true);
}

export type ValueIssueCode =
  | "unknown"
  | "readOnly"
  | "required"
  | "type"
  | "enum"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "format"
  | "minimum"
  | "maximum"
  | "exclusiveMinimum"
  | "exclusiveMaximum"
  | "minItems"
  | "maxItems"
  | "uniqueItems"
  | "notBefore";

/** What is wrong with one field's value. A block words it; a rule may carry its own message. */
export interface ValueIssue {
  field: string;
  code: ValueIssueCode;
  /** The bound a length, size or range issue was checked against. */
  limit?: number;
  /** The other field a rule compares with. */
  other?: string;
  message?: string;
}

const integerText = /^-?(0|[1-9]\d*)$/;
const numberText = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;
const offset = "([Zz]|[+-]([01]\\d|2[0-3]):[0-5]\\d)";
const timeText = new RegExp(
  `^([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?${offset}$`,
);
const uuidText =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

/** Formats JSON Schema treats as annotations pass; the registry checks them. */
function formatHolds(format: string, value: string): boolean {
  switch (format) {
    case "date":
      return isDate(value);
    case "date-time": {
      const [date, time] = value.split(/[Tt]/);
      return (
        date !== undefined &&
        time !== undefined &&
        isDate(date) &&
        timeText.test(time)
      );
    }
    case "time":
      return timeText.test(value);
    case "email":
      return /^[^\s@]+@[^\s@]+$/.test(value);
    case "uri":
      return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) && URL.canParse(value);
    case "uuid":
      return uuidText.test(value);
    default:
      return true;
  }
}

/** Integers and decimals may travel as lexical strings so no digit is lost. */
function numeric(type: FieldType, value: JsonValue): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) &&
      (type === "number" || Number.isInteger(value))
      ? value
      : undefined;
  if (typeof value === "string")
    return (type === "integer" ? integerText : numberText).test(value)
      ? Number(value)
      : undefined;
  return undefined;
}

function sameJson(a: JsonValue, b: JsonValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function scalarIssue(
  schema: JsonSchema,
  type: FieldType,
  value: JsonValue,
): Omit<ValueIssue, "field"> | undefined {
  const allowed = choices(schema)?.map((choice) => choice.value);
  const bound = (keyword: string) =>
    typeof schema[keyword] === "number"
      ? (schema[keyword] as number)
      : undefined;
  if (type === "boolean") {
    if (typeof value !== "boolean") return { code: "type" };
  } else if (type === "string") {
    if (typeof value !== "string") return { code: "type" };
    const length = [...value].length;
    const minLength = bound("minLength"),
      maxLength = bound("maxLength");
    if (minLength !== undefined && length < minLength)
      return { code: "minLength", limit: minLength };
    if (maxLength !== undefined && length > maxLength)
      return { code: "maxLength", limit: maxLength };
    if (
      typeof schema.pattern === "string" &&
      !new RegExp(schema.pattern, "u").test(value)
    )
      return { code: "pattern" };
    if (typeof schema.format === "string" && !formatHolds(schema.format, value))
      return { code: "format" };
  } else {
    const number = numeric(type, value);
    if (number === undefined) return { code: "type" };
    for (const [keyword, fails] of [
      ["minimum", (limit: number) => number < limit],
      ["maximum", (limit: number) => number > limit],
      ["exclusiveMinimum", (limit: number) => number <= limit],
      ["exclusiveMaximum", (limit: number) => number >= limit],
    ] as const) {
      const limit = bound(keyword);
      if (limit !== undefined && fails(limit)) return { code: keyword, limit };
    }
  }
  if (allowed && !allowed.some((choice) => String(choice) === String(value)))
    return { code: "enum" };
  return undefined;
}

/**
 * `minItems`, `maxItems` and `uniqueItems` for an array or group field's own
 * list. An empty list on a required field is missing, unless `minItems` is
 * explicitly 0: that is how a schema says an empty list is itself an answer.
 */
function arrayBoundsIssue(
  base: JsonSchema,
  value: readonly JsonValue[],
  field: FieldModel,
): Omit<ValueIssue, "field"> | undefined {
  const minItems = typeof base.minItems === "number" ? base.minItems : undefined,
    maxItems = typeof base.maxItems === "number" ? base.maxItems : undefined;
  if (minItems !== undefined && value.length < minItems)
    return { code: "minItems", limit: minItems };
  if (
    value.length === 0 &&
    field.required &&
    minItems !== 0 &&
    !field.acceptsBlank
  )
    return { code: "required" };
  if (maxItems !== undefined && value.length > maxItems)
    return { code: "maxItems", limit: maxItems };
  if (
    base.uniqueItems === true &&
    value.some((item, index) =>
      value.slice(0, index).some((earlier) => sameJson(earlier, item)),
    )
  )
    return { code: "uniqueItems" };
  return undefined;
}

/**
 * One group item's own sub-fields, checked the same way a top-level field
 * is. A sub-field the kit cannot edit rides along in the item unchecked: it
 * is not offered for editing, so it is never wrong.
 */
function groupItemIssue(
  properties: readonly FieldModel[],
  item: JsonValue,
): Omit<ValueIssue, "field"> | undefined {
  const values = object(item);
  if (!values) return { code: "type" };
  for (const sub of properties) {
    if (sub.readOnly) continue;
    const issue = valueIssue(
      sub,
      Object.hasOwn(values, sub.id) ? values[sub.id] : undefined,
    );
    if (issue) return issue;
  }
  return undefined;
}

function valueIssue(
  field: FieldModel,
  value: JsonValue | undefined,
): Omit<ValueIssue, "field"> | undefined {
  if (value === undefined)
    return field.required && !field.readOnly ? { code: "required" } : undefined;
  if (field.readOnly) return { code: "readOnly" };
  if (value === null) return field.nullable ? undefined : { code: "type" };
  if (value === "" && field.required && !field.acceptsBlank)
    return { code: "required" };
  const { base } = withoutNull(field.schema);
  if (field.type !== "array" && field.type !== "group")
    return scalarIssue(base, field.type, value);
  if (!Array.isArray(value)) return { code: "type" };
  if (field.type === "array") {
    const items = withoutNull(object(base.items) ?? {}).base;
    const itemType = typeOf(items) ?? "string";
    for (const item of value) {
      const issue = scalarIssue(items, itemType, item);
      if (issue) return issue.code === "enum" ? issue : { code: "type" };
    }
  } else {
    for (const item of value) {
      const issue = groupItemIssue(field.items ?? [], item);
      if (issue) return issue;
    }
  }
  return arrayBoundsIssue(base, value, field);
}

/** A comparable form of a rule operand, or undefined when there is nothing to compare. */
function ordinal(field: FieldModel, value: JsonValue | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (field.type === "integer" || field.type === "number")
    return numeric(field.type, value);
  if (typeof value !== "string") return undefined;
  return field.format === "date-time" ? Date.parse(value) : value;
}

/**
 * Every issue in the values, at most one per field, in field order; then the
 * unknown keys; then each rule whose two values are otherwise valid. A blank
 * that should mean "no answer" is for the form to leave out before calling.
 */
export function validateValues(
  fields: readonly FieldModel[],
  values: Readonly<Record<string, JsonValue | undefined>>,
  rules: readonly FieldRule[] = [],
): ValueIssue[] {
  const issues: ValueIssue[] = [];
  const known = new Map(fields.map((field) => [field.id, field]));
  for (const field of fields) {
    const issue = valueIssue(
      field,
      Object.hasOwn(values, field.id) ? values[field.id] : undefined,
    );
    if (issue) issues.push({ field: field.id, ...issue });
  }
  for (const key of Object.keys(values))
    if (!known.has(key) && values[key] !== undefined)
      issues.push({ field: key, code: "unknown" });
  const failed = new Set(issues.map((issue) => issue.field));
  for (const rule of rules) {
    const field = known.get(rule.field),
      other = known.get(rule.notBefore);
    if (!field || !other || failed.has(field.id) || failed.has(other.id))
      continue;
    const value = ordinal(field, values[field.id]),
      floor = ordinal(other, values[other.id]);
    if (
      typeof value !== typeof floor ||
      Number.isNaN(value) ||
      Number.isNaN(floor) ||
      value! >= floor!
    )
      continue;
    issues.push({
      field: field.id,
      code: "notBefore",
      other: other.id,
      ...(rule.message ? { message: rule.message } : {}),
    });
  }
  return issues;
}
