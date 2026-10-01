import {
  entityTitle,
  unavailableError,
  validateValues,
  type EntityModel,
  type FieldModel,
  type JsonValue,
  type RecordView,
  type RequestView,
  type ValueIssue,
} from "@registrystack/app-runtime";
import {
  useModel,
  usePendingRecordWrite,
  type RecoveryReference,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent, type BlockContent } from "@/blocks/lib/content";
import { Notice } from "@/blocks/lib/notice";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { useShellContent } from "@/blocks/shell/shell-content";
import { navigate, useRoute } from "@/blocks/shell/routing";
import {
  useRegisterRoutes,
  type RegisterRoutes,
} from "@/blocks/pages/register-routes";
import { usePagesContent } from "@/blocks/pages/pages-content";
import type { TaskFeedbackState } from "@/blocks/pages/task-feedback";

/**
 * The register's entities as the session model names them, and the words a
 * record's values are shown in. Which entity is which comes from the model,
 * never from an entity id in this code.
 */
export interface RegisterEntities {
  /** The records this service is about: the first record entity a request changes. */
  record: EntityModel;
  /** The request that changes one of those records, when the session has one. */
  request?: EntityModel;
  /**
   * The requests the session lists and follows: `request`, or else the model's
   * only request entity. A profile that may follow its requests without reading
   * the records they change sees that request target none of them.
   */
  followedRequest?: EntityModel;
}

/** The record and request entities of a session model, or null when it has no record entity. */
export function registerEntities(
  entities: EntityModel[],
): RegisterEntities | null {
  const requests = entities.filter((entity) => entity.kind === "request");
  const targeted = (entity: EntityModel) =>
    requests.find((request) =>
      request.request?.targets.some((target) => target.entity === entity.id),
    );
  const records = entities.filter((entity) => entity.kind === "record");
  const record = records.find(targeted) ?? records[0];
  if (!record) return null;
  const request = targeted(record);
  return {
    record,
    request,
    followedRequest:
      request ?? (requests.length === 1 ? requests[0] : undefined),
  };
}

/** The session model's register entities; `entities` is null until read, or when absent. */
export function useRegister() {
  const model = useModel();
  return {
    ...model,
    entities: model.data ? registerEntities(model.data.entities) : null,
  };
}

/**
 * The route a record opens on: a request on its request page, a register
 * record on its record page, and null for an entity this app has no page for.
 */
export function recordPath(
  routes: RegisterRoutes,
  entities: RegisterEntities,
  entity: string,
  id: string,
): string | null {
  if (entity === entities.followedRequest?.id) return routes.request(id);
  if (entity === entities.record.id) return routes.record(id);
  return null;
}

/** One field a request writes, with the target field it lands in. */
export interface WrittenField {
  field: FieldModel;
  target: FieldModel;
}

/**
 * The fields a request writes on its target record, in the order the request
 * model names them. A write whose field either model lacks is left out.
 */
export function writtenFields(
  entities: RegisterEntities,
  requestFields: readonly FieldModel[],
): WrittenField[] {
  return (entities.request?.request?.writes ?? []).flatMap((write) => {
    const field = requestFields.find((item) => item.id === write.requestField);
    const target = fieldOf(entities.record, write.targetField);
    return write.targetEntity === entities.record.id && field && target
      ? [{ field, target }]
      : [];
  });
}

/**
 * The id of the record a request changes, when that record is one of the
 * register's and the host has not marked it unavailable; "" otherwise, so a
 * read of it stays disabled.
 */
export function readableTarget(
  entities: RegisterEntities,
  request: RequestView | undefined,
): string {
  const target = request?.target;
  return target &&
    target.entity === entities.record.id &&
    target.available !== false
    ? target.id
    : "";
}

/**
 * What a target field holds now: the live target record when it was read,
 * else the value the request retained, unless the host marked the target
 * unavailable. Undefined where neither is known.
 */
export function currentValue(
  targetField: FieldModel,
  target: RecordView | undefined,
  request: RequestView | undefined,
): JsonValue | undefined {
  if (target) return target.values[targetField.id];
  return request?.target?.available === false
    ? undefined
    : request?.previous?.[targetField.id];
}

