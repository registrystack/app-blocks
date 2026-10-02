import { useEffect, useRef } from "react";
import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import { FieldValue } from "@/blocks/fields/field-value";
import { FieldControl } from "@/blocks/fields/field-control";
import { useBlockContent } from "@/blocks/lib/content";

function fieldLabel(
  fields: readonly FieldModel[] | undefined,
  id: string,
): string | undefined {
  return fields?.find((field) => field.id === id)?.label;
}

/**
 * The errors a submitted form found, one link per field, under a generic
 * heading. Renders nothing while there are none; moves focus to itself each
 * time the errors change, so a screen reader announces the failure.
 */
export function ErrorSummary({
  errors,
  fields,
}: {
  errors: Record<string, string>;
  /** Names each error's field; an error whose field is not listed shows its message alone. */
  fields?: readonly FieldModel[];
}) {
  const c = useBlockContent(),
    ref = useRef<HTMLDivElement>(null);
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
              {fieldLabel(fields, id)
                ? `${fieldLabel(fields, id)}: ${error}`
                : error}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The one value a required choice allows, when the field offers exactly one:
 * the form takes it as given and shows it as text.
 */
export function soleChoice(field: FieldModel): string | undefined {
  return field.type === "string" &&
    field.required &&
    field.options?.length === 1
    ? field.options[0]!.value
    : undefined;
}

/**
 * The grid of controls a record form offers, one per field: a preset field
 * shows as read-only text, a sole required
 * choice shows as text, everything else takes the control its kind renders.
 * `optionLabel` reads an option's word from the app's own model helper, since
 * a block does not know how a register names its options.
 */
export function RecordFormFields({
  fields,
  values,
  errors,
  onChange,
  optionLabel,
  preset,
}: {
  fields: readonly FieldModel[];
  values: Readonly<Record<string, JsonValue>>;
  /** One message per field id; a field with none renders without an error. */
  errors: Readonly<Record<string, string>>;
  onChange: (field: FieldModel, value: JsonValue | undefined) => void;
  optionLabel: (field: FieldModel, code: string) => string;
  /** Values the form takes as given: each shows as read-only text and is never editable. */
  preset?: Readonly<Record<string, JsonValue>>;
}) {
  return (
    <div className="form-grid">
      {fields.map((field) => {
        if (preset && Object.hasOwn(preset, field.id))
          return (
            <div className="field" key={field.id}>
              <p className="field-label">{field.label}</p>
              <p>
                <FieldValue field={field} value={preset[field.id]} />
              </p>
            </div>
          );
        const sole = soleChoice(field);
        if (sole !== undefined && values[field.id] === sole)
          return (
            <div className="field" key={field.id}>
              <p className="field-label">{field.label}</p>
              <p>{optionLabel(field, sole)}</p>
            </div>
          );
        return (
          <FieldControl
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(value) => onChange(field, value)}
            error={errors[field.id]}
          />
        );
      })}
    </div>
  );
}
