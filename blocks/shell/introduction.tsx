import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginFailure } from "@/blocks/shell/login-failure";
import { PageHeading } from "@/blocks/shell/page-heading";
import { PreviousSubmissionNotice } from "@/blocks/shell/previous-submission-notice";
import { PublicShell } from "@/blocks/shell/public";
import { useShellContent } from "@/blocks/shell/shell-content";

/** The public page a session sees before it signs in. */
export function Introduction({ audience }: { audience: "staff" | "service" }) {
  const c = useShellContent();
  return (
    <PublicShell audience={audience}>
      <LoginFailure />
      <PreviousSubmissionNotice />
      <PageHeading
        title={audience === "service" ? c.introduction : c.staffIntroduction}
        description={audience === "service" ? c.introBody : c.staffIntroBody}
      />
      <p>{c.introScope}</p>
      <section className="service-access" aria-label={c.signIn}>
        <p>{audience === "service" ? c.serviceAccess : c.staffAccess}</p>
        <Button render={<a href={`/auth/login?app=${audience}`} />} size="lg">
          {c.signIn}
          <ArrowRight size={18} />
        </Button>
      </section>
    </PublicShell>
  );
}
