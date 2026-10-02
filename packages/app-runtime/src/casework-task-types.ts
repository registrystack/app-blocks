/** Current server-governed task authority. These types carry no bearer tokens. */
export type CaseworkTaskBounds =
  | { type: "evidence"; requirement: string }
  | {
      type: "breg";
      permissions: ReadonlyArray<{
        collection: string;
        operations: ReadonlyArray<string>;
      }>;
    }
  | {
      type: "scheduling";
      permissions: ReadonlyArray<{
        service: string;
        location: string;
        actions: ReadonlyArray<string>;
      }>;
    };
export interface CaseworkEvidenceRequesterContext {
  requesterTags: ReadonlyArray<string>;
  audience: string;
}
export interface CaseworkTaskGrant {
  id: string;
  templateId: string;
  templateVersion: string;
  agent: { issuer: string; subject: string };
  client: string;
  resource: string;
  scopes: ReadonlyArray<string>;
  evidenceContext?: CaseworkEvidenceRequesterContext;
  purpose: string;
  bounds: CaseworkTaskBounds;
  expiresAt: number;
  invalidated: boolean;
  dispatchable?: boolean;
}
export interface CaseworkTaskDispatchResult {
  grantId: string;
  status: "eligible" | "not-ready";
  note: string;
  expiresAt: number;
}
export interface CaseworkTaskPreview {
  approvalRef: string;
  label: string;
  agent: { issuer: string; subject: string };
  client: string;
  resource: string;
  scopes: ReadonlyArray<string>;
  evidenceContext?: CaseworkEvidenceRequesterContext;
  purpose: string;
  bounds: CaseworkTaskBounds;
  subjects: Record<string, string | number | boolean>;
  lifetimeSeconds: number;
}
export interface CaseworkTaskPreviewList {
  templates: CaseworkTaskPreview[];
}
export interface CaseworkTaskGrantList {
  grants: CaseworkTaskGrant[];
  /** Set, with no grants, when Casework refused this officer the item's tasks. */
  withheld?: true;
}
/** An approval is keyed by its attempt id, so an unconfirmed one is resent exactly. */
export type CaseworkTaskApprovalResult =
  | { outcome: "confirmed"; grant: CaseworkTaskGrant }
  | { outcome: "unknown"; attemptId: string; supportReference: string };
