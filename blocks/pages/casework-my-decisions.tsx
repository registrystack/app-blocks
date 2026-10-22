import { ScrollRegion } from "@/blocks/lib/scroll-region";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { problemView } from "@registrystack/app-runtime";
import { useOwnReviewDecisions } from "@registrystack/app-runtime/react";
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
import { caseworkDateTime, Notice } from "@/blocks/casework/shared";
import { fill } from "@/blocks/lib/format";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { tabCursors, useTabCursors } from "@/blocks/lib/tab-memory";
import { WhenProfile } from "@/blocks/pages/casework-landing";
import { useReviewPageContent } from "@/blocks/pages/casework-review-content";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";

const DECISIONS_PATH = "/casework/decisions";
const decisionCursors = tabCursors("casework.decisions.cursors");

interface DecisionsView {
  cursor?: string;
  page: number;
}

function parseDecisionsView(query: URLSearchParams): DecisionsView {
  const cursor = query.get("cursor") || undefined;
  // A page number means nothing without the cursor that reached it.
  return {
    cursor,
    page: cursor ? Math.max(2, Number(query.get("page")) || 2) : 1,
  };
}

function writeDecisionsView(view: DecisionsView): string {
  const params = new URLSearchParams();
  if (view.cursor) params.set("cursor", view.cursor);
  if (view.cursor && view.page > 1) params.set("page", String(view.page));
  const search = params.toString();
  return `${DECISIONS_PATH}${search ? `?${search}` : ""}`;
}

function DecisionsList() {
  const r = useReviewPageContent();
  const pagerWords = useBlockContent();
  const locale = useLocale();
  const view = parseDecisionsView(splitRoute(useRoute()).query);
  const read = useOwnReviewDecisions(view.cursor ? { cursor: view.cursor } : {});
  const cursors = useTabCursors(decisionCursors, view);
  const previous = cursors.previous;
  const items = read.data?.items ?? [];
  const nextCursor = read.data?.nextCursor;
  const partial = read.data !== undefined && read.data.status !== "complete";
  const expired = problemView(read.error).code === "review.result-expired";

  /** Reads the first page again, withholding what an earlier read cached. */
  function reset() {
    // Reset before the route remounts, so a refused continuation cannot show
    // cached decisions while the fresh first page is pending.
    void read.resetFirstPage({});
    cursors.restart();
  }
  function restart() {
    reset();
    navigate(writeDecisionsView({ page: 1 }));
  }

  return (
    <>
      {read.error ? (
        expired && view.cursor ? (
          <Notice>
            <p>{r.decisionsPositionExpired}</p>
            <Button
              variant="outline"
              render={
                <a
                  href={`#${writeDecisionsView({ page: 1 })}`}
                  onClick={reset}
                />
              }
            >
              {r.decisionsFirstPage}
            </Button>
          </Notice>
        ) : (
          <ErrorPanel
            error={read.error}
            retry={() => (view.cursor ? restart() : void read.refetch())}
          />
        )
      ) : !read.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <section>
          <h2>
            {partial || nextCursor ? r.decisionsEmptyPage : r.decisionsEmpty}
          </h2>
          <p className="muted">
            {nextCursor
              ? r.decisionsNextPageHint
              : partial
                ? r.decisionsPartial
                : r.decisionsEmptyHint}
          </p>
        </section>
      ) : (
        <ScrollRegion
          className="table-wrap casework-reviews"
          label={r.decisionsCaption}
        >
          <Table>
            <TableCaption>{r.decisionsCaption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{r.decisionsOutcome}</TableHead>
                <TableHead>{r.decisionsDecidedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                // The outcome is the label the decision's pinned policy
                // names, never a word inferred from a code.
                const outcome =
                  row.decisionReceipt.outcomeLabel?.trim() ||
                  r.decisionsOutcomeUnavailable;
                const when = caseworkDateTime(
                  row.decisionReceipt.decidedAt,
                  locale,
                );
                return (
                  <TableRow key={row.taskId}>
                    <TableCell>
                      <a
                        className="row-link"
                        href={`#/casework/reviews/${encodeURIComponent(row.taskId)}`}
                        aria-label={fill(
                          r.decisionsRowName,
                          { outcome, time: when },
                          locale,
                        )}
                      >
                        {outcome}
                      </a>
                    </TableCell>
                    <TableCell>
                      <time dateTime={row.decisionReceipt.decidedAt}>{when}</time>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollRegion>
      )}
      {partial && items.length > 0 && <p className="muted">{r.decisionsPartial}</p>}
      {read.data && !read.error && items.length > 0 && (
        <p className="result-count">{fill(r.decisionsCount, { count: items.length }, locale)}</p>
      )}
      {!read.error && (previous || nextCursor) && (
        <div className="actions w-auto gap-1">
          {previous && (
            <Button
              render={
                <a
                  href={`#${writeDecisionsView({ cursor: previous.cursor, page: previous.page })}`}
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
                  href={`#${writeDecisionsView({ cursor: nextCursor, page: view.page + 1 })}`}
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
 * The reviews the signed-in officer has decided, from Casework's own
 * decisions read: each with the outcome label its pinned policy names, its
 * queue and when it was decided. A decided review stays here, with its
 * history and notes, after the approved change is applied. The keyed
 * requester reference the read carries is never shown.
 */
export function CaseworkMyDecisionsPage() {
  const r = useReviewPageContent();
  return (
    <WhenProfile profiles={["staff", "supervisor"]}>
      <PageHeading title={r.decisionsTitle} description={r.decisionsDescription} />
      <DecisionsList />
    </WhenProfile>
  );
}
