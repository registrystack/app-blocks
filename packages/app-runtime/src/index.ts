export * from "./casework-task-types.js";
export * from "./review-types.js";
export * from "./review-result.js";
export * from "./review-subject.js";
export * from "./model.js";
export * from "./schema-fields.js";
import type {
  RecordPage,
  RecordQuery,
  RecordSubmission,
  RecordTaskResult,
  RecordView,
  RegistryModel,
} from "./model.js";
import type {
  CaseworkTaskPreviewList,
  CaseworkTaskGrantList,
  CaseworkTaskGrant,
  CaseworkTaskApprovalResult,
  CaseworkTaskDispatchResult,
} from "./casework-task-types.js";
import type {
  ReviewAccountability,
  ReviewAssignmentCommand,
  ReviewClock,
  ReviewCommandResult,
  ReviewDecisionCommand,
  ReviewDraft,
  ReviewDraftCommand,
  ReviewDraftResult,
  ReviewHistoryEntry,
  ReviewHistoryPage,
  ReviewHoldOperation,
  ReviewNoteCommand,
  ReviewQueueFilters,
  ReviewReadBack,
  ReviewTaskDetail,
  ReviewTaskPage,
  ReviewWrite,
  RequesterReviewNotes,
} from "./review-types.js";
export * from "./types.js";
export * from "./casework-staffing-types.js";
import type {
  CaseworkStaffingTargetQuery,
  CaseworkStaffingTargetPage,
  CaseworkStaffingAbsenceList,
  CaseworkStaffingCreateAbsence,
  CaseworkStaffingUpdateAbsence,
  CaseworkStaffingDeleteAbsence,
  CaseworkStaffingAbsenceResult,
  CaseworkStaffingAssignCommand,
  CaseworkStaffingAssignResult,
  CaseworkStaffingCaseloadPreviewInput,
  CaseworkStaffingCaseloadPreviewPage,
  CaseworkStaffingApplyCaseload,
  CaseworkStaffingApplyResult,
} from "./casework-staffing-types.js";
import type {
  Session,
  VerifiedPrefill,
  HostProblem,
  CaseworkWorkItem,
  CaseworkWorkItemPage,
  CaseworkItemFilters,
  CaseworkDirectory,
  CaseworkDraft,
  CaseworkHistoryPage,
  CaseworkHoldings,
  CaseworkSetupInput,
  CaseworkCommand,
  CaseworkCommandResult,
} from "./types.js";

export { HostError, UnknownOutcome } from "./errors.js";
import { HostError, UnknownOutcome } from "./errors.js";
export * from "./commands.js";
export * from "./problems.js";
export * from "./prefill.js";
export * from "./record-recovery.js";
export * from "./document.js";
export interface HostClientOptions {
  mount?: string;
  fetch?: typeof fetch;
  onSessionExpired?: () => void;
}
function recordAttachmentPath(entity: string, id: string, slot: string) {
  return `/entities/${encodeURIComponent(entity)}/records/${encodeURIComponent(id)}/attachments/${encodeURIComponent(slot)}`;
}

