import { useRef } from "react";
import { useRememberedState } from "@registrystack/app-runtime/react";
import type { CursorEntry } from "@/blocks/lib/queue-parts";

/**
 * Tab memory for a paged list, not persistence. The app remounts a page on
 * every route change (the router keys the page element by the full hash), so
 * the cursor stack behind Previous cannot live in component state. It is
 * in-memory by design: a reload or a pasted link lands on its page with
 * nothing before it, so Previous is disabled until Next stacks an earlier page
 * in this tab.
 *
 * Each list owns its own stack: two lists are two result sets, and a cursor
 * from one is never offered to the other.
 */
export interface TabCursors {
  /** The key the stack is remembered under in this tab's memory. */
  key: string;
}

/** The memory one list keeps for this tab, held at module scope by its page. */
export function tabCursors(key: string): TabCursors {
  return { key };
}

const noEntries: CursorEntry[] = [];

/**
 * The page before the one being read, and the three moves that change it.
 *
 * The stack is reconciled against the URL on an instance's first render: a URL
 * the page did not write (Back, Forward, a cleared filter) always arrives as a
 * fresh mount with a stack pointing elsewhere, so it collapses to the landed
 * page and Previous can never mix cursors across result sets. Later renders of
 * the same instance are stale views during an in-flight navigation and must
 * not touch the stack this page's own clicks maintain.
 */
export function useTabCursors(
  memory: TabCursors,
  view: { cursor?: string | undefined; page: number },
) {
  const [remembered, setEntries] = useRememberedState<CursorEntry[]>(
    memory.key,
    noEntries,
  );
  let entries = remembered;
  const reconciled = useRef(false);
  if (!reconciled.current) {
    reconciled.current = true;
    const top = entries.at(-1);
    if (!top || top.cursor !== view.cursor || top.page !== view.page) {
      entries = [{ cursor: view.cursor, page: view.page }];
      setEntries(entries);
    }
  }
  return {
    /** The entry Previous returns to, and nothing on the first page in this tab. */
    previous: entries.at(-2),
    /** Stacks the page a Next click leaves behind. */
    next(cursor: string, page: number) {
      setEntries((entries) => [...entries, { cursor, page }]);
    },
    /** Drops the page a Previous click leaves. */
    back() {
      setEntries((entries) => entries.slice(0, -1));
    },
    /** Collapses the stack to a first page, after a view change or a recovery. */
    restart() {
      setEntries([{ cursor: undefined, page: 1 }]);
    },
  };
}
