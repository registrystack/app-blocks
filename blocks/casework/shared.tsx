import { useEffect, useRef, type ReactNode } from "react";
import {
  refusalDetail,
  type CaseworkPrincipal,
  type CommandState,
  type Refusal,
} from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { cn } from "@/blocks/lib/utils";
import { fill, relativeDays, relativeSpan } from "@/blocks/lib/format";
import { useBlockContent } from "@/blocks/lib/content";
import { useCaseworkContent, type CaseworkContent } from "@/blocks/casework/casework-content";

/**
 * Parts every Casework block shares: state chips, warnings, a loading
 * marker, date and waiting-time wording, and how a person or a reference
 * prints. A block owns only what it alone renders.
 */

const unknownStatusCodes = new Set<string>();
/**
 * A work item's or a review task's state, as a small coloured chip, worded by
 * the first of `labelKeys` the content labels (a work item's come from
 * `workItemStateKeys`), or by the state alone.
 */
export function Badge({
  state,
  labelKeys = [state],
}: {
  state: string;
  labelKeys?: readonly string[];
}) {
  const c = useCaseworkContent();
  const label = labelKeys
    .map((key) => c.stateLabels[key])
    .find((words) => words !== undefined);
  if (label === undefined && !unknownStatusCodes.has(state)) {
    unknownStatusCodes.add(state);
    console.warn(`No content label for status "${state}"; using the fallback.`);
  }
  return (
    <span className={`badge badge-${state.replace(/[^a-z-]/g, "")}`}>
      {label ?? c.unknownStatus}
    </span>
  );
}

/** A warning, a success or an informational aside, read out when it warns. */
export function Notice({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return (
    <div
      className={`notice notice-${tone}`}
      role={tone === "warning" ? "alert" : "status"}
    >
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}

/** Shown while a block waits on data it cannot yet render. */
export function Loading() {
  const c = useBlockContent();
  return (
    <div className="loading" role="status">
      <span className="loading-dot" />
      {c.loading}
    </div>
  );
}

/** Full local date and time with the zone named, never a bare UTC instant. */
export function caseworkDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
      }).format(date);
}
/** The device time zone, named as the officer's own calendar names it. */
export function caseworkLocalZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
/** An instant as the value a `datetime-local` control takes, in local time. */
export function caseworkLocalInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/**
 * A local date and time as the instant Casework stores. A `datetime-local`
 * value carries no offset, so it is read in the officer's own zone, which is
 * the zone the hint beside the control names.
 */
export function caseworkLocalInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (
    !Number.isFinite(date.valueOf()) ||
    caseworkLocalInput(date.toISOString()) !== value
  )
    return null;
  return date.toISOString();
}
/**
 * The relative form that sits beside a full date: "today", "yesterday",
 * "in 3 days", "2 days ago". Null when the value is not a date.
 */
export function caseworkRelative(
  value: string,
  content: CaseworkContent,
  now = new Date(),
): string | null {
  const days = relativeDays(value, now);
  if (days === null) return null;
  if (days === 0) return content.relativeToday;
  if (days === 1) return content.relativeYesterday;
  if (days === -1) return content.relativeTomorrow;
  return days > 0
    ? fill(content.relativeDaysAgo, { days })
    : fill(content.relativeInDays, { days: -days });
}
/** A full date with its relative form beside it, as one phrase. */
export function caseworkWhenPhrase(
  value: string,
  content: CaseworkContent,
): string {
  const relative = caseworkRelative(value, content);
  const when = caseworkDateTime(value);
  return relative
    ? fill(content.caseworkHistoryWhen, { when, relative })
    : when;
}
/**
 * A moment as a list reads it: how late or how soon for a due date, how long
 * ago for something that happened. Lateness is a tone the cell colours; the
 * absolute instant belongs on hover and in the rail.
 */
