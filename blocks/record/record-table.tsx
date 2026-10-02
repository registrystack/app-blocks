import { ArrowUpRight } from "lucide-react";
import type { FieldModel, RecordView } from "@registrystack/app-runtime";
import { FieldValue } from "@/blocks/fields/field-value";
import { ReferenceHrefProvider } from "@/blocks/fields/reference-value";
import { useBlockContent } from "@/blocks/lib/content";

/**
 * A record list as a table: one row per record, one column per field the
 * model names, a link on the title column and an icon link to the record on
 * every row. The columns are the fields of whichever entity the records
 * belong to, so a table can list related records. `recordHref` and `viewLabel` come from the app, since the route
 * a record opens on and the words a record is named by are its business.
 */
export function RecordTable({
  caption,
  columns,
  linkColumn,
  records,
  recordHref,
  viewLabel,
}: {
  /** Names the table for assistive technology; visually hidden. */
  caption: string;
  columns: readonly FieldModel[];
  /** The column whose cell links to the record; no column links without it. */
  linkColumn?: FieldModel;
  records: readonly RecordView[];
  recordHref: (record: RecordView) => string;
  /** The name read for a row's link, beside the generic "View record". */
  viewLabel: (record: RecordView) => string;
}) {
  const c = useBlockContent();
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((field) => (
              <th key={field.id}>{field.label}</th>
            ))}
            <th>
              <span className="sr-only">{c.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const href = recordHref(record);
            return (
              <tr key={record.id}>
                {columns.map((field) => (
                  <td key={field.id}>
                    {field === linkColumn ? (
                      <a className="record-link" href={href}>
                        {/* The cell is already a link; a reference inside it must not nest another. */}
                        <ReferenceHrefProvider href={() => null}>
                          <FieldValue
                            field={field}
                            value={record.values[field.id]}
                          />
                        </ReferenceHrefProvider>
                      </a>
                    ) : (
                      <FieldValue
                        field={field}
                        value={record.values[field.id]}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <a
                    aria-label={`${c.viewRecord}: ${viewLabel(record)}`}
                    className="icon-link"
                    href={href}
                  >
                    <ArrowUpRight size={18} />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
