import type { ReactNode } from "react";
import {
  AuthorityBoundary,
  useSession,
} from "@registrystack/app-runtime/react";
import type { AuthenticatedSession } from "@registrystack/app-runtime";
import { ModelMessages } from "@/blocks/lib/content-provider";
import { useBranding } from "@/blocks/shell/branding";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { SignOut } from "@/blocks/shell/sign-out";
import { useShellContent } from "@/blocks/shell/shell-content";

export function SessionBoundary({
  audience,
  children,
  introduction,
}: {
  audience: "staff" | "service";
  children: ReactNode;
  introduction: ReactNode;
}) {
  const session = useSession();
  if (session.isPending) return <Loading />;
  // A failed background poll keeps the last session and the page it holds; only
  // a first read that failed has nothing to show. A session the host ended
  // arrives as signed-out data, not as an error.
  if (session.error && !session.data)
    return (
      <ErrorPanel error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data?.authenticated) return <>{introduction}</>;
  if (
    (audience === "staff" && session.data.holder) ||
    (audience === "service" && !session.data.holder)
  )
    return <WrongAudience session={session.data} />;
  return (
    <AuthorityBoundary key={session.data.scope} session={session.data}>
      <ModelMessages>{children}</ModelMessages>
    </AuthorityBoundary>
  );
}

/**
 * What a session sees when it authenticated for the other audience: a link
 * to its own service instead of the page it asked for. The page carries the
 * accent of the UI model its session reads, so it looks like the service it
 * points to.
 */
export function WrongAudience({ session }: { session: AuthenticatedSession }) {
  return (
    <AuthorityBoundary key={session.scope} session={session}>
      <WrongAudiencePage session={session} />
    </AuthorityBoundary>
  );
}

function WrongAudiencePage({ session }: { session: AuthenticatedSession }) {
  const c = useShellContent();
  useBranding();
  return (
    <main className="public-content">
      <PageHeading title={c.unavailable} description={c.unavailableBody} />
      <a
        className="text-link"
        href={session.holder ? "/service/" : "/staff/"}
      >
        {session.holder ? c.serviceName : c.staffName}
      </a>
      <SignOut />
    </main>
  );
}
