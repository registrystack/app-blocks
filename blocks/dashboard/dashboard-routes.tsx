import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { useDashboard } from "@registrystack/app-runtime/react";
import {
  dashboardRecordsPath,
  dashboardRoute,
} from "@/blocks/dashboard/dashboard-target";
import {
  exactPath,
  route,
  type AppRoute,
  type NavEntry,
} from "@/blocks/pages/app-routes";
import {
  DashboardPage,
  DashboardRecordsPage,
} from "@/blocks/pages/lazy-pages";
import type { ShellNavItem } from "@/blocks/shell/navigation";

/**
 * The dashboard's pages, for an app to list beside its own routes. The pages
 * exist only where the host serves a dashboard; `dashboardNavEntry` offers
 * the place in the navigation under the same condition.
 */
export const dashboardRoutes: AppRoute[] = [
  route("dashboard", exactPath(dashboardRoute), () => <DashboardPage />),
  route("dashboard-records", exactPath(dashboardRecordsPath), () => (
    <DashboardRecordsPage />
  )),
];

/** What the navigation entry reads: the dashboard the host serves, or none. */
export interface DashboardNavContext {
  dashboard: { title: string } | null;
}

/**
 * The dashboard the host serves, for the navigation context; null while it
 * is read, where it failed to read, and where the register has none.
 */
export function useDashboardNav(): DashboardNavContext["dashboard"] {
  const title = useDashboard().data?.dashboard?.title;
  return useMemo(() => (title === undefined ? null : { title }), [title]);
}

/** The dashboard's place in a navigation, named by the dashboard's own title. */
export const dashboardNavEntry: NavEntry<DashboardNavContext, ShellNavItem> = {
  id: "dashboard",
  items: ({ dashboard }) =>
    dashboard
      ? [{ path: dashboardRoute, label: dashboard.title, icon: BarChart3 }]
      : [],
};
