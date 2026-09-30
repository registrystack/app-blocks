import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CaseworkPrincipal,
  CaseworkWorkItem,
} from "@registrystack/app-runtime";
import {
  useCaseworkHoldings,
  useStaffingAbsenceCover,
  useStaffingAbsences,
  useStaffingTargets,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import {
  CaseworkTeam,
  actionsId,
  holdersFromItems,
  type CaseworkTeamDialog,
} from "@/blocks/casework/team";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { useBlockContent } from "@/blocks/lib/content";
import { useInboxContent } from "@/blocks/pages/casework-inbox-content";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/shell/live-announcer";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { QueueFilterChips, type ActiveFilter } from "@/blocks/lib/queue-parts";
import {
  AbsenceDrawer,
  EndAbsenceDialog,
  MoveWorkDialog,
  ReassignDialog,
  isSamePerson,
  type MoveOffer,
} from "@/blocks/pages/casework-staffing";
import { useOpenedFrom } from "@/blocks/lib/list-memory";
import { tabCursors, useTabCursors } from "@/blocks/lib/tab-memory";

/**
 * The supervisor's Team page: the counts Casework sent for the page it
 * answered, the people holding work with their absence cover beside them, and
 * the team's items, which can be selected and reassigned together. The board,
 * its cursor and its absence cover are fetched here; the layout, the wording
 * and the row menus live in blocks/casework/team.tsx, which this page feeds
 * with the board and reports back which dialog to open. This page carries no
 * register-specific wording or route of its own; what an item asks of the
 * officer names a register-specific field, so the caller supplies it.
 */

/** This page's own route; every view of it is a URL under this path. */
const TEAM_PATH = "/casework/holdings";
/** The queue trigger receives focus after its active chip is removed. */
const TEAM_QUEUE_FILTER_ID = "team-queue-filter";
// The application keys pages by their full route. The originating instance is
// kept so its last route render cannot consume focus before the replacement.
let queueFilterFocusOwner: symbol | undefined;

/** A view of the page: the queue chosen on it and the host's paging. */
interface TeamView {
  queue: string;
  cursor?: string;
  page: number;
}

/** The hash query is the only source of truth for a view of the page. */
function parseTeamView(query: URLSearchParams): TeamView {
  const cursor = query.get("cursor") || undefined;
  return {
    queue: query.get("queue") ?? "",
    cursor,
    // A page number means nothing without the cursor that reached it.
    page: cursor ? Math.max(2, Number(query.get("page")) || 2) : 1,
  };
}

/** The route a view is. */
function writeTeamView(view: TeamView): string {
  const params = new URLSearchParams();
  if (view.queue) params.set("queue", view.queue);
  if (view.cursor) params.set("cursor", view.cursor);
  if (view.cursor && view.page > 1) params.set("page", String(view.page));
  const search = params.toString();
  return `${TEAM_PATH}${search ? `?${search}` : ""}`;
}

/** The page's own cursor stack, separate from every other list's. */
const teamCursors = tabCursors("casework.team.cursors");

/** The element a closing dialog hands focus to: the first of these still on the page. */
function focusBack(...selectors: string[]) {
  return () => {
    for (const selector of selectors) {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) return found;
    }
    return document.querySelector<HTMLElement>("h1");
  };
}

