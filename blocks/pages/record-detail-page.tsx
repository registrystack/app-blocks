import { ArrowRight, Plus } from "lucide-react";
import type {
  EntityModel,
  FieldModel,
  RecordRevision,
} from "@registrystack/app-runtime";
import {
  useModel,
  useRecord,
  useRecordHistory,
  useRecords,
  useRecordsOf,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { FieldValue } from "@/blocks/fields/field-value";
import { fill } from "@/blocks/lib/format";
import { PageHeading } from "@/blocks/shell/page-heading";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { StatusBadge } from "@/blocks/shell/status-badge";
import { RecordSections } from "@/blocks/record/record-sections";
import { RecordTable } from "@/blocks/record/record-table";
import { createWords, usePagesContent } from "@/blocks/pages/pages-content";
import { formRoute } from "@/blocks/pages/record-route-query";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import {
  entityRoutes,
  fieldOf,
  recordTitle,
  RecordEntityGate,
  requestRoute,
  requestsTargeting,
  sameAnswer,
  type RegisterEntities,
} from "@/blocks/pages/record";

/**
 * One record of one record entity, the register's own when `entity` is left
 * out, in the sections the session model gives it, with the governed actions
 * its record read offers, the records that refer to it, its history, the
 * requests its record read offers and the requests already made on it, of
 * every request entity that targets it.
 */
export function RecordDetailPage({
  id,
  entity,
}: {
  id: string;
  /** The entity's id; the register's own record entity when left out. */
  entity?: string;
}) {
  return (
    <RecordEntityGate entity={entity}>
      {(entities, model) => (
        <RecordDetail entities={entities} entity={model} id={id} />
      )}
    </RecordEntityGate>
  );
}

function RecordDetail({
  entities,
  entity,
  id,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  id: string;
}) {
  const pages = usePagesContent(),
    appRoutes = useRegisterRoutes(),
    routes = entityRoutes(appRoutes, entities, entity.id),
    ownEntity = entity.id === entities.record.id,
    requests = requestsTargeting(entities, entity.id),
    query = useRecord(entity.id, id);
  if (query.isPending) return <Loading />;
  if (query.error || !query.data)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const record = query.data;
  // One button per request entity the session may open a request of for this
  // record; a register with one request entity keeps the generic wording.
  const changes = requests.flatMap((item) => {
    const create = record.actions.find(
      (action) => action.name === "create" && action.entity === item.id,
    );
    return create ? [{ request: item, create }] : [];
  });
  // A governed action is offered only where the app names a form for it.
  const governed = record.actions.flatMap((action) =>
    action.name === "invoke" && action.actionId && routes?.action
      ? [
          {
            id: action.actionId,
            label: action.label ?? action.actionId,
            href: `#${routes.action(id, action.actionId)}`,
          },
        ]
      : [],
  );
  const changeButtons = changes.map(({ request: item, create }) => (
    <Button
      key={item.id}
      render={
        <a
          href={`#${requestRoute(entities, appRoutes.changeRecord(id), item.id)}`}
        />
      }
    >
      {requests.length === 1
        ? pages.requestChange
        : createWords(pages, "requestChangeOf", create.label, item.label)}
      <ArrowRight />
    </Button>
  ));
  return (
    <>
      <BackLink href={routes?.records ?? appRoutes.records}>
        {ownEntity
          ? pages.backToRecords
          : fill(pages.backToList, { label: entity.pluralLabel })}
      </BackLink>
      <PageHeading
        eyebrow={entity.label}
        title={recordTitle(entity, record) ?? entity.label}
        action={
          governed.length > 0 || changeButtons.length > 1 ? (
            <div className="actions">
              {changeButtons}
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
          ) : (
            changeButtons[0]
          )
        }
      />
      <RecordSections entity={entity} record={record} />
      <p className="muted">{pages.recordNotice}</p>
      {routes &&
        relatedEntities(entities, entity).map(({ related, field, several }) => (
          <RelatedRecords
            key={`${related.id}:${field.id}`}
            entities={entities}
            entity={entity}
            id={id}
            related={related}
            field={field}
            several={several}
            returnPath={routes.record(id)}
          />
        ))}
      {/* Absent where the profile has no revision access. */}
      {entity.operations.revisions && (
        <RecordHistoryBlock entity={entity} id={id} />
      )}
      {requests.length > 0 && (
        <RecordRequestsBlock entities={entities} requests={requests} id={id} />
      )}
    </>
  );
}

/** One field of another record entity that refers to a record of this one, and can list by it. */
interface RelatedField {
  related: EntityModel;
  field: FieldModel;
  /** Whether the same entity refers to this one through more than one field. */
  several: boolean;
}

/**
 * The record entities that refer to `entity`, each through every field that
 * names it and that the entity's list can be filtered by.
 */
function relatedEntities(
  entities: RegisterEntities,
  entity: EntityModel,
): RelatedField[] {
  return (entities.records ?? []).flatMap((related) => {
    if (related.id === entity.id) return [];
    const fields = related.fields.filter(
      (field) =>
        field.reference?.entity === entity.id &&
        related.list.filters.some((filter) => filter.field === field.id),
    );
    return fields.map((field) => ({
      related,
      field,
      several: fields.length > 1,
    }));
  });
}

/**
 * The records of another entity that refer to this one through `field`,
 * linked to their own pages, with the creates and governed actions the list
 * offers for adding one that already refers to this record. Where the
 * registry does not advertise the filter for this profile, the section is
 * absent rather than an error.
 */
function RelatedRecords({
  entities,
  entity,
  id,
  related,
  field,
  several,
  returnPath,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  id: string;
  related: EntityModel;
  field: FieldModel;
  several: boolean;
  returnPath: string;
}) {
  const pages = usePagesContent(),
    appRoutes = useRegisterRoutes(),
    routes = entityRoutes(appRoutes, entities, related.id),
    query = useRecords(related.id, { filters: { [field.id]: id } });
  if (!routes) return null;
  const heading = several
    ? `${related.pluralLabel} (${field.label})`
    : related.pluralLabel;
  if (query.error) {
    if (query.unsupported) return null;
    return (
      <section className="card">
        <h2>{heading}</h2>
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      </section>
    );
  }
  if (query.isPending || !query.data) return null;
  const create = query.data.actions?.find(
    (action) => action.name === "create" && action.entity === related.id,
  );
  // An action that adds one of these records is offered here when it takes
  // this record as an input; each such input is preset with it.
  const governed = (query.data.actions ?? []).flatMap((action) => {
    if (
      action.name !== "invoke" ||
      action.entity !== related.id ||
      !action.actionId ||
      !routes.recordAction
    )
      return [];
    const preset = Object.fromEntries(
      (action.fields ?? [])
        .filter((input) => input.reference?.entity === entity.id)
        .map((input) => [input.id, id]),
    );
    return Object.keys(preset).length === 0
      ? []
      : [
          {
            id: action.actionId,
            label: action.label ?? action.actionId,
            href: `#${formRoute(routes.recordAction(action.actionId), preset, returnPath)}`,
          },
        ];
  });
  const columns = related.list.columns
    .filter((column) => column !== field.id)
    .map((column) => fieldOf(related, column))
    .filter((column) => column !== undefined);
  const items = query.data.items;
  return (
    <section className="card">
      <h2>{heading}</h2>
      {items.length === 0 ? (
        !create &&
        governed.length === 0 && <p className="muted">{pages.relatedEmpty}</p>
      ) : (
        <RecordTable
          caption={heading}
          columns={columns}
          linkColumn={
            columns.find((column) => column.id === related.title) ?? columns[0]
          }
          records={items}
          recordHref={(item) => `#${routes.record(item.id)}`}
          viewLabel={(item) => recordTitle(related, item) ?? item.id}
        />
      )}
      {(create || governed.length > 0) && (
        <div className="actions">
          {create && (
            <Button
              variant="outline"
              render={
                <a
                  href={`#${formRoute(routes.createRecord, { [field.id]: id }, returnPath)}`}
                />
              }
            >
              <Plus />
              {createWords(pages, "addRecord", create.label, related.label)}
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
      )}
    </section>
  );
}

/**
 * The time a revision was recorded, in the reader's own zone and named, read
 * like every other time the kit shows ("2 October 2026 at 18:53 BST"); to the
 * second when `seconds`, so revisions recorded in one minute read apart.
 */
function recordedAt(value: string, seconds = false): string {
  const when = new Date(value);
  if (Number.isNaN(when.valueOf())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false,
    timeZoneName: "short",
  }).format(when);
}

/** Whether two of the revisions read the same to the minute. */
function sharesMinute(revisions: readonly RecordRevision[]): boolean {
  const minutes = revisions
    .filter((revision) => revision.recordedAt)
    .map((revision) => recordedAt(revision.recordedAt!));
  return new Set(minutes).size < minutes.length;
}

/**
 * The states the record has held, newest first, each with the values that
 * changed from the one before it, in the model's own words. A history the
 * host cannot read shows the wording for a missing history and nothing else.
 */
function RecordHistoryBlock({
  entity,
  id,
}: {
  entity: EntityModel;
  id: string;
}) {
  const pages = usePagesContent(),
    history = useRecordHistory(entity.id, id),
    seconds = sharesMinute(history.data?.items ?? []);
  return (
    <section className="card">
      <h2>{pages.historyHeading}</h2>
      {history.isPending ? (
        <Loading />
      ) : history.error || !history.data ? (
        <>
          <h3>{pages.historyGapTitle}</h3>
          <p>{pages.historyGapBody}</p>
        </>
      ) : history.data.items.length === 0 ? (
        <p className="muted">{pages.historyNone}</p>
      ) : (
        <ol className="history-list">
          {history.data.items.map((revision, index) => (
            <HistoryEntry
              key={revision.revision}
              entity={entity}
              revision={revision}
              earlier={history.data.items[index + 1]}
              seconds={seconds}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

/** One revision: when it was recorded and what it changed from `earlier`; every value it holds when there is no earlier one. */
function HistoryEntry({
  entity,
  revision,
  earlier,
  seconds,
}: {
  entity: EntityModel;
  revision: RecordRevision;
  earlier?: RecordRevision;
  seconds: boolean;
}) {
  const pages = usePagesContent();
  const changed = entity.fields.filter((field) =>
    earlier
      ? !sameAnswer(revision.values[field.id], earlier.values[field.id])
      : revision.values[field.id] !== undefined &&
        revision.values[field.id] !== null,
  );
  return (
    <li>
      {revision.recordedAt && (
        <p>
          <time dateTime={revision.recordedAt}>
            {recordedAt(revision.recordedAt, seconds)}
          </time>
        </p>
      )}
      {changed.length === 0 ? (
        <p className="muted">{pages.historyUnchanged}</p>
      ) : (
        <dl className="facts">
          {changed.map((field) => (
            <div className="definition" key={field.id}>
              <dt>{field.label}</dt>
              <dd>
                <FieldValue field={field} value={revision.values[field.id]} />
                {earlier && (
                  <span className="muted">
                    {" "}
                    ({pages.historyWas}{" "}
                    <FieldValue
                      field={field}
                      value={earlier.values[field.id]}
                    />
                    )
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

/**
 * The record's requests of every request entity that targets it, each linked
 * to its own page and, where several entities do, naming its type. An entity
 * the registry does not list by record is left out; one whose read fails shows
 * its refusal with a retry beside the others' requests. Where no entity can be
 * listed the block is absent rather than an error.
 */
function RecordRequestsBlock({
  entities,
  requests,
  id,
}: {
  entities: RegisterEntities;
  requests: readonly EntityModel[];
  id: string;
}) {
  const pages = usePagesContent(),
    routes = useRegisterRoutes(),
    queries = useRecordsOf(
      requests.map((request) => request.id),
      { target: id },
    ),
    reads = requests.map((request, index) => ({
      request,
      query: queries[index]!,
    })),
    listed = reads.filter(({ query }) => !(query.error && query.unsupported));
  if (listed.length === 0 || listed.some(({ query }) => query.isPending))
    return null;
  const failed = listed.filter(({ query }) => query.error);
  const items = listed.flatMap(({ request, query }) =>
    (query.data?.items ?? []).map((item) => ({ request, item })),
  );
  const refusals = failed.map(({ request, query }) => (
    <ErrorPanel
      key={request.id}
      error={query.error}
      retry={() => void query.refetch()}
    />
  ));
  if (failed.length === listed.length)
    return (
      <section className="card">
        <h2>{pages.recordRequestsHeading}</h2>
        {refusals}
      </section>
    );
  return (
    <section className="card">
      <h2>{pages.recordRequestsHeading}</h2>
      <p className="sr-only">{pages.recordRequestsNote}</p>
      {items.length === 0 ? (
        <p className="muted">{pages.recordRequestsEmpty}</p>
      ) : (
        <ul className="value-list">
          {items.map(({ request, item }) => {
            const state = item.request?.state;
            return (
              <li key={`${request.id}:${item.id}`}>
                <a
                  className="record-link"
                  href={`#${requestRoute(entities, routes.request(item.id), request.id)}`}
                >
                  {recordTitle(request, item) ?? pages.unnamedRequest}
                </a>{" "}
                {state && (
                  <StatusBadge
                    state={state}
                    served={request.request?.stateLabels[state]}
                  />
                )}
                {requests.length > 1 && (
                  <>
                    {" "}
                    <span className="muted">{request.label}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {refusals}
    </section>
  );
}
