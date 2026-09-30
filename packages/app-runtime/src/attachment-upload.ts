import type { CommandSpec } from "./command-hooks.js";
import {
  classifyRefusal,
  type CommandMarkers,
  type CommandTarget,
  type PendingCommand,
} from "./commands.js";
import { HostError } from "./errors.js";
import type { HostClient } from "./index.js";
import type { RecordTaskResult } from "./model.js";

/**
 * The command scope of a file placed in an attachment slot. A first-version marker
 * named this scope as its target's entity, as a record upload names its record's.
 */
export const attachmentScope = "attachment";
const lifetime = 60 * 60 * 1_000;
const cacheName = "registry-app-kit-attachment-recovery-v1";

/** One slot of one resource, as a command target. */
export function attachmentTarget(resourceId: string, slot: string): string {
  return `${encodeURIComponent(resourceId)}/${encodeURIComponent(slot)}`;
}
export function parseAttachmentTarget(
  target: string,
): { resourceId: string; slot: string } | null {
  const parts = target.split("/");
  if (parts.length !== 2) return null;
  try {
    return {
      resourceId: decodeURIComponent(parts[0]!),
      slot: decodeURIComponent(parts[1]!),
    };
  } catch {
    return null;
  }
}

export interface AttachmentUpload {
  resourceId: string;
  slot: string;
  uploadRef: string;
  file: Blob;
}
export interface AttachmentUploadInput extends AttachmentUpload {
  /** The host session scope the bytes are kept under. */
  authority: string;
  /** The entity of the record that holds the slot. */
  entity: string;
}

/** The command target of one slot upload: the record's entity and the slot. */
export function uploadTarget(
  entity: string,
  resourceId: string,
  slot: string,
): CommandTarget {
  return { entity, id: attachmentTarget(resourceId, slot) };
}

/**
 * The exact bytes of each unresolved upload, kept in the Cache API for an hour so a retry
 * after a reload sends the same file under the same attempt. Keyed by session scope,
 * target and the record's entity, when there is one; only the attempt that kept them
 * reads them back.
 */
export class RetainedUploads {
  private readonly memory = new Map<string, AttachmentUpload>();
  constructor(
    private readonly open: () => Promise<Cache> = () => caches.open(cacheName),
    private readonly origin: string = globalThis.location?.origin ?? "",
    private readonly now: () => number = Date.now,
  ) {}

  async keep(
    authority: string,
    target: string,
    attemptId: string,
    upload: AttachmentUpload,
    entity?: string,
  ): Promise<void> {
    const cache = await this.open();
    await this.purge(cache);
    await cache.put(
      this.key(authority, target, entity),
      new Response(upload.file, {
        headers: {
          "Content-Type": upload.file.type || "application/octet-stream",
          "X-Appkit-Attempt": attemptId,
          "X-Appkit-Action": upload.uploadRef,
          "X-Appkit-Expires": String(this.now() + lifetime),
        },
      }),
    );
    this.memory.set(
      this.memoryKey(authority, target, attemptId, entity),
      upload,
    );
  }
  async recover(
    authority: string,
    target: string,
    attemptId: string,
    entity?: string,
  ): Promise<AttachmentUpload | null> {
    const held = this.memory.get(
      this.memoryKey(authority, target, attemptId, entity),
    );
    if (held) return held;
    const parts = parseAttachmentTarget(target);
    if (!parts) return null;
    const cache = await this.open();
    await this.purge(cache);
    const response = await cache.match(this.key(authority, target, entity));
    const uploadRef = response?.headers.get("X-Appkit-Action");
    if (
      !response ||
      !uploadRef ||
      response.headers.get("X-Appkit-Attempt") !== attemptId
    )
      return null;
    return { ...parts, uploadRef, file: await response.blob() };
  }
  async forget(
    authority: string,
    target: string,
    entity?: string,
  ): Promise<void> {
    const prefix = this.memoryKey(authority, target, "", entity);
    for (const key of this.memory.keys())
      if (key.startsWith(prefix)) this.memory.delete(key);
    const cache = await this.open();
    await cache.delete(this.key(authority, target, entity));
  }

