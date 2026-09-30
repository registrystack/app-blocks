import type { RequestView } from "@registrystack/app-runtime";
import { Notice } from "@/blocks/lib/notice";

/**
 * The review's recovery states, each in the reviewing service's own words: a
 * withdrawal it has not confirmed, a submission whose receipt is uncertain,
 * and a recovery that stopped for an operator. Each keeps the request where
 * it is; none offers an action. The titles and bodies are the caller's own,
 * since they may name the reviewing service and the record kind.
 */
export function ReviewRecoveryNotices({
  request,
  withdrawalPendingTitle,
  withdrawalPendingBody,
  submissionUnknownTitle,
  submissionUnknownBody,
  operatorAttentionTitle,
  operatorAttentionBody,
}: {
  request: RequestView | undefined;
  withdrawalPendingTitle: string;
  withdrawalPendingBody: string;
  submissionUnknownTitle: string;
  submissionUnknownBody: string;
  operatorAttentionTitle: string;
  operatorAttentionBody: string;
}) {
  const review = request?.review;
  if (!review) return null;
  return (
    <>
      {review.submission.state === "cancelling" && (
        <Notice tone="warning" title={withdrawalPendingTitle}>
          <p>{withdrawalPendingBody}</p>
        </Notice>
      )}
      {review.submission.state === "uncertain" && (
        <Notice tone="warning" title={submissionUnknownTitle}>
          <p>{submissionUnknownBody}</p>
        </Notice>
      )}
      {review.recovery.state === "operatorAttention" && (
        <Notice tone="warning" title={operatorAttentionTitle}>
          <p>{operatorAttentionBody}</p>
        </Notice>
      )}
    </>
  );
}
