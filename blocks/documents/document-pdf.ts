import { readBundledAsset } from "@registrystack/app-runtime";
import { getDocument, PDFWorker, type PDFPageProxy } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import {
  maximumCanvasPixels,
  sizeCanvas,
  type DocumentSource,
} from "@/blocks/documents/document-view";
import { pdfResources } from "@/blocks/documents/pdf-resources";

// Ship font resources with the app. Only the resources a page needs are read;
// neither the document nor a CDN chooses a network address for the renderer.
// PDF.js names the reader `fetch`; it reads a bundled file through the runtime.
class BundledPdfData {
  fetch = async ({ kind, filename }: { kind: string; filename: string }) => {
    const directory =
      kind === "cMapUrl"
        ? "cmaps"
        : kind === "standardFontDataUrl"
          ? "standard_fonts"
          : null;
    const href = directory && pdfResources[`${directory}/${filename}`];
    if (!href) throw new Error("Document font resource unavailable.");
    return readBundledAsset(window.location.origin, href);
  };
}

/** Render pages and plain text only. No PDF scripting, link, form, attachment,
 * or annotation DOM is constructed. PDF.js 6 removed its eval code generation.
 * The worker and its data are destroyed when the reader closes the document.
 */
export async function openPdf(
  bytes: ArrayBuffer,
  signal: AbortSignal,
): Promise<DocumentSource> {
  const port = new PdfWorker();
  const worker = PDFWorker.create({ port });
  const task = getDocument({
    data: new Uint8Array(bytes),
    worker,
    useWorkerFetch: false,
    useWasm: false,
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    stopAtErrors: true,
    // stopAtErrors makes oversized images fail the preview, rather than
    // silently omitting evidence. This admits ordinary high-resolution scans.
    maxImageSize: 40_000_000,
    canvasMaxAreaInBytes: maximumCanvasPixels * 4,
    BinaryDataFactory: BundledPdfData,
    verbosity: 0,
  });
  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    signal.removeEventListener("abort", destroy);
    void task
      .destroy()
      .catch(() => {})
      .finally(() => {
        worker.destroy();
        port.terminate();
      });
  }
  signal.addEventListener("abort", destroy, { once: true });
  try {
    const pdf = await task.promise;
    signal.throwIfAborted();
    const pageUses = new Map<PDFPageProxy, number>();

    async function usePage<T>(
      pageNumber: number,
      operationSignal: AbortSignal,
      operation: (page: PDFPageProxy) => Promise<T>,
    ): Promise<T> {
      const page = await pdf.getPage(pageNumber);
      pageUses.set(page, (pageUses.get(page) ?? 0) + 1);
      try {
        operationSignal.throwIfAborted();
        return await operation(page);
      } finally {
        const remaining = (pageUses.get(page) ?? 1) - 1;
        if (remaining > 0) pageUses.set(page, remaining);
        else {
          pageUses.delete(page);
          page.cleanup();
        }
      }
    }

    return {
      pages: pdf.numPages,
      destroy,
      async draw(canvas, pageNumber, width, zoom, rotation, renderSignal) {
        await usePage(pageNumber, renderSignal, async (page) => {
          const angle = (page.rotate + rotation) % 360;
          const natural = page.getViewport({ scale: 1, rotation: angle });
          const viewport = page.getViewport({
            scale: (width / natural.width) * zoom,
            rotation: angle,
          });
          const ratio = sizeCanvas(canvas, viewport.width, viewport.height);
          const render = page.render({
            canvas,
            viewport,
            transform: [ratio, 0, 0, ratio, 0, 0],
          });
          const cancel = () => render.cancel();
          renderSignal.addEventListener("abort", cancel, { once: true });
          try {
            await render.promise;
            renderSignal.throwIfAborted();
          } finally {
            renderSignal.removeEventListener("abort", cancel);
          }
        });
      },
      async readText(pageNumber, textSignal) {
        return usePage(pageNumber, textSignal, async (page) => {
          const reader = page.streamTextContent().getReader();
          const cancel = () => void reader.cancel(textSignal.reason);
          textSignal.addEventListener("abort", cancel, { once: true });
          let itemCount = 0;
          let text = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              textSignal.throwIfAborted();
              if (done) return text.trim();
              itemCount += value.items.length;
              if (itemCount > 20_000) return null;
              for (const item of value.items) {
                if ("str" in item)
                  text += item.str + (item.hasEOL ? "\n" : " ");
                if (text.length > 100_000) return null;
              }
            }
          } finally {
            textSignal.removeEventListener("abort", cancel);
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
        });
      },
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
