import { useEffect, useId, useRef, useState } from "react";
import {
  problemView,
  type EntityModel,
  type LookupModel,
  type RecordView,
} from "@registrystack/app-runtime";
import { useRecord, useRecordLookup } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YesNoSelect } from "@/blocks/fields/input-field";
import { RecordFacts } from "@/blocks/record/record-summary";
import { useLocale } from "@/blocks/lib/content";
import { fill, inSentence, selectorNamedFor } from "@/blocks/lib/format";
import { ErrorPanel } from "@/blocks/shell/error-panel";
import { PageHeading } from "@/blocks/shell/page-heading";
import { navigate } from "@/blocks/shell/routing";
import { usePagesContent } from "@/blocks/pages/pages-content";

/**
 * The page of a records place whose entity the session may read but not
 * list: it finds one record from what the person already holds. Nothing here
 * enumerates records. A record the session cannot read, one outside its
 * boundary and one that does not exist read the same way, so the page never
 * says which of them an identifier was. A BReg lookup selector the session may
 * use gets a form of its own; its values go to the host in a request body.
 */
export function FindRecordPage({
  entity,
  recordRoute,
}: {
  entity: EntityModel;
  recordRoute: (id: string) => string;
}) {
  const pages = usePagesContent();
  const locale = useLocale();
  const selectors = entity.operations.lookup?.selectors ?? [];
  const lookupHeading =
    selectors[0] && selectorNamedFor(selectors[0], entity.label, locale);
  return (
    <>
      <PageHeading
        title={fill(
          pages.findRecordTitle,
          { records: inSentence(entity.pluralLabel, locale) },
          locale,
        )}
        description={pages.findRecordDescription}
      />
      {selectors.map((selector) => (
        <LookupForm
          key={selector.id}
          entity={entity}
          selector={selector}
          disclosed={entity.operations.lookup!.disclosed}
          recordRoute={recordRoute}
        />
      ))}
      {entity.operations.get && (
        <OpenById
          entity={entity}
          recordRoute={recordRoute}
          lookupHeading={lookupHeading}
        />
      )}
    </>
  );
}

/**
 * One lookup selector as a form. A match opens the record page where the
 * session may read the record, and otherwise shows the fields the lookup
 * discloses. A refusal, an out-of-boundary record and a non-match all read as
 * the one no-match answer. An answer shows only beside the values it answers:
 * the fields hold still while a lookup is pending, and a change clears it. A
 * lookup that answers after the person left the page changes nothing.
 */
function LookupForm({
  entity,
  selector,
  disclosed,
  recordRoute,
}: {
  entity: EntityModel;
  selector: LookupModel["selectors"][number];
  disclosed: string[];
  recordRoute: (id: string) => string;
}) {
  const pages = usePagesContent();
  const locale = useLocale();
  const formId = useId();
  const { lookup, pending, error } = useRecordLookup(entity.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<"none" | RecordView>("none");
  const [edited, setEdited] = useState(false);
  const shown = useRef(true);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);
  async function submit() {
    setEdited(false);
    const found = await lookup(selector.id, values);
    if (!shown.current) return;
    if (found && entity.operations.get) navigate(recordRoute(found.id));
    else setOutcome(found ?? "none");
  }
  return (
    <section aria-labelledby={`${formId}-heading`}>
      <h2 id={`${formId}-heading`}>
        {selectorNamedFor(selector, entity.label, locale)}
      </h2>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {selector.fields.map((field) => {
          const id = `${formId}-${field.id}`;
          const value = values[field.id] ?? "";
          const change = (typed: string) => {
            setValues({ ...values, [field.id]: typed });
            setOutcome("none");
            setEdited(true);
          };
          return (
            <div key={field.id}>
              <label htmlFor={id}>{field.label}</label>
              {field.type === "boolean" ? (
                // The host sends the choice's "true" or "false" as JSON.
                <YesNoSelect
                  id={id}
                  value={value === "" ? undefined : value === "true"}
                  required={field.required}
                  disabled={pending}
                  onChange={(chosen) =>
                    change(chosen === undefined ? "" : String(chosen))
                  }
                />
              ) : (
                <Input
                  id={id}
                  value={value}
                  required={field.required}
                  readOnly={pending}
                  autoComplete="off"
                  {...(field.type === "integer"
                    ? { inputMode: "numeric" as const }
                    : {})}
                  onChange={(event) => change(event.target.value)}
                />
              )}
            </div>
          );
        })}
        <Button type="submit" variant="outline" disabled={pending}>
          {pages.lookupSubmit}
        </Button>
      </form>
      {!edited && error != null && (
        <FindFailure error={error} retry={() => void submit()} />
      )}
      {typeof outcome === "object" && (
        <div role="status">
          <h3>{pages.lookupResultHeading}</h3>
          <RecordFacts entity={entity} record={outcome} fields={disclosed} />
        </div>
      )}
    </section>
  );
}

