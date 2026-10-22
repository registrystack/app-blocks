import { useId } from "react";
import { ArrowRight, Plus } from "lucide-react";
import {
  relatedFields,
  type EntityModel,
  type FieldModel,
  type RecordRevision,
  type RecordView,
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
import { InPhrase } from "@/blocks/fields/values";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { PageHeading } from "@/blocks/shell/page-heading";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { StatusBadge } from "@/blocks/shell/status-badge";
import { RecordSections } from "@/blocks/record/record-sections";
import { RecordTable } from "@/blocks/record/record-table";
import {
  backToListOf,
  createWords,
  usePagesContent,
} from "@/blocks/pages/pages-content";
import { formRoute, listRoute } from "@/blocks/pages/record-route-query";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { unavailableText } from "@/blocks/casework/shared";
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
    unavailableWords = useCaseworkContent(),
    locale = useLocale(),
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
  // A governed action is offered only where the app names a form for it. One
  // the registry would refuse for this record now is shown disabled, with the
  // registry's reason, never hidden.
  const governed = record.actions.flatMap((action) =>
    action.name === "invoke" && action.actionId && routes?.action
      ? [
          {
            id: action.actionId,
            label: action.label ?? action.actionId,
            href: `#${routes.action(id, action.actionId)}`,
            unavailable: action.availability
              ? unavailableText(unavailableWords, action.availability, locale)
              : undefined,
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
        : createWords(
            pages,
            "requestChangeOf",
            create.label,
            item.label,
            locale,
          )}
      <ArrowRight />
    </Button>
  ));
  return (
    <>
      <BackLink href={routes?.records ?? appRoutes.records}>
        {backToListOf(pages, entity, ownEntity, locale)}
      </BackLink>
      <PageHeading
        eyebrow={entity.label}
        title={recordTitle(entity, record, locale) ?? entity.label}
        action={
          governed.length > 0 || changeButtons.length > 1 ? (
            <div className="actions">
              {changeButtons}
              {governed.map((action) => (
                <GovernedAction key={action.id} {...action} />
              ))}
            </div>
          ) : (
            changeButtons[0]
          )
        }
      />
      <div
        className={
          entity.operations.revisions
            ? "record-layout"
            : "record-layout record-layout-single"
        }
      >
        <div className="record-main">
          <RecordSections entity={entity} record={record} />
          <p className="muted">{pages.recordNotice}</p>
          {routes &&
            relatedFields(entities.records ?? [], entity.id).map(
              ({ related, field, several }) => (
                <RelatedRecords
                  key={`${related.id}:${field.id}`}
                  entities={entities}
                  entity={entity}
                  id={id}
                  related={related}
                  field={field}
                  several={several}
                  returnPath={routes.record(id)}
                  offered={governed.map((action) => action.id)}
                  unavailable={record.relatedActionAvailability}
                />
              ),
            )}
          {requests.length > 0 && (
            <RecordRequestsBlock
              entities={entities}
              requests={requests}
              id={id}
            />
          )}
        </div>
        {/* Absent where the profile has no revision access. */}
        {entity.operations.revisions && (
          <aside className="record-aside" aria-label={pages.historyHeading}>
            <RecordHistoryBlock
              entity={entity}
              id={id}
              currentRevision={record.revision}
            />
          </aside>
        )}
      </div>
    </>
  );
}

/** How many related records a section lists before it says more exist and links to the rest. */
const RELATED_SHOWN = 5;

/**
 * The records of another entity that refer to this one through `field`,
 * linked to their own pages, with the creates and governed actions the list
 * offers for adding one that already refers to this record, less those the
 * record page already offers. Where the registry does not advertise the
 * filter for this profile, the section is absent rather than an error.
 */
