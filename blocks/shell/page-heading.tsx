import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * The heading a page focuses on arrival, so a hash-routed navigation reads
 * out like a page load to assistive technology. An eyebrow names the
 * section above the title; the action sits beside it, usually a button.
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (location.hash) heading.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {description && <p className="lead">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Whether a state shown in place of a page (loading, a failed read) is the
 * heading one of the screen, because no page heading stands on it. Decided
 * once, as the state arrives, from the document: a state shown beside a
 * page's own heading stays a lower heading.
 */
export function useStandsAsPageTitle(): boolean {
  const [stands, setStands] = useState(false);
  useLayoutEffect(() => {
    setStands(document.querySelector("h1") === null);
  }, []);
  return stands;
}
