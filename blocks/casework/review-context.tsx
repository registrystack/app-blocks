import type { RegistryModel, ReviewTaskDetail } from "@registrystack/app-runtime";
import { fill } from "@/blocks/lib/format";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { Notice } from "@/blocks/casework/shared";
import { Subject } from "@/blocks/casework/subject";

/**
 * What a reviewer reads before deciding: the task's subject, under the
 * heading that names it, the warning a rebound source projection earns, and
 * the policy line naming the review kind the task was raised under. A page
 * that already read the registry model passes it on to the subject.
 */
export function ReviewContext({
  task,
  model,
}: {
  task: ReviewTaskDetail;
  model?: RegistryModel;
}) {
  const c = useCaseworkContent();
  const context = task.context;
  return (
    <section className="review-context">
      <h2>{c.contextHeading}</h2>
      {context.strategy === "source" &&
        context.bindingStatus === "binding_changed" && (
          <Notice tone="warning">{c.contextSourceChanged}</Notice>
        )}
      <Subject task={task} model={model} />
      <p className="muted">
        {fill(c.policyLine, { id: task.policy.id, version: task.policy.version })}
      </p>
    </section>
  );
}
