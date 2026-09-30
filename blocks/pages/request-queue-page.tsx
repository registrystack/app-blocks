import { useEffect } from "react";
import {
  type EntityModel,
  type RecordView,
  type RequestState,
} from "@registrystack/app-runtime";
import { useAuthority, useRecords } from "@registrystack/app-runtime/react";
import { EmptyState } from "@/blocks/shell/empty-state";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/shell/live-announcer";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { StatusBadge } from "@/blocks/shell/status-badge";
import { useShellContent } from "@/blocks/shell/shell-content";
import {
  listTitle,
  usePagesContent,
  type PagesContent,
} from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import {
  recordPath,
  recordTitle,
  useRegister,
  type RegisterEntities,
} from "@/blocks/pages/record";
import {
  QueueFilterBar,
  QueueFilterChips,
  QueuePager,
  QueueResultCount,
  QueueTable,
  parseView,
  writeView,
  type ActiveFilter,
  type QueueColumn,
  type QueueView,
} from "@/blocks/lib/queue-parts";
import { tabCursors, useTabCursors } from "@/blocks/lib/tab-memory";
import { fill } from "@/blocks/lib/format";

/**
 * The request queue: a holder's own requests, or the full list a reviewer or
 * other staff role sees. Its filter bar, chips, range sentence, table and
 * pager are the reusable parts in queue-parts.tsx; what stays here is what
 * belongs to this list: its route, its columns and the cursor stack this tab
 * remembers.
 */

/**
 * Tab memory for the queue, not persistence. The app remounts a page on every
 * route change (the router keys the page element by the full hash), so the
 * cursor stack behind Previous, which must survive a URL this page writes
 * itself, cannot live in component state and lives here instead.
 */
const queueCursors = tabCursors("request-queue.cursors");

/** Derived, never stored: who must act before this request can progress. */
function waitingOn(state: string, pages: PagesContent): string {
  if (state === "submitted" || state === "approved")
    return pages.waitingOnOffice;
  if (state === "changes-requested" || state === "approval-expired")
    return pages.waitingOnSubject;
  return "—";
}

/** The session's requests; which entity they are comes from the model. */
export function RequestQueuePage() {
  const register = useRegister();
  if (register.isPending) return <Loading />;
  const entities = register.entities;
  if (register.error || !entities?.request)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  return <RequestQueue entities={entities} request={entities.request} />;
}

