import { useEffect, useReducer, useState, type ReactNode } from "react";
import {
  problemView,
  type EntityModel,
  type LookupModel,
  type RecordView,
} from "@registrystack/app-runtime";
import {
  useModel,
  useRecord,
  useRecordLookup,
  useRecordPages,
} from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  blockContent,
  useBlockContent,
  useLocale,
} from "@/blocks/lib/content";
import { fill, listOf } from "@/blocks/lib/format";
import { controlValue } from "@/blocks/fields/controls";
import {
  describedBy,
  FieldFrame,
  YesNoSelect,
} from "@/blocks/fields/input-field";
import {
  recordTitle,
  ReferenceHrefProvider,
  ReferenceValue,
  useChosenReferences,
} from "@/blocks/fields/reference-value";
import type { FieldControlProps } from "@/blocks/fields/renderers";
import { mentions, namedFor, selectorNamedFor } from "@/blocks/lib/format";

/** Milliseconds a typed search waits for the next keystroke before it is read. */
const searchDelay = 250;

function useDebounced(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), searchDelay);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

/** The most columns, besides the title, an option shows to tell records apart. */
const detailColumns = 2;

/**
 * The values of the target's list columns, besides its title, that a record
 * holds, in the words of the field's own options: what the session's own list
 * already shows.
 */
function detailOf(
  entity: EntityModel,
  values: Record<string, unknown>,
): string[] {
  return entity.list.columns
    .filter((id) => id !== entity.title)
    .flatMap((id) => {
      const held = values[id];
      if (typeof held !== "string" && typeof held !== "number") return [];
      const word = entity.fields
        .find((field) => field.id === id)
        ?.options?.find((option) => option.value === held)?.label;
      return word ?? String(held);
    })
    .filter((held) => held !== "")
    .slice(0, detailColumns);
}

/**
 * Authorized pages of a target entity a reference can be answered with, each
 * by its title (its id where the entity has no title). Records that share a
 * title also carry the values that tell them apart. A continuation keeps the
 * earlier choices and follows only the host's opaque cursor.
 */
function useCandidates(entity: EntityModel, search: string) {
  const c = useBlockContent(),
    locale = useLocale();
  const records = useRecordPages(entity.id, {
    size: entity.list.pageSize,
    ...(search ? { search } : {}),
  });
  const titled = records.error
    ? []
    : (records.data?.pages.flatMap((page) =>
        page.items.map((record) => ({
          id: record.id,
          title: recordTitle(entity, record.values, locale) ?? record.id,
          values: record.values,
        })),
      ) ?? []);
  const options = titled.map(({ values, ...option }) => ({
    ...option,
    detail:
      titled.filter((other) => other.title === option.title).length > 1
        ? detailOf(entity, values)
        : [],
  }));
  const status = records.isPending
    ? c.loading
    : records.error
      ? (c.referenceLoadFailed ?? blockContent.referenceLoadFailed)
      : options.length === 0
        ? (c.referenceNoMatch ?? blockContent.referenceNoMatch)
        : undefined;
  return {
    options,
    status,
    hasMore: !records.error && records.hasNextPage,
    loadingMore: records.isFetchingNextPage,
    restarting: records.isFetching && !records.isFetchingNextPage,
    loadMore: records.fetchNextPage,
    advanced: records.advanced,
    restart: records.restart,
  };
}

interface Candidate {
  id: string;
  title: string;
  /** Other list values of the record, to tell it from one with the same title. */
  detail?: string[];
}

type PickerProps = FieldControlProps & {
  entity: EntityModel;
  select: (candidate: Candidate) => void;
};

function MoreCandidates({
  candidates,
}: {
  candidates: ReturnType<typeof useCandidates>;
}) {
  const c = useBlockContent();
  return candidates.hasMore || candidates.advanced ? (
    <>
      {candidates.hasMore && (
        <Button
          type="button"
          variant="outline"
          disabled={candidates.loadingMore || candidates.restarting}
          onClick={() => void candidates.loadMore()}
        >
          {candidates.loadingMore
            ? c.loading
            : (c.referenceMore ?? blockContent.referenceMore)}
        </Button>
      )}
      {candidates.advanced && (
        <Button
          type="button"
          variant="outline"
          disabled={candidates.loadingMore || candidates.restarting}
          onClick={() => void candidates.restart()}
        >
          {candidates.restarting
            ? c.loading
            : (c.referenceRestart ?? blockContent.referenceRestart)}
        </Button>
      )}
    </>
  ) : null;
}