export function caseworkWhen(
  value: string,
  tense: "due" | "since",
  content: CaseworkContent,
  now = new Date(),
): { text: string; tone: "late" | "today" | null } | null {
  const span = relativeSpan(value, now);
  if (!span) return null;
  const days = relativeDays(value, now) ?? 0;
  if (tense === "due" || span.value < 0) {
    if (days > 0)
      return {
        text: fill(content.whenLate, { days }),
        tone: tense === "due" ? "late" : null,
      };
    if (days === 0)
      return {
        text: content.whenToday,
        tone: tense === "due" ? "today" : null,
      };
    if (days === -1) return { text: content.whenTomorrow, tone: null };
    return { text: fill(content.whenInDays, { days: -days }), tone: null };
  }
  if (span.unit === "minute")
    return {
      text:
        span.value < 1
          ? content.whenJustNow
          : fill(content.whenMinutesAgo, { minutes: span.value }),
      tone: null,
    };
  if (span.unit === "hour")
    return {
      text: fill(content.whenHoursAgo, { hours: span.value }),
      tone: null,
    };
  if (days === 1) return { text: content.whenYesterday, tone: null };
  return { text: fill(content.whenDaysAgo, { days }), tone: null };
}
/** The relative reading of a moment, with the absolute instant on hover. */
export function CaseworkWhen({
  value,
  tense,
  className,
  now,
}: {
  value: string | null | undefined;
  tense: "due" | "since";
  className?: string;
  /** Fixes "now" for a deterministic reading in tests. */
  now?: Date;
}) {
  const c = useCaseworkContent();
  const when = value ? caseworkWhen(value, tense, c, now) : null;
  if (!value || !when)
    return <span className={cn("muted", className)}>{c.noDueDate}</span>;
  return (
    <time
      dateTime={value}
      title={caseworkDateTime(value)}
      className={cn(
        "casework-when",
        when.tone && `casework-when-${when.tone}`,
        className,
      )}
    >
      {when.text}
    </time>
  );
}
/**
 * A colleague's name as a dense table prints it: initial and family name,
 * so a column of holders stays one line wide. A single name, or an account
 * with no name, prints as it is.
 */
export function caseworkShortName(
  person: Pick<CaseworkPrincipal, "subject" | "displayName">,
) {
  const name = caseworkPerson(person);
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || !person.displayName?.trim()) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}
/**
 * How long the item has been waiting, from when Casework first saw it: in
 * minutes within the hour, hours within the day and calendar days beyond, so
 * the morning's work reads apart from the last minute's.
 */
export function caseworkWaiting(
  value: string,
  content: CaseworkContent,
  now = new Date(),
): string {
  const span = relativeSpan(value, now);
  // A clock running ahead of this device has not made the item wait.
  if (!span || span.value < 1) return content.waitingJustNow;
  if (span.unit === "minute")
    return fill(
      span.value === 1 ? content.waitingOneMinute : content.waitingMinutes,
      { minutes: span.value },
    );
  if (span.unit === "hour")
    return fill(
      span.value === 1 ? content.waitingOneHour : content.waitingHours,
      { hours: span.value },
    );
  return fill(span.value === 1 ? content.waitingOneDay : content.waitingDays, {
    days: span.value,
  });
}
/**
 * The human reference of the record the item concerns, never its UUID: the
 * reference Casework joined from the source request.
 */
export function caseworkReference(
  item: { reference?: string | null },
  content: CaseworkContent,
) {
  return item.reference?.trim() ? item.reference : content.unnamedRequest;
}
/** An item's reference on screen: its own reference in mono, the fallback name as prose. */
export function CaseworkReference({
  item,
}: {
  item: { reference?: string | null };
}) {
  const c = useCaseworkContent();
  const reference = caseworkReference(item, c);
  return item.reference?.trim() ? (
    <span className="font-mono">{reference}</span>
  ) : (
    reference
  );
}
/**
 * The readable end of an account identifier: `officer-2` for
 * `urn:app-kit:human:officer-2`, `p-17` for a URL ending in `/p-17`. Anything
 * that is not a URI, a bare identifier or a name, prints as it is.
 */
export function caseworkSubjectTail(subject: string) {
  if (!/^[a-z][a-z0-9+.-]*:\S+$/i.test(subject)) return subject;
  return subject.split(/[:/]/).filter(Boolean).pop() ?? subject;
}
/**
 * How a colleague is named on screen: the directory name when Casework has
 * one, else the readable end of their account.
 */
export function caseworkPerson(
  person: Pick<CaseworkPrincipal, "subject" | "displayName">,
) {
  return person.displayName?.trim()
    ? person.displayName
    : caseworkSubjectTail(person.subject);
}
/**
 * The whole account subject to print beside a colleague, so a name or a
 * shortened account can be traced to the account that acted. An account
 * already printed whole has none to repeat.
 */
export function caseworkPersonSubject(
  person: Pick<CaseworkPrincipal, "subject" | "displayName">,
) {
  return caseworkPerson(person) === person.subject ? null : person.subject;
}
/**
 * Who holds an item, as one phrase: the colleague Casework named, or the
 * account it authenticated, with the officer's own hold marked as theirs. An
 * item nobody holds says so, so the officer knows the hold is theirs to take.
 */
export function caseworkHolder(
  item: {
    heldByMe: boolean;
    holder?: string | null;
    holderPrincipal?: CaseworkPrincipal | null;
  },
  content: CaseworkContent,
) {
  const name = item.holderPrincipal
    ? caseworkPerson(item.holderPrincipal)
    : item.holder && caseworkSubjectTail(item.holder);
  if (!name) return content.unclaimed;
  return item.heldByMe ? `${name} (${content.you})` : name;
}
/**
 * A person as an officer reads them: the line naming them, with the account
 * Casework authenticated beneath it. A colleague Casework has no name for is
 * already read by their account and has none to repeat, so the account is
 * printed only beside a name.
 */
