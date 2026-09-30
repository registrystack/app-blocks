import type { ReactNode } from "react";
import {
  AuthorityBoundary,
  useSession,
} from "@registrystack/app-runtime/react";
import type { AuthenticatedSession } from "@registrystack/app-runtime";
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
  if (session.error)
    return (
      <ErrorPanel error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data?.authenticated) return <>{introduction}</>;
  if (
    (audience === "staff" && session.data.role === "holder") ||
    (audience === "service" && session.data.role !== "holder")
  )
    return <WrongAudience session={session.data} />;
  return (
    <AuthorityBoundary key={session.data.scope} session={session.data}>
      {children}
    </AuthorityBoundary>
  );
}

/**
 * What a session sees when it authenticated for the other audience: a link
 * to its own service instead of the page it asked for.
 */
export function WrongAudience({ session }: { session: AuthenticatedSession }) {
  const c = useShellContent();
  return (
    <main className="public-content">
      <PageHeading title={c.unavailable} description={c.unavailableBody} />
      <a
        className="text-link"
        href={session.role === "holder" ? "/service/" : "/staff/"}
      >
        {session.role === "holder" ? c.serviceName : c.staffName}
      </a>
      <SignOut />
    </main>
  );
}
