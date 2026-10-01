import { useState, type ReactNode } from "react";
import { notAuthorized, problemView, type ReviewHistoryEntry } from "@registrystack/app-runtime";
import {
  useAuthority,
  useReviewAccountability,
  useReviewClocks,
  useReviewHistory,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useCaseworkContent, type CaseworkContent } from "@/blocks/casework/casework-content";
import { caseworkDateTime, caseworkPerson, Loading } from "@/blocks/casework/shared";
import { fill } from "@/blocks/lib/format";

/**
 * What has happened on a request, and the clocks running against it. Each
 * panel fetches its own data from the request id; a read error is rendered by
 * the caller, which knows how the app shows a failed read.
 */

const unknownHistoryKinds = new Set<string>();
/** What a history entry's kind reads as; a kind with no words warns once and reads as the fallback. */
function useHistoryKind(): (kind: string) => string {
  const c = useCaseworkContent();
  return (kind) => {
    const words = Object.hasOwn(c.historyKinds, kind)
      ? c.historyKinds[kind]
      : undefined;
    if (words === undefined && !unknownHistoryKinds.has(kind)) {
      unknownHistoryKinds.add(kind);
      console.warn(`No content label for history kind "${kind}"; using the fallback.`);
    }
    return words ?? c.historyUnknownKind;
  };
}

/** What a failed read of who decided says: a supervisor's reading only, or no such record, or the problem itself. */
export function accountabilityErrorText(c: CaseworkContent, error: Error) {
  if (notAuthorized(error)) return c.accountabilityUnavailable;
  if (problemView(error).kind === "unavailable") return c.accountabilityNotFound;
  return error.message;
}

function Accountability({ entry }: { entry: ReviewHistoryEntry }) {
  const c = useCaseworkContent();
  const [asked, setAsked] = useState(false);
  const record = useReviewAccountability(entry.eventId, asked);
  if (!asked)
    return (
      <Button variant="ghost" size="sm" onClick={() => setAsked(true)}>
        {c.whoDecided}
      </Button>
    );
  if (record.error)
    return (
      <span className="muted">
        {accountabilityErrorText(c, record.error)}
      </span>
    );
  if (!record.data) return <Loading />;
  return (
    <span>
      {fill(c.accountabilityLine, {
        person: caseworkPerson(record.data.actor),
        profile: record.data.profileId,
        decision: record.data.decision,
      })}
    </span>
  );
}

/** What has happened on a request: its own history, decided entries named to whoever a supervisor may ask. */
export function HistoryPanel({
  requestId,
  renderError,
}: {
  requestId: string;
  /** Renders the history's own read error in place of its entries. */
  renderError: (error: unknown, retry: () => void) => ReactNode;
}) {
  const c = useCaseworkContent();
  const session = useAuthority();
  const kindWords = useHistoryKind();
  const history = useReviewHistory(requestId);
  const entries = history.data ?? [];
  let body: ReactNode;
  if (history.error && !history.data)
    body = renderError(history.error, () => void history.refetch());
  else if (!history.data) body = <Loading />;
  else if (entries.length === 0)
    body = <p className="muted">{c.historyEmpty}</p>;
  else
    body = (
      <ol className="review-history">
        {entries.map((entry) => (
          <li key={entry.eventId}>
            <span>{kindWords(entry.kind)}</span>
            {entry.byYou && <span> {c.historyByYou}</span>}
            <span className="muted"> {caseworkDateTime(entry.occurredAt)}</span>
            {entry.kind === "review_decided" &&
              session.caseworkProfile === "supervisor" && (
                <>
                  {" "}
                  <Accountability entry={entry} />
                </>
              )}
          </li>
        ))}
      </ol>
    );
  return (
    <section>
      <h2>{c.historyHeading}</h2>
      {body}
      {history.hasNextPage && (
        <Button
          variant="outline"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {c.historyMore}
        </Button>
      )}
    </section>
  );
}

/** The service clocks running against a request, and what they answer. */
export function ClocksPanel({
  requestId,
  renderError,
}: {
  requestId: string;
  /** Renders the clocks' own read error in place of the list. */
  renderError: (error: unknown, retry: () => void) => ReactNode;
}) {
  const c = useCaseworkContent();
  const clocks = useReviewClocks(requestId);
  return (
    <section>
      <h2>{c.clocksHeading}</h2>
      {clocks.error ? (
        renderError(clocks.error, () => void clocks.refetch())
      ) : !clocks.data ? (
        <Loading />
      ) : clocks.data.length === 0 ? (
        <p className="muted">{c.clocksEmpty}</p>
      ) : (
        <ul>
          {clocks.data.map((clock, index) => (
            <li key={clock.clockOccurrenceId}>
              {fill(c.clockName, { number: index + 1 })}:{" "}
              {c.clockStates[clock.state] ?? clock.state}
              {clock.dueAt &&
                ` ${fill(c.clockDue, { time: caseworkDateTime(clock.dueAt) })}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
