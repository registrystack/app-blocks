import { PageHeading } from "@/blocks/shell/page-heading";
import { useShellContent } from "@/blocks/shell/shell-content";

export function HelpPage() {
  const c = useShellContent();
  return (
    <>
      <PageHeading title={c.helpTitle} />
      <section className="card prose">
        <p>{c.helpBody}</p>
        <h2>{c.receipt}</h2>
        <p>{c.helpReference}</p>
        <h2>{c.unknownTitle}</h2>
        <p>{c.helpRecovery}</p>
      </section>
    </>
  );
}
