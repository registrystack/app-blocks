import type {
  CaseworkPageStatus,
  CaseworkPrincipal,
  CaseworkWorkItem,
} from "./types.js";

export interface CaseworkStaffingPrincipal {
  /** Session-bound authority reference. The browser must return this unchanged. */
  ref: string;
  /** Display-only identity. It never grants assignment or absence authority. */
  principal: CaseworkPrincipal;
}

type TargetPageFields = {
  cursor?: string;
  limit?: string;
};
export type CaseworkStaffingTargetQuery = TargetPageFields &
  (
    | { purpose: "assignment"; queue: string; personRef?: never }
    | { purpose: "absencePerson"; queue?: never; personRef?: never }
    | { purpose: "absenceCover"; queue?: never; personRef: string }
  );
export interface CaseworkStaffingTargetPage {
  items: CaseworkStaffingPrincipal[];
  nextCursor?: string;
  status: CaseworkPageStatus;
  /** Label of the queue the targets were resolved for, when the purpose names one. */
  queueLabel?: string;
}

export interface CaseworkStaffingAbsence {
  ref: string;
  person: CaseworkStaffingPrincipal;
  cover: CaseworkStaffingPrincipal;
  from: string;
  until: string;
}
export interface CaseworkStaffingAbsenceList {
  /** Session-bound reference to the current directory revision. */
  directoryRef: string;
  items: CaseworkStaffingAbsence[];
}

interface CaseworkStaffingWrite {
  attemptId: string;
  directoryRef: string;
}
export interface CaseworkStaffingCreateAbsence extends CaseworkStaffingWrite {
  personRef: string;
  coverRef: string;
  from: string;
  until: string;
}
export interface CaseworkStaffingUpdateAbsence extends CaseworkStaffingWrite {
  absenceRef: string;
  coverRef: string;
  from: string;
  until: string;
}
export interface CaseworkStaffingDeleteAbsence extends CaseworkStaffingWrite {
  absenceRef: string;
}
export type CaseworkStaffingAbsenceResult =
  | {
      outcome: "confirmed";
      directoryRef?: string;
      absence?: CaseworkStaffingAbsence;
      deleted?: true;
    }
  | { outcome: "unknown"; attemptId: string; supportReference?: string };

export interface CaseworkStaffingActionReference {
  ref: string;
  name: "assign" | "delegate";
}
export interface CaseworkStaffingAssignCommand {
  attemptId: string;
  actionRef: string;
  targetRef: string;
  reason?: string;
}
export type CaseworkStaffingAssignResult =
  | { outcome: "confirmed"; itemId: string; revision: string }
  | { outcome: "unknown"; attemptId: string; supportReference?: string };

export interface CaseworkStaffingCaseloadPreviewInput {
  fromRef: string;
  toRef: string;
  queue: string;
  reason: string;
  /** Session-bound identity of the first preview page. Required for continuations. */
  previewRef?: string;
  cursor?: string;
  limit?: string;
}
export interface CaseworkStaffingCaseloadSelection {
  /** Binds this exact item revision to the preview movement in this session. */
  ref: string;
  item: CaseworkWorkItem;
}
export interface CaseworkStaffingCaseloadPreviewPage {
  previewRef: string;
  items: CaseworkStaffingCaseloadSelection[];
  nextCursor?: string;
  status: CaseworkPageStatus;
  queueLabel: string;
}
export interface CaseworkStaffingApplyCaseload {
  attemptId: string;
  selectionRefs: string[];
}
export interface CaseworkStaffingCaseloadItemResult {
  itemId: string;
  result:
    "moved" | "notVisible" | "notEligible" | "attemptInProgress" | "conflict";
  revision?: string;
}
export type CaseworkStaffingApplyResult =
  | { outcome: "confirmed"; items: CaseworkStaffingCaseloadItemResult[] }
  | { outcome: "unknown"; attemptId: string; supportReference?: string };
