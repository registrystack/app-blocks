import { useEffect, useState } from "react";

/**
 * Hash-based client-side routing. The URL's hash is the only source of
 * truth for which page is shown; a block reads it through `useRoute` and
 * moves it through `navigate`, and never touches `location` directly.
 */
export function useRoute(): string {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "/");
  useEffect(() => {
    const update = () => setRoute(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

export function navigate(route: string) {
  location.hash = route;
}

/**
 * Split a hash route into its path and decoded query parameters. The URL is
 * the only source of truth for a view: `useRoute` returns the full hash
 * including any `?query`, and only this function decides which part is the
 * page. Params are decoded once by URLSearchParams; the path never carries
 * the query.
 */
export function splitRoute(route: string): {
  path: string;
  query: URLSearchParams;
} {
  const at = route.indexOf("?");
  return {
    path: at === -1 ? route : route.slice(0, at),
    query: new URLSearchParams(at === -1 ? "" : route.slice(at + 1)),
  };
}
