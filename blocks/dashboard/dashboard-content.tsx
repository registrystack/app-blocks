import { useContentArea } from "@/blocks/lib/content";

/**
 * The words the dashboard blocks show on their own: generic defaults an app
 * replaces with its own content through `ContentProvider`. A count that BReg
 * withholds is worded with the minimum BReg reports, through `{count}`.
 */
export interface DashboardContent {
  intro: string;
  loading: string;
  unavailable: string;
  expired: string;
  denied: string;
  missing: string;
  retry: string;
  refresh: string;
  ready: string;
  period: string;
  periodFixed: string;
  calculation: string;
  live: string;
  released: string;
  exact: string;
  rounded: string;
  withheld: string;
  approximately: string;
  belowMinimum: string;
  withheldWithoutMinimum: string;
  total: string;
  category: string;
  count: string;
  status: string;
  tableCaption: string;
  tableCaptionWithoutUnit: string;
  subsetNote: string;
  withheldHelp: string;
  withheldHelpWithoutMinimum: string;
  roundedHelp: string;
  liveHelp: string;
  releasedHelp: string;
  openRecords: string;
  openRecordsHelp: string;
  countedUnit: string;
  dateInterval: string;
  interval: string;
  referenceDate: string;
  referenceDateValue: string;
  /** "{date} {time} UTC": a timestamp, with `{date}` and `{time}` as the host wrote them. */
  utcDateTime: string;
  evaluated: string;
  release: string;
  version: string;
  disclosureRules: string;
  disclosureRulesValue: string;
  retrieved: string;
  recordsBack: string;
  recordsEyebrow: string;
  recordsTitle: string;
  recordsDescription: string;
  /** `{count}`: the matching records. */
  recordsCount: string;
  recordsLiveHelp: string;
  recordsMore: string;
  recordsEmpty: string;
  recordsInvalidTitle: string;
  recordsInvalid: string;
  recordsListCaption: string;
}

export const dashboardContent: DashboardContent = {
  intro:
    "Counts from the register. Each one states what it counts and which dates it uses.",
  loading: "Loading statistics…",
  unavailable: "These statistics could not be read. Try again.",
  expired: "Your session expired. Sign in again.",
  denied: "These statistics are not available to your current access.",
  missing: "No statistics have been released for this period.",
  retry: "Try again",
  refresh: "Refresh statistics: {widget}",
  ready: "Statistics ready for {period}.",
  period: "Period (UTC)",
  periodFixed: "Period: {period}",
  calculation: "How this figure is calculated",
  live: "Live count",
  released: "Released statistics",
  exact: "Exact",
  rounded: "Rounded",
  withheld: "Withheld",
  approximately: "≈ {value}",
  belowMinimum: "fewer than {count}",
  withheldWithoutMinimum: "withheld",
  total: "Total across all categories",
  category: "Category",
  count: "Count",
  status: "Disclosure status",
  tableCaption: "{widget}. Counts of {unit} for {period}.",
  tableCaptionWithoutUnit: "{widget}. Counts for {period}.",
  subsetNote:
    "Only selected categories are shown. The returned total includes categories not shown.",
  withheldHelp:
    "A count of fewer than {count} is withheld to protect privacy. It is not zero.",
  withheldHelpWithoutMinimum:
    "A small count is withheld to protect privacy. It is not zero.",
  roundedHelp:
    "A rounded count is approximate, a rounded zero included. Totals are rounded on their own and may differ from the sum of the counts shown.",
  liveHelp:
    "A live count describes the register now. Choosing an earlier period does not rebuild the register as it was then.",
  releasedHelp:
    "A release uses the records present when it was computed. It does not rebuild the register as it was in that period.",
  openRecords: "Open matching records: {label}, {value}, {period}",
  openRecordsHelp:
    "Opens the current records behind a count. Changes in the register can make the number of records differ.",
  countedUnit: "Counted unit",
  dateInterval: "Date interval",
  interval: "{start} to {end}, end date not included (UTC)",
  referenceDate: "Reference date",
  referenceDateValue: "{date} (UTC)",
  utcDateTime: "{date} {time} UTC",
  evaluated: "Evaluated",
  release: "Release",
  version: "Version {version} ({status})",
  disclosureRules: "Disclosure",
  disclosureRulesValue:
    "minimum count {minimumCount}, rounded to a multiple of {roundingBase}",
  retrieved: "Retrieved",
  recordsBack: "Back to the dashboard",
  recordsEyebrow: "Current records",
  recordsTitle: "{title}: {cell}",
  recordsDescription:
    "The current records behind this count, read now under your access.",
  recordsCount:
    "{count, plural, one {# matching record} other {# matching records}}",
  recordsLiveHelp:
    "The count and this list are separate live reads, not a snapshot. Records can change while you browse.",
  recordsMore: "Show more records",
  recordsEmpty: "No records match this count now.",
  recordsInvalidTitle: "This link is not available",
  recordsInvalid:
    "Go back to the dashboard and choose an available live count.",
  recordsListCaption: "Records behind {cell}",
};

export function useDashboardContent(): DashboardContent {
  return useContentArea("dashboard", dashboardContent);
}
