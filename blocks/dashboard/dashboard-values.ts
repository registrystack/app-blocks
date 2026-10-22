import type {
  DashboardCell,
  DashboardWidgetContext,
} from "@registrystack/app-runtime";
import { fill } from "@/blocks/lib/format";
import type { DashboardContent } from "@/blocks/dashboard/dashboard-content";

/**
 * A count in the words of its disclosure, exactly as BReg disclosed it, its
 * numbers written in `locale`: a rounded count is approximate, a withheld one
 * names the minimum BReg reports. Nothing here rounds or recomputes.
 */
export function disclosedValue(
  c: DashboardContent,
  locale: string,
  cell: Pick<DashboardCell, "value" | "status">,
  minimumCount?: number,
): string {
  const number = new Intl.NumberFormat(locale);
  if (cell.value === null)
    return minimumCount === undefined
      ? c.withheldWithoutMinimum
      : fill(c.belowMinimum, { count: number.format(minimumCount) }, locale);
  const value = number.format(cell.value);
  return cell.status === "rounded" ? fill(c.approximately, { value }, locale) : value;
}

/** The status column's word for a disclosure state. */
export function statusLabel(
  c: DashboardContent,
  status: DashboardCell["status"],
): string {
  return status === "exact"
    ? c.exact
    : status === "rounded"
      ? c.rounded
      : c.withheld;
}

/** The minimum count BReg states for a released widget, when it states one. */
export function minimumCountOf(
  context: DashboardWidgetContext | undefined,
): number | undefined {
  return context?.disclosure?.minimumCount;
}