/** A search input over the target's records; a match is chosen from the list under it. */
function SearchPicker({ field, error, entity, select }: PickerProps) {
  const locale = useLocale();
  const [typed, setTyped] = useState("");
  const candidates = useCandidates(entity, useDebounced(typed.trim()));
  return (
    <>
      <Input
        id={field.id}
        name={field.id}
        type="search"
        value={typed}
        autoComplete="off"
        aria-invalid={!!error}
        aria-describedby={describedBy(field.id, field.hint, error)}
        onChange={(event) => setTyped(event.target.value)}
      />
      {candidates.status && <p role="status">{candidates.status}</p>}
      <ul className="reference-options">
        {candidates.options.map((option) => (
          <li key={option.id}>
            <button type="button" onClick={() => select(option)}>
              {option.title}
              {option.detail?.length ? (
                <span className="reference-detail">
                  {" "}
                  {listOf(option.detail, locale)}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <MoreCandidates candidates={candidates} />
    </>
  );
}

function ChoicePicker({
  field,
  error,
  select,
  candidates: { options, status },
}: PickerProps & { candidates: ReturnType<typeof useCandidates> }) {
  const c = useBlockContent();
  const locale = useLocale();
  return (
    <>
      <select
        id={field.id}
        name={field.id}
        value=""
        aria-invalid={!!error}
        aria-describedby={describedBy(field.id, field.hint, error)}
        onChange={(event) => {
          const option = options.find(
            (candidate) => candidate.id === event.target.value,
          );
          if (option) select(option);
        }}
      >
        <option value="">
          {c.referenceChoose ?? blockContent.referenceChoose}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.detail?.length
              ? fill(
                  c.referenceOption ?? blockContent.referenceOption!,
                  {
                    title: option.title,
                    detail: listOf(option.detail, locale),
                  },
                  locale,
                )
              : option.title}
          </option>
        ))}
      </select>
      {status && <p role="status">{status}</p>}
    </>
  );
}

/**
 * A bounded, paged choice for a target without a supported search.
 */
function ChoiceReference(props: PickerProps) {
  const candidates = useCandidates(props.entity, "");
  return (
    <>
      <ChoicePicker {...props} candidates={candidates} />
      <MoreCandidates candidates={candidates} />
    </>
  );
}

/** The id of the reference field's own label, which lookup controls are named by. */
const frameLabelId = (field: { id: string }) => `${field.id}-label`;

/**
 * An exact identifier lookup for a target the session may get but not list.
 * Typed text is never the answer: only the record returned by the authorized
 * host route can be selected. Alone, the input is the field's own control;
 * after lookup selectors it has an id and a label of its own. A record the
 * host does not hold, or will not show, reads as the neutral unavailable
 * answer; any other failure reads as a failure with a retry.
 */
function ExactReference({
  field,
  error,
  entity,
  select,
  afterSelectors = false,
}: PickerProps & { afterSelectors?: boolean }) {
  const c = useBlockContent(),
    locale = useLocale();
  const inputId = afterSelectors ? `${field.id}-identifier` : field.id;
  const [typed, setTyped] = useState("");
  const [lookupId, setLookupId] = useState("");
  const record = useRecord(entity.id, lookupId);
  const requested = lookupId !== "" && lookupId === typed.trim();
  const candidate =
    requested && !record.error && !record.isFetching && record.data
      ? {
          id: record.data.id,
          title: recordTitle(entity, record.data.values, locale) ?? record.data.id,
        }
      : undefined;
  const find = () => {
    const id = typed.trim();
    if (!id) return;
    if (id === lookupId) void record.refetch();
    else setLookupId(id);
  };
  const lookupHint = c.referenceLookupHint ?? blockContent.referenceLookupHint;
  return (
    <>
      {afterSelectors && (
        <label htmlFor={inputId} id={`${inputId}-label`}>
          {c.referenceIdentifier ?? blockContent.referenceIdentifier}
        </label>
      )}
      <Input
        id={inputId}
        name={inputId}
        type="search"
        value={typed}
        autoComplete="off"
        aria-invalid={!!error}
        {...(afterSelectors
          ? {
              "aria-labelledby": `${frameLabelId(field)} ${inputId}-label`,
            }
          : {})}
        aria-describedby={[
          describedBy(field.id, field.hint, error),
          `${inputId}-lookup-hint`,
        ]
          .filter(Boolean)
          .join(" ")}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          find();
        }}
      />
      <p id={`${inputId}-lookup-hint`}>{lookupHint}</p>
      <Button
        type="button"
        variant="outline"
        disabled={!typed.trim()}
        onClick={find}
      >
        {c.referenceFind ?? blockContent.referenceFind}
      </Button>
      {requested && record.isFetching && <p role="status">{c.loading}</p>}
      {requested &&
        !record.isFetching &&
        record.error &&
        (problemView(record.error).kind === "unavailable" ? (
          <p role="status">
            {c.referenceLookupUnavailable ??
              blockContent.referenceLookupUnavailable}
          </p>
        ) : (
          <div role="alert">
            <p>{c.referenceLoadFailed ?? blockContent.referenceLoadFailed}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void record.refetch()}
            >
              {c.referenceRetry ?? blockContent.referenceRetry}
            </Button>
          </div>
        ))}
      {candidate && (
        <ul className="reference-options">
          <li>
            <button type="button" onClick={() => select(candidate)}>
              {candidate.title}
            </button>
          </li>
        </ul>
      )}
    </>
  );
}