function RequestQueue({
  entities,
  request,
}: {
  entities: RegisterEntities;
  request: EntityModel;
}) {
  const shell = useShellContent();
  const pages = usePagesContent();
  const routes = useRegisterRoutes();
  const session = useAuthority();
  const writeQueueView = (next: QueueView) => writeView(routes.requests, next);
  // Parse once per render. No filter, size, cursor or page state is held in
  // React state alongside the URL; every change writes the hash, and the hash
  // alone decides what is fetched and rendered.
  const view = parseView(splitRoute(useRoute()).query);
  const [announcement, announce] = useAnnouncement();
  // Host contract: a cursor continuation carries its filter server-side, and
  // the host refuses any parameter sent alongside it. With no cursor, the
  // filter and page size are sent instead.
  const query = useRecords(
    request.id,
    view.cursor
      ? { cursor: view.cursor }
      : {
          state: (view.state || undefined) as RequestState | undefined,
          size: view.size,
        },
  );

  const cursors = useTabCursors(queueCursors, view);
  const previousEntry = cursors.previous;

  // A cursor the host no longer holds (a restarted session lost the cursor
  // store) is recovered from, not reported: go back to the first page of the
  // same view, keeping the filter and page size.
  const recovering = Boolean(view.cursor) && query.cursorExpired;
  useEffect(() => {
    if (!recovering) return;
    cursors.restart();
    announce(pages.queueRecoveredAnnouncement);
    navigate(writeQueueView({ ...view, cursor: undefined, page: 1 }));
    // The announcement names the recovery once; navigation then reloads.
  }, [recovering]);

  // One polite live region carries every queue announcement. The result count
  // is restated whenever the loaded result set changes, so applying, removing
  // or clearing a filter says how many requests remain.
  useEffect(() => {
    if (query.data)
      announce(
        fill(pages.resultCountAnnouncement, { count: query.data.items.length }),
      );
  }, [query.data, announce, pages]);

  // The stage filter offers the states the model names for this request,
  // never a hard-coded list, in the content's words where it has them. It
  // comes from the model, so it stays mounted while another view loads.
  const stageOptions = Object.entries(request.request?.stateLabels ?? {}).map(
    ([value, label]) => ({
      value,
      label: shell.stateLabels[value] ?? label,
    }),
  );

  const items = query.data?.items ?? [];
  const start = (view.page - 1) * view.size + 1;
  // No total is available for this list, so the caption and the count line
  // never invent one.
  const holder = session.role === "holder";
  const captionText = `${
    holder ? pages.holderQueueCaption : pages.queueCaption
  } ${pages.defaultOrderNote}`;
  // A list with nothing in it says why in the words of whoever reads it.
  const emptyList =
    session.role === "reviewer"
      ? { title: pages.queueEmptyTitle, body: pages.queueEmptyBody }
      : holder
        ? { title: pages.holderQueueEmptyTitle, body: pages.holderQueueEmptyBody }
        : { title: pages.requestsEmptyTitle, body: pages.requestsEmptyBody };
  const activeFilters: ActiveFilter[] =
    view.state === ""
      ? []
      : [
          {
            name: "state",
            label: `${pages.stageFilterLabel}: ${
              stageOptions.find((option) => option.value === view.state)
                ?.label ?? view.state
            }`,
          },
        ];

  /** Changing a filter or the page size restarts from the first page. */
  function firstPage(change: { state?: string; size?: number }) {
    const next: QueueView = {
      state: change.state ?? view.state,
      size: change.size ?? view.size,
      cursor: undefined,
      page: 1,
    };
    cursors.restart();
    navigate(writeQueueView(next));
  }
  function nextPage(cursor: string) {
    cursors.next(cursor, view.page + 1);
    navigate(writeQueueView({ ...view, cursor, page: view.page + 1 }));
  }
  const previousHref = writeQueueView({
    ...view,
    cursor: previousEntry?.cursor,
    page: previousEntry?.page ?? 1,
  });

  const nextCursor = query.data?.nextCursor;
  // The reference is the row header and its link is the row's only action;
  // request and record identifiers never reach the screen.
  const columns: QueueColumn<RecordView>[] = [
    {
      key: "reference",
      header: pages.referenceColumn,
      rowHeader: true,
      cell: (record) => {
        const named = recordTitle(request, record);
        const title = named?.trim() ? named : pages.unnamedRequest;
        const path = recordPath(routes, entities, record.entity, record.id);
        return path ? (
          <a className="row-link" href={`#${path}`}>
            {title}
          </a>
        ) : (
          title
        );
      },
    },
    {
      key: "state",
      header: pages.stageFilterLabel,
      cell: (record) =>
        record.request && (
          <StatusBadge
            state={record.request.state}
            served={request.request?.stateLabels[record.request.state]}
          />
        ),
    },
    {
      key: "waiting-on",
      header: pages.waitingOnColumn,
      cell: (record) => waitingOn(record.request?.state ?? "", pages),
    },
  ];
  return (
    <>
      <PageHeading
        title={
          session.role === "reviewer"
            ? pages.queueTitle
            : listTitle(
                pages,
                holder ? "holderRequestsTitle" : "requestListTitle",
                request.pluralLabel,
              )
        }
        description={
          session.role === "reviewer"
            ? pages.queueDescription
            : pages.requestsDescription
        }
      />
      <LiveAnnouncer message={announcement} />
      {stageOptions.length > 0 && (
        <QueueFilterBar
          id="queue-state-filter"
          name="state"
          label={pages.stageFilterLabel}
          value={view.state}
          anyLabel={pages.allStates}
          options={stageOptions}
          onApply={(state) => firstPage({ state })}
        />
      )}
      <QueueFilterChips
        filters={activeFilters}
        onRemove={() => firstPage({ state: "" })}
        clearHref={writeQueueView({
          state: "",
          size: view.size,
          cursor: undefined,
          page: 1,
        })}
      />
      <QueueResultCount start={start} count={items.length} />
      {query.error && !recovering ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : !query.data ? (
        <QueueTable
          caption={captionText}
          columns={columns}
          rows={[]}
          rowKey={(record) => record.id}
          loading
        />
      ) : items.length === 0 ? (
        activeFilters.length > 0 ? (
          <EmptyState
            title={fill(pages.queueFilteredEmptyTitle, {
              filters: activeFilters.map((filter) => filter.label).join(", "),
            })}
          >
            {pages.queueFilteredEmptyBody}
          </EmptyState>
        ) : (
          <EmptyState title={emptyList.title}>{emptyList.body}</EmptyState>
        )
      ) : (
        <QueueTable
          caption={captionText}
          columns={columns}
          rows={items}
          rowKey={(record) => record.id}
        />
      )}
      {query.data && items.length > 0 && (
        <QueuePager
          previousHref={previousEntry ? previousHref : undefined}
          onPrevious={cursors.back}
          nextHref={
            nextCursor
              ? writeQueueView({
                  ...view,
                  cursor: nextCursor,
                  page: view.page + 1,
                })
              : undefined
          }
          onNext={nextCursor ? () => nextPage(nextCursor) : undefined}
          sizeId="queue-page-size"
          size={view.size}
          onSize={(size) => firstPage({ size })}
        />
      )}
    </>
  );
}
