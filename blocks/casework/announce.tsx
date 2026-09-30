import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One polite live region per page: sort, filter and row-count announcements.
 * The message clears after roughly a second so repeating the same
 * announcement re-fires the region. Kept apart from `shared.tsx`, which
 * already carries a command retry, so the timer here is never read as a
 * command's own retry bookkeeping.
 */
export function LiveAnnouncer({ message }: { message: string }) {
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function useAnnouncement(): [string, (message: string) => void] {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const announce = useCallback((next: string) => {
    setMessage(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 1000);
  }, []);
  return [message, announce];
}
