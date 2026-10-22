import { ArrowUpRight } from "lucide-react";
import type { DashboardCell } from "@registrystack/app-runtime";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { useDashboardContent } from "@/blocks/dashboard/dashboard-content";
import { dashboardRecordsRoute } from "@/blocks/dashboard/dashboard-target";

/**
 * A count that opens the records behind it. Only a cell the host named a
 * target for is a link; any other count is plain text.
 */
export function DashboardCellLink({
  cell,
  label,
  value,
  period,
}: {
  cell: DashboardCell;
  /** What the count is of, read with the link. */
  label: string;
  /** The count as shown. */
  value: string;
  period: string;
}) {
  const c = useDashboardContent(),
    locale = useLocale();
  if (!cell.drillthrough) return <>{value}</>;
  return (
    <a
      className="dashboard-cell-link"
      href={`#${dashboardRecordsRoute(cell.drillthrough)}`}
      aria-label={fill(c.openRecords, { label, value, period }, locale)}
    >
      {value}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
