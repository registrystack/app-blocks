import { useEffect, useState, type ReactNode } from "react";
import {
  planReviewResult,
  rereadsOnRefusal,
  reviewResultMissing,
  reviewResultValues,
  type ReviewDecision,
  type ReviewJson,
  type ReviewOutcome,
  type ReviewResultField,
  type ReviewResultPlan,
  type ReviewSettlement,
  type ReviewTaskDetail,
} from "@registrystack/app-runtime";
import {
  useReviewDraft,
  useReviewHistory,
  useReviewPolicies,
  useSendBack,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { InputField } from "@/blocks/fields/input-field";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import {
  caseworkRefusalText,
  ErrorSummary,
  Notice,
  Unconfirmed,
} from "@/blocks/casework/shared";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";

/**
 * A task's decision and the officer's own draft on it. The context above them,
 * the hold that lets an officer decide, and the notes and history below stay
 * with the caller; each panel here reads and writes on its own.
 */

const decisionTypes: Record<ReviewSettlement, ReviewDecision["type"]> = {
  approved: "approve",
  rejected: "reject",
  changes_requested: "changes_requested",
  answered: "answer",
};
/** The field id a host validation key names, as this form lays its fields out. */
function fieldId(key: string): string | null {
  if (key === "reason") return "review-reason";
  if (key === "outcome") return "review-outcome";
  if (key === "publicReason") return "review-public-reason";
  if (key.startsWith("result.")) return `review-result-${key.slice(7)}`;
  return null;
}

function ResultField({
  field,
  value,
  onChange,
  error,
  required,
}: {
  field: ReviewResultField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required: boolean;
}) {
  const id = `review-result-${field.name}`;
  const control = field.control;
  if (control.kind === "checkbox")
    return (
      <div className="field">
        <label htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          />{" "}
          {field.name}
        </label>
      </div>
    );
  return (
    <InputField
      name={id}
      label={field.name}
      value={value}
      onChange={onChange}
      error={error}
      required={required}
      multiline={control.kind === "textarea"}
      type={
        control.kind === "date"
          ? "date"
          : control.kind === "number"
            ? "number"
            : "text"
      }
      {...(control.kind === "choices" ? { options: control.options } : {})}
      {...(control.kind === "number"
        ? {
            ...(control.min !== undefined ? { min: control.min } : {}),
            ...(control.max !== undefined ? { max: control.max } : {}),
            ...(control.step !== undefined ? { step: control.step } : {}),
          }
        : {})}
    />
  );
}

/**
 * The reason the requester will see, offered when the chosen outcome asks for
 * or allows one. One line: Casework refuses line breaks in it.
 */
export function PublicReasonField({
  outcome,
  value,
  onChange,
  error,
}: {
  outcome: ReviewOutcome | undefined;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const c = useCaseworkContent();
  if (!outcome || outcome.publicReason === "none") return null;
  return (
    <InputField
      name="review-public-reason"
      label={c.publicReason}
      hint={c.publicReasonHint}
      value={value}
      required={outcome.publicReason === "required"}
      onChange={onChange}
      error={error}
    />
  );
}

/**
 * What a confirmed decision led to, read from the decided task's receipt and
 * the history entries recorded at or after the decision: the review moved on,
 * settled, or sent the request back. The decide route confirms only the
 * decision, so a case the reads do not show (an approval that needs more
 * approvals in its stage, a history page not yet loaded) says nothing.
 */
function NextStep({
  task,
  stageNames,
}: {
  task: ReviewTaskDetail;
  stageNames: Readonly<Record<string, string>> | undefined;
}) {
  const c = useCaseworkContent();
  const locale = useLocale();
  const history = useReviewHistory(task.requestId);
  const policies = useReviewPolicies();
  const receipt = task.decisionReceipt;
  if (!receipt) return null;
  if (receipt.decision === "changes_requested")
    return <Notice tone="success">{c.sentBack}</Notice>;
  const decidedAt = Date.parse(receipt.decidedAt);
  const since = new Set(
    (history.data ?? [])
      .filter((entry) => Date.parse(entry.occurredAt) >= decidedAt)
      .map((entry) => entry.kind),
  );
  if (since.has("stage_advanced")) {
    const next = policies.data?.items.find(
      (policy) => policy.id === task.policy.id,
    )?.stages[task.stageIndex + 1];
    const name =
      next && (stageNames?.[next.id] ?? (next.queueLabel || undefined));
    return (
      <Notice tone="success">
        {name ? fill(c.nextStage, { stage: name }, locale) : c.nextStageUnnamed}
      </Notice>
    );
  }
  if (since.has("review_settled")) {
    if (receipt.decision === "approve")
      return <Notice tone="success">{c.settledApproved}</Notice>;
    if (receipt.decision === "reject")
      return <Notice tone="success">{c.settledRejected}</Notice>;
  }
  return null;
}

/**
 * Where approving leads, read from the task's review policy: on to the next
 * stage, or to the end of the review. A stage that needs more than one
 * approval may stay where it is after this one, so it says nothing there, as
 * it does while the policy is unread or names another stage at this place.
 */
function ApprovalLeadsTo({
  task,
  stageNames,
}: {
  task: ReviewTaskDetail;
  stageNames: Readonly<Record<string, string>> | undefined;
}) {
  const c = useCaseworkContent();
  const locale = useLocale();
  const stages = useReviewPolicies().data?.items.find(
    (policy) => policy.id === task.policy.id,
  )?.stages;
  const stage = stages?.[task.stageIndex];
  if (!stages || stage?.id !== task.stageId || stage.requiredApprovals > 1)
    return null;
  const next = stages[task.stageIndex + 1];
  if (!next) return <p className="muted">{c.approvesSettles}</p>;
  const name = stageNames?.[next.id] ?? (next.queueLabel || undefined);
  return (
    <p className="muted">
      {name
        ? fill(c.approvesToStage, { stage: name }, locale)
        : c.approvesToStageUnnamed}
    </p>
  );
}

/**
 * A task's decision: the outcome, its reason and result, and the note a
 * send-back or a rejection sends its requester. Fetches its own send-back
 * command from the task id, so the caller supplies only the task and how to
 * read it again.
 */
export function DecisionPanel({
  task,
  stageNames,
  reread,
  rereading,
}: {
  task: ReviewTaskDetail;
  /** Names a stage by its stage id, in the page's wording; a stage with no entry reads as its queue. */
  stageNames?: Readonly<Record<string, string>>;
  reread: () => void;
  rereading: boolean;
}) {
  const c = useCaseworkContent();
  const locale = useLocale();
  const sendBack = useSendBack(task.taskId);
  const { decision, note } = sendBack;
  const [picked, setPicked] = useState("");
  const [reason, setReason] = useState("");
  const [publicReason, setPublicReason] = useState("");
  const [requesterNote, setRequesterNote] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [whole, setWhole] = useState("");
  const state = decision.state;
  useEffect(() => {
    if (rereadsOnRefusal(state)) reread();
    if (state.state === "refused" && state.refusal.kind === "validation") {
      const mapped: Record<string, string> = {};
      const rest: string[] = [];
      for (const [key, message] of Object.entries(state.refusal.fields)) {
        const id = fieldId(key);
        if (id) mapped[id] = message;
        else rest.push(message);
      }
      setErrors(mapped);
      setWhole(
        rest.join(" ") ||
          (Object.keys(mapped).length
            ? ""
            : state.refusal.message || c.caseworkRefusedTitle),
      );
    }
    // A refusal is read once, when it arrives: `state` is only ever replaced
    // (never mutated) on a genuine transition, so its own identity already
    // keys each arrival uniquely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.state === "refused" ? state : null]);

  // Only an approval review may approve; its approved outcomes come first, and
  // a single one is the kit's own approve choice.
  const approvals = task.policy.outcomes.filter(
    (outcome) => outcome.settlement === "approved",
  );
  const others = task.policy.outcomes.filter(
    (outcome) => outcome.settlement !== "approved",
  );
  const offered: { id: string; label: string; plan: ReviewResultPlan }[] = [
    ...(task.policy.purpose === "approval" ? approvals : []),
    ...others,
  ].map((outcome) => ({
    id: outcome.id,
    label:
      outcome.settlement === "approved" && approvals.length === 1
        ? c.approve
        : outcome.label,
    plan: planReviewResult(task.policy, outcome.id, task.resultConstraints),
  }));
  const blocked = offered.filter((option) => option.plan.blocked);
  const choices = offered.filter((option) => !option.plan.blocked);
  // A choice a re-read withdrew or blocked no longer counts as chosen.
  const chosen = choices.some((option) => option.id === picked) ? picked : "";
  const plan = choices.find((option) => option.id === chosen)?.plan;
  const approves = plan?.outcome.settlement === "approved";
  const reasonRequired = plan?.reasonRequired ?? false;
  const publicReasonAsked = plan && plan.outcome.publicReason !== "none";
  // A request sent back for changes carries a note its requester reads. A
  // rejected one carries none: its requester reads the public reason, which the
  // outcome may refuse, and a note would give the explanation it withholds.
  const sendsBack = plan?.outcome.settlement === "changes_requested";

  function submit() {
    const found: Record<string, string> = {};
    if (!chosen) found["review-outcome"] = c.chooseOutcome;
    if (reasonRequired && !reason.trim())
      found["review-reason"] = c.reasonRequired;
    if (plan?.outcome.publicReason === "required" && !publicReason.trim())
      found["review-public-reason"] = c.publicReasonRequired;
    if (sendsBack && !requesterNote.trim())
      found["review-requester-note"] = c.requesterNoteRequired;
    let result: Record<string, ReviewJson> | undefined;
    if (plan?.resultDeclared) {
      const captured = reviewResultValues(plan, values);
      const given = Object.keys(captured).length > 0;
      if (plan.resultRequired || given) {
        for (const name of reviewResultMissing(plan, values))
          found[`review-result-${name}`] = fill(
            c.resultMissing,
            { field: name },
            locale,
          );
        result = captured;
      }
    }
    setErrors(found);
    setWhole("");
    if (Object.keys(found).length || !plan) return;
    const type = decisionTypes[plan.outcome.settlement];
    const shared =
      publicReasonAsked && publicReason.trim() ? { publicReason } : {};
    // An approval records no private reason and no result.
    const next: ReviewDecision =
      type === "approve"
        ? { type, outcome: plan.outcome.id, ...shared }
        : {
            type,
            outcome: plan.outcome.id,
            ...(reason.trim() ? { reason } : {}),
            ...shared,
            ...(result ? { result } : {}),
          };
    if (sendsBack) void sendBack.sendBack(task, next, requesterNote);
    else void decision.decide(task, next);
  }

  const deciding = task.heldByYou && task.status === "held";
  const noteState = note.state;
  if (!deciding && state.state === "idle" && noteState.state === "idle")
    return null;
  return (
    <section className="decide-panel">
      <h2>{c.decisionHeading}</h2>
      {state.state === "confirmed" && (
        <Notice tone="success">{c.decided}</Notice>
      )}
      {state.state === "confirmed" && task.decisionReceipt && (
        <NextStep task={task} stageNames={stageNames} />
      )}
      {state.state === "refused" && state.refusal.kind !== "validation" && (
        <Notice tone="warning">
          {caseworkRefusalText(c, state.refusal, c.decisionNotApplied)}
        </Notice>
      )}
      {whole && <Notice tone="warning">{whole}</Notice>}
      <Unconfirmed
        command={decision}
        text={c.decisionUnconfirmed}
        retryLabel={c.retryDecision}
        {...(decision.decidedUnattributed
          ? { replaceText: c.decisionUnattributed }
          : {})}
      />
      {noteState.state === "confirmed" && (
        <Notice tone="success">{c.requesterNoteSent}</Notice>
      )}
      {noteState.state === "refused" && (
        <Notice tone="warning">
          <p>{c.requesterNoteNotSent}</p>
          {noteState.refusal.message && <p>{noteState.refusal.message}</p>}
          <div className="actions">
            <Button disabled={note.locked} onClick={() => void note.resend()}>
              {c.resendRequesterNote}
            </Button>
          </div>
        </Notice>
      )}
      <Unconfirmed
        // A note has no read back; only resending it can settle it.
        command={{
          state: noteState,
          retry: note.retry,
          dismissUnknown: note.dismissUnknown,
        }}
        text={c.requesterNoteUnconfirmed}
        retryLabel={c.retryRequesterNote}
        {...(note.expired
          ? { replaceText: c.noteExpired, stopLabel: c.dismiss }
          : {})}
      />
      {deciding && (
        <>
          <ErrorSummary errors={errors} />
          <fieldset disabled={decision.locked}>
            <div
              role="radiogroup"
              aria-label={c.outcomeLegend}
              id="review-outcome"
              tabIndex={-1}
              className="decide-radios"
            >
              {choices.map((option) => (
                <label key={option.id} htmlFor={`review-choice-${option.id}`}>
                  <input
                    type="radio"
                    id={`review-choice-${option.id}`}
                    name="review-outcome"
                    checked={chosen === option.id}
                    onChange={() => setPicked(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {errors["review-outcome"] && (
              <p className="field-error-message">{errors["review-outcome"]}</p>
            )}
            {blocked.map((option) => (
              <p key={option.id} className="muted">
                {fill(c.outcomeBlocked, { outcome: option.label }, locale)}
              </p>
            ))}
            {choices.some(
              (option) => option.plan.outcome.settlement === "approved",
            ) && <ApprovalLeadsTo task={task} stageNames={stageNames} />}
            {plan && !approves && (
              <InputField
                name="review-reason"
                label={c.reason}
                hint={c.reasonHint}
                value={reason}
                multiline
                required={reasonRequired}
                onChange={setReason}
                error={errors["review-reason"]}
              />
            )}
            <PublicReasonField
              outcome={plan?.outcome}
              value={publicReason}
              onChange={setPublicReason}
              error={errors["review-public-reason"]}
            />
            {sendsBack && (
              <InputField
                name="review-requester-note"
                label={c.requesterNote}
                hint={c.requesterNoteHint}
                value={requesterNote}
                multiline
                required
                onChange={setRequesterNote}
                error={errors["review-requester-note"]}
              />
            )}
            {plan && plan.fields.length > 0 && (
              <>
                <h3>{c.resultHeading}</h3>
                {plan.fields.map((field) => (
                  <ResultField
                    key={field.name}
                    field={field}
                    value={values[field.name] ?? ""}
                    required={plan.resultRequired && field.required}
                    onChange={(value) =>
                      setValues((previous) => ({
                        ...previous,
                        [field.name]: value,
                      }))
                    }
                    error={errors[`review-result-${field.name}`]}
                  />
                ))}
              </>
            )}
          </fieldset>
          <div className="actions">
            <Button disabled={decision.locked || rereading} onClick={submit}>
              {c.record}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function draftText(body: ReviewJson | undefined): string {
  return body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof body.text === "string"
    ? body.text
    : "";
}
/**
 * The officer's own draft on a held task. Fetches its own draft command from
 * the task id; a read error is rendered by the caller, which knows how the
 * app shows a failed read.
 */
export function DraftPanel({
  task,
  rereading,
  renderError,
}: {
  task: ReviewTaskDetail;
  rereading: boolean;
  /** Renders the draft's own read error in place of the draft field. */
  renderError: (error: unknown, retry: () => void) => ReactNode;
}) {
  const c = useCaseworkContent();
  const { draft, save, remove } = useReviewDraft(task.taskId);
  const [text, setText] = useState<string | null>(null);
  const value = text ?? draftText(draft.data?.body);
  // Once a delete is confirmed the field shows the (now empty) stored draft,
  // not the text typed before it.
  useEffect(() => {
    if (remove.state.state === "confirmed") setText(null);
  }, [remove.state.state]);
  return (
    <section className="review-draft">
      <h2>{c.draftHeading}</h2>
      {draft.error && renderError(draft.error, () => void draft.refetch())}
      <div className="field">
        <label htmlFor="review-draft">{c.draftLabel}</label>
        <p className="field-hint" id="review-draft-hint">
          {c.draftHint}
        </p>
        <Textarea
          id="review-draft"
          aria-describedby="review-draft-hint"
          value={value}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="actions">
        <Button
          variant="outline"
          disabled={
            rereading ||
            save.state.state === "sending" ||
            save.state.state === "recovering"
          }
          onClick={() => save.run(task, { text: value })}
        >
          {c.saveDraft}
        </Button>
        {draft.data && (
          <Button
            variant="ghost"
            disabled={rereading || remove.locked}
            onClick={() => void remove.run(task)}
          >
            {c.deleteDraft}
          </Button>
        )}
      </div>
      {save.state.state === "confirmed" && (
        <Notice tone="success">{c.draftSaved}</Notice>
      )}
      {remove.state.state === "confirmed" && (
        <Notice tone="success">{c.draftDeleted}</Notice>
      )}
      {save.state.state === "refused" && (
        <Notice tone="warning">
          {caseworkRefusalText(c, save.state.refusal, c.taskNotApplied)}
        </Notice>
      )}
      {remove.state.state === "refused" && (
        <Notice tone="warning">
          {caseworkRefusalText(c, remove.state.refusal, c.taskNotApplied)}
        </Notice>
      )}
      <Unconfirmed
        command={save}
        text={c.draftUnconfirmed}
        retryLabel={c.retryDraft}
      />
      <Unconfirmed
        command={remove}
        text={c.draftDeleteUnconfirmed}
        retryLabel={c.retryDraftDelete}
      />
    </section>
  );
}
