import type { PrefillFailure, VerifiedEvidenceDisplay, VerifiedPrefill } from "@registrystack/app-runtime";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { InPhrase } from "@/blocks/fields/values";
import { fill, fillNodes, longDate } from "@/blocks/lib/format";

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
  const locale = useLocale();
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
            {fill(
              c.prefillAnswerLine,
              {
                label: c.prefillProposed,
                answer: prefill.proposal.value ? c.yes : c.no,
                source: prefill.proposal.sourceLabel,
                date: verifiedOn(prefill.proposal.verifiedAt, locale),
              },
              locale,
            )}
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
          {fill(
            c.prefillAnswerLine,
            {
              label: c.prefillVerified,
              answer: accepted.value ? c.yes : c.no,
              source: accepted.sourceLabel,
              date: verifiedOn(accepted.verifiedAt, locale),
            },
            locale,
          )}{" "}
          {acceptedDiverged ? c.prefillChanged : ""}
        </p>
      )}
      {draftEvidence && (
        <p role="status">
          {draftEvidence.status === "verified"
            ? `${fill(
                c.prefillDraftLine,
                {
                  label: c.prefillVerified,
                  answer: draftEvidence.sourceValue ? c.yes : c.no,
                  date: verifiedOn(draftEvidence.verifiedAt, locale),
                },
                locale,
              )} ${draftDiverged ? c.prefillChanged : ""}`
            : c.prefillInvalid}
        </p>
      )}
    </section>
  );
}

/**
 * The read-only summary of a field's verified evidence, shown once a request
 * is submitted. `changedValue` is passed only when the caller has both a
 * value newer than the verification and the field to show it against. It
 * shows within a line of text, so a value there renders as text alone.
 */
export function VerifiedEvidenceSummary({
  evidence,
  changedValue,
}: {
  evidence: VerifiedEvidenceDisplay;
  changedValue?: ReactNode;
}) {
  const c = useBlockContent();
  const locale = useLocale();
  return (
    <div className="card" role="status">
      {evidence.status === "verified" ? (
        <>
          <h3>{c.prefillVerified}</h3>
          <p>
            {fill(
              c.prefillSummaryLine,
              {
                answer: evidence.sourceValue ? c.yes : c.no,
                source: evidence.sourceLabel,
                date: verifiedOn(evidence.verifiedAt, locale),
              },
              locale,
            )}
          </p>
          {changedValue !== undefined && (
            <p>
              {fillNodes(
                c.labelledSentence,
                {
                  label: c.prefillChanged,
                  value: <InPhrase>{changedValue}</InPhrase>,
                },
                locale,
              )}
            </p>
          )}
        </>
      ) : (
        <p>{c.prefillInvalid}</p>
      )}
    </div>
  );
}

/** When an answer was verified, as a long date; the value as given when it is not a date. */
function verifiedOn(value: string, locale: string): string {
  return longDate(value, locale) ?? value;
}
