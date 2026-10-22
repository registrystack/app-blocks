import { useContext, useEffect, useMemo, type ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  applyLanguage,
  formatLocale,
  textDirection,
} from "@registrystack/app-runtime";
import { useModel } from "@registrystack/app-runtime/react";
import {
  CaseworkContentProvider,
  type CaseworkContent,
} from "@/blocks/casework/casework-content";
import type { DashboardContent } from "@/blocks/dashboard/dashboard-content";
import type { DocumentsContent } from "@/blocks/documents/documents-content";
import {
  ContentContext,
  LocaleContext,
  MessagesContext,
  type BlockContent,
} from "@/blocks/lib/content";
import type { ReviewPageContent } from "@/blocks/pages/casework-review-content";
import type { PagesContent } from "@/blocks/pages/pages-content";
import type { ShellContent } from "@/blocks/shell/shell-content";

/** The wording of every area of the blocks, each a full set of words. */
export interface AppContent {
  block: BlockContent;
  shell: ShellContent;
  pages: PagesContent;
  documents: DocumentsContent;
  casework: CaseworkContent;
  review: ReviewPageContent;
  dashboard: DashboardContent;
}

const noContent: Partial<AppContent> = {};
const noAreas: Readonly<Record<string, unknown>> = {};

/**
 * The one provider of an app's wording. An area left out keeps its defaults,
 * or whatever an outer provider set for it; an area set here is a full set of
 * words, usually the area's default spread with a few words changed. `areas`
 * holds the app's own areas, for the pages it ejected or built, which read
 * them with `useContentArea`; a kit area set in `content` wins over one of the
 * same name there.
 */
export function ContentProvider({
  content = noContent,
  areas = noAreas,
  children,
}: {
  content?: Partial<AppContent>;
  areas?: Readonly<Record<string, unknown>>;
  children: ReactNode;
}) {
  const outer = useContext(ContentContext);
  const value = useMemo(
    () => ({ ...outer, ...areas, ...content }),
    [outer, areas, content],
  );
  const tree = (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
  return content.casework ? (
    <CaseworkContentProvider content={content.casework}>
      {tree}
    </CaseworkContentProvider>
  ) : (
    tree
  );
}

const noMessages: Readonly<Record<string, string>> = {};

/**
 * Sets the session's UI model texts for the kit's wording over the app's own,
 * the locale blocks format in, and the page's language and direction to those
 * the texts are in, for Base UI's parts as for the page. It reads the model, so
 * it sits inside the authenticated session; until the model arrives the app's
 * wording, the kit's English formats and the page's own language show, left to
 * right. The providers are always rendered, so the arrival of the texts does not
 * remount the app below them.
 */
export function ModelMessages({ children }: { children: ReactNode }) {
  const model = useModel().data;
  const messages = model?.messages ?? noMessages;
  const language = model?.language;
  useEffect(
    () => applyLanguage(document.documentElement, language),
    [language],
  );
  return (
    <MessagesContext.Provider value={messages}>
      <LocaleContext.Provider value={formatLocale(language)}>
        <DirectionProvider
          direction={language ? textDirection(language) : "ltr"}
        >
          {children}
        </DirectionProvider>
      </LocaleContext.Provider>
    </MessagesContext.Provider>
  );
}
