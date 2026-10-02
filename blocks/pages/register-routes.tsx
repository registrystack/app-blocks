import { createContext, useContext, type ReactNode } from "react";

/**
 * Where one record entity's pages live. A page block links to an entity's
 * records through these, so a register with several record entities names
 * each one's routes in one place. Paths carry no leading `#`.
 */
export interface EntityRoutes {
  /** The list of the entity's records. */
  records: string;
  /** The form that creates one of them. */
  createRecord: string;
  /** One record's page. */
  record(id: string): string;
  /**
   * The form that invokes one of the registry's governed actions that adds
   * to these records, by action id. An app that names no route for it offers none.
   */
  recordAction?(actionId: string): string;
  /**
   * The form that invokes one of the registry's governed actions on one
   * record, by the record's id and the action id. An app that names no route
   * for it offers none.
   */
  action?(recordId: string, actionId: string): string;
}

/**
 * Where a register's pages live. A page block links to a record or a request
 * through these, never through a path of its own, so an app names its
 * register's routes in one place. Paths carry no leading `#`; a link adds it.
 */
export interface RegisterRoutes {
  /** The list of records. */
  records: string;
  /** The form that creates a record. */
  createRecord: string;
  /** One record's page. */
  record(id: string): string;
  /** The form that asks for a change to one record. */
  changeRecord(id: string): string;
  /**
   * The form that invokes one of the registry's governed actions on these
   * records, by action id. An app that names no route for it offers none.
   */
  recordAction?(id: string): string;
  /**
   * The form that invokes one of the registry's governed actions on one of
   * these records, by the record's id and the action id. An app that names no
   * route for it offers none.
   */
  action?(recordId: string, actionId: string): string;
  /**
   * The routes of any other record entity, by entity id. An app that names
   * none has pages for the register's own record entity only.
   */
  entity?(entity: string): EntityRoutes;
  /** The list of requests. */
  requests: string;
  /** One request's page. */
  request(id: string): string;
  /** The form that edits one request before it is decided. */
  editRequest(id: string): string;
}

/** An entity's routes under `path`; ids are encoded as one segment. */
export function entityRoutesUnder(path: string): EntityRoutes {
  const under = (base: string, id: string) =>
    `${base}/${encodeURIComponent(id)}`;
  return {
    records: path,
    createRecord: `${path}/create`,
    record: (id) => under(path, id),
    recordAction: (actionId) => under(`${path}/actions`, actionId),
    action: (recordId, actionId) =>
      under(`${under(path, recordId)}/actions`, actionId),
  };
}

/**
 * Routes for records under `recordsPath` and requests under `requestsPath`;
 * ids are encoded as one segment. Every other record entity lives under
 * `/entities/<entity>`.
 */
export function registerRoutesUnder(
  recordsPath: string,
  requestsPath: string,
): RegisterRoutes {
  const under = (path: string, id: string) =>
    `${path}/${encodeURIComponent(id)}`;
  return {
    records: recordsPath,
    createRecord: `${recordsPath}/create`,
    record: (id) => under(recordsPath, id),
    changeRecord: (id) => `${under(recordsPath, id)}/change`,
    recordAction: (id) => under(`${recordsPath}/actions`, id),
    action: (recordId, actionId) =>
      under(`${under(recordsPath, recordId)}/actions`, actionId),
    entity: (entity) => entityRoutesUnder(under("/entities", entity)),
    requests: requestsPath,
    request: (id) => under(requestsPath, id),
    editRequest: (id) => `${under(requestsPath, id)}/edit`,
  };
}

/** The generic routes a page block reads when no app has named its own. */
export const registerRoutes: RegisterRoutes = registerRoutesUnder(
  "/records",
  "/requests",
);

const RegisterRoutesContext = createContext<RegisterRoutes>(registerRoutes);

export function RegisterRoutesProvider({
  routes,
  children,
}: {
  routes: RegisterRoutes;
  children: ReactNode;
}) {
  return (
    <RegisterRoutesContext.Provider value={routes}>
      {children}
    </RegisterRoutesContext.Provider>
  );
}

export function useRegisterRoutes(): RegisterRoutes {
  return useContext(RegisterRoutesContext);
}

/** Which of a `RegisterRoutes` value's routes a path stands for, with the id it carries. */
export type RegisterRouteMatch =
  | { kind: "records" }
  | { kind: "createRecord" }
  | { kind: "record"; id: string }
  | { kind: "changeRecord"; id: string }
  | { kind: "recordAction"; id: string }
  | { kind: "action"; id: string; actionId: string }
  | { kind: "requests" }
  | { kind: "request"; id: string }
  | { kind: "editRequest"; id: string }
  | { kind: "none" };

function segmentsOf(path: string): string[] {
  return path.split("/").filter(Boolean);
}

// A path built from a route function for ids no real id could ever equal,
// so each segment it lands on is always the id's own: comparing segment
// counts and every other segment then tells a match from a miss.
const SENTINEL_ID = "\u0000register-route-sentinel\u0000";
const SENTINEL_ENTITY = "\u0000entity-route-sentinel\u0000";
const SENTINEL_ACTION = "\u0000action-route-sentinel\u0000";

/**
 * What each sentinel of `pattern` stood for in `path`, decoded; null off a
 * match. A pattern without a sentinel matches only itself, with no captures.
 */
