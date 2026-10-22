import { lazyPdfOpener } from "@/blocks/documents/document-view";

/** The PDF renderer, loaded when a PDF is first previewed. */
export const openPdf = lazyPdfOpener(() => import("./document-pdf"));
