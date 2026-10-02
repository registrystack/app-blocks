import { useEffect, useState, type ReactNode } from "react";
import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import { useBlockContent } from "@/blocks/lib/content";
import { describedBy } from "@/blocks/fields/input-field";
import { FieldControl } from "@/blocks/fields/field-control";
import { FieldValue } from "@/blocks/fields/field-value";
import type {
  FieldControlProps,
  FieldValueProps,
} from "@/blocks/fields/renderers";

type GroupItem = Record<string, JsonValue>;

/** A group's own value, read as a list of item objects; anything else as none. */
function asItems(value: JsonValue | undefined): GroupItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? (item as GroupItem)
      : {},
  );
}

/** One item's own sub-field id, scoped to its item so items never collide. */
function itemFieldId(field: FieldModel, index: number, subId: string): string {
  return `${field.id}-${index}-${subId}`;
}

/** An object with one sub-field set, or removed when the answer is undefined. */
function withSub(
  item: GroupItem,
  subId: string,
  subValue: JsonValue | undefined,
): GroupItem {
  const next = { ...item };
  if (subValue === undefined) delete next[subId];
  else next[subId] = subValue;
  return next;
}

/** A value read as an object of sub-field answers; anything else as none. */
function asObject(value: JsonValue | undefined): GroupItem {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as GroupItem)
    : {};
}

/**
 * A structured field's own object with one sub-field set. An optional field
 * whose sub-fields are all blank is no answer at all, so it reads back as
 * undefined and nothing is sent for it; a required field keeps its object so
 * the form can refuse the blanks.
 */
export function withSubValue(
  field: FieldModel,
  current: JsonValue | undefined,
  subId: string,
  subValue: JsonValue | undefined,
): GroupItem | undefined {
  const next = withSub(asObject(current), subId, subValue);
  const blank = Object.values(next).every((value) => value === "");
  return !field.required && blank ? undefined : next;
}

/** One labelled control per sub-field, each scoped to an id of its own. */
function SubFieldControls({
  subs,
  item,
  idOf,
  onChange,
}: {
  subs: readonly FieldModel[];
  item: GroupItem;
  idOf: (subId: string) => string;
  onChange: (subId: string, value: JsonValue | undefined) => void;
}) {
  return subs.map((sub) => (
    <FieldControl
      key={sub.id}
      field={{ ...sub, id: idOf(sub.id) }}
      value={item[sub.id]}
      onChange={(next) => onChange(sub.id, next)}
    />
  ));
}

/** The fieldset, legend, hint and single error a group and a structured field share. */
function GroupFieldset({
  field,
  error,
  children,
}: {
  field: FieldModel;
  error?: string | undefined;
  children: ReactNode;
}) {
  const c = useBlockContent();
  return (
    <fieldset
      id={field.id}
      tabIndex={-1}
      className={`field group-field ${error ? "field-error" : ""}`}
      aria-describedby={describedBy(field.id, field.hint, error)}
      aria-invalid={!!error}
    >
      <legend>{field.label}</legend>
      {field.hint && (
        <p className="field-hint" id={`${field.id}-hint`}>
          {field.hint}
        </p>
      )}
      {error && (
        <p className="field-error-message" id={`${field.id}-error`}>
          <span className="sr-only">{c.errorPrefix} </span>
          {error}
        </p>
      )}
      {children}
    </fieldset>
  );
}

/**
 * A single structured object's sub-fields: one labelled control per
 * sub-field, the same control a top-level field of that kind uses, scoped to
 * an id under the field's own. The field carries a single error message at
 * its own fieldset, as a group does.
 */
export function StructuredControl({
  field,
  value,
  onChange,
  error,
}: FieldControlProps) {
  return (
    <GroupFieldset field={field} error={error}>
      <SubFieldControls
        subs={field.items ?? []}
        item={asObject(value)}
        idOf={(subId) => `${field.id}-${subId}`}
        onChange={(subId, next) =>
          onChange(withSubValue(field, value, subId, next))
        }
      />
    </GroupFieldset>
  );
}

/**
 * A repeatable group's items, as a table with one column per sub-field. Each
 * cell reads through that sub-field's own renderer, so a coded value shows
 * its label the same way a top-level field's does.
 */
export function GroupValue({ field, value }: FieldValueProps) {
  const items = asItems(value);
  const subs = field.items ?? [];
  return (
    <div
      className="value-table-scroll"
      role="region"
      aria-label={field.label}
      tabIndex={0}
    >
      <table className="value-table group-value">
        <thead>
          <tr>
            {subs.map((sub) => (
              <th key={sub.id} scope="col">
                {sub.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              {subs.map((sub) => (
                <td key={sub.id}>
                  <FieldValue field={sub} value={item[sub.id]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A repeatable group's items: one fieldset per item, holding a labelled
 * control per sub-field (the same control a top-level field of that kind
 * uses, scoped to a per-item id so items never collide), a button to remove
 * that item, and a button to add another. The group carries a single error
 * message at its own fieldset, the way a checkbox group does; a sub-field's
 * own refusal is reported there rather than beside that sub-field, since the
 * host validates a write as a whole and does not say which item failed.
 *
 * Focus moves to the new item's first editable sub-field after an add, and
 * after a remove to the item that took the removed one's place, or to the
 * add button when none did.
 */
export function GroupControl({
  field,
  value,
  onChange,
  error,
}: FieldControlProps) {
  const c = useBlockContent();
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const items = asItems(value);
  const subs = field.items ?? [];
  const firstEditable = subs.find((sub) => !sub.readOnly)?.id;
  const addButtonId = `${field.id}-add`;

  // Retries each render until the focus target has mounted, then focuses it
  // once and stops. The target only exists once the parent has re-rendered
  // this control with the updated value, which happens after this effect is
  // first scheduled.
  useEffect(() => {
    if (!pendingFocus) return;
    const target = document.getElementById(pendingFocus);
    if (target) {
      target.focus();
      setPendingFocus(null);
    }
  });

  function updateItem(
    index: number,
    subId: string,
    subValue: JsonValue | undefined,
  ) {
    onChange(
      items.map((item, i) =>
        i === index ? withSub(item, subId, subValue) : item,
      ),
    );
  }

  function addItem() {
    const index = items.length;
    onChange([...items, {}]);
    setPendingFocus(
      firstEditable ? itemFieldId(field, index, firstEditable) : addButtonId,
    );
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
    setPendingFocus(
      index < next.length && firstEditable
        ? itemFieldId(field, index, firstEditable)
        : addButtonId,
    );
  }

  return (
    <GroupFieldset field={field} error={error}>
      {items.map((item, index) => (
        <fieldset key={index} className="group-item">
          <legend>
            {(c.groupItemLegend ?? ((n) => `Item ${n}`))(index + 1)}
          </legend>
          <SubFieldControls
            subs={subs}
            item={item}
            idOf={(subId) => itemFieldId(field, index, subId)}
            onChange={(subId, next) => updateItem(index, subId, next)}
          />
          <button type="button" onClick={() => removeItem(index)}>
            {(c.removeGroupItem ?? ((n) => `Remove item ${n}`))(index + 1)}
          </button>
        </fieldset>
      ))}
      <button type="button" id={addButtonId} onClick={addItem}>
        {c.addGroupItem ?? "Add item"}
      </button>
    </GroupFieldset>
  );
}
