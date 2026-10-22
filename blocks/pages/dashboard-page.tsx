import { unavailableError } from "@registrystack/app-runtime";
import { useDashboard } from "@registrystack/app-runtime/react";
import { dashboardRoute } from "@/blocks/dashboard/dashboard-target";
import { DashboardWidget } from "@/blocks/dashboard/dashboard-widget";
import { useDashboardContent } from "@/blocks/dashboard/dashboard-content";
import { LandingStarts } from "@/blocks/pages/landing-starts";
import { useRegister } from "@/blocks/pages/record";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { useShellContent } from "@/blocks/shell/shell-content";

/**
 * The register's dashboard: a heading, what the role's landing offers to
 * start, and one card per widget the host describes. A register with no
 * dashboard has no such page, so a path to it is the unavailable refusal, not
 * an empty page.
 */
export function DashboardPage() {
  const c = useDashboardContent(),
    shell = useShellContent(),
    query = useDashboard(),
    register = useRegister(),
    starts = register.data?.home?.starts;
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const dashboard = query.data?.dashboard;
  if (!dashboard)
    return <ErrorPanel error={unavailableError(shell.unavailable)} />;
  return (
    <>
      <PageHeading title={dashboard.title} description={c.intro} />
      {register.entities && starts?.length ? (
        <LandingStarts
          entities={register.entities}
          ids={starts}
          from={dashboardRoute}
        />
      ) : null}
      <div className="dashboard-grid">
        {dashboard.widgets.map((widget) => (
          <DashboardWidget key={widget.id} widget={widget} />
        ))}
      </div>
    </>
  );
}
