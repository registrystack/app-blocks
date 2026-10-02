/**
 * Hooks for the rest of a Casework work item page: the officer's private notes and the
 * agent tasks on the item, and the one-time team setup. Each wraps its host calls as the
 * page made them: notes save without an attempt id, a task list is read only when asked
 * for, and setup is sent once per request.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useCommand } from "./command-hooks.js";
import type { CommandState } from "./commands.js";
import { taskGrantsWithheld, taskRevokeFailure } from "./problems.js";
import {
  taskApprovalCommand,
  useReviewTaskGrants,
  type TaskGrantCalls,
} from "./review-hooks.js";
import { useCaseworkDraft, useHost } from "./react.js";
import type {
  CaseworkTaskApprovalResult,
  CaseworkTaskGrant,
  CaseworkTaskPreview,
} from "./casework-task-types.js";
import type { CaseworkSetupInput } from "./types.js";

/**
 * Whether the notes are due to save on a pause: loaded, changed since the last save,
 * not the text a save refused, and neither blocked nor already saving.
 */
export function draftAutosaveDue(notes: {
  blocked: boolean;
  pending: boolean;
  text: string | null;
  savedText: string | null;
  refused: string | null;
}): boolean {
  return !(
    notes.blocked ||
    notes.pending ||
    notes.text === null ||
    notes.text === notes.savedText ||
    notes.text === notes.refused
  );
}

/** How long typing pauses before the notes save. */
const autosaveDelay = 800;

/**
 * The officer's private notes on one item. They save themselves when typing pauses,
 * and only when the text differs from what was last saved; a refused text is not
 * retried until it changes. The text, the saved text and the item revision it writes
 * against all come from one item's draft, read once.
 */
export function useCaseworkDraftWrite(
  id: string,
  {
    blocked,
    afterWrite,
  }: {
    blocked: boolean;
    /** Reads the item again after a stored write. */
    afterWrite: () => Promise<unknown>;
  },
) {
  const host = useHost();
  const draft = useCaseworkDraft(id);
  const [text, setText] = useState<string | null>(null);
  const [savedText, setSavedText] = useState<string | null>(null);
  const [itemRevision, setItemRevision] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const loaded = useRef(false);
  /** The text a save refused, so a failure is not retried on a loop. */
  const refused = useRef<string | null>(null);

  useEffect(() => {
    if (loaded.current || !draft.data) return;
    loaded.current = true;
    setText(draft.data.text);
    setSavedText(draft.data.text);
    setItemRevision(draft.data.itemRevision);
  }, [draft.data]);

  async function save(next: string) {
    if (itemRevision === null) return;
    setPending(true);
    setError(null);
    try {
      const result = await host.saveCaseworkDraft(id, {
        itemRevision,
        text: next,
      });
      setItemRevision(result.itemRevision);
      setSavedText(next);
      setSavedAt(new Date());
      refused.current = null;
    } catch (caught) {
      refused.current = next;
      setError(caught);
      setPending(false);
      return;
    }
    // Casework has stored the notes. Reading the item again can still fail,
    // and that is a read the item's own panel reports: it never becomes a save
    // failure, and it never refuses this text.
    await afterWrite();
    setPending(false);
  }

  // Saving on a pause: one timer, restarted by every keystroke, cancelled when
  // the block is unmounted or blocked.
  useEffect(() => {
    if (
      text === null ||
      !draftAutosaveDue({
        blocked,
        pending,
        text,
        savedText,
        refused: refused.current,
      })
    )
      return;
    const timer = setTimeout(() => void save(text), autosaveDelay);
    return () => clearTimeout(timer);
  }, [text, savedText, blocked, pending]);

  /** Deletes the notes. True once Casework confirmed the deletion. */
  async function discard(): Promise<boolean> {
    if (itemRevision === null) return false;
    setPending(true);
    setError(null);
    try {
      const result = await host.deleteCaseworkDraft(id, itemRevision);
      setItemRevision(result.itemRevision);
      setText("");
      setSavedText("");
      setSavedAt(null);
      refused.current = null;
    } catch (caught) {
      setError(caught);
      setPending(false);
      return false;
    }
    setPending(false);
    // Deletion is already confirmed and carries its resulting revision. The
    // independent refresh must not turn that successful write into a failure.
    void afterWrite().catch(() => undefined);
    return true;
  }

  return {
    /** The draft as read, for its loading and error states. */
    draft,
    text,
    savedText,
    /** When the last save was stored in this view; cleared by the next edit. */
    savedAt,
    pending,
    error,
    /** The officer changed the text; it saves on the next pause. */
    edit(next: string) {
      setText(next);
      setSavedAt(null);
    },
    discard,
  };
}

