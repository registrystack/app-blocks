import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useShellContent } from "@/blocks/shell/shell-content";

/** One entry in a flat, single-level navigation list. */
export interface ShellNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes under which this item still counts as current. */
  under?: readonly string[];
}

function isCurrent(item: ShellNavItem, current: string): boolean {
  for (const prefix of [item.path, ...(item.under ?? [])])
    if (current === prefix || current.startsWith(`${prefix}/`)) return true;
  return false;
}

/**
 * A flat list of places a session can reach, one link per item. The caller
 * decides which items exist, in what order and under what labels; this
 * block only lays the list out and marks the current one.
 */
export function Navigation({
  items,
  current,
}: {
  items: readonly ShellNavItem[];
  current: string;
}) {
  const c = useShellContent();
  return (
    <nav aria-label={c.navMain}>
      {items.map((item) => (
        <a
          key={item.path}
          href={`#${item.path}`}
          aria-current={isCurrent(item, current) ? "page" : undefined}
        >
          <item.icon size={18} />
          {item.label}
          <ArrowRight size={14} className="nav-arrow" />
        </a>
      ))}
    </nav>
  );
}
