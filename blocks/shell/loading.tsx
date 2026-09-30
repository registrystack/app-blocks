import { useShellContent } from "@/blocks/shell/shell-content";

/** The one loading indicator a page shows while it has nothing to render yet. */
export function Loading() {
  const c = useShellContent();
  return (
    <div className="loading" role="status">
      <span className="loading-dot" />
      {c.loading}
    </div>
  );
}
