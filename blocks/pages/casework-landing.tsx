import { useEffect, type ReactNode } from "react";
import type {
  AuthenticatedSession,
  DashboardResponse,
} from "@registrystack/app-runtime";
import { useAuthority } from "@registrystack/app-runtime/react";
import { dashboardRoute } from "@/blocks/dashboard/dashboard-target";
import { Loading } from "@/blocks/shell/loading";

/**
 * What a session's work is. It is read from what the session can do, its
 * Casework profile, and never from the name of its role: a role name grants
 * nothing, and Casework decides what a profile may read.
 *
 * A registrar is any session without a Casework profile: it works the
 * register through BReg alone.
 */
export type WorkKind = "reviewer" | "supervisor" | "administrator" | "registrar";

export function workKind(session: AuthenticatedSession): WorkKind {
  switch (session.caseworkProfile) {
    case "staff":
      return "reviewer";
    case "supervisor":
      return "supervisor";
    case "administrator":
      return "administrator";
    default:
      return "registrar";
  }
}

/** What the session's dashboard read has told the browser so far. */
export interface DashboardRead {
  isPending: boolean;
  data?: DashboardResponse;
}

/**
 * The dashboard seam. A registrar lands on the dashboard where the host
 * serves one to the session. Undefined while the read is pending, so the
 * landing is decided once; null where the host serves none, where the read
 * failed (the registrar lands on the register's home, never on the
 * dashboard's error) and for every kind of work but a registrar's.
 */
export function dashboardLanding(
  session: AuthenticatedSession,
  dashboard: DashboardRead,
): string | null | undefined {
  if (workKind(session) !== "registrar") return null;
  if (dashboard.isPending) return undefined;
  return dashboard.data?.dashboard ? dashboardRoute : null;
}

/**
 * Where a session opens: the page of its own work. A registrar opens on the
 * root, which sends them to the dashboard where there is one
 * (`dashboardLanding`) and to the register's home otherwise.
 */
export function landingPath(session: AuthenticatedSession): string {
  switch (workKind(session)) {
    case "reviewer":
      return "/casework";
    case "supervisor":
      return "/casework/team-reviews";
    case "administrator":
      return "/casework/setup";
    case "registrar":
      return "/";
  }
}

/** The Casework profiles whose work a page serves. */
type Profile = NonNullable<AuthenticatedSession["caseworkProfile"]>;

/**
 * Draws its page for a session whose Casework profile is one of `profiles`.
 * Any other session, arriving by a shared link, is sent to the page of its
 * own work instead: it never meets an error page for a link it was handed.
 */
export function WhenProfile({
  profiles,
  children,
}: {
  profiles: readonly Profile[];
  children: ReactNode;
}) {
  const session = useAuthority();
  const allowed =
    session.caseworkProfile !== undefined &&
    profiles.includes(session.caseworkProfile);
  const landing = landingPath(session);
  useEffect(() => {
    if (!allowed) location.replace(`#${landing}`);
  }, [allowed, landing]);
  return allowed ? <>{children}</> : <Loading />;
}
