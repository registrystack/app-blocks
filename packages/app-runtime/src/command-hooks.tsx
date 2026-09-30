import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  executeCommand,
  executeProbe,
  pendingCommands,
  restoredOperation,
  type CommandMarker,
  type CommandState,
  type CommandTarget,
  type CommandViewer,
  type MarkerInput,
  type PendingCommand,
  type ProbeVerdict,
} from "./commands.js";
import type { HostClient } from "./index.js";
import { rereadsOnRefusal } from "./problems.js";
import { useAuthority, useHost } from "./react.js";

/** How one kind of write is sent, resent and read back. */
export interface CommandSpec<I, R> {
  /** A generic name for the kind of target, such as "task" or "review-task". */
  scope: string;
  operation(input: I): string;
  /** Stored in the marker so a read-back can tell whether the target moved on. */
  expectedRevision?(input: I): string | undefined;
  send(host: HostClient, input: I, attemptId: string): Promise<R>;
  /** Resends the same attempt: same attempt id, same body. */
  retry(host: HostClient, attemptId: string, marker: CommandMarker): Promise<R>;
  /** Reads the target back when resending cannot settle the attempt. */
  probe?(host: HostClient, marker: CommandMarker): Promise<ProbeVerdict<R>>;
  /** Whether a returned value leaves the outcome unknown; default `outcome === "unknown"`. */
  isUnknown?(value: R): boolean;
  /** Query keys to refresh after a confirmation; default the whole session scope. */
  invalidates?(value: R, sessionScope: string): QueryKey[];
  /** Bind the marker to the same human, so it stays recoverable in their next session. */
  recoverAcrossSessions?: boolean;
}

/** The session ended: attempt references only that session could recover are erased. */
export function forgetPendingAuthority() {
  pendingCommands.forgetAuthority();
}

/** Every pending command this viewer can see, kept current on this page. */
export function usePendingCommands(
  viewer: CommandViewer,
  scope?: string,
): PendingCommand[] {
  const revision = useSyncExternalStore(
    (listener) => pendingCommands.subscribe(listener),
    () => pendingCommands.revision,
    () => 0,
  );
  return useMemo(
    () => pendingCommands.list(viewer, scope),
    // The revision is the snapshot; the list is read again whenever it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, viewer.scope, viewer.recoveryContext, scope],
  );
}

/**
 * Refreshes every key at once. A later command reads its revision from one of these
 * queries, so none may wait for another's round trip before it starts.
 */
