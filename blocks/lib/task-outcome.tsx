import { ArrowRight } from "lucide-react";
import { problemView } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import {
  ConfirmedReceipt,
  useBlockContent,
  useLocale,
} from "@/blocks/lib/content";
import { fillNodes } from "@/blocks/lib/format";
import { Notice } from "@/blocks/lib/notice";
import { ErrorPanel } from "@/blocks/shell/error-panel";

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
 * write on a record or request page ends here. The caller supplies where
 * "Check current records" points and what opening a confirmed resource does.
 */
export function TaskFeedback({
  task,
  reconcileHref,
  onConfirmed,
  confirmedLabel,
  recordWrite,
}: {
  task: TaskFeedbackState;
  /** Where "Check current records" points. */
  reconcileHref: string;
  onConfirmed?: (id: string) => void;
  /** What the button that opens the confirmed resource says; "Open request" by default. */
  confirmedLabel?: string;
  /** The task writes records, so a conflict is with the values it sent. */
  recordWrite?: boolean;
}) {
  const c = useBlockContent();
  const locale = useLocale();
  const result = task.result;
  const problem = problemView(task.error);
  if (task.pending) return <Notice>{c.saving}</Notice>;
  if (task.unknown)
    return (
      <Notice tone="warning" title={c.unknownTitle}>
        <p>{c.unknownBody}</p>
        {problem.status !== null && (
          <p>
            {c.retryRefused}
            {problem.message !== null && ` ${problem.message}`}
          </p>
        )}
        <p className="reference">
          {fillNodes(
            c.labelled,
            {
              label: c.receipt,
              value: <span className="font-mono">{task.reference}</span>,
            },
            locale,
          )}
        </p>
        <div className="actions">
          <Button onClick={() => void task.retry()}>{c.exactRetry}</Button>
          <Button render={<a href={reconcileHref} />} variant="outline">
            {c.reconcile}
          </Button>
        </div>
      </Notice>
    );
  // A refusal in the registry's words that names fields is already in the
  // form's error summary, against those fields.
  if (task.error && problem.worded && Object.keys(problem.fieldErrors).length)
    return null;
  if (task.error)
    return <ErrorPanel error={task.error} recordWrite={recordWrite} />;
  if (result?.outcome === "confirmed")
    return (
      <Notice tone="success" title={c.confirmed}>
        {onConfirmed && result.resource && (
          <Button onClick={() => onConfirmed(result.resource!.id)}>
            {confirmedLabel ?? c.openRequest}
            <ArrowRight />
          </Button>
        )}
        <ConfirmedReceipt receipt={result.receipt} />
      </Notice>
    );
  return null;
}
