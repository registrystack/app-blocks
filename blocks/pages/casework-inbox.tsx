import { useEffect, useRef, type ReactNode } from "react";
import {
  type CaseworkItemView,
  type CaseworkWorkItem,
} from "@registrystack/app-runtime";
import {
  useAuthority,
  useCaseworkItems,
  useNextCaseworkItem,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { caseworkDateTime } from "@/blocks/casework/shared";
import { CaseworkInbox } from "@/blocks/casework/inbox";
import { useShortcut } from "@/blocks/casework/shortcuts";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { fill } from "@/blocks/lib/format";
import {
  QueueFilterChips,
  QueuePager,
  parsePaging,
  writePaging,
  type ActiveFilter,
  type PagedView,
} from "@/blocks/lib/queue-parts";
import { tabCursors, useTabCursors } from "@/blocks/lib/tab-memory";
import { useOpenedFrom } from "@/blocks/lib/list-memory";
import { useInboxContent } from "@/blocks/pages/casework-inbox-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/shell/live-announcer";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";

/**
 * The officer's own visible work: view tabs, a queue chip and one table.
 * Casework decides which items are visible and in which order; this page
 * adds presentation and wording only, and opening an item never claims it.
 * The toolbar, the table and the footer live in blocks/casework/inbox.tsx,
 * which carries no register-specific wording or route of its own; this file
 * works out the view, the queue and the paging from the hash, fetches the
 * items, and resolves the wording the block is given. What the item asks of
 * the officer names a register-specific field, and the link to the reviews
 * queue reads that page's own content, so both come from the caller.
 */

/** This page's own route; every view of it is a URL under this path. */
const INBOX_PATH = "/casework";
/** The view the officer lands on, carried in the URL as the empty value. */
const DEFAULT_VIEW: CaseworkItemView = "my_teams";
/** Every view the inbox offers, in the order the officer reads the tabs. */
const VIEWS: readonly CaseworkItemView[] = [
  "mine",
  "my_teams",
  "overdue",
  "completed_by_me",
];
/** The id of the queue-filter trigger, so the `/` shortcut can find it. */
const QUEUE_FILTER_ID = "inbox-queue-filter";

/**
 * Moves focus to the row reference `step` rows from the focused one, stopping
 * at either end; with no row focused it lands on the first.
 */
function focusRow(step: 1 | -1) {
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>("a[data-row-ref]"),
  ];
  const index = links.findIndex((link) => link === document.activeElement);
  const target =
    index === -1
      ? links[0]
      : links[Math.min(Math.max(index + step, 0), links.length - 1)];
  target?.focus();
}

/** Every part of an inbox view: the view and queue filters plus the paging. */
interface InboxView extends PagedView {
  view: CaseworkItemView | "";
  queue: string;
}

/**
 * The hash query is the only source of truth for an inbox view. It carries
 * `view`, `queue`, `size`, `cursor` and `page`.
 */
function parseInboxView(query: URLSearchParams): InboxView {
  const view = query.get("view") ?? "";
  return {
    // The default view is the empty value, so one view has one URL.
    view:
      (VIEWS as readonly string[]).includes(view) && view !== DEFAULT_VIEW
        ? (view as CaseworkItemView)
        : "",
    queue: query.get("queue") ?? "",
    ...parsePaging(query),
  };
}

/** The route a view is. */
function writeInboxView(next: InboxView): string {
  const params = new URLSearchParams();
  if (next.view) params.set("view", next.view);
  if (next.queue) params.set("queue", next.queue);
  writePaging(params, next);
  const search = params.toString();
  return `${INBOX_PATH}${search ? `?${search}` : ""}`;
}

/**
 * Tab memory for the inbox, and its own: the request queue keeps a separate
 * stack for a separate result set. Beside the cursor stack the inbox
 * remembers what Casework has said about the officer's queues so far: the
 * queues it named on the last page (for an empty view's sentence), and the
 * id and label of every queue seen on a loaded item (for the queue chip,
 * because a served-queues list carries labels only, never the id a filter
 * needs). Casework sends served queues with every page, an empty page
 * included, and a page that names none leaves the last named ones standing
 * rather than wiping them.
 */
const inboxCursors = tabCursors("casework.inbox.cursors");
const tab = {
  servedQueues: [] as string[],
  queues: new Map<string, string>(),
};
// The application keys pages by their full route. The originating instance is
// kept so its last route render cannot consume focus before the replacement.
let queueFilterFocusOwner: symbol | undefined;

