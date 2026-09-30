import { ArrowRight } from "lucide-react";
import type { EntityModel } from "@registrystack/app-runtime";
import { useRecord, useRecords } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/blocks/shell/page-heading";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { StatusBadge } from "@/blocks/shell/status-badge";
import { RecordSections } from "@/blocks/record/record-sections";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import {
  recordTitle,
  useRegister,
  type RegisterEntities,
} from "@/blocks/pages/record";

/**
 * One record of the register's record entity, in the sections the session
 * model gives it, with the request its record read offers and the requests
 * already made on it.
 */
export function RecordDetailPage({ id }: { id: string }) {
  const register = useRegister();
  if (register.isPending) return <Loading />;
  if (register.error || !register.entities)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  return <RecordDetail entities={register.entities} id={id} />;
}

function RecordDetail({
  entities,
  id,
}: {
  entities: RegisterEntities;
  id: string;
}) {
  const pages = usePagesContent(),
    routes = useRegisterRoutes(),
    entity = entities.record,
    request = entities.request,
    query = useRecord(entity.id, id);
  if (query.isPending) return <Loading />;
  if (query.error || !query.data)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const record = query.data;
  const requestCreate =
    request &&
    record.actions.some(
      (action) => action.name === "create" && action.entity === request.id,
    );
  return (
    <>
      <BackLink href={routes.records}>{pages.backToRecords}</BackLink>
      <PageHeading
        eyebrow={entity.label}
        title={recordTitle(entity, record) ?? entity.label}
        action={
          requestCreate && (
            <Button render={<a href={`#${routes.changeRecord(id)}`} />}>
              {pages.requestChange}
              <ArrowRight />
            </Button>
          )
        }
      />
      <RecordSections entity={entity} record={record} />
      <p className="muted">{pages.recordNotice}</p>
      {/* Absent where the profile has no revision access. */}
      {entity.operations.revisions && <RecordHistoryBlock />}
      {request && <RecordRequestsBlock request={request} id={id} />}
    </>
  );
}

function RecordHistoryBlock() {
  const pages = usePagesContent();
  return (
    <section className="card">
      <h2>{pages.historyHeading}</h2>
      <h3>{pages.historyGapTitle}</h3>
      <p>{pages.historyGapBody}</p>
    </section>
  );
}

/**
 * The record's requests, linked to their own page. Where the registry does
 * not advertise the record filter for this profile, the block is absent
 * rather than an error.
 */
function RecordRequestsBlock({
  request,
  id,
}: {
  request: EntityModel;
  id: string;
}) {
  const pages = usePagesContent(),
    routes = useRegisterRoutes(),
    query = useRecords(request.id, { target: id });
  if (query.error) {
    if (query.unsupported) return null;
    return (
      <section className="card">
        <h2>{pages.recordRequestsHeading}</h2>
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      </section>
    );
  }
  if (query.isPending || !query.data) return null;
  return (
    <section className="card">
      <h2>{pages.recordRequestsHeading}</h2>
      <p className="sr-only">{pages.recordRequestsNote}</p>
      {query.data.items.length === 0 ? (
        <p className="muted">{pages.recordRequestsEmpty}</p>
      ) : (
        <ul className="value-list">
          {query.data.items.map((item) => {
            const state = item.request?.state;
            return (
              <li key={item.id}>
                <a className="record-link" href={`#${routes.request(item.id)}`}>
                  {recordTitle(request, item) ?? pages.unnamedRequest}
                </a>{" "}
                {state && (
                  <StatusBadge
                    state={state}
                    served={request.request?.stateLabels[state]}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