export function CaseworkHoldingsPage({
  heading,
}: {
  /** What an item asks of the officer; a register-specific field the caller names. */
  heading: (item: CaseworkWorkItem) => ReactNode;
}) {
  const c = useCaseworkContent();
  const queueWords = useInboxContent();
  const pagerWords = useBlockContent();
  const route = useRoute();
  const view = parseTeamView(splitRoute(route).query);
  const holdings = useCaseworkHoldings(view.cursor);
  const cursors = useTabCursors(teamCursors, view);
  const [, rememberList] = useOpenedFrom();
  const loaded = holdings.isSuccess;
  // Absence cover is offered only where Casework staffs it for this officer,
  // and the absence list is read only then.
  const coverAnswered = useStaffingAbsenceCover(loaded);
  const people = useStaffingTargets(
    loaded ? { purpose: "absencePerson", limit: "100" } : null,
  );
  const absences = useStaffingAbsences(coverAnswered);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<CaseworkTeamDialog & { key: number }>();
  const [open, setOpen] = useState(false);
  const serial = useRef(0);
  const pageInstance = useRef(Symbol("team-route"));
  const [announcement, announce] = useAnnouncement();

  const board = holdings.data;
  const items =
    board?.items.filter((item) => !view.queue || item.queue === view.queue) ??
    [];

  useEffect(() => {
    if (board) announce(c.teamVisibleItemsAnnouncement(items.length));
  }, [board, view.queue, items.length, announce, c]);

  // Removing the active chip unmounts its focused button. Once the URL is the
  // unfiltered view, return focus to the queue control that replaced it.
  useEffect(() => {
    if (
      !queueFilterFocusOwner ||
      queueFilterFocusOwner === pageInstance.current
    )
      return;
    // Loading has no trigger yet. A settled view consumes the request even
    // when an error or a single-queue board offers no queue control.
    if (holdings.isPending) return;
    const trigger = document.getElementById(TEAM_QUEUE_FILTER_ID);
    queueFilterFocusOwner = undefined;
    trigger?.focus();
  }, [view.queue, holdings.isPending]);

  // The list an item page opens from, so it can offer its way back. Recorded
  // whenever this page shows a page of rows, empty or not.
  useEffect(() => {
    if (board)
      rememberList({
        label: c.teamTitle,
        path: route,
        ids: items.map((item) => item.id),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, route]);

  function openDialog(next: CaseworkTeamDialog) {
    serial.current += 1;
    setDialog({ ...next, key: serial.current });
    setOpen(true);
  }

  function prepareQueueFilterFocus() {
    queueFilterFocusOwner = pageInstance.current;
  }

  function removeQueueFilter() {
    prepareQueueFilterFocus();
    navigate(writeTeamView({ ...view, queue: "" }));
  }

  if (holdings.isPending)
    return (
      <>
        <PageHeading title={c.teamTitle} />
        <Loading />
      </>
    );
  if (holdings.error || !board)
    return (
      <>
        <PageHeading title={c.teamTitle} />
        <ErrorPanel
          error={holdings.error}
          retry={() => void holdings.refetch()}
        />
      </>
    );

  const now = Date.now();
  // The queues this page serves, as Casework named them: its own queue, every
  // queue a holder summary covers, and every queue an item on the page is in.
  const held = board.holders ?? holdersFromItems(board.items);
  const queues = new Map<string, string>([[board.queue, board.queueLabel]]);
  for (const row of held) queues.set(row.queue, row.queueLabel);
  for (const item of board.items)
    if (item.queue) queues.set(item.queue, item.queueLabel);
  const severalQueues = queues.size > 1;
  const canRecord = coverAnswered && Boolean(absences.data);
  const selectedQueueLabel = view.queue
    ? (queues.get(view.queue) ?? view.queue)
    : undefined;
  const activeFilters: ActiveFilter[] = selectedQueueLabel
    ? [
        {
          name: "queue",
          label: queueWords.queueChip(selectedQueueLabel),
        },
      ]
    : [];

  /** Moving a person's work, offered once their cover is saved. */
  function moveOffers(principal: CaseworkPrincipal) {
    return held
      .filter(
        (row) =>
          row.activeItems > 0 && isSamePerson(principal, row.holderPrincipal),
      )
      .map((row): MoveOffer => ({
        key: row.queue,
        queueLabel: row.queueLabel,
        open: () =>
          openDialog({
            kind: "move",
            from: {
              principal: row.holderPrincipal,
              name: row.principal,
              queue: row.queue,
              queueLabel: row.queueLabel,
              activeItems: row.activeItems,
            },
            returnId: actionsId({
              queue: row.queue,
              principal: row.holderPrincipal,
            }),
          }),
      }));
  }

  const previous = cursors.previous;
  const nextCursor = board.nextCursor ?? undefined;
  const shortfall = board.status
    ? c.caseworkPageStatus[board.status]
    : undefined;
  const returnTo = dialog ? `#${CSS.escape(dialog.returnId)}` : "h1";

  return (
    <>
      <PageHeading
        title={c.teamTitle}
        description={severalQueues ? undefined : board.queueLabel}
        action={
          canRecord ? (
            <Button
              id="team-record-absence"
              onClick={() =>
                openDialog({ kind: "absence", returnId: "team-record-absence" })
              }
            >
              {c.teamRecordAbsence}
            </Button>
          ) : undefined
        }
      />
      <LiveAnnouncer message={announcement} />
      <CaseworkTeam
        board={board}
        queueFilterId={TEAM_QUEUE_FILTER_ID}
        queueTriggerLabel={
          view.queue
            ? queueWords.queueChip(queues.get(view.queue) ?? view.queue)
            : queueWords.allQueues
        }
        allQueuesLabel={queueWords.allQueues}
        queues={[...queues].map(([id, label]) => ({ id, label }))}
        selectedQueueId={view.queue}
        onSelectQueue={(queue) => navigate(writeTeamView({ ...view, queue }))}
        filterChips={
          <QueueFilterChips
            filters={activeFilters}
            onRemove={removeQueueFilter}
            onClear={removeQueueFilter}
            clearHref={writeTeamView({ ...view, queue: "" })}
          />
        }
        absences={absences.data?.items}
        absencesError={absences.error}
        onRetryAbsences={() => void absences.refetch()}
        people={people.items}
        canRecord={canRecord}
        now={now}
        selected={selected}
        onSelectedChange={setSelected}
        onOpenDialog={openDialog}
        heading={heading}
        itemHref={(id) => `#/casework/${encodeURIComponent(id)}`}
        shortfall={shortfall}
        pager={
          (previous || nextCursor) && (
            <>
              {previous && (
                <Button
                  render={
                    <a
                      href={`#${writeTeamView({ ...view, cursor: previous.cursor, page: previous.page })}`}
                      onClick={cursors.back}
                    />
                  }
                  variant="outline"
                  size="icon-sm"
                >
                  <ChevronLeft aria-hidden="true" />
                  <span className="sr-only">{pagerWords.previous}</span>
                </Button>
              )}
              {nextCursor && (
                <Button
                  render={
                    <a
                      href={`#${writeTeamView({ ...view, cursor: nextCursor, page: view.page + 1 })}`}
                      onClick={() => cursors.next(nextCursor, view.page + 1)}
                    />
                  }
                  variant="outline"
                  size="icon-sm"
                >
                  <ChevronRight aria-hidden="true" />
                  <span className="sr-only">{pagerWords.next}</span>
                </Button>
              )}
            </>
          )
        }
      />

      {dialog?.kind === "reassign" && (
        <ReassignDialog
          key={dialog.key}
          open={open}
          onOpenChange={setOpen}
          items={dialog.items}
          finalFocus={focusBack("#team-reassign", ".casework-items")}
          onReassigned={(ids) =>
            setSelected((current) => {
              const next = new Set(current);
              for (const id of ids) next.delete(id);
              return next;
            })
          }
        />
      )}
      {dialog?.kind === "move" && (
        <MoveWorkDialog
          key={dialog.key}
          open={open}
          onOpenChange={setOpen}
          from={dialog.from}
          finalFocus={focusBack(returnTo)}
        />
      )}
      {dialog?.kind === "absence" && absences.data && (
        <AbsenceDrawer
          key={dialog.key}
          open={open}
          onOpenChange={setOpen}
          absence={dialog.absence}
          person={dialog.person}
          directoryRef={absences.data.directoryRef}
          finalFocus={focusBack(returnTo)}
          moveOffers={moveOffers}
        />
      )}
      {dialog?.kind === "end" && absences.data && (
        <EndAbsenceDialog
          key={dialog.key}
          open={open}
          onOpenChange={setOpen}
          absence={dialog.absence}
          directoryRef={absences.data.directoryRef}
          finalFocus={focusBack(returnTo)}
          onEnded={() => {
            announce(c.absenceEnded);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
