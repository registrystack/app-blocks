import { useLocale } from "@/blocks/lib/content";
import { fillNodes } from "@/blocks/lib/format";
import { Notice } from "@/blocks/lib/notice";
import { useShellContent } from "@/blocks/shell/shell-content";

/** Reads the sign-in redirect's own query string; nothing renders without one. */
export function LoginFailure() {
  const c = useShellContent();
  const locale = useLocale();
  const params = new URLSearchParams(location.search);
  const code = params.get("loginError");
  if (!code) return null;
  const reference = params.get("reference");
  return (
    <Notice tone="warning" title={c.loginFailureTitle}>
      <p>
        {code === "unmapped"
          ? c.loginUnmapped
          : code === "expired"
            ? c.loginExpired
            : code === "access"
              ? c.loginAccess
              : c.loginUnavailable}
      </p>
      {reference && /^[a-zA-Z0-9_-]{1,128}$/.test(reference) && (
        <p className="reference">
          {fillNodes(
            c.receiptLine,
            {
              label: c.receipt,
              value: <span className="font-mono">{reference}</span>,
            },
            locale,
          )}
        </p>
      )}
    </Notice>
  );
}
