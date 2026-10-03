import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { EntityModel, RecordView } from "@registrystack/app-runtime";
import { useAuthority, useRecords } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/blocks/shell/page-heading";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { EmptyState } from "@/blocks/shell/empty-state";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/shell/live-announcer";
import { RecordCards, RecordPager } from "@/blocks/record/record-list";
import { RecordFilterBar, RecordSearchForm } from "@/blocks/record/record-filters";
import { RecordTable } from "@/blocks/record/record-table";
import {
  createWords,
  listTitle,
  usePagesContent,
} from "@/blocks/pages/pages-content";
import {
  listQueryOf,
  listRoute,
  type ListQuery,
} from "@/blocks/pages/record-route-query";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import {
  entityRoutes,
  fieldOf,
  recordTitle,
  RecordEntityGate,
  UnavailableWrite,
  type RegisterEntities,
} from "@/blocks/pages/record";

/**
 * The records of one record entity, the register's own when `entity` is left
 * out: cards for a holder, a table for staff. Columns, filters, search,
 * create and the governed actions whose result lands in these records come
 * from the session model and the list the host serves; nothing here names an
 * entity, a field or an action. Filters and the search live in the route's
 * query, so a link to a narrowed list is a plain link.
 */
export function RecordListPage({ entity }: { entity?: string }) {
  const route = useRoute();
  return (
    <RecordEntityGate entity={entity}>
      {(entities, model) => (
        // A new query starts the list from its first page.
        <RecordList key={route} entities={entities} entity={model} />
      )}
    </RecordEntityGate>
  );
}

function RecordList({
  entities,
  entity,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
}) {
  const pages = usePagesContent(),
    routes = entityRoutes(useRegisterRoutes(), entities, entity.id),
    session = useAuthority();
  const holder = session.role === "holder";
  const ownEntity = entity.id === entities.record.id;
  const applied = listQueryOf(splitRoute(useRoute()).query);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const searchFields = entity.list.search;
  // Without a multi-field search, one text box matches the first filter
  // field that is not already a select.
  const filterField = entity.list.filters.find(
    (filter) => !fieldOf(entity, filter.field)?.options?.length,
  )?.field;
  const searchable = Boolean(searchFields?.length || filterField);
  const filters = { ...applied.filters };
  if (!searchFields?.length && filterField && applied.search)
    filters[filterField] = applied.search;
  const query = useRecords(
    entity.id,
    cursor
      ? { cursor }
      : {
          ...(Object.keys(filters).length ? { filters } : {}),
          ...(searchFields?.length && applied.search
            ? { search: applied.search }
            : {}),
        },
  );
  const [announcement, announce] = useAnnouncement();
  // A cursor the host no longer holds (a restarted session lost the cursor
  // store) is recovered from, not reported: go back to the first page of the
  // same list, keeping the filters and search.
  const recovering = cursor !== undefined && query.cursorExpired;
  useEffect(() => {
    if (!recovering) return;
    setCursors([undefined]);
    announce(pages.listRecoveredAnnouncement);
  }, [recovering]);
  const narrowed = Object.keys(filters).length > 0 || Boolean(applied.search);
  const show = (next: Partial<ListQuery>) => {
    if (routes) navigate(listRoute(routes.records, next));
  };
  const create = query.data?.actions?.find(
    (action) => action.name === "create" && action.entity === entity.id,
  );
  // A governed action is offered only where the app names a form for it.
  const governed = (query.data?.actions ?? []).flatMap((action) =>
    action.name === "invoke" &&
    action.entity === entity.id &&
    action.actionId &&
    routes?.recordAction
      ? [
          {
            id: action.actionId,
            label: action.label ?? action.actionId,
            href: `#${routes.recordAction(action.actionId)}`,
          },
        ]
      : [],
  );
  const columns = entity.list.columns
    .map((id) => fieldOf(entity, id))
    .filter((field) => field !== undefined);
  const linkColumn =
    columns.find((field) => field.id === entity.title) ?? columns[0];
  const title = listTitle(
    pages,
    holder ? "ownRecordListTitle" : "recordListTitle",
    entity.pluralLabel,
  );
  if (!routes) return <UnavailableWrite />;
  const recordHref = (record: RecordView) => `#${routes.record(record.id)}`;
  return (
    <>
      <LiveAnnouncer message={announcement} />
      <PageHeading
        title={title}
        description={holder ? pages.ownListDescription : pages.listDescription}
        action={
          (create || governed.length > 0) && (
            <div className="actions">
              {create && (
                <Button render={<a href={`#${routes.createRecord}`} />}>
                  <Plus />
                  {createWords(
                    pages,
                    ownEntity ? "createRecord" : "addRecord",
                    create.label,
                    entity.label,
                  )}
                </Button>
              )}
              {governed.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  render={<a href={action.href} />}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )
        }
      />
      <RecordFilterBar
        entity={entity}
        allLabel={pages.filterAll}
        applied={applied.filters}
        onChange={(field, value) => {
          const next = { ...applied.filters };
          if (value === undefined) delete next[field];
          else next[field] = value;
          show({ filters: next, search: applied.search });
        }}
      />
      {searchable && (
        <RecordSearchForm
          label={pages.searchLabel}
          hint={searchFields?.length ? pages.searchWordsHint : pages.searchHint}
          applied={applied.search}
          onSearch={(value) =>
            show({ filters: applied.filters, search: value })
          }
          onClear={() => show({ filters: applied.filters })}
        />
      )}
      {query.isPending || recovering ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            {query.data.items.length === 0 ? (
              <EmptyState title={holder ? pages.noOwnRecords : pages.noRecords}>
                {narrowed
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
