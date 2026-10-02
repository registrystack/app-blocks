import type { RequesterReviewNotes } from "@registrystack/app-runtime";
import { useBlockContent } from "@/blocks/lib/content";

/**
 * What a reviewer wrote for the request's holder, when a review sent it back
 * or rejected it. Any account the notes are not disclosed to, and any state
 * the read does not resolve to notes, reads as the same not-available
 * sentence; only an "available" read shows the reviewer's own words.
 */
export function ReviewNotes({
  notes,
  noNote,
}: {
  notes: RequesterReviewNotes;
  /** What a read with no note says; the holder's own wording when absent. */
  noNote?: string;
}) {
  const c = useBlockContent();
  if (notes.state === "available")
    return (
      <>
        {notes.notes.map((note) => (
          <p key={note.eventId} className="revision-note">
            {note.note}
          </p>
        ))}
      </>
    );
  if (notes.state === "none") return <p>{noNote ?? c.revisionNoNote}</p>;
  return <p>{c.undisclosedRevisionReason}</p>;
}
