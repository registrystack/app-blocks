import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  CaseworkStaffingAbsence,
  CaseworkStaffingActionReference,
  CaseworkStaffingApplyResult,
  CaseworkPrincipal,
  CaseworkStaffingPrincipal,
  CaseworkWorkItem,
} from "@registrystack/app-runtime";
import type { CommandState } from "@registrystack/app-runtime";
import {
  commandUnresolved,
  staffingWriteStuck,
  useAbsenceEnd,
  useAbsenceSave,
  useCaseloadMove,
  useCaseloadPreview,
  useStaffingAssignment,
  useStaffingAssignments,
  useStaffingRecovery,
  useStaffingTargets,
  type CaseloadPreviewInput,
  type StaffingTargets,
} from "@registrystack/app-runtime/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InputField } from "@/blocks/fields/input-field";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/casework/announce";
import { useCaseworkContent, type ReassignResult } from "@/blocks/casework/casework-content";
import {
  CaseworkPerson,
  caseworkDateTime,
  caseworkLocalInput,
  caseworkLocalInstant,
  caseworkLocalZone,
  caseworkPerson,
  caseworkPersonSubject,
  CaseworkReference,
  caseworkReference,
  ErrorSummary,
  Loading,
  Notice,
} from "@/blocks/casework/shared";

/**
 * The staffing surfaces: the assignment form an officer meets on a casework
 * item, and the dialogs the Team page opens to record or end absence cover,
 * move a person's work and reassign selected items. Casework decides who is
 * eligible and what may move; these screens carry presentation and wording
 * only, and every choice is sent back as the opaque reference Casework
 * issued, never as a name.
 */

/**
 * How a page renders an error: with a retry when the write or read can be
 * sent again, without one for a refusal, which is answered once and stands.
 */
type RenderError = (error: unknown, retry?: () => void) => ReactNode;

interface TargetOption {
  /** The session-bound reference Casework issued; the only value ever sent. */
  value: string;
  label: string;
  /** The subject shown beside a name, and nothing when the name is the subject. */
  subject: string | null;
}

type Targets = StaffingTargets;
export { useStaffingAbsenceCover } from "@registrystack/app-runtime/react";

/**
 * What Casework said about the page of colleagues it answered, in the words
 * every screen reading a bounded page uses. A page that is complete but empty
 * says so instead: the list is not short, there is nobody on it.
 */
function TargetStatus({ targets }: { targets: Targets }) {
  const c = useCaseworkContent();
  if (!targets.loaded) return null;
  const shortfall = targets.pageStatus
    ? c.caseworkPageStatus[targets.pageStatus]
    : undefined;
  if (shortfall) return <p className="staffing-status">{shortfall}</p>;
  if (!targets.items.length)
    return <p className="staffing-status">{c.targetsUnavailable}</p>;
  return null;
}

