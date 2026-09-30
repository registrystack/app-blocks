import { CaseworkSetup } from "@/blocks/casework/setup";
import { ErrorPanel } from "@/blocks/shell/error-panel";

/** The administrator's one-time bootstrap of a team, its people and its queue. */
export function CaseworkSetupPage() {
  return (
    <CaseworkSetup
      renderError={(error, retry) => <ErrorPanel error={error} retry={retry} />}
    />
  );
}
