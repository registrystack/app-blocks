import { useAuthority, useRecords } from "@registrystack/app-runtime/react";
import type { EntityModel } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { chooseRecordRoute, reviewRoute } from "@/blocks/pages/holder-step-routes";
import { usePagesContent } from "@/blocks/pages/pages-content";
import {
  listableRequests,
  recordTitle,
  requestsTargeting,
  useRegister,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { RecordListPage } from "@/blocks/pages/record-list-page";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";

/** The register's records with the holder's drafts and the way to begin a change beneath them. */
export function HolderRecordListPage() {
  return (
    <>
      <RecordListPage />
      <HolderDrafts />
    </>
  );
}

/**
 * The changes a holder has begun and not sent, and the way to begin another.
 * The drafts are the registry's own: a read of the requests in the draft
 * state, so a holder who left finds them here and picks one up at its review.
 */
export function HolderDrafts() {
  const session = useAuthority(),
    pages = usePagesContent(),
    entities = useRegister().entities;
  if (!session.holder || !entities) return null;
  const requests = listableRequests(entities);
  const offered = requestsTargeting(entities, entities.record.id).length > 0;
  return (
    <>
      {requests.map((request) => (
        <DraftGroup
          key={request.id}
          entities={entities}
          request={request}
          named={requests.length > 1}
        />
      ))}
      {offered && (
        <div className="actions">
          <Button
            variant="outline"
            render={<a href={`#${chooseRecordRoute}`} />}
          >
            {pages.draftsStart}
          </Button>
        </div>
      )}
    </>
  );
}

function DraftGroup({
  entities,
  request,
  named,
}: {
  entities: RegisterEntities;
  request: EntityModel;
  named: boolean;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    locale = useLocale(),
    routes = useRegisterRoutes(),
    drafts = useRecords(request.id, { state: "draft" });
  if (drafts.isPending) return null;
  if (drafts.error)
    return (
      <p className="muted" role="status">
        {pages.draftsUnavailable}
      </p>
    );
  const items = drafts.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section className="mt-6" aria-label={pages.draftsHeading}>
      <h2>
        {named
          ? fill(
              block.labelled,
              { label: pages.draftsHeading, value: request.pluralLabel },
              locale,
            )
          : pages.draftsHeading}
      </h2>
      <p className="muted">{pages.draftsDescription}</p>
      <ul className="grid gap-3">
        {items.map((draft) => {
          const title = recordTitle(request, draft, locale) ?? pages.draftsUnnamed;
          return (
            <li
              key={draft.id}
              className="card flex flex-wrap items-center justify-between gap-3"
            >
              <span className="font-semibold">{title}</span>
              <Button
                variant="outline"
                render={
                  <a
                    href={`#${reviewRoute(routes, entities, request.id, draft.id)}`}
                  />
                }
              >
                {fill(pages.draftsResume, { title }, locale)}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