/**
 * An approval is keyed by its attempt id on the host. An unconfirmed one is resent
 * exactly, however long ago its preview was read, and a refusal to resend it never
 * settles it: the grant may exist.
 */
const workItemApproval = taskApprovalCommand(
  "task-approval",
  (host, id, approvalRef, attemptId) =>
    host.approveCaseworkTask(id, approvalRef, attemptId),
);
/** The agent-task calls and approval of one Casework work item. */
export function useCaseworkTaskGrants(itemId: string) {
  const host = useHost();
  // One object per item, so a panel that reads on a change of calls reads once.
  const calls = useMemo<TaskGrantCalls>(
    () => ({
      previews: () => host.caseworkTaskPreviews(itemId),
      list: () => host.caseworkTaskGrants(itemId),
      revoke: (grant) => host.revokeCaseworkTask(itemId, grant),
      dispatch: (grant) => host.dispatchCaseworkTask(itemId, grant),
    }),
    [host, itemId],
  );
  return { calls, approval: useCommand(workItemApproval, itemId) };
}

type TaskApproval = ReturnType<typeof useReviewTaskGrants>["approval"];
/** Why the panel cannot show or change the tasks it lists. */
export type TaskGrantProblem =
  "unavailable" | "stale" | "revoke-unconfirmed" | "run-unavailable";
/** What the panel confirms to the officer. */
export type TaskGrantNotice = "approved" | "revoked";

/**
 * The agent tasks of one work item or review task, as a panel the officer opens. The
 * list and the templates are read only when asked for, never cached or read again on
 * their own: reading a template mints an approval reference on the host. Every answer
 * that arrives after the panel was closed or reset is dropped.
 */
