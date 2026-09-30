/** Hooks for the session itself: ending it, and what the page forgets when it ends. */
import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { forgetPendingAuthority } from "./command-hooks.js";
import { useHost } from "./react.js";

/**
 * What the page forgets once the host has ended the session: attempt references only
 * that session could recover, and every cached answer but the session itself, which is
 * set to signed out so the introduction renders without a round trip.
 */
export function signedOut(client: QueryClient) {
  forgetPendingAuthority();
  client.removeQueries({
    predicate: (q) => q.queryKey[0] !== "session",
  });
  client.setQueryData(["session"], {
    authenticated: false,
    loginUrl: "/auth/login",
  });
}

/**
 * Ends the session: the host forgets it, every cached answer but the session
 * itself is dropped, and the session query is set to signed out so the
 * introduction renders without a round trip.
 */
export function useSignOut(): () => Promise<void> {
  const host = useHost(),
    client = useQueryClient();
  return useCallback(
    () =>
      host.logout().then(() => {
        signedOut(client);
      }),
    [host, client],
  );
}
