import { useState } from "react";
import type {
  RegistryModel,
  ReviewTask,
  ReviewTaskDetail,
} from "@registrystack/app-runtime";
import {
  useModel,
  useRereadOnRefusal,
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
  caseworkPerson,
  caseworkRefusalText,
  Unconfirmed,
} from "@/blocks/casework/shared";
import { ReviewContext } from "@/blocks/casework/review-context";
import { useSubjectReference } from "@/blocks/casework/subject";
import { DecisionPanel, DraftPanel } from "@/blocks/casework/review-decision";
import { NotesPanel } from "@/blocks/casework/review-notes";
import { ClocksPanel, HistoryPanel } from "@/blocks/casework/review-history";
import { ReviewTaskGrants } from "@/blocks/casework/task-grants";
import { BackLink } from "@/blocks/shell/back-link";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { Notice } from "@/blocks/lib/notice";
import { fill } from "@/blocks/lib/format";
import {
  useReviewPageContent,
  type ReviewPageContent,
} from "@/blocks/pages/casework-review-content";

function statusLine(r: ReviewPageContent, task: ReviewTask) {
  if (task.status === "decided") return r.statusDecided;
  if (task.status === "open") return r.statusOpen;
  if (task.heldByYou) return r.statusHeldByYou;
  return task.holder
    ? fill(r.statusHeldBy, { holder: caseworkPerson(task.holder) })
    : r.statusHeldElsewhere;
}

/** The review queue: tasks this officer's Casework profile can see. */
export function CaseworkReviewsPage() {
  const r = useReviewPageContent();
  const queue = useReviewQueue();
  const items = queue.data?.items ?? [];
  return (
    <>
      <PageHeading title={r.queueTitle} description={r.queueDescription} />
      {queue.error ? (
        <ErrorPanel error={queue.error} retry={() => void queue.refetch()} />
      ) : !queue.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="muted">{r.queueEmpty}</p>
      ) : (
        <Table>
          <TableCaption>{r.queueCaption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{r.queueReference}</TableHead>
              <TableHead>{r.queueQueue}</TableHead>
              <TableHead>{r.queueStatus}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((task, index) => (
              <TableRow key={task.taskId}>
                <TableCell>
                  <a
                    className="row-link"
                    href={`#/casework/reviews/${encodeURIComponent(task.taskId)}`}
                  >
                    {fill(r.queueRowName, { number: index + 1 })}
                  </a>
                </TableCell>
                <TableCell>{task.queueLabel}</TableCell>
                <TableCell>{statusLine(r, task)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
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
        <ErrorPanel error={task.error} retry={() => void task.refetch()} />
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
  const subject = useSubjectReference(current, model);
  if (subject.loading) return <Loading />;
  return (
    <>
      <BackLink href="/casework/reviews">{r.back}</BackLink>
      <PageHeading
        eyebrow={current.queueLabel}
        title={
          subject.reference !== undefined
            ? fill(r.taskTitle, { reference: subject.reference })
            : (subject.entity?.label ?? r.taskTitleUnnamed)
        }
        description={statusLine(r, current)}
      />
      <Hold task={current} reread={reread} rereading={rereading} />
      <Context task={current} model={model} />
      <DecisionPanel task={current} reread={reread} rereading={rereading} />
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
        renderError={(error, retry) => (
          <ErrorPanel error={error} retry={retry} />
        )}
      />
      <ReviewTaskGrants
        id={current.taskId}
        revision={current.revision}
        blocked={!current.heldByYou}
      />
    </>
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
  return (
    <section className="review-hold" aria-label={r.statusHeldByYou}>
      {!hold.locked && task.status === "open" && (
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
      {!hold.locked && task.status === "held" && task.heldByYou && (
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
  return <ReviewContext task={task} model={model} />;
}
