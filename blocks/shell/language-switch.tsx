import { Languages } from "lucide-react";
import { languageName } from "@registrystack/app-runtime";
import { useLanguage, useModel } from "@registrystack/app-runtime/react";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useShellContent } from "@/blocks/shell/shell-content";

const noLanguages: readonly string[] = [];

/** The languages a UI model offers and the one the session's model is worded in. */
export interface OfferedLanguages {
  language: string;
  languages: readonly string[];
}

/**
 * The languages the UI model offers and the one the session's model is worded
 * in; none until the model is read, or when the UI model offers one language.
 */
export function useOfferedLanguages(): OfferedLanguages | undefined {
  const model = useModel().data;
  const languages = model?.languages ?? noLanguages;
  return model?.language && languages.length > 1
    ? { language: model.language, languages }
    : undefined;
}

/**
 * Chooses the language the app is read in, among those the UI model offers,
 * each named in itself so a person finds their own whatever the page is in.
 */
export function LanguageSwitch() {
  const c = useShellContent();
  const offered = useOfferedLanguages();
  const { choose } = useLanguage();
  if (!offered) return null;
  return (
    <label className="language-switch">
      <Languages size={16} aria-hidden="true" />
      <span className="sr-only">{c.language}</span>
      <select
        value={offered.language}
        onChange={(event) => choose(event.target.value)}
      >
        {offered.languages.map((language) => (
          <option key={language} value={language} lang={language}>
            {languageName(language)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The same choice as a group of an account menu, followed by a separator. The
 * caller reads the languages with `useOfferedLanguages` where the menu itself
 * is mounted: a menu's content mounts on opening, and a read there would read
 * a model the host refused again.
 */
export function LanguageMenuGroup(offered: OfferedLanguages) {
  const c = useShellContent();
  const { choose } = useLanguage();
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{c.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={offered.language}
          onValueChange={(language: string) => choose(language)}
        >
          {offered.languages.map((language) => (
            <DropdownMenuRadioItem
              key={language}
              value={language}
              lang={language}
            >
              {languageName(language)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}
