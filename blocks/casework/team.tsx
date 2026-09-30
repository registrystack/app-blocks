import { useRef, type ReactNode, type RefObject } from "react";
import { ChevronDown, Ellipsis } from "lucide-react";
import type {
  CaseworkHolderSummary,
  CaseworkHoldings,
  CaseworkPrincipal,
  CaseworkStaffingAbsence,
  CaseworkStaffingPrincipal,
  CaseworkWorkItem,
} from "@registrystack/app-runtime";
import { useStaffingTargets } from "@registrystack/app-runtime/react";
import { fill } from "@/blocks/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useCaseworkContent, type CaseworkContent } from "@/blocks/casework/casework-content";
import { CaseworkItemsTable } from "@/blocks/casework/items-table";
import {
  caseworkDateTime,
  caseworkHolder,
  caseworkPerson,
  caseworkShortName,
} from "@/blocks/casework/shared";
import { isSamePerson, type MoveWorkFrom } from "@/blocks/casework/staffing";

/**
 * The supervisor's team board: the counts Casework sent for the page it
 * answered, the people holding work with their absence cover beside them, and
 * the team's items, which can be selected and reassigned together. The board
 * itself, its cursor and its absence cover are read by the caller, since a
 * supervisor's queues and their staffing writes are opaque, register-neutral
 * facts this block only lays out. Which dialog a row's action opens is
 * reported back through `onOpenDialog`; rendering the dialog stays with the
 * caller, since the writes it makes name no register-specific fact either.
 */

/** One queue the team board can be narrowed to. */
export interface CaseworkTeamQueueOption {
  id: string;
  label: string;
}

/** What the page has open over it, and where focus goes when it closes. */
export type CaseworkTeamDialog = { returnId: string } & (
  | { kind: "reassign"; items: CaseworkWorkItem[] }
  | { kind: "move"; from: MoveWorkFrom }
  | {
      kind: "absence";
      absence?: CaseworkStaffingAbsence;
      person?: CaseworkStaffingPrincipal;
    }
  | { kind: "end"; absence: CaseworkStaffingAbsence }
);

export interface CaseworkTeamProps {
  board: CaseworkHoldings;

  /** So a page-level shortcut can find and focus the queue filter's trigger. */
  queueFilterId: string;
  /** The trigger's own label: "All queues" or a queue's name, already phrased. */
  queueTriggerLabel: string;
  allQueuesLabel: string;
  queues: CaseworkTeamQueueOption[];
  selectedQueueId: string;
  onSelectQueue: (id: string) => void;
  /** The active queue filter as a removable chip, or nothing when unfiltered. */
  filterChips?: ReactNode;

  /** The absence cover Casework holds for the people this officer supervises. */
  absences?: readonly CaseworkStaffingAbsence[];
  absencesError?: unknown;
  onRetryAbsences: () => void;
  /** The colleagues Casework staffs cover for, when it answered. */
  people: readonly CaseworkStaffingPrincipal[];
  /** Whether absence cover can be written on this page. */
  canRecord: boolean;
  /** Fixes "now" for a deterministic reading of a person's absence line in tests. */
  now: number;

  selected: ReadonlySet<string>;
  onSelectedChange: (next: Set<string>) => void;
  /** Fired when a row's or the toolbar's action needs a dialog opened over the page. */
  onOpenDialog: (dialog: CaseworkTeamDialog) => void;

  /** What the item asks of the officer, for the task column of one row. */
  heading: (item: CaseworkWorkItem) => ReactNode;
  /** Where the item's reference links to. The block assumes no router of its own. */
  itemHref: (id: string) => string;

  /** What Casework said about this page, when it was short of the officer's whole work. */
  shortfall?: string;
  pager?: ReactNode;
}

/**
 * One person in one queue. The separator is a control character so a queue
 * name and a person's name can never run together into the same key.
 */
function holderKey(queue: string, principal: CaseworkPrincipal) {
  return `${queue}\u0000${principal.issuer}\u0000${principal.subject}`;
}

/**
 * The by-person rows for a host that does not send holder summaries: the same
 * shape, counted from the items on this page and nothing more.
 */
