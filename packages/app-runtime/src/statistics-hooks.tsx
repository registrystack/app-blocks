/**
 * Reads of the dashboard. The host reads BReg's statistics under the session's own
 * access profile; these hooks only fetch what the host serves, and nothing here
 * recomputes, rounds or retries a figure.
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuthority, useHost } from "./react.js";
import type { DashboardCellTarget } from "./statistics-types.js";

/** The session's dashboard; `data.dashboard` is null where the register has none. */
export function useDashboard(lang?: string) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "dashboard", lang],
    queryFn: () => host.dashboard(lang),
  });
}

/**
 * One widget's figures for a period. A refetch is the reader's own refresh; a
 * failed read stays failed until the reader asks again.
 */
export function useDashboardWidget(
  id: string,
  period?: string,
  lang?: string,
) {
  const host = useHost(),
    session = useAuthority();
  return useQuery({
    queryKey: [session.scope, "dashboard-widget", id, period, lang],
    queryFn: () => host.dashboardWidget(id, period, lang),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * The records behind one dashboard cell, a page at a time. Pages advance only when
 * the caller asks `fetchNextPage`; a continuation carries only the host's opaque,
 * cell-bound cursor.
 */
export function useDashboardCohort(target: DashboardCellTarget, lang?: string) {
  const host = useHost(),
    session = useAuthority();
  const cohort = useInfiniteQuery({
    queryKey: [session.scope, "dashboard-cohort", target, lang],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => host.dashboardCohort(target, pageParam, lang),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return {
    ...cohort,
    items: cohort.data?.pages.flatMap((page) => page.items),
    cohort: cohort.data?.pages[0]?.cohort,
  };
}
