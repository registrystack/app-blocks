import { usePreviousSubmission } from "@registrystack/app-runtime/react";
import { Notice } from "@/blocks/lib/notice";
import { useShellContent } from "@/blocks/shell/shell-content";

/** Warns that an earlier submission from this device needs checking. */
export function PreviousSubmissionNotice() {
  const c = useShellContent();
  if (!usePreviousSubmission()) return null;
  return (
    <Notice tone="warning" title={c.recoveryTitle}>
      <p>{c.previousContextBody}</p>
    </Notice>
  );
}
