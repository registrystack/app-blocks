import { ScrollRegion } from "@/blocks/lib/scroll-region";
import { useRef, useState } from "react";
import type {
  CaseworkPrincipal,
  CaseworkStaffingAbsence,
  CaseworkStaffingPrincipal,
} from "@registrystack/app-runtime";
import {
  useStaffingAbsences,
  useSupervisoryReviews,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { caseworkDateTime, caseworkPerson } from "@/blocks/casework/shared";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import {
  AbsenceDrawer as BlockAbsenceDrawer,
  CaseloadMoveForm,
  emptyCaseloadDraft,
  EndAbsenceDialog as BlockEndAbsenceDialog,
  isSamePerson,
  StaffingPendingNotice as BlockStaffingPendingNotice,
  useStaffingAbsenceCover,
  type CaseloadDraft,
  type CaseloadQueue,
  type MoveOffer,
} from "@/blocks/casework/staffing";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/shell/live-announcer";
import { Loading } from "@/blocks/shell/loading";
import { PageHeading } from "@/blocks/shell/page-heading";
import { useRoute } from "@/blocks/shell/routing";

export { isSamePerson, useStaffingAbsenceCover };
export type { MoveOffer };

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

/** The element a closing dialog hands focus to: the first of these still on the page. */
function focusBack(...selectors: string[]) {
  return () => {
    for (const selector of selectors) {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) return found;
    }
    return document.querySelector<HTMLElement>("h1");
  };
}

/** Which drawer or dialog the page has open, and the control it returns focus to. */
type StaffingDialog =
  | { kind: "absence"; absence?: CaseworkStaffingAbsence; returnId: string }
  | { kind: "end"; absence: CaseworkStaffingAbsence; returnId: string };

/**
 * The queues a caseload can move in: each queue a supervised review task
 * names, once, in the order Casework listed them.
 */
function queuesOf(
  items: readonly { queue: string; queueLabel: string }[],
): CaseloadQueue[] {
  const queues = new Map<string, string>();
  for (const item of items)
    if (item.queue && !queues.has(item.queue))
      queues.set(item.queue, item.queueLabel);
  return [...queues].map(([queue, queueLabel]) => ({ queue, queueLabel }));
}

/**
 * The supervisor's Staffing page: moving the review tasks one person holds in
 * a queue to a colleague, previewed and then confirmed as one move, and the
 * absence cover Casework staffs for the people this officer supervises. The
 * queues come from the review tasks the officer supervises, read a hundred at
 * most; Casework decides who may move what and refuses the rest, so a queue
 * offered here grants nothing. This page carries no register-specific wording.
 */
