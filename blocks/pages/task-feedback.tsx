import { ArrowRight } from "lucide-react";
import { problemView } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { Notice } from "@/blocks/lib/notice";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";

/** The outcome of a record or request command, as a page's own write tracks it. */
export interface TaskFeedbackState {
  pending: boolean;
  unknown: boolean;
  error: Error | null;
  /** This attempt's own identifier, shown as its support reference while unconfirmed. */
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
 * A command's outcome: sending, an unconfirmed result with its retry, a
 * refusal, or a confirmed receipt with a link to what it created. Every
 * write on a record or request page ends here.
 */
export function TaskFeedback({
  task,
  onConfirmed,
  confirmedLabel,
  reconcileHref,
}: {
  task: TaskFeedbackState;
  onConfirmed?: (id: string) => void;
  /** What the button that opens the confirmed resource says; "Open request" by default. */
  confirmedLabel?: string;
  /** Where "Check current records" points; the register's own requests list by default. */
  reconcileHref?: string;
}) {
  const c = useBlockContent();
  const routes = useRegisterRoutes();
  const reconcile = reconcileHref ?? `#${routes.requests}`;
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
          <Button render={<a href={reconcile} />} variant="outline">
            {c.reconcile}
          </Button>
        </div>
      </Notice>
    );
  if (task.error) return <ErrorPanel error={task.error} />;
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
