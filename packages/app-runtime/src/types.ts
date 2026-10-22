export interface AuthenticatedSession {
  authenticated: true;
  scope: string;
  /** Absent when the identity provider releases no name for the person. */
  displayName?: string;
  /** Server-enforced expiry, as Unix milliseconds. Informational; never extends authority. */
  expiresAt?: number;
  /** The id of the role the host configured for this session. */
  role: string;
  /**
   * The id of the app the role signs in to, as the host configuration names it
   * (the id the sign-in route takes). Always set by the host.
   */
  app?: string;
  /** Whether the role is bound to the person's own records, as the host configured it. */
  holder: boolean;
  /**
   * Whether the services grant this session the decision on requests: the
   * Casework staff profile, or without a Casework profile the BReg profile that
   * holds the apply of an approved request. Never a function of the role id.
   */
  decidesRequests: boolean;
  caseworkProfile?: "staff" | "supervisor" | "administrator";
  /** Opaque display discriminator. Casework remains authoritative for recovery. */
  caseworkRecoveryContext?: string;
  csrfToken: string;
  contractRevision?: string;
  capabilities: {
    verifiedPrefill?: boolean;
  };
}
export type CaseworkProfile = "staff" | "supervisor" | "administrator";
export const CASEWORK_PROBLEM_STATUSES = Object.freeze({
  "absence.cover-cycle": 422,
  "absence.invalid-period": 422,
  "absence.overlap": 422,
  "absence.self-cover": 422,
  "authentication.refused": 401,
  "clock.recompute-preview-expired": 410,
  "cursor.expired": 410,
  "cursor.invalid": 400,
  "idempotency.expired": 410,
  "idempotency.key-reused": 409,
  "operation.not-authorized": 403,
  "precondition.failed": 412,
  "precondition.required": 428,
  "profile.not-authorized": 403,
  "profile.not-human": 403,
  "request.body-too-large": 413,
  "request.invalid": 400,
  "request.limit-out-of-range": 400,
  "request.method-not-allowed": 405,
  "request.not-found": 404,
  "request.unprocessable": 422,
  "request.unsupported-media-type": 415,
  "review.distinct-approver-required": 403,
  "review.initiator-excluded": 403,
  "review.initiator-required": 422,
  "review.policy-mismatch": 409,
  "review.query-too-broad": 422,
  "review.result-expired": 410,
  "review.submission-conflict": 409,
  "review.task-not-held": 409,
  "runtime.failure": 500,
  "service.unavailable": 503,
  "source-profile.not-applicable": 400,
  "source-profile.required": 400,
  "source.bad-gateway": 502,
  "source.version-mismatch": 502,
  "source.version-unavailable": 502,
} as const);
export type CaseworkProblemCode = keyof typeof CASEWORK_PROBLEM_STATUSES;
export const CASEWORK_PROBLEM_CODES = Object.freeze(
  Object.keys(CASEWORK_PROBLEM_STATUSES) as CaseworkProblemCode[],
);
export function isCaseworkProblemCode(
  code: string,
): code is CaseworkProblemCode {
  return Object.hasOwn(CASEWORK_PROBLEM_STATUSES, code);
}
export function caseworkProblemStatus(code: CaseworkProblemCode): number {
  return CASEWORK_PROBLEM_STATUSES[code];
}
/**
 * A person as Casework identifies them. `displayName` is filled by the host
 * when the Casework directory carries one; until then screens show the subject.
 */
export interface CaseworkPrincipal {
  issuer: string;
  subject: string;
  displayName?: string;
}
export type CaseworkPageStatus =
  "complete" | "budget_exhausted" | "source_unavailable";
/** Queues and teams an administrator can see before creating a team. */
export interface CaseworkDirectory {
  queues: { id: string; label: string }[];
  teams: CaseworkTeam[];
}
export interface CaseworkTeam {
  id: string;
  staff: string[];
  supervisors: string[];
  queues: string[];
}
export interface CaseworkSetupInput {
  teamId: string;
  staffSubjects: string[];
  supervisorSubject: string;
  queueId: string;
}
export type Session =
  AuthenticatedSession | { authenticated: false; loginUrl: string };
/** One governed attachment slot on a request, as this session may see it. */
export interface AttachmentSlot {
  /** The registry's slot identifier, a URL-safe token. */
  slot: string;
  required: boolean;
  maximumBytes: number;
  contentTypes: string[];
  file: AttachmentFile | null;
  /** Present when this session may place a file in the slot, carried back as the upload's action reference. */
  uploadRef?: string;
  /** Present when this session may empty the slot, carried back in a removeAttachment task. */
  removeRef?: string;
}
/** The file in a slot. The host never names it: the bytes download under the slot's name. */
export interface AttachmentFile {
  contentType: string;
  byteSize: number;
  /** Lowercase hex SHA-256 of the bytes, so a browser can recognise its own upload after an unknown outcome. */
  sha256: string;
  uploadedAt: string | null;
  /**
   * available: this session may download it now. pending: waiting for
   * verification. rejected: refused by verification. erased: removed by
   * retention. Only an available file has bytes to download.
   */
  status: "available" | "pending" | "rejected" | "erased";
}
/**
 * BReg's view of a change request's review: submission to the review authority,
 * the result, its delivery back, application and recovery. States are BReg's own.
 */
export interface ChangeRequestReview {
  submission: { state: string; requestId?: string };
  result: {
    state: string;
    completedAt?: string;
    /** What the reviewer wrote for the requester with the decision, the one reviewer text BReg serves. */
    publicReason?: string;
  };
  delivery: { state: string };
  application: { mode: string; state: string; attempts?: number };
  recovery: { state: string; code?: string };
}
export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}
/** The browser receives only display-safe provenance, never the signed artifact or token. */
export interface VerifiedEvidenceDisplay {
  sourceValue: boolean;
  sourceLabel: string;
  verifiedAt: string;
  expiresAt: string;
  status: "verified" | "unverified";
  changedAfterVerification: boolean;
}
export interface VerifiedPrefill {
  evidenceRef: string;
  field: string;
  value: boolean;
  sourceLabel: string;
  verifiedAt: string;
  expiresAt: string;
}
export interface HostProblem {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  supportReference?: string;
  /** The message is the registry's own wording of a refused write, so page copy. */
  worded?: true;
}