/** Whether two values are the same answer; a list is the same in any order. */
export function sameAnswer(
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): boolean {
  if (Array.isArray(left) && Array.isArray(right))
    return (
      JSON.stringify(left.map((item) => JSON.stringify(item)).sort()) ===
      JSON.stringify(right.map((item) => JSON.stringify(item)).sort())
    );
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * What an answer check says about one field: the content's wording for that
 * field first, then the wording for the kind of problem, then the registry's
 * own message for a rule.
 */
export function issueMessage(
  field: FieldModel,
  issue: Pick<ValueIssue, "code" | "message">,
  c: BlockContent,
): string {
  return (
    c.fieldErrors[field.id] ??
    (issue.code === "required"
      ? c.requiredError
      : issue.code === "format" && field.format === "date"
        ? c.dateError
        : (issue.message ?? c.invalidError))
  );
}

export function fieldOf(
  entity: EntityModel,
  id: string,
): FieldModel | undefined {
  return entity.fields.find((field) => field.id === id);
}

/** The words a record is named by: its title template or title field, or undefined when it has neither. */
export function recordTitle(
  entity: EntityModel,
  record: RecordView,
): string | undefined {
  return entityTitle(entity, (field) => record.values[field.id]);
}

/**
 * Words for a coded value: the content's own wording first, then the word the
 * model carries for the field's option, and the raw code only when neither exists.
 */
export function useOptionLabel(): (field: FieldModel, code: string) => string {
  const c = useBlockContent();
  return (field, code) =>
    c.terms[code] ??
    field.options?.find((option) => option.value === code)?.label ??
    code;
}

/**
 * What a check of these answers finds, one message per field: the registry's
 * rules and schema, and a required list left empty or holding a value its
 * field does not offer.
 */
export function valueErrors(
  fields: readonly FieldModel[],
  values: Readonly<Record<string, JsonValue>>,
  rules: EntityModel["rules"],
  c: BlockContent,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const issue of validateValues(fields, values, rules)) {
    const field = fields.find((item) => item.id === issue.field);
    if (field && !next[field.id])
      next[field.id] = issueMessage(field, issue, c);
  }
  for (const field of fields) {
    const value = values[field.id];
    if (next[field.id] || field.type !== "array") continue;
    if (field.required && (!Array.isArray(value) || value.length === 0))
      next[field.id] = issueMessage(field, { code: "required" }, c);
    else if (
      field.options &&
      Array.isArray(value) &&
      value.some(
        (item) => !field.options!.some((option) => option.value === item),
      )
    )
      next[field.id] = issueMessage(field, { code: "enum" }, c);
  }
  return next;
}

/** The refusal shown where the session is offered no write for this request. */
export function UnavailableWrite() {
  const c = useShellContent();
  return <ErrorPanel error={unavailableError(c.unavailable)} />;
}

/**
 * The state a record or request write task exposes to its page: the outcome
 * `TaskFeedback` shows, plus the lock and field errors a form checks before
 * letting the session submit again. Generic over the command's input, so a
 * page can instantiate it against whichever write it hosts.
 */
export interface RecordTaskState<Input> extends TaskFeedbackState {
  locked: boolean;
  fieldErrors: Readonly<Record<string, string>>;
  submit: (input: Input) => Promise<unknown>;
}

/**
 * What checking a pending write found: its own identifier, ready to show as a
 * support reference, and the actions this session has for it. The identifier
 * a fresh check or retry runs against is an implementation detail of the
 * write itself, never a page's own concern, so a page's `useRecovery` hook
 * carries it in under this generic name.
 */
export interface RecoveryOutcome {
  reference: string | null;
  busy: boolean;
  unknown: boolean;
  error: unknown;
  check: () => void;
  retry: () => void;
  leave: () => void;
}

/** The unresolved submission of this session that needs checking. */
export function RecoveryNotice({
  useRecovery,
}: {
  /** Checks a pending write's outcome; a page supplies this over its own host. */
  useRecovery: (
    reference: RecoveryReference,
    options: {
      onSettled: () => void;
      open: (resource: { id: string; entity: string }) => void;
    },
  ) => RecoveryOutcome;
}) {
  const route = useRoute();
  const { reference, settled } = usePendingRecordWrite(route);
  if (!reference) return null;
  return (
    <PendingRecovery
      reference={reference}
      onSettled={settled}
      useRecovery={useRecovery}
    />
  );
}

function PendingRecovery({
  reference,
  onSettled,
  useRecovery,
}: {
  reference: RecoveryReference;
  onSettled: () => void;
  useRecovery: (
    reference: RecoveryReference,
    options: {
      onSettled: () => void;
      open: (resource: { id: string; entity: string }) => void;
    },
  ) => RecoveryOutcome;
}) {
  const shell = useShellContent(),
    pages = usePagesContent(),
    block = useBlockContent(),
    routes = useRegisterRoutes(),
    register = useRegister();
  const outcome = useRecovery(reference, {
    onSettled,
    /** A settled write opens on the record it wrote. */
    open(resource) {
      const path =
        register.entities &&
        recordPath(routes, register.entities, resource.entity, resource.id);
      if (path) navigate(path);
    },
  });
  return (
    <Notice tone="warning" title={shell.recoveryTitle}>
      <p>
        {outcome.reference ? pages.recoveryBody : shell.previousContextBody}
      </p>
      {outcome.reference && (
        <p className="reference">
          {block.receipt}:{" "}
          <span className="font-mono">{outcome.reference}</span>
        </p>
      )}
      <div className="actions">
        {outcome.reference ? (
          <Button
            variant="outline"
            onClick={() => void outcome.check()}
            disabled={outcome.busy}
          >
            {pages.checkOutcome}
          </Button>
        ) : (
          <Button render={<a href={`#${routes.requests}`} />} variant="outline">
            {block.reconcile}
          </Button>
        )}
        {outcome.reference && outcome.unknown && (
          <Button onClick={() => void outcome.retry()} disabled={outcome.busy}>
            {block.exactRetry}
          </Button>
        )}
        <Button variant="ghost" onClick={outcome.leave}>
          {pages.leaveRecovery}
        </Button>
      </div>
      {!!outcome.error && <ErrorPanel error={outcome.error} />}
    </Notice>
  );
}
