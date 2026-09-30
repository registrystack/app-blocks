import { HostError } from "./errors.js";

/** A first send, or a resend of an attempt whose outcome is unknown. */
export type CommandPhase = "fresh" | "retry";
export type RefusalKind =
  | "validation"
  | "session-ended"
  | "not-authorized"
  | "gone"
  | "held-elsewhere"
  | "key-reused"
  | "expired-reference"
  | "replay-expired"
  | "stale"
  | "other";
export interface Refusal {
  status: number;
  code: string;
  kind: RefusalKind;
  message: string;
  fields: Record<string, string>;
  supportReference?: string;
}
export interface RefusalDecision {
  refusal: Refusal;
  /** Whether this refusal proves the original attempt was not applied. */
  settlesOriginal: boolean;
}

const heldElsewhere = new Set([
  "review.task-not-held",
  "work-item.already-claimed",
  "work-item.not-holder",
]);
const keyReused = new Set([
  "idempotency.key-reused",
  "attempt.conflict",
  "casework.attempt-mismatch",
]);
const expiredReference = new Set([
  "action.expired",
  "action.mismatch",
  "prefill.expired",
  "task.preview-expired",
]);

function refusalKind(
  status: number,
  code: string,
  fields: object,
): RefusalKind {
  if (status === 422) return "validation";
  if (status === 400)
    return Object.keys(fields).length > 0 ||
      code === "validation.failed" ||
      code === "request.invalid"
      ? "validation"
      : "other";
  if (status === 401) return "session-ended";
  if (status === 403) return "not-authorized";
  if (status === 404) return "gone";
  if (status === 409) {
    if (heldElsewhere.has(code)) return "held-elsewhere";
    if (keyReused.has(code)) return "key-reused";
    if (expiredReference.has(code)) return "expired-reference";
    return "stale";
  }
  if (status === 410 && code === "idempotency.expired") return "replay-expired";
  if (status === 412 || status === 428) return "stale";
  return "other";
}

/**
 * The one reading of a host refusal. A first send's refusal settles it. A retry's refusal
 * settles the original only when another body owns the key, so this body was not applied
 * under it; anything else says nothing about whether the original committed.
 */
export function classifyRefusal(
  error: HostError,
  phase: CommandPhase,
): RefusalDecision {
  const fields = error.problem.fieldErrors ?? {};
  const kind = refusalKind(error.status, error.problem.code, fields);
  return {
    refusal: {
      status: error.status,
      code: error.problem.code,
      kind,
      message: error.problem.message,
      fields,
      ...(error.problem.supportReference
        ? { supportReference: error.problem.supportReference }
        : {}),
    },
    settlesOriginal: phase === "fresh" || kind === "key-reused",
  };
}

export const commandMarkerKey = "registry-app-kit.commands";
const legacyTaskKey = "registry-app-kit.pending";
const legacyCaseworkKey = "registry-app-kit.casework-pending";

/**
 * What one pending write is on: a record of a registry entity, or, for a write outside the
 * registry, a resource the command's scope names, with the scope as its entity.
 */
export interface CommandTarget {
  entity: string;
  id: string;
}
const sameTarget = (a: CommandTarget, b: CommandTarget) =>
  a.entity === b.entity && a.id === b.id;

/** What is stored for a write whose outcome is not yet known. Content-free by design. */
export interface MarkerInput {
  /** The host session scope that made the attempt. */
  authority: string;
  /** The host's keyed reference to the same human, when the session has one. */
  recoveryContext?: string;
  scope: string;
  target: CommandTarget;
  operation: string;
  attemptId: string;
  expectedRevision?: string;
}
export interface CommandMarker extends MarkerInput {
  v: 2;
  /** A local handle, kept when the attempt reference is erased. */
  key: string;
  createdAt: number;
}
interface StrippedMarker {
  v: 2;
  key: string;
  withoutAuthority: true;
  scope: string;
  createdAt: number;
}
type StoredMarker = CommandMarker | StrippedMarker;
export type PendingCommand =
  | { withoutAuthority: false; marker: CommandMarker }
  | { withoutAuthority: true; key: string; scope: string; createdAt: number };
/**
 * The operation an unconfirmed attempt restored from an earlier page was sent as, read
 * from its marker; nothing once the attempt settled or lost its authority.
 */
export function restoredOperation(
  pending: readonly PendingCommand[],
  state: CommandState<unknown>,
): string | undefined {
  if (state.state !== "unknown") return undefined;
  const restored = pending.find(
    (entry) =>
      !entry.withoutAuthority && entry.marker.attemptId === state.attemptId,
  );
  return restored && !restored.withoutAuthority
    ? restored.marker.operation
    : undefined;
}
export interface CommandViewer {
  scope: string;
  recoveryContext?: string;
}

