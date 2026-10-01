import { useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedSession } from "@registrystack/app-runtime";
import { Notice } from "@/blocks/lib/notice";
import { SignOut } from "@/blocks/shell/sign-out";
import { useShellContent } from "@/blocks/shell/shell-content";

/**
 * The signed-in chrome: a header with the brand and account, a sidebar for
 * navigation, and the page. The caller supplies the navigation itself, so
 * this shell carries no opinion on what places exist.
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
      <header className="topbar">
        <a href="#/" className="brand">
          {c.brand}
          <span className="beta">{c.beta}</span>
        </a>
        <div className="account">
          {session.displayName && (
            <div>
              <span>{c.signedInAs}</span>
              <strong>{session.displayName}</strong>
            </div>
          )}
          <SignOut />
        </div>
      </header>
      <div className="shell-body">
        <aside
          className="sidebar"
          aria-label={audience === "staff" ? c.staffName : c.serviceName}
        >
          <h2>{audience === "staff" ? c.staffName : c.serviceName}</h2>
          {navigation}
        </aside>
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
