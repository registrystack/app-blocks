/**
 * Hooks for the language a person reads the app in. The host words every answer
 * in the UI model's language nearest the one asked; a person who chooses one is
 * asked in it from then on, and the browser keeps the choice between sessions.
 */
import { createContext, useContext } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { HostClient } from "./index.js";
import { languageMemory } from "./language.js";
import { readBrowserMemory, writeBrowserMemory } from "./remembered.js";

const languageKey = "appkit.language";

/** The language the browser kept as the person's choice, or none. */
export function rememberedLanguage(): string | undefined {
  return readBrowserMemory(languageKey, undefined, languageMemory);
}

/**
 * Asks every later call in the chosen language, keeps the choice, and reads again
 * every answer but the session, which is worded in the earlier one. No choice goes
 * back to the browser's own language.
 */
export function chooseLanguage(
  host: HostClient,
  client: QueryClient,
  language: string | undefined,
) {
  host.setLanguage(language);
  writeBrowserMemory(languageKey, language, languageMemory);
  void client.invalidateQueries({
    predicate: (q) => q.queryKey[0] !== "session",
  });
}

export interface LanguageChoice {
  /** The language the person chose, or none when the browser's own is asked. */
  chosen: string | undefined;
  choose(language: string | undefined): void;
}

export const LanguageContext = createContext<LanguageChoice | null>(null);

/**
 * The person's choice of language. The languages to choose among, and the one the
 * host settled on, are the session model's `languages` and `language`.
 */
export function useLanguage(): LanguageChoice {
  const choice = useContext(LanguageContext);
  if (!choice) throw new Error("AppProvider is required.");
  return choice;
}