type LookupSelector = LookupModel["selectors"][number];

/** What one selector lookup holds: the values typed and the find they were sent in. */
interface LookupState {
  values: Record<string, string>;
  /** The values the latest find sent, until any value changes. */
  asked: Record<string, string> | null;
  /** The record that find returned, while its values stand. */
  found: RecordView | null;
}

type LookupStep =
  | { kind: "typed"; field: string; value: string }
  | { kind: "asked"; values: Record<string, string> }
  | {
      kind: "answered";
      values: Record<string, string>;
      record: RecordView | null;
    };

const noLookup: LookupState = { values: {}, asked: null, found: null };

/**
 * A changed value is a new question, so it drops the earlier find and its
 * answer. An answer counts only for the values it was asked with, while they
 * still stand.
 */
function lookupStep(state: LookupState, step: LookupStep): LookupState {
  switch (step.kind) {
    case "typed":
      return {
        values: { ...state.values, [step.field]: step.value },
        asked: null,
        found: null,
      };
    case "asked":
      return { ...state, asked: step.values, found: null };
    case "answered":
      return step.values === state.asked
        ? { ...state, found: step.record }
        : state;
  }
}

/**
 * One BReg lookup selector of the target, grouped under its label: a control
 * per selector field and Find. The values go to the host's lookup route only
 * when the person asks to find. Typed values are never the answer: only the
 * record the host returns can be chosen. A miss reads as the neutral
 * unavailable answer; any other failure reads as a failure with a retry.
 */
