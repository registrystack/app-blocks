import type { CaseworkTaskBounds } from "@registrystack/app-runtime";
import {
  useReviewTaskGrants,
  useTaskGrantPanel,
  type TaskGrantCalls,
  type TaskGrantNotice,
  type TaskGrantProblem,
} from "@registrystack/app-runtime/react";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { fill, listOf } from "@/blocks/lib/format";
import { Button } from "@/components/ui/button";
import { useCaseworkContent, type CaseworkContent } from "@/blocks/casework/casework-content";
import { caseworkDateTime } from "@/blocks/casework/shared";

function Bounds({ bounds }: { bounds: CaseworkTaskBounds }) {
  const c = useCaseworkContent();
  const b = useBlockContent();
  const locale = useLocale();
  if (bounds.type === "evidence") return <span>{bounds.requirement}</span>;
  if (bounds.type === "scheduling")
    return (
      <ul>
        {bounds.permissions.map((p) => (
          <li key={`${p.service}/${p.location}`}>
            {fill(
              c.taskGrantPermission,
              {
                service: p.service,
                location: p.location,
                actions: listOf(p.actions, locale),
              },
              locale,
            )}
          </li>
        ))}
      </ul>
    );
  return (
    <ul>
      {bounds.permissions.map((p) => (
        <li key={p.collection}>
          {fill(
            b.labelled,
            { label: p.collection, value: listOf(p.operations, locale) },
            locale,
          )}
        </li>
      ))}
    </ul>
  );
}

/** The agent tasks on one review task, approved through the review task's own routes. */
export function ReviewTaskGrants(props: {
  id: string;
  revision: string;
  blocked: boolean;
}) {
  const { calls, approval } = useReviewTaskGrants(props.id);
  return <TaskGrantsPanel {...props} calls={calls} approval={approval} />;
}

type Approval = ReturnType<typeof useReviewTaskGrants>["approval"];

const problemText: Record<TaskGrantProblem, (c: CaseworkContent) => string> = {
  unavailable: (c) => c.taskUnavailable,
  stale: (c) => c.taskStale,
  "revoke-unconfirmed": (c) => c.taskRevokeUnconfirmed,
  "run-unavailable": (c) => c.taskRunUnavailable,
};
const noticeText: Record<TaskGrantNotice, (c: CaseworkContent) => string> = {
  approved: (c) => c.taskApproved,
  revoked: (c) => c.taskRevoked,
};

