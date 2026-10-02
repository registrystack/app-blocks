import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  workItemStateKeys,
  type CaseworkActionReference,
  type CaseworkWorkItem,
  type EntityModel,
  type FieldModel,
  type RecordView,
} from "@registrystack/app-runtime";
import {
  useAttachmentHref,
  useCaseworkItem,
  useRecord,
  useWorkItemCommand,
  useWorkItemRefresh,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBlockContent } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { Notice } from "@/blocks/lib/notice";
import { useOpenedFrom } from "@/blocks/lib/list-memory";
import { FieldValue } from "@/blocks/fields/field-value";
import { BackLink } from "@/blocks/shell/back-link";
import { Loading } from "@/blocks/shell/loading";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { StatusBadge } from "@/blocks/shell/status-badge";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/shell/live-announcer";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { CaseworkReference, CaseworkWhen } from "@/blocks/casework/shared";
import { useShortcut } from "@/blocks/casework/shortcuts";
import { CaseworkTaskGrants } from "@/blocks/casework/task-grants";
import {
  ApplyPanel,
  CaseHistory,
  ItemRail,
  PrivateNotes,
  WorkItemOutcome,
} from "@/blocks/casework/item";
import { CaseworkAssignmentForm } from "@/blocks/pages/casework-staffing";
import { usePagesContent } from "@/blocks/pages/pages-content";
import { useItemPageContent } from "@/blocks/pages/casework-item-content";
import {
  ChangeTable,
  writtenChangeRows,
  writtenFields,
  type ChangeRow,
} from "@/blocks/request/request-changes";
import type { UploadOutcome } from "@/blocks/request/attachment-slots";
import {
  SupportingDocuments,
  type RemovalOutcome,
} from "@/blocks/pages/record-attachments";
import { DocumentPreview } from "@/blocks/documents/document-preview";
import { useDocumentSelection } from "@/blocks/documents/document-selection";
import type { DocumentSource } from "@/blocks/documents/document-view";
import {
  fieldOf,
  readableTarget,
  recordPath,
  useRegister,
  workItemEntities,
  type RegisterEntities,
} from "@/blocks/pages/record";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";

/**
 * One casework item: a sticky object header naming the item, where it stands
 * and what can be done with it, a wide column for what is proposed and why,
 * and a rail of the read-only facts that explain why the officer has it.
 * Claim and release hold the item; they are not decisions and never produce a
 * decision receipt. The heading, the state sentence, the applied wording and
 * the attachment upload and removal commands name a register-specific effect
 * and come from the caller; everything else reads generic Casework wording.
 */

/**
 * Whether the applicant's return flagged a field. Casework names a field as
 * the request's contract does, so either its id or its wire name matches.
 */
function isFlagged(
  flaggedFields: string[] | undefined,
  ...fields: FieldModel[]
): boolean {
  return fields.some(
    (field) =>
      flaggedFields?.includes(field.id) ||
      flaggedFields?.includes(field.apiName),
  );
}

/**
 * The comparison rows for one request, one for each field it writes, current
 * values taken from the live target record. A field the applicant's return
 * flagged is named as it was flagged, in the row label itself: ChangeTable
 * has no other hook to mark a row.
 */
function changeRows(
  entities: RegisterEntities,
  request: EntityModel,
  view: RecordView,
  target: RecordView | undefined,
  currentUnavailable: string,
  flagged: string,
  flaggedFields: string[] | undefined,
): ChangeRow[] {
  return writtenChangeRows(
    writtenFields({ record: entities.record, request }, request.fields),
    view,
    target,
    currentUnavailable,
    ({ field, target: targetField }) =>
      `${targetField.label}${isFlagged(flaggedFields, field, targetField) ? ` (${flagged})` : ""}`,
  );
}

/**
 * What the applicant gave beside the change: the request's own fields it does
 * not write, in the order its sections name them. Free text is quoted as the
 * applicant wrote it; any other answer is read with its label.
 */