export function CaseworkInboxPage({
  heading,
  reviewsLink,
}: {
  /** What an item asks of the officer; a register-specific field the caller names. */
  heading: (item: CaseworkWorkItem) => ReactNode;
  /** The link to the reviews queue, with that page's own wording. */
  reviewsLink: ReactNode;
}) {
  const pageInstance = useRef(Symbol("inbox-route"));
  const c = useInboxContent();
  const routes = useRegisterRoutes();
  const session = useAuthority();
  const route = useRoute();
  // Parse once per render. No view, queue, size, cursor or page state is held
  // in React state alongside the URL; every change writes the hash, and the
  // hash alone decides what is fetched and rendered.
  const view = parseInboxView(splitRoute(route).query);
  const [announcement, announce] = useAnnouncement();
  const [, rememberList] = useOpenedFrom();
  // Service contract: a cursor continuation carries its own filters, so it is
  // sent alone. With no cursor, the view, queue and page size are sent instead.
  const query = useCaseworkItems(
    view.cursor
      ? { cursor: view.cursor }
      : {
          view: view.view || DEFAULT_VIEW,
          limit: String(view.size),
          ...(view.queue ? { queue: view.queue } : {}),
        },
  );
  const next = useNextCaseworkItem(view.queue ? { queue: view.queue } : {});

  const cursors = useTabCursors(inboxCursors, view);
  const previousEntry = cursors.previous;

  const items = query.data?.items ?? [];

  // One polite live region carries every inbox announcement. The result count
  // is restated whenever the loaded result set changes, so changing a filter
  // says how much work it holds.
  useEffect(() => {
    if (query.data)
      announce(
        fill(c.resultCountAnnouncement, { count: query.data.items.length }),
      );
  }, [query.data, announce, c]);

  // Removing the active chip unmounts its focused button. Once the URL is the
  // unfiltered view, return focus to the queue control that replaced it.
  useEffect(() => {
    if (
      !queueFilterFocusOwner ||
      queueFilterFocusOwner === pageInstance.current
    )
      return;
    const trigger = document.getElementById(QUEUE_FILTER_ID);
    if (!trigger) return;
    queueFilterFocusOwner = undefined;
    trigger.focus();
  }, [view.queue, query.isPending]);

  // The list an item page opens from, so it can offer its way back. Recorded
  // whenever this page shows a page of rows, empty or not.
  useEffect(() => {
    if (query.data)
      rememberList({
        label: c.title,
        path: route,
        ids: items.map((item) => item.id),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, route]);

  if (query.data?.servedQueues?.length)
    tab.servedQueues = query.data.servedQueues;
  for (const item of items) {
    if (item.queue && item.queueLabel)
      tab.queues.set(item.queue, item.queueLabel);
  }
  // What Casework said about this page: a complete page speaks for itself, a
  // short one says so rather than passing as the whole of the officer's work.
  const shortfall = query.data?.status
    ? c.pageStatus[query.data.status]
    : undefined;
  const viewLabel = (value: CaseworkItemView) => c.views[value];

  /** Changing a filter or the page size restarts from the first page. */
  function firstPage(change: {
    view?: CaseworkItemView | "";
    queue?: string;
    size?: number;
  }) {
    cursors.restart();
    navigate(
      writeInboxView({
        view: change.view ?? view.view,
        queue: change.queue ?? view.queue,
        size: change.size ?? view.size,
        cursor: undefined,
        page: 1,
      }),
    );
  }
  function nextPage(cursor: string) {
    cursors.next(cursor, view.page + 1);
    navigate(writeInboxView({ ...view, cursor, page: view.page + 1 }));
  }
  function prepareQueueFilterFocus() {
    queueFilterFocusOwner = pageInstance.current;
  }
  function removeQueueFilter() {
    prepareQueueFilterFocus();
    firstPage({ queue: "" });
  }
  function viewHref(value: CaseworkItemView): string {
    return `#${writeInboxView({
      view: value === DEFAULT_VIEW ? "" : value,
      queue: view.queue,
      size: view.size,
      cursor: undefined,
      page: 1,
    })}`;
  }

  const nextCursor = query.data?.nextCursor;

  // j and k move focus between the rows' reference links, so Enter is the
  // focused link's own key and a screen reader follows along; n opens the
  // next item; / reaches the queue chip. None fires in a text field or popup,
  // because useShortcut keeps a bare key out of them.
  useShortcut(
    { key: "j", label: c.moveRowDown },
    () => focusRow(1),
    items.length > 0,
  );
  useShortcut(
    { key: "k", label: c.moveRowUp },
    () => focusRow(-1),
    items.length > 0,
  );
  useShortcut(
    { key: "n", label: c.nextItem },
    () => {
      if (next.data) navigate(`/casework/${encodeURIComponent(next.data.id)}`);
    },
    !!next.data,
  );
  useShortcut({ key: "/", label: c.focusQueueFilter }, () => {
    document.getElementById(QUEUE_FILTER_ID)?.focus();
  });

  // Opening the next item is a link while there is one to open, and a
  // disabled button with the reason beside it while there is not, so the
  // control never disappears from under the officer. It opens an item; it
  // never claims one. When Casework could not answer, Try again asks once
  // more; the host keeps its place in the queues between tries.
  const nextReason = next.isPending
    ? undefined
    : next.error
      ? c.nextItemUnavailable
      : next.data
        ? undefined
        : c.nextItemNone;
  const openNext =
    next.data && !next.error ? (
      <Button
        render={<a href={`#/casework/${encodeURIComponent(next.data.id)}`} />}
      >
        {c.nextItem}
      </Button>
    ) : (
      <Button disabled>{c.nextItem}</Button>
    );

  const selectedQueueLabel = view.queue
    ? (tab.queues.get(view.queue) ?? view.queue)
    : undefined;
  const activeFilters: ActiveFilter[] = selectedQueueLabel
    ? [
        {
          name: "queue",
          label: c.queueChip(selectedQueueLabel),
        },
      ]
    : [];

  const emptyTitle = selectedQueueLabel
    ? fill(c.queueEmptyTitle, { queue: selectedQueueLabel })
    : view.view === ""
      ? c.noItems
      : fill(c.viewEmptyTitle, { view: viewLabel(view.view) });
  const emptyBody = [
    selectedQueueLabel
      ? fill(c.queueEmptyBody, { queue: selectedQueueLabel })
      : view.view === ""
        ? c.noItemsBody
        : c.viewEmptyBody,
    !selectedQueueLabel && tab.servedQueues.length > 0
      ? fill(c.emptyQueues, { queues: tab.servedQueues.join(", ") })
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeading
        title={c.title}
        description={c.description}
        action={
          <div className="casework-next">
            {openNext}
            {reviewsLink}
            {nextReason && <p className="muted">{nextReason}</p>}
            {next.error && (
              <Button
                variant="outline"
                size="sm"
                disabled={next.isFetching}
                onClick={() => void next.refetch()}
              >
                {c.retry}
              </Button>
            )}
          </div>
        }
      />
      <LiveAnnouncer message={announcement} />
      <CaseworkInbox
        viewsLabel={c.viewsLabel}
        views={VIEWS.map((value) => ({
          value,
          label: viewLabel(value),
          href: viewHref(value),
        }))}
        activeView={view.view || DEFAULT_VIEW}
        onViewClick={() => cursors.restart()}
        queueFilterId={QUEUE_FILTER_ID}
        queueTriggerLabel={
          selectedQueueLabel ? c.queueChip(selectedQueueLabel) : c.allQueues
        }
        allQueuesLabel={c.allQueues}
        queues={[...tab.queues].map(([id, label]) => ({ id, label }))}
        selectedQueueId={view.queue}
        onSelectQueue={(value) => firstPage({ queue: value })}
        filterChips={
          <QueueFilterChips
            filters={activeFilters}
            onRemove={removeQueueFilter}
            onClear={removeQueueFilter}
            clearHref={writeInboxView({
              ...view,
              queue: "",
              cursor: undefined,
              page: 1,
            })}
          />
        }
        loading={!query.data}
        error={query.error ?? undefined}
        renderError={(error) => (
          <ErrorPanel error={error} retry={() => void query.refetch()} />
        )}
        items={items as CaseworkWorkItem[]}
        caption={c.caption}
        heading={heading}
        itemHref={(id) => `#/casework/${encodeURIComponent(id)}`}
        reviewHref={(taskId) =>
          `#/casework/reviews/${encodeURIComponent(taskId)}`
        }
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
        emptyContent={
          <>
            <span className="casework-empty-links">
              <a className="row-link" href={`#${routes.records}`}>
                {c.findRecord}
              </a>
              {session.caseworkProfile === "supervisor" && (
                <a className="row-link" href="#/casework/holdings">
                  {c.openHoldings}
                </a>
              )}
            </span>
            <div className="casework-empty-refresh">
              <p className="muted">
                {fill(c.loadedAt, {
                  time: caseworkDateTime(
                    new Date(query.dataUpdatedAt).toISOString(),
                  ),
                })}
              </p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                {c.refresh}
              </Button>
            </div>
          </>
        }
        shortfall={query.data ? shortfall : undefined}
        // A failed continuation keeps its pager: Previous is the way back to
        // the rows the officer had, and losing it would strand them.
        showFooter={Boolean(
          (query.data && items.length > 0) || (query.error && previousEntry),
        )}
        resultCount={
          query.data
            ? (query.data.status ?? "complete") === "complete"
              ? c.itemsCount(items.length)
              : c.itemsCountOnPage(items.length)
            : undefined
        }
        pager={
          <QueuePager
            previousHref={
              previousEntry
                ? writeInboxView({
                    ...view,
                    cursor: previousEntry.cursor,
                    page: previousEntry.page,
                  })
                : undefined
            }
            onPrevious={cursors.back}
            nextHref={
              nextCursor
                ? writeInboxView({
                    ...view,
                    cursor: nextCursor,
                    page: view.page + 1,
                  })
                : undefined
            }
            onNext={nextCursor ? () => nextPage(nextCursor) : undefined}
            sizeId="casework-page-size"
            size={view.size}
            onSize={(size) => firstPage({ size })}
          />
        }
      />
    </>
  );
}
