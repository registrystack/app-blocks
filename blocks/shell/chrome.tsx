import { useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedSession } from "@registrystack/app-runtime";
import { Notice } from "@/blocks/lib/notice";
import { useBranding } from "@/blocks/shell/branding";
import { LanguageSwitch } from "@/blocks/shell/language-switch";
import { SignOut, SwitchAccount } from "@/blocks/shell/sign-out";
import { useShellContent } from "@/blocks/shell/shell-content";

/**
 * The signed-in chrome: a sidebar with the brand and the navigation, a header
 * with the account and the language switch, and the page. The caller supplies
 * the navigation itself, so this shell carries no opinion on what places exist.
 */
export function Shell({
  audience,
  session,
  navigation,
  children,
}: {
  audience: "staff" | "service";
  session: AuthenticatedSession;
  navigation: ReactNode;
  children: ReactNode;
}) {
  const c = useShellContent();
  const branding = useBranding();
  const workspace = audience === "staff" ? c.staffName : c.serviceName;
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <div className={`shell shell-${audience}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        {c.skip}
      </a>
      <aside className="sidebar" aria-label={workspace}>
        <a href="#/" className="brand">
          <svg
            className="brand-mark"
            viewBox="0 0 28 28"
            width="28"
            height="28"
            aria-hidden="true"
          >
            <path d="M6 20 9 8h3.5L9.5 20zM12 20l3-12h3.5L15.5 20zM18 20l3-12h3.5L21.5 20z" />
          </svg>
          <span className="brand-name">{c.brand}</span>
          <span className="beta">{c.beta}</span>
        </a>
        <p className="workspace">{workspace}</p>
        {branding.description && (
          <p className="workspace-description mb-4 text-sm leading-snug text-[var(--sidebar-muted)]">
            {branding.description}
          </p>
        )}
        {navigation}
      </aside>
      <div className="shell-column">
        <header className="topbar">
          <p className="crumb">{workspace}</p>
          <div className="account">
            {session.displayName && (
              <div>
                <span>{c.signedInAs}</span>
                <strong>{session.displayName}</strong>
              </div>
            )}
            <LanguageSwitch />
            <SwitchAccount app={session.app ?? audience} />
            <SignOut />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {!online && <Notice tone="warning">{c.offline}</Notice>}
          {children}
          <footer>
            <span>{c.footer}</span>
            <span>{c.footerNote}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
