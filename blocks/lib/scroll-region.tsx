import { useEffect, useRef, type ReactNode } from "react";

/**
 * A wide table's own scrolling region: named, reachable by keyboard, and
 * marked with a soft shadow on each edge that has more behind it. The outer
 * element carries `data-more-before` and `data-more-after` while content lies
 * past that edge; the stylesheet draws the shadows over the content, so an
 * opaque header cell cannot hide them.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const edge = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outer = edge.current;
    const inner = region.current;
    if (!outer || !inner) return;
    const update = () => {
      const hidden = inner.scrollWidth - inner.clientWidth;
      const at = Math.abs(inner.scrollLeft);
      outer.toggleAttribute("data-more-before", hidden > 1 && at > 1);
      outer.toggleAttribute("data-more-after", hidden > 1 && at < hidden - 1);
    };
    update();
    inner.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(inner);
    if (inner.firstElementChild) observer.observe(inner.firstElementChild);
    return () => {
      inner.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);
  return (
    <div className="scroll-edge" ref={edge}>
      <div
        className={className}
        ref={region}
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
