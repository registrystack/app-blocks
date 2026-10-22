/**
 * The kit's wording is written in a subset of ICU MessageFormat, so one
 * message can carry the grammar of any language: `{name}` placeholders,
 * `{count, plural, one {...} other {...}}` with `#` for the count, and
 * `{value, select, a {...} other {...}}`. An apostrophe quotes a brace, or a
 * `#` inside a plural, and two apostrophes are one; any other apostrophe is
 * text. Other ICU argument types, such as `number` or `date`, are not read:
 * the blocks write numbers, dates and lists in the locale before they reach a
 * message.
 */

/** Why a message pattern cannot be read. */
export class MessageSyntaxError extends Error {
  override name = "MessageSyntaxError";
}

type Part =
  | string
  | { kind: "pound" }
  | { kind: "argument"; name: string; source: string }
  | {
      kind: "plural" | "select";
      name: string;
      cases: Map<string, Part[]>;
      source: string;
    };

const pluralCases = /^(?:=\d+|zero|one|two|few|many|other)$/;

function parse(pattern: string): Part[] {
  let at = 0;
  const space = () => {
    while (at < pattern.length && /\s/.test(pattern[at]!)) at++;
  };
  const word = (shape: RegExp) => {
    const match = shape.exec(pattern.slice(at));
    at += match?.[0].length ?? 0;
    return match?.[0] ?? "";
  };

  /** Text and arguments up to the end, or up to the brace that closes a case. */
  const message = (inPlural: boolean, inCase: boolean): Part[] => {
    const parts: Part[] = [];
    let text = "";
    const flush = () => {
      if (text) parts.push(text);
      text = "";
    };
    while (at < pattern.length) {
      const char = pattern[at]!;
      const next = pattern[at + 1];
      if (char === "'" && next === "'") {
        text += "'";
        at += 2;
      } else if (
        char === "'" &&
        (next === "{" || next === "}" || (inPlural && next === "#"))
      ) {
        at++;
        while (at < pattern.length) {
          if (pattern[at] === "'" && pattern[at + 1] === "'") {
            text += "'";
            at += 2;
          } else if (pattern[at] === "'") {
            at++;
            break;
          } else text += pattern[at++];
        }
      } else if (char === "{") {
        flush();
        parts.push(argument());
      } else if (char === "}") {
        if (inCase) break;
        throw new MessageSyntaxError(`a closing brace has no opening brace`);
      } else if (char === "#" && inPlural) {
        flush();
        parts.push({ kind: "pound" });
        at++;
      } else {
        text += char;
        at++;
      }
    }
    flush();
    return parts;
  };

  const argument = (): Part => {
    const start = at++;
    const unclosed = () =>
      new MessageSyntaxError(
        `the "{" that starts "${pattern.slice(start, start + 20)}" has no closing brace`,
      );
    space();
    const name = word(/^[a-zA-Z][a-zA-Z0-9_]*/);
    if (!name)
      throw new MessageSyntaxError(
        `a placeholder has no name; a name starts with a letter and holds letters, digits and _`,
      );
    space();
    if (at >= pattern.length) throw unclosed();
    if (pattern[at] === "}") {
      at++;
      return { kind: "argument", name, source: pattern.slice(start, at) };
    }
    if (pattern[at] !== ",")
      throw new MessageSyntaxError(
        `{${name}} needs a comma or a closing brace after its name`,
      );
    at++;
    space();
    const kind = word(/^[a-zA-Z]+/);
    if (kind !== "plural" && kind !== "select")
      throw new MessageSyntaxError(
        `{${name}} is followed by "${kind}", but only plural or select can follow a name`,
      );
    const label = `{${name}, ${kind}}`;
    space();
    if (pattern[at] === "}")
      throw new MessageSyntaxError(`${label} lists no cases`);
    if (pattern[at] !== ",")
      throw new MessageSyntaxError(`${label} needs a comma before its cases`);
    at++;
    space();
    if (kind === "plural" && pattern.startsWith("offset:", at))
      throw new MessageSyntaxError(
        `${label} has an offset, which the kit does not read`,
      );
    const cases = new Map<string, Part[]>();
    for (;;) {
      space();
      if (at >= pattern.length) throw unclosed();
      if (pattern[at] === "}") break;
      const key = word(/^(?:=\d+|[a-zA-Z0-9_-]+)/);
      if (!key)
        throw new MessageSyntaxError(
          `${label} has "${pattern[at]}" where a case name belongs`,
        );
      if (kind === "plural" && !pluralCases.test(key))
        throw new MessageSyntaxError(
          `${label} has the case ${key}; a plural case is zero, one, two, few, many, other or =N`,
        );
      if (cases.has(key))
        throw new MessageSyntaxError(`${label} names the case ${key} twice`);
      space();
      if (pattern[at] !== "{")
        throw new MessageSyntaxError(
          `the case ${key} of ${label} needs an opening brace`,
        );
      at++;
      const parts = message(kind === "plural", true);
      if (at >= pattern.length) throw unclosed();
      at++;
      cases.set(key, parts);
    }
    at++;
    if (!cases.size) throw new MessageSyntaxError(`${label} lists no cases`);
    if (!cases.has("other"))
      throw new MessageSyntaxError(
        `${label} has no other case, which every plural and select needs`,
      );
    return { kind, name, cases, source: pattern.slice(start, at) };
  };

  return message(false, false);
}

/**
 * The names of the values a message pattern reads, once each, in the order
 * they first appear. Throws `MessageSyntaxError` for a pattern that cannot be
 * read, saying why.
 */
export function messageArguments(pattern: string): string[] {
  const names = new Set<string>();
  const walk = (parts: Part[]) => {
    for (const part of parts) {
      if (typeof part === "string" || part.kind === "pound") continue;
      names.add(part.name);
      if (part.kind !== "argument") for (const parts of part.cases.values()) walk(parts);
    }
  };
  walk(parse(pattern));
  return [...names];
}

/**
 * A message pattern with its values filled in, in `locale`: a number is
 * written in the locale's notation and a text as given, and a plural chooses
 * its case by an exact `=N` first, then by the locale's plural rules. A
 * placeholder, plural or select with no value stays as written, so a missing
 * value is caught instead of silently dropped. A pattern that cannot be read
 * is shown as written: the message catalog check refuses one among the
 * kit's defaults, and the UI model check refuses one in a translation.
 */
export function formatMessage(
  pattern: string,
  values: Readonly<Record<string, string | number>>,
  locale: string,
): string {
  let parts: Part[];
  try {
    parts = parse(pattern);
  } catch (error) {
    if (error instanceof MessageSyntaxError) return pattern;
    throw error;
  }
  const shown = (value: string | number) =>
    typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : value;
  const render = (parts: Part[], count: string): string =>
    parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (part.kind === "pound") return count;
        if (!Object.hasOwn(values, part.name)) return part.source;
        const value = values[part.name]!;
        if (part.kind === "argument") return shown(value);
        const other = part.cases.get("other")!;
        if (part.kind === "select")
          return render(part.cases.get(String(value)) ?? other, count);
        const n =
          typeof value === "number"
            ? value
            : /^-?\d+(?:\.\d+)?$/.test(value)
              ? Number(value)
              : Number.NaN;
        const chosen = Number.isFinite(n)
          ? (part.cases.get(`=${n}`) ??
            part.cases.get(new Intl.PluralRules(locale).select(n)) ??
            other)
          : other;
        return render(chosen, shown(value));
      })
      .join("");
  return render(parts, "#");
}