/** A registry record identifier: a UUID. */
const recordIdentifier =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opens the record with a typed identifier through the same exact read the
 * reference picker uses; the identifier is sent in the host's request path
 * only when the person submits it. A value that cannot be a record identifier
 * is not sent: the page says what the box takes and, where the page also
 * finds by code, points to that form. Beside a find by code, the identifier
 * is a secondary way in, folded behind its heading.
 */
function OpenById({
  entity,
  recordRoute,
  lookupHeading,
}: {
  entity: EntityModel;
  recordRoute: (id: string) => string;
  lookupHeading?: string | undefined;
}) {
  const pages = usePagesContent();
  const locale = useLocale();
  const [typed, setTyped] = useState("");
  const [asked, setAsked] = useState("");
  const [notIdentifier, setNotIdentifier] = useState(false);
  const inputId = useId();
  const record = useRecord(entity.id, asked);
  const requested = asked !== "" && asked === typed.trim();
  const found = requested && !record.isFetching && !record.error && record.data;
  useEffect(() => {
    if (found) navigate(recordRoute(found.id));
  }, [found && found.id]);
  const body = (
    <>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          const id = typed.trim();
          if (!id) return;
          if (!recordIdentifier.test(id)) {
            setNotIdentifier(true);
            return;
          }
          if (id === asked) void record.refetch();
          else setAsked(id);
        }}
      >
        <div>
          <label htmlFor={inputId}>{pages.openByIdLabel}</label>
          <Input
            id={inputId}
            value={typed}
            autoComplete="off"
            onChange={(event) => {
              setTyped(event.target.value);
              setNotIdentifier(false);
            }}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!typed.trim()}>
          {pages.openByIdSubmit}
        </Button>
      </form>
      {notIdentifier && (
        <p role="status">
          {pages.openByIdNotIdentifier}
          {lookupHeading &&
            ` ${fill(pages.openByIdUseLookup, { selector: lookupHeading }, locale)}`}
        </p>
      )}
      {requested && record.error && (
        <FindFailure
          error={record.error}
          retry={() => void record.refetch()}
        />
      )}
    </>
  );
  if (lookupHeading)
    return (
      <details className="alternative">
        <summary>{pages.openByIdHeading}</summary>
        {body}
      </details>
    );
  return (
    <section aria-labelledby={`${inputId}-heading`}>
      <h2 id={`${inputId}-heading`}>{pages.openByIdHeading}</h2>
      {body}
    </section>
  );
}

/**
 * Why a find ended without a record. Only the uniform unavailable answer
 * reads as no match, since it says nothing of whether the record exists; any
 * other failure is the service not answering and offers a retry.
 */
export function FindFailure({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const pages = usePagesContent();
  if (problemView(error).kind === "unavailable")
    return <p role="status">{pages.findNoMatch}</p>;
  return <ErrorPanel error={error} retry={retry} />;
}
