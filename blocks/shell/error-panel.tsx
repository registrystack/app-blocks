import { useEffect, useRef } from "react";
import { problemView, refusalDetail } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { Notice } from "@/blocks/lib/notice";
import { useShellContent } from "@/blocks/shell/shell-content";

export function ErrorPanel({
  error,
  retry,
  unavailableTitle,
}: {
  error: unknown;
  retry?: () => void;
  /** What is unavailable is called on this page, when not the default. */
  unavailableTitle?: string;
}) {
  const c = useShellContent();
  const panel = useRef<HTMLDivElement>(null);
  const problem = problemView(error);
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
      problem.kind === "recovery-pending"
        ? c.unknownTitle
        : problem.kind === "refused"
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
  } else if (problem.kind === "stale") {
    title = c.staleTitle;
    body = c.staleBody;
  } else if (problem.kind === "conflict") {
    title = c.conflictTitle;
    body = c.conflictBody;
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
      <Notice tone="warning" title={title}>
        <p>{body}</p>
        {problem.supportReference && (
          <p className="reference">
            {c.receipt}:{" "}
            <span className="font-mono">{problem.supportReference}</span>
          </p>
        )}
        {retry && (
          <Button variant="outline" onClick={retry}>
            {c.retry}
          </Button>
        )}
      </Notice>
    </div>
  );
}
