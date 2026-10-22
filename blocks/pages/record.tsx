import type { ReactNode } from "react";
import {
  entityTitle,
  unavailableError,
  type EntityModel,
  type FieldModel,
  type JsonValue,
  type RecordView,
  type RequestView,
} from "@registrystack/app-runtime";
import {
  useModel,
  usePendingRecordWrite,
  type RecoveryReference,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { fillNodes } from "@/blocks/lib/format";
import { Notice } from "@/blocks/lib/notice";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { useShellContent } from "@/blocks/shell/shell-content";
import { navigate, useRoute } from "@/blocks/shell/routing";
import {
  useRegisterRoutes,
  type EntityRoutes,
  type RegisterRoutes,
} from "@/blocks/pages/register-routes";
import { usePagesContent } from "@/blocks/pages/pages-content";
import type { TaskFeedbackState } from "@/blocks/pages/task-feedback";

/**
 * The register's entities as the session model names them, and the words a
 * record's values are shown in. Which entity is which comes from the model,
 * never from an entity id in this code.
 */
export interface RegisterEntities {
  /** The records this service is about: the first record entity a request changes. */
  record: EntityModel;
  /** The request that changes one of those records, when the session has one. */
  request?: EntityModel;
  /**
   * The requests the session lists and follows: `request`, or else the model's
   * only request entity. A profile that may follow its requests without reading
   * the records they change sees that request target none of them.
   */
  followedRequest?: EntityModel;
  /**
   * Every record entity the model holds, the register's own among them. The
   * staff nav offers the listable ones as places when the model names none.
   */
  records?: readonly EntityModel[];
  /** Every request entity the model names, `request` and `followedRequest` among them. */
  requests?: readonly EntityModel[];
}

/** Whether a request starts from or patches a record of this entity. */
function belongsToRecord(request: EntityModel, entity: string): boolean {
  return (
    request.request?.entry?.entity === entity ||
    request.request?.targets.some(
      (target) => target.entity === entity && target.operation === "patch",
    ) === true
  );
}

/** The record and request entities of a session model, or null when it has no record entity. */
export function registerEntities(
  entities: EntityModel[],
): RegisterEntities | null {
  const requests = entities.filter((entity) => entity.kind === "request");
  const targeted = (entity: EntityModel) =>
    requests.find((request) => belongsToRecord(request, entity.id));
  const records = entities.filter((entity) => entity.kind === "record");
  const record = records.find(targeted) ?? records[0];
  if (!record) return null;
  const request = targeted(record);
  return {
    record,
    request,
    followedRequest:
      request ?? (requests.length === 1 ? requests[0] : undefined),
    records,
    requests,
  };
}

/** The request entities whose requests change a record of `entity`, in the model's order. */
export function requestsTargeting(
  entities: RegisterEntities,
  entity: string,
): readonly EntityModel[] {
  const requests =
    entities.requests ?? (entities.request ? [entities.request] : []);
  return requests.filter((request) => belongsToRecord(request, entity));
}

/** The request entities whose ordinary list this session may read. */
export function listableRequests(
  entities: RegisterEntities,
): readonly EntityModel[] {
  const requests =
    entities.requests ?? (entities.request ? [entities.request] : []);
  return requests.filter((request) => request.operations.list === true);
}

/** Request lists the app offers as standalone places; contextual-only lists keep their routes and authority. */
export function navigationRequests(
  entities: RegisterEntities,
): readonly EntityModel[] {
  return listableRequests(entities).filter(
    (request) => request.navigation !== false,
  );
}

/** The list that keeps the plain request route, else the first list served. */
export function defaultListRequest(
  entities: RegisterEntities,
): EntityModel | undefined {
  const requests = listableRequests(entities);
  return (
    requests.find((request) => request.id === entities.followedRequest?.id) ??
    requests[0]
  );
}

/** The query parameter that names the request entity a request route is about. */
const REQUEST_PARAM = "request";

/**
 * `path` for a request of `request`: the followed entity's requests keep the
 * plain path, any other names its entity in the query, so one set of request
 * routes serves every request entity.
 */
export function requestRoute(
  entities: RegisterEntities,
  path: string,
  request: string,
): string {
  return request === entities.followedRequest?.id
    ? path
    : `${path}?${REQUEST_PARAM}=${encodeURIComponent(request)}`;
}

/** The request entity a request route names in its query, else the followed one. */
export function routedRequest(
  entities: RegisterEntities,
  query: URLSearchParams,
): EntityModel | undefined {
  const named = query.get(REQUEST_PARAM);
  return named === null
    ? entities.followedRequest
    : entities.requests?.find((request) => request.id === named);
}

/** The session model's register entities; `entities` is null until read, or when absent. */
export function useRegister() {
  const model = useModel();
  return {
    ...model,
    entities: model.data ? registerEntities(model.data.entities) : null,
  };
}

/**
 * The routes of one record entity: the register's own record entity keeps the
 * register's routes, any other the app's `entity` routes. Null for an entity
 * the session reads no records of, or where the app names no routes for it.
 */
export function entityRoutes(
  routes: RegisterRoutes,
  entities: RegisterEntities,
  entity: string,
): EntityRoutes | null {
  if (entity === entities.record.id)
    return {
      records: routes.records,
      createRecord: routes.createRecord,
      record: routes.record,
      recordAction: routes.recordAction,
      action: routes.action,
    };
  if (!entities.records?.some((item) => item.id === entity)) return null;
  return routes.entity?.(entity) ?? null;
}

/**
 * The route a record opens on: a request on its request page (naming its
 * request entity unless it is the followed one), a record of any
 * record entity on that entity's record page, and null for an entity this app
 * has no page for.
 */
export function recordPath(
  routes: RegisterRoutes,
  entities: RegisterEntities,
  entity: string,
  id: string,
): string | null {
  if (
    entity === entities.followedRequest?.id ||
    entities.requests?.some((request) => request.id === entity)
  )
    return requestRoute(entities, routes.request(id), entity);
  return entityRoutes(routes, entities, entity)?.record(id) ?? null;
}

/**
 * The register's entities and one record entity of the page's own: the
 * register's record entity when `entityId` is left out, else the record entity
 * the model names. `entity` is undefined where the model has no such entity.
 */
export function useRecordEntity(entityId?: string) {
  const register = useRegister();
  const entities = register.entities;
  const entity = !entities
    ? undefined
    : entityId === undefined
      ? entities.record
      : entities.records?.find((item) => item.id === entityId);
  return { ...register, entity };
}

/**
 * The gate every record page stands behind: loading while the model is read,
 * a refusal with a retry when it cannot be, and the unavailable refusal for
 * an entity it does not carry. Once through, `children` gets the register's
 * entities and the page's own entity.
 */
export function RecordEntityGate({
  entity: entityId,
  children,
}: {
  /** The page's entity id; the register's own record entity when left out. */
  entity?: string;
  children: (entities: RegisterEntities, entity: EntityModel) => ReactNode;
}) {
  const register = useRecordEntity(entityId);
  const shell = useShellContent();
  if (register.isPending) return <Loading />;
  if (register.error)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  // A model read in full that holds no record type the session reads.
  if (!register.entities || !register.entity)
    return <ErrorPanel error={unavailableError(shell.unavailable)} />;
  return <>{children(register.entities, register.entity)}</>;
}

/**
 * The id of the readable record that gives a request its page context. A
 * declared entry wins over an effect target because an Action may create a
 * different record from the one where the request started.
 */
export function readableTarget(
  entities: RegisterEntities,
  request: RequestView | undefined,
): string {
  const target = request?.entry ?? request?.target;
  return target &&
    target.entity === entities.record.id &&
    target.available !== false
    ? target.id
    : "";
}

/** Whether two values are the same answer; a list is the same in any order. */
export function sameAnswer(
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): boolean {
  if (Array.isArray(left) && Array.isArray(right))
    return (
      JSON.stringify(left.map((item) => JSON.stringify(item)).sort()) ===
      JSON.stringify(right.map((item) => JSON.stringify(item)).sort())
    );
  return JSON.stringify(left) === JSON.stringify(right);
}

export function fieldOf(
  entity: EntityModel,
  id: string,
): FieldModel | undefined {
  return entity.fields.find((field) => field.id === id);
}

/**
 * The words a record is named by: its title template or title field, or
 * undefined when it has neither. A calendar date in it is written in `locale`.
 */
export function recordTitle(
  entity: EntityModel,
  record: RecordView,
  locale: string,
): string | undefined {
  return entityTitle(entity, (field) => record.values[field.id], locale);
}

/**
 * Words for a coded value: the content's own wording first, then the word the
 * model carries for the field's option, and the raw code only when neither exists.
 */
export function useOptionLabel(): (field: FieldModel, code: string) => string {
  const c = useBlockContent();
  return (field, code) =>
    c.terms[code] ??
    field.options?.find((option) => option.value === code)?.label ??
    code;
}

/** The refusal shown where the session is offered no write for this request. */
export function UnavailableWrite() {
  const c = useShellContent();
  return <ErrorPanel error={unavailableError(c.unavailable)} />;
}

/**
 * The state a record or request write task exposes to its page: the outcome
 * `TaskFeedback` shows, plus the lock and field errors a form checks before
 * letting the session submit again. Generic over the command's input, so a
 * page can instantiate it against whichever write it hosts.
 */
export interface RecordTaskState<Input> extends TaskFeedbackState {
  locked: boolean;
  fieldErrors: Readonly<Record<string, string>>;
  /** The write was refused because the record changed since it was read. */
  staleConflict?: boolean;
  /** Clears the refusal so the same form can send again. */
  reset?: () => void;
  submit: (input: Input) => Promise<unknown>;
}

/**
 * What checking a pending write found: its own identifier, ready to show as a
 * support reference, and the actions this session has for it. The identifier
 * a fresh check or retry runs against is an implementation detail of the
 * write itself, never a page's own concern, so a page's `useRecovery` hook
 * carries it in under this generic name.
 */
export interface RecoveryOutcome {
  reference: string | null;
  busy: boolean;
  unknown: boolean;
  error: unknown;
  check: () => void;
  retry: () => void;
  leave: () => void;
}

/** The unresolved submission of this session that needs checking. */
export function RecoveryNotice({
  useRecovery,
}: {
  /** Checks a pending write's outcome; a page supplies this over its own host. */
  useRecovery: (
    reference: RecoveryReference,
    options: {
      onSettled: () => void;
      open: (resource: { id: string; entity: string }) => void;
    },
  ) => RecoveryOutcome;
}) {
  const route = useRoute();
  const { reference, settled } = usePendingRecordWrite(route);
  if (!reference) return null;
  return (
    <PendingRecovery
      reference={reference}
      onSettled={settled}
      useRecovery={useRecovery}
    />
  );
}

function PendingRecovery({
  reference,
  onSettled,
  useRecovery,
}: {
  reference: RecoveryReference;
  onSettled: () => void;
  useRecovery: (
    reference: RecoveryReference,
    options: {
      onSettled: () => void;
      open: (resource: { id: string; entity: string }) => void;
    },
  ) => RecoveryOutcome;
}) {
  const shell = useShellContent(),
    pages = usePagesContent(),
    block = useBlockContent(),
    locale = useLocale(),
    routes = useRegisterRoutes(),
    register = useRegister();
  const outcome = useRecovery(reference, {
    onSettled,
    /** A settled write opens on the record it wrote. */
    open(resource) {
      const path =
        register.entities &&
        recordPath(routes, register.entities, resource.entity, resource.id);
      if (path) navigate(path);
    },
  });
  return (
    <Notice tone="warning" title={shell.recoveryTitle}>
      <p>
        {outcome.reference ? pages.recoveryBody : shell.previousContextBody}
      </p>
      {outcome.reference && (
        <p className="reference">
          {fillNodes(
            block.labelled,
            {
              label: block.receipt,
              value: <span className="font-mono">{outcome.reference}</span>,
            },
            locale,
          )}
        </p>
      )}
      <div className="actions">
        {outcome.reference ? (
          <Button
            variant="outline"
            onClick={() => void outcome.check()}
            disabled={outcome.busy}
          >
            {pages.checkOutcome}
          </Button>
        ) : (
          <Button render={<a href={`#${routes.requests}`} />} variant="outline">
            {block.reconcile}
          </Button>
        )}
        {outcome.reference && outcome.unknown && (
          <Button onClick={() => void outcome.retry()} disabled={outcome.busy}>
            {block.exactRetry}
          </Button>
        )}
        <Button variant="ghost" onClick={outcome.leave}>
          {pages.leaveRecovery}
        </Button>
      </div>
      {!!outcome.error && <ErrorPanel error={outcome.error} />}
    </Notice>
  );
}