function TargetCombobox({
  name,
  label,
  value,
  onChange,
  error,
  targets,
  announce,
  inline = false,
  exclude,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  targets: Targets;
  announce?: (message: string) => void;
  /**
   * Renders the list in the field's own flow rather than in a portalled
   * popup, for a field inside a dialog: the list stays inside the dialog's
   * focus trap. Base UI treats an inline list as always expanded, so the
   * combobox is only inline while its list is open; closed, it reports
   * itself collapsed and points at no list.
   */
  inline?: boolean;
  /** A reference left out of the list, such as the person being covered. */
  exclude?: string;
}) {
  const c = useCaseworkContent();
  const [listOpen, setListOpen] = useState(false);
  const options: TargetOption[] = useMemo(
    () =>
      targets.items
        .filter((target) => target.ref !== exclude)
        .map((target) => ({
          value: target.ref,
          label: caseworkPerson(target.principal),
          subject: caseworkPersonSubject(target.principal),
        })),
    [targets.items, exclude],
  );
  const list = (
    <>
      <ComboboxEmpty>{c.noMatchingColleague}</ComboboxEmpty>
      {/* The list is portalled out of the field, so it carries the name
          the shared component requires instead of inheriting the field's. */}
      <ComboboxList aria-label={c.targetList}>
        {(option: TargetOption) => (
          <ComboboxItem key={option.value} value={option}>
            <CaseworkPerson name={option.label} subject={option.subject} />
          </ComboboxItem>
        )}
      </ComboboxList>
    </>
  );
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <div className={`field ${error ? "field-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {error && (
        <p className="field-error-message" id={`${name}-error`}>
          {error}
        </p>
      )}
      <Combobox
        items={options}
        value={selected}
        onValueChange={(next: TargetOption | null) =>
          onChange(next ? next.value : "")
        }
        isItemEqualToValue={(a: TargetOption, b: TargetOption) =>
          a.value === b.value
        }
        {...(inline
          ? {
              inline: listOpen,
              open: listOpen,
              onOpenChange: (open: boolean) => setListOpen(open),
            }
          : {})}
      >
        {/* The input opens the list on its own, so the list is reached from
            the input alone: at a phone's width the field has no room for a
            second control beside what an officer types. */}
        <ComboboxInput
          id={name}
          name={name}
          placeholder={c.selectTarget}
          showTrigger={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {inline ? (
          listOpen && (
            <div className="mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-sm">
              {list}
            </div>
          )
        ) : (
          <ComboboxContent>{list}</ComboboxContent>
        )}
      </Combobox>
      <TargetStatus targets={targets} />
      {targets.hasNextPage && (
        <div className="actions">
          <Button
            variant="outline"
            disabled={targets.isFetchingNextPage}
            onClick={async () => {
              const more = await targets.fetchNextPage();
              const count =
                more.data?.pages.reduce(
                  (total, page) => total + page.items.length,
                  0,
                ) ?? 0;
              announce?.(c.moreTargetsLoaded(count));
            }}
          >
            {c.moreTargets}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Moves focus to the panel that reports a write's outcome, so the officer
 * reads the answer where they are instead of hunting for it down the page.
 */
function useOutcomeFocus<T extends HTMLElement>(shown: boolean) {
  const panel = useRef<T>(null);
  useEffect(() => {
    if (shown) panel.current?.focus();
  }, [shown]);
  return panel;
}

/**
 * A staffing write Casework could not confirm, on a screen with no work item
 * to recover against. The same attempt is offered again; a second attempt is
 * never created from this notice. An attempt the host can no longer resend is
 * left for the officer to check, and can be put away.
 */
function UnknownWrite({
  message,
  state,
  retry,
  dismiss,
  busy = false,
}: {
  message: string;
  state: CommandState<unknown>;
  retry: () => void;
  dismiss: () => void;
  /** True while a batch this write belongs to is resending another entry. */
  busy?: boolean;
}) {
  const c = useCaseworkContent();
  if (staffingWriteStuck(state))
    return (
      <Notice tone="warning">
        <p>{c.unknownStuck}</p>
        <Button variant="outline" onClick={dismiss}>
          {c.stopShowing}
        </Button>
      </Notice>
    );
  return (
    <Notice tone="warning">
      <p>{message}</p>
      <Button
        variant="outline"
        disabled={busy || state.state === "recovering"}
        onClick={retry}
      >
        {c.exactRetry}
      </Button>
    </Notice>
  );
}

/**
 * The staffing writes of this session whose outcome is unknown, offered back
 * from any page: each is retried as the same attempt, never sent afresh.
 */
export function StaffingPendingNotice({ route }: { route: string }) {
  const c = useCaseworkContent();
  const recovery = useStaffingRecovery();
  const { clearOutcome } = recovery;
  const live = recovery.pending.filter(
    (entry) => !entry.withoutAuthority,
  ).length;
  const orphaned = recovery.pending.length - live;
  // An outcome is read where it was reported; the next page starts clean.
  useEffect(() => clearOutcome(), [route]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!recovery.pending.length)
    return recovery.outcome === "confirmed" ||
      recovery.outcome === "refused" ? (
      <div className="staffing-pending">
        <Notice tone={recovery.outcome === "confirmed" ? "success" : "info"}>
          {recovery.outcome === "confirmed"
            ? c.pendingRecorded
            : c.pendingRefused}
        </Notice>
      </div>
    ) : null;
  const stuck = recovery.stuck.length > 0;
  return (
    <div className="staffing-pending">
      <Notice tone="warning" title={c.pendingTitle}>
        {live > 0 && <p>{c.pendingBody(live)}</p>}
        {recovery.outcome === "refused" && <p>{c.pendingRefused}</p>}
        {recovery.outcome === "unknown" && (
          <p>{stuck ? c.unknownStuck : c.pendingStill}</p>
        )}
        {orphaned > 0 && <p>{c.pendingWithoutAuthority}</p>}
        <div className="actions">
          {live > 0 && (
            <Button
              disabled={recovery.busy}
              onClick={() => void recovery.retryAll()}
            >
              {c.pendingRetry}
            </Button>
          )}
          {(orphaned > 0 || stuck) && (
            <Button variant="outline" onClick={recovery.forget}>
              {c.stopShowing}
            </Button>
          )}
        </div>
      </Notice>
    </div>
  );
}

export function CaseworkAssignmentForm({
  item,
  actions,
  active = true,
  renderError,
}: {
  item: CaseworkWorkItem;
  actions: CaseworkStaffingActionReference[];
  /**
   * Whether the officer can see this form. A page that keeps the form mounted
   * behind a closed panel passes false, so the team roster is read when the
   * officer asks for it rather than on every page load.
   */
  active?: boolean;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const targets = useStaffingTargets(
    active ? { purpose: "assignment", queue: item.queue, limit: "100" } : null,
  );
  const [announcement, announce] = useAnnouncement();
  const [actionRef, setActionRef] = useState(actions[0]?.ref ?? "");
  const [targetRef, setTargetRef] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // An unresolved assignment of this item, made here or by a reassignment,
  // is restored wherever the item's form is shown.
  const command = useStaffingAssignment(item.id);
  const confirmed = command.state.state === "confirmed";
  const assignmentOutcome = useOutcomeFocus<HTMLDivElement>(confirmed);

  if (actions.length === 0) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (command.locked) return;
    const next: Record<string, string> = {};
    if (!actionRef) next["staffing-action"] = c.requiredError;
    if (!targetRef) next["staffing-target"] = c.requiredError;
    setErrors(next);
    if (Object.keys(next).length) return;
    void command.run({
      actionRef,
      targetRef,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  }

  return (
    <section className="staffing-assignment">
      <h2>{c.assignmentHeading}</h2>
      <p>{c.assignmentDescription}</p>
      <LiveAnnouncer message={announcement} />
      {targets.isPending ? (
        <Loading />
      ) : targets.error ? (
        renderError(targets.error, () => void targets.refetch())
      ) : (
        <form onSubmit={submit}>
          <ErrorSummary errors={errors} />
          {/* While the outcome is unknown nothing here can start a second
              attempt. */}
          <fieldset disabled={command.locked} className="min-w-0">
            <InputField
              name="staffing-action"
              label={c.assignmentAction}
              value={actionRef}
              onChange={setActionRef}
              error={errors["staffing-action"]}
              options={actions.map((action) => ({
                value: action.ref,
                label: c.actionLabels[action.name],
              }))}
            />
            <TargetCombobox
              name="staffing-target"
              label={c.assignmentTarget}
              value={targetRef}
              onChange={setTargetRef}
              error={errors["staffing-target"]}
              targets={targets}
              announce={announce}
            />
            <InputField
              name="staffing-reason"
              label={c.assignmentReason}
              value={reason}
              onChange={setReason}
              hint={c.assignmentReasonHint}
              required={false}
              multiline
            />
          </fieldset>
          {!command.locked && (
            <Button type="submit">
              {
                c.actionLabels[
                  actions.find((action) => action.ref === actionRef)?.name ??
                    actions[0]!.name
                ]
              }
            </Button>
          )}
        </form>
      )}
      {command.state.state === "refused" && renderError(command.state.error)}
      {commandUnresolved(command.state) && (
        <UnknownWrite
          message={c.assignmentUnknown}
          state={command.state}
          retry={() => void command.retry()}
          dismiss={command.dismissUnknown}
        />
      )}
      {confirmed && (
        <div className="staffing-outcome" tabIndex={-1} ref={assignmentOutcome}>
          <Notice tone="success">{c.assignmentConfirmed}</Notice>
        </div>
      )}
    </section>
  );
}

/** Whether two staffing records carry the same authority identity. */
export function isSamePerson(
  left: CaseworkPrincipal,
  right: CaseworkPrincipal,
) {
  return left.issuer === right.issuer && left.subject === right.subject;
}

/** Where focus goes when a dialog closes: the control that opened it, else the page title. */
type FinalFocus = () => HTMLElement | null;

/** One way to move a person's held work, offered once their cover is saved. */
export interface MoveOffer {
  key: string;
  queueLabel: string;
  open: () => void;
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
  renderError,
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
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const [unresolved, setUnresolved] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next || !unresolved) onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        finalFocus={finalFocus}
        className="overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="mb-0">
            {absence ? c.editAbsence : c.createAbsence}
          </SheetTitle>
        </SheetHeader>
        <AbsenceForm
          absence={absence}
          person={person}
          directoryRef={directoryRef}
          moveOffers={moveOffers}
          onUnresolvedChange={setUnresolved}
          renderError={renderError}
        />
      </SheetContent>
    </Sheet>
  );
}

/** A local date and a local time, as the two controls hold them. */
function splitLocal(value: string): [string, string] {
  const [date = "", time = ""] = caseworkLocalInput(value).split("T");
  return [date, time];
}

export function AbsenceForm({
  absence,
  person,
  directoryRef,
  moveOffers,
  onUnresolvedChange,
  renderError,
}: {
  absence?: CaseworkStaffingAbsence;
  person?: CaseworkStaffingPrincipal;
  directoryRef: string;
  moveOffers: (principal: CaseworkPrincipal) => MoveOffer[];
  onUnresolvedChange: (unresolved: boolean) => void;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const [announcement, announce] = useAnnouncement();
  const fixed = absence?.person ?? person;
  const people = useStaffingTargets(
    fixed ? null : { purpose: "absencePerson", limit: "100" },
  );
  const [personRef, setPersonRef] = useState(fixed?.ref ?? "");
  const covers = useStaffingTargets(
    personRef ? { purpose: "absenceCover", personRef, limit: "100" } : null,
  );
  const [coverRef, setCoverRef] = useState(absence?.cover.ref ?? "");
  const initialFrom = absence ? splitLocal(absence.from) : ["", ""];
  const initialUntil = absence ? splitLocal(absence.until) : ["", ""];
  const [fromDate, setFromDate] = useState(initialFrom[0]);
  const [fromTime, setFromTime] = useState(initialFrom[1]);
  const [untilDate, setUntilDate] = useState(initialUntil[0]);
  const [untilTime, setUntilTime] = useState(initialUntil[1]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // An unresolved edit of this cover, or an unresolved new cover, is restored
  // whenever the drawer opens again, even after a reload.
  const command = useAbsenceSave(absence ? absence.ref : "create");
  const confirmed = command.state.state === "confirmed";
  const outcome = useOutcomeFocus<HTMLDivElement>(confirmed);

  useEffect(
    () => onUnresolvedChange(command.locked),
    [onUnresolvedChange, command.locked],
  );

  const principal =
    fixed?.principal ??
    people.items.find((target) => target.ref === personRef)?.principal;
  const name = principal ? caseworkPerson(principal) : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (command.locked) return;
    const start = caseworkLocalInstant(`${fromDate}T${fromTime}`);
    const end = caseworkLocalInstant(`${untilDate}T${untilTime}`);
    const next: Record<string, string> = {};
    if (!personRef) next["absence-person"] = c.requiredError;
    if (!coverRef) next["absence-cover"] = c.requiredError;
    if (!start) next["absence-from-date"] = c.requiredError;
    if (!end) next["absence-until"] = c.requiredError;
    else if (start && end <= start) next["absence-until"] = c.invalidInterval;
    setErrors(next);
    if (Object.keys(next).length || !start || !end) return;
    const common = { directoryRef, coverRef, from: start, until: end };
    void command.run(
      absence
        ? { ...common, absenceRef: absence.ref }
        : { ...common, personRef },
    );
  }

  if (confirmed)
    return (
      <div className="flex flex-1 flex-col">
        <div
          className="staffing-outcome flex flex-col gap-3 px-4"
          tabIndex={-1}
          ref={outcome}
        >
          <Notice tone="success">{c.absenceConfirmed}</Notice>
          {principal &&
            moveOffers(principal).map((offer) => (
              <Button key={offer.key} variant="outline" onClick={offer.open}>
                {`${c.caseloadTitle(name!, offer.queueLabel)}…`}
              </Button>
            ))}
        </div>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>
            {c.close}
          </SheetClose>
        </SheetFooter>
      </div>
    );

  if (!fixed && people.isPending) return <Loading />;
  if (!fixed && people.error)
    return renderError(people.error, () => void people.refetch());

  const zone = caseworkLocalZone();
  return (
    <form className="flex flex-1 flex-col" onSubmit={submit} noValidate>
      <div className="px-4">
        <LiveAnnouncer message={announcement} />
        <ErrorSummary errors={errors} />
        {/* While the outcome is unknown nothing here can start a second
            attempt. */}
        <fieldset disabled={command.locked} className="min-w-0">
          {fixed ? (
            <div className="field">
              <p className="field-label">{c.person}</p>
              <CaseworkPerson person={fixed.principal} />
            </div>
          ) : (
            <TargetCombobox
              inline
              name="absence-person"
              label={c.person}
              value={personRef}
              onChange={(value) => {
                setPersonRef(value);
                setCoverRef("");
              }}
              error={errors["absence-person"]}
              targets={people}
              announce={announce}
            />
          )}
          {personRef && (
            <TargetCombobox
              inline
              name="absence-cover"
              label={c.cover}
              value={coverRef}
              onChange={setCoverRef}
              error={errors["absence-cover"]}
              targets={covers}
              exclude={personRef}
              announce={announce}
            />
          )}
          {covers.error &&
            renderError(covers.error, () => void covers.refetch())}
          <WhenField
            id="absence-from-date"
            legend={c.from}
            dateLabel={c.fromDate}
            timeLabel={c.fromTime}
            date={fromDate}
            time={fromTime}
            onDate={setFromDate}
            onTime={setFromTime}
            error={errors["absence-from-date"]}
          />
          <WhenField
            id="absence-until"
            legend={c.until}
            dateLabel={c.untilDate}
            timeLabel={c.untilTime}
            date={untilDate}
            time={untilTime}
            onDate={setUntilDate}
            onTime={setUntilTime}
            error={errors["absence-until"]}
          />
          <p className="mb-3 text-xs text-muted-foreground">
            {c.zoneHint(zone)}
          </p>
          {name && <p className="mb-3 text-sm">{c.heldWork(name)}</p>}
        </fieldset>
        {command.state.state === "refused" && renderError(command.state.error)}
        {commandUnresolved(command.state) && (
          <UnknownWrite
            message={c.absenceUnknown}
            state={command.state}
            retry={() => void command.retry()}
            dismiss={command.dismissUnknown}
          />
        )}
      </div>
      <SheetFooter className="flex-row justify-end">
        {!command.locked && (
          <SheetClose render={<Button variant="outline" />}>
            {c.cancel}
          </SheetClose>
        )}
        {!command.locked && (
          <Button type="submit">
            {absence ? c.saveAbsenceChanges : c.saveAbsence}
          </Button>
        )}
      </SheetFooter>
    </form>
  );
}

/**
 * One end of a cover, entered as a local date and a local time. The date
 * control carries the field's id, so an error summary link lands on it.
 */
function WhenField({
  id,
  legend,
  dateLabel,
  timeLabel,
  date,
  time,
  onDate,
  onTime,
  error,
}: {
  id: string;
  legend: string;
  dateLabel: string;
  timeLabel: string;
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  error?: string;
}) {
  const described = error ? `${id}-error` : undefined;
  return (
    <fieldset className={`field ${error ? "field-error" : ""}`}>
      <legend className="field-label">{legend}</legend>
      {error && (
        <p className="field-error-message" id={`${id}-error`}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={id}>
          {dateLabel}
        </label>
        <Input
          id={id}
          type="date"
          className="w-auto min-w-0 flex-1"
          value={date}
          onChange={(event) => onDate(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={described}
        />
        <label className="sr-only" htmlFor={`${id}-time`}>
          {timeLabel}
        </label>
        <Input
          id={`${id}-time`}
          type="time"
          className="w-32"
          value={time}
          onChange={(event) => onTime(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={described}
        />
      </div>
    </fieldset>
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
  renderError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absence: CaseworkStaffingAbsence;
  directoryRef: string;
  finalFocus: FinalFocus;
  onEnded: () => void;
  renderError: RenderError;
}) {
  // An unresolved end of this cover is restored when the dialog opens again.
  const command = useAbsenceEnd(absence.ref);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next || !command.locked) onOpenChange(next);
      }}
    >
      <AlertDialogContent finalFocus={finalFocus}>
        <EndAbsenceBody
          absence={absence}
          directoryRef={directoryRef}
          command={command}
          onEnded={onEnded}
          renderError={renderError}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The confirmation itself: the person and the dates being ended, and the
 * command's own outcome. Split from its dialog, which wraps content in a
 * portal a static render never sees, so the confirm and retry logic can be
 * exercised directly.
 */
export function EndAbsenceBody({
  absence,
  directoryRef,
  command,
  onEnded,
  renderError,
}: {
  absence: CaseworkStaffingAbsence;
  directoryRef: string;
  command: ReturnType<typeof useAbsenceEnd>;
  onEnded: () => void;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();

  async function settle(answer: Promise<CommandState<unknown>>) {
    if ((await answer).state === "confirmed") onEnded();
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="mb-0">
          {c.confirmEndAbsenceTitle}
        </AlertDialogTitle>
        <AlertDialogDescription className="mb-0">
          {c.confirmEndAbsenceBody(
            caseworkPerson(absence.person.principal),
            caseworkDateTime(absence.from),
            caseworkDateTime(absence.until),
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {command.state.state === "refused" && renderError(command.state.error)}
      {commandUnresolved(command.state) && (
        <UnknownWrite
          message={c.absenceUnknown}
          state={command.state}
          retry={() => void settle(command.retry())}
          dismiss={command.dismissUnknown}
        />
      )}
      <AlertDialogFooter>
        {!command.locked && <AlertDialogCancel>{c.cancel}</AlertDialogCancel>}
        {!command.locked && (
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              void settle(
                command.run({ directoryRef, absenceRef: absence.ref }),
              )
            }
          >
            {c.confirmEndAbsence}
          </AlertDialogAction>
        )}
      </AlertDialogFooter>
    </>
  );
}

/** The person whose work moves, as the Team row names them. */
export interface MoveWorkFrom {
  principal: CaseworkPrincipal;
  name: string;
  queue: string;
  queueLabel: string;
  /** What Casework counted them holding in this queue. */
  activeItems: number;
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
  renderError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: MoveWorkFrom;
  finalFocus: FinalFocus;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const [unresolved, setUnresolved] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || !unresolved) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        finalFocus={finalFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="mb-0">
            {c.caseloadTitle(from.name, from.queueLabel)}
          </DialogTitle>
          <DialogDescription className="mb-0">
            {c.caseloadDescription}
          </DialogDescription>
        </DialogHeader>
        <MoveWorkBody
          from={from}
          onUnresolvedChange={setUnresolved}
          renderError={renderError}
        />
      </DialogContent>
    </Dialog>
  );
}

export function MoveWorkBody({
  from,
  onUnresolvedChange,
  renderError,
}: {
  from: MoveWorkFrom;
  onUnresolvedChange: (unresolved: boolean) => void;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const [announcement, announce] = useAnnouncement();
  const targets = useStaffingTargets({
    purpose: "assignment",
    queue: from.queue,
    limit: "100",
  });
  const fromRef = targets.items.find((target) =>
    isSamePerson(target.principal, from.principal),
  )?.ref;
  // One movement of this person's work in this queue at a time: an unresolved
  // one is restored when the dialog opens again, even after a reload.
  const command = useCaseloadMove(
    fromRef ? `${from.queue}/${fromRef}` : undefined,
  );
  const { locked } = command;
  const result =
    command.state.state === "confirmed" ? command.state.value : undefined;
  const [toRef, setToRef] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewInput, setPreviewInput] = useState<CaseloadPreviewInput>();
  const caseload = useCaseloadPreview();
  const { pages, failure } = caseload;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const previewPending = caseload.pending;
  const caseloadOutcome = useOutcomeFocus<HTMLElement>(result !== undefined);

  useEffect(() => onUnresolvedChange(locked), [onUnresolvedChange, locked]);

  const selections = useMemo(
    () => pages.flatMap((page) => page.items),
    [pages],
  );
  const lastPage = pages.at(-1);

  function change(setter: (value: string) => void, value: string) {
    setter(value);
    setPreviewInput(undefined);
    caseload.reset();
    setSelected(new Set());
    command.dismiss();
  }

  async function preview(cursor?: string) {
    let input = previewInput;
    if (!cursor) {
      const next: Record<string, string> = {};
      if (!toRef) next["move-to"] = c.requiredError;
      if (!reason.trim()) next["move-reason"] = c.requiredError;
      setErrors(next);
      if (Object.keys(next).length || !fromRef) return;
      input = {
        fromRef,
        toRef,
        queue: from.queue,
        reason: reason.trim(),
        limit: "25",
      };
      setPreviewInput(input);
      caseload.reset();
      setSelected(new Set());
      command.dismiss();
    }
    if (!input) return;
    const loaded = await caseload.preview(input, cursor);
    if (!loaded) return;
    const page = loaded.at(-1)!;
    // What Casework offers is ticked as it arrives: the officer unticks
    // what should stay, and nothing already unticked is ticked again.
    setSelected((current) => {
      const next = new Set(current);
      for (const selection of page.items) next.add(selection.ref);
      return next;
    });
    announce(
      c.previewCount(
        loaded.reduce((total, each) => total + each.items.length, 0),
      ),
    );
  }

  async function settle(
    answer: Promise<CommandState<CaseworkStaffingApplyResult>>,
  ) {
    const settled = await answer;
    if (settled.state !== "confirmed" || settled.value.outcome !== "confirmed")
      return;
    // The exact selection Casework processed is spent: it cannot be applied
    // again, so the ticks and the button that sends them start over.
    setSelected(new Set());
    announce(c.caseloadResultsAnnouncement(settled.value.items.length));
  }

  function applySelected(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    const selectionRefs = selections
      .filter((selection) => selected.has(selection.ref))
      .map((selection) => selection.ref);
    if (!selectionRefs.length) {
      setErrors({ [SELECTION_FIELD]: c.selectSomething });
      return;
    }
    setErrors({});
    void settle(command.run({ selectionRefs }));
  }

  if (targets.isPending) return <Loading />;
  if (targets.error)
    return renderError(targets.error, () => void targets.refetch());
  if (!fromRef) return <p>{c.caseloadNoMove(from.name)}</p>;

  const ticked = selections.filter((selection) =>
    selected.has(selection.ref),
  ).length;
  // Once Casework has answered its last page, what this person holds beyond
  // the items offered is counted; while more may follow, nothing is claimed.
  const settled = lastPage?.status === "complete" && !lastPage.nextCursor;
  const remainder = from.activeItems - selections.length;
  return (
    <>
      <LiveAnnouncer message={announcement} />
      <ErrorSummary errors={errors} />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void preview();
        }}
      >
        {/* While a movement's outcome is unknown nothing here can start a
            second one. */}
        <fieldset disabled={locked} className="min-w-0">
          <TargetCombobox
            inline
            name="move-to"
            label={c.moveTo}
            value={toRef}
            onChange={(value) => change(setToRef, value)}
            error={errors["move-to"]}
            targets={targets}
            exclude={fromRef}
            announce={announce}
          />
          <InputField
            name="move-reason"
            label={c.movementReason}
            value={reason}
            onChange={(value) => change(setReason, value)}
            error={errors["move-reason"]}
            multiline
          />
          <Button type="submit" variant="outline" disabled={previewPending}>
            {c.previewCaseload}
          </Button>
        </fieldset>
      </form>

      {pages.length > 0 && (
        <form onSubmit={applySelected} className="flex flex-col gap-3">
          {selections.length ? (
            <fieldset
              id={SELECTION_FIELD}
              tabIndex={-1}
              className={`field mb-0 ${errors[SELECTION_FIELD] ? "field-error" : ""}`}
              aria-invalid={!!errors[SELECTION_FIELD]}
              aria-describedby={
                errors[SELECTION_FIELD] ? `${SELECTION_FIELD}-error` : undefined
              }
            >
              <legend className="field-label">{c.previewChoose}</legend>
              {errors[SELECTION_FIELD] && (
                <p
                  className="field-error-message"
                  id={`${SELECTION_FIELD}-error`}
                >
                  {errors[SELECTION_FIELD]}
                </p>
              )}
              {selections.map((selection) => {
                const reference = caseworkReference(selection.item, c);
                const id = selectionId(selection.ref);
                return (
                  <div
                    className="flex min-h-8 items-center gap-2"
                    key={selection.ref}
                  >
                    <Checkbox
                      id={id}
                      disabled={locked}
                      checked={selected.has(selection.ref)}
                      onCheckedChange={(checked) => {
                        setSelected((current) => {
                          const next = new Set(current);
                          if (checked) next.add(selection.ref);
                          else next.delete(selection.ref);
                          return next;
                        });
                      }}
                    />
                    <label htmlFor={id} className="min-w-0 break-words">
                      {c.caseloadSelectItem(reference)}
                    </label>
                  </div>
                );
              })}
            </fieldset>
          ) : (
            <p>{c.previewEmpty}</p>
          )}
          {/* What Casework said about the page it answered, in the words
              every screen reading a bounded page uses. */}
          {lastPage && c.caseworkPageStatus[lastPage.status] && (
            <p className="staffing-status text-sm text-muted-foreground">
              {c.caseworkPageStatus[lastPage.status]}
            </p>
          )}
          {lastPage?.nextCursor && (
            <p className="staffing-status text-sm text-muted-foreground">
              {c.previewMorePages}
            </p>
          )}
          {settled && remainder > 0 && (
            <p className="text-sm text-muted-foreground">
              {c.cannotMove(remainder)}
            </p>
          )}
          <div className="actions">
            {lastPage?.nextCursor && (
              <Button
                variant="outline"
                disabled={previewPending || locked}
                onClick={() => void preview(lastPage.nextCursor)}
              >
                {c.loadMorePreview}
              </Button>
            )}
            {selections.length > 0 && !locked && (
              <Button type="submit">{c.applySelected(ticked)}</Button>
            )}
          </div>
        </form>
      )}
      {failure !== undefined && renderError(failure)}
      {command.state.state === "refused" && renderError(command.state.error)}
      {commandUnresolved(command.state) && (
        <UnknownWrite
          message={c.caseloadUnknown}
          state={command.state}
          retry={() => void settle(command.retry())}
          dismiss={command.dismissUnknown}
        />
      )}
      {/* Casework answers per item, and some of those answers are refusals, so
          the results are read as a list of outcomes, not as one success. */}
      {result?.outcome === "confirmed" && (
        <section
          className="staffing-results"
          tabIndex={-1}
          ref={caseloadOutcome}
        >
          <h3 className="font-medium">{c.caseloadResults}</h3>
          <p>{c.caseloadConfirmed}</p>
          <ul className="list-disc ps-5">
            {result.items.map((item) => {
              const selection = selections.find(
                (candidate) => candidate.item.id === item.itemId,
              );
              return (
                <li key={item.itemId}>
                  {selection ? (
                    <CaseworkReference item={selection.item} />
                  ) : (
                    c.unnamedRequest
                  )}
                  : {c.resultLabels[item.result]}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <DialogFooter>
        {!locked && (
          <DialogClose render={<Button variant="outline" />}>
            {c.close}
          </DialogClose>
        )}
      </DialogFooter>
    </>
  );
}

/**
 * The group of ticks is the field an error summary link reaches: the ticks
 * themselves are labelled controls inside it, and the group is what the
 * officer has to answer.
 */
const SELECTION_FIELD = "caseload-selection";

/** The DOM id of one selectable item, so its own label can reach it. */
function selectionId(ref: string): string {
  return `caseload-item-${ref}`;
}

/** The staffing action Casework offers for reassigning one item, if any. */
function assignAction(item: CaseworkWorkItem) {
  return item.staffingActions?.find((action) => action.name === "assign");
}

/** What one item's reassignment came to, in the words the results list uses. */
function reassignResult(state: CommandState<unknown>): ReassignResult {
  if (state.state === "confirmed") return "reassigned";
  if (state.state !== "refused") return "unknown";
  const kind = state.refusal.kind;
  if (kind === "expired-reference") return "expired";
  if (kind === "stale" || kind === "held-elsewhere" || kind === "key-reused")
    return "conflict";
  return "refused";
}

/**
 * Reassigning the items a supervisor selected. Casework takes one command per
 * item, each from the item's own staffing action, and answers for each; an
 * item it offers no reassignment on is listed with the reason, not dropped.
 */
export function ReassignDialog({
  open,
  onOpenChange,
  items,
  finalFocus,
  onReassigned,
  renderError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CaseworkWorkItem[];
  finalFocus: FinalFocus;
  /** The items Casework confirmed reassigned, as each answer arrives. */
  onReassigned: (ids: string[]) => void;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const [unresolved, setUnresolved] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || !unresolved) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        finalFocus={finalFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="mb-0">
            {c.reassignTitle(items.length)}
          </DialogTitle>
        </DialogHeader>
        <ReassignBody
          items={items}
          onReassigned={onReassigned}
          onUnresolvedChange={setUnresolved}
          renderError={renderError}
        />
      </DialogContent>
    </Dialog>
  );
}

export function ReassignBody({
  items,
  onReassigned,
  onUnresolvedChange,
  renderError,
}: {
  items: readonly CaseworkWorkItem[];
  onReassigned: (ids: string[]) => void;
  onUnresolvedChange: (unresolved: boolean) => void;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const [announcement, announce] = useAnnouncement();
  // A target reference is issued for one queue, so one reassignment serves
  // one queue: the first queue an assignable item is in.
  const queue = items.find((item) => assignAction(item))?.queue;
  const movable = items.filter(
    (item) => assignAction(item) && item.queue === queue,
  );
  const targets = useStaffingTargets(
    queue ? { purpose: "assignment", queue, limit: "100" } : null,
  );
  const [targetRef, setTargetRef] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // One attempt per item, sharing the item's assignment form: an unresolved
  // assignment of an item, made here or there, locks both.
  const batch = useStaffingAssignments(movable.map((item) => item.id));
  const [answered, setAnswered] = useState(0);
  const results = useRef<HTMLElement>(null);
  useEffect(() => {
    if (answered) results.current?.focus();
  }, [answered]);
  useEffect(
    () => onUnresolvedChange(batch.locked),
    [onUnresolvedChange, batch.locked],
  );

  /** Reports what Casework confirmed and moves focus to the results. */
  async function report(
    answer: Promise<Record<string, CommandState<unknown>>>,
  ) {
    const settled = await answer;
    const moved = Object.entries(settled)
      .filter(([, state]) => state.state === "confirmed")
      .map(([id]) => id);
    if (moved.length) onReassigned(moved);
    setAnswered((count) => count + 1);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (batch.locked) return;
    if (!targetRef) {
      setErrors({ "reassign-target": c.requiredError });
      return;
    }
    setErrors({});
    void report(
      batch.run(
        movable.map((item) => ({
          target: item.id,
          input: {
            actionRef: assignAction(item)!.ref,
            targetRef,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
        })),
      ),
    );
  }

  const unmovable = items.filter((item) => !movable.includes(item));
  // Rows are listed once an item has an answer, or is being asked again.
  const answeredItems = movable.filter((item) => {
    const state = batch.stateOf(item.id).state;
    return state !== "idle" && state !== "sending";
  });
  const sent = movable.some((item) => batch.stateOf(item.id).state !== "idle");
  // Sending unmounts the form and the submit button that held focus. Taking
  // focus in the same commit keeps the dialog from reclaiming it for itself a
  // frame later, which an answer arriving sooner than that would lose to.
  useLayoutEffect(() => {
    if (sent) results.current?.focus();
  }, [sent]);
  const unresolvedIds = movable
    .map((item) => item.id)
    .filter((id) => commandUnresolved(batch.stateOf(id)));
  const stuckIds = unresolvedIds.filter((id) =>
    staffingWriteStuck(batch.stateOf(id)),
  );
  const retriable = unresolvedIds.filter((id) => !stuckIds.includes(id));
  return (
    <>
      <LiveAnnouncer message={announcement} />
      {movable.length > 0 && !sent && (
        <DialogDescription className="mb-0">
          {c.reassignDescription}
        </DialogDescription>
      )}
      {unmovable.length > 0 && (
        <div className="flex flex-col gap-1">
          {unmovable.map((item) => {
            const reference = caseworkReference(item, c);
            return (
              <p
                key={item.id}
                className="team-unmovable text-sm text-muted-foreground"
              >
                {assignAction(item)
                  ? c.otherQueue(reference, item.queueLabel)
                  : c.notReassignable(reference)}
              </p>
            );
          })}
        </div>
      )}
      {movable.length > 0 && !sent && (
        <form
          id="reassign-form"
          className="*:last:mb-0"
          noValidate
          onSubmit={submit}
        >
          <ErrorSummary errors={errors} />
          {targets.isPending ? (
            <Loading />
          ) : targets.error ? (
            renderError(targets.error, () => void targets.refetch())
          ) : (
            <>
              <TargetCombobox
                inline
                name="reassign-target"
                label={c.assignmentTarget}
                value={targetRef}
                onChange={setTargetRef}
                error={errors["reassign-target"]}
                targets={targets}
                announce={announce}
              />
              <InputField
                name="reassign-reason"
                label={c.reassignReason}
                value={reason}
                onChange={setReason}
                hint={c.assignmentReasonHint}
                required={false}
                multiline
              />
            </>
          )}
        </form>
      )}
      {sent && (
        <section className="team-results" tabIndex={-1} ref={results}>
          <h3 className="font-medium">{c.reassignResults}</h3>
          <ul className="list-disc ps-5">
            {answeredItems.map((item) => (
              <li key={item.id}>
                <CaseworkReference item={item} />:{" "}
                {c.reassignResultLabels[reassignResult(batch.stateOf(item.id))]}
              </li>
            ))}
          </ul>
        </section>
      )}
      {retriable.length > 0 ? (
        <UnknownWrite
          message={c.reassignUnknown}
          state={batch.stateOf(retriable[0]!)}
          busy={batch.busy}
          retry={() => void report(batch.retry())}
          dismiss={() => undefined}
        />
      ) : (
        stuckIds.length > 0 && (
          <UnknownWrite
            message={c.reassignUnknown}
            state={batch.stateOf(stuckIds[0]!)}
            retry={() => undefined}
            dismiss={() => {
              for (const id of stuckIds) batch.dismissUnknown(id);
            }}
          />
        )
      )}
      {!batch.locked && (
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {movable.length > 0 && !sent ? c.cancel : c.close}
          </DialogClose>
          {movable.length > 0 && !sent && !targets.error && (
            <Button type="submit" form="reassign-form">
              {c.reassignSubmit(movable.length)}
            </Button>
          )}
        </DialogFooter>
      )}
    </>
  );
}
