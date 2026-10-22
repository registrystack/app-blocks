import type {
  ReviewPolicyStage,
  ReviewPolicySummary,
} from "@registrystack/app-runtime";
import { useReviewPolicies } from "@registrystack/app-runtime/react";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { WhenProfile } from "@/blocks/pages/casework-landing";
import {
  useReviewPageContent,
  type ReviewPageContent,
} from "@/blocks/pages/casework-review-content";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";

/** The items joined with "and", as `locale` joins them. */
function list(items: string[], locale: string): string {
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(items);
}

function Stage({
  stage,
  number,
}: {
  stage: ReviewPolicyStage;
  number: number;
}) {
  const r = useReviewPageContent();
  const locale = useLocale();
  const profiles = [
    ...new Set(
      stage.decidingProfiles.map((id) => r.howProfiles[id] ?? r.howProfileUnnamed),
    ),
  ];
  // An id reaches the screen only through the page content's wording; the
  // queue label is Casework's own display text.
  const name = r.howStageNames[stage.id] ?? (stage.queueLabel || undefined);
  return (
    <li className="flex flex-col gap-1">
      <h3>
        {name
          ? fill(r.howStage, { number: String(number), name }, locale)
          : fill(r.howStageUnnamed, { number: String(number) }, locale)}
      </h3>
      <p>{fill(r.howQueue, { queue: stage.queueLabel }, locale)}</p>
      <p>{fill(r.howReviewedBy, { profiles: list(profiles, locale) }, locale)}</p>
      <p>
        {fill(r.howApprovals, { count: stage.requiredApprovals }, locale)}
      </p>
      {stage.excludeInitiator && <p>{r.howExcludesSubmitter}</p>}
      {stage.excludePreviousStageReviewers && <p>{r.howExcludesEarlier}</p>}
    </li>
  );
}

function Policy({
  policy,
  number,
}: {
  policy: ReviewPolicySummary;
  number: number;
}) {
  const r: ReviewPageContent = useReviewPageContent();
  const locale = useLocale();
  const deadlines = policy.clocks.flatMap((id) => r.howDeadlineNames[id] ?? []);
  const unnamedDeadlines = policy.clocks.some((id) => !r.howDeadlineNames[id]);
  return (
    <section className="flex flex-col gap-4" aria-labelledby={`policy-${number}`}>
      <h2 id={`policy-${number}`}>
        {r.howPolicyNames[policy.id] ??
          fill(r.howPolicyUnnamed, { number: String(number) }, locale)}
      </h2>
      <ol className="flex flex-col gap-4 ps-0 list-none">
        {policy.stages.map((stage, index) => (
          <Stage key={`${stage.id}-${index}`} stage={stage} number={index + 1} />
        ))}
      </ol>
      <div className="flex flex-col gap-1">
        <h3>{r.howDeadlines}</h3>
        {policy.clocks.length === 0 ? (
          <p className="muted">{r.howDeadlinesNone}</p>
        ) : (
          <ul>
            {deadlines.map((name) => (
              <li key={name}>{name}</li>
            ))}
            {unnamedDeadlines && <li>{r.howDeadlineUnnamed}</li>}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3>{r.howOutcomes}</h3>
        <ul>
          {policy.outcomes.map((outcome) => (
            <li key={outcome.id}>
              {fill(
                r.howOutcome,
                {
                  label: outcome.label,
                  meaning:
                    r.howSettlements[outcome.settlement] ?? outcome.settlement,
                },
                locale,
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Policies() {
  const r = useReviewPageContent();
  const read = useReviewPolicies();
  if (read.error)
    return (
      <ErrorPanel
        error={read.error}
        retry={() => void read.refetch()}
        unavailableTitle={r.howUnavailable}
      />
    );
  if (!read.data) return <Loading />;
  if (read.data.items.length === 0) return <p className="muted">{r.howNone}</p>;
  return (
    <div className="flex flex-col gap-8">
      {read.data.items.map((policy, index) => (
        <Policy key={policy.id} policy={policy} number={index + 1} />
      ))}
    </div>
  );
}

/**
 * How review works here, from Casework's own review policies: each policy's
 * stages in order, which profiles review at each, the deadlines that run,
 * that a submitter never reviews their own request where a stage excludes its
 * initiator, and how a review can end. The page counts nothing: it reads the
 * policies, never the tasks.
 */
export function CaseworkHowReviewWorksPage() {
  const r = useReviewPageContent();
  return (
    <WhenProfile profiles={["staff", "supervisor", "administrator"]}>
      <PageHeading title={r.howTitle} description={r.howDescription} />
      <Policies />
    </WhenProfile>
  );
}
