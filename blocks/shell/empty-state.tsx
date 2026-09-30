import type { ReactNode } from "react";
import { Library } from "lucide-react";

/** What a page shows in place of a list or a record that has nothing in it. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Library aria-hidden="true" size={28} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
