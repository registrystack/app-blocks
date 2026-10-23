/**
 * What a page remembers beyond its own mount. The app remounts a page on every route
 * change, so a value that must outlive that lives here, under a key.
 *
 * By default the value lives in this tab's memory, not in storage: a reload or a
 * pasted link starts from the initial value again. A value the browser keeps between
 * sessions names how it is written as text, and falls back to the session alone when
 * the browser refuses storage.
 */
import { useCallback, useRef, useState } from "react";

/** How a value the browser keeps between sessions is written as text. */
export interface BrowserMemory<T> {
  /** Reads the stored text, null when nothing is stored. */
  decode(raw: string | null): T;
  encode(value: T): string;
}

const tabMemory = new Map<string, unknown>();

/** The value this tab remembers under a key, or the initial value. */
export function readTabMemory<T>(key: string, initial: T): T {
  return tabMemory.has(key) ? (tabMemory.get(key) as T) : initial;
}

export function writeTabMemory<T>(key: string, value: T): void {
  tabMemory.set(key, value);
}

const refusedKeys = new Set<string>();

/** Says once per key that the browser refused its storage. */
function refused(key: string, error: unknown): void {
  if (refusedKeys.has(key)) return;
  refusedKeys.add(key);
  console.warn(
    `Browser storage refused "${key}"; it lasts this session only.`,
    error,
  );
}

/**
 * The browser's storage, or undefined where there is none, as in Node. Read inside a
 * try: a sandboxed frame throws on reading it.
 */
function browserStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

/** The value the browser keeps under a key, or the initial value when storage is refused. */
export function readBrowserMemory<T>(
  key: string,
  initial: T,
  memory: BrowserMemory<T>,
): T {
  try {
    const store = browserStorage();
    return store ? memory.decode(store.getItem(key)) : initial;
  } catch (error) {
    refused(key, error);
    return initial;
  }
}

export function writeBrowserMemory<T>(
  key: string,
  value: T,
  memory: BrowserMemory<T>,
): void {
  try {
    browserStorage()?.setItem(key, memory.encode(value));
  } catch (error) {
    // The setting then lasts the session only; the switch still works.
    refused(key, error);
  }
}

/** A new value, or a function of the value remembered when it is applied. */
export type RememberedUpdate<T> = T | ((current: T) => T);

/**
 * A value remembered under a key, and the way to change it. The value is never itself
 * a function, and the key, initial value and browser memory stay the same for a page.
 *
 * Without a browser memory, the value lives in this tab's memory and changing it does
 * not render the page again: a page reads it as it renders, and a function passed to
 * the setter reads the value remembered at the moment it is called. With one, the value
 * is page state kept by the browser between sessions, and changing it renders the page.
 * The setter stays the same function for the life of the page.
 */
export function useRememberedState<T>(
  key: string,
  initial: T,
  memory?: BrowserMemory<T>,
): [T, (update: RememberedUpdate<T>) => void] {
  const [kept, setKept] = useState(() =>
    memory ? readBrowserMemory(key, initial, memory) : initial,
  );
  const latest = useRef({ initial, memory, kept });
  latest.current = { initial, memory, kept };
  const set = useCallback(
    (update: RememberedUpdate<T>) => {
      const { initial, memory, kept } = latest.current;
      const current = memory ? kept : readTabMemory(key, initial);
      const next =
        typeof update === "function"
          ? (update as (current: T) => T)(current)
          : update;
      if (!memory) {
        writeTabMemory(key, next);
        return;
      }
      latest.current = { initial, memory, kept: next };
      setKept(next);
      writeBrowserMemory(key, next, memory);
    },
    [key],
  );
  return [memory ? kept : readTabMemory(key, initial), set];
}
