import { useEffect, useRef } from "react";
import { problemView, refusalDetail } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { Notice } from "@/blocks/lib/notice";
import { useStandsAsPageTitle } from "@/blocks/shell/page-heading";
import { useShellContent } from "@/blocks/shell/shell-content";

export function ErrorPanel({
  error,
  retry,
  unavailableTitle,
  recordWrite,
}: {
  error: unknown;
  retry?: () => void;
  /** What is unavailable is called on this page, when not the default. */
  unavailableTitle?: string;
  /** The problem answers a record write, whose conflict is with the values sent. */
  recordWrite?: boolean;
}) {
  const c = useShellContent();
  const panel = useRef<HTMLDivElement>(null);
  const problem = problemView(error);
  const standsAsTitle = useStandsAsPageTitle();
  useEffect(() => panel.current?.focus(), [error]);
  // Typed Casework problems carry maintained user-facing sentences. Any
  // other host answer uses local safe wording because its detail can carry
  // facts that are not meant as page copy.
  let title = c.serviceUnavailable,
    body = c.serviceUnavailableBody;
  if (problem.worded) {
    // The registry's own words for a refused write, from its UI model.
    title = c.registryRefusedTitle;
    body = problem.message!;
  } else if (problem.casework) {
    title =
      problem.kind === "refused"
        ? c.caseworkRefusedTitle
        : problem.kind === "unavailable"
          ? (unavailableTitle ?? c.unavailable)
          : problem.kind === "stale"
            ? c.staleTitle
            : problem.kind === "conflict"
              ? c.conflictTitle
              : c.serviceUnavailable;
    // Casework words a missing source profile for the host, not the officer.
    body =
      refusalDetail(problem) === "source-profile-required"
        ? c.sourceProfileRequired
        : problem.message!;
  } else if (problem.kind === "refused") {
    title = c.refusedTitle;
    body =
      refusalDetail(problem) === "outside-boundary"
        ? c.outsideBoundaryBody
        : c.refusedBody;
  } else if (problem.kind === "contract-changed") {
    title = c.contractChangedTitle;
    body = c.contractChangedBody;
  } else if (problem.kind === "session-ended") {
    title = c.expiredTitle;
    body = c.expiredBody;
  } else if (problem.kind === "stale" && problem.code === "action.guard_failed") {
    // The record did not change under the person: the action is not allowed
    // for it as it is now, and a reload shows the action unavailable.
    title = c.actionUnavailableTitle;
    body = c.actionUnavailableBody;
  } else if (problem.kind === "stale") {
    title = c.staleTitle;
    body = c.staleBody;
  } else if (
    problem.kind === "conflict" &&
    recordWrite &&
    problem.code === "action.conflict"
  ) {
    // A record write has no request to move on; its values clash with a
    // record or a rule. The registry does not say which, so neither do we.
    // An expired or mismatched action, or a record that moved, is no value
    // clash: the form must be reopened, so it keeps the conflict wording.
    title = c.valuesConflictTitle;
    body = c.valuesConflictBody;
  } else if (problem.kind === "conflict") {
    title = c.conflictTitle;
    body = c.conflictBody;
  } else if (problem.code === "validation.failed") {
    title = c.invalidTitle;
    body = c.invalidBody;
  } else if (problem.kind === "capacity") {
    title = c.capacityTitle;
    body = c.capacityBody;
  } else if (problem.kind === "unavailable") {
    // What is unavailable has its own name on each page; the caller supplies
    // it through `unavailableTitle` so this generic panel does not misname it.
    title = unavailableTitle ?? c.unavailable;
    body = c.unavailableBody;
  }
  return (
    <div className="error-panel" ref={panel} tabIndex={-1}>
      <Notice tone="warning">
        {standsAsTitle ? (
          <div role="heading" aria-level={1} className="notice-title">
            {title}
          </div>
        ) : (
          <h2>{title}</h2>
        )}
        <p>{body}</p>
        {retry && (
          <Button variant="outline" onClick={retry}>
            {c.retry}
          </Button>
        )}
        {problem.supportReference && (
          <details className="reference">
            <summary>{c.receipt}</summary>
            <p>{c.receiptHelp}</p>
            <p className="font-mono">{problem.supportReference}</p>
          </details>
        )}
      </Notice>
    </div>
  );
}
