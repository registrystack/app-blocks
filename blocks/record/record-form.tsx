import { useEffect, useRef } from "react";
import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import { FieldValue } from "@/blocks/fields/field-value";
import { FieldControl } from "@/blocks/fields/field-control";
import { FieldError } from "@/blocks/fields/input-field";
import { useBlockContent, useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { Button } from "@/components/ui/button";

function fieldLabel(
  fields: readonly FieldModel[] | undefined,
  id: string,
): string | undefined {
  return fields?.find((field) => field.id === id)?.label;
}

/**
 * The errors a submitted form found, one link per field, under a generic
 * heading. Renders nothing while there are none; moves focus to itself when
 * errors first appear or the form explicitly reports another failed attempt.
 * Removing an error while somebody corrects a field must not steal focus.
 */
export function ErrorSummary({
  errors,
  fields,
  focusRequest,
}: {
  errors: Record<string, string>;
  /** Names each error's field; an error whose field is not listed shows its message alone. */
  fields?: readonly FieldModel[];
  /** Change this value for each failed submit that should return focus to the summary. */
  focusRequest?: string | number;
}) {
  const c = useBlockContent(),
    locale = useLocale(),
    ref = useRef<HTMLDivElement>(null),
    previousErrors = useRef<Record<string, string>>({}),
    previousRequest = useRef(focusRequest);
  const errorSignature = JSON.stringify(errors);
  useEffect(() => {
    const hasErrors = Object.keys(errors).length > 0;
    const newOrChangedError = Object.entries(errors).some(
      ([id, message]) => previousErrors.current[id] !== message,
    );
    const requestedAgain =
      focusRequest !== undefined &&
      !Object.is(previousRequest.current, focusRequest);
    if (hasErrors && (newOrChangedError || requestedAgain))
      ref.current?.focus();
    previousErrors.current = { ...errors };
    previousRequest.current = focusRequest;
  }, [errorSignature, focusRequest]);
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
                ? fill(
                    c.labelled,
                    { label: fieldLabel(fields, id)!, value: error },
                    locale,
                  )
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
  anchored,
}: {
  fields: readonly FieldModel[];
  values: Readonly<Record<string, JsonValue>>;
  /** One message per field id; a field with none renders without an error. */
  errors: Readonly<Record<string, string>>;
  onChange: (field: FieldModel, value: JsonValue | undefined) => void;
  optionLabel: (field: FieldModel, code: string) => string;
  /** Values the form takes as given: each shows as read-only text and is never editable. */
  preset?: Readonly<Record<string, JsonValue>>;
  /**
   * Fields filled from elsewhere: each shows as read-only text, its value
   * once read, with a note saying where the value comes from or why it has
   * none, and a way to read it again where the read failed for a reason the
   * record does not explain.
   */
  anchored?: Readonly<
    Record<
      string,
      {
        value?: JsonValue;
        note: string;
        retry?: { label: string; run: () => void };
      }
    >
  >;
}) {
  return (
    <div className="form-grid">
      {fields.map((field) => {
        const anchor = anchored?.[field.id];
        if (anchor)
          return (
            <div
              className={`field ${errors[field.id] ? "field-error" : ""}`}
              key={field.id}
              id={field.id}
              tabIndex={-1}
            >
              <p className="field-label">{field.label}</p>
              {anchor.value !== undefined && (
                <div className="field-value">
                  <FieldValue field={field} value={anchor.value} />
                </div>
              )}
              <p className="muted">{anchor.note}</p>
              {anchor.retry && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={anchor.retry.run}
                >
                  {anchor.retry.label}
                </Button>
              )}
              {errors[field.id] && (
                <FieldError name={field.id} error={errors[field.id]!} />
              )}
            </div>
          );
        if (preset && Object.hasOwn(preset, field.id))
          return (
            <div className="field" key={field.id}>
              <p className="field-label">{field.label}</p>
              <div className="field-value">
                <FieldValue field={field} value={preset[field.id]} />
              </div>
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