function AskedFields({
  request,
  view,
  written,
  flagged,
  flaggedFields,
}: {
  request: EntityModel;
  view: RecordView;
  written: readonly string[];
  flagged: string;
  flaggedFields: string[] | undefined;
}) {
  return (
    <>
      {request.sections
        .flatMap((section) => section.fields)
        .map((id) => {
          const field = fieldOf(request, id);
          const value = view.values[id];
          if (
            !field ||
            written.includes(id) ||
            value === undefined ||
            value === null
          )
            return null;
          const isFieldFlagged = isFlagged(flaggedFields, field);
          return field.widget === "textarea" ? (
            <Fragment key={id}>
              <blockquote>
                <p>
                  <FieldValue field={field} value={value} />
                </p>
              </blockquote>
              {isFieldFlagged && <p className="muted">{flagged}</p>}
            </Fragment>
          ) : (
            <p key={id} className="reference">
              {field.label}: <FieldValue field={field} value={value} />
              {isFieldFlagged && ` (${flagged})`}
            </p>
          );
        })}
    </>
  );
}

/** A session model with no request entity has no request for an item to show. */
const noRequestEntity = new Error("The session model names no request entity.");

/**
 * What is proposed, why the applicant asked for it, and the officer's own
 * working, in the reading column; the facts and the trail beside it, where
 * they are scanned rather than scrolled past.
 */
