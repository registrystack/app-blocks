import { createContext, useContext, type ReactNode } from "react";

/**
 * The words the documents blocks show on their own: generic defaults an app
 * replaces with its own content through `DocumentsContentProvider`. Wording
 * shared by every role when reading evidence.
 */
export interface DocumentsContent {
  view: string;
  close: string;
  previewHeading: string;
  loading: string;
  rendering: string;
  unavailable: string;
  retry: string;
  page: string;
  previous: string;
  next: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  rotate: string;
  image: string;
  text: string;
  noText: string;
  textUnavailable: string;
  textHint: string;
  selected: string;
  selectedReplacement: string;
  download: string;
}

export const documentsContent: DocumentsContent = {
  view: "View {document}",
  close: "Close document",
  previewHeading: "Document preview",
  loading: "Opening document…",
  rendering: "Rendering page…",
  unavailable:
    "This preview could not be opened. Download the document to read it, or refresh the request if the document has changed.",
  retry: "Try preview again",
  page: "Page {page} of {count}",
  previous: "Previous document page",
  next: "Next document page",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit width",
  rotate: "Rotate clockwise",
  image: "{document}, page {page}",
  text: "Read page text",
  noText:
    "There is no selectable text on this page. It may be a scan or photograph.",
  textUnavailable:
    "Page text could not be read. The original document is available to download.",
  textHint:
    "Text from this page, in document order. Check the image for its layout.",
  selected:
    "Selected: {name} ({type}, {size}). Choose Add document to save it.",
  selectedReplacement:
    "Selected: {name} ({type}, {size}). Choose Replace document to save it.",
  download: "Download {document}",
};

const DocumentsContentContext =
  createContext<DocumentsContent>(documentsContent);

export function DocumentsContentProvider({
  content,
  children,
}: {
  content: DocumentsContent;
  children: ReactNode;
}) {
  return (
    <DocumentsContentContext.Provider value={content}>
      {children}
    </DocumentsContentContext.Provider>
  );
}

export function useDocumentsContent(): DocumentsContent {
  return useContext(DocumentsContentContext);
}
