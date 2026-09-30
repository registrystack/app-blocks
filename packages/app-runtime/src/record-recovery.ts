import type { CommandMarkers } from "./commands.js";
import type { HostClient } from "./index.js";
import type { RecordTaskResult } from "./model.js";

/** How an unresolved record write is recovered: read its outcome, or resend it exactly. */
export type RecordRecoveryStep = "check" | "retry";

/**
 * Reads or resends one unresolved record write. Only a confirmed outcome forgets the
 * write; an unknown one leaves it for another try, and a failure is thrown with the
 * write still remembered.
 */
export async function recoverRecordWrite(
  host: Pick<HostClient, "attempt" | "retry">,
  markers: Pick<CommandMarkers, "removeAttempt">,
  step: RecordRecoveryStep,
  attemptId: string,
): Promise<Extract<RecordTaskResult, { outcome: "confirmed" }> | null> {
  const result =
    step === "check"
      ? await host.attempt<RecordTaskResult>(attemptId)
      : await host.retry<RecordTaskResult>(attemptId);
  if (result.outcome !== "confirmed") return null;
  markers.removeAttempt(attemptId);
  return result;
}