function refreshTogether(client: QueryClient, keys: Iterable<QueryKey>) {
  return Promise.all(
    [...keys].map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}

/** A target named by id alone is a resource of the command's own scope. */
function scopedTarget(scope: string, target: string | CommandTarget) {
  return typeof target === "string" ? { entity: scope, id: target } : target;
}

/**
 * One write with exact recovery. With a `target`, an unresolved attempt on that target is
 * restored on mount and no new attempt starts until it settles. Without one, every run is its
 * own target.
 */
export function useCommand<I, R>(
  spec: CommandSpec<I, R>,
  named?: string | CommandTarget,
) {
  const target =
    named === undefined ? undefined : scopedTarget(spec.scope, named);
  const targetKey = target && JSON.stringify([target.entity, target.id]);
  const host = useHost(),
    session = useAuthority(),
    client = useQueryClient();
  const viewer: CommandViewer = {
    scope: session.scope,
    ...(session.caseworkRecoveryContext
      ? { recoveryContext: session.caseworkRecoveryContext }
      : {}),
  };
  const restore = (): CommandState<R> => {
    const marker =
      target === undefined
        ? undefined
        : pendingCommands.find(viewer, spec.scope, target);
    return marker
      ? {
          state: "unknown",
          attemptId: marker.attemptId,
          withoutAuthority: false,
        }
      : { state: "idle" };
  };
  const [state, setState] = useState<CommandState<R>>(restore);
  const [durable, setDurable] = useState(true);
  const current = useRef<MarkerInput | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    setState(restore());
    // Only a change of target or authority restores again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, session.scope, spec.scope]);

  const locked =
    state.state === "sending" ||
    state.state === "recovering" ||
    state.state === "unknown";

  async function settle(next: CommandState<R>) {
    setDurable(pendingCommands.durable);
    // The refreshes start before the confirmation renders, so the officer never sees a
    // confirmed command while the data it moved is still the old read.
    const refreshed =
      next.state === "confirmed"
        ? refreshTogether(
            client,
            spec.invalidates?.(next.value, session.scope) ?? [[session.scope]],
          )
        : undefined;
    setState(next);
    await refreshed;
    return next;
  }
  function markerFor(attemptId: string): MarkerInput | null {
    if (current.current?.attemptId === attemptId) return current.current;
    const stored =
      target === undefined
        ? undefined
        : pendingCommands.find(viewer, spec.scope, target);
    return stored?.attemptId === attemptId ? stored : null;
  }

  async function run(input: I): Promise<CommandState<R>> {
    if (locked || busy.current) return state;
    busy.current = true;
    const attemptId = crypto.randomUUID();
    const revision = spec.expectedRevision?.(input);
    const marker: MarkerInput = {
      authority: session.scope,
      ...(spec.recoverAcrossSessions && viewer.recoveryContext
        ? { recoveryContext: viewer.recoveryContext }
        : {}),
      scope: spec.scope,
      target: target ?? { entity: spec.scope, id: attemptId },
      operation: spec.operation(input),
      attemptId,
      ...(revision !== undefined ? { expectedRevision: revision } : {}),
    };
    current.current = marker;
    setState({ state: "sending", attemptId });
    try {
      return await settle(
        await executeCommand(
          pendingCommands,
          marker,
          "fresh",
          () => spec.send(host, input, attemptId),
          spec.isUnknown,
        ),
      );
    } finally {
      busy.current = false;
    }
  }
  async function retry(): Promise<CommandState<R>> {
    if (state.state !== "unknown" || state.withoutAuthority || busy.current)
      return state;
    const marker = markerFor(state.attemptId);
    if (!marker) return state;
    busy.current = true;
    setState({ state: "recovering", attemptId: marker.attemptId });
    try {
      const stored = pendingCommands.put(marker);
      return await settle(
        await executeCommand(
          pendingCommands,
          marker,
          "retry",
          () => spec.retry(host, marker.attemptId, stored),
          spec.isUnknown,
        ),
      );
    } finally {
      busy.current = false;
    }
  }
  async function check(): Promise<CommandState<R>> {
    if (
      state.state !== "unknown" ||
      state.withoutAuthority ||
      !spec.probe ||
      busy.current
    )
      return state;
    const marker = markerFor(state.attemptId);
    if (!marker) return state;
    busy.current = true;
    setState({ state: "recovering", attemptId: marker.attemptId });
    try {
      const stored = pendingCommands.put(marker);
      const probe = spec.probe;
      return await settle(
        (await executeProbe(pendingCommands, stored, () =>
          probe(host, stored),
        )) as CommandState<R>,
      );
    } finally {
      busy.current = false;
    }
  }
  return {
    state,
    locked,
    /** False when the marker could not be stored; it will not survive a reload. */
    durable,
    run,
    retry,
    check,
    /** Clears the view. An unknown attempt keeps its marker for the pending notice. */
    dismiss() {
      if (state.state !== "sending" && state.state !== "recovering")
        setState({ state: "idle" });
    },
    /** Explicitly gives up on an unknown attempt: its marker is removed. */
    dismissUnknown() {
      if (state.state !== "unknown") return;
      pendingCommands.removeAttempt(state.attemptId);
      current.current = null;
      setState({ state: "idle" });
    },
  };
}

/** Refusals of a resend after which only reading the target back can say more. */
const readBackAfter = new Set(["gone", "replay-expired", "stale"]);

/**
 * Wraps a command's retry so that a resend refused in a way that cannot settle it is
 * followed by one read back through the command's probe. The read waits for the render
 * that shows the attempt as unknown, because the probe reads the state it was given.
 */
export function useReadBackAfterRetry<R>(
  command: ReturnType<typeof useCommand<never, R>>,
) {
  const [readAfter, setReadAfter] = useState<string | null>(null);
  const { state, check } = command;
  useEffect(() => {
    if (
      readAfter !== null &&
      state.state === "unknown" &&
      state.attemptId === readAfter
    ) {
      setReadAfter(null);
      void check();
    }
  }, [readAfter, state, check]);
  return async function retry(): Promise<CommandState<R>> {
    const next = await command.retry();
    if (
      next.state === "unknown" &&
      next.lastRefusal &&
      readBackAfter.has(next.lastRefusal.kind)
    )
      setReadAfter(next.attemptId);
    return next;
  };
}

/**
 * The operation an unconfirmed attempt of one scope, restored from an earlier page, was
 * sent as; nothing once it settled.
 */
export function useRestoredOperation(
  scope: string,
  state: CommandState<unknown>,
): string | undefined {
  return restoredOperation(usePendingCommands(useViewer(), scope), state);
}

/**
 * Reads again once a write is refused because what it wrote to moved on. A refusal is
 * read once, when it arrives.
 */
export function useRereadOnRefusal(
  state: CommandState<unknown>,
  reread: () => void,
) {
  const refusedKind = state.state === "refused" ? state.refusal.kind : null;
  useEffect(() => {
    if (rereadsOnRefusal(state)) reread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refusedKind]);
}

/** The viewer this session reads pending commands as. */
export function useCommandViewer(): CommandViewer {
  return useViewer();
}

function useViewer(): CommandViewer {
  const session = useAuthority();
  return {
    scope: session.scope,
    ...(session.caseworkRecoveryContext
      ? { recoveryContext: session.caseworkRecoveryContext }
      : {}),
  };
}

const inFlight = (state: CommandState<unknown> | undefined) =>
  state?.state === "sending" ||
  state?.state === "recovering" ||
  state?.state === "unknown";

/**
 * Calls `onSettled` when a view still shows an unknown attempt whose marker is gone, because
 * the attempt was settled or given up elsewhere on this page, such as from a pending notice.
 */
export function useSettledElsewhere(
  state: CommandState<unknown>,
  scope: string,
  onSettled: () => void,
) {
  const pending = usePendingCommands(useViewer(), scope);
  const settled =
    state.state === "unknown" &&
    !state.withoutAuthority &&
    !pending.some(
      (entry) =>
        !entry.withoutAuthority && entry.marker.attemptId === state.attemptId,
    );
  useEffect(() => {
    if (settled) onSettled();
    // Only the change to settled matters; the callback is read when it happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
}

/** One target's command in a batch, and the input sent for it. */
export interface BatchEntry<I> {
  target: string;
  input: I;
}

/**
 * The same write on several targets, one attempt each, sent one after another. Each target
 * has its own state and marker, restored on mount like `useCommand`'s. A retry resends only
 * the targets whose outcome is unknown, each as its original attempt.
 */
export function useCommandBatch<I, R>(
  spec: CommandSpec<I, R>,
  targets: readonly string[],
) {
  const host = useHost(),
    session = useAuthority(),
    client = useQueryClient(),
    viewer = useViewer();
  const restore = (): Record<string, CommandState<R>> => {
    const restored: Record<string, CommandState<R>> = {};
    for (const target of targets) {
      const marker = pendingCommands.find(
        viewer,
        spec.scope,
        scopedTarget(spec.scope, target),
      );
      if (marker)
        restored[target] = {
          state: "unknown",
          attemptId: marker.attemptId,
          withoutAuthority: false,
        };
    }
    return restored;
  };
  const [states, setStates] =
    useState<Record<string, CommandState<R>>>(restore);
  const [running, setRunning] = useState(false);
  const [durable, setDurable] = useState(true);
  const sent = useRef(new Map<string, MarkerInput>());
  const busy = useRef(false);
  const targetKey = targets.join("\n");
  useEffect(() => {
    setStates(restore());
    // Only a change of targets or authority restores again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, session.scope, spec.scope]);

  const pending = usePendingCommands(viewer, spec.scope);
  useEffect(() => {
    // An attempt settled elsewhere on this page leaves nothing here to retry.
    const live = new Set(
      pending.flatMap((entry) =>
        entry.withoutAuthority ? [] : [entry.marker.attemptId],
      ),
    );
    setStates((current) => {
      let changed = false;
      const next = { ...current };
      for (const [target, state] of Object.entries(current))
        if (
          state.state === "unknown" &&
          !state.withoutAuthority &&
          !live.has(state.attemptId)
        ) {
          delete next[target];
          changed = true;
        }
      return changed ? next : current;
    });
  }, [pending]);

  const stateOf = (target: string): CommandState<R> =>
    states[target] ?? { state: "idle" };
  const unconfirmed = targets.filter(
    (target) => stateOf(target).state === "unknown",
  );

  async function each<T>(
    work: readonly T[],
    step: (entry: T) => Promise<[string, CommandState<R>] | null>,
  ): Promise<Record<string, CommandState<R>>> {
    const settled: Record<string, CommandState<R>> = {};
    if (busy.current) return settled;
    busy.current = true;
    setRunning(true);
    try {
      for (const entry of work) {
        const answer = await step(entry);
        if (!answer) continue;
        const [target, state] = answer;
        settled[target] = state;
        setStates((current) => ({ ...current, [target]: state }));
      }
    } finally {
      busy.current = false;
      setRunning(false);
      setDurable(pendingCommands.durable);
    }
    // One refresh for the batch, not one per confirmed target.
    const keys = new Map<string, QueryKey>();
    for (const state of Object.values(settled))
      if (state.state === "confirmed")
        for (const queryKey of spec.invalidates?.(
          state.value,
          session.scope,
        ) ?? [[session.scope]])
          keys.set(JSON.stringify(queryKey), queryKey);
    await refreshTogether(client, keys.values());
    return settled;
  }

  /** Sends a fresh attempt for each entry whose target has nothing in flight. */
  function run(entries: readonly BatchEntry<I>[]) {
    return each(entries, async ({ target, input }) => {
      if (inFlight(stateOf(target))) return null;
      const attemptId = crypto.randomUUID();
      const revision = spec.expectedRevision?.(input);
      const marker: MarkerInput = {
        authority: session.scope,
        ...(spec.recoverAcrossSessions && viewer.recoveryContext
          ? { recoveryContext: viewer.recoveryContext }
          : {}),
        scope: spec.scope,
        target: scopedTarget(spec.scope, target),
        operation: spec.operation(input),
        attemptId,
        ...(revision !== undefined ? { expectedRevision: revision } : {}),
      };
      sent.current.set(target, marker);
      setStates((current) => ({
        ...current,
        [target]: { state: "sending", attemptId },
      }));
      return [
        target,
        await executeCommand(
          pendingCommands,
          marker,
          "fresh",
          () => spec.send(host, input, attemptId),
          spec.isUnknown,
        ),
      ];
    });
  }

  /** Resends every target whose outcome is unknown, each as its original attempt. */
  function retry() {
    return each(unconfirmed, async (target) => {
      const state = stateOf(target);
      if (state.state !== "unknown" || state.withoutAuthority) return null;
      const own = sent.current.get(target);
      const marker =
        own?.attemptId === state.attemptId
          ? own
          : pendingCommands.find(
              viewer,
              spec.scope,
              scopedTarget(spec.scope, target),
            );
      if (marker?.attemptId !== state.attemptId) return null;
      setStates((current) => ({
        ...current,
        [target]: { state: "recovering", attemptId: marker.attemptId },
      }));
      const stored = pendingCommands.put(marker);
      return [
        target,
        await executeCommand(
          pendingCommands,
          marker,
          "retry",
          () => spec.retry(host, marker.attemptId, stored),
          spec.isUnknown,
        ),
      ];
    });
  }

  return {
    /** Each target's state; a target with no entry is idle. */
    states,
    stateOf,
    /** True while sending, or while any target is in flight or unknown. */
    locked: running || targets.some((target) => inFlight(stateOf(target))),
    busy: running,
    /** False when a marker could not be stored; it will not survive a reload. */
    durable,
    /** The targets whose outcome is unknown. */
    unconfirmed,
    run,
    retry,
    /** Clears the view. Unknown attempts keep their markers for the pending notice. */
    dismiss() {
      if (!busy.current) setStates({});
    },
    /** Explicitly gives up on one target's unknown attempt: its marker is removed. */
    dismissUnknown(target: string) {
      const state = stateOf(target);
      if (busy.current || state.state !== "unknown") return;
      pendingCommands.removeAttempt(state.attemptId);
      sent.current.delete(target);
      setStates((current) => {
        const next = { ...current };
        delete next[target];
        return next;
      });
    },
  };
}

/** What a pending notice needs of each kind of write it recovers. */
export type RecoverableCommand = Pick<
  CommandSpec<unknown, unknown>,
  "scope" | "retry" | "isUnknown" | "invalidates"
>;

/**
 * The pending writes of the given kinds, for a notice that recovers them from any page. Each
 * retry resends one attempt as itself; nothing new is created from here.
 */
export function useCommandRecovery(specs: readonly RecoverableCommand[]) {
  const host = useHost(),
    session = useAuthority(),
    client = useQueryClient();
  const all = usePendingCommands(useViewer());
  const specFor = (scope: string) => specs.find((spec) => spec.scope === scope);
  const pending = all.filter((entry) =>
    specFor(entry.withoutAuthority ? entry.scope : entry.marker.scope),
  );
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<
    "confirmed" | "refused" | "unknown" | null
  >(null);
  /** Attempts the host answered the retry of with a refusal that cannot settle them. */
  const [stuck, setStuck] = useState<string[]>([]);

  async function retryAll() {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    let unknown = false,
      refused = false;
    const nowStuck: string[] = [];
    try {
      for (const entry of pending) {
        if (entry.withoutAuthority) continue;
        const marker = entry.marker;
        const spec = specFor(marker.scope)!;
        const state = await executeCommand(
          pendingCommands,
          marker,
          "retry",
          () => spec.retry(host, marker.attemptId, marker),
          spec.isUnknown ? (value) => spec.isUnknown!(value) : undefined,
        );
        if (state.state === "unknown") {
          unknown = true;
          if (state.lastRefusal) nowStuck.push(marker.attemptId);
        } else if (state.state === "refused") refused = true;
        else if (state.state === "confirmed")
          await refreshTogether(
            client,
            spec.invalidates?.(state.value, session.scope) ?? [[session.scope]],
          );
      }
    } finally {
      setBusy(false);
    }
    setStuck(nowStuck);
    setOutcome(unknown ? "unknown" : refused ? "refused" : "confirmed");
  }

  return {
    pending,
    busy,
    /** How the last retry of every pending write ended, until the next one starts. */
    outcome,
    stuck,
    retryAll,
    /** Gives up on writes that cannot be retried from here: their markers are removed. */
    forget() {
      for (const spec of specs)
        pendingCommands.clearWithoutAuthority(spec.scope);
      for (const attemptId of stuck) pendingCommands.removeAttempt(attemptId);
      setStuck([]);
      setOutcome(null);
    },
    /** Clears the reported outcome. */
    clearOutcome() {
      setOutcome(null);
    },
  };
}
