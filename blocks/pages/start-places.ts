import type {
  EntityModel,
  RecordActionReference,
  RegistryModel,
} from "@registrystack/app-runtime";
import {
  decodeSegment,
  type RegisterRoutes,
} from "@/blocks/pages/register-routes";

/** The place that lists what a session may start, and the form of each invoke start under it. */
export const startsPath = "/start";

/** The form of one governed action started with no record. */
export function startActionPath(actionId: string): string {
  return `${startsPath}/${encodeURIComponent(actionId)}`;
}

/** The action a start route names, `{}` for the list of starts; null off a start route. */
export function matchStartRoute(path: string): { actionId?: string } | null {
  if (path === startsPath) return {};
  const parts = path.split("/").filter(Boolean).map(decodeSegment);
  return parts.length === 2 && parts[0] === "start" && parts[1] !== null
    ? { actionId: parts[1] }
    : null;
}

/** Whether the session may list the records of any record entity it is offered. */
export function listsRecords(entities: readonly EntityModel[]): boolean {
  return entities.some(
    (entity) => entity.kind === "record" && entity.operations.list === true,
  );
}

/**
 * The starts no record list offers that the start place has a form for: an
 * action whose result is not a record entity the session lists, a create of a
 * record entity it cannot list, and any request create. No list of requests
 * offers a start, so a request create is offered here: one that only creates,
 * and one whose record the host leaves to be picked on its form because the
 * session may list that record but not open its page. A request create is kept
 * only where the app names the form it opens (`createRequest` of `routes`),
 * and only where the model holds a record entity, which the request form and
 * the request pages a send lands on are read through.
 */
export function unlistedStarts(
  starts: readonly RecordActionReference[],
  entities: readonly EntityModel[],
  routes: Pick<RegisterRoutes, "createRequest"> = {},
): RecordActionReference[] {
  return starts.filter((start) => {
    const entity = entities.find((candidate) => candidate.id === start.entity);
    const record = entity?.kind === "record";
    const listed = record && entity.operations.list === true;
    if (start.name === "invoke") return !listed;
    if (entity?.kind === "request")
      return (
        routes.createRequest !== undefined &&
        entities.some((candidate) => candidate.kind === "record")
      );
    return record && !listed;
  });
}

/**
 * Whether the start place is where a session opens: it has no home list and
 * can list no record, and the start place offers it a start, or it can list
 * nothing at all and has no entity or only starts the start place has no form
 * for. The start place words that as an empty state rather than a failed page.
 * Where the starts could not be read (`failed`), it opens there too, so the
 * failure shows with a retry instead of a list the session would be refused.
 * `routes` decides whether a request create has a form, as for `unlistedStarts`.
 */
export function opensOnStarts(
  model: RegistryModel | undefined,
  starts: readonly RecordActionReference[] | undefined,
  failed = false,
  routes: Pick<RegisterRoutes, "createRequest"> = {},
): boolean {
  if (!model || model.home || listsRecords(model.entities)) return false;
  if (failed) return true;
  const held = starts ?? [];
  if (unlistedStarts(held, model.entities, routes).length > 0) return true;
  const listsNothing = !model.entities.some(
    (entity) => entity.operations.list === true,
  );
  return listsNothing && (model.entities.length === 0 || held.length > 0);
}
