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

/** One JSON Schema document, as the registry or a review policy serves it. */
export type JsonSchema = { [key: string]: JsonValue };

export interface RegistryModel {
  registry: { id: string; revision: string };
  /** The language the labels below are in. */
  language: string;
  /** Every language the UI model offers. */
  languages: string[];
  entities: EntityModel[];
  /**
   * The record entities a staff app offers as places, in order; every record
   * entity the session lists or looks up, in the model's order, when absent;
   * the ones it reads by identifier where it does neither. Empty when the UI
   * model names places and the session reads none of them.
   */
  places?: string[];
  /** The list a session opens on, when the UI model names one for its role. */
  home?: HomeView;
  /** How the UI model shows Casework review queues and review contexts. */
  casework?: CaseworkModel;
  /**
   * The kit wording the UI model sets in the model's language, by message id
   * (`<area>.<key>`); an id left out keeps the app's wording or the kit's English.
   */
  messages?: Record<string, string>;
  /** The accent colour and description the UI model sets, in the model's language. */
  branding?: { accent?: string; description?: string };
}

/** The task fields a review queue row can show as a column; Casework serves each. */
export const reviewQueueColumns = [
  "reference",
  "kind",
  "queue",
  "due",
  "waiting",
  "status",
  "supporting",
] as const;
export type ReviewQueueColumn = (typeof reviewQueueColumns)[number];

/** The narrowings of a review queue that Casework serves: its owner and its queue. */
export const reviewQueueFilters = ["owner", "queue"] as const;
export type ReviewQueueFilter = (typeof reviewQueueFilters)[number];

/** The columns and filters of one review queue view; absent keys read as the inbox's. */
export interface ReviewQueueView {
  columns?: ReviewQueueColumn[];
  filters?: ReviewQueueFilter[];
}

/**
 * The UI model's choices among what Casework serves. They narrow and order
 * what a worker already sees; none of them reaches a field Casework does not
 * serve to that worker.
 */
export interface CaseworkModel {
  /** The review inbox: its columns and filters, and a queue's own when it differs. */
  inbox?: ReviewQueueView & { queues?: Record<string, ReviewQueueView> };
  /**
   * The fields of a review policy's display projection a reviewer reads, in
   * order, keyed by policy id. A name outside the projection is not shown.
   */
  context?: Record<string, string[]>;
}

/**
 * One entity's list, narrowed by field: a string matches the field's value
 * exactly, and null matches a record where the field is empty.
 */
export interface HomeView {
  entity: string;
  filters?: Record<string, string | null>;
  /** The ids of what the role's home list offers to start: record types and actions. */
  starts?: string[];
}

export interface EntityModel {
  id: string;
  label: string;
  pluralLabel: string;
  /** The words under the heading of a page that creates one of these records. */
  createDescription?: string;
  /** A request entity changes other records through its declared effects. */
  kind: "record" | "request";
  /** False keeps an entry-bound request out of standalone navigation. */
  navigation?: boolean;
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
    /**
     * The fields one search box matches, each by containing the words
     * searched for; absent where the registry serves no such search.
     */
    search?: string[];
    pageSize: number;
  };
  /**
   * The fields a requested change to one of these records is read against,
   * beside the fields the request writes; the list columns when absent.
   */
  context?: string[];
  operations: {
    create?: boolean;
    /** The session may read one record by its exact identifier. */
    get?: boolean;
    /** The session may list the entity's records, so a reference to one can be picked. */
    list?: boolean;
    patch?: boolean;
    revisions?: boolean;
    /** The session may find a record from what a person holds, without listing or reading by identifier. */
    lookup?: LookupModel;
    attachments?: { slot: string; label: string }[];
  };
  request?: RequestModel;
}

/**
 * How a session finds one record from what a person holds: the selectors it
 * may fill in, each by its own fields, and the fields a match discloses.
 * Only selectors whose values the person types are listed; BReg fills the
 * others from the session's verified claims.
 */
export interface LookupModel {
  selectors: {
    id: string;
    label: string;
    /**
     * Set when the label is the one BReg derives from the selector id, which
     * names no record type; absent when the UI model words the selector.
     */
    derived?: true;
    /**
     * Each field the person fills in, with the JSON Schema type of its value:
     * the host sends a whole number and a yes or no as JSON, and any other
     * value as the text typed.
     */
    fields: {
      id: string;
      label: string;
      required: boolean;
      type: "string" | "integer" | "number" | "boolean";
    }[];
  }[];
  /** The ids of the fields a match shows, in the entity's field order. */
  disclosed: string[];
}

/**
 * The JSON Schema type a field is shown and entered as. `group` is a
 * repeatable list of items, each a fixed set of scalar sub-fields;
 * `structured` is a single object of such sub-fields, and `crs84-point` is
 * the native GeoJSON Point shape with longitude before latitude.
 */
