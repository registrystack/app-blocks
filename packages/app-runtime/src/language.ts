/**
 * The language a page is read in: the direction its script is written in, its
 * name as a person who reads it would look for it, and how a person's choice
 * of it is kept. The host checks only the shape of a UI model's language tags,
 * so a tag of the right shape may still name nothing Intl can read; such a tag
 * keeps the page left to right and is named by the tag itself.
 */
import type { BrowserMemory } from "./remembered.js";

/** The scripts written right to left, by ISO 15924 code. */
const rightToLeftScripts = new Set([
  "Adlm",
  "Arab",
  "Hebr",
  "Mand",
  "Mend",
  "Nkoo",
  "Rohg",
  "Samr",
  "Syrc",
  "Thaa",
  "Yezi",
]);

function readable<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/** The direction a language is written in, from the script it is most likely written in. */
export function textDirection(language: string): "ltr" | "rtl" {
  const script = readable(() => new Intl.Locale(language).maximize().script);
  return script && rightToLeftScripts.has(script) ? "rtl" : "ltr";
}

/**
 * A language's name in itself, capitalized as a menu item starts, so a person
 * finds their own language among the others whatever the page is shown in.
 */
export function languageName(language: string): string {
  const name = readable(() =>
    new Intl.DisplayNames([language], { type: "language" }).of(language),
  );
  return name
    ? name.charAt(0).toLocaleUpperCase(language) + name.slice(1)
    : language;
}

/** The kit's English is British English, and its dates, numbers and lists read so. */
const kitEnglish = "en-GB";

/**
 * The locale dates, numbers and lists are formatted in for the language a page
 * is worded in: the kit's English for `en` or no language, the language itself
 * otherwise. A tag Intl cannot read formats in the kit's English.
 */
export function formatLocale(language: string | undefined): string {
  if (!language || language === "en") return kitEnglish;
  return readable(() => Intl.getCanonicalLocales(language)[0]) ?? kitEnglish;
}

/**
 * Sets a root element's language and direction; the result puts the earlier
 * ones back. Nothing is set before the language is known.
 */
export function applyLanguage(
  root: { lang: string; dir: string },
  language: string | undefined,
): () => void {
  if (!language) return () => undefined;
  const earlier = { lang: root.lang, dir: root.dir };
  root.lang = language;
  root.dir = textDirection(language);
  return () => {
    root.lang = earlier.lang;
    root.dir = earlier.dir;
  };
}

/** How the browser keeps the language a person chose: its canonical tag, or none. */
export const languageMemory: BrowserMemory<string | undefined> = {
  decode: (raw) =>
    raw ? readable(() => Intl.getCanonicalLocales(raw)[0]) : undefined,
  encode: (language) => language ?? "",
};
