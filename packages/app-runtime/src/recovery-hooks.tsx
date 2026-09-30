/**
 * Hooks that recover a record write whose outcome this page did not see, and that ask for
 * a verified answer to prefill a request. Each wraps its host calls exactly: a recovery
 * reads or resends one attempt and forgets it only once confirmed, and a prefill resends
 * the same attempt until an answer comes.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pendingCommands } from "./commands.js";
import {
  prefillFailure,
  prefillRefusal,
  prefillRemaining,
  requestPrefill,
  type PrefillFailure,
} from "./prefill.js";
import {
  recoverRecordWrite,
  type RecordRecoveryStep,
} from "./record-recovery.js";
import type { VerifiedPrefill } from "./types.js";
import {
  clearPending,
  readPending,
  useAuthority,
  useHost,
  type RecoveryReference,
} from "./react.js";

/**
 * The unresolved record write this session can recover, read again whenever `rereadOn`
 * changes, such as on every route change. `settled` hides it until the next read.
 */
export function usePendingRecordWrite(rereadOn: unknown): {
  reference: RecoveryReference | null;
  settled(): void;
} {
  const session = useAuthority();
  const [reference, setReference] = useState(() => readPending(session.scope));
  useEffect(() => {
    setReference(readPending(session.scope));
  }, [rereadOn, session.scope]);
  return { reference, settled: () => setReference(null) };
}

/**
 * Checks, resends or leaves one unresolved record write. A confirmed write is forgotten,
 * `onSettled` runs, the session's reads are refreshed and `open` receives the record it
 * wrote; an unknown outcome offers the exact resend; a failure is kept in `error` with
 * the write still remembered. Leaving forgets the write, or every write that lost its
 * authority when the reference names none.
 */
export function useRecordRecovery(
  reference: RecoveryReference,
  {
    onSettled,
    open,
  }: {
    onSettled: () => void;
    open: (resource: { id: string; entity: string }) => void;
  },
) {
  const session = useAuthority(),
    host = useHost(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [error, setError] = useState<unknown>(null);
  const attemptId = "attemptId" in reference ? reference.attemptId : null;
  async function recover(step: RecordRecoveryStep) {
    setBusy(true);
    setError(null);
    try {
      const confirmed = await recoverRecordWrite(
        host,
        pendingCommands,
        step,
        attemptId!,
      );
      if (!confirmed) {
        setUnknown(true);
        return;
      }
      onSettled();
      // A check refreshes before it opens the record; a resend opens it first.
      if (step === "check") {
        await client.invalidateQueries({ queryKey: [session.scope] });
        open(confirmed.resource);
      } else {
        open(confirmed.resource);
        await client.invalidateQueries({ queryKey: [session.scope] });
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  return {
    attemptId,
    busy,
    unknown,
    error,
    check: () => recover("check"),
    retry: () => recover("retry"),
    leave() {
      clearPending(attemptId ?? undefined);
      onSettled();
    },
  };
}

/** Whether a write of an ended session is still unresolved, so a new one may repeat it. */
export function usePreviousSubmission(): boolean {
  return readPending("") !== null;
}

/**
 * Asks, with the person's consent, for a verified answer to one field of a request, and
 * holds the answer the person accepted until it expires.
 */
export function usePrefill(actionRef: string) {
  const host = useHost();
  const [consented, setConsented] = useState(false),
    [busy, setBusy] = useState(false),
    [proposal, setProposal] = useState<VerifiedPrefill | null>(null),
    [accepted, setAccepted] = useState<VerifiedPrefill | null>(null),
    [error, setError] = useState<PrefillFailure | null>(null);
  const attempt = useRef<string | null>(null);
  useEffect(() => {
    if (!accepted) return;
    const timeout = window.setTimeout(
      () => {
        setAccepted(null);
        setError("expired");
      },
      prefillRemaining(accepted, Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [accepted]);
  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setProposal(await requestPrefill(host, actionRef, attempt));
      setConsented(false);
    } catch (caught) {
      setError(prefillFailure(caught));
    } finally {
      setBusy(false);
    }
  }
  /**
   * Accepts an offered answer for a field the form asks when `asked`. False when it
   * expired or answers nothing here, so the caller leaves the form as it is.
   */
  function accept(offered: VerifiedPrefill, asked: boolean): boolean {
    setProposal(null);
    const refusal = prefillRefusal(offered, asked, Date.now());
    if (refusal) {
      setError(refusal);
      return false;
    }
    setAccepted(offered);
    return true;
  }
  return {
    consented,
    consent: () => setConsented(true),
    busy,
    proposal,
    accepted,
    /** The evidence the accepted answer carries, sent with the request. */
    evidenceRef: accepted?.evidenceRef,
    error,
    request,
    accept,
  };
}