function matchCaptures(
  pattern: string,
  path: string,
  sentinels: readonly string[],
): Map<string, string> | null {
  const patternSegments = segmentsOf(pattern);
  const pathSegments = segmentsOf(path);
  if (patternSegments.length !== pathSegments.length) return null;
  const captured = new Map<string, string>();
  for (let i = 0; i < patternSegments.length; i++) {
    const sentinel = sentinels.find(
      (item) => encodeURIComponent(item) === patternSegments[i],
    );
    if (sentinel !== undefined)
      captured.set(sentinel, decodeURIComponent(pathSegments[i]));
    else if (patternSegments[i] !== pathSegments[i]) return null;
  }
  return captured;
}

/** Where the sentinel id landed in `pattern`'s segments, matched against `path`'s; null off a match. */
function matchOne(pattern: string, path: string): string | null {
  return matchCaptures(pattern, path, [SENTINEL_ID])?.get(SENTINEL_ID) ?? null;
}

/**
 * Which route of `routes` a path stands for. Every pattern is built by
 * calling `routes`' own functions with a sentinel id, never by assuming a
 * literal segment such as "change" or "edit", so a page composed over this
 * stays correct however an app shapes its own `RegisterRoutes`.
 */
export function matchRegisterRoute(
  routes: RegisterRoutes,
  path: string,
): RegisterRouteMatch {
  if (path === routes.records) return { kind: "records" };
  if (path === routes.createRecord) return { kind: "createRecord" };
  if (path === routes.requests) return { kind: "requests" };
  // A record id is the registry's own identifier, never the word an action
  // route places beside it, so an action form is matched first.
  const actionId = routes.recordAction
    ? matchOne(routes.recordAction(SENTINEL_ID), path)
    : null;
  if (actionId !== null) return { kind: "recordAction", id: actionId };
  const invoked = routes.action
    ? matchCaptures(routes.action(SENTINEL_ID, SENTINEL_ACTION), path, [
        SENTINEL_ID,
        SENTINEL_ACTION,
      ])
    : null;
  if (invoked)
    return {
      kind: "action",
      id: invoked.get(SENTINEL_ID)!,
      actionId: invoked.get(SENTINEL_ACTION)!,
    };
  const changeRecordId = matchOne(routes.changeRecord(SENTINEL_ID), path);
  if (changeRecordId !== null) return { kind: "changeRecord", id: changeRecordId };
  const recordId = matchOne(routes.record(SENTINEL_ID), path);
  if (recordId !== null) return { kind: "record", id: recordId };
  const editRequestId = matchOne(routes.editRequest(SENTINEL_ID), path);
  if (editRequestId !== null) return { kind: "editRequest", id: editRequestId };
  const requestId = matchOne(routes.request(SENTINEL_ID), path);
  if (requestId !== null) return { kind: "request", id: requestId };
  return { kind: "none" };
}

/** Which route of one entity's `EntityRoutes` a path stands for, with the entity and ids it carries. */
export type EntityRouteMatch =
  | { kind: "entityRecords"; entity: string }
  | { kind: "entityCreateRecord"; entity: string }
  | { kind: "entityRecord"; entity: string; id: string }
  | { kind: "entityRecordAction"; entity: string; actionId: string }
  | { kind: "entityAction"; entity: string; id: string; actionId: string }
  | { kind: "none" };

/**
 * Which per-entity route of `routes` a path stands for. As with
 * `matchRegisterRoute`, every pattern comes from `routes`' own functions
 * called with sentinels. The register's own record entity keeps its routes
 * and is matched by `matchRegisterRoute`; this matches `routes.entity`'s.
 */
export function matchEntityRoute(
  routes: RegisterRoutes,
  path: string,
): EntityRouteMatch {
  if (!routes.entity) return { kind: "none" };
  const at = routes.entity(SENTINEL_ENTITY);
  const sentinels = [SENTINEL_ENTITY, SENTINEL_ID, SENTINEL_ACTION];
  const entityOf = (captured: Map<string, string>) =>
    captured.get(SENTINEL_ENTITY)!;
  const invoked = at.action
    ? matchCaptures(at.action(SENTINEL_ID, SENTINEL_ACTION), path, sentinels)
    : null;
  if (invoked)
    return {
      kind: "entityAction",
      entity: entityOf(invoked),
      id: invoked.get(SENTINEL_ID)!,
      actionId: invoked.get(SENTINEL_ACTION)!,
    };
  const listed = at.recordAction
    ? matchCaptures(at.recordAction(SENTINEL_ACTION), path, sentinels)
    : null;
  if (listed)
    return {
      kind: "entityRecordAction",
      entity: entityOf(listed),
      actionId: listed.get(SENTINEL_ACTION)!,
    };
  const created = matchCaptures(at.createRecord, path, sentinels);
  if (created) return { kind: "entityCreateRecord", entity: entityOf(created) };
  const one = matchCaptures(at.record(SENTINEL_ID), path, sentinels);
  if (one)
    return {
      kind: "entityRecord",
      entity: entityOf(one),
      id: one.get(SENTINEL_ID)!,
    };
  const all = matchCaptures(at.records, path, sentinels);
  if (all) return { kind: "entityRecords", entity: entityOf(all) };
  return { kind: "none" };
}
