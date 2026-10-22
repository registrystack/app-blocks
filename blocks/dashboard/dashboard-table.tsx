import type {
  DashboardCell,
  DashboardWidgetResult,
  DashboardWidgetView,
} from "@registrystack/app-runtime";
import { ScrollRegion } from "@/blocks/lib/scroll-region";
import { fill } from "@/blocks/lib/format";
import { DashboardCellLink } from "@/blocks/dashboard/dashboard-cell-link";
import { useDashboardContent } from "@/blocks/dashboard/dashboard-content";
import { useLocale } from "@/blocks/lib/content";
import {
  disclosedValue,
  minimumCountOf,
  statusLabel,
} from "@/blocks/dashboard/dashboard-values";

/**
 * The counts of a ready result as an accessible table: one row per category
 * and a total row, each with the count as BReg disclosed it and the word for
 * that disclosure. A chart carries this table as its text equivalent.
 */
export function DashboardTable({
  widget,
  result,
}: {
  widget: DashboardWidgetView;
  result: DashboardWidgetResult;
}) {
  const c = useDashboardContent(),
    locale = useLocale();
  const minimum = minimumCountOf(result.context);
  const rows: { cell: DashboardCell; label: string; total?: true }[] = [
    ...(result.rows ?? []).map((cell) => ({
      cell,
      label: cell.label ?? cell.code ?? "",
    })),
    ...(result.total
      ? [{ cell: result.total, label: c.total, total: true as const }]
      : []),
  ];
  const caption = fill(
    widget.unit ? c.tableCaption : c.tableCaptionWithoutUnit,
    { widget: widget.title, unit: widget.unit ?? "", period: result.period },
    locale,
  );
  return (
    <>
      <ScrollRegion className="dashboard-table-scroll" label={caption}>
        <table className="dashboard-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{c.category}</th>
              <th scope="col">{c.count}</th>
              <th scope="col">{c.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cell, label, total }) => (
              <tr
                key={cell.code}
                className={total ? "dashboard-total" : undefined}
              >
                <th scope="row">{label}</th>
                <td>
                  <DashboardCellLink
                    cell={cell}
                    label={label}
                    value={disclosedValue(c, locale, cell, minimum)}
                    period={result.period}
                  />
                </td>
                <td>{statusLabel(c, cell.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      {result.subset && <p className="dashboard-note">{c.subsetNote}</p>}
    </>
  );
}
