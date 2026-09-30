import { useEffect, useRef } from "react";
import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import { FieldControl } from "@/blocks/fields/field-control";
import { useBlockContent } from "@/blocks/lib/content";

/**
 * The errors a submitted form found, one link per field, under a generic
 * heading. Renders nothing while there are none; moves focus to itself each
 * time the errors change, so a screen reader announces the failure.
 */
export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
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
              {error}
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
 * The grid of controls a record form offers, one per field: a sole required
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
}: {
  fields: readonly FieldModel[];
  values: Readonly<Record<string, JsonValue>>;
  /** One message per field id; a field with none renders without an error. */
  errors: Readonly<Record<string, string>>;
  onChange: (field: FieldModel, value: JsonValue | undefined) => void;
  optionLabel: (field: FieldModel, code: string) => string;
}) {
  return (
    <div className="form-grid">
      {fields.map((field) => {
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
