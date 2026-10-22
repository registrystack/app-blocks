import type {
  DashboardWidgetResult,
  DashboardWidgetView,
} from "@registrystack/app-runtime";
import { DashboardCellLink } from "@/blocks/dashboard/dashboard-cell-link";
import { useDashboardContent } from "@/blocks/dashboard/dashboard-content";
import { useLocale } from "@/blocks/lib/content";
import {
  disclosedValue,
  minimumCountOf,
  statusLabel,
} from "@/blocks/dashboard/dashboard-values";

/** One count with its unit and the word for how it was disclosed. */
export function DashboardFigure({
  widget,
  result,
}: {
  widget: DashboardWidgetView;
  result: DashboardWidgetResult;
}) {
  const c = useDashboardContent(),
    locale = useLocale();
  const cell = result.rows?.[0];
  if (!cell) return null;
  const value = disclosedValue(
    c,
    locale,
    cell,
    minimumCountOf(result.context),
  );
  return (
    <p className="dashboard-figure">
      <strong>
        <DashboardCellLink
          cell={cell}
          label={widget.title}
          value={value}
          period={result.period}
        />
      </strong>
      {widget.unit && <span> {widget.unit}</span>}
      <span className="dashboard-figure-status">
        {" "}
        {statusLabel(c, cell.status)}
      </span>
    </p>
  );
}
