/**
 * The wait before a held view is read again: `firstMs` before the first re-read, doubling
 * with each re-read already made, never longer than `capMs`.
 */
export function backOffInterval(
  firstMs: number,
  capMs: number,
  rereads: number,
): number {
  return Math.min(capMs, firstMs * 2 ** Math.min(rereads, 30));
}

/** Where a page started counting the re-reads of one view: its key and the view's update count then. */
export interface RereadStart {
  key: string;
  updates: number;
}

/**
 * How many times a held view has been read again since the page first held it. The query
 * cache outlives the page, so the count starts from the page's first view, and a different
 * key (the page now shows another record) starts it afresh.
 */
export function rereadsSince(
  start: RereadStart | undefined,
  key: string,
  updates: number,
): { start: RereadStart; rereads: number } {
  const from = start?.key === key ? start : { key, updates };
  return { start: from, rereads: Math.max(0, updates - from.updates) };
}
