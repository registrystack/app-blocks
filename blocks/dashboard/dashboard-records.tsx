import { unavailableError } from "@registrystack/app-runtime";
import type { EntityModel, RecordView } from "@registrystack/app-runtime";
import { useDashboardCohort } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import {
  useDashboardContent,
  type DashboardContent,
} from "@/blocks/dashboard/dashboard-content";
import {
  dashboardTargetOf,
  dashboardRoute,
} from "@/blocks/dashboard/dashboard-target";
import { Notice } from "@/blocks/lib/notice";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { RecordTable } from "@/blocks/record/record-table";
import { BackLink } from "@/blocks/shell/back-link";
import { EmptyState } from "@/blocks/shell/empty-state";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { splitRoute, useRoute } from "@/blocks/shell/routing";
import { useShellContent } from "@/blocks/shell/shell-content";
import {
  fieldOf,
  recordPath,
  RecordEntityGate,
  recordTitle,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";

/** The count line: the plural form and the number written in `locale`. */
function countWords(
  c: DashboardContent,
  count: number,
  locale: string,
): string {
  return fill(c.recordsCount, { count }, locale);
}

/**
 * The current records behind one live count. The target comes from the route;
 * the host rebuilds the filter and refuses a target that no longer matches
 * its widget (the page then shows that refusal with a retry), so nothing
 * here builds or checks a filter.
 */
export function DashboardRecordsPage() {
  const c = useDashboardContent(),
    target = dashboardTargetOf(splitRoute(useRoute()).query);
  if (!target)
    return (
      <>
        <BackLink href={dashboardRoute}>{c.recordsBack}</BackLink>
        <Notice tone="warning" title={c.recordsInvalidTitle}>
          <p>{c.recordsInvalid}</p>
        </Notice>
      </>
    );
  return <Cohort target={target} />;
}

type Target = NonNullable<ReturnType<typeof dashboardTargetOf>>;

function Cohort({ target }: { target: Target }) {
  const c = useDashboardContent(),
    locale = useLocale(),
    query = useDashboardCohort(target),
    entityId = query.data?.pages[0]?.entity;
  const back = <BackLink href={dashboardRoute}>{c.recordsBack}</BackLink>;
  if (query.isPending)
    return (
      <>
        {back}
        <Loading />
      </>
    );
  if (query.error || !query.cohort || !entityId)
    return (
      <>
        {back}
        <ErrorPanel
          error={query.error ?? unavailableError(c.unavailable)}
          retry={() => void query.refetch()}
        />
      </>
    );
  const cohort = query.cohort,
    cell = cohort.cellLabel ?? cohort.title;
  return (
    <>
      {back}
      <PageHeading
        eyebrow={c.recordsEyebrow}
        title={
          cell === cohort.title
            ? cohort.title
            : fill(c.recordsTitle, { title: cohort.title, cell }, locale)
        }
        description={c.recordsDescription}
      />
      <p role="status">
        {countWords(c, cohort.observedCount, locale)}
      </p>
      <p className="dashboard-note">{c.recordsLiveHelp}</p>
      <RecordEntityGate entity={entityId}>
        {(entities, entity) => (
          <CohortList
            entities={entities}
            entity={entity}
            cell={cell}
            records={query.items ?? []}
          />
        )}
      </RecordEntityGate>
      {query.hasNextPage && (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {c.recordsMore}
        </Button>
      )}
    </>
  );
}

function CohortList({
  entities,
  entity,
  cell,
  records,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  cell: string;
  records: readonly RecordView[];
}) {
  const c = useDashboardContent(),
    routes = useRegisterRoutes(),
    locale = useLocale();
  if (records.length === 0)
    return <EmptyState title={c.recordsEmpty}>{""}</EmptyState>;
  const columns = entity.list.columns.flatMap((id) => {
    const field = fieldOf(entity, id);
    return field ? [field] : [];
  });
  return (
    <RecordTable
      caption={fill(c.recordsListCaption, { cell }, locale)}
      columns={columns}
      linkColumn={
        columns.find((field) => field.id === entity.title) ?? columns[0]
      }
      records={records}
      recordHref={(record) => {
        const path = recordPath(routes, entities, entity.id, record.id);
        return path ? `#${path}` : "#";
      }}
      viewLabel={(record) => recordTitle(entity, record, locale) ?? record.id}
    />
  );
}
