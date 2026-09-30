import {
  readTabMemory,
  useRememberedState,
  writeTabMemory,
} from "@registrystack/app-runtime/react";

/**
 * The list an officer opened an item from, kept in this tab so the item page
 * can say "3 of 5" and offer previous and next. In memory by design, like
 * tab-memory.ts: a reload or a pasted link lands on an item with no list
 * behind it, and the item page then offers the way back to the inbox only.
 */
export interface OpenedFrom {
  /** The place the list belongs to, as the sidebar names it. */
  label: string;
  /** The hash route that shows the list again, query included. */
  path: string;
  /** The item ids in the order the list showed them. */
  ids: string[];
}

/** The key the list is remembered under in this tab's memory. */
const listKey = "casework.opened-from";

/** Records the list a page is showing, so items opened from it know their neighbours. */
export function rememberList(list: OpenedFrom) {
  writeTabMemory(listKey, list);
}

/** The list the current item was opened from, if this tab showed one. */
export function openedFrom(): OpenedFrom | null {
  return readTabMemory<OpenedFrom | null>(listKey, null);
}

/** The list the current item was opened from, and the way a list page records itself. */
export function useOpenedFrom() {
  return useRememberedState<OpenedFrom | null>(listKey, null);
}
