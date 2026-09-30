import type { ReactNode } from "react";
import { useShellContent } from "@/blocks/shell/shell-content";

/** The chrome around a page shown before a session signs in. */
export function PublicShell({
  audience,
  children,
}: {
  audience: "staff" | "service";
  children: ReactNode;
}) {
  const c = useShellContent();
  return (
    <div className="public-page">
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
        <a className="brand" href="#/">
          {c.brand}
          <span className="beta">{c.beta}</span>
        </a>
        <a className="text-link" href="#/help">
          {c.help}
        </a>
      </header>
      <main className="public-content" id="main" tabIndex={-1}>
        <p className="eyebrow">
          {audience === "service" ? c.serviceName : c.staffName}
        </p>
        {children}
      </main>
      <footer className="public-footer">
        <span>{c.footerNote}</span>
        <a href={audience === "service" ? "/staff/" : "/service/"}>
          {audience === "service" ? c.staffEntryLink : c.serviceEntryLink}
        </a>
      </footer>
    </div>
  );
}