export function holdersFromItems(
  items: readonly CaseworkWorkItem[],
): CaseworkHolderSummary[] {
  const rows = new Map<string, CaseworkHolderSummary>();
  for (const item of items) {
    if (!item.holder || !item.holderPrincipal) continue;
    const key = holderKey(item.queue, item.holderPrincipal);
    const row = rows.get(key) ?? {
      holderPrincipal: item.holderPrincipal,
      principal: item.holder,
      queue: item.queue,
      queueLabel: item.queueLabel,
      activeItems: 0,
      overdueItems: 0,
      heldByMe: false,
    };
    row.activeItems += 1;
    if (item.dueState === "overdue") row.overdueItems += 1;
    if (item.heldByMe) row.heldByMe = true;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** The id of a row's menu trigger, so a dialog it opened can hand focus back. */
export function actionsId(row: { queue?: string; principal: CaseworkPrincipal }) {
  return `team-actions-${encodeURIComponent(row.queue ?? "")}-${encodeURIComponent(row.principal.issuer)}-${encodeURIComponent(row.principal.subject)}`;
}

/** A day short enough for the line under a name: "14 Sept". */
function shortDay(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
      }).format(date);
}

/**
 * The cover that says most about a person now: the one running or next to
 * run, and failing that the last one that ended.
 */
function absenceFor(
  absences: readonly CaseworkStaffingAbsence[] | undefined,
  principal: CaseworkPrincipal,
  now: number,
) {
  const own = (absences ?? []).filter((absence) =>
    isSamePerson(absence.person.principal, principal),
  );
  const ahead = own
    .filter((absence) => Date.parse(absence.until) >= now)
    .sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
  return (
    ahead[0] ??
    [...own].sort((a, b) => Date.parse(b.until) - Date.parse(a.until))[0]
  );
}

/** A person's absence as a second line under their name, the instants on hover. */
function AwayLine({
  absence,
  now,
}: {
  absence: CaseworkStaffingAbsence;
  now: number;
}) {
  const c = useCaseworkContent();
  const cover = caseworkShortName(absence.cover.principal);
  const text =
    now < Date.parse(absence.from)
      ? c.teamAwayFrom(shortDay(absence.from), shortDay(absence.until), cover)
      : now <= Date.parse(absence.until)
        ? c.teamAwayUntil(shortDay(absence.until), cover)
        : c.teamWasAway(shortDay(absence.until));
  return (
    <span
      className="team-away block text-xs text-muted-foreground"
      title={c.teamAwayTitle(
        caseworkDateTime(absence.from),
        caseworkDateTime(absence.until),
      )}
    >
      {text}
    </span>
  );
}

/** One row of the people table: a person in one queue, or away with nothing held. */
export interface CaseworkTeamPersonRow {
  key: string;
  principal: CaseworkPrincipal;
  name: string;
  heldByMe: boolean;
  queue?: string;
  queueLabel?: string;
  activeItems: number;
  overdueItems: number;
}

/** What a row's own menu already knows, once its self-fetch has answered. */
export interface CaseworkTeamPersonRowMenuContext {
  id: string;
  /** Whether absence cover can be written on this page. */
  canRecord: boolean;
  /** The same colleague as Casework's own staffing directory, when it names one. */
  person?: CaseworkStaffingPrincipal;
  /** The cover already recorded for this person, when Casework holds one. */
  absence?: CaseworkStaffingAbsence;
  /** Whether a colleague is eligible to take this row's queue and person's work. */
  moveEligible: boolean;
}

/**
 * The dialogs a person's row offers, in the order they are offered: moving
 * their work, then recording new cover, then changing cover already
 * recorded. Pulled out of the row so the gating rules (what Casework
 * answered, what is eligible, what is already recorded) are checked directly
 * rather than through a menu's rendered output.
 */
export function personRowDialogEntries(
  c: CaseworkContent,
  row: CaseworkTeamPersonRow,
  ctx: CaseworkTeamPersonRowMenuContext,
): { label: string; dialog: CaseworkTeamDialog }[] {
  const entries: { label: string; dialog: CaseworkTeamDialog }[] = [];
  if (ctx.moveEligible && row.queue && row.queueLabel) {
    const from: MoveWorkFrom = {
      principal: row.principal,
      name: row.name,
      queue: row.queue,
      queueLabel: row.queueLabel,
      activeItems: row.activeItems,
    };
    entries.push({
      label: c.teamMoveWork,
      dialog: { kind: "move", from, returnId: ctx.id },
    });
  }
  if (ctx.canRecord && ctx.person)
    entries.push({
      label: c.teamRecordAbsenceFor,
      dialog: { kind: "absence", person: ctx.person, returnId: ctx.id },
    });
  if (ctx.canRecord && ctx.absence) {
    entries.push({
      label: c.teamEditAbsence,
      dialog: { kind: "absence", absence: ctx.absence, returnId: ctx.id },
    });
    entries.push({
      label: c.teamEndAbsence,
      dialog: { kind: "end", absence: ctx.absence, returnId: ctx.id },
    });
  }
  return entries;
}

