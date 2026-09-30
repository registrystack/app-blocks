import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { RequestView } from "@registrystack/app-runtime";
import { problemView } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { Notice } from "@/blocks/lib/notice";
import { useBlockContent } from "@/blocks/lib/content";

/**
 * The state of the case, stated before the h1. The caller supplies the
 * sentence, because only it knows the lifecycle.
 */
export function StateNotice({
  state,
  description,
}: {
  state: string;
  description: string;
}) {
  return (
    <Notice tone={state === "applied" ? "success" : "info"}>
      <p>{description}</p>
    </Notice>
  );
}

/**
 * A decision a reviewer has neither applied nor let expire. The register
 * keeps such a request in its submitted state; its review section carries
 * the approval.
 */
export function approvedNotApplied(request: RequestView | undefined): boolean {
  return (
    request?.state === "submitted" &&
    request.review?.result.state === "approved" &&
    request.review.application.state !== "applied" &&
    request.review.application.state !== "expired"
  );
}

/**
 * The outcome of one command: a plain write, a decision, an upload. Shaped
 * like the runtime's own task state, but with the write's own attempt
 * reference renamed, since a block never keeps or compares an attempt id
 * itself, only shows the one its caller hands it.
 */
export interface CommandOutcome {
  pending: boolean;
  unknown: boolean;
  error: Error | null;
  reference: string | null;
  retry: () => Promise<unknown>;
  result:
    | {
        outcome: "confirmed";
        receipt: string;
        resource?: { id: string; entity: string };
      }
    | { outcome: "unknown" }
    | null;
}

/**
 * A command's pending, unconfirmed, failed or confirmed state, in one place
 * so every command in a request (a decision, an upload, a plain write) reads
 * the same way. A plain error is handed to the caller's own error display,
 * since a block carries no protocol-level problem classification.
 */
export function CommandFeedback({
  task,
  reconcileHref,
  renderError,
  onConfirmed,
  confirmedLabel,
}: {
  task: CommandOutcome;
  reconcileHref: string;
  renderError: (error: Error) => ReactNode;
  onConfirmed?: (id: string) => void;
  confirmedLabel?: string;
}) {
  const c = useBlockContent();
  const result = task.result;
  const retryRefusal = problemView(task.error).message;
  if (task.pending) return <Notice>{c.saving}</Notice>;
  if (task.unknown)
    return (
      <Notice tone="warning" title={c.unknownTitle}>
        <p>{c.unknownBody}</p>
        {retryRefusal !== null && (
          <p>
            {c.retryRefused} {retryRefusal}
          </p>
        )}
        <p className="reference">
          {c.receipt}: <span className="font-mono">{task.reference}</span>
        </p>
        <div className="actions">
          <Button onClick={() => void task.retry()}>{c.exactRetry}</Button>
          <Button render={<a href={reconcileHref} />} variant="outline">
            {c.reconcile}
          </Button>
        </div>
      </Notice>
    );
  if (task.error) return renderError(task.error);
  if (result?.outcome === "confirmed")
    return (
      <Notice tone="success" title={c.confirmed}>
        <p className="reference">
          {c.receipt}: <span className="font-mono">{result.receipt}</span>
        </p>
        {onConfirmed && result.resource && (
          <Button onClick={() => onConfirmed(result.resource!.id)}>
            {confirmedLabel ?? c.openRequest}
            <ArrowRight />
          </Button>
        )}
      </Notice>
    );
  return null;
}
