/**
 * Record tasks as commands: one write on any entity's record, sent under an attempt id the
 * host retains, so an unknown outcome is resent with the same body after a reload.
 */
import type { QueryKey } from "@tanstack/react-query";
import type { CommandSpec } from "./command-hooks.js";
import type { CommandTarget } from "./commands.js";
import type {
  FieldModel,
  JsonValue,
  RecordActionReference,
  RecordTask,
  RecordTaskResult,
  RecordView,
} from "./model.js";

export const recordTaskCommand: CommandSpec<RecordTask, RecordTaskResult> = {
  scope: "record",
  operation: (task) => task.type,
  expectedRevision: (task) =>
    task.type === "create" || task.type === "invoke"
      ? undefined
      : task.expectedRevision,
  send: (host, task, attemptId) => host.submit({ attemptId, task }),
  retry: (host, attemptId) => host.retry<RecordTaskResult>(attemptId),
};

/** What a page supplies to an offered action; the action names the rest. */
export interface RecordCommandInput {
  values?: Record<string, JsonValue>;
  /** The revision of the record as the person read it; required to change one. */
  expectedRevision?: string;
  /** A lifecycle action's own body, such as a note. */
  body?: Record<string, JsonValue>;
  /** A verified prefill the create or patch consumes. */
  evidenceRef?: string;
}

/**
 * The task an offered action sends. A create is made on its own or on the `target` record
 * a request changes; a patch or lifecycle action changes the `target` record itself, at the
 * revision the person read. A governed action is invoked with its inputs alone. A removal
 * belongs to its slot's hook.
 */
export function recordTask(
  action: RecordActionReference,
  target: CommandTarget | undefined,
  input: RecordCommandInput,
): RecordTask {
  if (action.name === "create")
    return {
      type: "create",
      entity: action.entity,
      actionRef: action.ref,
      values: input.values ?? {},
      ...(target ? { target } : {}),
      ...(input.evidenceRef ? { evidenceRef: input.evidenceRef } : {}),
    };
  if (action.name === "invoke")
    return {
      type: "invoke",
      entity: action.entity,
      actionRef: action.ref,
      values: input.values ?? {},
    };
  const { expectedRevision } = input;
  if (action.name === "patch" && target && expectedRevision !== undefined)
    return {
      type: "patch",
      entity: action.entity,
      id: target.id,
      actionRef: action.ref,
      values: input.values ?? {},
      expectedRevision,
      ...(input.evidenceRef ? { evidenceRef: input.evidenceRef } : {}),
    };
  if (
    action.name === "lifecycle" &&
    action.action &&
    target &&
    expectedRevision !== undefined
  )
    return {
      type: "lifecycle",
      entity: action.entity,
      id: target.id,
      actionRef: action.ref,
      action: action.action,
      expectedRevision,
      ...(input.body ? { body: input.body } : {}),
    };
  throw new Error(
    `Cannot build a ${action.name} task without its record, revision and action.`,
  );
}

/** The query keys a confirmed write refreshes: the entity's lists and the target record. */
export function recordKeys(
  scope: string,
  entity: string,
  target?: CommandTarget,
): QueryKey[] {
  const keys: QueryKey[] = [[scope, "records", entity]];
  if (target) {
    if (target.entity !== entity) keys.push([scope, "records", target.entity]);
    keys.push([scope, "record", target.entity, target.id]);
    keys.push([scope, "record-history", target.entity, target.id]);
  }
  return keys;
}

/**
 * The query keys a confirmed action refreshes. A governed action may change the records of
 * any entity, so it refreshes every record list, record and history of the session.
 */
export function actionKeys(
  scope: string,
  action: RecordActionReference,
  target?: CommandTarget,
): QueryKey[] {
  return action.name === "invoke"
    ? [
        [scope, "records"],
        [scope, "record"],
        [scope, "record-history"],
      ]
    : recordKeys(scope, action.entity, target);
}

/** A form's starting values: the fields the action writes, taken from `initial`. */
export function formValues(
  fields: readonly FieldModel[],
  initial: Readonly<Record<string, JsonValue | undefined>>,
): Record<string, JsonValue> {
  const values: Record<string, JsonValue> = {};
  for (const field of fields) {
    const value = initial[field.id];
    if (value !== undefined) values[field.id] = value;
  }
  return values;
}

/** The apply a request view offers, at the revision the view was read. */
export function applyTask(view: RecordView): RecordTask {
  const apply = view.actions.find(
    (action) => action.name === "lifecycle" && action.action === "apply",
  );
  if (!apply) throw new Error("Cannot apply: the request offers no apply.");
  return recordTask(
    apply,
    { entity: view.entity, id: view.id },
    { expectedRevision: view.revision },
  );
}
