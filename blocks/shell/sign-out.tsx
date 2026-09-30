import { useState } from "react";
import { LogOut } from "lucide-react";
import { useSignOut } from "@registrystack/app-runtime/react";
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
