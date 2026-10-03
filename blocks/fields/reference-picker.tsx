import { useEffect, useState, type ReactNode } from "react";
import type { EntityModel, FieldModel } from "@registrystack/app-runtime";
import { useModel, useRecords } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockContent, useBlockContent } from "@/blocks/lib/content";
import { controlValue } from "@/blocks/fields/controls";
import {
  describedBy,
  FieldFrame,
  InputField,
} from "@/blocks/fields/input-field";
import {
  recordTitle,
  ReferenceHrefProvider,
  ReferenceValue,
} from "@/blocks/fields/reference-value";
import type { FieldControlProps } from "@/blocks/fields/renderers";

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

/**
 * The records of a target entity a reference can be answered with, each by
 * its title (its id where the entity has no title), and the words for why
 * there are none to offer. Without a search it reads the entity's first page,
 * and `more` says records lie past it; with one, the records it matches.
 */
function useCandidates(entity: EntityModel, search: string) {
  const c = useBlockContent();
  const records = useRecords(entity.id, {
    size: entity.list.pageSize,
    ...(search ? { search } : {}),
  });
  const options = (records.data?.items ?? []).map((record) => ({
    id: record.id,
    title: recordTitle(entity, record.values) ?? record.id,
  }));
  const status = records.isPending
    ? c.loading
    : records.error
      ? (c.referenceLoadFailed ?? blockContent.referenceLoadFailed)
      : options.length === 0
        ? (c.referenceNoMatch ?? blockContent.referenceNoMatch)
        : undefined;
  return { options, status, more: !!records.data?.nextCursor };
}

type PickerProps = FieldControlProps & { entity: EntityModel };

/** A search input over the target's records; a match is chosen from the list under it. */
function SearchPicker({ field, onChange, error, entity }: PickerProps) {
  const [typed, setTyped] = useState("");
  const { options, status } = useCandidates(entity, useDebounced(typed.trim()));
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
      {status && <p role="status">{status}</p>}
      <ul className="reference-options">
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => onChange(controlValue(field, option.id))}
            >
              {option.title}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * A choice among the target's records, when the first page holds them all. A
 * target with more records than that, and no search to reach them, is answered
 * with a typed identifier instead, so no record is out of reach; the identifier
 * stays a typed one once it holds a value.
 */
function ChoiceReference({
  frame,
  chosenView,
  chosen,
  ...props
}: PickerProps & {
  frame: (children: ReactNode) => ReactNode;
  chosenView: ReactNode;
  chosen: boolean;
}) {
  const candidates = useCandidates(props.entity, "");
  if (candidates.more) return <TypedIdentifier {...props} />;
  return frame(
    chosen ? chosenView : <ChoicePicker {...props} candidates={candidates} />,
  );
}

function ChoicePicker({
  field,
  onChange,
  error,
  candidates: { options, status },
}: PickerProps & { candidates: ReturnType<typeof useCandidates> }) {
  const c = useBlockContent();
  return (
    <>
      <select
        id={field.id}
        name={field.id}
        value=""
        aria-invalid={!!error}
        aria-describedby={describedBy(field.id, field.hint, error)}
        onChange={(event) => onChange(controlValue(field, event.target.value))}
      >
        <option value="">
          {c.referenceChoose ?? blockContent.referenceChoose}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
      {status && <p role="status">{status}</p>}
    </>
  );
}

/**
 * The identifier of a record typed in, for a target the session cannot list.
 * The registry checks it when the form is sent.
 */
function TypedIdentifier({ field, value, onChange, error }: FieldControlProps) {
  const c = useBlockContent();
  const typed = c.referenceTyped ?? blockContent.referenceTyped;
  return (
    <InputField
      name={field.id}
      label={field.label}
      hint={field.hint ? `${field.hint} ${typed}` : typed}
      value={typeof value === "string" ? value : ""}
      required={field.required && !field.acceptsBlank}
      onChange={(next) => onChange(controlValue(field, next))}
      {...(error ? { error } : {})}
    />
  );
}

/**
 * The control that answers a reference field with a record of its target
 * entity, never an id typed or pasted. An entity with a search offers a
 * search input and the records it matches; any other offers its first page to
 * choose from. The answer stays the record's id; a chosen record shows by its
 * title, with a button that clears it to pick another. A target the session
 * cannot list is answered with a typed identifier instead, which the registry
 * checks.
 */
export function ReferenceControl(props: FieldControlProps) {
  const { field, value, error } = props;
  const c = useBlockContent(),
    model = useModel();
  const entity = model.data?.entities.find(
    (e) => e.id === field.reference?.entity,
  );
  const chosen = typeof value === "string" && value !== "";
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
    props.onChange(next);
  };
  if (!model.isPending && !entity?.operations.list)
    return <TypedIdentifier {...props} />;
  const frame = (children: ReactNode) => (
    <FieldFrame
      name={field.id}
      label={field.label}
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
          <ReferenceValue field={field} value={value ?? ""} />
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
  if (!model.isPending && entity && !entity.list.search?.length)
    return (
      <ChoiceReference
        {...props}
        onChange={onChange}
        entity={entity}
        frame={frame}
        chosenView={chosenView}
        chosen={chosen}
      />
    );
  return frame(
    model.isPending ? (
      <p role="status">{c.loading}</p>
    ) : chosen ? (
      chosenView
    ) : !entity ? null : (
      <SearchPicker {...props} onChange={onChange} entity={entity} />
    ),
  );
}
