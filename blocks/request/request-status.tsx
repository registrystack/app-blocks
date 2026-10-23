import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { RequestView } from "@registrystack/app-runtime";
import { problemView } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { fillNodes } from "@/blocks/lib/format";
import { Notice } from "@/blocks/lib/notice";
import {
  ConfirmedReceipt,
  useBlockContent,
  useLocale,
} from "@/blocks/lib/content";

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
 * A decision a reviewer has neither applied nor let expire. The host reads
 * such a request as approved from BReg's own fields, in a list and on the
 * request page alike.
 */
export function approvedNotApplied(request: RequestView | undefined): boolean {
  return request?.state === "approved";
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
  const locale = useLocale();
  const result = task.result;
  const retry = problemView(task.error);
  if (task.pending) return <Notice>{c.saving}</Notice>;
  if (task.unknown)
    return (
      <Notice tone="warning" title={c.unknownTitle}>
        <p>{c.unknownBody}</p>
        {retry.status !== null && (
          <p>
            {c.retryRefused}
            {retry.message !== null && ` ${retry.message}`}
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
  if (task.error) return renderError(task.error);
  if (result?.outcome === "confirmed")
    return (
      <Notice tone="success" title={c.confirmed}>
        <ConfirmedReceipt receipt={result.receipt} />
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
