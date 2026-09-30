import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/** A link back to an enclosing hash route, worded by the caller. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="back-link" href={`#${href}`}>
      <ArrowLeft size={16} />
      {children}
    </a>
  );
}
