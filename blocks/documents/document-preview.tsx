import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { AttachmentFile } from "@registrystack/app-runtime";
import { useDocumentRead } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/blocks/lib/content";
import { fill, inSentence } from "@/blocks/lib/format";
import {
  useDocumentsContent,
  type DocumentsContent,
} from "@/blocks/documents/documents-content";
import {
  openImageDocument,
  type DocumentSource,
} from "@/blocks/documents/document-view";

/**
 * One selected version, mounted only after a deliberate View action. PDF
 * rendering is heavier than this block should carry on its own, so an app
 * that offers PDF previews passes `openPdf`; without it, a PDF file shows
 * the unavailable wording and the download link at once, with no read and no
 * retry, since a retry could not succeed.
 */
export function DocumentPreview({
  href,
  file,
  label,
  onClose,
  openPdf,
}: {
  href: string;
  file: AttachmentFile;
  label: string;
  onClose: () => void;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const copy = useDocumentsContent();
  const locale = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<DocumentSource | null>(null);
  const pdfWithoutViewer = file.contentType === "application/pdf" && !openPdf;
  const read = useDocumentRead(href, file, !pdfWithoutViewer);
  const [openFailed, setOpenFailed] = useState(false);
  const error = pdfWithoutViewer || read.failed || openFailed;
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [width, setWidth] = useState(600);
  const [rendered, setRendered] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [pageText, setPageText] = useState<string | null>();
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    setSource(null);
    setOpenFailed(false);
    setPage(1);
    if (!read.bytes) return;
    const bytes = read.bytes;
    const controller = new AbortController();
    let document: DocumentSource | null = null;
    let current = true;
    const timeout = setTimeout(() => {
      if (current) setOpenFailed(true);
      controller.abort();
    }, 30_000);
    async function open(): Promise<DocumentSource> {
      if (file.contentType === "application/pdf")
        return openPdf!(bytes, controller.signal);
      return openImageDocument(bytes, file.contentType, controller.signal);
    }
    void open()
      .then((opened) => {
        clearTimeout(timeout);
        if (!current || controller.signal.aborted) return opened.destroy();
        document = opened;
        setSource(opened);
      })
      .catch(() => {
        clearTimeout(timeout);
        if (current) setOpenFailed(true);
      });
    return () => {
      current = false;
      clearTimeout(timeout);
      controller.abort();
      document?.destroy();
    };
    // openPdf is stable for the caller's purposes (a fresh closure each render
    // over the same PDF module); only new bytes should restart the open.
  }, [read.bytes]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      // A hidden error viewport has no width. Keep the last readable size so
      // hiding it does not itself trigger another render of the failed page.
      if (entry && entry.contentRect.width > 0)
        setWidth(Math.max(1, Math.floor(entry.contentRect.width)));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    const controller = new AbortController();
    let current = true;
    setRendered(false);
    setOpenFailed(false);
    const timeout = setTimeout(() => {
      if (current) setOpenFailed(true);
      controller.abort();
    }, 30_000);
    void source
      .draw(canvas, page, width, zoom, rotation, controller.signal)
      .then(() => {
        if (!current || controller.signal.aborted) return;
        setRendered(true);
      })
      .catch(() => {
        if (current && !controller.signal.aborted) setOpenFailed(true);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      current = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [source, page, width, zoom, rotation]);

  useEffect(() => {
    setTextOpen(false);
    setPageText(undefined);
  }, [source, page]);

  useEffect(() => {
    if (!source || !textOpen || pageText !== undefined) return;
    const controller = new AbortController();
    let current = true;
    const timeout = setTimeout(() => {
      if (current) setPageText(null);
      controller.abort();
    }, 30_000);
    void source
      .readText(page, controller.signal)
      .then((text) => {
        if (current && !controller.signal.aborted) setPageText(text);
      })
      .catch(() => {
        if (current && !controller.signal.aborted) setPageText(null);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      current = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [source, page, textOpen, pageText]);

  const position = fill(copy.page, { page, count: source?.pages ?? 1 }, locale);
  return (
    <section className="document-preview" aria-label={copy.previewHeading}>
      <div className="document-preview-heading">
        <div>
          <p className="eyebrow">{copy.previewHeading}</p>
          <h2>{label}</h2>
        </div>
        <Button
          ref={closeRef}
          variant="ghost"
          size="icon"
          aria-label={copy.close}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div
        className="document-controls"
        role="group"
        aria-label={copy.previewHeading}
      >
        {source && source.pages > 1 && (
          <div className="document-control-group">
            <Button
              variant="outline"
              size="icon"
              aria-label={copy.previous}
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="document-page-position">{position}</span>
            <Button
              variant="outline"
              size="icon"
              aria-label={copy.next}
              disabled={page === source.pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
        <div className="document-control-group">
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.zoomOut}
            disabled={!source || error || zoom <= 0.5}
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          >
            <ZoomOut />
          </Button>
          <Button
            variant="outline"
            disabled={!source || error}
            onClick={() => setZoom(1)}
          >
            {copy.fit}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.zoomIn}
            disabled={!source || error || zoom >= 3}
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          >
            <ZoomIn />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.rotate}
            disabled={!source || error}
            onClick={() => setRotation((rotation + 90) % 360)}
          >
            <RotateCw />
          </Button>
        </div>
        <Button variant="outline" render={<a href={href} download />}>
          <Download aria-hidden="true" />
          {fill(copy.download, { document: inSentence(label, locale) }, locale)}
        </Button>
      </div>
      <p className="sr-only" role="status">
        {error
          ? ""
          : !source
            ? copy.loading
            : !rendered
              ? copy.rendering
              : previewStatusLine(copy, position, zoom, locale)}
      </p>
      {error && (
        <div className="document-preview-error" role="alert">
          <p>{copy.unavailable}</p>
          {!pdfWithoutViewer && (
            <Button variant="outline" onClick={read.retry}>
              {copy.retry}
            </Button>
          )}
        </div>
      )}
      <div
        ref={viewportRef}
        className="document-viewport"
        tabIndex={0}
        role="region"
        aria-label={fill(copy.image, { document: label, page }, locale)}
      >
        {!error && (!source || !rendered) && (
          <p className="document-loading">
            {!source ? copy.loading : copy.rendering}
          </p>
        )}
        <canvas
          key={`${page}-${rotation}-${zoom}-${width}-${read.attempt}`}
          ref={canvasRef}
          aria-hidden="true"
          hidden={error || !rendered}
        />
      </div>
      {!error && rendered && (
        <details
          className="document-text"
          open={textOpen}
          aria-busy={textOpen && pageText === undefined}
          onToggle={(event) => setTextOpen(event.currentTarget.open)}
        >
          <summary>{copy.text}</summary>
          {pageText === undefined ? (
            textOpen && (
              <p className="muted" role="status">
                {copy.loading}
              </p>
            )
          ) : pageText ? (
            <>
              <p className="muted">{copy.textHint}</p>
              <p
                className="document-extracted-text"
                tabIndex={0}
                role="region"
                aria-label={copy.text}
              >
                {pageText}
              </p>
            </>
          ) : (
            <p role="status">
              {pageText === null ? copy.textUnavailable : copy.noText}
            </p>
          )}
        </details>
      )}
    </section>
  );
}

/** The status line once a page has drawn: the page line and the zoom, as a whole percentage. */
export function previewStatusLine(
  copy: Pick<DocumentsContent, "previewStatus">,
  position: string,
  zoom: number,
  locale: string,
): string {
  return fill(
    copy.previewStatus,
    {
      position,
      zoom: new Intl.NumberFormat(locale, { style: "percent" }).format(zoom),
    },
    locale,
  );
}
