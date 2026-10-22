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
  AuthenticatedSession,
  CaseworkStaffingAbsence,
  CaseworkStaffingApplyResult,
  CaseworkStaffingCaseloadPreview,
  CaseworkPrincipal,
  CaseworkStaffingPrincipal,
  ReviewTask,
  ReviewTaskDetail,
} from "@registrystack/app-runtime";
import type { CommandState } from "@registrystack/app-runtime";
import {
  commandUnresolved,
  staffingWriteStuck,
  useAbsenceEnd,
  useAbsenceSave,
  useAuthority,
  useCaseloadMove,
  useCaseloadPreview,
  useRereadOnRefusal,
  useReviewTaskAssignment,
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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FieldFrame, InputField } from "@/blocks/fields/input-field";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/casework/announce";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import {
  CaseworkPerson,
  caseworkDateTime,
  caseworkLocalInput,
  caseworkLocalInstant,
  caseworkLocalZone,
  caseworkPerson,
  caseworkPersonSubject,
  ErrorSummary,
  Loading,
  Notice,
} from "@/blocks/casework/shared";

/**
 * The staffing surfaces: the caseload move a supervisor previews and confirms
 * on the Staffing page, the drawer and dialog that record or end absence
 * cover, and the form that hands one review task on to a colleague. Casework
 * decides who is eligible and what may move; these screens carry
 * presentation and wording only. A choice is sent back as the opaque
 * reference Casework issued, or, for a review task's assignment, as the
 * issuer and subject Casework named the colleague by; never as a name.
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

/** What Casework said about a colleague list, and the way to read more of it. */
function TargetListStatus({
  targets,
  announce,
}: {
  targets: Targets;
  announce?: (message: string) => void;
}) {
  const c = useCaseworkContent();
  const locale = useLocale();
  return (
    <>
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
              announce?.(fill(c.moreTargetsLoaded, { count }, locale));
            }}
          >
            {c.moreTargets}
          </Button>
        </div>
      )}
    </>
  );
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
  listStatus = true,
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
  /**
   * Says under the field what Casework said about its list, with the way to
   * read more of it. A form whose fields share one list says it once instead.
   */
  listStatus?: boolean;
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
      {listStatus && <TargetListStatus targets={targets} announce={announce} />}
    </div>
  );
}

/**
 * Moves focus to the panel that reports a write's outcome, so the officer
 * reads the answer where they are instead of hunting for it down the page.
 * Focus moves in the commit that shows the panel, and once more a frame
 * later if it was taken away: a form that unmounts with focus on its submit
 * button inside a drawer lets the drawer reclaim focus a frame after the
 * button left, which an answer arriving sooner than that would lose to.
 */
function useOutcomeFocus<T extends HTMLElement>(shown: boolean) {
  const panel = useRef<T>(null);
  useLayoutEffect(() => {
    const target = panel.current;
    if (!shown || !target) return;
    target.focus();
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== target) target.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [shown]);
  return panel;
}

/**
 * A staffing write Casework could not confirm. The same attempt is offered
 * again; a second attempt is never created from this notice. An attempt the
 * host can no longer resend is left for the officer to check, and can be put
 * away.
 */