function RelatedRecords({
  entities,
  entity,
  id,
  related,
  field,
  several,
  returnPath,
  offered,
  unavailable,
}: {
  entities: RegisterEntities;
  entity: EntityModel;
  id: string;
  related: EntityModel;
  field: FieldModel;
  several: boolean;
  returnPath: string;
  /** The ids of the governed actions the record page itself offers. */
  offered: readonly string[];
  /** The registry's answers that it would refuse an action with this record, by action id. */
  unavailable: RecordView["relatedActionAvailability"];
}) {
  const pages = usePagesContent(),
    unavailableWords = useCaseworkContent(),
    locale = useLocale(),
    appRoutes = useRegisterRoutes(),
    routes = entityRoutes(appRoutes, entities, related.id),
    query = useRecords(related.id, { filters: { [field.id]: id } });
  if (!routes) return null;
  const heading = several
    ? fill(
        pages.relatedRecordsBy,
        { records: related.pluralLabel, field: field.label },
        locale,
      )
    : related.pluralLabel;
  if (query.error) {
    if (query.unsupported) return null;
    return (
      <section className="card section-card">
        <h2>{heading}</h2>
        <div className="section-card-body">
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        </div>
      </section>
    );
  }
  if (query.isPending || !query.data) return null;
  const create = query.data.actions?.find(
    (action) => action.name === "create" && action.entity === related.id,
  );
  // An action that adds one of these records is offered here when it takes
  // this record as an input; each such input is preset with it. One the
  // record page already offers is not offered twice. One the registry would
  // refuse with this record is shown disabled, with its reason, never hidden.
  const governed = (query.data.actions ?? []).flatMap((action) => {
    if (
      action.name !== "invoke" ||
      action.entity !== related.id ||
      !action.actionId ||
      offered.includes(action.actionId) ||
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
            unavailable: unavailable?.[action.actionId]
              ? unavailableText(
                  unavailableWords,
                  unavailable[action.actionId],
                  locale,
                )
              : undefined,
          },
        ];
  });
  const columns = related.list.columns
    .filter((column) => column !== field.id)
    .map((column) => fieldOf(related, column))
    .filter((column) => column !== undefined);
  const items = query.data.items.slice(0, RELATED_SHOWN);
  const more =
    query.data.items.length > RELATED_SHOWN || query.data.nextCursor !== undefined;
  return (
    <section className="card section-card">
      <h2>{heading}</h2>
      <div className="section-card-body">
        {items.length === 0 ? (
          !create &&
          governed.length === 0 && (
            <p className="muted">{pages.relatedEmpty}</p>
          )
        ) : (
          <>
            <RecordTable
              caption={heading}
              columns={columns}
              linkColumn={
                columns.find((column) => column.id === related.title) ??
                columns[0]
              }
              records={items}
              recordHref={(item) => `#${routes.record(item.id)}`}
              viewLabel={(item) => recordTitle(related, item, locale) ?? item.id}
            />
            {more && (
              <p className="muted related-bounds">
                {fill(pages.relatedBounds, { count: items.length }, locale)}
              </p>
            )}
            <a
              className="related-all"
              href={`#${listRoute(routes.records, { filters: { [field.id]: id } })}`}
            >
              {fill(pages.relatedShowAll, { label: related.pluralLabel }, locale)}
              <ArrowRight />
            </a>
          </>
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
                {createWords(
                  pages,
                  "addRecord",
                  create.label,
                  related.label,
                  locale,
                )}
              </Button>
            )}
            {governed.map((action) => (
              <GovernedAction key={action.id} {...action} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A governed action: a link to its form or, where the registry would refuse
 * it now, a disabled button with the registry's reason beside it.
 */
function GovernedAction({
  label,
  href,
  unavailable,
}: {
  label: string;
  href: string;
  unavailable?: string;
}) {
  const reason = useId();
  if (!unavailable)
    return (
      <Button variant="outline" render={<a href={href} />}>
        {label}
      </Button>
    );
  return (
    <span className="action-unavailable">
      <Button variant="outline" disabled aria-describedby={reason}>
        {label}
      </Button>
      <span id={reason} className="muted">
        {unavailable}
      </span>
    </span>
  );
}

/**
 * The time a revision was recorded, in the reader's own zone and named, read
 * like every other time the kit shows ("2 October 2026 at 18:53 BST") and
 * written in `locale`; to the second when `seconds`, so revisions recorded in
 * one minute read apart.
 */
function recordedAt(value: string, locale: string, seconds = false): string {
  const when = new Date(value);
  if (Number.isNaN(when.valueOf())) return value;
  return new Intl.DateTimeFormat(locale, {
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

/** Whether two of the revisions read the same to the minute in `locale`. */
function sharesMinute(
  revisions: readonly RecordRevision[],
  locale: string,
): boolean {
  const minutes = revisions
    .filter((revision) => revision.recordedAt)
    .map((revision) => recordedAt(revision.recordedAt!, locale));
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
  currentRevision,
}: {
  entity: EntityModel;
  id: string;
  /** The revision the record holds now, to mark its entry. */
  currentRevision: string;
}) {
  const pages = usePagesContent(),
    locale = useLocale(),
    history = useRecordHistory(entity.id, id),
    seconds = sharesMinute(history.data?.items ?? [], locale);
  return (
    <section className="card section-card">
      <h2>{pages.historyHeading}</h2>
      <div className="section-card-body">
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
          <>
            <p className="muted">{pages.historyIntro}</p>
            <ol className="history-list">
              {history.data.items.map((revision, index) => (
                <HistoryEntry
                  key={revision.revision}
                  entity={entity}
                  revision={revision}
                  earlier={history.data.items[index + 1]}
                  seconds={seconds}
                  current={revision.revision === currentRevision}
                />
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

/** One revision: when it was recorded and what it changed from `earlier`; every value it holds when there is no earlier one. */
function HistoryEntry({
  entity,
  revision,
  earlier,
  seconds,
  current,
}: {
  entity: EntityModel;
  revision: RecordRevision;
  earlier?: RecordRevision;
  seconds: boolean;
  current: boolean;
}) {
  const pages = usePagesContent();
  const locale = useLocale();
  const changed = entity.fields.filter((field) =>
    earlier
      ? !sameAnswer(revision.values[field.id], earlier.values[field.id])
      : revision.values[field.id] !== undefined &&
        revision.values[field.id] !== null,
  );
  return (
    <li>
      {(revision.recordedAt || current) && (
        <p className="history-when">
          {revision.recordedAt && (
            <time dateTime={revision.recordedAt}>
              {recordedAt(revision.recordedAt, locale, seconds)}
            </time>
          )}
          {current && (
            <span className="badge badge-current">{pages.historyCurrent}</span>
          )}
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
                    <InPhrase>
                      <FieldValue
                        field={field}
                        value={earlier.values[field.id]}
                      />
                    </InPhrase>
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
 * to its own page and, where several entities do, naming its type. The model
 * decides which request kinds can be listed by target. The others link to
 * their ordinary request list, while an advertised read that fails shows its
 * refusal with a retry.
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
    locale = useLocale(),
    routes = useRegisterRoutes(),
    targetListable = requests.filter(
      (request) =>
        request.operations.list === true &&
        request.request?.listByTarget === true,
    ),
    browseable = requests.filter(
      (request) =>
        request.operations.list === true &&
        request.request?.listByTarget !== true,
    ),
    queries = useRecordsOf(
      targetListable.map((request) => request.id),
      { target: id },
    ),
    reads = targetListable.map((request, index) => ({
      request,
      query: queries[index]!,
    }));
  if (targetListable.length === 0 && browseable.length === 0) return null;
  const pending = reads.some(({ query }) => query.isPending);
  if (pending && browseable.length === 0) return null;
  const failed = reads.filter(({ query }) => query.error);
  const items = reads.flatMap(({ request, query }) =>
    (query.data?.items ?? []).map((item) => ({ request, item })),
  );
  const refusals = failed.map(({ request, query }) => (
    <ErrorPanel
      key={request.id}
      error={query.error}
      retry={() => void query.refetch()}
    />
  ));
  if (failed.length === reads.length && browseable.length === 0)
    return (
      <section className="card section-card">
        <h2>{pages.recordRequestsHeading}</h2>
        <div className="section-card-body">{refusals}</div>
      </section>
    );
  return (
    <section className="card section-card">
      <h2>{pages.recordRequestsHeading}</h2>
      <div className="section-card-body">
        <p className="sr-only">{pages.recordRequestsNote}</p>
        {items.length === 0 &&
        !pending &&
        failed.length < reads.length &&
        browseable.length === 0 ? (
          <p className="muted">{pages.recordRequestsEmpty}</p>
        ) : items.length > 0 ? (
          <ul className="value-list">
            {items.map(({ request, item }) => {
              const state = item.request?.state;
              return (
                <li key={`${request.id}:${item.id}`}>
                  <a
                    className="record-link"
                    href={`#${requestRoute(entities, routes.request(item.id), request.id)}`}
                  >
                    {recordTitle(request, item, locale) ?? pages.unnamedRequest}
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
        ) : null}
        {browseable.length > 0 && (
          <ul className="value-list">
            {browseable.map((request) => (
              <li key={request.id}>
                <a
                  className="record-link"
                  href={`#${requestRoute(entities, routes.requests, request.id)}`}
                >
                  {fill(
                    pages.recordRequestsBrowse,
                    { label: request.pluralLabel },
                    locale,
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
        {refusals}
      </div>
    </section>
  );
}
