import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  HostClient,
  pendingCommands,
  problemView,
  recordQueryRefusal,
  refusalDetail,
  taskRefusal,
  type CommandState,
} from "./index.js";
import {
  RetainedUploads,
  attachmentScope,
  attachmentTarget,
  pendingUploads,
  recordAttachmentUploadCommand,
  uploadTarget,
  type AttachmentUploadInput,
} from "./attachment-upload.js";
import {
  useCommand,
  usePendingCommands,
  useSettledElsewhere,
} from "./command-hooks.js";
export * from "./command-hooks.js";
export * from "./review-hooks.js";
export * from "./work-item-hooks.js";
import { recordTaskCommand } from "./record-commands.js";
export {
  applyTask,
  formValues,
  recordKeys,
  recordTask,
  recordTaskCommand,
  type RecordCommandInput,
} from "./record-commands.js";
export * from "./record-hooks.js";
export * from "./recovery-hooks.js";
export * from "./casework-hooks.js";
export * from "./staffing-hooks.js";
export * from "./remembered.js";
export * from "./session-hooks.js";
import type {
  RecordQuery,
  RecordTask,
  RecordTaskResult,
  RecordView,
} from "./model.js";
import type {
  AttachmentFile,
  AuthenticatedSession,
  CaseworkItemFilters,
} from "./types.js";
import { readDocument } from "./document.js";
import { rereadsSince, type RereadStart } from "./poll-backoff.js";
const HostContext = createContext<HostClient | null>(null);
const SessionContext = createContext<AuthenticatedSession | null>(null);
export function AppProvider({
  children,
  mount = "/api",
  transport,
}: {
  children: ReactNode;
  mount?: string;
  // The app-host transport. Left unset, the browser's own fetch is used. A
  // caller that renders the app without a host behind it, such as the states
  // gallery, passes its own so every screen state is reachable offline.
  transport?: typeof fetch;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 10_000 },
          mutations: { retry: false },
        },
      }),
  );
  const [host] = useState(
    () =>
      new HostClient({
        mount,
        ...(transport ? { fetch: transport } : {}),
        onSessionExpired: () => {
          pendingCommands.forgetAuthority();
          queryClient.removeQueries({
            predicate: (q) => q.queryKey[0] !== "session",
          });
          queryClient.setQueryData(["session"], {
            authenticated: false,
            loginUrl: "/auth/login",
          });
          void queryClient.invalidateQueries({ queryKey: ["session"] });
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <HostContext.Provider value={host}>{children}</HostContext.Provider>
    </QueryClientProvider>
  );
}
export function useHost() {
  const host = useContext(HostContext);
  if (!host) throw new Error("AppProvider is required.");
  return host;
}
export function useSession() {
  const host = useHost();
  return useQuery({
    queryKey: ["session"],
    queryFn: () => host.session(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}
export function AuthorityBoundary({
  session,
  children,
}: {
  session: AuthenticatedSession;
  children: ReactNode;
}) {
  const host = useHost();
  const client = useQueryClient();
  // This component is keyed by scope by the consumer, unmounting all protected forms.
  useEffect(() => {
    host.setSession(session);
    return () => {
      host.clear();
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    };
  }, [host, client, session.scope, session.csrfToken]);
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
export function useAuthority() {
  const session = useContext(SessionContext);
  if (!session)
    throw new Error("An authenticated AuthorityBoundary is required.");
  return session;
}
/**
 * The session's registry model. It changes only with the registry contract,
 * which ends the session, so it is read once per session and language.
 */
export function useModel(lang?: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "model", lang ?? ""],
    queryFn: () => host.model(lang),
    staleTime: Infinity,
  });
}
/** A records read with the refusal facts `useRecords` reports, read on access. */
function withRecordQueryRefusal<R extends { error: unknown }>(records: R) {
  return Object.defineProperties(records, {
    cursorExpired: {
      get: () => recordQueryRefusal(records.error).cursorExpired,
    },
    unsupported: { get: () => recordQueryRefusal(records.error).unsupported },
  }) as R & {
    readonly cursorExpired: boolean;
    readonly unsupported: boolean;
  };
}
/**
 * One page of an entity's records; list items carry no actions. A refused page also says
 * whether its cursor expired and whether the query is offered at all. Both are read on
 * access, so a page that does not ask does not follow the error.
 */
export function useRecords(entity: string, filter: RecordQuery = {}) {
  const host = useHost(),
    session = useAuthority();
  return withRecordQueryRefusal(
    useQuery({
      queryKey: [session.scope, "records", entity, filter],
      queryFn: () => host.records(entity, filter),
    }),
  );
}
/**
 * One page of the same query over several entities, a read per entity in the order given,
 * each answering as `useRecords` does and sharing its cache. For a page whose entities come
 * from the model, where a hook per entity cannot be written out.
 */
export function useRecordsOf(
  entities: readonly string[],
  filter: RecordQuery = {},
) {
  const host = useHost(),
    session = useAuthority();
  return useQueries({
    queries: entities.map((entity) => ({
      queryKey: [session.scope, "records", entity, filter],
      queryFn: () => host.records(entity, filter),
    })),
  }).map(withRecordQueryRefusal);
}
/**
 * The states one record has held, newest first. Disabled until `enabled`, so
 * a page reads it only where the model offers revisions.
 */
export function useRecordHistory(entity: string, id: string, enabled = true) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "record-history", entity, id],
    queryFn: () => host.recordHistory(entity, id),
    enabled: enabled && Boolean(id),
  });
}
/**
 * One record with the actions the session may take on it. A page waiting on a change that
 * reaches the registry asynchronously passes `pollEvery`, which names the milliseconds to
 * wait before reading the held view again, or false once it has what it waits for. It also
 * receives how many times the view has been re-read since the page was opened, so it can
 * lengthen the wait.
 */
