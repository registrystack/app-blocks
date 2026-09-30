import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One polite live region per page: sort, filter and row-count announcements.
 * The message clears after roughly a second so repeating the same
 * announcement re-fires the region.
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
