import { useMemo, type ReactNode } from "react";
import {
  WorkShell as BlockWorkShell,
  currentPlace,
  type NavGroup,
} from "@/blocks/casework/work-shell";
import { useEndSession } from "@registrystack/app-runtime/react";
import { useBranding } from "@/blocks/shell/branding";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import {
  LanguageMenuGroup,
  useOfferedLanguages,
} from "@/blocks/shell/language-switch";
import { splitRoute } from "@/blocks/shell/routing";
import { useShellContent } from "@/blocks/shell/shell-content";
import { switchAccount } from "@/blocks/shell/sign-out";

/**
 * Resolves a route to the current place and wires the staff work shell's
 * navigation and sign-out error to hash routing. It applies the UI model's
 * accent, shows its app description, and offers the UI model's languages and
 * switching account into the session's own app. Which places exist for a
 * session, and which one its root route stands for, are the caller's own
 * decisions; this block only works out which of the given places the
 * current route is under.
 */
export function WorkFrame({
  displayName,
  app,
  brand,
  groups,
  homePath,
  route,
  children,
}: {
  displayName?: string;
  /** The id of the app the session signs in to; switching account returns to it. */
  app?: string;
  brand: string;
  groups: NavGroup[];
  /** The place the root route stands for, so it is marked current there. */
  homePath: string;
  route: string;
  children: ReactNode;
}) {
  const c = useShellContent();
  const branding = useBranding();
  const languages = useOfferedLanguages();
  const endSession = useEndSession();
  const items = useMemo(() => groups.flat(), [groups]);
  const { path: routePath, query } = splitRoute(route);
  // A form opened from a page, or one that returns to it, belongs to that
  // page's place, however that page was narrowed.
  const openedFrom = query.get("return") ?? query.get("back");
  const placePath =
    openedFrom && /^\/(?![/\\])/.test(openedFrom)
      ? splitRoute(openedFrom).path
      : routePath;
  const current = currentPlace(items, placePath === "/" ? homePath : placePath);
  return (
    <BlockWorkShell
      displayName={displayName}
      brand={brand}
      description={branding.description}
      accountChoices={languages && <LanguageMenuGroup {...languages} />}
      switchAccount={
        app === undefined
          ? undefined
          : {
              label: c.switchAccount,
              run: () =>
                switchAccount(endSession, (url) => window.location.assign(url), app),
            }
      }
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
