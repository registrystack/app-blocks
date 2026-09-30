import { ChevronLeft, ChevronRight } from "lucide-react";
import { type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Loading } from "@/blocks/shell/loading";
import { useBlockContent } from "@/blocks/lib/content";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { fill } from "@/blocks/lib/format";

/**
 * The spec-conforming building blocks of a BReg-direct queue, held apart from
 * the request queue that composes them so a second queue can use the same
 * filter bar, chips, range sentence, table and pager. Columns, rows and
 * filters are passed in; each part keeps its own content lookups for the
 * wording that belongs to the pattern rather than to a list.
 */

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_SIZE = 25;
/** More rendered rows than this and the table drops to dense padding. */
const DENSE_ROW_LIMIT = 25;

/**
 * The paged part of any list view, all of it carried in the hash query
 * string; each list adds its own filter on top.
 */
export interface PagedView {
  size: number;
  cursor?: string;
  page: number;
}

/** Every part of a queue view: the stage filter plus the paging. */
export interface QueueView extends PagedView {
  state: string;
}

/** One remembered step towards the current page, for Previous only. */
export interface CursorEntry {
  cursor: string | undefined;
  page: number;
}

/** The hash query is the only source of truth for a list's paging. */
export function parsePaging(query: URLSearchParams): PagedView {
  const size = Number(query.get("size"));
  const requested = Number(query.get("page"));
  const cursor = query.get("cursor") ?? "";
  return {
    size: (PAGE_SIZES as readonly number[]).includes(size)
      ? size
      : DEFAULT_SIZE,
    // A page position without a cursor is meaningless, because pagination is
    // cursor-only: pin page 1 so the range sentence never counts imaginary
    // rows on a first-page slice.
    page:
      cursor && Number.isInteger(requested) && requested >= 1 ? requested : 1,
    cursor: cursor || undefined,
  };
}

/** Adds a list's paging to its query string; defaults are left out. */
export function writePaging(params: URLSearchParams, next: PagedView) {
  if (next.size !== DEFAULT_SIZE) params.set("size", String(next.size));
  if (next.cursor) params.set("cursor", next.cursor);
  if (next.page > 1) params.set("page", String(next.page));
}

/** The hash query is the only source of truth for a queue view. */
export function parseView(query: URLSearchParams): QueueView {
  return { state: query.get("state") ?? "", ...parsePaging(query) };
}

/** The route a view is, given the queue's own path. */
export function writeView(path: string, next: QueueView): string {
  const params = new URLSearchParams();
  if (next.state) params.set("state", next.state);
  writePaging(params, next);
  const search = params.toString();
  return `${path}${search ? `?${search}` : ""}`;
}

/**
 * A filter control is built from the advertised descriptor, never from a
 * hard-coded list, and a filter the host does not advertise for this profile
 * never renders at all — so the caller decides whether to render this at all,
 * and supplies the options.
 */
export function QueueFilterBar({
  id,
  name,
  label,
  value,
  anyLabel,
  options,
  onApply,
}: {
  id: string;
  name: string;
  label: string;
  /** The applied value, as read from the URL. */
  value: string;
  /** The "no filter" option, first in the list. */
  anyLabel: string;
  options: readonly { value: string; label: string }[];
  onApply: (value: string) => void;
}) {
  const c = useCaseworkContent();
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem(name);
    onApply(field instanceof HTMLSelectElement ? field.value : "");
  }
  return (
    <form className="filter-bar" onSubmit={apply}>
      <div>
        <label htmlFor={id}>{label}</label>
        {/* Uncontrolled on purpose: the applied filter lives in the URL,
            and the key re-mounts the control whenever the URL changes
            without this form, so it always shows the applied stage. */}
        <select id={id} name={name} key={value} defaultValue={value}>
          <option value="">{anyLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        {c.filterApply}
      </Button>
    </form>
  );
}

/** One applied filter, named as the officer reads it. */
export interface ActiveFilter {
  name: string;
  label: string;
}

