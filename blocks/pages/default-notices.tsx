import {
  usePendingUploads,
  useRecordRecovery,
  withReference,
  type RecoveryReference,
} from "@registrystack/app-runtime/react";
import {
  PendingUploadsNotice as RecordPendingUploadsNotice,
  type PendingUploadsState,
} from "@/blocks/pages/record-attachments";
import {
  RecoveryNotice as RecordRecoveryNotice,
  type RecoveryOutcome,
} from "@/blocks/pages/record";

function useRecovery(
  reference: RecoveryReference,
  options: {
    onSettled: () => void;
    open: (resource: { id: string; entity: string }) => void;
  },
): RecoveryOutcome {
  return withReference(useRecordRecovery(reference, options));
}

/**
 * The unresolved submission of this session that needs checking, over
 * `@/blocks/pages/record`'s own `RecoveryNotice` and app-runtime's recovery
 * command.
 */
export function RecoveryNotice() {
  return <RecordRecoveryNotice useRecovery={useRecovery} />;
}

/** This session's unresolved uploads, in the shape the block's notice reads. */
function usePending(): PendingUploadsState {
  const pending = usePendingUploads();
  return {
    orphaned: pending.orphaned,
    forgetOrphaned: pending.forgetOrphaned,
    live: pending.live.map(withReference),
  };
}

/**
 * Every unresolved upload of this session, for the notice of writes that need
 * checking. A previous session's upload is shown without its reference, which
 * that session took with it. The record or request that is open shows its own
 * uploads in their slots, so they are left out here; an upload from the first
 * marker version stays, since no slot claims it.
 */
export function PendingUploadsNotice() {
  return <RecordPendingUploadsNotice usePending={usePending} />;
}