export function useRecord(
  entity: string,
  id: string,
  lang?: string,
  pollEvery?: (
    view: RecordView | undefined,
    rereads: number,
  ) => number | false,
) {
  const host = useHost(),
    session = useAuthority();
  const rereadStart = useRef<RereadStart | undefined>(undefined);
  const record = useQuery({
    queryKey: [session.scope, "record", entity, id, lang ?? ""],
    queryFn: () => host.record(entity, id, lang),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const { data, dataUpdateCount } = query.state;
      if (!pollEvery) return false;
      if (data === undefined) return pollEvery(data, 0);
      const held = rereadsSince(
        rereadStart.current,
        query.queryHash,
        dataUpdateCount,
      );
      rereadStart.current = held.start;
      return pollEvery(data, held.rereads);
    },
  });
  return {
    ...record,
    // A held view is being read again in the background: it may already be
    // stale, so a write against it should wait for the read to settle rather
    // than send a precondition the fresh read is about to move past.
    refreshing: record.isFetching && !record.isLoading,
  };
}
export function useCaseworkItems(filters: CaseworkItemFilters = {}) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "casework-items", filters],
    queryFn: () => host.caseworkItems(filters),
  });
}
export function useNextCaseworkItem(filters: { queue?: string } = {}) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "casework-next", filters],
    queryFn: () => host.nextCaseworkItem(filters),
  });
}
export function useCaseworkDirectory() {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "casework-directory"],
    queryFn: () => host.caseworkDirectory(),
  });
}
export function useCaseworkItem(id: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "casework-item", id],
    queryFn: () => host.caseworkItem(id),
    refetchInterval: (query) =>
      query.state.data?.state === "synchronizing" ? 1_000 : false,
  });
}
export function useCaseworkDraft(id: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "casework-draft", id],
    queryFn: () => host.caseworkDraft(id),
  });
}
export function useCaseworkHistory(id: string) {
  const host = useHost(),
    session = useAuthority();
  const history = useInfiniteQuery({
    queryKey: [session.scope, "casework-history", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => host.caseworkHistory(id, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const continuationError = history.isFetchNextPageError ? history.error : null;
  return {
    ...history,
    data: history.data?.pages.flatMap((page) => page.items),
    error: continuationError ? null : history.error,
    continuationError,
    firstPageStatus: history.data?.pages[0]?.status,
    pageStatus: history.data?.pages.at(-1)?.status,
  };
}
export function useCaseworkHoldings(cursor?: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "casework-holdings", cursor ?? ""],
    queryFn: () => host.caseworkHoldings(cursor),
  });
}
export interface PendingReference {
  scope: string;
  attemptId: string;
}
export type RecoveryReference = PendingReference | { unresolved: true };
/**
 * The scope first-version task markers were kept under. A tab upgraded from that version
 * may still hold one, so it is read and cleared with the record writes.
 */
const firstVersionTaskScope = "task";
/**
 * The newest unresolved record write this session can recover, or a generic
 * reference when only another session's write remains.
 */
export function readPending(scope: string): RecoveryReference | null {
  const entries = [firstVersionTaskScope, recordTaskCommand.scope].flatMap(
    (kind) => pendingCommands.list({ scope }, kind),
  );
  let newest: PendingReference | null = null,
    newestAt = -Infinity;
  for (const entry of entries)
    if (!entry.withoutAuthority && entry.marker.createdAt >= newestAt) {
      newest = {
        scope: entry.marker.authority,
        attemptId: entry.marker.attemptId,
      };
      newestAt = entry.marker.createdAt;
    }
  return newest ?? (entries.length ? { unresolved: true } : null);
}
/** Forgets one settled write, or every record write that lost its authority. */
export function clearPending(attemptId?: string) {
  if (attemptId) pendingCommands.removeAttempt(attemptId);
  else {
    pendingCommands.clearWithoutAuthority(firstVersionTaskScope);
    pendingCommands.clearWithoutAuthority(recordTaskCommand.scope);
  }
}
export {
  attachmentScope,
  attachmentTarget,
  parseAttachmentTarget,
  pendingUploads,
  uploadTarget,
  type PendingUpload,
} from "./attachment-upload.js";
/**
 * Every unresolved upload of this session, and whether a previous session left any
 * whose reference it took with it. Forgetting those is the only way to settle them.
 */
export function usePendingUploads() {
  const session = useAuthority();
  const { live, orphaned } = pendingUploads(
    usePendingCommands({ scope: session.scope }, attachmentScope),
  );
  return {
    live,
    orphaned,
    forgetOrphaned: () =>
      pendingCommands.clearWithoutAuthority(attachmentScope),
  };
}
/** Where the browser reads a record's file in one slot, through the host. */
export function useAttachmentHref() {
  const host = useHost();
  return (entity: string, id: string, slot: string) =>
    host.recordAttachmentUrl(entity, id, slot);
}
/** Reads an attachment's bytes with every guarantee `readDocument` carries,
 * bound to the page's own origin so a preview never follows a redirect off it.
 */
export function useDocumentBytes() {
  return (href: string, file: AttachmentFile, signal: AbortSignal) =>
    readDocument(window.location.origin, href, file, signal);
}
const retainedUploads = new RetainedUploads();
const recordAttachmentUpload = recordAttachmentUploadCommand(
  retainedUploads,
  pendingCommands,
);

/** A slot command in the shape its feedback reads: a result, an error, and whether it is unknown. */
function slotCommandView<R>(state: CommandState<R>) {
  return {
    pending: state.state === "sending" || state.state === "recovering",
    result:
      state.state === "confirmed" || state.state === "unknown"
        ? (state.value ?? null)
        : null,
    error:
      state.state === "refused" || state.state === "unknown"
        ? (state.error ?? null)
        : null,
    attemptId: state.state === "idle" ? null : state.attemptId,
    unknown: state.state === "unknown",
    /** Why the last retry of an unresolved attempt was refused; the attempt stays unresolved. */
    lastRefusal: state.state === "unknown" ? (state.lastRefusal ?? null) : null,
  };
}
const settledValue = <R,>(next: CommandState<R>) =>
  next.state === "confirmed" || next.state === "unknown"
    ? (next.value ?? null)
    : null;

/** A slot's upload hook, over the result its host route returns. */
export type SlotUpload<R> = ReturnType<typeof slotCommandView<R>> & {
  /** The browser could not keep the file for an exact retry, so it was never sent. */
  notRetained: boolean;
  /** A retry was refused because this browser no longer holds the exact file. */
  bytesUnavailable: boolean;
  upload(uploadRef: string, file: Blob): Promise<R | null>;
  retry(): Promise<R | null>;
  reset(): void;
  dismissUnknown(): void;
};

/**
 * Places one file in a record's attachment slot, as a command on that slot. The exact
 * bytes are kept in the browser before dispatch, so an unknown outcome is retried with the
 * same attempt and file after a remount or a reload, and its pending marker joins the notice
 * of unresolved writes. No other upload starts on the slot until the attempt settles.
 */
export function useAttachmentUpload(
  entity: string,
  resourceId: string,
  slot: string,
): SlotUpload<RecordTaskResult> {
  const session = useAuthority();
  const target = uploadTarget(entity, resourceId, slot);
  const command = useCommand(recordAttachmentUpload, target);
  const view = slotCommandView(command.state);
  return {
    ...view,
    notRetained: refusalDetail(problemView(view.error)) === "not-retained",
    bytesUnavailable: refusalDetail(view.lastRefusal) === "bytes-unavailable",
    upload: async (uploadRef: string, file: Blob) =>
      settledValue(
        await command.run({
          authority: session.scope,
          entity,
          resourceId,
          slot,
          uploadRef,
          file,
        }),
      ),
    retry: async () => settledValue(await command.retry()),
    /** Clears a settled outcome; an unresolved upload stays until it settles or is given up. */
    reset: () => {
      if (!command.locked) command.dismiss();
    },
    /** Gives up on an unresolved upload once the person has checked the slot. */
    dismissUnknown: () => {
      command.dismissUnknown();
      // The bytes expire within the hour if this delete fails; nothing reads them without the marker.
      void retainedUploads
        .forget(session.scope, target.id, entity)
        .catch(() => undefined);
    },
  };
}

/** A slot's removal hook: `submit` sends the slot's removal reference and the record's revision. */
export type SlotRemoval<R> = ReturnType<typeof slotCommandView<R>> & {
  submit(removeRef: string, expectedRevision: string): Promise<R | null>;
  retry(): Promise<R | null>;
  reset(): void;
};

/**
 * Empties one attachment slot of a record with its removal reference, as a command on
 * that slot, so an unresolved removal is restored after a reload and locks the slot until
 * it settles. A removal settled or given up elsewhere on the page, such as from the
 * recovery notice, frees the slot at once.
 */
export function useAttachmentRemoval(
  entity: string,
  id: string,
  slot: string,
): SlotRemoval<RecordTaskResult> {
  const command = useCommand(recordTaskCommand, {
    entity,
    id: attachmentTarget(id, slot),
  });
  useSettledElsewhere(command.state, recordTaskCommand.scope, command.dismiss);
  return {
    ...slotCommandView(command.state),
    submit: async (removeRef: string, expectedRevision: string) =>
      settledValue(
        await command.run({
          type: "removeAttachment",
          entity,
          id,
          slot,
          actionRef: removeRef,
          expectedRevision,
        }),
      ),
    retry: async () => settledValue(await command.retry()),
    reset: () => {
      if (!command.locked) command.dismiss();
    },
  };
}
/**
 * A record task in the shape its form reads: the slot view, what a refusal says about
 * the form, the confirmed result, and whether the form is locked while a write is
 * in flight, unresolved or confirmed.
 */
export function recordTaskView(state: CommandState<RecordTaskResult>) {
  const view = slotCommandView(state);
  const confirmed = view.result?.outcome === "confirmed" ? view.result : null;
  return {
    ...view,
    ...taskRefusal(view.error, view.unknown),
    confirmed,
    locked: view.pending || view.unknown || confirmed !== null,
  };
}
/**
 * Sends one record task the page builds from an offered action. Every run is its own
 * attempt, so nothing is restored on mount; the recovery notice offers an unresolved one.
 */
export function useRecordTask() {
  const command = useCommand(recordTaskCommand);
  return {
    ...recordTaskView(command.state),
    submit: async (task: RecordTask) => settledValue(await command.run(task)),
    retry: async () => settledValue(await command.retry()),
    reset: command.dismiss,
  };
}

/**
 * A task, upload, removal or recovery result under the name every block-level type reads
 * its attempt by: this package is the only layer that names the same value `attemptId`,
 * so a page composing default blocks over these hooks renames it here instead of writing
 * `attemptId` itself.
 */
export function withReference<T extends { attemptId: string | null }>(
  outcome: T,
): Omit<T, "attemptId"> & { reference: T["attemptId"] } {
  const { attemptId, ...rest } = outcome;
  return { ...rest, reference: attemptId };
}
