import { useState } from "react";
import { Plus } from "lucide-react";
import type { EntityModel, RecordView } from "@registrystack/app-runtime";
import { useAuthority, useRecords } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/blocks/shell/page-heading";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { EmptyState } from "@/blocks/shell/empty-state";
import { RecordCards, RecordPager } from "@/blocks/record/record-list";
import { RecordSearchForm } from "@/blocks/record/record-filters";
import { RecordTable } from "@/blocks/record/record-table";
import { listTitle, usePagesContent } from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { fieldOf, recordTitle, useRegister } from "@/blocks/pages/record";

/**
 * The records of the register's record entity: cards for a holder, a table
 * for staff. Columns, filter and create come from the session model and the
 * list the host serves; nothing here names an entity or a field.
 */
export function RecordListPage() {
  const register = useRegister();
  if (register.isPending) return <Loading />;
  if (register.error || !register.entities)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  return <RecordList entity={register.entities.record} />;
}

function RecordList({ entity }: { entity: EntityModel }) {
  const pages = usePagesContent(),
    routes = useRegisterRoutes(),
    session = useAuthority();
  const holder = session.role === "holder";
  const [filter, setFilter] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const filterField = entity.list.filters[0]?.field;
  const query = useRecords(
    entity.id,
    cursor
      ? { cursor }
      : filter && filterField
        ? { filters: { [filterField]: filter } }
        : {},
  );
  const create = query.data?.actions?.find(
    (action) => action.name === "create" && action.entity === entity.id,
  );
  const columns = entity.list.columns
    .map((id) => fieldOf(entity, id))
    .filter((field) => field !== undefined);
  const linkColumn =
    columns.find((field) => field.id === entity.title) ?? columns[0];
  const recordHref = (record: RecordView) => `#${routes.record(record.id)}`;
  const title = listTitle(
    pages,
    holder ? "ownRecordListTitle" : "recordListTitle",
    entity.pluralLabel,
  );
  return (
    <>
      <PageHeading
        title={title}
        description={holder ? pages.ownListDescription : pages.listDescription}
        action={
          create && (
            <Button render={<a href={`#${routes.createRecord}`} />}>
              <Plus />
              {pages.createRecord}
            </Button>
          )
        }
      />
      {filterField && (
        <RecordSearchForm
          label={pages.searchLabel}
          hint={pages.searchHint}
          applied={filter}
          onSearch={(value) => {
            setFilter(value);
            setCursors([undefined]);
          }}
          onClear={() => {
            setFilter("");
            setCursors([undefined]);
          }}
        />
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            {query.data.items.length === 0 ? (
              <EmptyState title={holder ? pages.noOwnRecords : pages.noRecords}>
                {filter
                  ? pages.noSearchResults
                  : holder
                    ? pages.noOwnRecordsBody
                    : pages.noStaffRecordsBody}
              </EmptyState>
            ) : holder ? (
              <RecordCards
                entity={entity}
                records={query.data.items}
                fields={columns
                  .filter((field) => field.id !== entity.title)
                  .map((field) => field.id)}
                titleOf={(record) =>
                  recordTitle(entity, record) ?? entity.label
                }
                recordHref={recordHref}
              />
            ) : (
              <RecordTable
                caption={title}
                columns={columns}
                linkColumn={linkColumn}
                records={query.data.items}
                recordHref={recordHref}
                viewLabel={(record) => recordTitle(entity, record) ?? record.id}
              />
            )}
            <RecordPager
              nextCursor={query.data.nextCursor}
              pageCount={cursors.length}
              onPrevious={() => setCursors(cursors.slice(0, -1))}
              onNext={(next) => setCursors([...cursors, next])}
            />
          </>
        )
      )}
    </>
  );
}
