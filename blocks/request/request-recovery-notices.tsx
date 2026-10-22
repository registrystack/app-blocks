import type { RequestView } from "@registrystack/app-runtime";
import { Notice } from "@/blocks/lib/notice";

/**
 * The review's recovery states, each in the reviewing service's own words: a
 * withdrawal it has not confirmed, a submission whose receipt is uncertain,
 * and a recovery that stopped for an operator. Each keeps the request where
 * it is; none offers an action. The titles and bodies are the caller's own,
 * since they may name the reviewing service and the record kind. The
 * operator-attention body is taken from `operatorAttentionBodies` by the
 * recovery's code when it has one, and from `operatorAttentionBody` otherwise.
 * A no-review request uses the same operator notice when native automatic
 * application stops blocked.
 */
export function ReviewRecoveryNotices({
  request,
  withdrawalPendingTitle,
  withdrawalPendingBody,
  submissionUnknownTitle,
  submissionUnknownBody,
  operatorAttentionTitle,
  operatorAttentionBody,
  operatorAttentionBodies = {},
}: {
  request: RequestView | undefined;
  withdrawalPendingTitle: string;
  withdrawalPendingBody: string;
  submissionUnknownTitle: string;
  submissionUnknownBody: string;
  operatorAttentionTitle: string;
  operatorAttentionBody: string;
  operatorAttentionBodies?: Readonly<Record<string, string>>;
}) {
  const review = request?.review;
  const recovery =
    review?.recovery ??
    (request?.application?.state === "blocked"
      ? { state: "operatorAttention", code: request.application.reason }
      : undefined);
  if (!review && !recovery) return null;
  const code = recovery?.code;
  const keyedBody =
    code !== undefined && Object.hasOwn(operatorAttentionBodies, code)
      ? operatorAttentionBodies[code]
      : undefined;
  return (
    <>
      {review?.submission.state === "cancelling" && (
        <Notice tone="warning" title={withdrawalPendingTitle}>
          <p>{withdrawalPendingBody}</p>
        </Notice>
      )}
      {review?.submission.state === "uncertain" && (
        <Notice tone="warning" title={submissionUnknownTitle}>
          <p>{submissionUnknownBody}</p>
        </Notice>
      )}
      {recovery?.state === "operatorAttention" && (
        <Notice tone="warning" title={operatorAttentionTitle}>
          <p>{keyedBody ?? operatorAttentionBody}</p>
        </Notice>
      )}
    </>
  );
}