export function CaseworkPerson({
  person,
  name,
  subject,
}: {
  /** The colleague, when the screen holds the principal Casework sent. */
  person?: CaseworkPrincipal;
  /** The line an officer reads, when it is a sentence rather than the name. */
  name?: ReactNode;
  /** The account beside the name, when the screen holds it without a principal. */
  subject?: string | null;
}) {
  const line = name ?? (person ? caseworkPerson(person) : null);
  const account = subject ?? (person ? caseworkPersonSubject(person) : null);
  return (
    <span className="casework-person">
      <span>{line}</span>
      {account && <span className="casework-person-subject">{account}</span>}
    </span>
  );
}
export function CaseworkDue({
  dueAt,
  dueState,
  includeLabel = true,
}: {
  dueAt?: string | null;
  dueState?: string;
  includeLabel?: boolean;
}) {
  const c = useCaseworkContent();
  const relative = dueAt ? caseworkRelative(dueAt, c) : null;
  return (
    <div className="casework-due">
      <p className="muted">
        {dueAt ? (
          <>
            {includeLabel && `${c.due}: `}
            <time dateTime={dueAt}>{caseworkDateTime(dueAt)}</time>
            {relative && ` (${relative})`}
          </>
        ) : (
          c.noDueDate
        )}
      </p>
      {dueState && <Badge state={dueState} />}
    </div>
  );
}

/**
 * What a refusal means to the officer reading a review panel, in the panel's
 * own words for the one case the kind alone does not say: `notApplied`, read
 * when the task was already read back with nothing changed.
 */
export function caseworkRefusalText(
  content: CaseworkContent,
  refusal: Refusal,
  notApplied: string,
): string {
  const detail = refusalDetail(refusal);
  if (detail === "not-applied") return notApplied;
  // A review stage that excludes its initiator refuses the officer who
  // submitted the request; someone else can still take the task.
  if (detail === "initiator-excluded") return content.initiatorExcluded;
  switch (refusal.kind) {
    case "held-elsewhere":
      return content.heldElsewhere;
    case "stale":
      return content.changed;
    case "gone":
      return content.gone;
    case "not-authorized":
      return content.notAuthorized;
    case "key-reused":
      return content.keyReused;
    default:
      return refusal.message;
  }
}

/** The shape of a command a panel shows while its last attempt is unresolved. */
export interface UncertainCommand {
  state: CommandState<unknown>;
  retry(): Promise<unknown>;
  check?(): Promise<unknown>;
  dismissUnknown(): void;
}
/**
 * An attempt whose outcome is not known. Retry resends the same attempt;
 * nothing is resent without the officer asking. When a resend was refused in
 * a way that cannot settle it, the officer may stop waiting, which gives the
 * attempt up explicitly.
 */
export function Unconfirmed({
  command,
  text,
  retryLabel,
  replaceText,
  stopLabel,
  canRetry = true,
}: {
  command: UncertainCommand;
  text: string;
  retryLabel: string;
  replaceText?: string;
  stopLabel?: string;
  canRetry?: boolean;
}) {
  const c = useCaseworkContent();
  const state = command.state;
  if (state.state === "recovering") return <Notice>{c.checking}</Notice>;
  if (state.state !== "unknown") return null;
  if (state.withoutAuthority)
    return (
      <Notice tone="warning">
        <p>{c.withoutAuthority}</p>
        <Button variant="outline" onClick={command.dismissUnknown}>
          {c.stopWaiting}
        </Button>
      </Notice>
    );
  const refusal = state.lastRefusal;
  const forbidden = refusal?.kind === "not-authorized";
  return (
    <Notice tone="warning">
      <p>{replaceText ?? text}</p>
      {!replaceText && forbidden && <p>{c.retryForbidden}</p>}
      {!replaceText && refusal && !forbidden && refusal.message && (
        <p>{refusal.message}</p>
      )}
      <div className="actions">
        {canRetry && !replaceText && (
          <Button onClick={() => void command.retry()}>{retryLabel}</Button>
        )}
        {command.check && (
          <Button variant="outline" onClick={() => void command.check!()}>
            {c.check}
          </Button>
        )}
        {(refusal || replaceText || !canRetry) && (
          <Button variant="ghost" onClick={command.dismissUnknown}>
            {stopLabel ?? c.stopWaiting}
          </Button>
        )}
      </div>
    </Notice>
  );
}

/** A form's validation errors, linked to each field, focused when they first appear. */
export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const c = useCaseworkContent();
  const ref = useRef<HTMLDivElement>(null);
  const errorSignature = JSON.stringify(errors);
  useEffect(() => {
    if (Object.keys(errors).length) ref.current?.focus();
  }, [errorSignature]);
  if (!Object.keys(errors).length) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2>{c.validationTitle}</h2>
      <ul>
        {Object.entries(errors).map(([id, error]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.focus();
              }}
            >
              {error}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