export function CaseworkStaffingPage() {
  const c = useCaseworkContent();
  const locale = useLocale();
  const supervised = useSupervisoryReviews({ limit: "100" });
  // Absence cover is offered only where Casework staffs it for this officer,
  // and the absence list is read only then.
  const coverAnswered = useStaffingAbsenceCover(true);
  const absences = useStaffingAbsences(coverAnswered);
  const [draft, setDraft] = useState<CaseloadDraft>(emptyCaseloadDraft);
  // A move started from an absence cover starts the form afresh, with no
  // preview or answer left over from a different move.
  const [formKey, setFormKey] = useState(0);
  const [dialog, setDialog] = useState<StaffingDialog & { key: number }>();
  const [open, setOpen] = useState(false);
  const serial = useRef(0);
  const movedToForm = useRef(false);
  const [announcement, announce] = useAnnouncement();

  function openDialog(next: StaffingDialog) {
    serial.current += 1;
    movedToForm.current = false;
    setDialog({ ...next, key: serial.current });
    setOpen(true);
  }

  const page = supervised.data;
  const queues = page ? queuesOf(page.items) : [];
  const queuesPartial = page
    ? Boolean(page.nextCursor) || page.status !== "complete"
    : false;
  const canRecord = coverAnswered && Boolean(absences.data);

  /** Moving the review tasks a person holds, offered once their cover is saved. */
  function moveOffers(principal: CaseworkPrincipal): MoveOffer[] {
    return queues.map((queue) => ({
      key: queue.queue,
      queueLabel: queue.queueLabel,
      open: () => {
        setDraft({
          ...emptyCaseloadDraft,
          queue: queue.queue,
          fromPrincipal: principal,
        });
        setFormKey((key) => key + 1);
        movedToForm.current = true;
        setOpen(false);
      },
    }));
  }

  const returnTo = dialog ? `#${CSS.escape(dialog.returnId)}` : "h1";
  const toForm = focusBack("#caseload-heading");
  const toOpener = focusBack(returnTo);
  const drawerFocus = () =>
    movedToForm.current ? toForm() : toOpener();

  return (
    <>
      <PageHeading
        title={c.staffingTitle}
        description={c.staffingDescription}
        action={
          canRecord ? (
            <Button
              id="staffing-record-absence"
              onClick={() =>
                openDialog({
                  kind: "absence",
                  returnId: "staffing-record-absence",
                })
              }
            >
              {c.recordAbsence}
            </Button>
          ) : undefined
        }
      />
      <LiveAnnouncer message={announcement} />

      <section className="staffing-caseload" aria-labelledby="caseload-heading">
        <h2 id="caseload-heading" tabIndex={-1}>
          {c.caseloadHeading}
        </h2>
        <p>{c.caseloadDescription}</p>
        {supervised.isPending ? (
          <Loading />
        ) : supervised.error || !page ? (
          <ErrorPanel
            error={supervised.error}
            retry={() => void supervised.refetch()}
          />
        ) : queues.length === 0 ? (
          <>
            <p className="staffing-status">{c.caseloadNoQueues}</p>
            {queuesPartial && (
              <p className="staffing-status">{c.caseloadQueuesPartial}</p>
            )}
          </>
        ) : (
          <CaseloadMoveForm
            key={formKey}
            queues={queues}
            queuesPartial={queuesPartial}
            value={draft}
            onChange={setDraft}
            renderError={(error, retry) => (
              <ErrorPanel error={error} retry={retry} />
            )}
          />
        )}
      </section>

      {coverAnswered && (
        <section
          className="staffing-absences"
          aria-labelledby="absences-heading"
        >
          <h2 id="absences-heading">{c.absencesHeading}</h2>
          {absences.error ? (
            <ErrorPanel
              error={absences.error}
              retry={() => void absences.refetch()}
            />
          ) : !absences.data ? (
            <Loading />
          ) : absences.data.items.length === 0 ? (
            <p className="staffing-status">{c.absencesEmpty}</p>
          ) : (
            <ScrollRegion
              className="table-wrap casework-reviews"
              label={c.absencesCaption}
            >
              <Table>
                <TableCaption>{c.absencesCaption}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{c.person}</TableHead>
                    <TableHead>{c.cover}</TableHead>
                    <TableHead>{c.from}</TableHead>
                    <TableHead>{c.until}</TableHead>
                    <TableHead>{c.actionsColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.data.items.map((absence) => {
                    const name = caseworkPerson(absence.person.principal);
                    const editId = `absence-edit-${absence.ref}`;
                    const endId = `absence-end-${absence.ref}`;
                    return (
                      <TableRow key={absence.ref}>
                        <TableCell>{name}</TableCell>
                        <TableCell>
                          {caseworkPerson(absence.cover.principal)}
                        </TableCell>
                        <TableCell>
                          {caseworkDateTime(absence.from, locale)}
                        </TableCell>
                        <TableCell>
                          {caseworkDateTime(absence.until, locale)}
                        </TableCell>
                        <TableCell>
                          <div className="staffing-absence-actions">
                            <Button
                              id={editId}
                              variant="outline"
                              size="sm"
                              aria-label={fill(c.editAbsenceOf, { person: name }, locale)}
                              onClick={() =>
                                openDialog({
                                  kind: "absence",
                                  absence,
                                  returnId: editId,
                                })
                              }
                            >
                              {c.editAbsence}
                            </Button>
                            <Button
                              id={endId}
                              variant="outline"
                              size="sm"
                              aria-label={fill(c.endAbsenceOf, { person: name }, locale)}
                              onClick={() =>
                                openDialog({
                                  kind: "end",
                                  absence,
                                  returnId: endId,
                                })
                              }
                            >
                              {c.confirmEndAbsence}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollRegion>
          )}
        </section>
      )}

      {dialog?.kind === "absence" && absences.data && (
        <AbsenceDrawer
          key={dialog.key}
          open={open}
          onOpenChange={setOpen}
          absence={dialog.absence}
          directoryRef={absences.data.directoryRef}
          finalFocus={drawerFocus}
          moveOffers={moveOffers}
        />
      )}
      {dialog?.kind === "end" && absences.data && (
        <EndAbsenceDialog
          key={dialog.key}
          open={open}
          onOpenChange={setOpen}
          absence={dialog.absence}
          directoryRef={absences.data.directoryRef}
          finalFocus={focusBack(returnTo)}
          onEnded={() => {
            announce(c.absenceEnded);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
