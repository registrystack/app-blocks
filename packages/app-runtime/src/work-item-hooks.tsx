/**
 * Writes on a Casework work item: claim, release and apply. Review decisions belong to
 * review tasks; apply is the one decision a work item keeps. Every write goes through
 * `useCommand` with the item as its target, so an unresolved write survives a reload and
 * locks the item's other writes until it settles.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  useCommand,
  useCommandViewer,
  usePendingCommands,
  useReadBackAfterRetry,
  useRestoredOperation,
  type CommandSpec,
} from "./command-hooks.js";
import type {
  CommandMarker,
  PendingCommand,
  ProbeVerdict,
} from "./commands.js";
import { useAuthority } from "./react.js";
import type {
  CaseworkActionReference,
  CaseworkCommandResult,
  CaseworkWorkItem,
} from "./types.js";

interface WorkItemInput {
  itemId: string;
  action: CaseworkActionReference;
  revision: string;
}

/**
 * How a read item settles an unconfirmed write. An apply is confirmed once Casework
 * completed its attempt, and never while it still holds a live one; an item that still
 * offers apply with no live attempt was not applied. A claim or release is confirmed by
 * who holds the item. An item that did not move was not changed by the attempt.
 */
export function workItemVerdict(
  marker: Pick<CommandMarker, "operation" | "expectedRevision">,
  item: CaseworkWorkItem,
): ProbeVerdict<CaseworkCommandResult> {
  const confirmed: ProbeVerdict<CaseworkCommandResult> = {
    settled: "confirmed",
    value: { outcome: "confirmed", itemId: item.id, revision: item.revision },
  };
  if (marker.operation === "apply") {
    if (item.liveAttempt) return { settled: "unknown" };
    if (item.state === "completed" || item.state === "synchronizing")
      return confirmed;
    if (item.actions.some((action) => action.name === "apply"))
      return { settled: "not-applied" };
  } else if (marker.operation === "claim" && item.heldByMe) return confirmed;
  else if (marker.operation === "release" && !item.heldByMe) return confirmed;
  if (item.revision === marker.expectedRevision)
    return { settled: "not-applied" };
  return { settled: "unknown" };
}

/**
 * The marker holds no action reference, because references expire with the reading that
 * minted them. A resend goes through the host, which kept the exact call; once the host
 * session is gone, only reading the item back can settle the attempt.
 */
const workItemCommand: CommandSpec<WorkItemInput, CaseworkCommandResult> = {
  scope: "casework-item",
  operation: (input) => input.action.name,
  expectedRevision: (input) => input.revision,
  send: (host, input, attemptId) =>
    host.caseworkCommand(
      input.itemId,
      { actionRef: input.action.ref },
      attemptId,
    ),
  retry: (host, attemptId) =>
    host.retryCommand<CaseworkCommandResult>(attemptId),
  probe: async (host, marker) =>
    workItemVerdict(marker, await host.caseworkItem(marker.target.id)),
  // With no invalidation named, a confirmation refreshes every read of the session: an
  // apply changes the source request and the record it applies to.
  recoverAcrossSessions: true,
};

export function useWorkItemCommand(itemId: string) {
  const command = useCommand(workItemCommand, itemId);
  const retry = useReadBackAfterRetry(command);
  const restoredOperation = useRestoredOperation(
    workItemCommand.scope,
    command.state,
  );
  return {
    ...command,
    retry,
    /**
     * The operation an unconfirmed attempt restored from an earlier page was sent as, read
     * from its marker.
     */
    restoredOperation,
    /** Sends the offered action at the revision the officer read it at. */
    run: (
      item: Pick<CaseworkWorkItem, "revision">,
      action: CaseworkActionReference,
    ) => command.run({ itemId, action, revision: item.revision }),
    /** Casework confirmed the write, but the item must be read again for its next actions. */
    actionsUnavailable:
      command.state.state === "confirmed" &&
      command.state.value.outcome === "confirmed" &&
      command.state.value.actionsUnavailable === true,
  };
}

/** The items whose writes this session left unresolved, oldest first. */
export function pendingWorkItems(pending: readonly PendingCommand[]): string[] {
  return pending.flatMap((entry) =>
    entry.withoutAuthority ? [] : [entry.marker.target.id],
  );
}
/** The items whose writes this session left unresolved, kept current on this page. */
export function usePendingWorkItems(): string[] {
  return pendingWorkItems(
    usePendingCommands(useCommandViewer(), workItemCommand.scope),
  );
}

/**
 * Reads one item again with everything a write on it may have changed: its history, and
 * the request and the record it changes, since an apply changes the record.
 */
export function useWorkItemRefresh(
  itemId: string,
  item: { refetch(): Promise<unknown> },
): () => Promise<void> {
  const session = useAuthority(),
    client = useQueryClient();
  return async () => {
    await Promise.all([
      item.refetch(),
      client.invalidateQueries({
        queryKey: [session.scope, "casework-history", itemId],
      }),
      client.invalidateQueries({ queryKey: [session.scope, "record"] }),
    ]);
  };
}