function SelectorLookup({
  field,
  error,
  entity,
  select,
  selector,
  index,
}: PickerProps & { selector: LookupSelector; index: number }) {
  const c = useBlockContent(),
    locale = useLocale();
  const { lookup, pending, error: failure } = useRecordLookup(entity.id);
  const [state, step] = useReducer(lookupStep, noLookup);
  // The first control replaces the chosen view, so it carries the field's id.
  const controlId = (at: number) =>
    index === 0 && at === 0 ? field.id : `${field.id}-lookup-${index}-${at}`;
  const ready =
    !pending &&
    selector.fields.every(
      (input) =>
        !input.required || (state.values[input.id] ?? "").trim() !== "",
    );
  async function find() {
    if (!ready) return;
    const values = state.values;
    step({ kind: "asked", values });
    const record = await lookup(selector.id, values);
    step({ kind: "answered", values, record });
  }
  const answered = !pending && state.asked === state.values;
  const candidate = state.found && {
    id: state.found.id,
    title: recordTitle(entity, state.found.values, locale) ?? state.found.id,
  };
  // An exact match of the values asked is the answer: it is chosen without a
  // further click. The candidate stays below in case the choice is undone.
  useEffect(() => {
    if (candidate) select(candidate);
  }, [state.found]);
  // A label the registry derived ("By record code") names the target type,
  // and so do its controls; a declared label stays as the model words it.
  const legend = selectorNamedFor(selector, entity.label, locale);
  const derived = legend !== selector.label;
  const ownLabel = (label: string) =>
    derived ? namedFor(label, entity.label, locale) : label;
  // A field already labelled with the target type is not named by it twice.
  const fieldNamesType = derived && mentions(field.label, entity.label);
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="search-form">
        {selector.fields.map((input, at) => {
          const id = controlId(at);
          const value = state.values[input.id] ?? "";
          const change = (typed: string) =>
            step({ kind: "typed", field: input.id, value: typed });
          const named = {
            "aria-labelledby": fieldNamesType
              ? `${id}-own-label`
              : `${frameLabelId(field)} ${id}-own-label`,
            ...(index === 0 && at === 0
              ? {
                  "aria-invalid": !!error,
                  "aria-describedby": describedBy(field.id, field.hint, error),
                }
              : {}),
          };
          return (
            <div key={input.id}>
              {/* The field's own label already points at the first control. */}
              <label
                id={`${id}-own-label`}
                {...(id === field.id ? {} : { htmlFor: id })}
              >
                {ownLabel(input.label)}
              </label>
              {input.type === "boolean" ? (
                // The host sends the choice's "true" or "false" as JSON.
                <YesNoSelect
                  id={id}
                  value={value === "" ? undefined : value === "true"}
                  disabled={pending}
                  onChange={(chosen) =>
                    change(chosen === undefined ? "" : String(chosen))
                  }
                  {...named}
                />
              ) : (
                <Input
                  id={id}
                  value={value}
                  readOnly={pending}
                  autoComplete="off"
                  {...(input.type === "integer"
                    ? { inputMode: "numeric" as const }
                    : {})}
                  onChange={(event) => change(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    // The picker sits in the form it answers; Enter here finds.
                    event.preventDefault();
                    void find();
                  }}
                  {...named}
                />
              )}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          disabled={!ready}
          onClick={() => void find()}
        >
          {c.referenceFind ?? blockContent.referenceFind}
        </Button>
      </div>
      {pending && <p role="status">{c.loading}</p>}
      {answered &&
        failure != null &&
        (problemView(failure).kind === "unavailable" ? (
          <p role="status">
            {c.referenceLookupUnavailable ??
              blockContent.referenceLookupUnavailable}
          </p>
        ) : (
          <div role="alert">
            <p>{c.referenceLoadFailed ?? blockContent.referenceLoadFailed}</p>
            <Button type="button" variant="outline" onClick={() => void find()}>
              {c.referenceRetry ?? blockContent.referenceRetry}
            </Button>
          </div>
        ))}
      {candidate && (
        <ul className="reference-options">
          <li>
            <button type="button" onClick={() => select(candidate)}>
              {candidate.title}
            </button>
          </li>
        </ul>
      )}
    </fieldset>
  );
}

/**
 * The lookups for a target the session may not list: one per BReg lookup
 * selector, then the exact identifier lookup where the session may also get.
 */
function LookupReference(props: PickerProps & { lookup: LookupModel }) {
  const c = useBlockContent();
  const { lookup, ...picker } = props;
  return (
    <>
      {lookup.selectors.map((selector, index) => (
        <SelectorLookup
          key={selector.id}
          {...picker}
          selector={selector}
          index={index}
        />
      ))}
      {picker.entity.operations.get && (
        <details className="alternative">
          <summary>
            {c.referenceIdentifierOther ??
              blockContent.referenceIdentifierOther}
          </summary>
          <ExactReference {...picker} afterSelectors />
        </details>
      )}
    </>
  );
}

/**
 * The control that answers a reference field with a record of its target
 * entity, never an id typed or pasted. A listable entity offers authorized
 * cursor pages, with search when the contract supports it. A non-listable
 * entity with BReg lookup selectors offers one lookup per selector, then the
 * exact identifier lookup where it is also exactly readable; one that is only
 * exactly readable accepts an identifier only as a lookup. Either way the
 * returned record is offered to choose. A target with none of these is neutral.
 */
export function ReferenceControl(props: FieldControlProps) {
  const { field, value, error } = props;
  const c = useBlockContent(),
    model = useModel(),
    chosenReferences = useChosenReferences();
  const entity = model.data?.entities.find(
    (e) => e.id === field.reference?.entity,
  );
  const chosen = typeof value === "string" && value !== "";
  const [selected, setSelected] = useState<Candidate | null>(null);
  // The chosen state of the answer that focus is waiting for. Choosing a record
  // and changing it swap the control for the other one, so focus moves to the
  // control that replaces it, which carries the field's id in both states.
  const [focusWhenChosen, setFocusWhenChosen] = useState<boolean | null>(null);
  useEffect(() => {
    if (focusWhenChosen === null || focusWhenChosen !== chosen) return;
    document.getElementById(field.id)?.focus();
    setFocusWhenChosen(null);
  });
  const onChange: FieldControlProps["onChange"] = (next) => {
    setFocusWhenChosen(typeof next === "string" && next !== "");
    if (typeof next !== "string" || next === "") setSelected(null);
    props.onChange(next);
  };
  const select = (candidate: Candidate) => {
    setSelected(candidate);
    // A record the session cannot open was picked from a list read; its title
    // is kept for a step that shows the answer once this control is gone.
    if (entity && !entity.operations.get)
      chosenReferences?.remember({
        entity: entity.id,
        id: candidate.id,
        title: candidate.title,
      });
    onChange(controlValue(field, candidate.id));
  };
  // A record picked here before the control was last swapped out keeps its title.
  const chosenTitle =
    entity && typeof value === "string"
      ? chosenReferences?.titleOf(entity.id, value)
      : undefined;
  const lookup =
    entity &&
    !entity.operations.list &&
    entity.operations.lookup?.selectors.length
      ? entity.operations.lookup
      : undefined;
  const frame = (children: ReactNode) => (
    <FieldFrame
      name={field.id}
      label={field.label}
      {...(lookup && !chosen ? { labelId: frameLabelId(field) } : {})}
      hint={field.hint}
      error={error}
      required={field.required && !field.acceptsBlank}
    >
      {children}
    </FieldFrame>
  );
  const chosenView = (
    <p>
      {/* The chosen title is text here; the page it names is not a way to answer the field. */}
      <ReferenceHrefProvider href={() => null}>
        <span id={`${field.id}-chosen`}>
          {selected && selected.id === value ? (
            selected.title
          ) : entity?.operations.get || chosenTitle !== undefined ? (
            <ReferenceValue field={field} value={value ?? ""} />
          ) : (
            (c.referenceUnavailable ?? blockContent.referenceUnavailable)
          )}
        </span>
      </ReferenceHrefProvider>{" "}
      <Button
        type="button"
        variant="outline"
        id={field.id}
        aria-describedby={`${field.id}-chosen`}
        onClick={() => onChange(controlValue(field, ""))}
      >
        {c.referenceChange ?? blockContent.referenceChange}
      </Button>
    </p>
  );
  return frame(
    model.isPending ? (
      <p role="status">{c.loading}</p>
    ) : chosen ? (
      chosenView
    ) : !entity ? (
      <p role="status">
        {c.referenceSelectionUnavailable ??
          blockContent.referenceSelectionUnavailable}
      </p>
    ) : entity.operations.list ? (
      entity.list.search?.length ? (
        <SearchPicker
          {...props}
          onChange={onChange}
          entity={entity}
          select={select}
        />
      ) : (
        <ChoiceReference
          {...props}
          onChange={onChange}
          entity={entity}
          select={select}
        />
      )
    ) : lookup ? (
      <LookupReference
        {...props}
        onChange={onChange}
        entity={entity}
        select={select}
        lookup={lookup}
      />
    ) : entity.operations.get ? (
      <ExactReference
        {...props}
        onChange={onChange}
        entity={entity}
        select={select}
      />
    ) : (
      <p role="status">
        {c.referenceSelectionUnavailable ??
          blockContent.referenceSelectionUnavailable}
      </p>
    ),
  );
}
