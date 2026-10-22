import { useShellContent } from "@/blocks/shell/shell-content";
import { useStandsAsPageTitle } from "@/blocks/shell/page-heading";

/**
 * The one loading indicator a page shows while it has nothing to render yet.
 * With no page heading on the screen it names the screen as its heading one.
 */
export function Loading() {
  const c = useShellContent();
  const standsAsTitle = useStandsAsPageTitle();
  return (
    <div className="loading" role="status">
      <span className="loading-dot" />
      <span
        role={standsAsTitle ? "heading" : undefined}
        aria-level={standsAsTitle ? 1 : undefined}
      >
        {c.loading}
      </span>
    </div>
  );
}
