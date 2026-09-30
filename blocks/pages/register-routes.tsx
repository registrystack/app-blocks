import { createContext, useContext, type ReactNode } from "react";

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
  /** The list of requests. */
  requests: string;
  /** One request's page. */
  request(id: string): string;
  /** The form that edits one request before it is decided. */
  editRequest(id: string): string;
}

/** Routes for records under `recordsPath` and requests under `requestsPath`; ids are encoded as one segment. */
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
  | { kind: "requests" }
  | { kind: "request"; id: string }
  | { kind: "editRequest"; id: string }
  | { kind: "none" };

function segmentsOf(path: string): string[] {
  return path.split("/").filter(Boolean);
}

// A path built from a route function for an id no real id could ever equal,
// so the segment it lands on is always the id's own: comparing segment
// counts and every other segment then tells a match from a miss.
const SENTINEL_ID = "\u0000register-route-sentinel\u0000";

/** Where the sentinel id landed in `pattern`'s segments, matched against `path`'s; null off a match. */
function matchOne(pattern: string, path: string): string | null {
  const patternSegments = segmentsOf(pattern);
  const pathSegments = segmentsOf(path);
  if (patternSegments.length !== pathSegments.length) return null;
  const sentinel = encodeURIComponent(SENTINEL_ID);
  let id: string | null = null;
  for (let i = 0; i < patternSegments.length; i++) {
    if (patternSegments[i] === sentinel) id = decodeURIComponent(pathSegments[i]);
    else if (patternSegments[i] !== pathSegments[i]) return null;
  }
  return id;
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
