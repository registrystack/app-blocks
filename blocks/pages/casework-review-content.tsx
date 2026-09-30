import { createContext, useContext, type ReactNode } from "react";

/**
 * The words the Casework review pages show on their own: the queue table,
 * the task's status line and its hold controls. Kept apart from
 * `CaseworkContent` (`@/blocks/casework/casework-content`), which already
 * carries the review task's context, decision, draft, notes, history and
 * clocks wording for the blocks those panels render; these words are only
 * meaningful to this page composition's own queue and status line.
 */
export interface ReviewPageContent {
  queueTitle: string;
  queueDescription: string;
  queueCaption: string;
  queueEmpty: string;
  queueReference: string;
  /**
   * Names a task in the queue by its place in the list: "Review task {number}".
   * A queue row carries no subject, so nothing it serves names the task.
   */
  queueRowName: string;
  queueQueue: string;
  queueStatus: string;
  back: string;
  /** The task page's title, filled with the request's own reference: "Review {reference}". */
  taskTitle: string;
  /** The task page's title when nothing the host serves names the task or its kind. */
  taskTitleUnnamed: string;
  statusOpen: string;
  statusHeldByYou: string;
  /** Filled with who holds the task: "Held by {holder}". */
  statusHeldBy: string;
  statusHeldElsewhere: string;
  statusDecided: string;
  claim: string;
  release: string;
  claimUnconfirmed: string;
  releaseUnconfirmed: string;
  retryClaim: string;
  retryRelease: string;
}

export const reviewPageEnglish: ReviewPageContent = {
  queueTitle: "Review tasks",
  queueDescription: "Requests waiting for a reviewer's decision.",
  queueCaption: "Review tasks you can see",
  queueEmpty: "No review tasks are waiting.",
  queueReference: "Review task",
  queueRowName: "Review task {number}",
  queueQueue: "Queue",
  queueStatus: "Status",
  back: "Back to review tasks",
  taskTitle: "Review {reference}",
  taskTitleUnnamed: "Review task",
  statusOpen: "Open, not claimed",
  statusHeldByYou: "Held by you",
  statusHeldBy: "Held by {holder}",
  statusHeldElsewhere: "Held by another officer",
  statusDecided: "Decided",
  claim: "Claim this task",
  release: "Release this task",
  claimUnconfirmed:
    "The service could not confirm this claim. Retry sends the same claim again.",
  releaseUnconfirmed:
    "The service could not confirm this release. Retry sends the same release again.",
  retryClaim: "Retry the same claim",
  retryRelease: "Retry the same release",
};

const ReviewPageContentContext =
  createContext<ReviewPageContent>(reviewPageEnglish);

export function ReviewPageContentProvider({
  content,
  children,
}: {
  content: ReviewPageContent;
  children: ReactNode;
}) {
  return (
    <ReviewPageContentContext.Provider value={content}>
      {children}
    </ReviewPageContentContext.Provider>
  );
}

export function useReviewPageContent(): ReviewPageContent {
  return useContext(ReviewPageContentContext);
}
