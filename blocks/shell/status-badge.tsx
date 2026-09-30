import { useShellContent } from "@/blocks/shell/shell-content";

const unknownStatusCodes = new Set<string>();

/**
 * A record or task's status, worded from the content model by its code: by
 * the first of `labelKeys` the content labels (a work item's come from
 * `workItemStateKeys`), or by the code alone.
 */
export function StatusBadge({
  state,
  served,
  labelKeys = [state],
}: {
  state: string;
  served?: string;
  labelKeys?: readonly string[];
}) {
  const c = useShellContent();
  const label =
    labelKeys
      .map((key) => c.stateLabels[key])
      .find((words) => words !== undefined) ??
    c.recordedStatuses[state] ??
    served;
  if (label === undefined && !unknownStatusCodes.has(state)) {
    unknownStatusCodes.add(state);
    console.warn(`No content label for status "${state}"; using the fallback.`);
  }
  return (
    <span className={`badge badge-${state.replace(/[^a-z-]/g, "")}`}>
      {label ?? c.unknownStatus}
    </span>
  );
}
