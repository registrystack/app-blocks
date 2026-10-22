import type { RequesterReviewNotes } from "@registrystack/app-runtime";
import { useBlockContent } from "@/blocks/lib/content";

/**
 * What a reviewer wrote for the request's holder, when a review sent it back
 * or rejected it. The reason that came with the decision is the one reviewer
 * text BReg serves to anyone who may read the request, and it comes first.
 * Any account the notes are not disclosed to, and any state the read does not
 * resolve to notes, reads as the same not-available sentence unless a reason
 * stands in its place; only an "available" read shows the reviewer's notes.
 */
export function ReviewNotes({
  notes,
  noNote,
  reason,
}: {
  notes: RequesterReviewNotes;
  /** What a read with no note says; the holder's own wording when absent. */
  noNote?: string;
  /** The reason the reviewer wrote for the requester with the decision. */
  reason?: string;
}) {
  const c = useBlockContent();
  const decided = reason ? <p className="revision-note">{reason}</p> : null;
  if (notes.state === "available")
    return (
      <>
        {decided}
        {notes.notes.map((note) => (
          <p key={note.eventId} className="revision-note">
            {note.note}
          </p>
        ))}
      </>
    );
  if (decided) return decided;
  if (notes.state === "none") return <p>{noNote ?? c.revisionNoNote}</p>;
  return <p>{c.undisclosedRevisionReason}</p>;
}