export class HostClient {
  readonly mount: string;
  private readonly transport: typeof fetch;
  private csrfToken = "";
  private readonly pending = new Map<string, RecordSubmission>();
  constructor(private readonly options: HostClientOptions = {}) {
    this.mount = options.mount ?? "/api";
    if (
      !this.mount.startsWith("/") ||
      this.mount.startsWith("//") ||
      this.mount.includes("?") ||
      this.mount.includes("#")
    )
      throw new Error("Use a same-origin absolute app-host mount.");
    this.transport = options.fetch ?? globalThis.fetch.bind(globalThis);
  }
  setSession(session: Session) {
    this.csrfToken = session.authenticated ? session.csrfToken : "";
  }
  clear() {
    this.pending.clear();
    this.csrfToken = "";
  }
  private async request<T>(
    path: string,
    init: RequestInit = {},
    attemptId?: string,
    timeout = 30_000,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.transport(`${this.mount}${path}`, {
        ...init,
        credentials: "same-origin",
        signal: AbortSignal.timeout(timeout),
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.method && init.method !== "GET"
            ? { "X-CSRF-Token": this.csrfToken }
            : {}),
          ...init.headers,
        },
      });
    } catch {
      if (attemptId) throw new UnknownOutcome(attemptId);
      throw new HostError(0, {
        code: "service.unavailable",
        message: "The service is unavailable. Try again.",
      });
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (attemptId) throw new UnknownOutcome(attemptId);
      throw new HostError(response.status, {
        code: "response.invalid",
        message: "The service returned an unreadable response. Try again.",
      });
    }
    if (!response.ok) {
      // An intermediary may emit JSON after the registry committed a write.
      // Without an explicit pre-dispatch refusal contract, 5xx is uncertain.
      if (attemptId && response.status >= 500)
        throw new UnknownOutcome(attemptId);
      if (response.status === 401) {
        this.clear();
        this.options.onSessionExpired?.();
      }
      const body = data as Partial<HostProblem>;
      throw new HostError(response.status, {
        code: body.code ?? "service.unavailable",
        message: body.message ?? "The service could not complete this request.",
        fieldErrors: body.fieldErrors,
        supportReference: body.supportReference,
      });
    }
    return data as T;
  }
  session() {
    return this.request<Session>("/session");
  }
  /** The session's registry model, labelled in the language nearest `lang`. */
  model(lang?: string) {
    return this.request<RegistryModel>(`/model${query({ lang })}`);
  }
  /** One page of an entity's records the session may read. */
  records(entity: string, filter: RecordQuery = {}) {
    const values: { [key: string]: string | undefined } = {};
    for (const [id, value] of Object.entries(filter.filters ?? {}))
      values[`f.${id}`] = value;
    return this.request<RecordPage>(
      `/entities/${encodeURIComponent(entity)}/records${query({
        ...values,
        state: filter.state,
        target: filter.target,
        size: filter.size === undefined ? undefined : String(filter.size),
        cursor: filter.cursor,
      })}`,
    );
  }
  /** One record with the actions the session may take on it. */
  record(entity: string, id: string, lang?: string) {
    return this.request<RecordView>(
      `/entities/${encodeURIComponent(entity)}/records/${encodeURIComponent(id)}${query({ lang })}`,
    );
  }
  /**
   * The notes a reviewer left for the person who submitted this request. The
   * host takes the review from the record, so the browser names only the record.
   */
  requesterReviewNotes(entity: string, id: string) {
    return this.request<RequesterReviewNotes>(
      `/entities/${encodeURIComponent(entity)}/records/${encodeURIComponent(id)}/review-notes`,
    );
  }
  async logout() {
    await this.request<unknown>("/logout", { method: "POST" });
    this.clear();
  }
  /** An opaque target-bound action and idempotency attempt are the complete browser input. */
  prefill(actionRef: string, attemptId: string) {
    return this.request<VerifiedPrefill>(
      "/evidence/prefill",
      {
        method: "POST",
        body: JSON.stringify({ actionRef, attemptId }),
      },
      attemptId,
    );
  }
  /** A same-origin link to an available document on any entity's record. */
  recordAttachmentUrl(entity: string, id: string, slot: string) {
    return `${this.mount}${recordAttachmentPath(entity, id, slot)}`;
  }
  /**
   * Places one file in a slot of any entity's record. The attempt ID is the
   * registry's idempotency key, so an unknown outcome is retried with the same
   * one and the same file.
   */
  uploadRecordAttachment(
    entity: string,
    id: string,
    slot: string,
    uploadRef: string,
    file: Blob,
    attemptId: string = crypto.randomUUID(),
  ) {
    return this.sendFile<RecordTaskResult>(
      recordAttachmentPath(entity, id, slot),
      uploadRef,
      file,
      attemptId,
    );
  }
  private sendFile<R>(
    path: string,
    uploadRef: string,
    file: Blob,
    attemptId: string,
  ) {
    return this.request<R>(
      path,
      {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Action-Ref": uploadRef,
          "X-Attempt-Id": attemptId,
        },
      },
      attemptId,
      // A file of the registry's largest size needs longer than an answer.
      120_000,
    );
  }
  staffingTargets(filters: CaseworkStaffingTargetQuery) {
    return this.request<CaseworkStaffingTargetPage>(
      `/casework/staffing/targets${query({ ...filters })}`,
    );
  }
  staffingAbsences() {
    return this.request<CaseworkStaffingAbsenceList>(
      "/casework/staffing/absences",
    );
  }
  staffingCreateAbsence(command: CaseworkStaffingCreateAbsence) {
    return this.request<CaseworkStaffingAbsenceResult>(
      "/casework/staffing/absences/create",
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  staffingUpdateAbsence(command: CaseworkStaffingUpdateAbsence) {
    return this.request<CaseworkStaffingAbsenceResult>(
      "/casework/staffing/absences/update",
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  staffingDeleteAbsence(command: CaseworkStaffingDeleteAbsence) {
    return this.request<CaseworkStaffingAbsenceResult>(
      "/casework/staffing/absences/delete",
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  staffingAssign(command: CaseworkStaffingAssignCommand) {
    return this.request<CaseworkStaffingAssignResult>(
      "/casework/staffing/assign",
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  staffingPreviewCaseload(input: CaseworkStaffingCaseloadPreviewInput) {
    return this.request<CaseworkStaffingCaseloadPreviewPage>(
      "/casework/staffing/caseload/preview",
      { method: "POST", body: JSON.stringify(input) },
    );
  }
  staffingApplyCaseload(command: CaseworkStaffingApplyCaseload) {
    return this.request<CaseworkStaffingApplyResult>(
      "/casework/staffing/caseload/apply",
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  caseworkItems(filters: CaseworkItemFilters = {}) {
    return this.request<CaseworkWorkItemPage>(
      `/casework/items${query({ ...filters })}`,
    );
  }
  nextCaseworkItem(filters: { queue?: string } = {}) {
    return this.request<CaseworkWorkItem | null>(
      `/casework/items/next${query(filters)}`,
    );
  }
  caseworkItem(id: string) {
    return this.request<CaseworkWorkItem>(
      `/casework/items/${encodeURIComponent(id)}`,
    );
  }
  caseworkTaskPreviews(id: string) {
    return this.request<CaseworkTaskPreviewList>(
      `/casework/items/${encodeURIComponent(id)}/task-templates`,
    );
  }
  caseworkTaskGrants(id: string) {
    return this.request<CaseworkTaskGrantList>(
      `/casework/items/${encodeURIComponent(id)}/task-grants`,
    );
  }
  approveCaseworkTask(id: string, approvalRef: string, attemptId: string) {
    return this.request<CaseworkTaskApprovalResult>(
      `/casework/items/${encodeURIComponent(id)}/task-grants`,
      { method: "POST", body: JSON.stringify({ approvalRef, attemptId }) },
      attemptId,
    );
  }
  revokeCaseworkTask(id: string, grant: string) {
    return this.request<{ id: string; invalidated: boolean }>(
      `/casework/items/${encodeURIComponent(id)}/task-grants/${encodeURIComponent(grant)}/revoke`,
      { method: "POST" },
    );
  }
  dispatchCaseworkTask(id: string, grant: string) {
    return this.request<CaseworkTaskDispatchResult>(
      `/casework/items/${encodeURIComponent(id)}/task-grants/${encodeURIComponent(grant)}/dispatch`,
      { method: "POST", body: "{}" },
    );
  }
  caseworkDraft(id: string) {
    return this.request<CaseworkDraft>(
      `/casework/items/${encodeURIComponent(id)}/draft`,
    );
  }
  saveCaseworkDraft(
    id: string,
    draft: Pick<CaseworkDraft, "itemRevision" | "text">,
  ) {
    return this.request<CaseworkDraft>(
      `/casework/items/${encodeURIComponent(id)}/draft`,
      { method: "POST", body: JSON.stringify(draft) },
    );
  }
  deleteCaseworkDraft(id: string, itemRevision: string) {
    return this.request<{ deleted: true; itemRevision: string }>(
      `/casework/items/${encodeURIComponent(id)}/draft/delete`,
      { method: "POST", body: JSON.stringify({ itemRevision }) },
    );
  }
  caseworkCommand(
    id: string,
    command: CaseworkCommand,
    attemptId: string = crypto.randomUUID(),
  ) {
    return this.request<CaseworkCommandResult>(
      `/casework/items/${encodeURIComponent(id)}/actions`,
      { method: "POST", body: JSON.stringify({ ...command, attemptId }) },
      attemptId,
    );
  }
  caseworkHistory(id: string, cursor?: string, limit = 25) {
    return this.request<CaseworkHistoryPage>(
      `/casework/items/${encodeURIComponent(id)}/history${query({ cursor, limit: String(limit) })}`,
    );
  }
  caseworkHoldings(cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request<CaseworkHoldings>(`/casework/holdings${query}`);
  }
  caseworkDirectory() {
    return this.request<CaseworkDirectory>("/casework/directory");
  }
  setupCasework(input: CaseworkSetupInput) {
    return this.request<{ configured: true }>("/casework/setup", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  reviewQueue(filters: ReviewQueueFilters = {}) {
    return this.request<ReviewTaskPage>(
      `/casework/reviews${query({ ...filters })}`,
    );
  }
  reviewTask(taskId: string) {
    return this.request<ReviewTaskDetail>(
      `/casework/reviews/${encodeURIComponent(taskId)}`,
    );
  }
  /** Claim or release; the body is the attempt and the revision, nothing else. */
  holdReviewTask(
    taskId: string,
    operation: ReviewHoldOperation,
    command: ReviewWrite,
  ) {
    return this.request<ReviewCommandResult>(
      `/casework/reviews/${encodeURIComponent(taskId)}/${operation}`,
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  decideReviewTask(taskId: string, command: ReviewDecisionCommand) {
    return this.request<ReviewCommandResult>(
      `/casework/reviews/${encodeURIComponent(taskId)}/decide`,
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  /** The task after an unconfirmed decision, and whether the decision is this officer's. */
  reviewReadBack(taskId: string) {
    return this.request<ReviewReadBack>(
      `/casework/reviews/${encodeURIComponent(taskId)}/readback`,
    );
  }
  reviewDraft(taskId: string) {
    return this.request<{ draft: ReviewDraft | null }>(
      `/casework/reviews/${encodeURIComponent(taskId)}/draft`,
    );
  }
  saveReviewDraft(taskId: string, command: ReviewDraftCommand) {
    return this.request<ReviewDraftResult>(
      `/casework/reviews/${encodeURIComponent(taskId)}/draft`,
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  deleteReviewDraft(taskId: string, command: ReviewWrite) {
    return this.request<ReviewDraftResult>(
      `/casework/reviews/${encodeURIComponent(taskId)}/draft/delete`,
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  assignReviewTask(taskId: string, command: ReviewAssignmentCommand) {
    return this.request<ReviewCommandResult>(
      `/casework/reviews/${encodeURIComponent(taskId)}/assign`,
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  reviewHistory(requestId: string, cursor?: string, limit = 25) {
    return this.request<ReviewHistoryPage>(
      `/casework/review-requests/${encodeURIComponent(requestId)}/history${query({ cursor, limit: String(limit) })}`,
    );
  }
  addReviewNote(requestId: string, command: ReviewNoteCommand) {
    return this.request<
      | { outcome: "confirmed"; entry: ReviewHistoryEntry }
      | { outcome: "unknown"; attemptId: string; supportReference: string }
    >(
      `/casework/review-requests/${encodeURIComponent(requestId)}/notes`,
      { method: "POST", body: JSON.stringify(command) },
      command.attemptId,
    );
  }
  reviewClocks(requestId: string) {
    return this.request<{ items: ReviewClock[] }>(
      `/casework/review-requests/${encodeURIComponent(requestId)}/clocks`,
    );
  }
  /** Casework answers supervisors of the task's queue team only. */
  reviewAccountability(eventId: string) {
    return this.request<ReviewAccountability>(
      `/casework/review-events/${encodeURIComponent(eventId)}/accountability`,
    );
  }
  reviewTaskPreviews(taskId: string) {
    return this.request<CaseworkTaskPreviewList>(
      `/casework/reviews/${encodeURIComponent(taskId)}/task-templates`,
    );
  }
  reviewTaskGrants(taskId: string) {
    return this.request<CaseworkTaskGrantList>(
      `/casework/reviews/${encodeURIComponent(taskId)}/task-grants`,
    );
  }
  approveReviewTask(taskId: string, approvalRef: string, attemptId: string) {
    return this.request<CaseworkTaskApprovalResult>(
      `/casework/reviews/${encodeURIComponent(taskId)}/task-grants`,
      { method: "POST", body: JSON.stringify({ approvalRef, attemptId }) },
      attemptId,
    );
  }
  revokeReviewTask(taskId: string, grant: string) {
    return this.request<{ id: string; invalidated: boolean }>(
      `/casework/reviews/${encodeURIComponent(taskId)}/task-grants/${encodeURIComponent(grant)}/revoke`,
      { method: "POST", body: "{}" },
    );
  }
  dispatchReviewTask(taskId: string, grant: string) {
    return this.request<CaseworkTaskDispatchResult>(
      `/casework/reviews/${encodeURIComponent(taskId)}/task-grants/${encodeURIComponent(grant)}/dispatch`,
      { method: "POST", body: "{}" },
    );
  }
  submit(submission: RecordSubmission): Promise<RecordTaskResult> {
    return this.send(submission);
  }
  private async send(submission: RecordSubmission): Promise<RecordTaskResult> {
    // Retain the complete original submission; callers cannot mutate its retry body.
    const immutable = JSON.parse(
      JSON.stringify(submission),
    ) as RecordSubmission;
    const existing = this.pending.get(submission.attemptId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(immutable))
      throw new HostError(409, {
        code: "attempt.conflict",
        message: "This submission reference is already in use.",
      });
    this.pending.set(submission.attemptId, immutable);
    const result = await this.request<RecordTaskResult>(
      "/tasks",
      { method: "POST", body: JSON.stringify(immutable) },
      submission.attemptId,
    );
    if (result.outcome === "confirmed")
      this.pending.delete(submission.attemptId);
    return result;
  }
  /** Resends a submission under its attempt; its result names the record's entity. */
  async retry<R extends RecordTaskResult = RecordTaskResult>(
    attemptId: string,
  ): Promise<R> {
    const original = this.pending.get(attemptId);
    const result = original
      ? ((await this.send(original)) as R)
      : await this.request<R>(
          `/commands/${encodeURIComponent(attemptId)}/retry`,
          { method: "POST" },
          attemptId,
        );
    if (result.outcome === "confirmed") this.pending.delete(attemptId);
    return result;
  }
  /** Resends a host-retained command: the same attempt id, the same upstream call. */
  retryCommand<R>(attemptId: string) {
    return this.request<R>(
      `/commands/${encodeURIComponent(attemptId)}/retry`,
      { method: "POST" },
      attemptId,
    );
  }
  attempt<R extends RecordTaskResult = RecordTaskResult>(attemptId: string) {
    return this.request<R>(`/commands/${encodeURIComponent(attemptId)}`);
  }
}
function query(values: { [key: string]: string | undefined }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value) params.set(key, value);
  return params.size ? `?${params}` : "";
}
/** Calendar dates are not instants: never apply the browser time zone. */
export function displayDate(
  value: string | null | undefined,
  locale = "en-GB",
): string {
  if (!value) return "Not recorded";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