const isText = (value: unknown): value is string => typeof value === "string";
function parseTarget(value: unknown): CommandTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && isText(v.entity) && isText(v.id)
    ? { entity: v.entity, id: v.id }
    : null;
}
/**
 * A stored marker, in the current version. A first-version marker named its target by id
 * alone, and its scope said what kind of resource that was; it reads as a target whose
 * entity is its scope, which is how the hooks that name a target by id still name it.
 */
function parseMarker(value: unknown): StoredMarker | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    (v.v !== 1 && v.v !== 2) ||
    !isText(v.key) ||
    !isText(v.scope) ||
    typeof v.createdAt !== "number"
  )
    return null;
  if (v.withoutAuthority === true)
    return {
      v: 2,
      key: v.key,
      withoutAuthority: true,
      scope: v.scope,
      createdAt: v.createdAt,
    };
  const target =
    v.v === 1
      ? isText(v.target)
        ? { entity: v.scope, id: v.target }
        : null
      : parseTarget(v.target);
  if (
    !isText(v.authority) ||
    !target ||
    !isText(v.operation) ||
    !isText(v.attemptId) ||
    (v.recoveryContext !== undefined && !isText(v.recoveryContext)) ||
    (v.expectedRevision !== undefined && !isText(v.expectedRevision))
  )
    return null;
  return {
    v: 2,
    key: v.key,
    authority: v.authority,
    ...(v.recoveryContext !== undefined
      ? { recoveryContext: v.recoveryContext }
      : {}),
    scope: v.scope,
    target,
    operation: v.operation,
    attemptId: v.attemptId,
    ...(v.expectedRevision !== undefined
      ? { expectedRevision: v.expectedRevision }
      : {}),
    createdAt: v.createdAt,
  };
}
function parseList(raw: string | null): StoredMarker[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.flatMap((entry) => parseMarker(entry) ?? [])
      : [];
  } catch {
    return [];
  }
}
const isStripped = (marker: StoredMarker): marker is StrippedMarker =>
  "withoutAuthority" in marker;
const owner = (marker: MarkerInput) =>
  marker.recoveryContext ?? `session:${marker.authority}`;
function strip(marker: CommandMarker): StrippedMarker {
  return {
    v: 2,
    key: marker.key,
    withoutAuthority: true,
    scope: marker.scope,
    createdAt: marker.createdAt,
  };
}
function readable(marker: CommandMarker, viewer: CommandViewer) {
  return (
    (viewer.scope !== "" && marker.authority === viewer.scope) ||
    (marker.recoveryContext !== undefined &&
      marker.recoveryContext === viewer.recoveryContext)
  );
}

/**
 * Every pending write of this tab under one sessionStorage key: at most one marker per
 * owner, scope and target. A marker bound only to a host session loses its attempt reference
 * when that authority ends; one bound to a recovery context stays readable by the same human.
 */
export class CommandMarkers {
  private memory: StoredMarker[] = [];
  private migrated = false;
  private readonly listeners = new Set<() => void>();
  /** False when the last write could not be stored; this page still holds the marker. */
  durable = true;
  /** Changes on every write, for subscribers that need a snapshot. */
  revision = 0;
  constructor(
    private readonly storage: () => Storage | undefined,
    private readonly now: () => number = Date.now,
    private readonly newKey: () => string = () => crypto.randomUUID(),
  ) {}

