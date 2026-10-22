/**
 * Hooks for the staffing surfaces: the colleagues a write may name, the absence cover
 * Casework holds, the staffing writes and a caseload preview. Every write goes through
 * the session's retained commands; nothing here resends on its own.
 */
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  useCommand,
  useCommandRecovery,
  useSettledElsewhere,
} from "./command-hooks.js";
import {
  absenceEndCommand,
  absenceSaveCommand,
  caseloadCommand,
  staffingCommands,
  type CaseloadPreviewInput,
} from "./staffing-commands.js";
import { useAuthority, useHost } from "./react.js";
import type {
  CaseworkStaffingCaseloadPreview,
  CaseworkStaffingTargetQuery,
} from "./casework-staffing-types.js";

export {
  commandUnresolved,
  staffingWriteStuck,
  type CaseloadPreviewInput,
} from "./staffing-commands.js";

/**
 * One purpose's eligible colleagues, page by page. Continuations append to the
 * list the officer already has, so asking for more can never drop a choice
 * they already made.
 */
export function useStaffingTargets(query: CaseworkStaffingTargetQuery | null) {
  const host = useHost();
  const session = useAuthority();
  const identity = query ? JSON.stringify(query) : "disabled";
  const targets = useInfiniteQuery({
    queryKey: [session.scope, "casework-staffing-targets", identity],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      host.staffingTargets({ ...query!, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: query !== null,
  });
  const pages = targets.data?.pages;
  const items = useMemo(
    () => (pages ?? []).flatMap((page) => page.items),
    [pages],
  );
  return {
    ...targets,
    items,
    loaded: Boolean(pages?.length),
    /** The status of the last page loaded, as Casework reported it. */
    pageStatus: pages?.at(-1)?.status,
    /** Present only for a purpose that names a queue. */
    queueLabel: pages?.[0]?.queueLabel,
  };
}
export type StaffingTargets = ReturnType<typeof useStaffingTargets>;

/**
 * Whether Casework staffs absence cover for this officer. The probe is the
 * same targets query the absence page reads, so an officer who is offered the
 * page opens it from the answer already held rather than asking twice.
 */
export function useStaffingAbsenceCover(enabled: boolean) {
  const targets = useStaffingTargets(
    enabled ? { purpose: "absencePerson", limit: "100" } : null,
  );
  return targets.isSuccess;
}

/**
 * The absence cover Casework holds for the colleagues this officer
 * supervises. Asked for only where Casework staffs cover for this officer.
 */
export function useStaffingAbsences(enabled: boolean) {
  const host = useHost();
  const session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "casework-staffing-absences"],
    queryFn: () => host.staffingAbsences(),
    enabled,
  });
}

/**
 * Recording a new cover (`"create"`) or changing one. An unresolved write is restored
 * whenever the cover is opened again, even after a reload.
 */
export function useAbsenceSave(absenceRef: string) {
  const command = useCommand(absenceSaveCommand, absenceRef);
  useSettledElsewhere(command.state, absenceSaveCommand.scope, command.dismiss);
  return command;
}
/** Ending one cover. */
export function useAbsenceEnd(absenceRef: string) {
  const command = useCommand(absenceEndCommand, absenceRef);
  useSettledElsewhere(command.state, absenceEndCommand.scope, command.dismiss);
  return command;
}
/**
 * One movement of a person's work in one queue at a time, keyed by the queue and the
 * person; nothing is sent until the key is known.
 */
export function useCaseloadMove(key: string | undefined) {
  const command = useCommand(caseloadCommand, key);
  useSettledElsewhere(command.state, caseloadCommand.scope, command.dismiss);
  return command;
}
/** The staffing writes of this session whose outcome is unknown, from any page. */
export function useStaffingRecovery() {
  return useCommandRecovery(staffingCommands);
}

/**
 * The review tasks a movement would take, as one preview Casework fences. It is never
 * cached or read again on its own: each preview issues the reference its apply names.
 * A failure is kept in `failure`.
 */
export function useCaseloadPreview() {
  const host = useHost();
  const [previewed, setPreviewed] =
    useState<CaseworkStaffingCaseloadPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  /** Asks for the preview of a movement. Resolves to it, or null when the preview failed. */
  async function preview(
    input: CaseloadPreviewInput,
  ): Promise<CaseworkStaffingCaseloadPreview | null> {
    setPending(true);
    setFailure(undefined);
    try {
      const answer = await host.staffingPreviewCaseload(input);
      setPreviewed(answer);
      return answer;
    } catch (caught) {
      setFailure(caught);
      return null;
    } finally {
      setPending(false);
    }
  }
  return {
    /** The preview Casework answered last, until the movement changes. */
    previewed,
    pending,
    failure,
    preview,
    /** Drops the preview, for a movement that changed. */
    reset: () => setPreviewed(null),
  };
}
