import { useState } from "react";
import { useRecord, useRecords } from "@registrystack/app-runtime/react";
import type { EntityModel } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { RecordPager } from "@/blocks/record/record-list";
import { HolderSteps, takesDocuments } from "@/blocks/request/holder-steps";
import { BackLink } from "@/blocks/shell/back-link";
import { EmptyState } from "@/blocks/shell/empty-state";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { chooseChangeRoute, chooseRecordRoute } from "@/blocks/pages/holder-step-routes";
import { usePagesContent } from "@/blocks/pages/pages-content";
import {
  recordTitle,
  RecordEntityGate,
  requestRoute,
  requestsTargeting,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";

/**
 * The first step of a holder's change: the records the session reads, each
 * with the button that picks it. The list is the host's own read, so a record
 * the profile does not read is never offered.
 */
export function HolderChooseRecordPage() {
  return (
    <RecordEntityGate>
      {(entities, entity) => (
        <ChooseRecord entities={entities} entity={entity} />
      )}
    </RecordEntityGate>
  );
}

function ChooseRecord({
  entities,
  entity,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
}) {
  const pages = usePagesContent(),
    locale = useLocale(),
    routes = useRegisterRoutes();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const query = useRecords(entity.id, cursor ? { cursor } : {});
  const documents = takesDocuments(requestsTargeting(entities, entity.id));
  return (
    <>
      <BackLink href={routes.records}>{pages.back}</BackLink>
      <HolderSteps current="record" documents={documents} />
      <PageHeading
        title={pages.chooseRecordTitle}
        description={pages.chooseRecordDescription}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState title={pages.chooseRecordEmptyTitle}>
          {pages.chooseRecordEmptyBody}
        </EmptyState>
      ) : (
        query.data && (
          <>
            <ul className="grid gap-3">
              {query.data.items.map((record) => {
                const title = recordTitle(entity, record, locale) ?? entity.label;
                return (
                  <li
                    key={record.id}
                    className="card flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="font-semibold">{title}</span>
                    <Button
                      variant="outline"
                      render={<a href={`#${chooseChangeRoute(record.id)}`} />}
                    >
                      {fill(pages.chooseRecordButton, { title }, locale)}
                    </Button>
                  </li>
                );
              })}
            </ul>
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

/**
 * The second step: the changes the registry offers on the chosen record,
 * read from the creates its links carry. A request the record offers no
 * create for is not listed.
 */
export function HolderChooseChangePage({ id }: { id: string }) {
  return (
    <RecordEntityGate>
      {(entities, entity) => (
        <ChooseChange entities={entities} entity={entity} id={id} />
      )}
    </RecordEntityGate>
  );
}

function ChooseChange({
  entities,
  entity,
  id,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  id: string;
}) {
  const pages = usePagesContent(),
    locale = useLocale(),
    routes = useRegisterRoutes(),
    query = useRecord(entity.id, id);
  const requests = requestsTargeting(entities, entity.id);
  const offered = (query.data?.actions ?? []).flatMap((action) => {
    const request = requests.find((item) => item.id === action.entity);
    return action.name === "create" && request ? [{ action, request }] : [];
  });
  return (
    <>
      <BackLink href={chooseRecordRoute}>{pages.back}</BackLink>
      <HolderSteps current="change" documents={takesDocuments(requests)} />
      {query.isPending ? (
        <Loading />
      ) : !query.data || query.error ? (
        <ErrorPanel error={query.error} />
      ) : (
        <>
          <PageHeading
            eyebrow={recordTitle(entity, query.data, locale)}
            title={pages.chooseChangeTitle}
            description={pages.chooseChangeDescription}
          />
          {offered.length === 0 ? (
            <EmptyState title={pages.chooseChangeNoneTitle}>
              {pages.chooseChangeNoneBody}
            </EmptyState>
          ) : (
            <ul className="grid gap-3">
              {offered.map(({ action, request }) => (
                <li key={action.ref} className="card">
                  <Button
                    variant="outline"
                    render={
                      <a
                        href={`#${requestRoute(entities, routes.changeRecord(id), request.id)}`}
                      />
                    }
                  >
                    {action.label ?? request.label}
                  </Button>
                  {request.createDescription && (
                    <p className="muted">{request.createDescription}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