function CaseSummary({
  sourceRequestId,
  flaggedFields,
  work,
  children,
  announce,
  useUpload,
  useRemoval,
  openPdf,
}: {
  sourceRequestId: string;
  flaggedFields: string[] | undefined;
  work: CaseworkWorkItem;
  children: ReactNode;
  announce: (message: string) => void;
  useUpload: (entity: string, id: string, slot: string) => UploadOutcome;
  useRemoval: (entity: string, id: string, slot: string) => RemovalOutcome;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const block = useBlockContent();
  const pages = usePagesContent();
  const casework = useCaseworkContent();
  const itemPage = useItemPageContent();
  const routes = useRegisterRoutes();
  const attachmentHref = useAttachmentHref();
  const register = useRegister();
  const entities = register.data
    ? workItemEntities(register.data.entities, work.sourceEntity)
    : null;
  const requestEntity = entities?.request;
  // The item names its request's entity and id; the session model describes that entity.
  const request = useRecord(
    requestEntity?.id ?? "",
    requestEntity ? sourceRequestId : "",
  );
  const target = useRecord(
    entities?.record.id ?? "",
    entities ? readableTarget(entities, request.data?.request) : "",
  );
  const failure =
    register.error ??
    request.error ??
    target.error ??
    (register.data && !requestEntity ? noRequestEntity : null);
  const loading =
    register.isPending ||
    request.isLoading ||
    (!!request.data && target.isLoading);
  const selection = useDocumentSelection(
    request.error ? undefined : request.data?.attachments,
  );
  const selected = selection.slot;
  const targetId = request.data?.request?.target?.id;
  const targetPath =
    entities && targetId
      ? recordPath(routes, entities, entities.record.id, targetId)
      : null;
  function useSlotUpload(slot: string): UploadOutcome {
    return useUpload(request.data!.entity, request.data!.id, slot);
  }
  function useSlotRemoval(slot: string): RemovalOutcome {
    return useRemoval(request.data!.entity, request.data!.id, slot);
  }
  return (
    <div className={`item-layout${selected ? " with-document" : ""}`}>
      <div className="item-body">
        {work.returned && (
          <Notice tone="info">
            <p>
              <strong>{casework.caseworkReturned}</strong>
            </p>
            {work.returned.reason && (
              <blockquote>
                <p>{work.returned.reason}</p>
              </blockquote>
            )}
          </Notice>
        )}
        <section>
          <h2>{block.proposedHeading}</h2>
          {failure ? (
            <ErrorPanel
              error={failure}
              retry={() => {
                void register.refetch();
                void request.refetch();
                void target.refetch();
              }}
            />
          ) : loading || !request.data || !entities || !requestEntity ? (
            <Loading />
          ) : (
            <ChangeTable
              rows={changeRows(
                entities,
                requestEntity,
                request.data,
                target.data,
                block.currentUnavailable,
                itemPage.flagged,
                flaggedFields,
              )}
            >
              {targetPath && (
                <Button
                  render={<a href={`#${targetPath}`} />}
                  variant="outline"
                >
                  {pages.viewRecordLink}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Button>
              )}
            </ChangeTable>
          )}
        </section>
        {!failure && (
          <section>
            <h2>{itemPage.whyAsked}</h2>
            {loading || !request.data || !entities || !requestEntity ? (
              <Loading />
            ) : (
              <AskedFields
                request={requestEntity}
                view={request.data}
                written={writtenFields(
                  { record: entities.record, request: requestEntity },
                  requestEntity.fields,
                ).map((item) => item.field.id)}
                flagged={itemPage.flagged}
                flaggedFields={flaggedFields}
              />
            )}
          </section>
        )}
        {!request.error && request.data && (
          <SupportingDocuments
            record={{
              entity: request.data.entity,
              id: request.data.id,
              revision: request.data.revision,
            }}
            slots={request.data.attachments}
            readOnly
            onPreview={selection.select}
            useUpload={useSlotUpload}
            useRemoval={useSlotRemoval}
          />
        )}
        {children}
      </div>
      {selected?.file && request.data && (
        <div className="item-document-column">
          <DocumentPreview
            key={`${sourceRequestId}:${selected.slot}:${selected.file.sha256}`}
            href={attachmentHref(
              request.data.entity,
              sourceRequestId,
              selected.slot,
            )}
            file={selected.file}
            label={
              pages.attachmentSlots[selected.slot] ??
              pages.attachmentSlotFallback
            }
            onClose={selection.close}
            openPdf={openPdf}
          />
        </div>
      )}
      <div className="item-side">
        <ItemRail item={work} announce={announce} />
        <CaseHistory
          id={work.id}
          announce={announce}
          heading={itemPage.historyHeading}
          emptyMessage={itemPage.historyEmpty}
          renderError={(error, retry) => (
            <ErrorPanel error={error} retry={retry} />
          )}
        />
      </div>
    </div>
  );
}

export function CaseworkItemPage({
  id,
  heading,
  appliedMessage,
  applyUnconfirmedMessage,
  stateSentence,
  useUpload,
  useRemoval,
  openPdf,
}: {
  id: string;
  /** The task this item asks of the officer; names a register-specific field. */
  heading: (work: CaseworkWorkItem) => string;
  /** Shown once a confirmed write applied the pending change. */
  appliedMessage: string;
  /** Shown when an apply could not be confirmed. */
  applyUnconfirmedMessage: string;
  /**
   * The item's state as a notice, in the one sentence kept for it, or none.
   * Asked for each of the item's `workItemStateKeys` in turn, most specific
   * first, until one has a sentence.
   */
  stateSentence: (state: string) => string | undefined;
  useUpload: (entity: string, id: string, slot: string) => UploadOutcome;
  useRemoval: (entity: string, id: string, slot: string) => RemovalOutcome;
  openPdf?: (
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ) => Promise<DocumentSource>;
}) {
  const block = useBlockContent();
  const pages = usePagesContent();
  const casework = useCaseworkContent();
  const itemPage = useItemPageContent();
  const item = useCaseworkItem(id);
  const [announcement, announce] = useAnnouncement();
  const [decideOpen, setDecideOpen] = useState(false);
  const command = useWorkItemCommand(id);
  const [sent, setSent] = useState<string>();
  const [assignOpen, setAssignOpen] = useState(false);
  // The item, its history, and the request and the record it changes; an
  // apply changes the record.
  const refresh = useWorkItemRefresh(id, item);
  const [list] = useOpenedFrom();
  const work = item.data;
  // A write the service could not confirm, or an attempt Casework still holds
  // on the item, locks every other write on it until it settles.
  const recoveryActive = command.locked || Boolean(work?.liveAttempt);
  // An unconfirmed attempt restored from an earlier page names its operation in
  // its marker; it is kept once read, so the outcome still names it once settled.
  const { restoredOperation } = command;
  useEffect(() => {
    if (restoredOperation) setSent(restoredOperation);
  }, [restoredOperation]);
  const operation = restoredOperation ?? sent;
  useShortcut(
    { key: "d", label: pages.decideHeading },
    () => setDecideOpen(true),
    Boolean(work?.actions.some((action) => action.name === "apply")) &&
      !recoveryActive,
  );
  useShortcut(
    { key: "a", label: itemPage.assign },
    () => setAssignOpen(true),
    Boolean(work?.staffingActions?.length) && !recoveryActive,
  );
  if (item.isPending) return <Loading />;
  if (item.error || !work)
    return <ErrorPanel error={item.error} retry={() => void item.refetch()} />;
  const send = async (action: CaseworkActionReference) => {
    setSent(action.name);
    const next = await command.run(work, action);
    if (next.state === "confirmed" && action.name === "apply")
      announce(appliedMessage);
  };
  const claimAction = work.actions.find((action) => action.name === "claim");
  const releaseAction = work.actions.find(
    (action) => action.name === "release",
  );
  const applyAction = work.actions.find((action) => action.name === "apply");
  const decideVisible = !recoveryActive && Boolean(applyAction);
  const stateKeys = workItemStateKeys(work);
  // The Casework word stands as the served one, so the shell's own word for
  // the state, the app's included, still comes first.
  const caseworkWord = stateKeys
    .map((key) => casework.stateLabels[key])
    .find((words) => words !== undefined);
  const notice = stateKeys
    .map((key) => stateSentence(key))
    .find((words) => words !== undefined);
  const heldPhrase = work.heldByMe
    ? itemPage.heldByYou
    : work.holder
      ? fill(itemPage.heldByOther, { holder: work.holder })
      : casework.unclaimed;
  const listIndex = list ? list.ids.indexOf(work.id) : -1;
  const known = listIndex !== -1;
  const prevId = known && listIndex > 0 ? list!.ids[listIndex - 1] : null;
  const nextId =
    known && listIndex < list!.ids.length - 1 ? list!.ids[listIndex + 1] : null;
  /** BReg's own action labels win where Casework shares a name with BReg
   * (approve, reject, apply); claim and release fall to the casework
   * wording, and the server's own label is the last resort. */
  const actionLabel = (action: CaseworkActionReference): string => {
    const labels: Record<string, string> = {
      claim: itemPage.takeItem,
      release: itemPage.releaseItem,
    };
    return (
      (pages.actionLabels as Record<string, string>)[action.name] ??
      labels[action.name] ??
      action.label
    );
  };
  return (
    <div className="item-page">
      <LiveAnnouncer message={announcement} />
      <header className="item-header">
        <div className="item-header-bar">
          <div className="item-header-crumb">
            <BackLink href={list?.path ?? "/casework"}>
              {list?.label ?? itemPage.defaultListLabel}
            </BackLink>
            {known && (
              <span>
                {" "}
                ·{" "}
                {fill(itemPage.positionInList, {
                  index: listIndex + 1,
                  count: list!.ids.length,
                })}
              </span>
            )}
            <span>
              {" "}
              · <CaseworkReference item={work} />
            </span>
          </div>
          <h1>{heading(work)}</h1>
          <p className="item-header-state">
            <StatusBadge
              state={work.state}
              labelKeys={stateKeys}
              served={caseworkWord}
            />{" "}
            · {casework.due}: <CaseworkWhen value={work.dueAt} tense="due" /> ·{" "}
            {heldPhrase}
          </p>
          {list && (
            <div className="item-header-pager">
              {prevId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  render={<a href={`#/casework/${prevId}`} />}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  {itemPage.prevItem}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="sm" aria-disabled="true">
                        <ChevronLeft size={16} aria-hidden="true" />
                        {itemPage.prevItem}
                      </Button>
                    }
                  />
                  <TooltipContent>{itemPage.noPrevItem}</TooltipContent>
                </Tooltip>
              )}
              {nextId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  render={<a href={`#/casework/${nextId}`} />}
                >
                  {itemPage.nextItem}
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="sm" aria-disabled="true">
                        {itemPage.nextItem}
                        <ChevronRight size={16} aria-hidden="true" />
                      </Button>
                    }
                  />
                  <TooltipContent>{itemPage.noNextItem}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
          <div className="item-header-actions">
            {releaseAction && !recoveryActive && (
              <Button
                variant="outline"
                onClick={() => void send(releaseAction)}
              >
                {itemPage.releaseItem}
              </Button>
            )}
            {!recoveryActive && Boolean(work.staffingActions?.length) && (
              <Popover
                open={assignOpen}
                onOpenChange={(next, details) => {
                  // A non-modal popover treats focus leaving its content as a
                  // request to close, but the officer is meant to be able to
                  // read or expand facts on the page behind it (history
                  // details, the rail) while this panel stays open. Only an
                  // explicit trigger press, Escape, or its own Cancel should
                  // close it.
                  if (
                    !next &&
                    (details.reason === "focus-out" ||
                      details.reason === "outside-press")
                  ) {
                    details.cancel();
                    return;
                  }
                  setAssignOpen(next);
                }}
              >
                <PopoverTrigger render={<Button variant="outline" />}>
                  {itemPage.assign}
                  <ChevronDown size={16} aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent
                  aria-label={itemPage.assign}
                  className="w-96"
                  keepMounted
                >
                  <CaseworkAssignmentForm
                    item={work}
                    actions={work.staffingActions ?? []}
                    active={assignOpen}
                  />
                </PopoverContent>
              </Popover>
            )}
            {decideVisible && (
              <Popover
                open={decideOpen}
                onOpenChange={(next, details) => {
                  // See the Assign popover above: focus moving to the page
                  // behind this panel (e.g. expanding a history entry)
                  // must not close it.
                  if (
                    !next &&
                    (details.reason === "focus-out" ||
                      details.reason === "outside-press")
                  ) {
                    details.cancel();
                    return;
                  }
                  setDecideOpen(next);
                }}
              >
                <PopoverTrigger render={<Button />}>
                  {pages.decideHeading}
                  <ChevronDown size={16} aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent
                  aria-label={pages.decideHeading}
                  className="w-96"
                  keepMounted
                >
                  <ApplyPanel
                    actionLabel={actionLabel(applyAction!)}
                    description={pages.confirmApply}
                    sending={command.locked}
                    onConfirm={() => {
                      setDecideOpen(false);
                      void send(applyAction!);
                    }}
                    onCancel={() => setDecideOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            )}
            {claimAction && !recoveryActive && (
              <Button onClick={() => void send(claimAction)}>
                {itemPage.takeItem}
              </Button>
            )}
          </div>
        </div>
      </header>
      {notice && <p className="item-state-notice">{notice}</p>}
      <WorkItemOutcome
        command={command}
        operation={operation}
        reread={() => void refresh()}
        appliedMessage={appliedMessage}
        applyUnconfirmedMessage={applyUnconfirmedMessage}
      />
      {work.liveAttempt && !command.locked && (
        <Notice tone="warning">
          <p>{itemPage.liveAttempt}</p>
          <div className="actions">
            <Button variant="outline" onClick={() => void refresh()}>
              {casework.caseworkReadItemAgain}
            </Button>
          </div>
        </Notice>
      )}
      <CaseSummary
        key={work.id}
        sourceRequestId={work.sourceRequestId}
        flaggedFields={work.returned?.flaggedFields}
        work={work}
        announce={announce}
        useUpload={useUpload}
        useRemoval={useRemoval}
        openPdf={openPdf}
      >
        <CaseworkTaskGrants
          key={`tasks-${work.id}`}
          id={work.id}
          revision={work.revision}
          blocked={recoveryActive}
        />
        {work.heldByMe && (
          <PrivateNotes
            key={work.id}
            id={work.id}
            blocked={recoveryActive}
            afterWrite={() => item.refetch()}
            renderError={(error, retry) => (
              <ErrorPanel error={error} retry={retry} />
            )}
          />
        )}
      </CaseSummary>
    </div>
  );
}
