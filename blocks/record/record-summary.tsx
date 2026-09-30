import type { ReactNode } from "react";
import type { EntityModel, RecordView } from "@registrystack/app-runtime";
import { FieldValue } from "@/blocks/fields/field-value";

function Definition({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="definition">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The named fields of a record, labelled from the model, in the order given. */
export function RecordFacts({
  entity,
  record,
  fields,
  compact = false,
}: {
  entity: EntityModel;
  record: RecordView;
  fields: readonly string[];
  compact?: boolean;
}) {
  return (
    <dl className={`facts ${compact ? "facts-compact" : ""}`}>
      {fields.map((id) => {
        const field = entity.fields.find((item) => item.id === id);
        return (
          field && (
            <Definition key={id} label={field.label}>
              <FieldValue field={field} value={record.values[id]} />
            </Definition>
          )
        );
      })}
    </dl>
  );
}