export function useTaskGrantPanel({
  id,
  revision,
  blocked,
  calls,
  approval,
}: {
  id: string;
  revision: string;
  blocked: boolean;
  calls: TaskGrantCalls;
  approval: TaskApproval;
}) {
  const generation = useRef(0);
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<CaseworkTaskPreview[]>([]);
  const [grants, setGrants] = useState<CaseworkTaskGrant[]>([]);
  const [selected, setSelected] = useState<CaseworkTaskPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TaskGrantProblem | null>(null);
  const [message, setMessage] = useState<TaskGrantNotice | null>(null);
  const [assistantNote, setAssistantNote] = useState("");
  const [recorded, setRecorded] = useState<number | null>(null);
  // The item whose task list Casework refused this officer. It is not cleared
  // while the list is read again, so a refused officer does not see the
  // button come back meanwhile; another item starts offered.
  const [withheld, setWithheld] = useState<string | null>(null);
  useEffect(() => {
    const gen = ++generation.current;
    setPending(false);
    setSelected(null);
    setTemplates([]);
    setGrants([]);
    setOpen(false);
    setError(null);
    setMessage(null);
    setAssistantNote("");
    setRecorded(null);
    // What a closed panel can say without the officer opening it: how many
    // tasks are recorded on this item. Only the grants are read. Reading a
    // template mints an approval reference on the host, and an officer who
    // opened the case has not asked for one.
    calls
      .list()
      .then((list) => {
        if (gen !== generation.current) return;
        setRecorded(list.grants.length);
        setWithheld(list.withheld ? id : null);
      })
      .catch((e) => {
        // Not a failure to put in front of an officer who was not asking
        // about tasks: the label goes back to bare words, and opening the
        // panel reports it where they did ask. A refusal of the session or
        // of the item withholds the tasks instead.
        if (gen !== generation.current) return;
        setRecorded(null);
        setWithheld(taskGrantsWithheld(e) ? id : null);
      });
    return () => {
      generation.current++;
    };
  }, [id, revision, blocked, calls]);
  async function load() {
    const gen = ++generation.current;
    setPending(true);
    setSelected(null);
    setTemplates([]);
    setGrants([]);
    setError(null);
    try {
      const [preview, list] = await Promise.all([
        calls.previews(),
        calls.list(),
      ]);
      if (gen !== generation.current) return;
      if (list.withheld) {
        setError("unavailable");
        return;
      }
      setTemplates(preview.templates);
      setGrants(list.grants);
      setRecorded(list.grants.length);
    } catch {
      if (gen === generation.current) setError("unavailable");
    } finally {
      if (gen === generation.current) setPending(false);
    }
  }
  function approved(next: CommandState<CaseworkTaskApprovalResult>) {
    if (next.state === "confirmed" && next.value.outcome === "confirmed") {
      const grant = next.value.grant;
      setGrants((previous) => [
        grant,
        ...previous.filter((g) => g.id !== grant.id),
      ]);
      setSelected(null);
      setMessage("approved");
    } else if (next.state === "refused") {
      setSelected(null);
      setTemplates([]);
      setGrants([]);
      setError("stale");
    }
  }
  async function approve() {
    if (!selected) return;
    const gen = generation.current;
    setError(null);
    setMessage(null);
    const next = await approval.run({
      id,
      approvalRef: selected.approvalRef,
    });
    if (gen === generation.current) approved(next);
  }
  async function retryApproval() {
    const gen = generation.current;
    setError(null);
    setMessage(null);
    const next = await approval.retry();
    if (gen === generation.current) approved(next);
  }
  async function revoke(grant: CaseworkTaskGrant) {
    const gen = generation.current;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await calls.revoke(grant.id);
      if (gen !== generation.current) return;
      setGrants((previous) =>
        previous.map((g) =>
          g.id === result.id ? { ...g, invalidated: result.invalidated } : g,
        ),
      );
      setMessage("revoked");
    } catch (e) {
      if (gen !== generation.current) return;
      const failure = taskRevokeFailure(e);
      if (failure === "stale") {
        setSelected(null);
        setTemplates([]);
        setGrants([]);
      }
      setError(failure);
    } finally {
      if (gen === generation.current) setPending(false);
    }
  }
  async function dispatch(grant: CaseworkTaskGrant) {
    const gen = generation.current;
    setPending(true);
    setError(null);
    setAssistantNote("");
    try {
      const result = await calls.dispatch(grant.id);
      if (gen === generation.current) setAssistantNote(result.note);
    } catch {
      if (gen === generation.current) setError("run-unavailable");
    } finally {
      if (gen === generation.current) setPending(false);
    }
  }
  /** Opens the panel and reads it, or closes it and drops what it read. */
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load();
    else {
      generation.current++;
      setPending(false);
      setSelected(null);
      setTemplates([]);
      // Closing drops the list the label was counting, so the count the
      // officer just saw is kept.
      setRecorded(grants.length);
      setGrants([]);
    }
  }
  return {
    open,
    toggle,
    templates,
    grants,
    /** The template the officer is reviewing before approving it. */
    selected,
    select(template: CaseworkTaskPreview) {
      setSelected(template);
      setError(null);
      setMessage(null);
    },
    cancel: () => setSelected(null),
    pending,
    error,
    message,
    assistantNote,
    // What the label can promise: the number of tasks the panel would list.
    // Open and settled, that is the list it holds; otherwise it is what the last
    // read found, and null until one succeeds.
    listed: open && !pending && !error ? grants.length : recorded,
    // Whether to offer agent tasks here at all: false once Casework refused
    // this officer the item's task list, true while it is read and after any
    // other failure, which may pass.
    offered: withheld !== id,
    load,
    approve,
    retryApproval,
    revoke,
    dispatch,
    unconfirmed:
      approval.state.state === "unknown" ||
      approval.state.state === "recovering",
    approving:
      approval.state.state === "sending" ||
      approval.state.state === "recovering",
  };
}

/**
 * The administrator's one-time setup of a team, its people and its queue. Nothing is
 * resent on its own; a failure is kept in `error`.
 */
export function useCaseworkSetup() {
  const host = useHost();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  /** Sends the setup. True once Casework confirmed it. */
  async function setup(input: CaseworkSetupInput): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await host.setupCasework(input);
      return true;
    } catch (caught) {
      setError(caught);
      return false;
    } finally {
      setPending(false);
    }
  }
  return { setup, pending, error };
}
