import { ScrollRegion } from "@/blocks/lib/scroll-region";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  ReviewTaskStatus,
  SupervisoryReviewTask,
} from "@registrystack/app-runtime";
import { useSupervisoryReviews } from "@registrystack/app-runtime/react";
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
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { tabCursors, useTabCursors } from "@/blocks/lib/tab-memory";
import { WhenProfile } from "@/blocks/pages/casework-landing";
import {
  useReviewPageContent,
  type ReviewPageContent,
} from "@/blocks/pages/casework-review-content";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { splitRoute, useRoute } from "@/blocks/shell/routing";

const TEAM_REVIEWS_PATH = "/casework/team-reviews";
const teamCursors = tabCursors("casework.team-reviews.cursors");

/** Where the list stands: its place, in the hash query. */
interface TeamView {
  cursor?: string;
  page: number;
}

function parseTeamView(query: URLSearchParams): TeamView {
  const cursor = query.get("cursor") || undefined;
  // A page number means nothing without the cursor that reached it.
  return {
    cursor,
    page: cursor ? Math.max(2, Number(query.get("page")) || 2) : 1,
  };
}

function writeTeamView(view: TeamView): string {
  const params = new URLSearchParams();
  if (view.cursor) params.set("cursor", view.cursor);
  if (view.cursor && view.page > 1) params.set("page", String(view.page));
  const search = params.toString();
  return `${TEAM_REVIEWS_PATH}${search ? `?${search}` : ""}`;
}

function stateWord(r: ReviewPageContent, state: ReviewTaskStatus): string {
  switch (state) {
    case "open":
      return r.teamStateOpen;
    case "held":
      return r.teamStateHeld;
    case "decided":
      return r.teamStateDecided;
  }
}

function TeamRow({ row }: { row: SupervisoryReviewTask }) {
  const r = useReviewPageContent();
  return (
    <TableRow>
      <TableCell>{row.queueLabel}</TableCell>
      <TableCell>
        {stateWord(r, row.state)}
        {row.staffingDiagnostic === "no-cover-available" && (
          <span className="muted block">{r.teamNoCover}</span>
        )}
        {row.staffingDiagnostic === "insufficient-distinct-approvers" && (
          <span className="muted block">{r.teamTooFewApprovers}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function TeamReviewsList() {
  const r = useReviewPageContent();
  const locale = useLocale();
  const pagerWords = useBlockContent();
  const view = parseTeamView(splitRoute(useRoute()).query);
  const read = useSupervisoryReviews(view.cursor ? { cursor: view.cursor } : {});
  const cursors = useTabCursors(teamCursors, view);
  const previous = cursors.previous;
  const items = read.data?.items ?? [];
  const nextCursor = read.data?.nextCursor;
  const partial = read.data !== undefined && read.data.status !== "complete";
  return (
    <>
      {read.error ? (
        <ErrorPanel error={read.error} retry={() => void read.refetch()} />
      ) : !read.data ? (
        <Loading />
      ) : items.length === 0 ? (
        // A page cut short can be empty and still continue; only the end of
        // the list says nothing is there.
        !nextCursor && !partial && <p className="muted">{r.teamEmpty}</p>
      ) : (
        <ScrollRegion
          className="table-wrap casework-reviews"
          label={r.teamCaption}
        >
          <Table>
            <TableCaption>{r.teamCaption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{r.teamQueue}</TableHead>
                <TableHead>{r.teamState}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TeamRow key={row.taskId} row={row} />
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      )}
      {partial && <p className="muted">{r.teamPartial}</p>}
      {read.data && items.length > 0 && (
        <p className="result-count">{fill(r.teamCount, { count: items.length }, locale)}</p>
      )}
      {(previous || nextCursor) && (
        <div className="actions w-auto gap-1">
          {previous && (
            <Button
              render={
                <a
                  href={`#${writeTeamView({ cursor: previous.cursor, page: previous.page })}`}
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
                  href={`#${writeTeamView({ cursor: nextCursor, page: view.page + 1 })}`}
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
 * A supervisor's accountability list: every review in the queues they
 * supervise, as Casework's supervision read carries it. A row shows its queue,
 * whether it is open, held or decided, and Casework's own statement that no
 * one is available to take it. The read carries no reviewer, age, due date or
 * stage, so the page shows none, and no row opens a review.
 */
export function CaseworkTeamReviewsPage() {
  const r = useReviewPageContent();
  return (
    <WhenProfile profiles={["supervisor"]}>
      <PageHeading
        title={r.teamTitle}
        description={r.teamDescription}
        action={
          <Button
            variant="outline"
            render={<a href="#/casework/staffing" />}
          >
            {r.teamStaffingLink}
          </Button>
        }
      />
      <TeamReviewsList />
    </WhenProfile>
  );
}
