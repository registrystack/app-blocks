import { useState } from "react";
import { LogOut, UserRoundCog } from "lucide-react";
import { useEndSession, useSignOut } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { useShellContent } from "@/blocks/shell/shell-content";

/** Ends the session; the runtime's own hook, kept here for pages that import it. */
export { useSignOut };

export function SignOut() {
  const c = useShellContent();
  const signOut = useSignOut();
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <Button variant="ghost" onClick={() => void signOut().catch(setError)}>
        <LogOut size={16} />
        {c.signOut}
      </Button>
      {error && <ErrorPanel error={error} />}
    </>
  );
}

/** The host route that signs a person in again and asks the issuer to authenticate them afresh. */
export function switchAccountUrl(app: string): string {
  return `/auth/login?app=${encodeURIComponent(app)}&switch=1`;
}

/**
 * Ends the session through the host's sign-out route, then starts a fresh
 * sign-in through its sign-in route. Nothing of the first session travels
 * with the second; a refused sign-out stops before the sign-in starts.
 * `signOut` ends only the app session (`useEndSession`): the fresh sign-in
 * asks the issuer to authenticate the person again, and visiting the issuer's
 * logout first would return to the app origin instead of that sign-in.
 */
export async function switchAccount(
  signOut: () => Promise<void>,
  navigate: (url: string) => void,
  app: string,
): Promise<void> {
  await signOut();
  navigate(switchAccountUrl(app));
}

export function SwitchAccount({ app }: { app: string }) {
  const c = useShellContent();
  const endSession = useEndSession();
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <Button
        variant="ghost"
        onClick={() =>
          void switchAccount(
            endSession,
            (url) => window.location.assign(url),
            app,
          ).catch(setError)
        }
      >
        <UserRoundCog size={16} />
        {c.switchAccount}
      </Button>
      {error && <ErrorPanel error={error} />}
    </>
  );
}
