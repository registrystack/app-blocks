import { displayDate, type JsonValue } from "@registrystack/app-runtime";
import { useBlockContent, type BlockContent } from "@/blocks/lib/content";
import type { FieldValueProps } from "@/blocks/fields/renderers";

/** The words for a code: the content's term, the field's option, or the code. */
function codeWords(
  c: BlockContent,
  field: FieldValueProps["field"],
  code: string,
) {
  return (
    c.terms[code] ??
    field.options?.find((option) => option.value === code)?.label ??
    code
  );
}

function titleOf(schema: JsonValue | undefined, key: string): string {
  const properties =
    schema && typeof schema === "object" && !Array.isArray(schema)
      ? schema.properties
      : undefined;
  const property =
    properties && typeof properties === "object" && !Array.isArray(properties)
      ? properties[key]
      : undefined;
  const title =
    property && typeof property === "object" && !Array.isArray(property)
      ? property.title
      : undefined;
  return typeof title === "string" ? title : key;
}

/** A value inside a list or an object: plain words, or its JSON text. */
function inner(c: BlockContent, value: JsonValue) {
  if (value === null) return c.notRecorded;
  if (typeof value === "boolean") return value ? c.yes : c.no;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

/**
 * Any value by its own shape: a list, the titled properties of an object, a
 * yes or no, or its text. Coded list items read in the field's words.
 */
export function JsonValueView({ field, value }: FieldValueProps) {
  const c = useBlockContent();
  if (Array.isArray(value))
    return (
      <ul className="value-list">
        {value.map((item, index) => (
          <li key={typeof item === "string" ? item : index}>
            {typeof item === "string"
              ? codeWords(c, field, item)
              : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  if (value !== null && typeof value === "object")
    return (
      <dl className="value-object">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{titleOf(field.schema, key)}</dt>
            <dd>{inner(c, item)}</dd>
          </div>
        ))}
      </dl>
    );
  return <>{inner(c, value)}</>;
}

export function TextValue(props: FieldValueProps) {
  return typeof props.value === "string" ? (
    <>{props.value}</>
  ) : (
    <JsonValueView {...props} />
  );
}

/** A number as recorded, keeping every digit of a lexical number. */
export function NumberValue(props: FieldValueProps) {
  return typeof props.value === "number" || typeof props.value === "string" ? (
    <>{String(props.value)}</>
  ) : (
    <JsonValueView {...props} />
  );
}

export function BooleanValue(props: FieldValueProps) {
  return <JsonValueView {...props} />;
}

export function DateValue(props: FieldValueProps) {
  return typeof props.value === "string" ? (
    <>{displayDate(props.value)}</>
  ) : (
    <JsonValueView {...props} />
  );
}

export function EnumValue(props: FieldValueProps) {
  const c = useBlockContent();
  return typeof props.value === "string" ? (
    <>{codeWords(c, props.field, props.value)}</>
  ) : (
    <JsonValueView {...props} />
  );
}
