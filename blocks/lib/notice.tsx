import type { ReactNode } from "react";

/**
 * A banner for a page-level state or outcome: informational by default, a
 * warning that interrupts (announced as an alert), or a success. Blocks
 * cannot reach the app's own primitives, so this is the block-side home for
 * the same "notice notice-<tone>" markup the rest of the page uses, kept
 * identical so a block's banner looks and behaves like everything around it.
 */
export function Notice({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return (
    <div
      className={`notice notice-${tone}`}
      role={tone === "warning" ? "alert" : "status"}
    >
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
