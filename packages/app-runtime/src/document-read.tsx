import { useEffect, useState } from "react";
import { readDocument } from "./document.js";
import type { AttachmentFile } from "./types.js";

/** How long a document read may take before it counts as failed. */
const readTimeoutMs = 30_000;

/**
 * Starts one verified read of a document and reports its end exactly once:
 * the bytes, or a failure (a refused read, a changed document or the
 * timeout). The returned function cancels the read and silences its report.
 */
export function startDocumentRead(
  origin: string,
  href: string,
  file: AttachmentFile,
  settle: {
    onBytes: (bytes: ArrayBuffer) => void;
    onFailure: () => void;
  },
  timeoutMs = readTimeoutMs,
): () => void {
  const controller = new AbortController();
  let current = true;
  const timeout = setTimeout(() => {
    if (current) settle.onFailure();
    current = false;
    controller.abort();
  }, timeoutMs);
  readDocument(origin, href, file, controller.signal).then(
    (bytes) => {
      clearTimeout(timeout);
      if (current) settle.onBytes(bytes);
      current = false;
    },
    () => {
      clearTimeout(timeout);
      if (current) settle.onFailure();
      current = false;
    },
  );
  return () => {
    current = false;
    clearTimeout(timeout);
    controller.abort();
  };
}

/** The state of a document read: its bytes once verified, or that it failed. */
export interface DocumentRead {
  bytes: ArrayBuffer | null;
  failed: boolean;
  /** Counts the reads started, so a view can restart its own work with each. */
  attempt: number;
  /** Reads the document again; a block calls this and keeps no retry logic. */
  retry: () => void;
}

/**
 * Reads a document's bytes through the verified reader, bound to the page's
 * own origin, and starts again for a different version of the document or a
 * `retry`. With `enabled` false it reads nothing, for a type the view cannot
 * open.
 */
export function useDocumentRead(
  href: string,
  file: AttachmentFile,
  enabled = true,
): DocumentRead {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    setBytes(null);
    setFailed(false);
    return startDocumentRead(window.location.origin, href, file, {
      onBytes: setBytes,
      onFailure: () => setFailed(true),
    });
    // Only a different version of the document, or a retry, restarts the read.
  }, [href, file.sha256, file.byteSize, file.contentType, attempt, enabled]);
  return { bytes, failed, attempt, retry: () => setAttempt(attempt + 1) };
}
