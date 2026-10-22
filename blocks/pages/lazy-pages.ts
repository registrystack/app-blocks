import { lazyPage } from "@/blocks/pages/app-routes";

// The pages the default route tables draw, and the Casework notices beside
// them, each fetched when first drawn. The modules keep exporting the pages by
// name for apps that compose their own routes. The imports are relative: the
// registry install rewrites static import paths only.

/** One import for the pages and notices that share a module. */
const once = <T>(load: () => Promise<T>) => {
  let loading: Promise<T> | undefined;
  return () => (loading ??= load());
};
const caseworkReview = once(() => import("./casework-review"));
const caseworkStaffing = once(() => import("./casework-staffing"));

export const CaseworkHowReviewWorksPage = lazyPage(
  () => import("./casework-how-review-works"),
  "CaseworkHowReviewWorksPage",
);
export const CaseworkMyDecisionsPage = lazyPage(
  () => import("./casework-my-decisions"),
  "CaseworkMyDecisionsPage",
);
export const CaseworkReviewPage = lazyPage(
  caseworkReview,
  "CaseworkReviewPage",
);
export const CaseworkReviewsPage = lazyPage(
  caseworkReview,
  "CaseworkReviewsPage",
);
export const CaseworkSetupPage = lazyPage(
  () => import("./casework-setup"),
  "CaseworkSetupPage",
);
export const CaseworkStaffingPage = lazyPage(
  caseworkStaffing,
  "CaseworkStaffingPage",
);
export const CaseworkTeamReviewsPage = lazyPage(
  () => import("./casework-team-reviews"),
  "CaseworkTeamReviewsPage",
);
export const ReviewDecisionPendingNotice = lazyPage(
  caseworkReview,
  "ReviewDecisionPendingNotice",
);
export const StaffingPendingNotice = lazyPage(
  caseworkStaffing,
  "StaffingPendingNotice",
);
export const ChangeRequestFormPage = lazyPage(
  () => import("./change-request-form-page"),
  "ChangeRequestFormPage",
);
export const CreateRecordPage = lazyPage(
  () => import("./create-record-page"),
  "CreateRecordPage",
);
export const DashboardPage = lazyPage(
  () => import("./dashboard-page"),
  "DashboardPage",
);
export const DashboardRecordsPage = lazyPage(
  () => import("../dashboard/dashboard-records"),
  "DashboardRecordsPage",
);
export const StartPage = lazyPage(
  () => import("./start-page"),
  "StartPage",
);
export const HolderChooseChangePage = lazyPage(
  () => import("./holder-choose-pages"),
  "HolderChooseChangePage",
);
export const HolderChooseRecordPage = lazyPage(
  () => import("./holder-choose-pages"),
  "HolderChooseRecordPage",
);
export const HolderDocumentsPage = lazyPage(
  () => import("./holder-submit-pages"),
  "HolderDocumentsPage",
);
export const HolderRecordListPage = lazyPage(
  () => import("./holder-drafts"),
  "HolderRecordListPage",
);
export const HolderReviewPage = lazyPage(
  () => import("./holder-submit-pages"),
  "HolderReviewPage",
);
export const RecordActionPage = lazyPage(
  () => import("./record-action-page"),
  "RecordActionPage",
);
export const RecordDetailPage = lazyPage(
  () => import("./record-detail-page"),
  "RecordDetailPage",
);
export const RecordListPage = lazyPage(
  () => import("./record-list-page"),
  "RecordListPage",
);
export const RequestDetailPage = lazyPage(
  () => import("./request-detail-page"),
  "RequestDetailPage",
);
export const RequestQueuePage = lazyPage(
  () => import("./request-queue-page"),
  "RequestQueuePage",
);