export type FieldType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "group"
  | "structured"
  | "crs84-point";

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
  /** The words shown for the field where a record holds no value. */
  emptyLabel?: string;
  reference?: { entity: string };
  /**
   * How an action input is answered, when the UI model says: typed in,
   * chosen from the directory of the record type it refers to, or taken from
   * the record the action starts from. Absent where it says nothing.
   */
  fill?: "enter" | "choose" | "record";
  /**
   * The record field an action input is filled from: the `field` of the
   * `entity` record chosen in the reference input `input` of the same action.
   * The host reads it when the record is chosen; the form shows it read-only
   * and submits it as read.
   */
  fillFrom?: { input: string; entity: string; field: string };
  /**
   * A `group` field's item shape, or a `structured` field's own: one
   * sub-field per scalar property the object carries. A sub-field that is
   * itself a nested array, object or reference is read-only; the kit renders
   * it, it never guesses how to edit it.
   */
  items?: readonly FieldModel[];
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

/** A lifecycle action on a request, named without BReg's `_request` suffix. */
export type RequestAction = "submit" | "cancel" | "revise" | "rebase" | "apply";

export interface RequestModel {
  /**
   * The record page this request starts from. `fromField` is the governed
   * reference input the host binds to that record.
   */
  entry?: { entity: string; fromField: string };
  /**
   * Whether this session's request list can be narrowed to the record named by
   * `target`. Absent means unsupported, for compatibility with an older host.
   */
  listByTarget?: boolean;
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
  /** How an approved request is applied; absent where the contract does not say. */
  onApproved?: "manual" | "automatic";
  /** Whether a request is reviewed before it applies; absent where the contract does not say. */
  reviewed?: boolean;
  stateLabels: Record<RequestState, string>;
  /** The states a list of these requests can be filtered by, in display order. */
  filterableStates: RequestState[];
}

export interface RecordView {
  entity: string;
  id: string;
  revision: string;
  values: Record<string, JsonValue>;
  actions: RecordActionReference[];
  /**
   * The governed actions that add a record referring to this one which the
   * registry answers it would refuse with this record as that reference,
   * keyed by action id. The page shows each disabled, with its reason, where
   * it offers it beside the records that refer to this one. Absent when there
   * are none.
   */
  relatedActionAvailability?: Record<string, ActionUnavailability>;
  /** Governed document slots this session may see; absent when none are declared. */
  attachments?: AttachmentSlot[];
  request?: RequestView;
}

export interface RequestView {
  state: RequestState;
  review?: ChangeRequestReview;
  /** Native application progress when this request has no separate review status. */
  application?: {
    mode: "automatic" | "manual";
    state: string;
    reason?: string;
    recovery?: string;
    attempts?: number;
  };
  /**
   * Present when BReg reports the request's review status unavailable, with
   * the reason and recovery it named. The words are BReg's; the browser never
   * classifies them.
   */
  reviewUnavailable?: { reason: string; recovery: string };
  /**
   * When an applied request was applied and by which actor reference, each
   * only when BReg serves it to this profile. An actor reference is a keyed
   * pseudonym, not a name.
   */
  applied?: { at?: string; by?: string };
  /** The readable record this request was started from. */
  entry?: { entity: string; id: string; available: boolean };
  /** The record this request changes, and whether this session could read it. */
  target?: { entity: string; id: string; available: boolean };
  /** The target's current values for each field the request writes. */
  previous?: Record<string, JsonValue>;
  /**
   * The provenance of verified evidence the request holds, for the answer
   * field it was verified for. The retained artifact itself is never served.
   */
  evidence?: VerifiedEvidenceDisplay & { field: string };
  /** Records BReg says this applied submission produced. */
  results?: { entity: string; id: string; revision: number }[];
}

/**
 * A read of one entity's records. `filters` match field values exactly, by
 * field id, and a null filter matches a record where the field is empty;
 * `search` matches the entity's search fields; `state` and `target` apply
 * to a request entity only.
 */
export interface RecordQuery {
  filters?: Record<string, string | null>;
  search?: string;
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

/**
 * An opaque reference to one action this session may take on a record. An
 * `invoke` is a governed registry action whose result lands in `entity`;
 * `actionId` names it, so a page can open the form for one action by id.
 */
export interface RecordActionReference {
  ref: string;
  name: "create" | "patch" | "lifecycle" | "removeAttachment" | "invoke";
  entity: string;
  action?: RequestAction;
  actionId?: string;
  label?: string;
  fields?: FieldModel[];
  /**
   * Present only on a governed action offered on a record when the registry
   * answers that it would refuse the action for that record now. The page
   * shows the action disabled, with its reason; the registry still decides
   * at commit.
   */
  availability?: ActionUnavailability;
}

/** The registry's answer that it would refuse an action for a record now. */
export interface ActionUnavailability {
  available: false;
  reason: string;
  recovery: string;
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
    }
  | {
      type: "invoke";
      entity: string;
      actionRef: string;
      values: Record<string, JsonValue>;
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

/** One earlier or current state of a record, newest first in a history. */
export interface RecordRevision {
  revision: string;
  /** When the registry recorded this state, as an RFC 3339 timestamp. */
  recordedAt?: string;
  values: Record<string, JsonValue>;
}

/** A record's states over time, newest first. */
export interface RecordHistory {
  items: RecordRevision[];
}