/** What is currently narrowing the list, each removable on its own. */
export function QueueFilterChips({
  filters,
  onRemove,
  clearHref,
  onClear,
}: {
  filters: ActiveFilter[];
  onRemove: (filter: ActiveFilter) => void;
  /** The route of the same view with nothing applied. */
  clearHref: string;
  /** Handles an ordinary same-page clear; modified clicks follow the link. */
  onClear?: () => void;
}) {
  const c = useCaseworkContent();
  if (filters.length === 0) return null;
  return (
    <ul className="filter-chips">
      {filters.map((filter) => (
        <li className="filter-chip" key={filter.name}>
          <span>{filter.label}</span>
          <button
            type="button"
            aria-label={fill(c.removeFilter, { label: filter.label })}
            onClick={() => onRemove(filter)}
          >
            ×
          </button>
        </li>
      ))}
      <li>
        {/* A link, not a button: the unfiltered view is a URL, and it
            clears the cursor with the chips. */}
        <a
          className="clear-filters-link"
          href={`#${clearHref}`}
          onClick={(event) => {
            if (
              !event.defaultPrevented &&
              event.button === 0 &&
              !event.altKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey
            ) {
              if (!onClear) return;
              event.preventDefault();
              onClear();
            }
          }}
        >
          {c.clearAllFilters}
        </a>
      </li>
    </ul>
  );
}

/**
 * "Showing 26 to 50". No total is available for a cursor list, so the sentence
 * never invents one, and it is absent rather than zeroed on an empty page.
 */
export function QueueResultCount({
  start,
  count,
}: {
  start: number;
  count: number;
}) {
  const c = useCaseworkContent();
  if (count === 0) return null;
  return (
    <p className="result-count">
      {fill(c.showingRange, { start, end: start + count - 1 })}
    </p>
  );
}

/** One column of a queue table. Exactly one column is the row header. */
export interface QueueColumn<Row> {
  key: string;
  header: string;
  /** The cell that names the row, rendered as `th scope="row"`. */
  rowHeader?: boolean;
  cell: (row: Row) => ReactNode;
}

/**
 * The list itself. Loading replaces the table body only: the filters and chips
 * above stay mounted, and the column headers keep their places.
 */
export function QueueTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
}: {
  /** Names the scrollable region and captions the table. */
  caption: string;
  columns: readonly QueueColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  loading?: boolean;
}) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table
        className={rows.length > DENSE_ROW_LIMIT ? "table-dense" : undefined}
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <Loading />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th key={column.key} scope="row">
                      {column.cell(row)}
                    </th>
                  ) : (
                    <td key={column.key}>{column.cell(row)}</td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Previous and Next are links, so a page is a URL; a step that does not exist
 * is a disabled button rather than a missing control. The page size restarts
 * the list, which is the caller's business.
 */
export function QueuePager({
  previousHref,
  onPrevious,
  nextHref,
  onNext,
  sizeId,
  size,
  onSize,
}: {
  /** Absent disables Previous. */
  previousHref?: string;
  onPrevious?: () => void;
  /** Absent disables Next. */
  nextHref?: string;
  onNext?: () => void;
  sizeId: string;
  size: number;
  onSize: (size: number) => void;
}) {
  const b = useBlockContent();
  const c = useCaseworkContent();
  // The size select's options name themselves ("25 per page"), so its label
  // is for assistive technology only; Previous and Next are chevrons whose
  // names are the same words in text a screen reader reads.
  const previous = (
    <>
      <ChevronLeft aria-hidden="true" />
      <span className="sr-only">{b.previous}</span>
    </>
  );
  const next = (
    <>
      <ChevronRight aria-hidden="true" />
      <span className="sr-only">{b.next}</span>
    </>
  );
  return (
    <div className="pager flex-row items-center">
      <div>
        <label htmlFor={sizeId} className="sr-only">
          {fill(c.perPage, { size })}
        </label>
        <select
          id={sizeId}
          className="h-(--control-h-sm) min-h-0 w-auto min-w-0 rounded-md border border-input bg-background px-2 py-0 text-sm text-foreground"
          value={String(size)}
          onChange={(event) => onSize(Number(event.target.value))}
        >
          {PAGE_SIZES.map((option) => (
            <option key={option} value={String(option)}>
              {fill(c.perPage, { size: option })}
            </option>
          ))}
        </select>
      </div>
      <div className="actions w-auto gap-1">
        {previousHref ? (
          <Button
            render={<a href={`#${previousHref}`} onClick={onPrevious} />}
            variant="outline"
            size="icon-sm"
          >
            {previous}
          </Button>
        ) : (
          <Button variant="outline" size="icon-sm" disabled>
            {previous}
          </Button>
        )}
        {nextHref ? (
          <Button
            render={<a href={`#${nextHref}`} onClick={onNext} />}
            variant="outline"
            size="icon-sm"
          >
            {next}
          </Button>
        ) : (
          <Button variant="outline" size="icon-sm" disabled>
            {next}
          </Button>
        )}
      </div>
    </div>
  );
}
