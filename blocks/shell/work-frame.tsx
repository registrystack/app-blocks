import { useMemo, type ReactNode } from "react";
import {
  WorkShell as BlockWorkShell,
  currentPlace,
  type NavGroup,
} from "@/blocks/casework/work-shell";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { splitRoute } from "@/blocks/shell/routing";

/**
 * Resolves a route to the current place and wires the staff work shell's
 * navigation and sign-out error to hash routing. Which places exist for a
 * session, and which one its root route stands for, are the caller's own
 * decisions; this block only works out which of the given places the
 * current route is under.
 */
export function WorkFrame({
  displayName,
  brand,
  groups,
  homePath,
  route,
  children,
}: {
  displayName?: string;
  brand: string;
  groups: NavGroup[];
  /** The place the root route stands for, so it is marked current there. */
  homePath: string;
  route: string;
  children: ReactNode;
}) {
  const items = useMemo(() => groups.flat(), [groups]);
  const routePath = splitRoute(route).path;
  const current = currentPlace(items, routePath === "/" ? homePath : routePath);
  return (
    <BlockWorkShell
      displayName={displayName}
      brand={brand}
      groups={groups}
      current={current}
      route={route}
      hrefFor={(path) => `#${path}`}
      navigate={(path) => {
        location.hash = path;
      }}
      renderSignOutError={(error) => <ErrorPanel error={error} />}
    >
      {children}
    </BlockWorkShell>
  );
}
