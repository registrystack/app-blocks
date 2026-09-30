import type { ReactNode } from "react";
import type { CaseworkWorkItem } from "@registrystack/app-runtime";
import { usePendingWorkItems } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import {
  caseworkContent,
  useCaseworkContent,
} from "@/blocks/casework/casework-content";
import type { DocumentSource } from "@/blocks/documents/document-view";
import { Notice } from "@/blocks/lib/notice";
import { CaseworkHoldingsPage } from "@/blocks/pages/casework-holdings";
import { CaseworkInboxPage } from "@/blocks/pages/casework-inbox";
import { CaseworkItemPage } from "@/blocks/pages/casework-item";
import {
  itemPageEnglish,
  useItemPageContent,
} from "@/blocks/pages/casework-item-content";
import { useReviewPageContent } from "@/blocks/pages/casework-review-content";
import {
  useRecordRemoval,
  useRecordUpload,
} from "@/blocks/pages/default-tasks";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegister } from "@/blocks/pages/record";
import { splitRoute, useRoute } from "@/blocks/shell/routing";

/**
 * The officer's work-item writes whose outcome is unknown, pointed to from
 * any page but the item's own, which offers the retry. With several items
 * unresolved the notice leads to the oldest; settling it brings the next.
 */
export function WorkItemPendingNotice() {
  const c = useCaseworkContent();
  const path = splitRoute(useRoute()).path;
  const itemHref = (itemId: string) =>
    `/casework/${encodeURIComponent(itemId)}`;
  const itemId = usePendingWorkItems().find((id) => itemHref(id) !== path);
  if (itemId === undefined) return null;
  return (
    <Notice tone="warning" title={c.unknownTitle}>
      <p>{c.caseworkUnknown ?? caseworkContent.caseworkUnknown}</p>
      <Button render={<a href={`#${itemHref(itemId)}`} />}>
        {c.resumeCasework ?? caseworkContent.resumeCasework}
      </Button>
    </Notice>
  );
}

/**
 * What an item asks of the officer: the item page's heading and the task on
 * its row. Casework names the step an item is at in a field the register
 * words in its own terms, so an app that words it passes its own heading.
 */
export type TaskHeading = (item: CaseworkWorkItem) => string;

/** The request, by the label the session model gives it, as every item's task. */
function ModelTaskHeading({
  page,
}: {
  page: (heading: TaskHeading) => ReactNode;
}) {
  const pages = usePagesContent();
  const label = useRegister().entities?.request?.label ?? pages.requestTitle;
  return page(() => label);
}

/** Renders `page` with the app's own heading, or the model's when it gives none. */
function WithTaskHeading({
  heading,
  page,
}: {
  heading?: TaskHeading;
  page: (heading: TaskHeading) => ReactNode;
}) {
  return heading ? page(heading) : <ModelTaskHeading page={page} />;
}

/**
 * The officer's own visible work, over `@/blocks/pages/casework-inbox`, with
 * its link to the review queue named as that queue is.
 */
export function DefaultCaseworkInboxPage({
  heading,
}: {
  heading?: TaskHeading;
}) {
  const review = useReviewPageContent();
  return (
    <WithTaskHeading
      heading={heading}
      page={(taskHeading) => (
        <CaseworkInboxPage
          heading={taskHeading}
          reviewsLink={
            <a className="row-link" href="#/casework/reviews">
              {review.queueTitle}
            </a>
          }
        />
      )}
    />
  );
}

/**
 * One Casework item, over `@/blocks/pages/casework-item`: the wording for the
 * apply effect and each state's own sentence from `ItemPageContent`, and the
 * default upload and removal commands for the request's attachment slots.
 */
export function DefaultCaseworkItemPage({
  id,
  heading,
  openPdf,
}: {
  id: string;
  heading?: TaskHeading;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const c = useItemPageContent();
  const sentences = c.stateSentences ?? itemPageEnglish.stateSentences;
  return (
    <WithTaskHeading
      heading={heading}
      page={(taskHeading) => (
        <CaseworkItemPage
          id={id}
          heading={taskHeading}
          appliedMessage={c.applied ?? itemPageEnglish.applied}
          applyUnconfirmedMessage={
            c.applyUnconfirmed ?? itemPageEnglish.applyUnconfirmed
          }
          stateSentence={(state) => sentences[state]}
          useUpload={useRecordUpload}
          useRemoval={useRecordRemoval}
          openPdf={openPdf}
        />
      )}
    />
  );
}

/** The supervisor's Team page, over `@/blocks/pages/casework-holdings`. */
export function DefaultCaseworkHoldingsPage({
  heading,
}: {
  heading?: TaskHeading;
}) {
  return (
    <WithTaskHeading
      heading={heading}
      page={(taskHeading) => <CaseworkHoldingsPage heading={taskHeading} />}
    />
  );
}
