import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { RecordActionReference } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { Notice } from "@/blocks/lib/notice";
import { useBlockContent } from "@/blocks/lib/content";
import { ErrorSummary } from "@/blocks/record/record-form";
import { InputField } from "@/blocks/fields/input-field";
import {
  CommandFeedback,
  type CommandOutcome,
} from "@/blocks/request/request-status";

/** An action named by its lifecycle action when it has one, else by its kind. */
function actionKey(action: RecordActionReference): string {
  return action.action ?? action.name;
}

export interface DecisionOutcome extends CommandOutcome {
  reset: () => void;
  /** The fields of a refusal that failed validation, keyed by field id. */
  validationErrors: Record<string, string>;
  /** The decision itself was refused as stale: another officer decided. */
  staleConflict: boolean;
  confirmed: Extract<CommandOutcome["result"], { outcome: "confirmed" }> | null;
}

/**
 * A decision on a request: pick one of the offered actions (or go straight to
 * the check step for one that needs no reason), check it, then confirm. The
 * caller names its actions, their reasons and their outcome; this only walks
 * the choose/check/confirm steps and their focus and announcement.
 */
export function DecisionForm({
  title,
  hint,
  reference,
  choices,
  primaryAction = null,
  secondaryActions = [],
  hasActions,
  needsReason,
  describeAction,
  checkDetails,
  header,
  task,
  submit,
  refetch,
  announce,
  choiceLabel,
  reconcileHref,
  renderError,
  refreshing,
  decidedBody,
  choiceDisabled,
  choiceNote,
  answerFields,
  serverAnswerErrors,
  validateAnswers,
}: {
  /** The heading, the fieldset legend and the choice-step title. */
  title: string;
  hint: string;
  /** The human reference for the thing being decided, shown on the check step. */
  reference: string;
  /** The radio choices, in the order they should be read. */
  choices: RecordActionReference[];
  /** Takes no reason and goes straight to the check step. */
  primaryAction?: RecordActionReference | null;
  /** Also straight to the check step, rendered as outline buttons. */
  secondaryActions?: RecordActionReference[];
  /** False renders the "no actions available" sentence. */
  hasActions: boolean;
  needsReason: (action: RecordActionReference) => boolean;
  describeAction: (action: RecordActionReference) => string;
  /** Extra context on the check step, under the reference. */
  checkDetails?: ReactNode;
  /** Controls above the form; hidden while an outcome is unknown. */
  header?: ReactNode;
  task: DecisionOutcome;
  submit: (action: RecordActionReference, reason: string) => Promise<unknown>;
  refetch: () => Promise<unknown>;
  announce: (message: string) => void;
  choiceLabel: (action: RecordActionReference) => string;
  reconcileHref: string;
  renderError: (error: Error) => ReactNode;
  /**
   * A held view of this request is stale and already being refetched: the
   * choices and the confirm step wait for the fresh view rather than send a
   * decision against a revision that is about to be overtaken.
   */
  refreshing: boolean;
  /** The confirmed-outcome body text; the caller's own, since it may name what the decision changes. */
  decidedBody: string;
  /** True renders the choice unselectable, with its note explaining why. */
  choiceDisabled?: (action: RecordActionReference) => boolean;
  /** A sentence shown under one choice's label, naming why it is disabled. */
  choiceNote?: (action: RecordActionReference) => string | undefined;
  /**
   * The structured answers that travel with the outcome, rendered on the
   * choice step under the radios. The render prop receives every answer
   * field error in play, keyed by the field element id, so client and
   * server refusals land on the same control the summary links to.
   */
  answerFields?: (fieldErrors: Record<string, string>) => ReactNode;
  /**
   * Server refusals of the structured answers, keyed by field element id.
   * Present only for callers that pass answerFields; like a refused reason
   * it returns the officer to the choice step.
   */
  serverAnswerErrors?: Record<string, string>;
  /** Answer errors checked before the check step, keyed by field element id. */
  validateAnswers?: (action: RecordActionReference) => Record<string, string>;
}) {
  const c = useBlockContent();
  const [selected, setSelected] = useState<RecordActionReference | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const checkRef = useRef<HTMLHeadingElement>(null);
  const decidedRef = useRef<HTMLHeadingElement>(null);
  const choiceRef = useRef<HTMLFieldSetElement>(null);
  const focusChoiceNext = useRef(false);
  const handledReceipt = useRef<string | null>(null);

  // A reread mints fresh references for the same actions, so the choice
  // follows its action by name; one the item no longer offers is dropped.
  const offered = [
    ...choices,
    ...(primaryAction ? [primaryAction] : []),
    ...secondaryActions,
  ];
  const current = selected
    ? (offered.find((action) => action.ref === selected.ref) ??
      offered.find((action) => actionKey(action) === actionKey(selected)) ??
      null)
    : null;
  const reasonRequired = current ? needsReason(current) : false;

  const serverReasonError = task.validationErrors.reason;
  const serverRefusedAnswers = Boolean(
    serverAnswerErrors && Object.keys(serverAnswerErrors).length > 0,
  );
  // Only a refusal of the decision itself says another officer decided; a
  // 412 refusing the recovery retry leaves the uncertain attempt in charge.
  const staleConflict = task.staleConflict;
  const confirmed = task.confirmed;

  // A server-side reason or answer refusal returns to the choice step with
  // the field error wired to the same element the summary links to.
  useEffect(() => {
    if (serverReasonError || serverRefusedAnswers) setChecking(false);
  }, [serverReasonError, serverRefusedAnswers]);
  // The check step closes on a choice the item stopped offering, and focus
  // returns to the choices it came from.
  useEffect(() => {
    if (!selected || current) return;
    setSelected(null);
    if (checking) {
      focusChoiceNext.current = true;
      setChecking(false);
    }
  }, [selected, current]);
  // Focus follows the step: the check heading on entry, the choice group only
  // when the officer chooses to go back — never when a confirmed outcome
  // resets the step, which would steal focus from the outcome heading.
  useEffect(() => {
    if (checking) {
      checkRef.current?.focus({ preventScroll: true });
      return;
    }
    if (focusChoiceNext.current) {
      focusChoiceNext.current = false;
      choiceRef.current?.focus({ preventScroll: true });
    }
  }, [checking]);
  // On success move focus to the outcome heading and announce it.
  useEffect(() => {
    if (!confirmed || handledReceipt.current === confirmed.receipt) return;
    handledReceipt.current = confirmed.receipt;
    setSelected(null);
    setChecking(false);
    announce(c.decisionAnnounced);
    void refetch();
    decidedRef.current?.focus({ preventScroll: true });
  }, [confirmed]);

  function choose(action: RecordActionReference) {
    task.reset();
    setSelected(action);
    setErrors({});
  }
  /** The primary and secondary actions go straight to the check step: they
      take no reason, so there is nothing to choose between first. */
  function straightToCheck(action: RecordActionReference) {
    choose(action);
    setChecking(true);
  }

  function continueToCheck(event: FormEvent) {
    event.preventDefault();
    if (!choices.length) return;
    if (!current) {
      choiceRef.current?.focus();
      return;
    }
    const next: Record<string, string> = {};
    if (reasonRequired && !reason.trim())
      next["decision-reason"] = c.requiredError;
    if (validateAnswers) Object.assign(next, validateAnswers(current));
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    setChecking(true);
  }

  async function perform() {
    if (!current) return;
    await submit(current, reason);
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{hint}</p>
      {!task.unknown && header}
      {!hasActions && <p>{c.noActions}</p>}
      {checking && current ? (
        <div className="decision-confirm">
          <h2 ref={checkRef} tabIndex={-1}>
            {c.decisionCheckHeading}
          </h2>
          <h3>{choiceLabel(current)}</h3>
          <p className="muted">{reference}</p>
          {checkDetails}
          <p>{describeAction(current)}</p>
          {reasonRequired && reason.trim() && (
            <blockquote>
              <p>{reason}</p>
            </blockquote>
          )}
          <div className="actions">
            <Button
              onClick={() => void perform()}
              disabled={task.pending || task.unknown || refreshing}
            >
              {c.decisionConfirm}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                focusChoiceNext.current = true;
                setChecking(false);
              }}
              disabled={task.pending || task.unknown}
            >
              {c.decisionChange}
            </Button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={continueToCheck}>
          <ErrorSummary
            errors={{
              ...errors,
              ...(serverReasonError
                ? { "decision-reason": serverReasonError }
                : {}),
              ...(serverAnswerErrors ?? {}),
            }}
          />
          <fieldset
            ref={choiceRef}
            tabIndex={-1}
            disabled={task.pending || task.unknown || refreshing}
          >
            {/* The heading above already shows the title; the legend only names the group. */}
            <legend className="sr-only">{title}</legend>
            {choices.length > 0 && (
              <div className="decision-radios">
                {choices.map((action) => {
                  const note = choiceNote?.(action);
                  return (
                    <label
                      key={action.ref}
                      htmlFor={`decision-${actionKey(action)}`}
                    >
                      <input
                        type="radio"
                        id={`decision-${actionKey(action)}`}
                        name="decision-choice"
                        value={actionKey(action)}
                        checked={current?.ref === action.ref}
                        onChange={() => choose(action)}
                        disabled={choiceDisabled?.(action) ?? false}
                      />
                      <span>{choiceLabel(action)}</span>
                      {note && <span className="radio-hint">{note}</span>}
                    </label>
                  );
                })}
              </div>
            )}
            {answerFields &&
              answerFields({
                ...errors,
                ...(serverAnswerErrors ?? {}),
              })}
            {reasonRequired && (
              <InputField
                name="decision-reason"
                label={`${c.decisionReasonLabel}. ${c.decisionReasonAudience}`}
                hint={c.decisionReasonHint}
                value={reason}
                multiline
                onChange={setReason}
                error={errors["decision-reason"] ?? serverReasonError}
              />
            )}
            <div className="actions">
              {choices.length > 0 && (
                <Button type="submit">{c.decisionContinue}</Button>
              )}
              {primaryAction && (
                <Button onClick={() => straightToCheck(primaryAction)}>
                  {choiceLabel(primaryAction)}
                </Button>
              )}
              {secondaryActions.map((action) => (
                <Button
                  key={action.ref}
                  variant="outline"
                  onClick={() => straightToCheck(action)}
                >
                  {choiceLabel(action)}
                </Button>
              ))}
            </div>
          </fieldset>
        </form>
      )}
      {staleConflict ? (
        <Notice tone="warning" title={c.staleDecidedTitle}>
          <p>{c.staleDecidedBody}</p>
          <Button
            variant="outline"
            onClick={() => {
              task.reset();
              setSelected(null);
              setChecking(false);
              void refetch();
            }}
          >
            {c.reloadRequest}
          </Button>
        </Notice>
      ) : confirmed ? (
        <Notice tone="success">
          <h2 ref={decidedRef} tabIndex={-1}>
            {c.decidedTitle}
          </h2>
          <p>{decidedBody}</p>
          <p className="reference">
            {c.receipt}: <span className="font-mono">{confirmed.receipt}</span>
          </p>
        </Notice>
      ) : (
        <CommandFeedback
          task={task}
          reconcileHref={reconcileHref}
          renderError={renderError}
        />
      )}
    </section>
  );
}
