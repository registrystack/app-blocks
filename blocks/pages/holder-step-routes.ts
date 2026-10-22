import { requestRoute, type RegisterEntities } from "@/blocks/pages/record";
import { decodeSegment, type RegisterRoutes } from "@/blocks/pages/register-routes";

/** The step that lists the records a holder may ask to change. */
export const chooseRecordRoute = "/change";

/** The step that lists what can be changed on one record. */
export function chooseChangeRoute(recordId: string): string {
  return `${chooseRecordRoute}/${encodeURIComponent(recordId)}`;
}

/** The step that takes a request's supporting documents. */
export function documentsRoute(
  routes: RegisterRoutes,
  entities: RegisterEntities,
  request: string,
  id: string,
): string {
  return requestRoute(entities, `${routes.request(id)}/documents`, request);
}

/** The step that shows a saved draft for a last check, its submission and its discard. */
export function reviewRoute(
  routes: RegisterRoutes,
  entities: RegisterEntities,
  request: string,
  id: string,
): string {
  return requestRoute(entities, `${routes.request(id)}/review`, request);
}

/** Which holder step a path stands for, with the id it carries. */
export type HolderStepMatch =
  | { kind: "chooseRecord" }
  | { kind: "chooseChange"; id: string }
  | { kind: "documents"; id: string }
  | { kind: "review"; id: string };

// An id no real one equals, so the segment it lands on is always the id's own.
const SENTINEL = "\u0000holder-step-sentinel\u0000";

function segmentsOf(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/**
 * Which holder step a path stands for. The request steps follow the pattern
 * `routes.request` gives, so an app that shapes its own request paths keeps
 * its steps beside them.
 */
export function matchHolderStep(
  routes: RegisterRoutes,
  path: string,
): HolderStepMatch | null {
  const segments = segmentsOf(path);
  const [head, ...rest] = segments;
  if (head === segmentsOf(chooseRecordRoute)[0]) {
    if (rest.length === 0) return { kind: "chooseRecord" };
    if (rest.length !== 1) return null;
    const id = decodeSegment(rest[0]!);
    return id === null ? null : { kind: "chooseChange", id };
  }
  const pattern = segmentsOf(routes.request(SENTINEL));
  const step = segments.at(-1);
  if (
    segments.length !== pattern.length + 1 ||
    (step !== "documents" && step !== "review")
  )
    return null;
  let id: string | undefined;
  for (const [index, segment] of pattern.entries()) {
    if (segment === encodeURIComponent(SENTINEL)) {
      const decoded = decodeSegment(segments[index]!);
      if (decoded === null) return null;
      id = decoded;
    } else if (segment !== segments[index]) return null;
  }
  return id === undefined ? null : { kind: step, id };
}
