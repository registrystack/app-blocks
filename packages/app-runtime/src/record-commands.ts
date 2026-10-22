/**
 * Record tasks as commands: one write on any entity's record, sent under an attempt id the
 * host retains, so an unknown outcome is resent with the same body after a reload.
 */
import type { QueryKey } from "@tanstack/react-query";
import type { CommandSpec } from "./command-hooks.js";
import type {
  CommandMarker,
  CommandTarget,
  ProbeVerdict,
} from "./commands.js";
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

/**
 * How a read of the request settles an unconfirmed apply. A request found applied
 * confirms that the request is applied, not that this attempt applied it: the browser is
 * served no digest of the effect applied, so it cannot tell this attempt's effect from
 * another's, and another actor may have applied the request first. The outcome therefore
 * states only what is known, and the page words it as "the request has been applied",
 * with the actor reference BReg reports, never as "your change was applied". One still
 * at the revision the attempt named was not applied by it; one that moved on without
 * being applied cannot be told.
 */
export function applyVerdict(
  marker: Pick<CommandMarker, "expectedRevision" | "attemptId" | "target">,
  read: Pick<RecordView, "revision" | "request">,
): ProbeVerdict<RecordTaskResult> {
  if (read.request?.state === "applied")
    return {
      settled: "confirmed",
      value: {
        outcome: "confirmed",
        resource: { entity: marker.target.entity, id: marker.target.id },
        receipt: marker.attemptId,
      },
    };
  if (read.revision === marker.expectedRevision)
    return { settled: "not-applied" };
  return { settled: "unknown" };
}

/**
 * An apply of one request as a command on that request, so an apply left unresolved is
 * restored after a reload and locks the request until it settles. The host resends it
 * under its original attempt while it still holds that attempt, recovering it against a
 * fresh read of the request; once it does not, reading the request back settles it.
 */
export const applyRequestCommand: CommandSpec<RecordTask, RecordTaskResult> = {
  ...recordTaskCommand,
  operation: () => "apply",
  probe: async (host, marker) =>
    applyVerdict(
      marker,
      await host.record(marker.target.entity, marker.target.id),
    ),
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
