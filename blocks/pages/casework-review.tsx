import { ScrollRegion } from "@/blocks/lib/scroll-region";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  queueFilterRefused,
  reviewQueueColumns,
  reviewQueueFilters,
} from "@registrystack/app-runtime";
import type {
  CaseworkModel,
  RegistryModel,
  ReviewQueueColumn,
  ReviewQueueFilter,
  ReviewTask,
  ReviewTaskDetail,
  ReviewTaskPage,
} from "@registrystack/app-runtime";
import {
  useCommandViewer,
  useModel,
  useNextReviewTask,
  usePendingCommands,
  useRecordsOf,
  useRereadOnRefusal,
  useReviewPolicies,
  useReviewQueue,
  useReviewTask,
  useReviewTaskHold,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import {
  caseworkDateTime,
  caseworkPerson,
  caseworkRefusalText,
  caseworkWaiting,
  caseworkWhen,
  CaseworkWhen,
  Unconfirmed,
} from "@/blocks/casework/shared";
import { ReviewContext } from "@/blocks/casework/review-context";
import { ReviewAssignmentForm } from "@/blocks/casework/staffing";
import { useSubjectReference } from "@/blocks/casework/subject";
import { useReferenceHref } from "@/blocks/fields/reference-value";
import { DecisionPanel, DraftPanel } from "@/blocks/casework/review-decision";
import { NotesPanel } from "@/blocks/casework/review-notes";
import { ClocksPanel, HistoryPanel } from "@/blocks/casework/review-history";
import { ReviewTaskGrants } from "@/blocks/casework/task-grants";
import { WhenProfile } from "@/blocks/pages/casework-landing";
import { BackLink } from "@/blocks/shell/back-link";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { Notice } from "@/blocks/lib/notice";
import { fill } from "@/blocks/lib/format";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { usePagesContent } from "@/blocks/pages/pages-content";
import {
  listableRequests,
  recordPath,
  recordTitle,
  requestRoute,
  useRegister,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import {
  tabCursors,
  useTabCursors,
  type TabCursors,
} from "@/blocks/lib/tab-memory";
import { QueueFilterBar, QueueFilterChips } from "@/blocks/lib/queue-parts";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import {
  useReviewPageContent,
  type ReviewPageContent,
} from "@/blocks/pages/casework-review-content";

/** A task's status: open, in review whoever holds it, or decided. */
function statusWord(r: ReviewPageContent, task: ReviewTask) {
  if (task.status === "decided") return r.statusDecided;
  if (task.status === "open") return r.statusOpen;
  return r.statusInReview;
}

/** Who holds a held task, said on a line of its own beside its status. */
function holderLine(
  r: ReviewPageContent,
  task: ReviewTask,
  locale: string,
): string | undefined {
  if (task.status !== "held") return undefined;
  if (task.heldByYou) return r.statusHeldByYou;
  return task.holder
    ? fill(r.statusHeldBy, { holder: caseworkPerson(task.holder) }, locale)
    : r.statusHeldElsewhere;
}

/** Names the hold region: who holds the task, or its status while no one does. */
function statusLine(r: ReviewPageContent, task: ReviewTask, locale: string) {
  return holderLine(r, task, locale) ?? statusWord(r, task);
}

/** A task's status in the list, with who holds it on a line of its own. */
function TaskStatus({ task }: { task: ReviewTask }) {
  const r = useReviewPageContent();
  const locale = useLocale();
  const holder = holderLine(r, task, locale);
  return (
    <>
      <div>{statusWord(r, task)}</div>
      {holder && <div className="muted">{holder}</div>}
    </>
  );
}

/**
 * When a task falls due, as the queue reads it. A deadline already passed says
 * so in words even on the day it fell, where "today" alone would read the same
 * before and after it.
 */
function TaskDue({ deadlineAt }: { deadlineAt: string | undefined }) {
  const c = useCaseworkContent();
  const locale = useLocale();
  const passedToday =
    deadlineAt !== undefined &&
    Date.parse(deadlineAt) < Date.now() &&
    caseworkWhen(deadlineAt, "due", c, locale)?.tone === "today";
  if (!passedToday) return <CaseworkWhen value={deadlineAt} tense="due" />;
  return (
    <time
      dateTime={deadlineAt}
      title={caseworkDateTime(deadlineAt, locale)}
      className="casework-when casework-when-late"
    >
      {c.stateLabels.overdue}
    </time>
  );
}

/**
 * How long a task has waited since Casework opened it. A task read without a
 * readable opening time leaves the cell blank to the eye and says so to a
 * screen reader; it never reads as just opened.
 */
function TaskWaiting({ createdAt }: { createdAt: string | undefined }) {
  const c = useCaseworkContent();
  const r = useReviewPageContent();
  const locale = useLocale();
  if (!createdAt || Number.isNaN(Date.parse(createdAt)))
    return <span className="sr-only">{r.queueWaitingUnknown}</span>;
  return caseworkWaiting(createdAt, c, locale);
}

/**
 * What a task asks, by the request entity the host joins onto it. A task the
 * host joined to no request, or to one the model does not describe, or read
 * while the model is not, is named only by the generic request word, never by
 * the entity's id.
 */
function requestKind(
  task: ReviewTask,
  model: RegistryModel | undefined,
  generic: string,
) {
  const entity = task.sourceRequestEntity
    ? model?.entities.find(
        (e) => e.kind === "request" && e.id === task.sourceRequestEntity,
      )
    : undefined;
  return entity?.label ?? generic;
}

const REVIEWS_PATH = "/casework/reviews";

/** Where the page stands: the queue and owner it is narrowed to, and its place in the list. */
interface ReviewsView {
  /** The one queue the page reads; every queue when absent. */
  queue?: string;
  /** Whose reviews the page reads; every owner when absent. */
  owner?: Owner;
  cursor?: string;
  page: number;
}

/** The owner choices, and the Casework ownership each reads. */
const OWNERSHIP = {
  mine: "assigned_to_me",
  unassigned: "unclaimed",
} as const;
type Owner = keyof typeof OWNERSHIP;

function parseOwner(value: string | null): Owner | undefined {
  return value === "mine" || value === "unassigned" ? value : undefined;
}

/** The hash query is the only source of truth for the page's view and place. */
function parseQueueView(query: URLSearchParams): ReviewsView {
  const cursor = query.get("cursor") || undefined;
  return {
    queue: query.get("queue") || undefined,
    owner: parseOwner(query.get("owner")),
    cursor,
    // A page number means nothing without the cursor that reached it.
    page: cursor ? Math.max(2, Number(query.get("page")) || 2) : 1,
  };
}

function writeQueueView(view: ReviewsView): string {
  const params = new URLSearchParams();
  if (view.owner) params.set("owner", view.owner);
  if (view.queue) params.set("queue", view.queue);
  if (view.cursor) params.set("cursor", view.cursor);
  if (view.cursor && view.page > 1) params.set("page", String(view.page));
  const search = params.toString();
  return `${REVIEWS_PATH}${search ? `?${search}` : ""}`;
}

/** The cursor stack of the list, separate from every other list's. */
const reviewCursors = tabCursors("casework.reviews.cursors");

/**
 * The id and label of every queue seen on a loaded task in this tab. Casework
 * serves no list of the queues an officer may read, so the queue filter
 * offers the ones the officer's own lists have shown so far.
 */
const seenQueues = new Map<string, string>();

function learnQueues(page: ReviewTaskPage | undefined) {
  for (const task of page?.items ?? []) {
    if (task.queue && task.queueLabel)
      seenQueues.set(task.queue, task.queueLabel);
  }
}

/**
 * Take next opens the task Casework names as next; it never claims it. It is a
 * link while there is a task to open, and a disabled button with the reason
 * beside it while there is not, so the control never disappears from under
 * the officer. When Casework could not answer, Try again asks once more.
 */
function TakeNext({ queue }: { queue: string | undefined }) {
  const r = useReviewPageContent();
  const next = useNextReviewTask(queue);
  const task = next.error ? undefined : next.data;
  const reason = next.isPending
    ? undefined
    : next.error
      ? r.nextUnavailable
      : task
        ? undefined
        : r.nextNone;
  return (
    <div className="casework-next">
      {task ? (
        <Button
          render={
            <a href={`#${REVIEWS_PATH}/${encodeURIComponent(task.taskId)}`} />
          }
        >
          {r.takeNext}
        </Button>
      ) : (
        <Button disabled>{r.takeNext}</Button>
      )}
      {reason && <p className="muted">{reason}</p>}
      {next.error && (
        <Button
          variant="outline"
          size="sm"
          disabled={next.isFetching}
          onClick={() => void next.refetch()}
        >
          {r.nextRetry}
        </Button>
      )}
    </div>
  );
}

/**
 * The columns and filters the UI model chooses for the inbox: a queue's own
 * choice while the list is narrowed to that queue, else the inbox's, else
 * every column Casework serves in a row (the supporting reference is opt-in)
 * and both filters.
 */
function inboxSettings(
  casework: CaseworkModel | undefined,
  queue: string | undefined,
): {
  columns: readonly ReviewQueueColumn[];
  filters: readonly ReviewQueueFilter[];
} {
  const inbox = casework?.inbox;
  const own = queue ? inbox?.queues?.[queue] : undefined;
  return {
    columns:
      own?.columns ??
      inbox?.columns ??
      reviewQueueColumns.filter((column) => column !== "supporting"),
    filters: own?.filters ?? inbox?.filters ?? reviewQueueFilters,
  };
}

/** One page of review tasks. */
function ReviewTaskList({
  read,
  view,
  memory,
  caption,
  empty,
}: {
  read: {
    data?: ReviewTaskPage | undefined;
    error: unknown;
    refetch: () => unknown;
  };
  view: ReviewsView;
  memory: TabCursors;
  caption: string;
  empty: string;
}) {
  const r = useReviewPageContent();
  const locale = useLocale();
  const c = useCaseworkContent();
  const pages = usePagesContent();
  const pagerWords = useBlockContent();
  const model = useModel();
  const columns = inboxSettings(model.data?.casework, view.queue).columns;
  const headings: Record<ReviewQueueColumn, string> = {
    reference: r.queueReference,
    kind: r.queueKind,
    queue: r.queueQueue,
    due: c.due,
    waiting: r.queueWaiting,
    status: r.queueStatus,
    supporting: r.queueSupporting,
  };
  const cursors = useTabCursors(memory, view);
  const previous = cursors.previous;
  const nextCursor = read.data?.nextCursor ?? undefined;
  const items = read.data?.items ?? [];
  const shortfall = read.data?.status
    ? c.caseworkPageStatus[read.data.status]
    : undefined;
  // A count reads as a total only when the whole list is on this page: the
  // first page, not cut short, with nothing after it.
  const whole =
    (read.data?.status ?? "complete") === "complete" &&
    !nextCursor &&
    !view.cursor;
  return (
    <>
      {read.error ? (
        <ErrorPanel error={read.error} retry={() => void read.refetch()} />
      ) : !read.data ? (
        <Loading />
      ) : items.length === 0 ? (
        // A page cut short can be empty and still continue; only the end of
        // the list says nothing is there.
        !nextCursor && <p className="muted">{empty}</p>
      ) : (
        <ScrollRegion
          className="table-wrap casework-reviews"
          label={caption}
        >
          <Table>
            <TableCaption>{caption}</TableCaption>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{headings[column]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((task, index) => {
                const cells: Record<ReviewQueueColumn, ReactNode> = {
                  reference: task.reference?.trim()
                    ? fill(
                        r.queueRowReference,
                        { reference: task.reference },
                        locale,
                      )
                    : fill(r.queueRowName, { number: String(index + 1) }, locale),
                  kind: requestKind(task, model.data, pages.requestTitle),
                  queue: task.queueLabel,
                  due: <TaskDue deadlineAt={task.deadlineAt} />,
                  waiting: <TaskWaiting createdAt={task.createdAt} />,
                  status: <TaskStatus task={task} />,
                  supporting: task.supportingReference,
                };
                return (
                  <TableRow key={task.taskId}>
                    {columns.map((column, position) => (
                      <TableCell key={column}>
                        {position === 0 ? (
                          // The first column is the way into the review, so a
                          // row can always be opened.
                          <a
                            className="row-link"
                            href={`#${REVIEWS_PATH}/${encodeURIComponent(task.taskId)}`}
                          >
                            {cells[column]}
                          </a>
                        ) : (
                          cells[column]
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollRegion>
      )}
      {shortfall && <p className="muted">{shortfall}</p>}
      {!read.error && items.length > 0 && (
        <p className="result-count">
          {whole
            ? fill(r.queueCount, { count: items.length }, locale)
            : fill(r.queueCountOnPage, { count: items.length }, locale)}
        </p>
      )}
      {(previous || nextCursor) && (
        <div className="actions w-auto gap-1">
          {previous && (
            <Button
              render={
                <a
                  href={`#${writeQueueView({ ...previous, queue: view.queue, owner: view.owner })}`}
                  onClick={cursors.back}
                />
              }
              variant="outline"
              size="icon-sm"
            >
              <ChevronLeft aria-hidden="true" />
              <span className="sr-only">{pagerWords.previous}</span>
            </Button>
          )}
          {nextCursor && (
            <Button
              render={
                <a
                  href={`#${writeQueueView({ queue: view.queue, owner: view.owner, cursor: nextCursor, page: view.page + 1 })}`}
                  onClick={() => cursors.next(nextCursor, view.page + 1)}
                />
              }
              variant="outline"
              size="icon-sm"
            >
              <ChevronRight aria-hidden="true" />
              <span className="sr-only">{pagerWords.next}</span>
            </Button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Narrows the list to one queue, from the queues this tab has seen,
 * with a chip naming the one chosen.
 */
function QueueChoice({ view }: { view: ReviewsView }) {
  const r = useReviewPageContent();
  const locale = useLocale();
  const options = [...seenQueues].map(([value, label]) => ({ value, label }));
  if (view.queue && !seenQueues.has(view.queue))
    options.push({ value: view.queue, label: view.queue });
  if (options.length === 0) return null;
  const every = writeQueueView({ owner: view.owner, page: 1 });
  return (
    <>
      <QueueFilterBar
        id="review-queue-filter"
        name="queue"
        label={r.queueQueue}
        value={view.queue ?? ""}
        anyLabel={r.queueAll}
        options={options}
        onApply={(queue) =>
          navigate(
            writeQueueView({
              queue: queue || undefined,
              owner: view.owner,
              page: 1,
            }),
          )
        }
      />
      <QueueFilterChips
        filters={
          view.queue
            ? [
                {
                  name: "queue",
                  label: fill(
                    r.queueChip,
                    { queue: seenQueues.get(view.queue) ?? view.queue },
                    locale,
                  ),
                },
              ]
            : []
        }
        onRemove={() => navigate(every)}
        clearHref={every}
      />
    </>
  );
}

/** Narrows the list to the reviews assigned to this officer, or to those no one holds. */
function OwnerChoice({ view }: { view: ReviewsView }) {
  const r = useReviewPageContent();
  const choices: Array<{ owner: Owner | undefined; label: string }> = [
    { owner: undefined, label: r.ownerAll },
    { owner: "mine", label: r.ownerMine },
    { owner: "unassigned", label: r.ownerUnassigned },
  ];
  return (
    <div
      role="group"
      aria-label={r.ownerLabel}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="muted">{r.ownerLabel}</span>
      {choices.map(({ owner, label }) => {
        const current = view.owner === owner;
        return (
          <Button
            key={label}
            variant={current ? "secondary" : "outline"}
            size="sm"
            render={
              <a
                href={`#${writeQueueView({ queue: view.queue, owner, page: 1 })}`}
                aria-current={current ? "true" : undefined}
              />
            }
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

/** Tasks this officer's Casework profile can see, narrowed by queue and owner. */
function QueueList({ view: asked }: { view: ReviewsView }) {
  const r = useReviewPageContent();
  const model = useModel();
  // A filter the UI model leaves out is neither offered nor read from a link.
  const { filters } = inboxSettings(model.data?.casework, asked.queue);
  const view: ReviewsView = {
    ...asked,
    queue: filters.includes("queue") ? asked.queue : undefined,
    owner: filters.includes("owner") ? asked.owner : undefined,
  };
  // A cursor continues the list it came from, and Casework takes it only with
  // the same filter it was issued under, so the chosen queue and owner go
  // with it.
  const queue = useReviewQueue({
    ...(view.queue ? { queue: view.queue } : {}),
    ...(view.owner ? { ownership: OWNERSHIP[view.owner] } : {}),
    ...(view.cursor ? { cursor: view.cursor } : {}),
  });
  // A link shared by someone whose profile may see more than this session's:
  // Casework refuses the owner it cannot read, and the link falls back to
  // what this session may see, never to an error page.
  const refused = queueFilterRefused(queue.error);
  useEffect(() => {
    if (view.owner && refused)
      location.replace(`#${writeQueueView({ queue: view.queue, page: 1 })}`);
  }, [view.owner, view.queue, refused]);
  if (view.owner && refused) return <Loading />;
  learnQueues(queue.data);
  return (
    <>
      {filters.includes("owner") && <OwnerChoice view={view} />}
      {filters.includes("queue") && <QueueChoice view={view} />}
      <ReviewTaskList
        read={queue}
        view={view}
        memory={reviewCursors}
        caption={r.queueCaption}
        empty={r.queueEmpty}
      />
    </>
  );
}

/** A request kind's list, filtered to the approved requests. */
function approvedQueue(
  entities: RegisterEntities,
  path: string,
  request: string,
): string {
  const split = splitRoute(requestRoute(entities, path, request));
  split.query.set("state", "approved");
  return `${split.path}?${split.query.toString()}`;
}

/**
 * The approved requests waiting to be applied that BReg offers this session
 * the apply of. BReg offers the apply request by request, so nothing here
 * guesses from a profile: a session offered the apply of none sees no
 * section. A page can be short and still have a next, so a partial list says
 * so and points to the request queue.
 */
function ApprovedToApply() {
  const pages = usePagesContent();
  const locale = useLocale();
  const routes = useRegisterRoutes();
  const { entities } = useRegister();
  const readable = entities
    ? listableRequests(entities).filter((request) =>
        request.request?.filterableStates.includes("approved"),
      )
    : [];
  const reads = useRecordsOf(
    readable.map((request) => request.id),
    { state: "approved" },
  ).map((query, index) => ({ request: readable[index]!, query }));
  if (!entities) return null;
  const failed = reads.filter(({ query }) => query.error);
  const items = reads.flatMap(({ request, query }) =>
    (query.data?.items ?? [])
      .filter((item) => item.request?.applyOffered)
      .map((item) => ({ request, item })),
  );
  const partial = reads.find(({ query }) => query.data?.nextCursor);
  if (items.length === 0 && failed.length === 0) return null;
  return (
    <section className="card section-card">
      <h2>{pages.applyWaitingHeading}</h2>
      <div className="section-card-body">
        {items.length > 0 && (
          <ul className="value-list">
            {items.map(({ request, item }) => {
              const path = recordPath(routes, entities, request.id, item.id);
              const title =
                recordTitle(request, item, locale) ?? pages.unnamedRequest;
              return (
                <li key={`${request.id}:${item.id}`}>
                  {path ? (
                    <a className="record-link" href={`#${path}`}>
                      {title}
                    </a>
                  ) : (
                    title
                  )}{" "}
                  <span className="muted">{request.label}</span>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > 0 && partial && (
          <p className="muted">
            {pages.applyWaitingMore}{" "}
            <a
              href={`#${approvedQueue(entities, routes.requests, partial.request.id)}`}
            >
              {pages.applyWaitingQueueLink}
            </a>
          </p>
        )}
        {failed.map(({ request, query }) => (
          <ErrorPanel
            key={request.id}
            error={query.error}
            retry={() => void query.refetch()}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The officer's review tasks: the queue this Casework profile can see, which
 * the owner filter narrows to the officer's own, with Take next above it.
 */
export function CaseworkReviewsPage() {
  const r = useReviewPageContent();
  const view = parseQueueView(splitRoute(useRoute()).query);
  return (
    <WhenProfile profiles={["staff", "supervisor"]}>
      <PageHeading
        title={r.queueTitle}
        description={r.queueDescription}
        action={<TakeNext queue={view.queue} />}
      />
      {/* A queue of its own starts its own cursor stack. */}
      <QueueList key={`${view.owner ?? ""}/${view.queue ?? ""}`} view={view} />
      <ApprovedToApply />
    </WhenProfile>
  );
}

/** A review task: its context, the officer's hold, decision, draft, notes and history. */
export function CaseworkReviewPage({ taskId }: { taskId: string }) {
  const r = useReviewPageContent();
  const task = useReviewTask(taskId);
  // The registry model words a subject of the register; a host that serves
  // none still shows the task, from what the task itself carries.
  const model = useModel();
  if (task.error && !task.data)
    return (
      <>
        <BackLink href="/casework/reviews">{r.back}</BackLink>
        <ErrorPanel
          error={task.error}
          retry={() => void task.refetch()}
          unavailableTitle={r.taskUnavailable}
        />
      </>
    );
  if (!task.data || model.isPending) return <Loading />;
  // Claim, release, draft and decision commands send the task revision; while
  // the task is read again (a saved draft moves it), they wait for the fresh one.
  return (
    <ReviewTaskRead
      current={task.data}
      model={model.data}
      reread={() => void task.refetch()}
      rereading={task.isFetching}
    />
  );
}

/**
 * Leads back to a review task whose decision this tab sent and Casework has
 * not confirmed, from any page but that task's own, which offers the retry
 * itself. A decision only an earlier session could resend names no task, so
 * it has no link.
 */
export function ReviewDecisionPendingNotice() {
  const c = useCaseworkContent();
  const path = splitRoute(useRoute()).path;
  const pending = usePendingCommands(useCommandViewer(), "review-decision");
  const taskHref = (taskId: string) =>
    `/casework/reviews/${encodeURIComponent(taskId)}`;
  const taskId = pending
    .flatMap((entry) =>
      entry.withoutAuthority ? [] : [entry.marker.target.id],
    )
    .find((id) => taskHref(id) !== path);
  if (taskId === undefined) return null;
  return (
    <Notice tone="warning" title={c.unknownTitle}>
      <p>{c.decisionPendingBody}</p>
      <Button render={<a href={`#${taskHref(taskId)}`} />}>
        {c.resumeDecision}
      </Button>
    </Notice>
  );
}

/** The task once read, headed by what names it once that is read too. */
function ReviewTaskRead({
  current,
  model,
  reread,
  rereading,
}: {
  current: ReviewTaskDetail;
  model: RegistryModel | undefined;
  reread: () => void;
  rereading: boolean;
}) {
  const r = useReviewPageContent();
  const locale = useLocale();
  const subject = useSubjectReference(current, model);
  const policy = useReviewPolicies().data?.items.find(
    (item) => item.id === current.policy.id,
  );
  if (subject.loading) return <Loading />;
  return (
    <div className="flex flex-col gap-6 [&_.review-hold]:flex [&_.review-hold]:flex-wrap [&_.review-hold]:items-center [&_.review-hold]:gap-3">
      <BackLink href="/casework/reviews">{r.back}</BackLink>
      <PageHeading
        eyebrow={current.queueLabel}
        title={
          subject.reference === undefined
            ? (subject.entity?.label ?? r.taskTitleUnnamed)
            : subject.entity?.kind === "request"
              ? fill(
                  r.taskTitleKind,
                  { reference: subject.reference, kind: subject.entity.label },
                  locale,
                )
              : fill(r.taskTitle, { reference: subject.reference }, locale)
        }
        description={statusWord(r, current)}
      />
      <Hold task={current} reread={reread} rereading={rereading} />
      <ReviewAssignmentForm
        task={current}
        reread={reread}
        rereading={rereading}
        renderError={(error, retry) => (
          <ErrorPanel error={error} retry={retry} />
        )}
      />
      <Context task={current} model={model} />
      <RequestLink task={current} />
      <DecisionPanel
        task={current}
        stageNames={r.howStageNames}
        reread={reread}
        rereading={rereading}
      />
      {current.heldByYou && current.status === "held" && (
        <DraftPanel
          task={current}
          rereading={rereading}
          renderError={(error, retry) => (
            <ErrorPanel error={error} retry={retry} />
          )}
        />
      )}
      <NotesPanel requestId={current.requestId} />
      <HistoryPanel
        requestId={current.requestId}
        renderError={(error, retry) => (
          <ErrorPanel error={error} retry={retry} />
        )}
      />
      <ClocksPanel
        requestId={current.requestId}
        names={r.howDeadlineNames}
        // This task's own stage reads as its queue unless the page names it;
        // another stage of its policy reads as that stage's queue.
        stages={{
          ...Object.fromEntries(
            (policy?.stages ?? [])
              .filter((stage) => stage.queueLabel)
              .map((stage) => [stage.id, stage.queueLabel]),
          ),
          ...(current.queueLabel
            ? { [current.stageId]: current.queueLabel }
            : {}),
          ...r.howStageNames,
        }}
        renderError={(error, retry) => (
          <ErrorPanel error={error} retry={retry} />
        )}
      />
      {current.heldByYou && (
        <ReviewTaskGrants
          id={current.taskId}
          revision={current.revision}
          blocked={false}
        />
      )}
    </div>
  );
}

function Hold({
  task,
  reread,
  rereading,
}: {
  task: ReviewTaskDetail;
  reread: () => void;
  rereading: boolean;
}) {
  const r = useReviewPageContent();
  const c = useCaseworkContent();
  const locale = useLocale();
  const hold = useReviewTaskHold(task.taskId);
  const [sent, setSent] = useState<"claim" | "release">("claim");
  const state = hold.state;
  // An unconfirmed attempt restored from an earlier page names its operation in its marker.
  const { restoredOperation } = hold;
  const operation =
    restoredOperation !== undefined
      ? restoredOperation === "release"
        ? "release"
        : "claim"
      : sent;
  // The task is read again after a refusal that says it moved on.
  useRereadOnRefusal(state, reread);
  const holder = holderLine(r, task, locale);
  const canClaim = !hold.locked && task.status === "open";
  const canRelease = !hold.locked && task.status === "held" && task.heldByYou;
  const unsettled = state.state === "unknown" || state.state === "recovering";
  // A labelled region with nothing in it reads out as an empty landmark, as
  // it would for a decided task with no hold left to report.
  if (
    !holder &&
    !canClaim &&
    !canRelease &&
    state.state !== "refused" &&
    !unsettled
  )
    return null;
  return (
    <section className="review-hold" aria-label={statusLine(r, task, locale)}>
      {holder && <p>{holder}</p>}
      {canClaim && <p>{r.claimHint}</p>}
      {canClaim && (
        <Button
          disabled={rereading}
          onClick={() => {
            setSent("claim");
            void hold.claim(task);
          }}
        >
          {r.claim}
        </Button>
      )}
      {canRelease && (
        <Button
          variant="outline"
          disabled={rereading}
          onClick={() => {
            setSent("release");
            void hold.release(task);
          }}
        >
          {r.release}
        </Button>
      )}
      {state.state === "refused" && (
        <Notice tone="warning">
          {caseworkRefusalText(c, state.refusal, c.taskNotApplied)}
        </Notice>
      )}
      <Unconfirmed
        command={hold}
        text={operation === "claim" ? r.claimUnconfirmed : r.releaseUnconfirmed}
        retryLabel={operation === "claim" ? r.retryClaim : r.retryRelease}
      />
    </section>
  );
}

function Context({
  task,
  model,
}: {
  task: ReviewTaskDetail;
  model: RegistryModel | undefined;
}) {
  return <ReviewContext task={task} model={model} policyLine={false} />;
}

/**
 * Opens the request the task reviews on the app's own request page, where the
 * reviewer reads what it changes and its supporting documents. Only a task
 * the host joined to a request the caller may read names one, and only an app
 * with a page for that request links it; the page reads it under the
 * caller's own session.
 */
function RequestLink({ task }: { task: ReviewTaskDetail }) {
  const r = useReviewPageContent();
  const hrefOf = useReferenceHref();
  const href =
    task.sourceRequestEntity && task.sourceRequestId
      ? hrefOf(task.sourceRequestEntity, task.sourceRequestId)
      : null;
  if (!href) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2>{r.documentsHeading}</h2>
      <p className="muted">{r.documentsHint}</p>
      <p>
        <Button render={<a href={href} />} variant="outline">
          {r.viewRequest}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Button>
      </p>
    </section>
  );
}
