import { useEffect } from "react";
import { useModel } from "@registrystack/app-runtime/react";

/**
 * The theme variables the accent colour sets. The host has already refused an
 * accent whose text cannot reach WCAG AA, so these are applied as given. The
 * text colour on a filled control stays the theme's own.
 */
export function accentVariables(accent: string): Record<string, string> {
  const channels = [1, 3, 5].map((start) =>
    Number.parseInt(accent.slice(start, start + 2), 16),
  );
  const darker = `#${channels
    .map((channel) =>
      Math.round(channel * 0.75)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
  return {
    "--primary": accent,
    "--primary-dark": darker,
    "--ring": accent,
    "--link": accent,
    "--link-record": darker,
  };
}

type Style = {
  setProperty(name: string, value: string): unknown;
  removeProperty(name: string): unknown;
};

/** Sets the accent's variables on a root element's style; the result puts them back. */
export function applyAccent(style: Style, accent: string | undefined) {
  const variables = accent ? accentVariables(accent) : {};
  for (const [name, value] of Object.entries(variables))
    style.setProperty(name, value);
  return () => {
    for (const name of Object.keys(variables)) style.removeProperty(name);
  };
}

/**
 * The branding the UI model sets, with its accent applied to the page. The
 * accent follows the model, so a page that shows before the model is read
 * keeps the theme's own colours.
 */
export function useBranding(): { accent?: string; description?: string } {
  const branding = useModel().data?.branding;
  const accent = branding?.accent;
  useEffect(
    () => applyAccent(document.documentElement.style, accent),
    [accent],
  );
  return branding ?? {};
}
