import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  problemView,
  type FieldModel,
  type JsonValue,
  type RecordActionReference,
  type RecordTask,
} from "@registrystack/app-runtime";
import {
  formValues,
  recordTask,
  useActionInputValues,
  useRecords,
  useStarts,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { valueErrors } from "@/blocks/fields/value-errors";
import {
  ErrorSummary,
  RecordFormFields,
  soleChoice,
} from "@/blocks/record/record-form";
import { navigate, splitRoute, useRoute } from "@/blocks/shell/routing";
import { fill } from "@/blocks/lib/format";
import { usePagesContent } from "@/blocks/pages/pages-content";
import {
  backPathOf,
  presetOf,
  returnPathOf,
} from "@/blocks/pages/record-route-query";
import { TaskFeedback } from "@/blocks/pages/task-feedback";
import {
  recordPath,
  useOptionLabel,
  type RecordTaskState,
  type RegisterEntities,
} from "@/blocks/pages/record";
import type { RegisterRoutes } from "@/blocks/pages/register-routes";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { useShellContent } from "@/blocks/shell/shell-content";
import { UnavailableWrite } from "@/blocks/pages/record";

/**
 * The answers a route presets for `fields`, the path it asks to return to,
 * and the page it was opened from. A preset for a field the form does not offer is dropped, so a link can
 * never send an answer the action does not ask for.
 */
export function useFormRoute(fields: readonly FieldModel[]) {
  const { query } = splitRoute(useRoute());
  const asked = presetOf(query);
  const preset: Record<string, JsonValue> = {};
  for (const field of fields)
    if (field.id in asked) preset[field.id] = asked[field.id]!;
  return {
    preset,
    returnPath: returnPathOf(query),
    backPath: backPathOf(query),
  };
}

/**
 * The action a write form opened with, for as long as the form stays open.
 * The reread after a confirmed write may stop offering it (the record now
 * exists), and the form's outcome must outlive that.
 */
export function useOpenedAction(action: RecordActionReference | undefined) {
  const opened = useRef(action);
  if (action) opened.current = action;
  return opened.current;
}

/**
 * The start a form with no existing record opens: the one the entity's record
 * list offers, else, where that list cannot be read, the one the session's
 * starts offer. A session may start an entity's records without being able to
 * list them. `matches` picks the action from either; BReg still decides the call.
 */
export function OfferedStart({
  entity,
  matches,
  children,
}: {
  entity: string;
  matches: (action: RecordActionReference) => boolean;
  children: (action: RecordActionReference) => ReactNode;
}) {
  // The same read as the record list, so the action it offered is the one used.
  const query = useRecords(entity, {});
  const action = useOpenedAction(query.data?.actions?.find(matches));
  if (query.isPending) return <Loading />;
  if (!query.data && query.error)
    return (
      <UnlistedStart
        error={query.error}
        retry={() => void query.refetch()}
        matches={matches}
      >
        {children}
      </UnlistedStart>
    );
  if (!query.data || query.error)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  if (!action) return <UnavailableWrite />;
  return <>{children(action)}</>;
}

function UnlistedStart({
  error,
  retry,
  matches,
  children,
}: {
  error: unknown;
  retry: () => void;
  matches: (action: RecordActionReference) => boolean;
  children: (action: RecordActionReference) => ReactNode;
}) {
  const starts = useStarts();
  const action = useOpenedAction(starts.data?.find(matches));
  if (starts.isPending) return <Loading />;
  if (!action) return <ErrorPanel error={error} retry={retry} />;
  return <>{children(action)}</>;
}

/**
 * Where a confirmed write opens the record it wrote, from the receipt's own
 * record type: null where the session may not read that record type by id, so
 * no link is offered to a record the reader cannot open.
 */
export function readableRecordPath(
  routes: RegisterRoutes,
  entities: RegisterEntities,
  resource: { entity: string; id: string },
): string | null {
  const known = [
    entities.record,
    ...(entities.records ?? []),
    ...(entities.requests ?? []),
  ].find((entity) => entity.id === resource.entity);
  return known?.operations.get
    ? recordPath(routes, entities, resource.entity, resource.id)
    : null;
}

/** The answers every write form starts with for its inputs, before the app's own. */
export function startingAnswers(
  fields: readonly FieldModel[],
  preset: Record<string, JsonValue>,
): Record<string, JsonValue> {
  // A required answer that may be blank starts blank, so it is always sent.
  return formValues(
    fields,
    Object.fromEntries(
      fields.map((field) => [
        field.id,
        preset[field.id] ??
          soleChoice(field) ??
          (field.required && field.acceptsBlank ? "" : undefined),
      ]),
    ),
  );
}

/**
 * The answers a write form holds and the errors shown against them. Changing
 * an answer clears its error; `showErrors` takes a check's result and says
 * whether it passed, asking the summary to take focus where it did not.
 */
export function useFormAnswers(initial: () => Record<string, JsonValue>) {
  const first = useRef(initial);
  const [values, setValues] = useState<Record<string, JsonValue>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorFocusRequest, setErrorFocusRequest] = useState(0);
  function setValue(field: FieldModel, value: JsonValue | undefined) {
    setValues((previous) => {
      const next = { ...previous };
      if (value === undefined) delete next[field.id];
      else next[field.id] = value;
      return next;
    });
    setErrors((previous) => {
      if (!(field.id in previous)) return previous;
      const next = { ...previous };
      delete next[field.id];
      return next;
    });
  }
  function showErrors(next: Record<string, string>): boolean {
    setErrors(next);
    if (Object.keys(next).length) {
      setErrorFocusRequest((request) => request + 1);
      return false;
    }
    return true;
  }
  /** Returns the form to the answers it opened with. */
  function reset() {
    setValues(first.current());
    setErrors({});
  }
  return { values, errors, errorFocusRequest, setValue, showErrors, reset };
}

