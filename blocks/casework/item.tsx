import { useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import {
  problemView,
  refusalDetail,
  type CaseworkHistoryEntry,
  type CaseworkWorkItem,
} from "@registrystack/app-runtime";
import {
  useCaseworkDraftWrite,
  useCaseworkHistory,
  useRereadOnRefusal,
  type useWorkItemCommand,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import {
  CaseworkDue,
  CaseworkPerson,
  CaseworkReference,
  Loading,
  Notice,
  caseworkHolder,
  caseworkPerson,
  caseworkWhenPhrase,
} from "@/blocks/casework/shared";
import { fill } from "@/blocks/lib/format";

/**
 * The read-only rail, the trail, the private notes, the confirm step and the
 * write outcome of one Casework work item. The page frame around them (the
 * header, the pager, the claim and assign actions, and what is proposed and
 * why) reads fields a record model resolves and stays with the app that owns
 * that model.
 */

/** The wall clock, to the minute, in the reader's own zone. */
function clockTime(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/**
 * The officer's private notes for one item. They save themselves when typing
 * pauses, and only when the text differs from what was last saved. The
 * component is keyed by item id at the call site, so the text, the saved text
 * and the item revision it writes against all come from one item's draft and
 * can never be carried to another.
 */
export function PrivateNotes({
  id,
  blocked,
  afterWrite,
  renderError,
}: {
  id: string;
  blocked: boolean;
  afterWrite: () => Promise<unknown>;
  /** Renders the draft's own read error in place of the notes field. */
  renderError: (error: unknown, retry: () => void) => ReactNode;
}) {
  const c = useCaseworkContent();
  const notes = useCaseworkDraftWrite(id, { blocked, afterWrite });
  const { draft, text, savedText, pending, error } = notes;
  const savedAt = notes.savedAt && clockTime(notes.savedAt);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function discard() {
    if (await notes.discard()) setConfirmingDelete(false);
  }

  return (
    <section className="casework-notes">
      <h2>{c.caseworkNotesHeading}</h2>
      <p className="muted">{c.privateDraftHint}</p>
      {draft.isPending ? (
        <Loading />
      ) : draft.error ? (
        renderError(draft.error, () => void draft.refetch())
      ) : (
        <>
          <div className="field">
            <label htmlFor="casework-draft">{c.privateDraftLabel}</label>
            <Textarea
              id="casework-draft"
              rows={4}
              maxLength={4096}
              value={text ?? ""}
              disabled={blocked}
              onChange={(event) => {
                notes.edit(event.target.value);
                setConfirmingDelete(false);
              }}
            />
          </div>
          <div className="notes-status">
            {savedAt && !pending && (
              <p className="muted" role="status">
                {fill(c.caseworkNotesSaved, { time: savedAt })}
              </p>
            )}
            {error !== null && (
              <>
                <p className="field-error-message" role="alert">
                  {c.caseworkNotesFailed}
                </p>
                {problemView(error).message !== null && (
                  <p className="muted">{problemView(error).message}</p>
                )}
              </>
            )}
            {!!savedText && (
              <Button
                type="button"
                variant="outline"
                disabled={blocked || pending}
                onClick={() => setConfirmingDelete(true)}
              >
                {c.deletePrivateDraft}
              </Button>
            )}
          </div>
          {confirmingDelete && (
            <Notice tone="warning" title={c.deletePrivateDraftTitle}>
              <p>{c.deletePrivateDraftBody}</p>
              <div className="actions">
                <Button
                  type="button"
                  disabled={blocked || pending}
                  onClick={() => void discard()}
                >
                  {c.confirmDeletePrivateDraft}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={blocked || pending}
                  onClick={() => setConfirmingDelete(false)}
                >
                  {c.keepPrivateDraft}
                </Button>
              </div>
            </Notice>
          )}
        </>
      )}
    </section>
  );
}

/** One history entry as a sentence; references stay behind the disclosure. */
function HistoryLine({ entry }: { entry: CaseworkHistoryEntry }) {
  const c = useCaseworkContent();
  // Casework names a closed set of actions and the host maps every kind into
  // it, so the line is always words: the operation when these words name one,
  // the action otherwise, and the words for an action nothing here describes.
  const what =
    (entry.operation
      ? c.caseworkHistoryOperations[entry.operation]
      : undefined) ??
    c.caseworkHistoryActions[entry.action] ??
    c.caseworkHistoryActions.other;
  const when = caseworkWhenPhrase(entry.occurredAt, c);
  // An account Casework has no display name for reads as neutral words; its
  // subject stays on the entry's actorPrincipal.
  const actor =
    entry.actorPrincipal && !entry.actorPrincipal.displayName?.trim()
      ? c.caseworkHistoryUnnamedActor
      : entry.actor;
  return (
    <li>
      <p>
        {entry.reason
          ? fill(c.caseworkHistoryLineWithReason, {
              actor,
              what,
              when,
              reason: entry.reason,
            })
          : fill(c.caseworkHistoryLine, { actor, what, when })}
      </p>
      {entry.attemptReference && (
        <details>
          <summary>{c.caseworkHistoryDetails}</summary>
          <p className="reference">
            {fill(c.caseworkAttemptLine, { reference: entry.attemptReference })}
          </p>
        </details>
      )}
    </li>
  );
}

/**
 * What has happened on one item: an ordered trail of entries, oldest first,
 * paged as Casework returns it. The heading and the empty-list message name
 * the trail in the app's own words, so they come from the caller.
 */
export function CaseHistory({
  id,
  announce,
  heading,
  emptyMessage,
  renderError,
}: {
  id: string;
  announce: (message: string) => void;
  heading: ReactNode;
  emptyMessage: ReactNode;
  /** Renders a read or a continuation error in place of what it interrupted. */
  renderError: (error: unknown, retry: () => void) => ReactNode;
}) {
  const c = useCaseworkContent();
  const history = useCaseworkHistory(id);
  // What Casework said about the page it returned, whether or not entries came
  // with it: a shortfall on a page that has entries is the one an officer is
  // most likely to read past.
  const shortfall = history.pageStatus
    ? c.caseworkPageStatus[history.pageStatus]
    : undefined;
  async function loadMore() {
    const loaded = await history.fetchNextPage();
    if (loaded.isError) return;
    const count =
      loaded.data?.pages.reduce(
        (total, page) => total + page.items.length,
        0,
      ) ?? 0;
    announce(
      count === 1
        ? c.caseworkOneEntryShown
        : fill(c.caseworkEntriesShown, { count }),
    );
  }
  return (
    <section>
      <h2>{heading}</h2>
      {history.isPending ? (
        <Loading />
      ) : history.error ? (
        renderError(history.error, () => void history.refetch())
      ) : history.data?.length ? (
        <ol className="history-list">
          {history.data.map((entry) => (
            <HistoryLine key={entry.id} entry={entry} />
          ))}
        </ol>
      ) : (
        <p>{emptyMessage}</p>
      )}
      {shortfall && <p className="muted">{shortfall}</p>}
      {history.continuationError &&
        renderError(history.continuationError, () => void history.fetchNextPage())}
      {history.hasNextPage && (
        <div className="actions">
          <Button
            variant="outline"
            disabled={history.isFetchingNextPage}
            onClick={() => void loadMore()}
          >
            {c.caseworkLoadMoreHistory}
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * The rail of read-only facts that explain why the officer has this item:
 * who holds it, who assigned it, the queue and due date, the clock, the
 * routing that sent it here, and the two references an officer quotes when
 * they talk about it elsewhere. It heads the column beside the decision,
 * above the trail.
 */
export function ItemRail({
  item,
  announce,
}: {
  item: CaseworkWorkItem;
  announce: (message: string) => void;
}) {
  const c = useCaseworkContent();
  const routing = item.routing;
  const assignment = item.assignment;
  const clock = item.clock;

  async function copySupportRef() {
    try {
      await navigator.clipboard.writeText(item.id);
      announce(c.copied);
    } catch {
      announce(c.copyFailed);
    }
  }

  return (
    <aside className="item-rail" aria-label={c.railHeading}>
      <dl className="facts">
        <div className="definition">
          <dt>{c.railHolder}</dt>
          <dd>
            <p>
              {item.heldSince
                ? fill(c.heldSinceLine, {
                    holder: caseworkHolder(item, c),
                    time: caseworkWhenPhrase(item.heldSince, c),
                  })
                : caseworkHolder(item, c)}
            </p>
          </dd>
        </div>
        {assignment &&
          (assignment.owner ||
            assignment.assignedBy ||
            assignment.staffingDiagnostic === "no-cover-available") && (
            <div className="definition">
              <dt>{c.railAssignedBy}</dt>
              <dd>
                {assignment.owner && (
                  <p>
                    <CaseworkPerson
                      person={assignment.owner}
                      name={fill(
                        assignment.absenceCover
                          ? c.caseworkCoveringFor
                          : c.caseworkAssignedTo,
                        { owner: caseworkPerson(assignment.owner) },
                      )}
                    />
                  </p>
                )}
                {assignment.assignedBy && (
                  <p>
                    <CaseworkPerson
                      person={assignment.assignedBy}
                      name={fill(c.caseworkAssignedBy, {
                        person: caseworkPerson(assignment.assignedBy),
                      })}
                    />
                  </p>
                )}
                {assignment.staffingDiagnostic === "no-cover-available" && (
                  <p className="muted">{c.caseworkNoCoverAvailable}</p>
                )}
              </dd>
            </div>
          )}
        <div className="definition">
          <dt>{c.railQueue}</dt>
          <dd>{item.queueLabel}</dd>
        </div>
        <div className="definition">
          <dt>{c.railDue}</dt>
          <dd>
            <CaseworkDue
              includeLabel={false}
              dueAt={item.dueAt}
              dueState={item.dueState}
            />
          </dd>
        </div>
        {clock && (
          <div className="definition">
            <dt>{c.railClock}</dt>
            <dd>
              {clock.atRiskAt && (
                <p className="muted">
                  {fill(c.caseworkAtRiskAt, {
                    when: caseworkWhenPhrase(clock.atRiskAt, c),
                  })}
                </p>
              )}
              {clock.state !== "running" && (
                <p>{c.caseworkClockStates[clock.state]}</p>
              )}
              {clock.upcomingEffects.length > 0 && (
                <>
                  <p>{c.caseworkWhatHappensNext}</p>
                  <ul>
                    {clock.upcomingEffects.map((effect, index) => (
                      <li key={`${effect.kind}-${effect.at}-${index}`}>
                        {effect.kind === "reminder"
                          ? fill(c.caseworkReminderAt, {
                              when: caseworkWhenPhrase(effect.at, c),
                            })
                          : fill(c.caseworkReassignAt, {
                              when: caseworkWhenPhrase(effect.at, c),
                              queue: effect.queueLabel,
                              because: effect.because,
                            })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </dd>
          </div>
        )}
        {routing &&
          (routing.ruleId || routing.because || routing.policyDigest) && (
            <div className="definition">
              <dt>{c.railRoutedBy}</dt>
              <dd>
                {/* Why this item is here is the sentence an officer reads, so
                    it is the line that stands. The rule that produced it and
                    the policy Casework was applying are what support quotes,
                    and they wait behind the disclosure. */}
                {routing.because ? (
                  <p>
                    {fill(c.caseworkRoutedBecauseOnly, {
                      because: routing.because,
                    })}
                  </p>
                ) : routing.ruleId ? (
                  <p>{fill(c.caseworkRoutedBy, { rule: routing.ruleId })}</p>
                ) : (
                  <p>{c.caseworkRoutedNoRule}</p>
                )}
                {(routing.policyDigest ||
                  (routing.because && routing.ruleId)) && (
                  <details>
                    <summary>{c.railRoutingDetails}</summary>
                    {routing.because && routing.ruleId && (
                      <p>
                        {fill(c.caseworkRoutedBy, { rule: routing.ruleId })}
                      </p>
                    )}
                    {routing.policyDigest && (
                      <p className="muted">
                        {fill(c.caseworkRoutingPolicy, {
                          digest: routing.policyDigest.slice(0, 12),
                        })}
                      </p>
                    )}
                  </details>
                )}
              </dd>
            </div>
          )}
        <div className="definition">
          <dt>{c.railSourceRef}</dt>
          <dd>
            <CaseworkReference item={item} />
          </dd>
        </div>
        <div className="definition">
          <dt>{c.railSupportRef}</dt>
          <dd className="item-support-ref">
            <span className="font-mono">{item.id}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={c.copy}
              onClick={() => void copySupportRef()}
            >
              <Copy size={14} aria-hidden="true" />
            </Button>
          </dd>
        </div>
      </dl>
    </aside>
  );
}

/**
 * The confirm step for one item action, the panel a decide control opens.
 * The label an app gives the action, and the sentence explaining it, are
 * register-specific and come from the caller; this panel only lays them out
 * and never disables its own buttons (see the comment inside).
 */
export function ApplyPanel({
  actionLabel,
  description,
  sending,
  onConfirm,
  onCancel,
}: {
  actionLabel: string;
  description: ReactNode;
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = useCaseworkContent();
  return (
    <div className="decide-panel">
      <h2>{actionLabel}</h2>
      <p className="muted">{description}</p>
      <div className="actions">
        {/*
         * These buttons are never given the native `disabled` attribute:
         * disabling the button that currently has focus forces the browser to
         * blur it, and Base UI's popover reads that blur as focus leaving the
         * popup and dismisses it. Both guard against a send in flight instead.
         */}
        <Button
          onClick={() => {
            if (!sending) onConfirm();
          }}
        >
          {actionLabel}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (!sending) onCancel();
          }}
        >
          {c.cancel}
        </Button>
      </div>
    </div>
  );
}

/**
 * What became of the officer's last write on this item. An unconfirmed write
 * is resent only when the officer asks, as the same attempt; when a resend is
 * refused in a way that cannot settle it, the officer may stop waiting, which
 * gives the attempt up explicitly. The wording for a confirmed or an
 * unconfirmed apply names a register-specific effect and comes from the
 * caller; every other outcome is generic and reads from `CaseworkContent`.
 */
export function WorkItemOutcome({
  command,
  operation,
  reread,
  appliedMessage,
  applyUnconfirmedMessage,
}: {
  command: ReturnType<typeof useWorkItemCommand>;
  operation: string | undefined;
  reread: () => void;
  /** Shown once a confirmed write applied the pending change. */
  appliedMessage: string;
  /** Shown when an apply could not be confirmed. */
  applyUnconfirmedMessage: string;
}) {
  const c = useCaseworkContent();
  const state = command.state;
  // The item is read again after a refusal that says it moved on.
  useRereadOnRefusal(state, reread);
  if (state.state === "recovering") return <Notice>{c.checking}</Notice>;
  if (state.state === "confirmed") {
    if (command.actionsUnavailable)
      return (
        <Notice tone="warning">
          <p>{c.caseworkActionsUnavailable}</p>
          <div className="actions">
            <Button
              variant="outline"
              onClick={() => {
                command.dismiss();
                reread();
              }}
            >
              {c.caseworkReadItemAgain}
            </Button>
          </div>
        </Notice>
      );
    return operation === "apply" ? (
      <Notice tone="success">{appliedMessage}</Notice>
    ) : null;
  }
  if (state.state === "refused")
    return (
      <Notice tone="warning" title={c.caseworkRefusedTitle}>
        {refusalDetail(state.refusal) === "not-applied"
          ? c.notApplied
          : state.refusal.message}
      </Notice>
    );
  if (state.state !== "unknown") return null;
  if (state.withoutAuthority)
    return (
      <Notice tone="warning">
        <p>{c.withoutAuthority}</p>
        <Button variant="outline" onClick={command.dismissUnknown}>
          {c.stopWaiting}
        </Button>
      </Notice>
    );
  const refusal = state.lastRefusal;
  const forbidden = refusal?.kind === "not-authorized";
  return (
    <Notice tone="warning" title={c.unknownTitle}>
      <p>{operation === "apply" ? applyUnconfirmedMessage : c.unconfirmed}</p>
      {forbidden && <p>{c.retryForbidden}</p>}
      {refusal && !forbidden && refusal.message && <p>{refusal.message}</p>}
      <div className="actions">
        <Button onClick={() => void command.retry()}>{c.retrySame}</Button>
        <Button variant="outline" onClick={() => void command.check()}>
          {c.checkItem}
        </Button>
        {refusal && (
          <Button variant="ghost" onClick={command.dismissUnknown}>
            {c.stopWaiting}
          </Button>
        )}
      </div>
    </Notice>
  );
}
