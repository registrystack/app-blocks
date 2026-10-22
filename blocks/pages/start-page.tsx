import type {
  RecordActionReference,
  RecordTask,
} from "@registrystack/app-runtime";
import { useModel, useStarts } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/blocks/shell/empty-state";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { BackLink } from "@/blocks/shell/back-link";
import { PageHeading } from "@/blocks/shell/page-heading";
import { useLocale } from "@/blocks/lib/content";
import { createWords, usePagesContent } from "@/blocks/pages/pages-content";
import {
  entityRoutes,
  registerEntities,
  requestRoute,
  UnavailableWrite,
  type RecordTaskState,
} from "@/blocks/pages/record";
import { formRoute } from "@/blocks/pages/record-route-query";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import {
  startActionPath,
  startsPath,
  unlistedStarts,
} from "@/blocks/pages/start-places";
import {
  ActionWriteForm,
  readableRecordPath,
  useFormRoute,
  useOpenedAction,
} from "@/blocks/pages/write-form-core";

/** The write `StartPage` submits: a plain record task, unadapted. */
export type StartTask = RecordTaskState<RecordTask>;

/**
 * What the session may start that no record list offers: a governed action
 * whose result it cannot list, a create of a record type it cannot list, and
 * a request create, which opens the request form of `RegisterRoutes`.
 * Without `actionId` it lists them; with it, it is the form of that action,
 * which needs no entity, so a session that holds only the right to invoke an
 * action still has somewhere to start. What is offered comes from the starts
 * the host serves for the session's own profile; the registry decides each call.
 */
export function StartPage({
  actionId,
  useTask,
}: {
  /** The governed action's id, as the route names it. */
  actionId?: string;
  /** The write the form submits; a page instantiates it over its own host command. */
  useTask: () => StartTask;
}) {
  const starts = useStarts(),
    model = useModel(),
    routes = useRegisterRoutes();
  if (starts.isPending || model.isPending) return <Loading />;
  if (!starts.data)
    return (
      <ErrorPanel error={starts.error} retry={() => void starts.refetch()} />
    );
  if (!model.data)
    return (
      <ErrorPanel error={model.error} retry={() => void model.refetch()} />
    );
  return actionId === undefined ? (
    <StartList
      starts={unlistedStarts(starts.data, model.data.entities, routes)}
    />
  ) : (
    <StartAction actionId={actionId} starts={starts.data} useTask={useTask} />
  );
}

function StartList({ starts }: { starts: readonly RecordActionReference[] }) {
  const pages = usePagesContent(),
    locale = useLocale(),
    routes = useRegisterRoutes(),
    model = useModel().data;
  const entities = model ? registerEntities(model.entities) : null;
  const seen = new Set<string>();
  const links = starts.flatMap((start) => {
    const key = start.name === "invoke" ? start.actionId : start.entity;
    // An action and a create may share an id, so each kind is kept apart.
    const kept = `${start.name}:${key}`;
    if (!key || seen.has(kept)) return [];
    const requested = entities?.requests?.find(
      (entity) => entity.id === start.entity,
    );
    const path =
      start.name === "invoke"
        ? startActionPath(key)
        : entities && requested
          ? routes.createRequest &&
            requestRoute(entities, routes.createRequest, requested.id)
          : entities &&
            entityRoutes(routes, entities, start.entity)?.createRecord;
    if (!path) return [];
    seen.add(kept);
    // A create the registry left unlabelled is worded as the record list
    // words it, and a request create as a record's page words it.
    const created = entities?.records?.find(
      (entity) => entity.id === start.entity,
    );
    const label =
      start.name === "invoke"
        ? (start.label ?? key)
        : requested
          ? createWords(
              pages,
              "requestChangeOf",
              start.label,
              requested.label,
              locale,
            )
          : !created
            ? (start.label ?? key)
            : createWords(
                pages,
                created.id === entities?.record.id
                  ? "createRecord"
                  : "addRecord",
                start.label,
                created.label,
                locale,
              );
    // A record create opened from here leads back here, as an action does.
    const href =
      start.name === "create" && !requested
        ? formRoute(path, {}, undefined, startsPath)
        : path;
    return [{ key: kept, label, href: `#${href}` }];
  });
  return (
    <>
      <PageHeading
        title={pages.startsHeading}
        description={links.length ? pages.startsDescription : undefined}
      />
      {links.length === 0 ? (
        <NothingToStart />
      ) : (
        <div className="actions">
          {links.map((link) => (
            <Button
              key={link.key}
              variant="outline"
              render={<a href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

function StartAction({
  actionId,
  starts,
  useTask,
}: {
  actionId: string;
  starts: readonly RecordActionReference[];
  useTask: () => StartTask;
}) {
  const pages = usePagesContent(),
    routes = useRegisterRoutes(),
    model = useModel().data,
    task = useTask();
  const action = useOpenedAction(
    starts.find((item) => item.name === "invoke" && item.actionId === actionId),
  );
  const fields = (action?.fields ?? []).filter((field) => !field.readOnly);
  const asked = useFormRoute(fields);
  if (!action) return <UnavailableWrite />;
  const entities = model ? registerEntities(model.entities) : null;
  return (
    <>
      <BackLink href={startsPath}>{pages.back}</BackLink>
      <PageHeading
        title={action.label ?? actionId}
        description={pages.actionDescription}
      />
      <ActionWriteForm
        action={action}
        fields={fields}
        preset={asked.preset}
        task={task}
        submitLabel={pages.actionSubmit}
        cancelHref={asked.returnPath ?? startsPath}
        returnPath={asked.returnPath}
        confirmedPath={(resource) =>
          entities ? readableRecordPath(routes, entities, resource) : null
        }
      />
    </>
  );
}

/**
 * Where the session starts nothing: an account that reads records is pointed
 * at the first record type it reads, and any other is told it holds no access
 * this app uses.
 */
function NothingToStart() {
  const pages = usePagesContent(),
    routes = useRegisterRoutes(),
    model = useModel().data;
  const entities = model ? registerEntities(model.entities) : null;
  const readable = entities?.records?.find(
    ({ operations }) => operations.get || operations.list || operations.lookup,
  );
  const place =
    entities && readable && entityRoutes(routes, entities, readable.id);
  return (
    <EmptyState title={pages.startsNothingTitle}>
      {readable && place ? (
        <>
          {pages.startsReadOnlyBody}{" "}
          <a href={`#${place.records}`}>{readable.pluralLabel}</a>.
        </>
      ) : (
        pages.startsNothingBody
      )}
    </EmptyState>
  );
}
