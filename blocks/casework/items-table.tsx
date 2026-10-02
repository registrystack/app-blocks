import type { ReactNode } from "react";
import {
  workItemStateKeys,
  type CaseworkWorkItem,
} from "@registrystack/app-runtime";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useCaseworkContent, type CaseworkContent } from "@/blocks/casework/casework-content";
import {
  Badge,
  CaseworkReference,
  CaseworkWhen,
  caseworkPerson,
  caseworkReference,
  caseworkSubjectTail,
  caseworkWaiting,
} from "@/blocks/casework/shared";

/**
 * The work-item table shared by the inbox and the team board: one row per
 * item, the reference its only link. Paging, filtering and the URL belong to
 * the page that renders this; the table only renders the page it is given.
 * What the item asks of the officer names a register-specific field the
 * blocks boundary keeps out of this file, so the caller renders it.
 */
export interface CaseworkItemsTableProps {
  items: readonly CaseworkWorkItem[];
  /** Names the scrollable region and the table for assistive technology. */
  caption: string;
  /** What the item asks of the officer, for the task column of one row. */
  heading: (item: CaseworkWorkItem) => ReactNode;
  /** Where the item's reference links to. The table assumes no router of its own. */
  itemHref: (id: string) => string;
  /**
   * Where a review task's page is. A row whose item carries a review task gets
   * a link there in its own cell; without it the table shows no such column.
   * Given, the column shows on every page, so it does not come and go as the
   * officer pages through.
   */
  reviewHref?: (taskId: string) => string;
  /** Adds a checkbox column, a colleague can select rows to act on together. */
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Shown instead of the table when there are no items. */
  emptyTitle?: string;
  emptyBody?: string;
  /** Extra content below the empty state's title and body, such as a link or a retry. */
  emptyContent?: ReactNode;
  /** Fixes "now" for a deterministic reading of due and waiting cells in tests. */
  now?: Date;
}

/**
 * Who holds the item: a short name, "you", or "Unclaimed" when nobody does.
 * A holder Casework could not name prints the readable end of their account,
 * with the whole account on hover.
 */
function holderCell(
  item: Pick<CaseworkWorkItem, "holder" | "holderPrincipal" | "heldByMe">,
  c: CaseworkContent,
): { text: string; muted: boolean; account?: string } {
  if (item.heldByMe) return { text: c.you, muted: false };
  const principal = item.holderPrincipal;
  const account = principal?.subject ?? item.holder;
  if (!account) return { text: c.unclaimed, muted: true };
  const text = principal
    ? caseworkPerson(principal)
    : caseworkSubjectTail(account);
  return { text, muted: false, ...(text === account ? {} : { account }) };
}

export function CaseworkItemsTable({
  items,
  caption,
  heading,
  itemHref,
  reviewHref,
  selectable = false,
  selected,
  onSelectedChange,
  emptyTitle,
  emptyBody,
  emptyContent,
  now,
}: CaseworkItemsTableProps) {
  const c = useCaseworkContent();
  if (items.length === 0 && emptyTitle) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle role="heading" aria-level={2}>
            {emptyTitle}
          </EmptyTitle>
          {emptyBody && <EmptyDescription>{emptyBody}</EmptyDescription>}
        </EmptyHeader>
        {emptyContent && <EmptyContent>{emptyContent}</EmptyContent>}
      </Empty>
    );
  }
  const reviewLinks = reviewHref !== undefined;
  const allSelected =
    selectable && items.length > 0 && (selected?.size ?? 0) === items.length;
  const someSelected = selectable && !allSelected && (selected?.size ?? 0) > 0;
  function toggleAll(checked: boolean) {
    onSelectedChange?.(
      checked ? new Set(items.map((item) => item.id)) : new Set(),
    );
  }
  function toggleOne(id: string, checked: boolean) {
    const next = new Set(selected ?? []);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedChange?.(next);
  }
  return (
    <div
      className="table-wrap casework-items"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead>
                <Checkbox
                  aria-label={c.selectAll}
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) => toggleAll(checked)}
                />
              </TableHead>
            )}
            <TableHead>{c.refColumn}</TableHead>
            <TableHead>{c.taskColumn}</TableHead>
            <TableHead>{c.due}</TableHead>
            <TableHead>{c.waitingColumn}</TableHead>
            <TableHead>{c.holderColumn}</TableHead>
            <TableHead>{c.stageFilterLabel}</TableHead>
            {reviewLinks && <TableHead>{c.actionsColumn}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const holder = holderCell(item, c);
            return (
              <TableRow
                key={item.id}
                data-state={selected?.has(item.id) ? "selected" : undefined}
              >
                {selectable && (
                  <TableCell>
                    <Checkbox
                      aria-label={c.selectItem(caseworkReference(item, c))}
                      checked={selected?.has(item.id) ?? false}
                      onCheckedChange={(checked) => toggleOne(item.id, checked)}
                    />
                  </TableCell>
                )}
                <TableHead
                  scope="row"
                  className="text-sm font-medium text-foreground"
                >
                  <a
                    className="row-link"
                    data-row-ref={item.id}
                    href={itemHref(item.id)}
                  >
                    <CaseworkReference item={item} />
                  </a>
                </TableHead>
                <TableCell>
                  {heading(item)}
                  {item.returned && (
                    <span
                      className="casework-returned"
                      title={c.caseworkReturned}
                    >
                      {c.returned}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <CaseworkWhen value={item.dueAt} tense="due" now={now} />
                </TableCell>
                <TableCell>
                  {caseworkWaiting(item.firstObservedAt, c, now)}
                </TableCell>
                <TableCell
                  className={holder.muted ? "muted" : undefined}
                  title={holder.account}
                >
                  {holder.text}
                </TableCell>
                <TableCell>
                  <Badge
                    state={item.state}
                    labelKeys={workItemStateKeys(item)}
                  />
                </TableCell>
                {reviewLinks && (
                  <TableCell>
                    {item.reviewTask && (
                      <a
                        className="row-link"
                        aria-label={c.openReviewFor(
                          caseworkReference(item, c),
                        )}
                        href={reviewHref(item.reviewTask.taskId)}
                      >
                        {c.openReview}
                      </a>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
