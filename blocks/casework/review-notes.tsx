import { useState } from "react";
import type { ReviewNoteAudience } from "@registrystack/app-runtime";
import { useReviewNote } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/blocks/fields/input-field";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { caseworkRefusalText, Notice, Unconfirmed } from "@/blocks/casework/shared";

/**
 * A note on the request, for other reviewers or for the requester. Fetches
 * its own note command from the request id.
 */
export function NotesPanel({ requestId }: { requestId: string }) {
  const c = useCaseworkContent();
  const note = useReviewNote(requestId);
  const [audience, setAudience] = useState<ReviewNoteAudience>("reviewers");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const state = note.state;
  async function add() {
    if (!text.trim()) {
      setError(c.noteEmpty);
      return;
    }
    setError("");
    const next = await note.add(audience, text);
    if (next.state === "confirmed") setText("");
  }
  return (
    <section className="review-notes">
      <h2>{c.notesHeading}</h2>
      <fieldset disabled={note.locked}>
        <div role="radiogroup" aria-label={c.audienceLegend}>
          {(["reviewers", "requester"] as const).map((value) => (
            <label key={value} htmlFor={`review-audience-${value}`}>
              <input
                type="radio"
                id={`review-audience-${value}`}
                name="review-audience"
                checked={audience === value}
                onChange={() => setAudience(value)}
              />{" "}
              {value === "reviewers" ? c.audienceReviewers : c.audienceRequester}
            </label>
          ))}
        </div>
        <InputField
          name="review-note"
          label={c.noteLabel}
          value={text}
          multiline
          onChange={setText}
          error={error}
        />
      </fieldset>
      <div className="actions">
        <Button
          variant="outline"
          disabled={note.locked}
          onClick={() => void add()}
        >
          {c.addNote}
        </Button>
      </div>
      {state.state === "confirmed" && (
        <Notice tone="success">{c.noteAdded}</Notice>
      )}
      {state.state === "refused" && (
        <Notice tone="warning">
          {caseworkRefusalText(c, state.refusal, c.taskNotApplied)}
        </Notice>
      )}
      <Unconfirmed
        // A note has no read back; only resending it can settle it.
        command={{
          state,
          retry: note.retry,
          dismissUnknown: note.dismissUnknown,
        }}
        text={c.noteUnconfirmed}
        retryLabel={c.retryNote}
        {...(note.expired
          ? { replaceText: c.noteExpired, stopLabel: c.dismiss }
          : {})}
      />
    </section>
  );
}
