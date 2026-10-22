/** Hooks for the session itself: ending it, and what the page forgets when it ends. */
import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { clearRetainedUploads } from "./attachment-upload.js";
import { forgetPendingAuthority } from "./command-hooks.js";
import { HostError } from "./errors.js";
import type { HostClient } from "./index.js";
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
 * Ends the session on the person's request: the host forgets it, the page forgets what
 * it held (`signedOut`), and the file bytes kept for upload recovery are deleted, since
 * a person who signs out may leave the computer to someone else. A host that answers
 * 401 `session.expired` has already ended the session, so the person is signed out all
 * the same. Any other refusal, a 401 the host did not send among them, leaves the person
 * signed in with their bytes. A failure to delete the bytes is thrown after the session
 * has ended. Bytes are recovered only within the session that kept them: the next
 * signed-in page deletes what an earlier session left. Resolves to the issuer's logout
 * URL where the host named one, and to undefined after a 401 `session.expired`.
 */
export async function endSession(
  host: HostClient,
  client: QueryClient,
  clear: () => Promise<void> = clearRetainedUploads,
): Promise<string | undefined> {
  let endSessionUrl: string | undefined;
  try {
    endSessionUrl = (await host.logout()).endSessionUrl;
  } catch (caught) {
    if (
      !(
        caught instanceof HostError &&
        caught.status === 401 &&
        caught.problem.code === "session.expired"
      )
    )
      throw caught;
  }
  signedOut(client);
  await clear();
  return endSessionUrl;
}

/**
 * Signs the person out: ends the session through `endSession`, then `leave`s for the
 * issuer's logout URL where the host named one, so the issuer's own session ends too
 * and the next sign-in asks for credentials again. A refused sign-out or a failure to
 * delete the bytes is thrown before anything leaves the page.
 */
export async function signOut(
  host: HostClient,
  client: QueryClient,
  leave: (url: string) => void,
  clear: () => Promise<void> = clearRetainedUploads,
): Promise<void> {
  const endSessionUrl = await endSession(host, client, clear);
  if (endSessionUrl) leave(endSessionUrl);
}

/**
 * Signs the person out through `signOut`, visiting the issuer's logout where the host
 * names one; otherwise the introduction renders without a round trip.
 */
export function useSignOut(): () => Promise<void> {
  const host = useHost(),
    client = useQueryClient();
  return useCallback(
    () => signOut(host, client, (url) => window.location.assign(url)),
    [host, client],
  );
}

/**
 * Ends the app session through `endSession` and stays on the page, leaving the issuer's
 * session alone: for switching account, whose fresh sign-in asks the issuer for it.
 */
export function useEndSession(): () => Promise<void> {
  const host = useHost(),
    client = useQueryClient();
  return useCallback(async () => {
    await endSession(host, client);
  }, [host, client]);
}
