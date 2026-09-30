import { createContext, useContext, type ReactNode } from "react";

/**
 * The words the casework item page shows on its own: generic defaults an app
 * replaces with its own content through `ItemPageContentProvider`. Kept apart
 * from `CaseworkContent` (`@/blocks/casework/casework-content`) because these
 * words are only meaningful to this one page's composition; a block reused
 * elsewhere never reads them.
 */
export interface ItemPageContent {
  /** The back link's label when the item was opened outside any list. */
  defaultListLabel: string;
  /** "{index} of {count}", the item's position in the list it was opened from. */
  positionInList: string;
  prevItem: string;
  noPrevItem: string;
  nextItem: string;
  noNextItem: string;
  heldByYou: string;
  /** "held by {holder}" */
  heldByOther: string;
  assign: string;
  takeItem: string;
  releaseItem: string;
  /** Heading over the request's own fields the change does not write. */
  whyAsked: string;
  /** Heading over the item's own trail of what has happened on it. */
  historyHeading: string;
  historyEmpty: string;
  /** Marks a field, or a row, the applicant's return flagged. */
  flagged: string;
  /** Shown while an earlier action on this item is still settling. */
  liveAttempt: string;

  // The request's effect and the item's state, which a register words in its
  // own terms. Optional: an app that builds its ItemPageContent from its own
  // content type may not carry these yet, so the default item page falls
  // back to `itemPageEnglish`'s own wording.
  /** Shown once a confirmed write applied the pending change. */
  applied?: string;
  /** Shown when an apply could not be confirmed. */
  applyUnconfirmed?: string;
  /**
   * The one sentence kept for an item's state, by its state code; a state
   * without one shows none. An apply item's state is looked up as
   * `apply:<state>` first (`workItemStateKeys`).
   */
  stateSentences?: Readonly<Record<string, string>>;
}

export const itemPageEnglish: Required<ItemPageContent> = {
  defaultListLabel: "All items",
  positionInList: "{index} of {count}",
  prevItem: "Previous",
  noPrevItem: "There is no previous item in this list.",
  nextItem: "Next",
  noNextItem: "There is no next item in this list.",
  heldByYou: "held by you",
  heldByOther: "held by {holder}",
  assign: "Assign",
  takeItem: "Take this item",
  releaseItem: "Put this item back in the queue",
  whyAsked: "Why the applicant asked",
  historyHeading: "History",
  historyEmpty: "No history recorded yet.",
  flagged: "Flagged",
  liveAttempt:
    "Casework is still settling an earlier action on this item, so nothing else can be done on it yet. Read the item again to see where it stands.",
  applied: "The approved change was applied.",
  applyUnconfirmed:
    "The service could not confirm that the change was applied. Retry sends the same apply again. Do not act on this item again until this is resolved.",
  stateSentences: {
    "waiting-applicant":
      "The applicant has been asked for more information. Nothing is asked of you until they reply.",
    "waiting-application":
      "This change is approved. It changes the record only when it is applied.",
    synchronizing:
      "The registry is still settling the last action on this item.",
    completed: "This item is finished. Nothing more is asked of you.",
    "apply:waiting-application":
      "This change cannot be applied now: it has not been approved, applying it is blocked, or its approval has expired. It has not changed the record.",
  },
};

const ItemPageContentContext = createContext<ItemPageContent>(itemPageEnglish);

export function ItemPageContentProvider({
  content,
  children,
}: {
  content: ItemPageContent;
  children: ReactNode;
}) {
  return (
    <ItemPageContentContext.Provider value={content}>
      {children}
    </ItemPageContentContext.Provider>
  );
}

export function useItemPageContent(): ItemPageContent {
  return useContext(ItemPageContentContext);
}
