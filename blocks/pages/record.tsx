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
import { useBlockContent } from "@/blocks/lib/content";
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
  /** Every record entity the session reads, the register's own among them. */
  records?: readonly EntityModel[];
  /** Every request entity the model names, `request` and `followedRequest` among them. */
  requests?: readonly EntityModel[];
}

/** The record and request entities of a session model, or null when it has no record entity. */
export function registerEntities(
  entities: EntityModel[],
): RegisterEntities | null {
  const requests = entities.filter((entity) => entity.kind === "request");
  const targeted = (entity: EntityModel) =>
    requests.find((request) =>
      request.request?.targets.some((target) => target.entity === entity.id),
    );
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
  return requests.filter((request) =>
    request.request?.targets.some((target) => target.entity === entity),
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
  return (
    entities.requests?.find((request) => request.id === named) ??
    entities.followedRequest
  );
}

/**
 * The entities a work item reads under: the request entity it names, with
 * the record that request targets. An item that names no entity reads under
 * the session's request; one naming an entity the model lacks has no request.
 */
export function workItemEntities(
  entities: EntityModel[],
  sourceEntity: string | undefined,
): RegisterEntities | null {
  const register = registerEntities(entities);
  if (!register || sourceEntity === undefined) return register;
  const request = entities.find(
    (entity) => entity.kind === "request" && entity.id === sourceEntity,
  );
  const record =
    entities.find(
      (entity) =>
        entity.kind === "record" &&
        request?.request?.targets.some((target) => target.entity === entity.id),
    ) ?? register.record;
  return { ...register, record, request };
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
    (entities.followedRequest &&
      entities.requests?.some((request) => request.id === entity))
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
  if (register.error || !register.entities)
    return (
      <ErrorPanel
        error={register.error}
        retry={() => void register.refetch()}
      />
    );
  if (!register.entity)
    return <ErrorPanel error={unavailableError(shell.unavailable)} />;
  return <>{children(register.entities, register.entity)}</>;
}

/**
 * The id of the record a request changes, when that record is one of the
 * register's and the host has not marked it unavailable; "" otherwise, so a
 * read of it stays disabled.
 */
export function readableTarget(
  entities: RegisterEntities,
  request: RequestView | undefined,
): string {
  const target = request?.target;
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

/** The words a record is named by: its title template or title field, or undefined when it has neither. */
export function recordTitle(
  entity: EntityModel,
  record: RecordView,
): string | undefined {
  return entityTitle(entity, (field) => record.values[field.id]);
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
          {block.receipt}:{" "}
          <span className="font-mono">{outcome.reference}</span>
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
