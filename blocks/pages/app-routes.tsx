import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import type { AuthenticatedSession } from "@registrystack/app-runtime";
import type { DocumentSource } from "@/blocks/documents/document-view";
import type { ChangeRequestTask } from "@/blocks/pages/change-request-form-page";
import type { CreateRecordTask } from "@/blocks/pages/create-record-page";
import type { RemovalOutcome } from "@/blocks/pages/record-attachments";
import {
  matchEntityRoute,
  matchRegisterRoute,
  type EntityRouteMatch,
  type RegisterRouteMatch,
  type RegisterRoutes,
} from "@/blocks/pages/register-routes";
import type { RequestDecisionTask } from "@/blocks/pages/request-detail-page";
import type { UploadOutcome } from "@/blocks/request/attachment-slots";

/** What an app binds into its pages: the task hooks and the PDF opener. */
export interface AppParts {
  useCreateTask: () => CreateRecordTask;
  useChangeTask: () => ChangeRequestTask;
  useRequestTask: () => RequestDecisionTask;
  useUpload: (slot: string) => UploadOutcome;
  useRemoval: (slot: string) => RemovalOutcome;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}

/** What a route's page may read when it is drawn. */
export interface RouteContext extends AppParts {
  session: AuthenticatedSession;
  /** True where the root is about to send the session elsewhere. */
  redirecting: boolean;
}

/**
 * One entry of an app's routes table: the path it answers to and the page it
 * draws. `render` returns `undefined` where the path is not the route's, and
 * a node (possibly `null`) where it is. The first entry that answers wins.
 */
export interface AppRoute {
  id: string;
  render(
    path: string,
    routes: RegisterRoutes,
    context: RouteContext,
  ): ReactNode | undefined;
}

/**
 * A route from a matcher and a page: `match` returns the path's parameters,
 * or `null` where the path is not this route's.
 */
export function route<P>(
  id: string,
  match: (path: string, routes: RegisterRoutes) => P | null,
  page: (params: P, context: RouteContext) => ReactNode,
): AppRoute {
  return {
    id,
    render(path, routes, context) {
      const params = match(path, routes);
      return params === null ? undefined : page(params, context);
    },
  };
}

/**
 * A page that loads on first use. The module keeps exporting its page by name;
 * the route table decides when it is fetched, so an app's first chunk holds the
 * shell and the table, not every page. Draw it inside a `Suspense` boundary.
 */
export function lazyPage<
  K extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  M extends Record<K, ComponentType<any>>,
>(load: () => Promise<M>, name: K): LazyExoticComponent<M[K]> {
  return lazy(async () => ({ default: (await load())[name] }));
}

/** Matches one kind of the register's own paths, with that kind's parameters. */
export function registerPath<K extends RegisterRouteMatch["kind"]>(kind: K) {
  return (path: string, routes: RegisterRoutes) => {
    const match = matchRegisterRoute(routes, path);
    return match.kind === kind
      ? (match as Extract<RegisterRouteMatch, { kind: K }>)
      : null;
  };
}

/** Matches one kind of another record entity's paths, with that kind's parameters. */
export function entityPath<K extends EntityRouteMatch["kind"]>(kind: K) {
  return (path: string, routes: RegisterRoutes) => {
    const match = matchEntityRoute(routes, path);
    return match.kind === kind
      ? (match as Extract<EntityRouteMatch, { kind: K }>)
      : null;
  };
}

/** Matches exactly one path. */
export function exactPath(...paths: string[]) {
  return (path: string) => (paths.includes(path) ? {} : null);
}

/** The page of the first route that answers the path, or `undefined` where none does. */
export function renderRoute(
  table: readonly AppRoute[],
  path: string,
  routes: RegisterRoutes,
  context: RouteContext,
): ReactNode | undefined {
  for (const entry of table) {
    const page = entry.render(path, routes, context);
    if (page !== undefined) return page;
  }
  return undefined;
}

/**
 * The table with the entry of the same id swapped for `replacement`. An id
 * the table does not hold is an error, so a misspelt id cannot silently leave
 * the default page in place.
 */
export function replaceRoute(
  table: readonly AppRoute[],
  replacement: AppRoute,
): AppRoute[] {
  if (!table.some((entry) => entry.id === replacement.id))
    throw new Error(`No route "${replacement.id}" to replace.`);
  return table.map((entry) =>
    entry.id === replacement.id ? replacement : entry,
  );
}

/**
 * One place, or a few, in an app's navigation. `items` returns none where
 * the session has no such place.
 */
export interface NavEntry<Context, Item> {
  id: string;
  items(context: Context): Item[];
}

/**
 * An app's navigation as data: groups of entries, each group drawn between
 * dividers, in order.
 */
export type NavTable<Context, Item> = ReadonlyArray<
  ReadonlyArray<NavEntry<Context, Item>>
>;

/** The groups of items a context gets from a table; a group with no items is dropped. */
export function navGroups<Context, Item>(
  table: NavTable<Context, Item>,
  context: Context,
): Item[][] {
  return table
    .map((group) => group.flatMap((entry) => entry.items(context)))
    .filter((items) => items.length > 0);
}
