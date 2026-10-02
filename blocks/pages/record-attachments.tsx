import type { AttachmentSlot } from "@registrystack/app-runtime";
import { documentPreviewTypes } from "@registrystack/app-runtime";
import { useAttachmentHref } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { Notice } from "@/blocks/lib/notice";
import {
  SlotView,
  SupportingDocuments as AttachmentSlots,
  type UploadOutcome,
} from "@/blocks/request/attachment-slots";
import type { CommandOutcome } from "@/blocks/request/request-status";
import { DocumentPreview } from "@/blocks/documents/document-preview";
import {
  useDocumentSelection,
  version,
} from "@/blocks/documents/document-selection";
import type { DocumentSource } from "@/blocks/documents/document-view";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { splitRoute, useRoute } from "@/blocks/shell/routing";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { recordPath, useRegister } from "@/blocks/pages/record";

export { useDocumentSelection };

/** A record whose slots these are, at the revision it was read. */
export interface AttachmentsRecord {
  entity: string;
  id: string;
  revision: string;
}

/** A slot's removal command, in the shape every command reads. */
export type RemovalOutcome = CommandOutcome & {
  reset(): void;
  submit(removeRef: string, expectedRevision: string): Promise<unknown>;
};

/**
 * A record's governed attachment slots, over `@/blocks/request/attachment-slots`.
 * The host lists only the slots this profile may read, and carries an upload
 * or remove reference only where the registry grants one, so the section
 * offers exactly what this person may do. Available PDFs and raster images
 * may be read in an inert, on-demand viewer.
 *
 * A slot's upload and removal are commands, one instance per slot, so they
 * are injected as hooks rather than as a single write: `useUpload` and
 * `useRemoval` already speak in `reference`, never the runtime's own attempt
 * id, which by convention only the host that names it may show a page.
 */
export function SupportingDocuments({
  record,
  slots,
  readOnly = false,
  onPreview,
  openPdf,
  useUpload,
  useRemoval,
}: {
  record: AttachmentsRecord;
  slots?: AttachmentSlot[];
  readOnly?: boolean;
  onPreview?: (slot: AttachmentSlot, trigger: HTMLButtonElement) => void;
  /** Opens a PDF slot's bytes in the preview; without it, a PDF stays download-only. */
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
  useUpload: (slot: string) => UploadOutcome;
  useRemoval: (slot: string) => RemovalOutcome;
}) {
  const pages = usePagesContent();
  const attachmentHref = useAttachmentHref();
  const selection = useDocumentSelection(slots);
  if (!slots?.length) return null;
  const owner = `${record.entity}:${record.id}`;
  const href = (slot: string) => attachmentHref(record.entity, record.id, slot);
  return (
    <AttachmentSlots
      slots={slots}
      renderSlot={(slot) => (
        <RecordSlot
          record={record}
          slot={slot}
          readOnly={readOnly}
          onPreview={onPreview ?? selection.select}
          useUpload={useUpload}
          useRemoval={useRemoval}
        />
      )}
    >
      {!onPreview && selection.slot?.file && (
        <DocumentPreview
          key={`${owner}:${selection.slot.slot}:${version(selection.slot.file)}`}
          href={href(selection.slot.slot)}
          file={selection.slot.file}
          label={
            pages.attachmentSlots[selection.slot.slot] ??
            pages.attachmentSlotFallback
          }
          onClose={selection.close}
          openPdf={openPdf}
        />
      )}
    </AttachmentSlots>
  );
}

interface SlotProps {
  slot: AttachmentSlot;
  readOnly: boolean;
  onPreview: (slot: AttachmentSlot, trigger: HTMLButtonElement) => void;
}

/**
 * A record's slot, removed at the revision the record was read. Binds this
 * slot's upload and removal commands, the register's own words for it, and
 * error display to the block's SlotView, which walks the choose/upload/
 * remove controls themselves.
 */
