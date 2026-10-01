/**
 * The registry model the host serves to the browser: each entity's fields,
 * labels, order and operations for this session, joined from the registry
 * contract and the UI model file. It describes; it never authorizes. Values
 * are keyed by field id, and the host translates them to wire names.
 */
import type {
  AttachmentSlot,
  ChangeRequestReview,
  VerifiedEvidenceDisplay,
} from "./types.js";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** One JSON Schema document, as the registry or a review kind serves it. */
export type JsonSchema = { [key: string]: JsonValue };

export interface RegistryModel {
  registry: { id: string; revision: string };
  /** The language the labels below are in. */
  language: string;
  /** Every language the UI model offers. */
  languages: string[];
  entities: EntityModel[];
}

export interface EntityModel {
  id: string;
  label: string;
  pluralLabel: string;
  /** A request entity changes other records through its declared effects. */
  kind: "record" | "request";
  fields: FieldModel[];
  sections: { id: string; label: string; fields: string[] }[];
  /** The field a record is named by. */
  title?: string;
  /**
   * Words a record is named by, built from its fields, such as
   * `{make} {model} ({vin})`; the title field names a record missing one of them.
   */
  titleTemplate?: string;
  list: {
    columns: string[];
    filters: { field: string; label: string }[];
    pageSize: number;
  };
  /**
   * The fields a requested change to one of these records is read against,
   * beside the fields the request writes; the list columns when absent.
   */
  context?: string[];
  operations: {
    create?: boolean;
    patch?: boolean;
    revisions?: boolean;
    attachments?: { slot: string; label: string }[];
  };
  /** Cross-field checks a form applies before anything is sent. */
  rules: FieldRule[];
  request?: RequestModel;
}

/**
 * The JSON Schema type a field is shown and entered as. `group` is a
 * repeatable list of items, each a fixed set of scalar sub-fields.
 */
export type FieldType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "group";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldModel {
  id: string;
  apiName: string;
  label: string;
  hint?: string;
  schema: JsonSchema;
  /**
   * The type without null. A shape the kit cannot enter (an object, an array
   * that is not a choice list, a union) is `object` or `array` and read-only.
   */
  type: FieldType;
  format?: string;
  /** A presentation choice from the UI model, such as `textarea`. */
  widget?: string;
  required: boolean;
  /** Free text where an empty string is a recorded answer, not a missing one. */
  acceptsBlank: boolean;
  readOnly: boolean;
  nullable: boolean;
  /** The choices of an enum, or of an array of enum, with display words. */
  options?: FieldOption[];
  reference?: { entity: string };
  /**
   * A `group` field's item shape: one sub-field per scalar property an item
   * carries. A sub-field that is itself a nested array, object or reference
   * is read-only; the kit renders it, it never guesses how to edit it.
   */
  items?: readonly FieldModel[];
}

/** The field's value must not be before the other field's value. */
export interface FieldRule {
  field: string;
  notBefore: string;
  message?: string;
}

export type RequestState =
  | "draft"
  | "submitted"
  | "changes-requested"
  | "approved"
  | "rejected"
  | "applied"
  | "cancelled"
  | "approval-expired";

/** A lifecycle action on a request, named without BREG's `_request` suffix. */
export type RequestAction = "submit" | "cancel" | "revise" | "rebase" | "apply";

export interface RequestModel {
  /**
   * The records a request changes. `fromField` names the request field that
   * holds the target's id; a target with neither binding is created, and one
   * `fromEffect` is the record another effect creates.
   */
  targets: {
    entity: string;
    operation: "create" | "patch";
    fromField?: string;
    fromEffect?: string;
  }[];
  /** The target fields a request sets, and the request field each comes from. */
  writes: {
    targetEntity: string;
    requestField?: string;
    targetField: string;
  }[];
  onApproved: "manual" | "automatic";
  reviewed: boolean;
  stateLabels: Record<RequestState, string>;
}

export interface RecordView {
  entity: string;
  id: string;
  revision: string;
  values: Record<string, JsonValue>;
  actions: RecordActionReference[];
  /** Governed document slots this session may see; absent when none are declared. */
  attachments?: AttachmentSlot[];
  request?: RequestView;
}

export interface RequestView {
  state: RequestState;
  review?: ChangeRequestReview;
  /** The record this request changes, and whether this session could read it. */
  target?: { entity: string; id: string; available: boolean };
  /** The target's current values for each field the request writes. */
  previous?: Record<string, JsonValue>;
  /**
   * The provenance of verified evidence the request holds, for the answer
   * field it was verified for. The retained artifact itself is never served.
   */
  evidence?: VerifiedEvidenceDisplay & { field: string };
}

/**
 * A read of one entity's records. `filters` match field values exactly, by
 * field id; `state` and `target` apply to a request entity only.
 */
export interface RecordQuery {
  filters?: Record<string, string>;
  state?: RequestState;
  /** The id of the record the requests change. */
  target?: string;
  size?: number;
  /** The opaque cursor of a page; it stands alone, without filters. */
  cursor?: string;
}

/**
 * One page of records; list items carry no actions. The page offers the
 * creates this session may make of the entity on its own; a request made on
 * a record is offered on that record instead.
 */
export interface RecordPage {
  items: RecordView[];
  nextCursor?: string;
  actions?: RecordActionReference[];
}

/** An opaque reference to one action this session may take on a record. */
export interface RecordActionReference {
  ref: string;
  name: "create" | "patch" | "lifecycle" | "removeAttachment";
  entity: string;
  action?: RequestAction;
  label?: string;
  fields?: FieldModel[];
}

export type RecordTask =
  | {
      type: "create";
      entity: string;
      actionRef: string;
      values: Record<string, JsonValue>;
      target?: { entity: string; id: string };
      evidenceRef?: string;
    }
  | {
      type: "patch";
      entity: string;
      id: string;
      actionRef: string;
      values: Record<string, JsonValue>;
      expectedRevision: string;
      evidenceRef?: string;
    }
  | {
      type: "lifecycle";
      entity: string;
      id: string;
      actionRef: string;
      action: RequestAction;
      expectedRevision: string;
      body?: Record<string, JsonValue>;
    }
  | {
      type: "removeAttachment";
      entity: string;
      id: string;
      slot: string;
      actionRef: string;
      expectedRevision: string;
    };

/** One record task under the attempt id that makes it idempotent. */
export interface RecordSubmission {
  attemptId: string;
  task: RecordTask;
}

export type RecordTaskResult =
  | {
      outcome: "confirmed";
      resource: { entity: string; id: string };
      receipt: string;
    }
  | { outcome: "unknown"; attemptId: string; supportReference: string };