function PersonRow({
  row,
  showQueue,
  absence,
  people,
  canRecord,
  now,
  onOpenDialog,
  menuContainer,
}: {
  row: CaseworkTeamPersonRow;
  showQueue: boolean;
  absence?: CaseworkStaffingAbsence;
  people: readonly CaseworkStaffingPrincipal[];
  canRecord: boolean;
  now: number;
  onOpenDialog: (dialog: CaseworkTeamDialog) => void;
  /** Where the row menu opens, so it stays inside the page's landmarks. */
  menuContainer: RefObject<HTMLDivElement | null>;
}) {
  const c = useCaseworkContent();
  const assignment = useStaffingTargets(
    row.queue && row.activeItems > 0
      ? { purpose: "assignment", queue: row.queue, limit: "100" }
      : null,
  );
  const id = actionsId(row);
  const person = people.find((target) =>
    isSamePerson(target.principal, row.principal),
  );
  const moveEligible = assignment.items.some((target) =>
    isSamePerson(target.principal, row.principal),
  );
  const entries = personRowDialogEntries(c, row, {
    id,
    canRecord,
    person,
    absence,
    moveEligible,
  });
  return (
    <TableRow>
      <TableHead
        scope="row"
        className="h-auto py-2 text-sm font-medium whitespace-normal text-foreground"
      >
        {caseworkHolder({ holder: row.name, heldByMe: row.heldByMe }, c)}
        {absence && <AwayLine absence={absence} now={now} />}
      </TableHead>
      {showQueue && (
        <TableCell className="whitespace-normal">{row.queueLabel}</TableCell>
      )}
      <TableCell className="text-right tabular-nums">
        {row.activeItems}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.overdueItems}
      </TableCell>
      <TableCell className="w-10 px-2 text-right">
        {entries.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  id={id}
                  variant="ghost"
                  size="icon-sm"
                  aria-label={c.teamPersonActions(row.name)}
                />
              }
            >
              <Ellipsis aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" container={menuContainer}>
              {entries.map((entry) => (
                <DropdownMenuItem
                  key={entry.label}
                  onClick={() => onOpenDialog(entry.dialog)}
                >
                  {entry.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

export function CaseworkTeam({
  board,
  queueFilterId,
  queueTriggerLabel,
  allQueuesLabel,
  queues,
  selectedQueueId,
  onSelectQueue,
  filterChips,
  absences,
  absencesError,
  onRetryAbsences,
  people,
  canRecord,
  now,
  selected,
  onSelectedChange,
  onOpenDialog,
  heading,
  itemHref,
  shortfall,
  pager,
}: CaseworkTeamProps) {
  const c = useCaseworkContent();
  // The menu opens in the page rather than at the end of the body, so it
  // stays inside the main landmark.
  const menuLayer = useRef<HTMLDivElement>(null);

  const held = board.holders ?? holdersFromItems(board.items);
  const items = board.items.filter(
    (item) => !selectedQueueId || item.queue === selectedQueueId,
  );
  const severalQueues = queues.length > 1;
  const bounded = board.status !== "complete" || Boolean(board.nextCursor);
  const selectedQueueLabel = selectedQueueId
    ? (queues.find((queue) => queue.id === selectedQueueId)?.label ??
      selectedQueueId)
    : undefined;

  // Whoever is behind reads first: overdue work, then the largest hold, and
  // the officer's own row after colleagues who hold as much.
  const holderRows: CaseworkTeamPersonRow[] = held
    .filter((row) => !selectedQueueId || row.queue === selectedQueueId)
    .sort(
      (a, b) =>
        b.overdueItems - a.overdueItems ||
        b.activeItems - a.activeItems ||
        Number(a.heldByMe) - Number(b.heldByMe),
    )
    .map((row) => ({
      key: holderKey(row.queue, row.holderPrincipal),
      principal: row.holderPrincipal,
      name: row.principal,
      heldByMe: row.heldByMe,
      queue: row.queue,
      queueLabel: row.queueLabel,
      activeItems: row.activeItems,
      overdueItems: row.overdueItems,
    }));
  // Someone away who holds nothing here still has cover to edit or end.
  const awayOnly = new Map<string, CaseworkTeamPersonRow>();
  if (!selectedQueueId)
    for (const absence of absences ?? []) {
      if (
        held.some((row) =>
          isSamePerson(absence.person.principal, row.holderPrincipal),
        )
      )
        continue;
      awayOnly.set(absence.person.ref, {
        key: `absence:${absence.person.ref}`,
        principal: absence.person.principal,
        name: caseworkPerson(absence.person.principal),
        heldByMe: false,
        activeItems: 0,
        overdueItems: 0,
      });
    }
  const personRows = [...holderRows, ...awayOnly.values()];

  return (
    <div ref={menuLayer} className="flex flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {severalQueues && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button id={queueFilterId} variant="outline" size="sm" />}
            >
              {queueTriggerLabel}
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent container={menuLayer}>
              <DropdownMenuRadioGroup
                value={selectedQueueId}
                onValueChange={onSelectQueue}
              >
                <DropdownMenuRadioItem value="">
                  {allQueuesLabel}
                </DropdownMenuRadioItem>
                {queues.map((queue) => (
                  <DropdownMenuRadioItem key={queue.id} value={queue.id}>
                    {queue.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* Casework counted the page it answered across every queue, so the
            counts stand only while no single queue is chosen. */}
        {!selectedQueueId && (
          <p className="team-summary mb-0 text-sm text-muted-foreground">
            {c.teamSummary(
              {
                items: board.visibleTotal,
                unclaimed: board.unclaimed,
                held: board.claimed,
                overdue: board.overdue,
              },
              bounded,
            )}
          </p>
        )}
        {selectedQueueId && (
          <p className="team-summary result-count mb-0 text-sm text-muted-foreground">
            {c.teamVisibleItems(items.length)}
          </p>
        )}
        {absencesError != null && (
          <p className="mb-0 text-sm text-muted-foreground">
            {c.teamAbsencesFailed}{" "}
            <Button variant="ghost" size="sm" onClick={onRetryAbsences}>
              {c.retry}
            </Button>
          </p>
        )}
      </div>
      {filterChips}

      <section className="mb-8">
        <h2 className="mb-1 text-base font-semibold">{c.teamPeopleHeading}</h2>
        <p className="team-section-description">{c.teamPeopleDescription}</p>
        {personRows.length ? (
          <div
            role="region"
            aria-label={c.teamPeopleCaption}
            tabIndex={0}
            className="table-wrap team-people"
          >
            <Table>
              <TableCaption className="sr-only">
                {c.teamPeopleCaption}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{c.holderColumn}</TableHead>
                  {severalQueues && <TableHead>{c.queueColumn}</TableHead>}
                  <TableHead className="text-right">
                    {c.teamHeldColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {c.teamOverdueColumn}
                  </TableHead>
                  <TableHead className="w-10 px-2">
                    <span className="sr-only">{c.teamActionsColumn}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personRows.map((row) => (
                  <PersonRow
                    key={row.key}
                    row={row}
                    showQueue={severalQueues}
                    absence={absenceFor(absences, row.principal, now)}
                    people={people}
                    canRecord={canRecord}
                    now={now}
                    onOpenDialog={onOpenDialog}
                    menuContainer={menuLayer}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle role="heading" aria-level={2}>
                {selectedQueueLabel
                  ? fill(c.teamNoHoldersInQueueTitle, { queue: selectedQueueLabel })
                  : c.teamNoHolders}
              </EmptyTitle>
              <EmptyDescription>
                {selectedQueueLabel
                  ? fill(c.teamNoHoldersInQueueBody, { queue: selectedQueueLabel })
                  : c.teamNoHoldersBody}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      {(items.length > 0 || selectedQueueId) && (
        <section>
          <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <h2 className="mb-0 text-base font-semibold">
              {c.teamItemsHeading}
            </h2>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {c.teamSelected(selected.size)}
                </span>
                <Button
                  id="team-reassign"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onOpenDialog({
                      kind: "reassign",
                      items: items.filter((item) => selected.has(item.id)),
                      returnId: "team-reassign",
                    })
                  }
                >
                  {c.teamReassign}
                </Button>
              </div>
            )}
          </div>
          <CaseworkItemsTable
            items={items}
            caption={c.teamItemsCaption}
            heading={heading}
            itemHref={itemHref}
            selectable
            selected={selected}
            onSelectedChange={onSelectedChange}
            emptyTitle={fill(c.teamNoItemsInQueueTitle, {
              queue: selectedQueueLabel ?? selectedQueueId,
            })}
            emptyBody={c.teamNoItemsInQueueBody}
          />
        </section>
      )}

      {(shortfall || pager) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            {shortfall && (
              <p className="mb-0 text-sm text-muted-foreground">{shortfall}</p>
            )}
          </div>
          <div className="ms-auto flex gap-1">{pager}</div>
        </div>
      )}
    </div>
  );
}
