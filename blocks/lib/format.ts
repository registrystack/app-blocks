import { formatMessage } from "@registrystack/app-runtime";
import { createElement, Fragment, type ReactNode } from "react";

/**
 * Fill a content template's placeholders with the given values, in `locale`
 * (`useLocale`). The template is one sentence that carries its own grammar,
 * an ICU message (`formatMessage`): a `{count, plural, ...}` chooses its
 * words by the locale's plural rules, and a number is written in the
 * locale's notation. Tokens are never reordered or joined with other
 * fragments. Unknown tokens stay visible so a missing value is caught instead
 * of silently dropped.
 */
export function fill(
  template: string,
  values: Readonly<Record<string, string | number>>,
  locale: string,
): string {
  return formatMessage(template, values, locale);
}

/**
 * `fill` for a template whose values include page elements, such as a
 * reference set in monospace: text and number values are filled as `fill`
 * fills them, and each element takes its placeholder's place, wherever the
 * template's language puts it.
 */
export function fillNodes(
  template: string,
  values: Readonly<Record<string, ReactNode>>,
  locale: string,
): ReactNode {
  const elements: ReactNode[] = [];
  const texts: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "number") {
      texts[name] = value;
    } else {
      texts[name] = `\uE000${elements.length}\uE001`;
      elements.push(value);
    }
  }
  const parts = fill(template, texts, locale).split(/\uE000(\d+)\uE001/);
  return createElement(
    Fragment,
    null,
    ...parts.map((part, index) =>
      index % 2 === 1 ? elements[Number(part)] : part,
    ),
  );
}

/**
 * Languages that write a common noun with a capital letter inside a sentence,
 * so a label keeps its own first letter there.
 */
const capitalisedNouns = new Set(["de", "gsw", "lb"]);

/**
 * A registry label as it reads inside a sentence ("Change {field}"), in
 * `locale`. A label is written to stand alone, with a capital first letter;
 * inside a sentence its first word is lowered, unless that word is an
 * acronym ("NHS number") or the language capitalises its nouns. Words after
 * the first keep their own letters, since they may be names.
 */
export function inSentence(label: string, locale: string): string {
  const language = locale.split("-", 1)[0]!.toLowerCase();
  if (capitalisedNouns.has(language)) return label;
  const first = /^\S+/.exec(label)?.[0] ?? "";
  const letters = first.replace(/\P{L}/gu, "");
  if (letters.length > 1 && letters === letters.toLocaleUpperCase(locale))
    return label;
  return first.toLocaleLowerCase(locale) + label.slice(first.length);
}

/**
 * Items read in a line, such as a value's list of choices, joined by the
 * separators `locale` writes for a plain list.
 */
export function listOf(items: readonly string[], locale: string): string {
  return new Intl.ListFormat(locale, { type: "unit", style: "short" }).format(
    items,
  );
}

/** A plain decimal: no exponent, no leading zero, no sign but a minus. */
const PLAIN_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.(\d+))?$/;

/**
 * A number as recorded, in the locale's notation: the locale's decimal mark,
 * minus sign and digits, no grouping, and exactly the recorded fraction
 * digits, so no digit is added, dropped or rounded. A plain decimal of up to
 * 15 significant digits is one a JavaScript number holds exactly; a longer
 * one, or a text that is not a plain decimal, such as an exponent, is shown
 * as recorded.
 */
export function recordedNumber(value: number | string, locale: string): string {
  const text = String(value);
  const plain = PLAIN_DECIMAL.exec(text);
  const digits = plain?.[1]?.length ?? 0;
  const significant = text.replace(/\D/g, "").replace(/^0+/, "").length;
  if (!plain || significant > 15 || digits > 100) return text;
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(text));
}

/**
 * An operation name read as words, for a control no content names: separators
 * and camel-case humps become spaces and the first letter is capitalised.
 */
export function humanizeName(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.\s]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Whether a label already names a record type, in any case. */
export function mentions(label: string, record: string): boolean {
  return label.toLowerCase().includes(record.toLowerCase());
}

/**
 * A control label that names the record type it finds, so "Record code"
 * beside an organization reads "Organization record code", in `locale`. A
 * label that already names the type stays as it is.
 */
export function namedFor(label: string, record: string, locale: string): string {
  if (mentions(label, record)) return label;
  return `${record} ${inSentence(label, locale)}`;
}

/**
 * A lookup selector label that names the record type: the registry's derived
 * "By record code" becomes "By organization record code", in `locale`. A
 * label the model words is its own wording and stays as declared.
 */
export function selectorNamedFor(
  selector: { label: string; derived?: true },
  record: string,
  locale: string,
): string {
  const { label } = selector;
  const derived = selector.derived && /^By (.+)$/.exec(label);
  if (!derived || mentions(label, record)) return label;
  return `By ${inSentence(record, locale)} ${inSentence(derived[1]!, locale)}`;
}

/**
 * Whole calendar days from `from` to `now`, midnight to midnight. Pure number:
 * every wording that renders it lives in content. Negative when `from` is
 * in the future; null when `from` is not a readable date.
 */
export function relativeDays(from: string, now = new Date()): number | null {
  const start = new Date(from);
  if (Number.isNaN(start.valueOf())) return null;
  const day = 86400000;
  const fromDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowDay - fromDay) / day);
}
/**
 * The distance from `from` to `now` in the unit a list reads it in: minutes
 * within the hour, hours within the day, calendar days beyond. Pure numbers,
 * negative for the future; every wording lives in content. Null when `from`
 * is not a readable date.
 */
export function relativeSpan(
  from: string,
  now = new Date(),
): { unit: "minute" | "hour" | "day"; value: number } | null {
  const start = new Date(from);
  if (Number.isNaN(start.valueOf())) return null;
  const minutes = Math.trunc((now.valueOf() - start.valueOf()) / 60000);
  if (Math.abs(minutes) < 60) return { unit: "minute", value: minutes };
  const hours = Math.trunc(minutes / 60);
  if (Math.abs(hours) < 24) return { unit: "hour", value: hours };
  return { unit: "day", value: relativeDays(from, now) ?? 0 };
}

/**
 * A full calendar date and time, in the reader's own words, written in
 * `locale`; null when the value cannot be read as a date. Unlike a pure
 * calendar date, this reads a moment (an upload, a verification) that did
 * occur in some time zone, so it is safe to render in the browser's own.
 */
export function longDate(value: string, locale: string): string | null {
  const when = new Date(value);
  if (Number.isNaN(when.valueOf())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(when);
}