  private key(authority: string, target: string, entity?: string) {
    const query = new URLSearchParams({
      scope: authority,
      target,
      ...(entity === undefined ? {} : { entity }),
    });
    return `${this.origin}/__appkit/recovery/attachment?${query}`;
  }
  private memoryKey(
    authority: string,
    target: string,
    attemptId: string,
    entity?: string,
  ) {
    return JSON.stringify([authority, target, entity ?? null]) + attemptId;
  }
  private async purge(cache: Cache) {
    const requests = await cache.keys();
    await Promise.all(
      requests.map(async (request) => {
        const response = await cache.match(request);
        const expires = Number(response?.headers.get("X-Appkit-Expires"));
        if (!Number.isFinite(expires) || expires <= this.now())
          await cache.delete(request);
      }),
    );
  }
}

function localRefusal(status: number, code: string, message: string) {
  return new HostError(status, { code, message });
}

/**
 * Places one file in a slot of any entity's record as a command, sent to the record's own
 * document route. The bytes are kept before the file is sent, and a file whose bytes or
 * pending marker cannot be kept is not sent. The bytes are forgotten only with the
 * attempt: on confirmation or on a refusal that settles it.
 */
export function recordAttachmentUploadCommand(
  uploads: RetainedUploads,
  markers: CommandMarkers,
): CommandSpec<AttachmentUploadInput, RecordTaskResult> {
  const put = (
    host: HostClient,
    target: CommandTarget,
    upload: AttachmentUpload,
    attemptId: string,
  ) =>
    host.uploadRecordAttachment(
      target.entity,
      upload.resourceId,
      upload.slot,
      upload.uploadRef,
      upload.file,
      attemptId,
    );
  async function dispatch(
    host: HostClient,
    authority: string,
    target: CommandTarget,
    upload: AttachmentUpload,
    attemptId: string,
    phase: "fresh" | "retry",
  ) {
    try {
      const value = await put(host, target, upload, attemptId);
      if (value.outcome === "confirmed") await forget(authority, target);
      return value;
    } catch (caught) {
      if (
        caught instanceof HostError &&
        classifyRefusal(caught, phase).settlesOriginal
      )
        await forget(authority, target);
      throw caught;
    }
  }
  async function forget(authority: string, target: CommandTarget) {
    try {
      await uploads.forget(authority, target.id, target.entity);
    } catch {
      // The bytes expire within the hour; a failed delete changes no outcome.
    }
  }
  return {
    scope: attachmentScope,
    operation: () => "upload",
    async send(host, input, attemptId) {
      const target = uploadTarget(input.entity, input.resourceId, input.slot);
      const refuse = () =>
        localRefusal(
          0,
          "attachment.not-retained",
          "This browser could not preserve the file for an exact retry, so it was not uploaded.",
        );
      // Without a durable marker a reload would lose track of an unresolved upload.
      if (!markers.durable) throw refuse();
      try {
        await uploads.keep(
          input.authority,
          target.id,
          attemptId,
          input,
          target.entity,
        );
      } catch {
        await forget(input.authority, target);
        throw refuse();
      }
      return dispatch(host, input.authority, target, input, attemptId, "fresh");
    },
    async retry(host, attemptId, marker) {
      let upload: AttachmentUpload | null = null;
      try {
        upload = await uploads.recover(
          marker.authority,
          marker.target.id,
          attemptId,
          marker.target.entity,
        );
      } catch {
        upload = null;
      }
      // Never a settling refusal: the original may still have been applied.
      if (!upload)
        throw localRefusal(
          410,
          "attachment.bytes-unavailable",
          "This browser no longer holds the exact file, so it cannot be sent again.",
        );
      return dispatch(
        host,
        marker.authority,
        marker.target,
        upload,
        attemptId,
        "retry",
      );
    },
  };
}

/** One unresolved upload this session can still point to. */
export interface PendingUpload {
  key: string;
  attemptId: string;
  /**
   * The entity of the resource the file was placed on; null for a first-version upload,
   * which named this scope instead and was always on a request.
   */
  entity: string | null;
  resourceId: string;
  slot: string;
}
/**
 * The unresolved uploads of this session, and whether another session left any whose
 * reference it took with it.
 */
export function pendingUploads(pending: readonly PendingCommand[]): {
  live: PendingUpload[];
  orphaned: boolean;
} {
  const live = pending.flatMap((entry): PendingUpload[] => {
    if (entry.withoutAuthority) return [];
    const target = parseAttachmentTarget(entry.marker.target.id);
    if (!target) return [];
    return [
      {
        key: entry.marker.key,
        attemptId: entry.marker.attemptId,
        entity:
          entry.marker.target.entity === attachmentScope
            ? null
            : entry.marker.target.entity,
        resourceId: target.resourceId,
        slot: target.slot,
      },
    ];
  });
  return { live, orphaned: pending.some((entry) => entry.withoutAuthority) };
}
