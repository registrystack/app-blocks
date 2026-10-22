import type { DashboardCellTarget } from "@registrystack/app-runtime";

/** The route of the dashboard and of the records behind one of its counts. */
export const dashboardRoute = "/dashboard";
export const dashboardRecordsPath = "/dashboard/records";

const maximumTargetValueLength = 256;
const maximumCodeLength = 1024;

/**
 * The route that opens the records behind a cell. It carries only what the
 * host named for the cell; the host rebuilds the filter from it.
 */
export function dashboardRecordsRoute(target: DashboardCellTarget): string {
  const query = new URLSearchParams({
    widgetId: target.widgetId,
    period: target.period,
    binding: target.binding,
  });
  if (target.code !== undefined) query.set("code", target.code);
  return `${dashboardRecordsPath}?${query}`;
}

/**
 * The cell a records route names, or null where the query is not exactly the
 * one `dashboardRecordsRoute` writes: an unknown, repeated, missing or
 * oversized member is refused.
 */
export function dashboardTargetOf(
  query: URLSearchParams,
): DashboardCellTarget | null {
  const keys = [...query.keys()];
  if (
    keys.length !== new Set(keys).size ||
    keys.some((key) => !["widgetId", "period", "binding", "code"].includes(key))
  )
    return null;
  const widgetId = query.get("widgetId"),
    period = query.get("period"),
    binding = query.get("binding"),
    code = query.get("code");
  if (
    !widgetId ||
    !period ||
    !binding ||
    [widgetId, period, binding].some(
      (value) => value.length > maximumTargetValueLength,
    ) ||
    (code !== null && (code.length === 0 || code.length > maximumCodeLength))
  )
    return null;
  return {
    kind: "dashboard-cell",
    widgetId,
    period,
    binding,
    ...(code === null ? {} : { code }),
  };
}