function RecordSlot({
  record,
  useUpload,
  useRemoval,
  ...props
}: SlotProps & {
  record: AttachmentsRecord;
  useUpload: (slot: string) => UploadOutcome;
  useRemoval: (slot: string) => RemovalOutcome;
}) {
  const pages = usePagesContent(),
    routes = useRegisterRoutes(),
    register = useRegister(),
    attachmentHref = useAttachmentHref(),
    upload = useUpload(props.slot.slot),
    removal = useRemoval(props.slot.slot);
  const path =
    register.entities &&
    recordPath(routes, register.entities, record.entity, record.id);
  return (
    <SlotView
      {...props}
      upload={upload}
      removal={removal}
      remove={(removeRef) => removal.submit(removeRef, record.revision)}
      downloadHref={attachmentHref(record.entity, record.id, props.slot.slot)}
      reconcileHref={path ? `#${path}` : "#/"}
      renderError={(error) => <ErrorPanel error={error} />}
      slotLabel={(slot) =>
        pages.attachmentSlots[slot] ?? pages.attachmentSlotFallback
      }
      typeLabel={(contentType) =>
        pages.attachmentTypes[contentType] ?? contentType
      }
      statusNote={(status) =>
        pages.attachmentStatus[status as keyof typeof pages.attachmentStatus]
      }
      canPreview={(contentType) => documentPreviewTypes.includes(contentType)}
    />
  );
}

/** One unresolved upload this session can still point to, in the shape every command reads. */
export interface PendingUploadItem {
  key: string;
  slot: string;
  reference: string;
  /** The entity of the resource the file was placed on; null for a first-version upload. */
  entity: string | null;
  resourceId: string;
}

export interface PendingUploadsState {
  live: readonly PendingUploadItem[];
  /** Whether a previous session left an upload whose reference it took with it. */
  orphaned: boolean;
  forgetOrphaned: () => void;
}

/**
 * Every unresolved upload of this session, for the notice of writes that
 * need checking. The record or request that is open shows its own uploads
 * in their slots, so they are left out here; an upload from the first
 * marker version stays, since no slot claims it.
 */
export function PendingUploadsNotice({
  usePending,
}: {
  /** This session's unresolved uploads; a page supplies this over its own host. */
  usePending: () => PendingUploadsState;
}) {
  const pending = usePending();
  if (!pending.live.length && !pending.orphaned) return null;
  return <PendingUploads pending={pending} />;
}

function PendingUploads({ pending }: { pending: PendingUploadsState }) {
  const pages = usePagesContent(),
    block = useBlockContent(),
    routes = useRegisterRoutes(),
    register = useRegister(),
    { path, query } = splitRoute(useRoute());
  // Whether `open` is the page in view: the same path naming the same request entity.
  const isPage = (open: string) => {
    const target = splitRoute(open);
    return (
      target.path === path &&
      target.query.get("request") === query.get("request")
    );
  };
  const uploads = pending.live.flatMap((upload) => {
    // A first-version upload names no entity; every such upload was on a
    // request, from when a register had one request entity: the followed one.
    // A later upload names its own entity, a request entity included.
    const firstVersion = upload.entity === null;
    const entity = firstVersion
      ? register.entities?.followedRequest?.id
      : upload.entity;
    const open =
      register.entities && entity
        ? recordPath(routes, register.entities, entity, upload.resourceId)
        : null;
    // No slot claims a first-version upload, so it stays here on its own page.
    return open && isPage(open) && !firstVersion ? [] : [{ upload, open }];
  });
  const previous = pending.orphaned;
  if (!uploads.length && !previous) return null;
  return (
    <Notice tone="warning" title={pages.attachmentPendingTitle}>
      {uploads.map(({ upload, open }) => {
        const label =
          pages.attachmentSlots[upload.slot] ?? pages.attachmentSlotFallback;
        return (
          <div key={upload.key}>
            <p>
              {fill(pages.attachmentPendingBody, {
                document: label.toLowerCase(),
              })}
            </p>
            <p className="reference">
              {block.receipt}:{" "}
              <span className="font-mono">{upload.reference}</span>
            </p>
            {open && (
              <div className="actions">
                <Button render={<a href={`#${open}`} />} variant="outline">
                  {pages.attachmentPendingOpen}
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {previous && (
        <>
          <p>{pages.attachmentPendingPrevious}</p>
          <div className="actions">
            <Button variant="ghost" onClick={pending.forgetOrphaned}>
              {pages.leaveRecovery}
            </Button>
          </div>
        </>
      )}
    </Notice>
  );
}
