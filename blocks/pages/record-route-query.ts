import type { JsonValue } from "@registrystack/app-runtime";

/**
 * What a record page carries in its hash route's query: a list's filters and
 * search, the answers a form opens with, and the path to return to once a
 * write is confirmed. The route is the only source of truth for all of them,
 * so a link to a filtered list or a preset form is a plain `href`.
 */

const FILTER = "f.";
const EMPTY = "empty.";
const SEARCH = "q";
const PRESET = "preset.";
const RETURN = "return";

/** A list narrowed by field and by search; a null filter matches a record where the field is empty. */
export interface ListQuery {
  filters: Record<string, string | null>;
  search: string;
}

/** The list a route's query asks for. */
export function listQueryOf(query: URLSearchParams): ListQuery {
  const filters: Record<string, string | null> = {};
  for (const [key, value] of query) {
    if (key.startsWith(FILTER)) filters[key.slice(FILTER.length)] = value;
    else if (key.startsWith(EMPTY) && value === "1")
      filters[key.slice(EMPTY.length)] = null;
  }
  return { filters, search: query.get(SEARCH) ?? "" };
}

/** `path` with the query that asks for this list; `path` alone when it asks for nothing. */
export function listRoute(
  path: string,
  { filters, search }: Partial<ListQuery>,
): string {
  const query = new URLSearchParams();
  for (const [field, value] of Object.entries(filters ?? {}))
    if (value === null) query.set(`${EMPTY}${field}`, "1");
    else query.set(`${FILTER}${field}`, value);
  if (search) query.set(SEARCH, search);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** The answers a route's query presets, by field id. */
export function presetOf(query: URLSearchParams): Record<string, JsonValue> {
  const preset: Record<string, JsonValue> = {};
  for (const [key, value] of query)
    if (key.startsWith(PRESET)) preset[key.slice(PRESET.length)] = value;
  return preset;
}

/**
 * The in-app path a route asks to return to, or null. Only a path starting
 * with a single `/` is one: anything else could leave the app.
 */
export function returnPathOf(query: URLSearchParams): string | null {
  const path = query.get(RETURN);
  return path && /^\/(?![/\\])/.test(path) ? path : null;
}

/** `path` with a preset and a return path in its query. */
export function formRoute(
  path: string,
  preset: Readonly<Record<string, string>>,
  returnPath: string | undefined,
): string {
  const query = new URLSearchParams();
  for (const [field, value] of Object.entries(preset))
    query.set(`${PRESET}${field}`, value);
  if (returnPath) query.set(RETURN, returnPath);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
