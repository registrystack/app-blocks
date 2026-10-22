import type {
  DashboardWidgetResult,
  DashboardWidgetView,
} from "@registrystack/app-runtime";
import { DashboardTable } from "@/blocks/dashboard/dashboard-table";
import {
  disclosedValue,
  minimumCountOf,
} from "@/blocks/dashboard/dashboard-values";
import { useDashboardContent } from "@/blocks/dashboard/dashboard-content";
import { useLocale } from "@/blocks/lib/content";

/**
 * Bars of the counts of a ready result, scaled to the largest count shown,
 * above the table that holds the same counts in words. The bars are
 * decoration for sighted readers and are hidden from assistive technology;
 * a withheld count has no bar. The bar lengths use the values BReg
 * disclosed, so a rounded count draws its rounded length.
 */
export function DashboardChart({
  widget,
  result,
}: {
  widget: DashboardWidgetView;
  result: DashboardWidgetResult;
}) {
  const c = useDashboardContent(),
    locale = useLocale();
  const rows = result.rows ?? [];
  const largest = Math.max(1, ...rows.map((row) => row.value ?? 0));
  const minimum = minimumCountOf(result.context);
  return (
    <>
      <div className="dashboard-bars" aria-hidden="true">
        {rows.map((row) => (
          <div className="dashboard-bar-row" key={row.code}>
            <span>{row.label ?? row.code}</span>
            <span className="dashboard-bar-track">
              {row.value !== null && (
                <span
                  className="dashboard-bar"
                  style={{ width: `${(row.value / largest) * 100}%` }}
                />
              )}
            </span>
            <strong>{disclosedValue(c, locale, row, minimum)}</strong>
          </div>
        ))}
      </div>
      <DashboardTable widget={widget} result={result} />
    </>
  );
}