  put(input: MarkerInput): CommandMarker {
    const markers = this.read();
    const same = markers.find(
      (marker): marker is CommandMarker =>
        !isStripped(marker) &&
        owner(marker) === owner(input) &&
        marker.scope === input.scope &&
        sameTarget(marker.target, input.target),
    );
    const marker: CommandMarker = {
      v: 2,
      key: same?.attemptId === input.attemptId ? same.key : this.newKey(),
      ...input,
      createdAt:
        same?.attemptId === input.attemptId ? same.createdAt : this.now(),
    };
    this.write([...markers.filter((entry) => entry !== same), marker]);
    return marker;
  }
  remove(key: string): void {
    const markers = this.read();
    if (markers.some((marker) => marker.key === key))
      this.write(markers.filter((marker) => marker.key !== key));
  }
  removeAttempt(attemptId: string): void {
    const markers = this.read();
    const kept = markers.filter(
      (marker) => isStripped(marker) || marker.attemptId !== attemptId,
    );
    if (kept.length !== markers.length) this.write(kept);
  }
  /** This viewer's pending commands. Reading erases the reference of another session's markers. */
  list(viewer: CommandViewer, scope?: string): PendingCommand[] {
    const markers = this.read();
    let changed = false;
    const visible = markers.map((marker) => {
      if (isStripped(marker) || readable(marker, viewer)) return marker;
      if (marker.recoveryContext !== undefined) return marker;
      changed = true;
      return strip(marker);
    });
    // Erasing another session's reference changes nothing this viewer reads, so it is silent.
    if (changed) this.write(visible, false);
    return visible.flatMap((marker): PendingCommand[] => {
      if (scope !== undefined && marker.scope !== scope) return [];
      if (isStripped(marker))
        return [
          {
            withoutAuthority: true,
            key: marker.key,
            scope: marker.scope,
            createdAt: marker.createdAt,
          },
        ];
      return readable(marker, viewer)
        ? [{ withoutAuthority: false, marker }]
        : [];
    });
  }
  find(
    viewer: CommandViewer,
    scope: string,
    target: CommandTarget,
  ): CommandMarker | undefined {
    for (const entry of this.list(viewer, scope))
      if (!entry.withoutAuthority && sameTarget(entry.marker.target, target))
        return entry.marker;
    return undefined;
  }
  /** The session ended: erase references only that session could recover. */
  forgetAuthority(): void {
    const markers = this.read();
    if (
      markers.some(
        (marker) => !isStripped(marker) && marker.recoveryContext === undefined,
      )
    )
      this.write(
        markers.map((marker) =>
          isStripped(marker) || marker.recoveryContext !== undefined
            ? marker
            : strip(marker),
        ),
      );
  }
  clearWithoutAuthority(scope?: string): void {
    const markers = this.read();
    const kept = markers.filter(
      (marker) =>
        !isStripped(marker) || (scope !== undefined && marker.scope !== scope),
    );
    if (kept.length !== markers.length) this.write(kept);
  }
  /** Moves the legacy Casework item markers into this store, bound to their recovery context. */
  migrateCaseworkMarkers(scope: string): void {
    const storage = this.storageOrUndefined();
    const raw = this.getItem(storage, legacyCaseworkKey);
    if (raw === null) return;
    let legacy: unknown = [];
    try {
      legacy = JSON.parse(raw);
    } catch {
      legacy = [];
    }
    const markers = this.read();
    for (const entry of Array.isArray(legacy) ? legacy : []) {
      const v = entry as Record<string, unknown>;
      if (
        !isText(v?.itemId) ||
        !isText(v.attemptId) ||
        !isText(v.operation) ||
        !isText(v.context)
      )
        continue;
      markers.push({
        v: 2,
        key: this.newKey(),
        authority: "",
        recoveryContext: v.context,
        scope,
        target: { entity: scope, id: v.itemId },
        operation: v.operation,
        attemptId: v.attemptId,
        createdAt: this.now(),
      });
    }
    this.write(markers);
    this.removeItem(storage, legacyCaseworkKey);
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private storageOrUndefined(): Storage | undefined {
    try {
      return this.storage();
    } catch {
      return undefined;
    }
  }
  private getItem(storage: Storage | undefined, key: string): string | null {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  private removeItem(storage: Storage | undefined, key: string): void {
    try {
      storage?.removeItem(key);
    } catch {
      this.durable = false;
    }
  }
  private read(): StoredMarker[] {
    const storage = this.storageOrUndefined();
    if (!this.migrated) {
      this.migrated = true;
      this.migrateTaskMarker(storage);
      this.upgradeMarkers(storage);
    }
    if (!storage || !this.durable) return [...this.memory];
    const raw = this.getItem(storage, commandMarkerKey);
    return parseList(raw);
  }
  /** Stores first-version markers in the current version, once, on first access. */
  private upgradeMarkers(storage: Storage | undefined): void {
    const raw = this.getItem(storage, commandMarkerKey);
    let stored: unknown = [];
    try {
      stored = raw === null ? [] : JSON.parse(raw);
    } catch {
      stored = [];
    }
    if (
      Array.isArray(stored) &&
      stored.some((entry) => (entry as { v?: unknown } | null)?.v === 1)
    )
      this.write(parseList(raw), false);
  }
  private migrateTaskMarker(storage: Storage | undefined): void {
    const raw = this.getItem(storage, legacyTaskKey);
    if (raw === null) return;
    let legacy: Record<string, unknown> = {};
    try {
      legacy = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      legacy = {};
    }
    const markers = parseList(this.getItem(storage, commandMarkerKey));
    const createdAt = this.now();
    if (legacy?.unresolved === true)
      markers.push({
        v: 2,
        key: this.newKey(),
        withoutAuthority: true,
        scope: "task",
        createdAt,
      });
    else if (isText(legacy?.scope) && isText(legacy.attemptId))
      markers.push({
        v: 2,
        key: this.newKey(),
        authority: legacy.scope,
        scope: "task",
        target: { entity: "task", id: legacy.attemptId },
        operation: "submit",
        attemptId: legacy.attemptId,
        createdAt,
      });
    this.write(markers, false);
    this.removeItem(storage, legacyTaskKey);
  }
  private write(markers: StoredMarker[], notify = true): void {
    this.memory = markers;
    const storage = this.storageOrUndefined();
    try {
      if (!storage) throw new Error("Session storage is unavailable.");
      if (markers.length)
        storage.setItem(commandMarkerKey, JSON.stringify(markers));
      else storage.removeItem(commandMarkerKey);
      this.durable = true;
    } catch {
      // The current page still holds the markers in memory; the UI can say so.
      this.durable = false;
    }
    this.revision++;
    if (notify) for (const listener of this.listeners) listener();
  }
}

export type CommandState<R> =
  | { state: "idle" }
  | { state: "sending" | "recovering"; attemptId: string }
  | { state: "confirmed"; attemptId: string; value: R }
  | { state: "refused"; attemptId: string; refusal: Refusal; error?: Error }
  | {
      state: "unknown";
      attemptId: string;
      /** The session that made the attempt ended; only a generic notice remains. */
      withoutAuthority: boolean;
      value?: R;
      error?: Error;
      lastRefusal?: Refusal;
    };

const reportsUnknown = (value: unknown) =>
  !!value &&
  typeof value === "object" &&
  (value as { outcome?: unknown }).outcome === "unknown";

function unknownAfterSessionEnd<R>(
  markers: CommandMarkers,
  marker: CommandMarker,
  extra: { error?: Error; lastRefusal?: Refusal },
): CommandState<R> {
  markers.forgetAuthority();
  return {
    state: "unknown",
    attemptId: marker.attemptId,
    withoutAuthority: marker.recoveryContext === undefined,
    ...extra,
  };
}

/**
 * Sends one attempt. The marker is written before the send and removed only by a
 * confirmation or a refusal that settles the attempt; anything else leaves it unknown.
 */
export async function executeCommand<R>(
  markers: CommandMarkers,
  input: MarkerInput,
  phase: CommandPhase,
  send: () => Promise<R>,
  isUnknown: (value: R) => boolean = reportsUnknown,
): Promise<CommandState<R>> {
  const marker = markers.put(input);
  const attemptId = marker.attemptId;
  try {
    const value = await send();
    if (isUnknown(value))
      return { state: "unknown", attemptId, withoutAuthority: false, value };
    markers.remove(marker.key);
    return { state: "confirmed", attemptId, value };
  } catch (caught) {
    if (!(caught instanceof HostError)) {
      const error =
        caught instanceof Error
          ? caught
          : new Error("The service could not complete this request.");
      // A lost response (UnknownOutcome) or any unexpected failure never settles.
      return { state: "unknown", attemptId, withoutAuthority: false, error };
    }
    const { refusal, settlesOriginal } = classifyRefusal(caught, phase);
    if (settlesOriginal) {
      markers.remove(marker.key);
      return { state: "refused", attemptId, refusal, error: caught };
    }
    if (refusal.kind === "session-ended")
      return unknownAfterSessionEnd(markers, marker, {
        error: caught,
        lastRefusal: refusal,
      });
    return {
      state: "unknown",
      attemptId,
      withoutAuthority: false,
      error: caught,
      lastRefusal: refusal,
    };
  }
}

export type ProbeVerdict<R> =
  | { settled: "confirmed"; value?: R }
  | { settled: "not-applied" }
  | { settled: "unknown" };

/** Reads the target of an unknown attempt back; only a definite verdict settles it. */
export async function executeProbe<R>(
  markers: CommandMarkers,
  marker: CommandMarker,
  probe: () => Promise<ProbeVerdict<R>>,
): Promise<CommandState<R | undefined>> {
  const attemptId = marker.attemptId;
  try {
    const verdict = await probe();
    if (verdict.settled === "confirmed") {
      markers.remove(marker.key);
      return { state: "confirmed", attemptId, value: verdict.value };
    }
    if (verdict.settled === "not-applied") {
      markers.remove(marker.key);
      return {
        state: "refused",
        attemptId,
        refusal: {
          status: 0,
          code: "command.not-applied",
          kind: "stale",
          message: "",
          fields: {},
        },
      };
    }
    return { state: "unknown", attemptId, withoutAuthority: false };
  } catch (caught) {
    const error =
      caught instanceof Error
        ? caught
        : new Error("The service could not complete this request.");
    if (caught instanceof HostError && caught.status === 401)
      return unknownAfterSessionEnd(markers, marker, { error });
    return { state: "unknown", attemptId, withoutAuthority: false, error };
  }
}

/** This tab's pending commands. Held in memory where session storage is unavailable. */
export const pendingCommands = new CommandMarkers(
  () => globalThis.sessionStorage,
);
