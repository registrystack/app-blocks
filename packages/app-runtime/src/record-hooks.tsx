/**
 * Hooks for writes on any entity's record, over the actions a record read offers. Every
 * write goes through `useCommand`, keyed by an attempt id the host retains; nothing here
 * retries on its own.
 */
import { useState } from "react";
import { useCommand } from "./command-hooks.js";
import type { CommandTarget } from "./commands.js";
import type { JsonValue, RecordActionReference, RecordView } from "./model.js";
import { useModel, useRecord } from "./react.js";
import {
  actionKeys,
  applyTask,
  formValues,
  recordTask,
  recordTaskCommand,
  type RecordCommandInput,
} from "./record-commands.js";
import { validateValues } from "./schema-fields.js";

/**
 * Sends one offered action. With a `target`, an unresolved attempt on that record is
 * restored on mount and no other write on it starts until it settles; a create without one
 * is its own target. A confirmed write refreshes the entity's lists and the target record.
 */
export function useRecordCommand(
  action: RecordActionReference,
  target?: CommandTarget,
) {
  const command = useCommand(
    {
      ...recordTaskCommand,
      invalidates: (_value, scope) => actionKeys(scope, action, target),
    },
    target,
  );
  return {
    ...command,
    submit: async (input: RecordCommandInput = {}) =>
      command.run(recordTask(action, target, input)),
  };
}

/**
 * The values of a form for one offered action, checked against the action's field schemas
 * and the entity's rules from the session model. Checking reads nothing from the host; the
 * host applies the same checks again when the write is sent.
 */
export function useRecordForm(
  action: RecordActionReference,
  initial: Readonly<Record<string, JsonValue | undefined>> = {},
  lang?: string,
) {
  const model = useModel(lang);
  const fields = action.fields ?? [];
  const rules =
    model.data?.entities.find((entity) => entity.id === action.entity)?.rules ??
    [];
  const [values, setValues] = useState(() => formValues(fields, initial));
  const issues = validateValues(fields, values, rules);
  return {
    fields,
    values,
    issues,
    valid: issues.length === 0,
    /** Sets one field's value; `undefined` leaves the field unanswered. */
    set(field: string, value: JsonValue | undefined) {
      setValues((current) => {
        const next = { ...current };
        if (value === undefined) delete next[field];
        else next[field] = value;
        return next;
      });
    },
    reset: () => setValues(formValues(fields, initial)),
  };
}

/** BREG's review sections of a request, read with the request. */
export function useRequestReview(entity: string, id: string, lang?: string) {
  const request = useRecord(entity, id, lang);
  return { ...request, data: request.data?.request?.review };
}

/**
 * Applies an approved request whose application is manual, with the apply its view offers
 * at the revision the officer read. Applying changes the records the request names and
 * moves its work item, so a confirmed apply refreshes everything the session read.
 */
export function useApplyRequest(entity: string, id: string) {
  const command = useCommand(recordTaskCommand, { entity, id });
  return {
    ...command,
    apply: async (view: RecordView) => {
      if (view.entity !== entity || view.id !== id)
        throw new Error("Cannot apply: the view is of another request.");
      return command.run(applyTask(view));
    },
  };
}
