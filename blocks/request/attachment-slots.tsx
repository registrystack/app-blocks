import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Download, FileImage, FileText, Eye } from "lucide-react";
import type { AttachmentFile, AttachmentSlot } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { useBlockContent, type BlockContent } from "@/blocks/lib/content";
import { fill, longDate } from "@/blocks/lib/format";
import { Notice } from "@/blocks/lib/notice";
import {
  CommandFeedback,
  type CommandOutcome,
} from "@/blocks/request/request-status";

/**
 * The outcome of one upload: a plain command plus what only an upload can
 * say, since the file it sends lives in the browser, not on the server.
 */
export interface UploadOutcome extends CommandOutcome {
  reset(): void;
  notRetained: boolean;
  bytesUnavailable: boolean;
  /** Why the last retry of an unresolved attempt was refused; the caller does not classify it further. */
  lastRefusal: unknown;
  upload(uploadRef: string, file: Blob): Promise<unknown>;
  dismissUnknown(): void;
}

/**
 * A record's governed attachment slots, listed with the readiness of the
 * slots the registry requires. Each slot's own upload, replace or remove
 * form, and the commands behind it, are entirely the caller's: `renderSlot`
 * renders one slot, so it can bind that slot's commands and this profile's
 * authority over it. `children` renders after the slots, at the same place
 * the caller's own preview surface belongs.
 */
export function SupportingDocuments({
  slots,
  renderSlot,
  children,
}: {
  slots?: AttachmentSlot[];
  renderSlot: (slot: AttachmentSlot) => ReactNode;
  children?: ReactNode;
}) {
  const c = useBlockContent();
  if (!slots?.length) return null;
  const required = slots.filter((slot) => slot.required);
  return (
    <section aria-labelledby="supporting-documents">
      <h2 id="supporting-documents">{c.attachmentsHeading}</h2>
      {required.length > 0 && (
        <p role="status">
          {fill(c.attachmentReadiness, {
            ready: required.filter((slot) => slot.file?.status === "available")
              .length,
            total: required.length,
          })}
        </p>
      )}
      <div className="flex flex-col divide-y border-y">
        {slots.map((slot) => (
          <Fragment key={slot.slot}>{renderSlot(slot)}</Fragment>
        ))}
      </div>
      {children}
    </section>
  );
}

export interface SlotProps {
  slot: AttachmentSlot;
  readOnly: boolean;
  onPreview: (slot: AttachmentSlot, trigger: HTMLButtonElement) => void;
  slotLabel: (slot: string) => string;
  typeLabel: (contentType: string) => string;
  statusNote: (status: string) => string;
  canPreview: (contentType: string) => boolean;
}

/**
 * One slot's presentation: what it holds, and the upload, replace or remove
 * form this profile may use. The upload and removal are each one command,
 * already in the shape every command in a request reads. `renderError`
 * renders a plain refusal exactly as the caller's other command errors do.
 */
