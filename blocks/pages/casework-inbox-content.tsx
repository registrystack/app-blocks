import { createContext, useContext, type ReactNode } from "react";

/**
 * The words the Casework inbox page shows on its own: generic defaults an
 * app replaces with its own content through `InboxContentProvider`. Kept
 * apart from `CaseworkContent` (`@/blocks/casework/casework-content`)
 * because these words are only meaningful to this one page's composition; a
 * block reused elsewhere never reads them.
 */
export interface InboxContent {
  /** Names the view tabs for assistive technology. */
  viewsLabel: string;
  allQueues: string;
  /** The queue chip's own label, once a queue is chosen: "Queue: {label}". */
  queueChip: (queue: string) => string;
  queueEmptyTitle: string;
  queueEmptyBody: string;
  refColumn: string;
  holderColumn: string;
  /** The marker shown beside the task when the item carries a return note. */
  returned: string;
  itemsCount: (count: number) => string;
  itemsCountOnPage: (count: number) => string;
  moveRowDown: string;
  moveRowUp: string;
  focusQueueFilter: string;
  selectAll: string;
  selectItem: (reference: string) => string;

  /** The page heading, and the label a list remembers this page under. */
  title: string;
  description: string;
  /** Names the scrollable region and the table for assistive technology. */
  caption: string;
  /** Every view the inbox offers, by its view code. */
  views: Readonly<Record<string, string>>;
  viewEmptyTitle: string;
  viewEmptyBody: string;
  emptyQueues: string;
  noItems: string;
  noItemsBody: string;
  /** The link from an empty page to the register's own records. */
  findRecord: string;
  /** The link from an empty page to the team board, shown to a supervisor only. */
  openHoldings: string;
  loadedAt: string;
  refresh: string;
  /** What Casework said about the page it returned, by the shortfall it named. */
  pageStatus: Readonly<Record<string, string>>;

  nextItem: string;
  nextItemNone: string;
  nextItemUnavailable: string;
  /** Announced to assistive technology whenever the loaded result set changes. */
  resultCountAnnouncement: string;
  /** A generic retry button, offered beside a secondary read that failed. */
  retry: string;
}

export const inboxEnglish: InboxContent = {
  viewsLabel: "Views",
  allQueues: "All queues",
  queueChip: (queue) => `Queue: ${queue}`,
  queueEmptyTitle: "Nothing in {queue}",
  queueEmptyBody:
    "This view contains no items in {queue}. Remove the queue filter or choose another view.",
  refColumn: "Ref",
  holderColumn: "Holder",
  returned: "Returned",
  itemsCount: (count) => (count === 1 ? "1 item" : `${count} items`),
  itemsCountOnPage: (count) =>
    count === 1 ? "1 item on this page" : `${count} items on this page`,
  moveRowDown: "Move to the next item",
  moveRowUp: "Move to the previous item",
  focusQueueFilter: "Focus the queue filter",
  selectAll: "Select every item on this page",
  selectItem: (reference) => `Select ${reference}`,

  title: "Your work",
  description: "The oldest item due in your queues opens first.",
  caption: "Your work: items waiting for your decision",
  views: {
    mine: "Your items",
    my_teams: "Your teams’ items",
    overdue: "Overdue",
    completed_by_me: "Completed by you",
  },
  viewEmptyTitle: "Nothing in the {view} view",
  viewEmptyBody: "Choose another view, or clear it, to see more of your work.",
  emptyQueues: "Your queues: {queues}.",
  noItems: "You have no work waiting",
  noItemsBody: "Nothing in your queues is waiting for your decision.",
  findRecord: "Look up a record",
  openHoldings: "See the team board",
  loadedAt: "Loaded {time}",
  refresh: "Refresh",
  pageStatus: {
    budget_exhausted:
      "Casework stopped before it reached the end, so there may be more than is shown.",
    source_unavailable:
      "Casework could not reach the service, so some of this may be missing.",
  },

  nextItem: "Open next item",
  nextItemNone: "Nothing in your queues is waiting to be opened.",
  nextItemUnavailable:
    "Casework could not say which item is next. Try again, or choose one from the list.",
  resultCountAnnouncement: "Showing {count} items",
  retry: "Try again",
};

const InboxContentContext = createContext<InboxContent>(inboxEnglish);

export function InboxContentProvider({
  content,
  children,
}: {
  content: InboxContent;
  children: ReactNode;
}) {
  return (
    <InboxContentContext.Provider value={content}>
      {children}
    </InboxContentContext.Provider>
  );
}

export function useInboxContent(): InboxContent {
  return useContext(InboxContentContext);
}
