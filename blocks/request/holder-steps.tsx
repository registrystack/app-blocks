import type { EntityModel } from "@registrystack/app-runtime";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { usePagesContent } from "@/blocks/pages/pages-content";

/** The places in a holder's change, in the order they come. */
export type HolderStep = "record" | "change" | "answers" | "documents" | "review";

/** Whether any of these requests takes supporting documents, so the documents step is part of the change. */
export function takesDocuments(requests: readonly EntityModel[]): boolean {
  return requests.some((request) => request.operations.attachments?.length);
}

/**
 * Where a holder is in a change: the step's position in words, and the steps
 * as a list with the current one marked. The steps are not links; a reload
 * of any step re-reads the draft from the registry, so a holder moves with
 * each step's own buttons.
 */
export function HolderSteps({
  current,
  documents,
}: {
  current: HolderStep;
  /** Whether the request takes documents; a request that takes none skips that step. */
  documents: boolean;
}) {
  const pages = usePagesContent();
  const locale = useLocale();
  const steps: { id: HolderStep; label: string }[] = [
    { id: "record", label: pages.holderStepRecord },
    { id: "change", label: pages.holderStepChange },
    { id: "answers", label: pages.holderStepAnswers },
    ...(documents
      ? [{ id: "documents" as const, label: pages.holderStepDocuments }]
      : []),
    { id: "review", label: pages.holderStepReview },
  ];
  const index = steps.findIndex((step) => step.id === current);
  return (
    <div className="mb-4">
      <p className="eyebrow">
        {fill(
          pages.holderStepPosition,
          {
            current: index + 1,
            total: steps.length,
          },
          locale,
        )}
      </p>
      <ol
        aria-label={pages.holderStepsLabel}
        className="flex flex-wrap gap-x-5 gap-y-1 text-sm"
      >
        {steps.map((step, position) => (
          <li
            key={step.id}
            aria-current={position === index ? "step" : undefined}
            className={position === index ? "font-semibold" : "muted"}
          >
            {step.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
