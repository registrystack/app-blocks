import type { AttachmentFile } from "./types.js";

/** Content types the preview reader will open; anything else stays download-only. */
export const documentPreviewTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];
// Match the host's download bound. Documents stay in memory for this view only.
const maximumDocumentBytes = 5_242_880;

/** Read the same authorized bytes as Download, and bind them to this version.
 * A replacement between the metadata read and GET must never appear as the
 * evidence the officer had on screen. No external URL or redirect is followed.
 * `origin` is the page's own origin, supplied by the caller rather than read
 * from a global, so the same-origin guarantee holds wherever this runs.
 */
export async function readDocument(
  origin: string,
  href: string,
  file: AttachmentFile,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const url = new URL(href, origin);
  if (
    url.origin !== origin ||
    file.status !== "available" ||
    !documentPreviewTypes.includes(file.contentType) ||
    file.byteSize <= 0 ||
    file.byteSize > maximumDocumentBytes
  )
    throw new Error("Document is not available for preview.");
  const response = await fetch(url, {
    signal,
    credentials: "same-origin",
    redirect: "error",
    cache: "no-store",
  });
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0]?.trim() !==
      file.contentType
  )
    throw new Error("Document could not be read.");
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) !== file.byteSize)
    throw new Error("Document has changed.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Document could not be read.");
  const buffer = new Uint8Array(file.byteSize);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      signal.throwIfAborted();
      if (offset + value.length > buffer.length)
        throw new Error("Document has changed.");
      buffer.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  if (offset !== file.byteSize) throw new Error("Document has changed.");
  const bytes = buffer.buffer;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  if (hex !== file.sha256) throw new Error("Document has changed.");
  signal.throwIfAborted();
  return bytes;
}