export function SlotView({
  slot,
  readOnly,
  onPreview,
  upload,
  removal,
  remove,
  downloadHref,
  reconcileHref,
  renderError,
  slotLabel,
  typeLabel,
  statusNote,
  canPreview,
}: SlotProps & {
  upload: UploadOutcome;
  removal: CommandOutcome & { reset: () => void };
  remove: (removeRef: string) => Promise<unknown>;
  downloadHref: string;
  reconcileHref: string;
  renderError: (error: Error) => ReactNode;
}) {
  const c = useBlockContent();
  const [chosen, setChosen] = useState<File | null>(null);
  // Remounting the input is the only way to clear a file input's selection.
  const [inputKey, setInputKey] = useState(0);
  useEffect(() => {
    if (upload.result?.outcome !== "confirmed") return;
    setChosen(null);
    setInputKey((key) => key + 1);
  }, [upload.result]);

  const label = slotLabel(slot.slot);
  const types = new Intl.ListFormat("en-GB", { type: "disjunction" }).format(
    slot.contentTypes.map((type) => typeLabel(type)),
  );
  // The host checks both again; these only save sending a file it would refuse.
  const problem = !chosen
    ? null
    : !slot.contentTypes.includes(chosen.type)
      ? fill(c.attachmentWrongType, { types })
      : chosen.size > slot.maximumBytes
        ? fill(c.attachmentTooLarge, {
            size: fileSize(chosen.size, c),
            limit: fileSize(slot.maximumBytes, c),
          })
        : null;
  const file = slot.file;
  const busy = upload.pending || removal.pending;
  // An unresolved upload or removal holds the slot until it settles.
  const held = upload.unknown || removal.unknown;
  const inputId = `attachment-${slot.slot}`;

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="document-slot-heading">
          {file?.contentType.startsWith("image/") ? (
            <FileImage className="document-slot-icon" aria-hidden="true" />
          ) : (
            <FileText className="document-slot-icon" aria-hidden="true" />
          )}
          <div className="flex flex-col gap-1">
            <h3 className="m-0">{label}</h3>
            {file ? (
              <>
                {file.status !== "erased" && (
                  <p className="m-0">{fileLine(file, c, typeLabel)}</p>
                )}
                {file.status !== "available" && (
                  <p className="muted m-0">{statusNote(file.status)}</p>
                )}
              </>
            ) : (
              <p className="muted m-0">{c.attachmentNone}</p>
            )}
            {slot.required && file?.status !== "available" && (
              <p className="muted m-0">{c.attachmentRequired}</p>
            )}
          </div>
        </div>
        <div className="actions">
          {file?.status === "available" && canPreview(file.contentType) && (
            <Button
              variant="outline"
              onClick={(event) => onPreview(slot, event.currentTarget)}
            >
              <Eye aria-hidden="true" />
              {fill(c.documentView, { document: label.toLowerCase() })}
            </Button>
          )}
          {file?.status === "available" && (
            <Button
              variant="outline"
              render={<a href={downloadHref} download />}
            >
              <Download />
              {fill(c.attachmentDownload, { document: label.toLowerCase() })}
            </Button>
          )}
          {!readOnly && file && slot.removeRef && !upload.unknown && (
            <Button
              variant="outline"
              disabled={busy || held}
              onClick={() => {
                upload.reset();
                void remove(slot.removeRef!);
              }}
            >
              {c.attachmentRemove}
            </Button>
          )}
        </div>
      </div>
      {!readOnly && slot.uploadRef && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!chosen || problem || !slot.uploadRef) return;
            removal.reset();
            void upload.upload(slot.uploadRef, chosen);
          }}
        >
          <Field data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor={inputId}>
              {file ? c.attachmentChooseReplacement : c.attachmentChoose}
            </FieldLabel>
            <Input
              key={inputKey}
              id={inputId}
              type="file"
              accept={slot.contentTypes.join(",")}
              aria-describedby={
                problem
                  ? `${inputId}-hint ${inputId}-problem`
                  : `${inputId}-hint`
              }
              aria-invalid={problem ? true : undefined}
              onChange={(event) =>
                setChosen(event.currentTarget.files?.[0] ?? null)
              }
            />
            <FieldDescription id={`${inputId}-hint`}>
              {fill(c.attachmentAllowed, {
                types,
                size: fileSize(slot.maximumBytes, c),
              })}
            </FieldDescription>
            {problem && (
              <FieldError id={`${inputId}-problem`}>{problem}</FieldError>
            )}
          </Field>
          {chosen && !problem && (
            <p className="attachment-selection muted" role="status">
              {fill(
                file ? c.documentSelectedReplacement : c.documentSelected,
                {
                  name: chosen.name,
                  type: typeLabel(chosen.type),
                  size: fileSize(chosen.size, c),
                },
              )}
            </p>
          )}
          <div className="actions">
            <Button
              type="submit"
              disabled={!chosen || !!problem || busy || held}
            >
              {file ? c.attachmentReplace : c.attachmentUpload}
            </Button>
          </div>
        </form>
      )}
      <UploadFeedback
        upload={upload}
        reconcileHref={reconcileHref}
        renderError={renderError}
      />
      <CommandFeedback
        task={removal}
        reconcileHref={reconcileHref}
        renderError={renderError}
      />
    </div>
  );
}

/**
 * The upload's own feedback. A file the browser could not keep was never sent. A retry the
 * service refused leaves the upload unresolved; once the person has checked the slots they
 * may stop waiting for it, and a file the browser no longer holds cannot be retried.
 */
function UploadFeedback({
  upload,
  reconcileHref,
  renderError,
}: {
  upload: UploadOutcome;
  reconcileHref: string;
  renderError: (error: Error) => ReactNode;
}) {
  const c = useBlockContent();
  if (upload.notRetained)
    return (
      <Notice tone="warning" title={c.attachmentNotRetainedTitle}>
        <p>{c.attachmentNotRetained}</p>
      </Notice>
    );
  const stopWaiting = (
    <Button variant="ghost" onClick={upload.dismissUnknown}>
      {c.attachmentStopWaiting}
    </Button>
  );
  if (upload.bytesUnavailable)
    return (
      <Notice tone="warning" title={c.unknownTitle}>
        <p>{c.attachmentFileLost}</p>
        <p className="reference">
          {c.receipt}: <span className="font-mono">{upload.reference}</span>
        </p>
        <div className="actions">
          <Button render={<a href={reconcileHref} />} variant="outline">
            {c.reconcile}
          </Button>
          {stopWaiting}
        </div>
      </Notice>
    );
  return (
    <>
      <CommandFeedback
        task={upload}
        reconcileHref={reconcileHref}
        renderError={renderError}
      />
      {Boolean(upload.lastRefusal) && !upload.pending && (
        <div className="actions">{stopWaiting}</div>
      )}
    </>
  );
}

/** What is in the slot, in the caller's words: kind, size and when it came. */
function fileLine(
  file: AttachmentFile,
  c: BlockContent,
  typeLabel: (contentType: string) => string,
): string {
  const type = typeLabel(file.contentType);
  const size = fileSize(file.byteSize, c);
  const date = file.uploadedAt ? longDate(file.uploadedAt) : null;
  return date
    ? fill(c.attachmentFileLine, { type, size, date })
    : fill(c.attachmentFileLineUndated, { type, size });
}

/** Whole kilobytes below a megabyte, megabytes to one decimal place above. */
function fileSize(bytes: number, c: BlockContent): string {
  const megabyte = 1024 * 1024;
  if (bytes < megabyte)
    return fill(c.fileSizeKilobytes, {
      size: Math.max(1, Math.round(bytes / 1024)),
    });
  return fill(c.fileSizeMegabytes, {
    size: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(
      bytes / megabyte,
    ),
  });
}
