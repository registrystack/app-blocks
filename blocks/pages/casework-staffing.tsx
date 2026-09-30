import type {
  CaseworkPrincipal,
  CaseworkStaffingAbsence,
  CaseworkStaffingActionReference,
  CaseworkStaffingPrincipal,
  CaseworkWorkItem,
} from "@registrystack/app-runtime";
import {
  AbsenceDrawer as BlockAbsenceDrawer,
  CaseworkAssignmentForm as BlockCaseworkAssignmentForm,
  EndAbsenceDialog as BlockEndAbsenceDialog,
  isSamePerson,
  MoveWorkDialog as BlockMoveWorkDialog,
  ReassignDialog as BlockReassignDialog,
  StaffingPendingNotice as BlockStaffingPendingNotice,
  useStaffingAbsenceCover,
  type MoveOffer,
  type MoveWorkFrom,
} from "@/blocks/casework/staffing";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { useRoute } from "@/blocks/shell/routing";

export { isSamePerson, useStaffingAbsenceCover };
export type { MoveOffer, MoveWorkFrom };

/** Where focus goes when a dialog closes: the control that opened it, else the page title. */
type FinalFocus = () => HTMLElement | null;

/**
 * The staffing writes of this session whose outcome is unknown, offered back
 * from any page: each is retried as the same attempt, never sent afresh. The
 * chrome and wording live in blocks/casework/staffing.tsx; this wrapper only
 * supplies the route the block needs to link back to the pending item.
 */
export function StaffingPendingNotice() {
  return <BlockStaffingPendingNotice route={useRoute()} />;
}

export function CaseworkAssignmentForm({
  item,
  actions,
  active = true,
}: {
  item: CaseworkWorkItem;
  actions: CaseworkStaffingActionReference[];
  /**
   * Whether the officer can see this form. A page that keeps the form mounted
   * behind a closed panel passes false, so the team roster is read when the
   * officer asks for it rather than on every page load.
   */
  active?: boolean;
}) {
  return (
    <BlockCaseworkAssignmentForm
      item={item}
      actions={actions}
      active={active}
      renderError={(error, retry) => (
        <ErrorPanel error={error} retry={retry} />
      )}
    />
  );
}

/**
 * The drawer that records or edits one absence cover. Cover changes where new
 * assignments go; it moves nothing already held, so the drawer says so and
 * offers the move once the cover is saved.
 */
export function AbsenceDrawer({
  open,
  onOpenChange,
  absence,
  person,
  directoryRef,
  finalFocus,
  moveOffers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The cover being edited; absent when a new one is recorded. */
  absence?: CaseworkStaffingAbsence;
  /** The person away, when the drawer opens from their row. */
  person?: CaseworkStaffingPrincipal;
  directoryRef: string;
  finalFocus: FinalFocus;
  moveOffers: (principal: CaseworkPrincipal) => MoveOffer[];
}) {
  return (
    <BlockAbsenceDrawer
      open={open}
      onOpenChange={onOpenChange}
      absence={absence}
      person={person}
      directoryRef={directoryRef}
      finalFocus={finalFocus}
      moveOffers={moveOffers}
      renderError={(error, retry) => (
        <ErrorPanel error={error} retry={retry} />
      )}
    />
  );
}

/**
 * Ending a cover is confirmed in a dialog that names the person and the dates
 * being ended. An unconfirmed end is offered back as the same attempt.
 */
export function EndAbsenceDialog({
  open,
  onOpenChange,
  absence,
  directoryRef,
  finalFocus,
  onEnded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absence: CaseworkStaffingAbsence;
  directoryRef: string;
  finalFocus: FinalFocus;
  onEnded: () => void;
}) {
  return (
    <BlockEndAbsenceDialog
      open={open}
      onOpenChange={onOpenChange}
      absence={absence}
      directoryRef={directoryRef}
      finalFocus={finalFocus}
      onEnded={onEnded}
      renderError={(error, retry) => (
        <ErrorPanel error={error} retry={retry} />
      )}
    />
  );
}

/**
 * Moving everything one person holds in one queue to a colleague: Casework
 * previews what may move page by page, the officer ticks the exact items,
 * and Casework answers for each item it processed.
 */
export function MoveWorkDialog({
  open,
  onOpenChange,
  from,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: MoveWorkFrom;
  finalFocus: FinalFocus;
}) {
  return (
    <BlockMoveWorkDialog
      open={open}
      onOpenChange={onOpenChange}
      from={from}
      finalFocus={finalFocus}
      renderError={(error, retry) => (
        <ErrorPanel error={error} retry={retry} />
      )}
    />
  );
}

export function ReassignDialog({
  open,
  onOpenChange,
  items,
  finalFocus,
  onReassigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CaseworkWorkItem[];
  finalFocus: FinalFocus;
  /** The items Casework confirmed reassigned, as each answer arrives. */
  onReassigned: (ids: string[]) => void;
}) {
  return (
    <BlockReassignDialog
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      finalFocus={finalFocus}
      onReassigned={onReassigned}
      renderError={(error, retry) => (
        <ErrorPanel error={error} retry={retry} />
      )}
    />
  );
}
