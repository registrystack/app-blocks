import type { EntityModel, RecordView } from "@registrystack/app-runtime";
import { RecordFacts } from "@/blocks/record/record-summary";

/** One record's fields, grouped into the sections the session model gives it. */
export function RecordSections({
  entity,
  record,
}: {
  entity: EntityModel;
  record: RecordView;
}) {
  return (
    <>
      {entity.sections.map((section) => (
        <section className="card" key={section.id}>
          <h2>{section.label}</h2>
          <RecordFacts entity={entity} record={record} fields={section.fields} />
        </section>
      ))}
    </>
  );
}
