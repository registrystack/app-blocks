import type { CaseworkTaskBounds } from "@registrystack/app-runtime";
import {
  useCaseworkTaskGrants,
  useReviewTaskGrants,
  useTaskGrantPanel,
  type TaskGrantCalls,
  type TaskGrantNotice,
  type TaskGrantProblem,
} from "@registrystack/app-runtime/react";
import { fill } from "@/blocks/lib/format";
import { Button } from "@/components/ui/button";
import { useCaseworkContent, type CaseworkContent } from "@/blocks/casework/casework-content";
import { caseworkDateTime } from "@/blocks/casework/shared";

function Bounds({ bounds }: { bounds: CaseworkTaskBounds }) {
  if (bounds.type === "evidence") return <span>{bounds.requirement}</span>;
  if (bounds.type === "scheduling")
    return (
      <ul>
        {bounds.permissions.map((p) => (
          <li key={`${p.service}/${p.location}`}>
            {p.service} / {p.location}: {p.actions.join(", ")}
          </li>
        ))}
      </ul>
    );
  return (
    <ul>
      {bounds.permissions.map((p) => (
        <li key={p.collection}>
          {p.collection}: {p.operations.join(", ")}
        </li>
      ))}
    </ul>
  );
}

/** The agent tasks on one Casework work item. */
export function CaseworkTaskGrants(props: {
  id: string;
  revision: string;
  blocked: boolean;
}) {
  const { calls, approval } = useCaseworkTaskGrants(props.id);
  return <TaskGrantsPanel {...props} calls={calls} approval={approval} />;
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
  // BREG and Casework still enforce who may use agent tasks. Hiding the button
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
          : fill(c.taskHeadingCount, { count: String(listed) })}
      </Button>
      {open && (
        <div className="space-y-4 py-4">
          <p>{c.taskIntro}</p>
          {error && <p role="alert">{error}</p>}
          {unconfirmed && (
            <div role="alert" className="space-y-2">
              <p>{c.taskUnconfirmed}</p>
              {approval.state.state === "unknown" &&
                approval.state.lastRefusal && (
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
                  {fill(c.taskReview, { label: template.label })}
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
                  [c.taskScopes, selected.scopes.join(", ")],
                  ...(selected.evidenceContext
                    ? [
                        [
                          c.taskEvidenceAudience,
                          selected.evidenceContext.audience,
                        ],
                        [
                          c.taskRequesterTags,
                          selected.evidenceContext.requesterTags.join(", "),
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
                {fill(c.taskDuration, {
                  minutes: String(selected.lifetimeSeconds / 60),
                })}
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
                {c.taskScopes}: {grant.scopes.join(", ")}
              </p>
              {grant.evidenceContext && (
                <>
                  <p>
                    {c.taskEvidenceAudience}: {grant.evidenceContext.audience}
                  </p>
                  <p>
                    {c.taskRequesterTags}:{" "}
                    {grant.evidenceContext.requesterTags.join(", ")}
                  </p>
                </>
              )}
              <Bounds bounds={grant.bounds} />
              <p>
                {grant.invalidated
                  ? c.taskInvalidated
                  : grant.expiresAt * 1000 <= Date.now()
                    ? c.taskExpired
                    : fill(c.taskUntil, {
                        time: caseworkDateTime(
                          new Date(grant.expiresAt * 1000).toISOString(),
                        ),
                      })}
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
