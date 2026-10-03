import { Fragment, useId, useState, type ReactNode } from "react";
import type {
  EntityModel,
  FieldModel,
  JsonValue,
  RecordView,
  RequestView,
} from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { FieldValue } from "@/blocks/fields/field-value";

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

/**
 * The record entity a request changes: the one its read names as its target
 * when it names one the session reads, else the first the request entity
 * targets, else the register's own record entity. A register with several record entities has a
 * request entity for each.
 */
export function recordOfRequest(
  entities: { record: EntityModel; records?: readonly EntityModel[] },
  request: EntityModel,
  targetEntity?: string,
): EntityModel {
  const records = entities.records ?? [entities.record];
  return (
    records.find((record) => record.id === targetEntity) ??
    records.find((record) =>
      request.request?.targets.some((target) => target.entity === record.id),
    ) ??
    entities.record
  );
}

/** One field a request writes, with the target field it lands in. */
export interface WrittenField {
  field: FieldModel;
  target: FieldModel;
}

/**
 * The fields a request writes on its target record, in the order the request
 * model names them. A write whose field either model lacks is left out. The
 * writes are the named request entity's own, so a register with several
 * request entities pairs each with its own.
 */
export function writtenFields(
  entities: { record: EntityModel; request: EntityModel },
  requestFields: readonly FieldModel[],
): WrittenField[] {
  return (entities.request.request?.writes ?? []).flatMap((write) => {
    const field = requestFields.find((item) => item.id === write.requestField);
    const target = entities.record.fields.find((item) => item.id === write.targetField);
    return write.targetEntity === entities.record.id && field && target
      ? [{ field, target }]
      : [];
  });
}

/**
 * What a target field holds now: the live target record when it was read,
 * else the value the request retained, unless the host marked the target
 * unavailable. Undefined where neither is known.
 */
export function currentValue(
  targetField: FieldModel,
  target: RecordView | undefined,
  request: RequestView | undefined,
): JsonValue | undefined {
  if (target) return target.values[targetField.id];
  return request?.target?.available === false
    ? undefined
    : request?.previous?.[targetField.id];
}

/** Exact, order-sensitive equality: a reordered list is a change. */
function sameValue(current: unknown, proposed: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(proposed);
}

/**
 * The comparison rows for one request, one for each field it writes. Current
 * values come from the live target record, so before-values survive the
 * decision that removes the pending lifecycle action; the values the request
 * retained stand in only while the target is not marked unavailable. A row
 * is labelled by its target field unless `labelOf` words it otherwise.
 */
export function writtenChangeRows(
  written: readonly WrittenField[],
  view: RecordView,
  target: RecordView | undefined,
  currentUnavailable: string,
  labelOf?: (item: WrittenField) => string,
): ChangeRow[] {
  return written.map((item) => {
    const { field, target: targetField } = item;
    const current = currentValue(targetField, target, view.request);
    const proposed = view.values[field.id];
    return {
      key: targetField.id,
      label: labelOf ? labelOf(item) : targetField.label,
      current:
        current === undefined ? (
          <p className="muted">{currentUnavailable}</p>
        ) : (
          <FieldValue field={targetField} value={current} />
        ),
      proposed: <FieldValue field={targetField} value={proposed} />,
      comparison:
        current === undefined
          ? "unknown"
          : sameValue(current, proposed)
            ? "unchanged"
            : "changed",
    };
  });
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
