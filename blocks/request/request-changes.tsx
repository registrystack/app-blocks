import { Fragment, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";

export interface ChangeRow {
  key: string;
  label: string;
  current: ReactNode;
  proposed: ReactNode;
  comparison: "changed" | "unchanged" | "unknown";
}

/**
 * The three-column before-and-after comparison. Changed rows carry the word
 * "Changed" in their accessible content, never colour alone; unchanged rows
 * are muted and can be hidden. The caller decides what a row is and what
 * counts as changed. Children are the caller's own controls for this
 * comparison and share the one action row below the table with the
 * unchanged-rows toggle.
 */
export function ChangeTable({
  rows,
  children,
}: {
  rows: ChangeRow[];
  children?: ReactNode;
}) {
  const c = useBlockContent();
  const tableId = useId();
  const [showUnchangedRows, setShowUnchangedRows] = useState(true);
  const unchangedCount = rows.filter(
    (row) => row.comparison === "unchanged",
  ).length;
  return (
    <div className="change-comparison">
      <table className="change-table" role="table">
        <caption className="sr-only">{c.proposedHeading}</caption>
        <thead>
          <tr>
            <th scope="col">{c.fieldColumn}</th>
            <th scope="col" id={`${tableId}-current`}>
              {c.currentColumn}
            </th>
            <th scope="col" id={`${tableId}-proposed`}>
              {c.proposedColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter(
              (row) => row.comparison !== "unchanged" || showUnchangedRows,
            )
            .map((row) => (
              <tr
                key={row.key}
                className={
                  row.comparison === "changed"
                    ? "changed-cell"
                    : row.comparison === "unchanged"
                      ? "muted-row"
                      : undefined
                }
              >
                <td role="rowheader">
                  {row.label}
                  {row.comparison === "changed" && (
                    <span className="changed-marker">{c.changedMarker}</span>
                  )}
                </td>
                <td data-label={c.currentColumn} headers={`${tableId}-current`}>
                  {row.current}
                </td>
                <td
                  data-label={c.proposedColumn}
                  headers={`${tableId}-proposed`}
                >
                  {row.proposed}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {(unchangedCount > 0 || children) && (
        <div className="actions">
          {unchangedCount > 0 && (
            <Button
              variant="outline"
              aria-pressed={showUnchangedRows}
              onClick={() => setShowUnchangedRows(!showUnchangedRows)}
            >
              {showUnchangedRows
                ? c.hideUnchanged
                : fill(c.showUnchanged, { count: unchangedCount })}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export interface ProposedChangeItem {
  key: string;
  label: string;
  before: ReactNode;
  after: ReactNode;
  /** Omitted where the answer can no longer be changed. */
  onChangeAnswer?: () => void;
}

/**
 * The two-column before-and-after a person checks before sending a proposal:
 * every answer that will change a record, read against what it changes from.
 * `beforeLabel`/`afterLabel` are the caller's own, since "before" and "after"
 * may need to name what kind of record this changes.
 */
export function ProposedChangesReview({
  items,
  beforeLabel,
  afterLabel,
}: {
  items: ProposedChangeItem[];
  beforeLabel: string;
  afterLabel: string;
}) {
  const c = useBlockContent();
  return (
    <div className="comparison">
      <section>
        <h2 className="eyebrow">{beforeLabel}</h2>
        {items.map((item) => (
          <Fragment key={item.key}>
            <h3>{item.label}</h3>
            {item.before}
          </Fragment>
        ))}
      </section>
      <section>
        <h2 className="eyebrow">{afterLabel}</h2>
        {items.map((item) => (
          <Fragment key={item.key}>
            <h3>{item.label}</h3>
            {item.after}
            {item.onChangeAnswer && (
              <Button
                variant="ghost"
                className="change-answer"
                onClick={item.onChangeAnswer}
              >
                {fill(c.changeAnswer, { field: item.label.toLowerCase() })}
              </Button>
            )}
          </Fragment>
        ))}
      </section>
    </div>
  );
}
