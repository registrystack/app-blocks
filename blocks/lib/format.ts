/**
 * Replace `{name}` tokens in a content template with the given values. The
 * template is one sentence that carries its own grammar; tokens are never
 * reordered or joined with other fragments. Unknown tokens stay visible so a
 * missing value is caught instead of silently dropped.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(
    /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,
    (token, name: string) => (name in values ? String(values[name]) : token),
  );
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
 * A full calendar date and time, in the reader's own words; null when the
 * value cannot be read as a date. Unlike a pure calendar date, this reads a
 * moment (an upload, a verification) that did occur in some time zone, so it
 * is safe to render in the browser's own.
 */
export function longDate(value: string): string | null {
  const when = new Date(value);
  if (Number.isNaN(when.valueOf())) return null;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(when);
}