/**
 * The inputs the registry fills from a field of a chosen record, as read for
 * this form. `sources` names the record an input's source is when the form is
 * not asked for it, such as the record an action is taken on, by the id of
 * the reference input; `fieldLabel` words the field read. An input shows its
 * value only once it is read; until then, and where it cannot be read, it has
 * no value and holds the form back with the reason. A read the registry failed,
 * rather than one the record does not allow, says so and can be tried again;
 * an expired action or session cannot, so it asks to be opened or signed in again.
 * The value is read once, when the record is chosen, and is submitted as read.
 */
function useAnchors(
  action: RecordActionReference,
  fields: readonly FieldModel[],
  chosen: Record<string, JsonValue>,
  sources: Record<string, string>,
  fieldLabel: (field: FieldModel) => string,
) {
  const pages = usePagesContent(),
    shell = useShellContent(),
    locale = useLocale();
  const anchored = fields.filter((field) => field.fillFrom);
  const reads = useActionInputValues(
    action.ref,
    anchored.map((field) => {
      const named = chosen[field.fillFrom!.input];
      return {
        input: field.id,
        record: typeof named === "string" ? named : sources[field.fillFrom!.input],
      };
    }),
  );
  const shown: Record<
    string,
    {
      value?: JsonValue;
      note: string;
      retry?: { label: string; run: () => void };
    }
  > = {};
  const values: Record<string, JsonValue> = {};
  const holds: Record<string, string> = {};
  anchored.forEach((field, index) => {
    const from = field.fillFrom!;
    const source = fields.find((item) => item.id === from.input);
    const read = reads[index]!;
    const input = source?.label ?? from.input;
    const label = fieldLabel(field);
    const failure =
      read.isError && !read.isFetching
        ? problemView(read.error).kind
        : undefined;
    // An empty value fills only an input that takes a blank answer; elsewhere
    // the person could not correct it, so it is held back like an unreadable one.
    if (read.data && (read.data.value !== "" || field.acceptsBlank)) {
      values[field.id] = read.data.value;
      shown[field.id] = {
        value: read.data.value,
        note: fill(
          source ? pages.anchorFromChosen : pages.anchorFromThis,
          { field: label, input },
          locale,
        ),
      };
    } else if (failure === "service" || failure === "capacity") {
      // The registry failed, not the record: no other record would help.
      const note = pages.anchorFailed;
      shown[field.id] = {
        note,
        retry: { label: shell.retry, run: () => void read.refetch() },
      };
      holds[field.id] = note;
    } else if (
      failure === "conflict" ||
      failure === "session-ended" ||
      failure === "contract-changed"
    ) {
      // Reading again sends the same expired action or session: only reopening it helps.
      const note =
        failure === "conflict"
          ? pages.anchorExpired
          : failure === "session-ended"
            ? shell.expiredBody
            : shell.contractChangedBody;
      shown[field.id] = { note };
      holds[field.id] = note;
    } else {
      const note = read.isFetching
        ? pages.anchorLoading
        : read.isError || read.data
          ? pages.anchorUnavailable
          : fill(pages.anchorWaiting, { input }, locale);
      shown[field.id] = { note };
      holds[field.id] = note;
    }
  });
  return { shown, values, holds };
}

