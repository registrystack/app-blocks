import type { RecordView } from "./model.js";

/** How BReg disclosed one count: exactly, rounded to its base, or withheld. */
export type StatisticStatus = "exact" | "rounded" | "suppressed";

export type DashboardWidgetType = "figure" | "chart" | "table";

/**
 * What the browser sends back to open the records behind one live, exact
 * cell. The host rebuilds the filter from it and refuses a binding that no
 * longer matches the widget and dataset it came from.
 */
export interface DashboardCellTarget {
  kind: "dashboard-cell";
  widgetId: string;
  period: string;
  binding: string;
  code?: string;
}

/** One widget of the dashboard as the page lays it out; its figures load apart. */
export interface DashboardWidgetView {
  id: string;
  type: DashboardWidgetType;
  title: string;
  description?: string;
  unit?: string;
  source: "live" | "released";
  /** The periods to choose from; absent when the widget shows the current one. */
  periods?: { choices: string[]; default: string };
  /** Whether the live cells of this widget can open their records. */
  drillthrough: boolean;
}

export interface DashboardView {
  title: string;
  widgets: DashboardWidgetView[];
}

/** The dashboard of this register, or null where it has none. */
export interface DashboardResponse {
  dashboard: DashboardView | null;
}

export interface DashboardCell {
  /** The dimension code; absent for a figure. `_T` is the total. */
  code?: string;
  /** The registry's display words for the code, when it has them. */
  label?: string;
  /** BReg's count as disclosed; null where it was withheld. */
  value: number | null;
  status: StatisticStatus;
  drillthrough?: DashboardCellTarget;
}

export interface DashboardWidgetContext {
  unit: string;
  population: string;
  periodKind: string;
  start: string;
  end: string;
  referenceDate: string;
  ended: boolean;
  source: "live" | "released";
  evaluatedAt?: string;
  version?: number;
  releaseStatus?: "final" | "provisional";
  /** BReg's disclosure rules for a released count. */
  disclosure?: { minimumCount: number; roundingBase: number };
}

export type DashboardWidgetState =
  | "ready"
  | "missing"
  | "denied"
  | "unavailable";

export interface DashboardWidgetResult {
  widgetId: string;
  period: string;
  retrievedAt: string;
  state: DashboardWidgetState;
  /** Wording for a state other than `ready`. */
  message?: string;
  context?: DashboardWidgetContext;
  rows?: DashboardCell[];
  /** The total across the shown dimension; absent for a figure. */
  total?: DashboardCell;
  /** True where the rows leave out categories that the total still counts. */
  subset?: true;
}

/** The records of one live cell, with the count the dashboard observed. */
export interface DashboardCohortPage {
  entity: string;
  items: RecordView[];
  nextCursor?: string;
  cohort: {
    widgetId: string;
    title: string;
    cellLabel?: string;
    code?: string;
    period: string;
    start: string;
    end: string;
    observedCount: number;
    retrievedAt: string;
  };
}
