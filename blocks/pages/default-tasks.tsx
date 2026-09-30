import {
  useAttachmentRemoval,
  useAttachmentUpload,
  useRecordTask,
  withReference,
} from "@registrystack/app-runtime/react";
import type { ChangeRequestTask } from "@/blocks/pages/change-request-form-page";
import type { CreateRecordTask } from "@/blocks/pages/create-record-page";
import type { RemovalOutcome } from "@/blocks/pages/record-attachments";
import { useRegister } from "@/blocks/pages/record";
import {
  matchRegisterRoute,
  useRegisterRoutes,
} from "@/blocks/pages/register-routes";
import type { RequestDecisionTask } from "@/blocks/pages/request-detail-page";
import type { UploadOutcome } from "@/blocks/request/attachment-slots";
import { splitRoute, useRoute } from "@/blocks/shell/routing";

/**
 * The commands the default pages submit with: `@registrystack/app-runtime`'s
 * own hooks, each result handed on under the `reference` name the page blocks
 * read. A page block never keeps or compares an attempt itself, only shows
 * the one its caller hands it.
 */

/** The create task on a record's creation form. */
export function useCreateTask(): CreateRecordTask {
  return withReference(useRecordTask());
}

/** The change task on a record's change request form, over the same record task. */
export function useChangeTask(): ChangeRequestTask {
  return withReference(useRecordTask());
}

/** The decision task on a request's own page, over the same record task. */
export function useRequestTask(): RequestDecisionTask {
  return withReference(useRecordTask());
}

/**
 * The id of the request the current route names, or "" off a request route.
 * `RequestDetailPage` calls `useUpload`/`useRemoval` with only a slot, never
 * the request id itself, so a hook wired onto the whole app reads it from the
 * route the same way the page's own id prop was resolved.
 */
function useCurrentRequestId(): string {
  const routes = useRegisterRoutes();
  const { path } = splitRoute(useRoute());
  const match = matchRegisterRoute(routes, path);
  return match.kind === "request" ? match.id : "";
}

/** An upload command for one slot of any record, aimed by entity and id. */
export function useRecordUpload(
  entity: string,
  id: string,
  slot: string,
): UploadOutcome {
  return withReference(useAttachmentUpload(entity, id, slot));
}

/** A removal command for one slot of any record, aimed by entity and id. */
export function useRecordRemoval(
  entity: string,
  id: string,
  slot: string,
): RemovalOutcome {
  return withReference(useAttachmentRemoval(entity, id, slot));
}

/** The upload command for a request's attachment slots, aimed at the request the route names. */
export function useUpload(slot: string): UploadOutcome {
  const requestEntityId = useRegister().entities?.request?.id ?? "";
  return useRecordUpload(requestEntityId, useCurrentRequestId(), slot);
}

/** The removal command for a request's attachment slots, aimed at the request the route names. */
export function useRemoval(slot: string): RemovalOutcome {
  const requestEntityId = useRegister().entities?.request?.id ?? "";
  return useRecordRemoval(requestEntityId, useCurrentRequestId(), slot);
}
