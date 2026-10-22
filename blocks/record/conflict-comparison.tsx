import { useEffect, useRef } from "react";
import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { FieldValue } from "@/blocks/fields/field-value";

export interface ConflictRow {
  field: FieldModel;
  /** What the person started from when they opened the form. */
  started: JsonValue | undefined;
  /** What the person entered. */
  mine: JsonValue | undefined;
  /** What the registry returned when the write was refused. */
  latest: JsonValue | undefined;
}

const same = (left: JsonValue | undefined, right: JsonValue | undefined) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * The fields either side moved away from where the person started, with the
 * three values side by side. A value the registry did not return stays
 * absent, and no value is combined with another.
 */
export function conflictRows(
  fields: readonly FieldModel[],
  started: Readonly<Record<string, JsonValue>>,
  mine: Readonly<Record<string, JsonValue>>,
  latest: Readonly<Record<string, JsonValue>>,
): ConflictRow[] {
  return fields
    .map((field) => ({
      field,
      started: started[field.id],
      mine: mine[field.id],
      latest: latest[field.id],
    }))
    .filter(
      (row) => !same(row.started, row.mine) || !same(row.started, row.latest),
    );
}

function Value({
  field,
  value,
}: {
  field: FieldModel;
  value: JsonValue | undefined;
}) {
  const c = useBlockContent();
  return value === undefined ? (
    <span className="muted">{c.notSupplied}</span>
  ) : (
    <FieldValue field={field} value={value} />
  );
}

/**
 * The comparison shown when a save is refused because the record changed
 * since it was read. It reports only what the server returned and leaves the
 * choice to the person: keep the whole entry, or take the whole latest.
 */
export function ConflictComparison({
  rows,
  onKeepMine,
  onTakeLatest,
}: {
  rows: readonly ConflictRow[];
  onKeepMine: () => void;
  onTakeLatest: () => void;
}) {
  const c = useBlockContent();
  const section = useRef<HTMLElement>(null);
  // The comparison arrives below the form the person was filling in.
  useEffect(() => {
    section.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  return (
    <section
      ref={section}
      role="alert"
      className="conflict"
      aria-labelledby="conflict-title"
    >
      <h2 id="conflict-title">{c.conflictTitle}</h2>
      <p>{c.conflictBody}</p>
      <div className="table-wrap">
        <table className="conflict-table">
          <caption className="sr-only">{c.conflictTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{c.conflictFieldColumn}</th>
              <th scope="col">{c.conflictStartedColumn}</th>
              <th scope="col">{c.conflictMineColumn}</th>
              <th scope="col">{c.conflictLatestColumn}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const both =
                !same(row.started, row.mine) &&
                !same(row.started, row.latest) &&
                !same(row.mine, row.latest);
              return (
                <tr key={row.field.id} data-conflict={both || undefined}>
                  <th scope="row">
                    {row.field.label}
                    {both && (
                      <span className="muted conflict-both">
                        {c.conflictBothChanged}
                      </span>
                    )}
                  </th>
                  <td>
                    <Value field={row.field} value={row.started} />
                  </td>
                  <td>
                    <Value field={row.field} value={row.mine} />
                  </td>
                  <td>
                    <Value field={row.field} value={row.latest} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <Button onClick={onKeepMine}>{c.conflictKeepMine}</Button>
        <Button variant="outline" onClick={onTakeLatest}>
          {c.conflictTakeLatest}
        </Button>
      </div>
    </section>
  );
}
