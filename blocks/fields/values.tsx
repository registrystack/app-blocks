import { createContext, useContext, type ReactNode } from "react";
import { displayDate, type JsonValue } from "@registrystack/app-runtime";
import { fill, listOf, recordedNumber } from "@/blocks/lib/format";
import {
  useBlockContent,
  useLocale,
  type BlockContent,
} from "@/blocks/lib/content";
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
function inner(c: BlockContent, locale: string, value: JsonValue) {
  if (value === null) return c.notRecorded;
  if (typeof value === "boolean") return value ? c.yes : c.no;
  if (typeof value === "string") return value;
  if (typeof value === "number") return recordedNumber(value, locale);
  return JSON.stringify(value);
}

/** A list item: a code in the field's words, not recorded, or its JSON text. */
function itemWords(
  c: BlockContent,
  field: FieldValueProps["field"],
  item: JsonValue,
) {
  return typeof item === "string"
    ? codeWords(c, field, item)
    : item === null
      ? c.notRecorded
      : JSON.stringify(item);
}

/**
 * Any value by its own shape: a list, the titled properties of an object, a
 * yes or no, or its text. Coded list items read in the field's words. Inside
 * a link or a line of text, which can hold no list, a list is its items
 * joined and an object its `Title: value` pairs.
 */
export function JsonValueView({ field, value }: FieldValueProps) {
  const c = useBlockContent(),
    locale = useLocale(),
    inPhrase = useContext(InPhraseContext);
  if (Array.isArray(value))
    return inPhrase ? (
      <>
        {listOf(
          value.map((item) => itemWords(c, field, item)),
          locale,
        )}
      </>
    ) : (
      <ul className="value-list">
        {value.map((item, index) => (
          <li key={typeof item === "string" ? item : index}>
            {itemWords(c, field, item)}
          </li>
        ))}
      </ul>
    );
  if (value !== null && typeof value === "object")
    return inPhrase ? (
      <>
        {Object.entries(value)
          .map(
            ([key, item]) =>
              fill(
                c.labelled,
                {
                  label: titleOf(field.schema, key),
                  value: inner(c, locale, item),
                },
                locale,
              ),
          )
          .join("; ")}
      </>
    ) : (
      <dl className="value-object">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{titleOf(field.schema, key)}</dt>
            <dd>{inner(c, locale, item)}</dd>
          </div>
        ))}
      </dl>
    );
  return <>{inner(c, locale, value)}</>;
}

/**
 * A text value that is a whole http(s) URI, shortened to show: its host and
 * last path segment, with any path between them as an ellipsis, and its
 * fragment. The segment reads decoded where it decodes. It stays the value a
 * person would quote, never a name made from it. Any other text has no
 * presentation of its own.
 */
export function uriPresentation(value: string): string | undefined {
  if (!/^https?:\/\/\S+$/i.test(value) || !URL.canParse(value))
    return undefined;
  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1);
  let shown = url.hostname;
  if (last !== undefined) {
    let decoded = last;
    try {
      decoded = decodeURIComponent(last);
    } catch {
      // A segment that does not decode is shown as recorded.
    }
    shown += `${segments.length > 1 ? "/…" : ""}/${decoded}`;
  }
  return shown + url.hash;
}

const InPhraseContext = createContext(false);

/**
 * Marks the values inside as part of a link or a line of text, such as a
 * record's linked title cell or card, or a sentence that names a value. Both
 * can hold only phrasing content, so a value there renders as text and adds
 * no disclosure or control of its own: a disclosure cannot sit in a
 * paragraph, and a control nested in a link is invalid markup and activating
 * it can follow the link.
 */
export function InPhrase({ children }: { children?: ReactNode }) {
  return (
    <InPhraseContext.Provider value={true}>{children}</InPhraseContext.Provider>
  );
}

/** Whether the values inside are part of a link or a line of text (`InPhrase`). */
export function useInPhrase(): boolean {
  return useContext(InPhraseContext);
}

/**
 * A URI shortened, with the full identifier shown on demand. Inside a link or
 * a line of text, which can hold no disclosure, it is the URI as recorded:
 * the shortened form alone would hide the exact value, and two URIs can
 * shorten alike.
 */
function UriValue({ words, uri }: { words: string; uri: string }) {
  const c = useBlockContent(),
    inPhrase = useContext(InPhraseContext);
  if (inPhrase) return <span>{uri}</span>;
  return (
    <>
      <span>{words}</span>
      <details>
        <summary>{c.fullIdentifier}</summary>
        {uri}
      </details>
    </>
  );
}

export function TextValue(props: FieldValueProps) {
  if (typeof props.value !== "string") return <JsonValueView {...props} />;
  const words = uriPresentation(props.value);
  return words === undefined ? (
    <>{props.value}</>
  ) : (
    <UriValue words={words} uri={props.value} />
  );
}

/** A number as recorded, keeping every digit of a lexical number. */
export function NumberValue(props: FieldValueProps) {
  const locale = useLocale();
  return typeof props.value === "number" || typeof props.value === "string" ? (
    <>{recordedNumber(props.value, locale)}</>
  ) : (
    <JsonValueView {...props} />
  );
}

export function BooleanValue(props: FieldValueProps) {
  return <JsonValueView {...props} />;
}

export function DateValue(props: FieldValueProps) {
  const c = useBlockContent(),
    locale = useLocale();
  if (props.value === "") return <>{c.notRecorded}</>;
  return typeof props.value === "string" ? (
    <>{displayDate(props.value, locale)}</>
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

/**
 * A read-only structured field the UI model gives the `quantity` widget, when
 * it holds exactly a quantity value, a unit code and a unit scheme: the value
 * as recorded in `locale`'s notation and the unit as recorded, and the scheme
 * apart. Anything else, or a field without the widget, keeps the generic
 * display.
 */
export function quantityPresentation(
  value: JsonValue | undefined,
  field: FieldValueProps["field"],
  locale: string,
): { summary: string; unitScheme: string } | undefined {
  if (
    field.type !== "structured" ||
    field.widget !== "quantity" ||
    !field.readOnly
  )
    return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const names = ["quantityValue", "unitCode", "unitScheme"];
  if (
    Object.keys(value).length !== names.length ||
    names.some((name) => !Object.hasOwn(value, name))
  )
    return undefined;
  const { quantityValue, unitCode, unitScheme } = value;
  const valid =
    typeof quantityValue === "number"
      ? Number.isFinite(quantityValue)
      : typeof quantityValue === "string" &&
        /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(quantityValue);
  if (
    !valid ||
    typeof unitCode !== "string" ||
    !unitCode.trim() ||
    typeof unitScheme !== "string" ||
    !unitScheme.trim()
  )
    return undefined;
  return {
    summary: `${recordedNumber(String(quantityValue), locale)} ${unitCode}`,
    unitScheme,
  };
}

/**
 * A quantity as recorded, with its unit scheme shown on demand. Inside a link
 * or a line of text, which can hold no disclosure, it is the value and unit
 * alone.
 */
export function QuantityValue({
  summary,
  unitScheme,
}: NonNullable<ReturnType<typeof quantityPresentation>>) {
  const c = useBlockContent(),
    inPhrase = useContext(InPhraseContext);
  if (inPhrase) return <span>{summary}</span>;
  return (
    <>
      <span>{summary}</span>
      <details>
        <summary>{c.quantityUnitStandard}</summary>
        {unitScheme}
      </details>
    </>
  );
}
