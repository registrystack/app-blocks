import type { PrefillFailure, VerifiedEvidenceDisplay, VerifiedPrefill } from "@registrystack/app-runtime";
import { displayDate } from "@registrystack/app-runtime";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { longDate } from "@/blocks/lib/format";

/**
 * The consent, request and accept steps of asking a verified source for one
 * field's answer. `heading`, `disclosure` and `requestLabel` are the
 * caller's own, since only it knows which field this requests and from
 * which source. `accepted`/`draftEvidence` are shown only when the caller
 * decides the field they answer is still part of this form.
 */
export function VerifiedPrefillSection({
  heading,
  disclosure,
  requestLabel,
  prefill,
  onAccept,
  accepted,
  acceptedDiverged,
  draftEvidence,
  draftDiverged,
}: {
  heading: string;
  disclosure: string;
  requestLabel: string;
  prefill: {
    consented: boolean;
    busy: boolean;
    consent: () => void;
    request: () => Promise<unknown>;
    proposal: VerifiedPrefill | null;
    error: PrefillFailure | null;
  };
  onAccept: (proposal: VerifiedPrefill) => void;
  accepted: VerifiedPrefill | null;
  acceptedDiverged: boolean;
  draftEvidence?: VerifiedEvidenceDisplay;
  draftDiverged: boolean;
}) {
  const c = useBlockContent();
  return (
    <section aria-label={heading} className="card">
      <h2>{heading}</h2>
      <p>{disclosure}</p>
      {!prefill.consented && (
        <Button
          variant="outline"
          type="button"
          disabled={prefill.busy}
          onClick={prefill.consent}
        >
          {heading}
        </Button>
      )}
      {prefill.consented && (
        <Button
          type="button"
          disabled={prefill.busy}
          onClick={() => void prefill.request()}
        >
          {requestLabel}
        </Button>
      )}
      {prefill.busy && <p role="status">{c.prefillLoading}</p>}
      {prefill.proposal && (
        <div role="status">
          <p>
            {c.prefillProposed}: {prefill.proposal.value ? c.yes : c.no}.{" "}
            {prefill.proposal.sourceLabel},{" "}
            {displayDate(prefill.proposal.verifiedAt)}.
          </p>
          <Button type="button" onClick={() => onAccept(prefill.proposal!)}>
            {c.acceptPrefill}
          </Button>
        </div>
      )}
      {prefill.error && (
        <p role="alert">
          {prefill.error === "uncertain"
            ? c.prefillUncertain
            : prefill.error === "expired"
              ? c.prefillExpired
              : prefill.error === "denied"
                ? c.prefillDenied
                : c.prefillUnavailable}
        </p>
      )}
      {accepted && (
        <p role="status">
          {c.prefillVerified}: {accepted.value ? c.yes : c.no}.{" "}
          {accepted.sourceLabel}, {displayDate(accepted.verifiedAt)}.{" "}
          {acceptedDiverged ? c.prefillChanged : ""}
        </p>
      )}
      {draftEvidence && (
        <p role="status">
          {draftEvidence.status === "verified"
            ? `${c.prefillVerified}: ${draftEvidence.sourceValue ? c.yes : c.no}. ${displayDate(draftEvidence.verifiedAt)}. ${draftDiverged ? c.prefillChanged : ""}`
            : c.prefillInvalid}
        </p>
      )}
    </section>
  );
}

/**
 * The read-only summary of a field's verified evidence, shown once a request
 * is submitted. `changedValue` is passed only when the caller has both a
 * value newer than the verification and the field to show it against.
 */
export function VerifiedEvidenceSummary({
  evidence,
  changedValue,
}: {
  evidence: VerifiedEvidenceDisplay;
  changedValue?: ReactNode;
}) {
  const c = useBlockContent();
  return (
    <div className="card" role="status">
      {evidence.status === "verified" ? (
        <>
          <h3>{c.prefillVerified}</h3>
          <p>
            {evidence.sourceValue ? c.yes : c.no}. {evidence.sourceLabel},{" "}
            {longDate(evidence.verifiedAt)}.
          </p>
          {changedValue !== undefined && (
            <p>
              {c.prefillChanged}: {changedValue}.
            </p>
          )}
        </>
      ) : (
        <p>{c.prefillInvalid}</p>
      )}
    </div>
  );
}
