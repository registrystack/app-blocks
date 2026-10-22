import { useId, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  problemView,
  type DashboardWidgetResult,
  type DashboardWidgetView,
} from "@registrystack/app-runtime";
import { useDashboardWidget } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/blocks/lib/notice";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { DashboardChart } from "@/blocks/dashboard/dashboard-chart";
import {
  useDashboardContent,
  type DashboardContent,
} from "@/blocks/dashboard/dashboard-content";
import { DashboardFigure } from "@/blocks/dashboard/dashboard-figure";
import { DashboardTable } from "@/blocks/dashboard/dashboard-table";
import { minimumCountOf } from "@/blocks/dashboard/dashboard-values";

const retrieved = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/;

/** A timestamp as UTC words; a date alone is a date. */
function utc(value: string, c: DashboardContent, locale: string): string {
  const parts = retrieved.exec(value);
  return parts
    ? fill(c.utcDateTime, { date: parts[1]!, time: parts[2]! }, locale)
    : fill(c.referenceDateValue, { date: value }, locale);
}

/**
 * What a figure counts and how it was read, behind a disclosure the reader
 * opens: the unit, the dates, the live evaluation or the release, BReg's
 * disclosure rules for a released count, and when the host read it.
 */
export function DashboardCalculation({
  widget,
  result,
}: {
  widget: DashboardWidgetView;
  result: DashboardWidgetResult;
}) {
  const c = useDashboardContent(),
    locale = useLocale();
  const context = result.context;
  if (!context) return null;
  const flow = context.periodKind === "flow";
  const facts: [string, string][] = [
    [c.countedUnit, context.unit],
    flow
      ? [
          c.dateInterval,
          fill(
            c.interval,
            { start: context.start, end: context.end },
            locale,
          ),
        ]
      : [
          c.referenceDate,
          fill(
            c.referenceDateValue,
            { date: context.referenceDate },
            locale,
          ),
        ],
  ];
  if (context.evaluatedAt) facts.push([c.evaluated, utc(context.evaluatedAt, c, locale)]);
  if (context.version !== undefined)
    facts.push([
      c.release,
      fill(
        c.version,
        {
          version: String(context.version),
          status: context.releaseStatus ?? "",
        },
        locale,
      ),
    ]);
  if (context.disclosure)
    facts.push([
      c.disclosureRules,
      fill(
        c.disclosureRulesValue,
        {
          minimumCount: context.disclosure.minimumCount,
          roundingBase: context.disclosure.roundingBase,
        },
        locale,
      ),
    ]);
  facts.push([c.retrieved, utc(result.retrievedAt, c, locale)]);
  return (
    <details className="dashboard-calculation" data-widget={widget.id}>
      <summary>{c.calculation}</summary>
      <dl className="dashboard-context">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Help that applies to the counts of a ready result, in the order a reader needs it. */
function helpLines(
  c: DashboardContent,
  widget: DashboardWidgetView,
  result: DashboardWidgetResult,
  locale: string,
): string[] {
  const rows = [
    ...(result.rows ?? []),
    ...(result.total ? [result.total] : []),
  ];
  const minimum = minimumCountOf(result.context);
  const lines = [widget.source === "live" ? c.liveHelp : c.releasedHelp];
  if (rows.some((row) => row.status === "suppressed"))
    lines.push(
      minimum === undefined
        ? c.withheldHelpWithoutMinimum
        : fill(c.withheldHelp, { count: minimum }, locale),
    );
  if (rows.some((row) => row.status === "rounded")) lines.push(c.roundedHelp);
  if (rows.some((row) => row.drillthrough)) lines.push(c.openRecordsHelp);
  return lines;
}

/**
 * One widget of the dashboard. It reads its own counts through the host, so a
 * failure of one never blanks the others. A read that fails is worded as a
 * failure and offers a retry; it is never shown as a count of zero. The count
 * is drawn as BReg disclosed it; this block neither rounds nor retries.
 */
export function DashboardWidget({ widget }: { widget: DashboardWidgetView }) {
  const c = useDashboardContent(),
    locale = useLocale(),
    id = useId();
  const [period, setPeriod] = useState(widget.periods?.default);
  const query = useDashboardWidget(widget.id, period);
  const result = query.data;
  // A failed refresh keeps the last good data in the query; it is never shown as current.
  const ready = !query.error && result?.state === "ready" ? result : undefined;
  const failure = query.error
    ? problemView(query.error).kind === "session-ended"
      ? c.expired
      : c.unavailable
    : undefined;
  const message =
    failure ??
    (!query.error && result && result.state !== "ready"
      ? (result.message ??
        (result.state === "denied"
          ? c.denied
          : result.state === "missing"
            ? c.missing
            : c.unavailable))
      : undefined);
  const announcement = query.isPending
    ? c.loading
    : ready
      ? fill(c.ready, { period: ready.period }, locale)
      : "";
  return (
    <section
      className="dashboard-widget"
      aria-labelledby={`${id}-title`}
      aria-busy={query.isFetching}
    >
      <header>
        <div>
          <p className="dashboard-source">
            {widget.source === "live" ? c.live : c.released}
          </p>
          <h2 id={`${id}-title`}>{widget.title}</h2>
        </div>
        <button
          type="button"
          className="dashboard-refresh"
          aria-label={fill(c.refresh, { widget: widget.title }, locale)}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>
      {widget.description && <p>{widget.description}</p>}
      {widget.periods && widget.periods.choices.length > 1 ? (
        <div className="dashboard-period">
          <label htmlFor={`${id}-period`}>{c.period}</label>
          <select
            id={`${id}-period`}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {widget.periods.choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </div>
      ) : (
        ready && (
          <p className="dashboard-period">
            {fill(c.periodFixed, { period: ready.period }, locale)}
          </p>
        )
      )}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </p>
      {query.isPending && <p className="dashboard-note">{c.loading}</p>}
      {message && (
        <Notice tone="warning">
          <p>{message}</p>
          {failure && (
            <Button variant="outline" onClick={() => void query.refetch()}>
              {c.retry}
            </Button>
          )}
        </Notice>
      )}
      {ready && (
        <>
          {widget.type === "figure" ? (
            <DashboardFigure widget={widget} result={ready} />
          ) : widget.type === "chart" ? (
            <DashboardChart widget={widget} result={ready} />
          ) : (
            <DashboardTable widget={widget} result={ready} />
          )}
          {helpLines(c, widget, ready, locale).map((line) => (
            <p key={line} className="dashboard-note">
              {line}
            </p>
          ))}
          <DashboardCalculation widget={widget} result={ready} />
        </>
      )}
    </section>
  );
}