function UnknownWrite({
  message,
  state,
  retry,
  dismiss,
}: {
  message: string;
  state: CommandState<unknown>;
  retry: () => void;
  dismiss: () => void;
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
        disabled={state.state === "recovering"}
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
  const locale = useLocale();
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
        {live > 0 && <p>{fill(c.pendingBody, { count: live }, locale)}</p>}
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

/** The ways one review task is handed on to a colleague. */
export type ReviewAssignmentOperation = "assign" | "delegate";

/**
 * The ways of handing a review task on to offer an officer: a supervisor
 * assigns it, the officer holding it delegates it, and a decided task goes
 * nowhere. An offer grants nothing; Casework checks every assignment again.
 */
export function reviewAssignmentOperations(
  task: Pick<ReviewTask, "status" | "heldByYou">,
  profile: AuthenticatedSession["caseworkProfile"],
): ReviewAssignmentOperation[] {
  if (task.status === "decided") return [];
  const operations: ReviewAssignmentOperation[] = [];
  if (profile === "supervisor") operations.push("assign");
  if (task.heldByYou) operations.push("delegate");
  return operations;
}

/**
 * The colleague chosen from a list, named as Casework names a person: by
 * issuer and subject. The reference the list keys them by is bound to this
 * session's read of the list, and is never sent.
 */
export function assignmentPrincipal(
  targets: readonly CaseworkStaffingPrincipal[],
  ref: string,
): { issuer: string; subject: string } | undefined {
  const target = ref ? targets.find((item) => item.ref === ref) : undefined;
  return target
    ? { issuer: target.principal.issuer, subject: target.principal.subject }
    : undefined;
}

/**
 * Hands one review task on to a colleague: a supervisor assigns it, the
 * officer holding it delegates it. The colleagues are read when the officer
 * opens the form. An attempt that has not settled keeps the form open and in
 * view, even once the task as read again offers nothing more to do.
 */
export function ReviewAssignmentForm({
  task,
  reread,
  rereading,
  renderError,
}: {
  task: ReviewTaskDetail;
  /** Reads the task again, after a refusal that says it moved on. */
  reread: () => void;
  /** Whether the task is being read again; nothing is sent until it is. */
  rereading: boolean;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const operations = reviewAssignmentOperations(
    task,
    useAuthority().caseworkProfile,
  );
  // An unresolved assignment of this task is restored wherever it is shown.
  const command = useReviewTaskAssignment(task.taskId);
  const state = command.state;
  useRereadOnRefusal(state, reread);
  const [opened, setOpened] = useState(false);
  const open =
    opened || (state.state !== "idle" && state.state !== "confirmed");
  const formShown = open && operations.length > 0;
  const targets = useStaffingTargets(
    formShown
      ? { purpose: "assignment", queue: task.queue, limit: "100" }
      : null,
  );
  const [announcement, announce] = useAnnouncement();
  const [chosen, setChosen] = useState<ReviewAssignmentOperation>();
  const operation =
    chosen && operations.includes(chosen) ? chosen : operations[0];
  const [targetRef, setTargetRef] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const confirmed = state.state === "confirmed";
  const assignmentOutcome = useOutcomeFocus<HTMLDivElement>(confirmed);

  if (!operations.length && state.state === "idle") return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (command.locked || rereading) return;
    const to = assignmentPrincipal(targets.items, targetRef);
    const next: Record<string, string> = {};
    if (!operation) next["staffing-action"] = c.requiredError;
    if (!to) next["staffing-target"] = c.requiredError;
    setErrors(next);
    if (!operation || !to) return;
    void command.assign(task, operation, to, reason.trim() || undefined);
  }

  return (
    <section className="staffing-assignment">
      {operations.length > 0 && (
        <Button
          variant="outline"
          aria-expanded={open}
          // While the outcome is unknown nothing here can hide it.
          disabled={command.locked}
          onClick={() => {
            if (!open) return setOpened(true);
            setOpened(false);
            command.dismiss();
          }}
        >
          {c.assignmentHeading}
        </Button>
      )}
      {formShown && (
        <>
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
                  value={operation ?? ""}
                  onChange={(value) => {
                    const next = operations.find((name) => name === value);
                    if (next) setChosen(next);
                  }}
                  error={errors["staffing-action"]}
                  options={operations.map((name) => ({
                    value: name,
                    label: c.actionLabels[name],
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
              {!command.locked && operation && (
                <Button type="submit" disabled={rereading}>
                  {c.actionLabels[operation]}
                </Button>
              )}
            </form>
          )}
        </>
      )}
      {state.state === "refused" && renderError(state.error)}
      {commandUnresolved(state) && (
        <UnknownWrite
          message={c.assignmentUnknown}
          state={state}
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

/** One way to move the review tasks a person holds, offered once their cover is saved. */
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
        side="inline-end"
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
  const locale = useLocale();
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
                {`${fill(c.caseloadTitle, { person: name!, queue: offer.queueLabel }, locale)}…`}
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
            {fill(c.zoneHint, { zone }, locale)}
          </p>
          {name && <p className="mb-3 text-sm">{fill(c.heldWork, { person: name }, locale)}</p>}
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
  const locale = useLocale();

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
          {fill(
            c.confirmEndAbsenceBody,
            {
              person: caseworkPerson(absence.person.principal),
              from: caseworkDateTime(absence.from, locale),
              until: caseworkDateTime(absence.until, locale),
            },
            locale,
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

/** A queue a caseload can move in, as Casework named it. */
export interface CaseloadQueue {
  queue: string;
  queueLabel: string;
}

/**
 * What the officer has chosen for one caseload move. The page holds it, so an
 * absence cover's move offer can start the form with the queue and the
 * person away; that person is matched to the reference Casework issues for
 * the queue, and nothing can be previewed until a reference is chosen.
 */
export interface CaseloadDraft {
  queue: string;
  fromRef: string;
  toRef: string;
  reason: string;
  /** The person away, when an absence cover's move offer started the form. */
  fromPrincipal?: CaseworkPrincipal;
}

export const emptyCaseloadDraft: CaseloadDraft = {
  queue: "",
  fromRef: "",
  toRef: "",
  reason: "",
};

/**
 * What a preview asks Casework for, or which fields stop it being asked. The
 * movement is named by Casework's own references and the reason alone, so a
 * name on screen never decides who is moved.
 */
export function caseloadPreviewRequest(
  value: Pick<CaseloadDraft, "queue" | "fromRef" | "toRef" | "reason">,
  required: string,
): { input?: CaseloadPreviewInput; errors: Record<string, string> } {
  const reason = value.reason.trim();
  const errors: Record<string, string> = {};
  if (!value.queue) errors["caseload-queue"] = required;
  if (!value.fromRef) errors["caseload-from-person"] = required;
  if (!value.toRef) errors["caseload-to-person"] = required;
  if (!reason) errors["caseload-reason"] = required;
  if (Object.keys(errors).length) return { errors };
  return {
    input: {
      queue: value.queue,
      fromRef: value.fromRef,
      toRef: value.toRef,
      reason,
    },
    errors,
  };
}

/**
 * Reads a move's answer. A confirmed move spends its preview, and a refused
 * one cannot be confirmed again, so both drop the preview and the officer
 * previews afresh; an unknown outcome keeps it while the same attempt is
 * retried. Answers with Casework's own count only once it confirmed the move.
 */
export async function settleCaseload(
  answer: Promise<CommandState<CaseworkStaffingApplyResult>>,
  reset: () => void,
): Promise<number | undefined> {
  const settled = await answer;
  if (settled.state === "confirmed" && settled.value.outcome === "confirmed") {
    reset();
    return settled.value.moved;
  }
  if (settled.state === "refused") reset();
  return undefined;
}

/** Confirms a preview by its reference alone: Casework moves exactly the set it fenced. */
export function applyCaseload(
  command: {
    run: (body: {
      previewRef: string;
    }) => Promise<CommandState<CaseworkStaffingApplyResult>>;
  },
  previewed: Pick<CaseworkStaffingCaseloadPreview, "previewRef">,
  reset: () => void,
): Promise<number | undefined> {
  return settleCaseload(
    command.run({ previewRef: previewed.previewRef }),
    reset,
  );
}

/**
 * Moving the review tasks one person holds in one queue to a colleague. The
 * officer chooses the queue, both people and a reason, and previews: Casework
 * answers how many review tasks would move and until when the preview holds.
 * Confirming sends that preview's reference alone, and the count moved is
 * shown only once Casework confirms it. The form is controlled, so the page
 * can start it from an absence cover's move offer.
 */
export function CaseloadMoveForm({
  queues,
  queuesPartial = false,
  value,
  onChange,
  renderError,
}: {
  queues: readonly CaseloadQueue[];
  /** Casework listed only part of what the queues were read from. */
  queuesPartial?: boolean;
  value: CaseloadDraft;
  onChange: (value: CaseloadDraft) => void;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  const blockWords = useBlockContent();
  const locale = useLocale();
  const [announcement, announce] = useAnnouncement();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const targets = useStaffingTargets(
    value.queue
      ? { purpose: "assignment", queue: value.queue, limit: "100" }
      : null,
  );
  const named = value.fromPrincipal;
  const fromRef =
    value.fromRef ||
    (named &&
      targets.items.find((target) => isSamePerson(target.principal, named))
        ?.ref) ||
    "";
  // One movement per queue and person at a time: an unresolved one is
  // restored whenever the same move is chosen again, even after a reload.
  const command = useCaseloadMove(
    value.queue && fromRef ? `${value.queue}/${fromRef}` : undefined,
  );
  const caseload = useCaseloadPreview();
  const { previewed } = caseload;
  const settled = command.state;
  const moved =
    settled.state === "confirmed" && settled.value.outcome === "confirmed"
      ? settled.value.moved
      : undefined;
  const previewPanel = useOutcomeFocus<HTMLDivElement>(previewed !== null);
  const movedPanel = useOutcomeFocus<HTMLDivElement>(moved !== undefined);

  function nameOf(ref: string) {
    const target = targets.items.find((each) => each.ref === ref);
    return target ? caseworkPerson(target.principal) : c.caseloadUnlisted;
  }

  // Any change makes the last preview and answer about a different move.
  function change(next: Partial<CaseloadDraft>) {
    onChange({ ...value, fromRef, ...next });
    caseload.reset();
    command.dismiss();
  }

  async function preview(event: FormEvent) {
    event.preventDefault();
    if (command.locked || caseload.pending) return;
    const request = caseloadPreviewRequest(
      { ...value, fromRef },
      c.requiredError,
    );
    setErrors(request.errors);
    if (!request.input) return;
    command.dismiss();
    await caseload.preview(request.input);
  }

  const refusal = settled.state === "refused" ? settled : undefined;
  return (
    <>
      <LiveAnnouncer message={announcement} />
      <ErrorSummary errors={errors} />
      <form noValidate onSubmit={(event) => void preview(event)}>
        {/* While a move's outcome is unknown nothing here can start another. */}
        <fieldset disabled={command.locked} className="min-w-0">
          <FieldFrame
            name="caseload-queue"
            label={c.caseloadQueue}
            error={errors["caseload-queue"]}
            required
          >
            <select
              id="caseload-queue"
              name="caseload-queue"
              value={value.queue}
              onChange={(event) =>
                change({
                  queue: event.target.value,
                  fromRef: "",
                  toRef: "",
                  fromPrincipal: undefined,
                })
              }
              aria-invalid={!!errors["caseload-queue"]}
              aria-describedby={
                errors["caseload-queue"] ? "caseload-queue-error" : undefined
              }
              required
            >
              <option value="">{blockWords.selectOption}</option>
              {queues.map((queue) => (
                <option key={queue.queue} value={queue.queue}>
                  {queue.queueLabel}
                </option>
              ))}
            </select>
            {queuesPartial && (
              <p className="staffing-status">{c.caseloadQueuesPartial}</p>
            )}
          </FieldFrame>
          {value.queue &&
            (targets.isPending ? (
              <Loading />
            ) : targets.error ? (
              renderError(targets.error, () => void targets.refetch())
            ) : (
              <>
                {named && targets.loaded && !fromRef && (
                  <p className="staffing-status">
                    {fill(c.caseloadNoMove, { person: caseworkPerson(named) }, locale)}
                  </p>
                )}
                <TargetCombobox
                  name="caseload-from-person"
                  label={c.moveFrom}
                  value={fromRef}
                  onChange={(ref) =>
                    change({
                      fromRef: ref,
                      fromPrincipal: undefined,
                      toRef: ref === value.toRef ? "" : value.toRef,
                    })
                  }
                  error={errors["caseload-from-person"]}
                  targets={targets}
                  listStatus={false}
                />
                <TargetCombobox
                  name="caseload-to-person"
                  label={c.moveTo}
                  value={value.toRef}
                  onChange={(ref) => change({ toRef: ref })}
                  error={errors["caseload-to-person"]}
                  targets={targets}
                  exclude={fromRef}
                  listStatus={false}
                />
                {/* Both people come from one colleague list, so what Casework
                    said about it, and the way to read more, show once. */}
                <TargetListStatus targets={targets} announce={announce} />
              </>
            ))}
          <InputField
            name="caseload-reason"
            label={c.movementReason}
            value={value.reason}
            onChange={(reason) => change({ reason })}
            error={errors["caseload-reason"]}
            multiline
          />
          <div className="actions">
            <Button type="submit" variant="outline" disabled={caseload.pending}>
              {c.previewCaseload}
            </Button>
          </div>
        </fieldset>
      </form>

      {caseload.failure !== undefined && renderError(caseload.failure)}
      {previewed && (
        <div className="staffing-preview" tabIndex={-1} ref={previewPanel}>
          {previewed.taskCount > 0 ? (
            <>
              <p>
                {fill(
                  c.caseloadPreviewSummary,
                  {
                    count: previewed.taskCount,
                    queue: previewed.queueLabel,
                    from: nameOf(fromRef),
                    to: nameOf(value.toRef),
                  },
                  locale,
                )}
              </p>
              <p className="staffing-status">
                {fill(
                  c.caseloadPreviewExpires,
                  { when: caseworkDateTime(previewed.expiresAt, locale) },
                  locale,
                )}
              </p>
              {!command.locked && (
                <div className="actions">
                  <Button
                    onClick={() =>
                      void applyCaseload(command, previewed, caseload.reset)
                    }
                  >
                    {fill(c.confirmCaseload, { count: previewed.taskCount }, locale)}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p>
              {fill(
                c.caseloadPreviewNothing,
                { from: nameOf(fromRef), queue: previewed.queueLabel },
                locale,
              )}
            </p>
          )}
        </div>
      )}
      {refusal &&
        (refusal.refusal.kind === "expired-reference" ? (
          <Notice tone="warning">{c.caseloadPreviewGone}</Notice>
        ) : (
          renderError(refusal.error)
        ))}
      {commandUnresolved(settled) && (
        <UnknownWrite
          message={c.caseloadUnknown}
          state={settled}
          retry={() => void settleCaseload(command.retry(), caseload.reset)}
          dismiss={command.dismissUnknown}
        />
      )}
      {moved !== undefined && (
        <div className="staffing-outcome" tabIndex={-1} ref={movedPanel}>
          <Notice tone="success">{fill(c.caseloadMoved, { count: moved }, locale)}</Notice>
        </div>
      )}
    </>
  );
}
