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

/** The value the browser keeps under a key, or the initial value when storage is refused. */
export function readBrowserMemory<T>(
  key: string,
  initial: T,
  memory: BrowserMemory<T>,
): T {
  try {
    return memory.decode(localStorage.getItem(key));
  } catch {
    return initial;
  }
}

export function writeBrowserMemory<T>(
  key: string,
  value: T,
  memory: BrowserMemory<T>,
): void {
  try {
    localStorage.setItem(key, memory.encode(value));
  } catch {
    // The setting then lasts the session only; the switch still works.
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
