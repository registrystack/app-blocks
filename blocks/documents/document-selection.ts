import { useEffect, useState } from "react";
import type {
  AttachmentFile,
  AttachmentSlot,
} from "@registrystack/app-runtime";

type Selection = { slot: string; version: string; trigger: HTMLButtonElement };

/** A file's identity at one version: distinguishes a replacement from a retained file. */
export function version(file: AttachmentFile) {
  return `${file.sha256}:${file.byteSize}:${file.contentType}:${file.status}`;
}

/** Keep selection bound to its version; refreshed or withdrawn files close it. */
export function useDocumentSelection(slots: AttachmentSlot[] | undefined) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const slot = slots?.find(
    (slot) =>
      slot.slot === selection?.slot &&
      slot.file &&
      version(slot.file) === selection.version,
  );
  function close() {
    selection?.trigger.isConnected && selection.trigger.focus();
    setSelection(null);
  }
  useEffect(() => {
    if (selection && !slot) close();
  }, [selection, slot]);
  return {
    slot,
    close,
    select: (slot: AttachmentSlot, trigger: HTMLButtonElement) => {
      if (slot.file?.status === "available")
        setSelection({ slot: slot.slot, version: version(slot.file), trigger });
    },
  };
}