/** Preview values live only in this mounted human session view. */
function TaskGrantsPanel({
  id,
  revision,
  blocked,
  calls,
  approval,
}: {
  id: string;
  revision: string;
  blocked: boolean;
  calls: TaskGrantCalls;
  approval: Approval;
}) {
  const c = useCaseworkContent();
  const b = useBlockContent();
  const locale = useLocale();
  const panel = useTaskGrantPanel({ id, revision, blocked, calls, approval });
  const {
    open,
    templates,
    grants,
    selected,
    pending,
    assistantNote,
    listed,
    unconfirmed,
    approving,
    load,
    approve,
    retryApproval,
    revoke,
    dispatch,
  } = panel;
  // BReg and Casework still enforce who may use agent tasks. Hiding the button
  // only stops the page offering a dead end: a panel that would open on the
  // refusal the officer already got.
  if (!panel.offered) return null;
  const error = panel.error ? problemText[panel.error](c) : "";
  const message = panel.message ? noticeText[panel.message](c) : "";
  return (
    <section className="casework-agent-tasks">
      <Button variant="outline" aria-expanded={open} onClick={panel.toggle}>
        {listed === null
          ? c.taskHeading
          : fill(c.taskHeadingCount, { count: String(listed) }, locale)}
      </Button>
      {open && (
        <div className="space-y-4 py-4">
          <p>{c.taskIntro}</p>
          {error && <p role="alert">{error}</p>}
          {unconfirmed && (
            <div role="alert" className="space-y-2">
              <p>{c.taskUnconfirmed}</p>
              {approval.state.state === "unknown" &&
                approval.state.lastRefusal?.message && (
                  <p>{approval.state.lastRefusal.message}</p>
                )}
              {!(
                approval.state.state === "unknown" &&
                approval.state.withoutAuthority
              ) && (
                <Button
                  disabled={pending || approving}
                  onClick={() => void retryApproval()}
                >
                  {c.taskRetry}
                </Button>
              )}
            </div>
          )}
          {message && <p role="status">{message}</p>}
          {assistantNote && <p role="status">{assistantNote}</p>}
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void load()}
          >
            {c.taskRefresh}
          </Button>
          {!pending && !error && templates.length === 0 && (
            <p>{c.taskNoTemplates}</p>
          )}
          {!selected &&
            !blocked &&
            !approval.locked &&
            templates.map((template) => (
              <div key={template.approvalRef}>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => panel.select(template)}
                >
                  {fill(c.taskReview, { label: template.label }, locale)}
                </Button>
              </div>
            ))}
          {selected && !blocked && !unconfirmed && (
            <section className="space-y-3" aria-label={selected.label}>
              <h3>{selected.label}</h3>
              <dl className="facts">
                {[
                  [c.taskAgent, selected.agent.subject],
                  [c.taskIssuer, selected.agent.issuer],
                  [c.taskClient, selected.client],
                  [c.taskResource, selected.resource],
                  [c.taskPurpose, selected.purpose],
                  [c.taskScopes, listOf(selected.scopes, locale)],
                  ...(selected.evidenceContext
                    ? [
                        [
                          c.taskEvidenceAudience,
                          selected.evidenceContext.audience,
                        ],
                        [
                          c.taskRequesterTags,
                          listOf(selected.evidenceContext.requesterTags, locale),
                        ],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div className="definition" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                <div className="definition">
                  <dt>{c.taskBounds}</dt>
                  <dd>
                    <Bounds bounds={selected.bounds} />
                  </dd>
                </div>
              </dl>
              <h4>{c.taskSubjects}</h4>
              <dl className="facts">
                {Object.entries(selected.subjects).map(([key, value]) => (
                  <div className="definition" key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
              <p>
                {fill(
                  c.taskDuration,
                  { minutes: String(selected.lifetimeSeconds / 60) },
                  locale,
                )}
              </p>
              <Button
                disabled={pending || approval.locked}
                onClick={() => void approve()}
              >
                {c.taskApprove}
              </Button>
              <Button
                variant="outline"
                disabled={pending || approval.locked}
                onClick={panel.cancel}
              >
                {c.taskCancel}
              </Button>
            </section>
          )}
          {!pending && grants.length === 0 && !error && <p>{c.taskNoGrants}</p>}
          {grants.map((grant) => (
            <article key={grant.id} className="space-y-2">
              <h3>{grant.agent.subject}</h3>
              <p>{grant.purpose}</p>
              <p>{grant.resource}</p>
              <p>
                {fill(
                  b.labelled,
                  { label: c.taskScopes, value: listOf(grant.scopes, locale) },
                  locale,
                )}
              </p>
              {grant.evidenceContext && (
                <>
                  <p>
                    {fill(
                      b.labelled,
                      {
                        label: c.taskEvidenceAudience,
                        value: grant.evidenceContext.audience,
                      },
                      locale,
                    )}
                  </p>
                  <p>
                    {fill(
                      b.labelled,
                      {
                        label: c.taskRequesterTags,
                        value: listOf(grant.evidenceContext.requesterTags, locale),
                      },
                      locale,
                    )}
                  </p>
                </>
              )}
              <Bounds bounds={grant.bounds} />
              <p>
                {grant.invalidated
                  ? c.taskInvalidated
                  : grant.expiresAt * 1000 <= Date.now()
                    ? c.taskExpired
                    : fill(
                        c.taskUntil,
                        {
                          time: caseworkDateTime(
                            new Date(grant.expiresAt * 1000).toISOString(),
                            locale,
                          ),
                        },
                        locale,
                      )}
              </p>
              {!grant.invalidated && grant.expiresAt * 1000 > Date.now() && (
                <>
                  {grant.dispatchable && !blocked && (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => void dispatch(grant)}
                    >
                      {c.taskRun}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={pending || blocked}
                    onClick={() => void revoke(grant)}
                  >
                    {c.taskRevoke}
                  </Button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
