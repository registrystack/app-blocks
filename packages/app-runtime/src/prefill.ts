import { HostError, UnknownOutcome } from "./errors.js";
import type { HostClient } from "./index.js";
import type { VerifiedPrefill } from "./types.js";

/** Why a verified answer could not be offered or kept. */
export type PrefillFailure = "unavailable" | "denied" | "uncertain" | "expired";

/**
 * Asks for a verified answer under one attempt. The attempt is kept in `attempt` across
 * failures, so asking again resends the same attempt, and dropped once an answer comes.
 */
export async function requestPrefill(
  host: Pick<HostClient, "prefill">,
  actionRef: string,
  attempt: { current: string | null },
): Promise<VerifiedPrefill> {
  const attemptId = attempt.current ?? crypto.randomUUID();
  attempt.current = attemptId;
  const proposed = await host.prefill(actionRef, attemptId);
  attempt.current = null;
  return proposed;
}

/** What a failed request for a verified answer tells the person. */
export function prefillFailure(error: unknown): PrefillFailure {
  if (error instanceof UnknownOutcome) return "uncertain";
  if (error instanceof HostError && error.problem.code === "prefill.uncertain")
    return "uncertain";
  if (error instanceof HostError && error.status === 403) return "denied";
  return "unavailable";
}

/**
 * Why an offered answer cannot be accepted, or null when it can: one that expired, or one
 * for a field the form does not ask.
 */
export function prefillRefusal(
  proposal: VerifiedPrefill,
  asked: boolean,
  now: number,
): PrefillFailure | null {
  if (Date.parse(proposal.expiresAt) <= now) return "expired";
  // A proposal for a field this form does not ask is not an answer to it.
  if (!asked) return "unavailable";
  return null;
}

/** How long an accepted answer stays usable, never less than nothing. */
export function prefillRemaining(accepted: VerifiedPrefill, now: number) {
  return Math.max(0, Date.parse(accepted.expiresAt) - now);
}