/**
 * The form of a record write that takes its inputs from an action: the
 * answers, their check against the fields' schema, the submission, and the
 * outcome the server confirms. The page around it words the headings and says where the
 * form leaves to.
 */
export function ActionWriteForm({
  action,
  fields,
  preset,
  task,
  submitLabel,
  cancelHref,
  returnPath,
  confirmedPath,
  anchorSources = {},
  anchorLabel = (field) => field.fillFrom!.field,
}: {
  action: RecordActionReference;
  fields: readonly FieldModel[];
  preset: Record<string, JsonValue>;
  task: RecordTaskState<RecordTask>;
  submitLabel: string;
  cancelHref: string;
  /** The path the route asked to return to, if any. */
  returnPath: string | null;
  /**
   * Where a confirmed write goes, given the record the receipt names, unless
   * the route asked for a return path; null where the reader cannot open it.
   */
  confirmedPath: (resource: { entity: string; id: string }) => string | null;
  /**
   * The record an input filled from a record is read from, by the id of the
   * reference input, where the form holds no such input: the record the action
   * is taken on.
   */
  anchorSources?: Record<string, string>;
  /** The words for the field an input is filled from. */
  anchorLabel?: (field: FieldModel) => string;
}) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    locale = useLocale(),
    word = useOptionLabel();
  const answers = useFormAnswers(() => startingAnswers(fields, preset));
  const anchors = useAnchors(
    action,
    fields,
    { ...answers.values, ...preset },
    anchorSources,
    anchorLabel,
  );
  const [checked, setChecked] = useState<Record<string, JsonValue>>({});
  // A filled input keeps the error the last check gave it only while it holds
  // the value that check saw: a value read since clears it, as an answer
  // changed since does.
  const errors = Object.fromEntries(
    Object.entries(answers.errors).filter(
      ([id]) => !(id in anchors.values) || anchors.values[id] === checked[id],
    ),
  );
  const written =
    task.result?.outcome === "confirmed" ? task.result.resource : undefined;
  const opens = returnPath ?? (written ? confirmedPath(written) : null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const sent = { ...answers.values, ...preset, ...anchors.values };
    const found = { ...valueErrors(fields, sent, block, locale), ...anchors.holds };
    setChecked(sent);
    if (!answers.showErrors(found)) return;
    await task.submit(recordTask(action, undefined, { values: sent }));
  }
  return (
    <form
      className="card form-card"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <ErrorSummary
        errors={{ ...errors, ...task.fieldErrors }}
        fields={fields}
        focusRequest={answers.errorFocusRequest}
      />
      <p className="muted">{pages.required}</p>
      <fieldset disabled={task.locked}>
        <RecordFormFields
          fields={fields}
          values={answers.values}
          errors={{ ...task.fieldErrors, ...errors }}
          onChange={answers.setValue}
          optionLabel={word}
          preset={preset}
          anchored={anchors.shown}
        />
        <div className="actions">
          <Button type="submit">{submitLabel}</Button>
          <Button render={<a href={`#${cancelHref}`} />} variant="ghost">
            {pages.cancel}
          </Button>
        </div>
      </fieldset>
      <TaskFeedback
        task={task}
        recordWrite
        confirmedLabel={
          returnPath ? pages.continueAfterWrite : block.viewRecord
        }
        onConfirmed={opens ? () => navigate(opens) : undefined}
      />
      {written && !opens && (
        // The session cannot read what it wrote, so the registry's own
        // identifier is all it can keep; the form can be entered again.
        <div>
          {task.reset && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                task.reset?.();
                answers.reset();
              }}
            >
              {pages.recordAnother}
            </Button>
          )}
          <details className="reference">
            <summary>{pages.registryReference}</summary>
            <p>{pages.registryReferenceHelp}</p>
            <p className="font-mono">{written.id}</p>
          </details>
        </div>
      )}
    </form>
  );
}
