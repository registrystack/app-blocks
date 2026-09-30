import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import {
  ChoiceField,
  InputField,
  YesNoField,
} from "@/blocks/fields/input-field";
import type { FieldControlProps } from "@/blocks/fields/renderers";

/**
 * The answer a typed text stands for. A cleared answer is blank when the
 * field needs one or keeps a blank answer, and undefined otherwise. A number
 * stays the text typed, so every digit reaches the host.
 */
export function controlValue(
  field: FieldModel,
  typed: string,
): JsonValue | undefined {
  if (typed !== "") return typed;
  return field.required || field.acceptsBlank ? "" : undefined;
}

function typedText(value: JsonValue | undefined): string {
  return value === undefined || value === null
    ? ""
    : typeof value === "string"
      ? value
      : String(value);
}

function bound(field: FieldModel, keyword: string): number | undefined {
  const limit = field.schema[keyword];
  return typeof limit === "number" ? limit : undefined;
}

/** A single-line input, or a textarea or option list, answering one field. */
function ModelInput({
  field,
  value,
  onChange,
  error,
  type = "text",
  multiline = false,
  step,
}: FieldControlProps & {
  type?: string;
  multiline?: boolean;
  step?: number | "any";
}) {
  const numeric = step !== undefined;
  const min = numeric ? bound(field, "minimum") : undefined,
    max = numeric ? bound(field, "maximum") : undefined;
  return (
    <InputField
      name={field.id}
      label={field.label}
      {...(field.hint ? { hint: field.hint } : {})}
      value={typedText(value)}
      multiline={multiline}
      type={type}
      required={field.required && !field.acceptsBlank}
      {...(field.options ? { options: field.options } : {})}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      {...(step !== undefined ? { step } : {})}
      onChange={(next) => onChange(controlValue(field, next))}
      {...(error ? { error } : {})}
    />
  );
}

export function TextControl(props: FieldControlProps) {
  return <ModelInput {...props} />;
}

export function TextareaControl(props: FieldControlProps) {
  return <ModelInput {...props} multiline />;
}

export function DateControl(props: FieldControlProps) {
  return <ModelInput {...props} type="date" />;
}

export function EnumControl(props: FieldControlProps) {
  return <ModelInput {...props} />;
}

/** A number input bounded by the schema, stepping by whole numbers for an integer. */
export function NumberControl(props: FieldControlProps) {
  return (
    <ModelInput
      {...props}
      type="number"
      step={props.field.type === "integer" ? 1 : "any"}
    />
  );
}

export function BooleanControl({
  field,
  value,
  onChange,
  error,
  note,
}: FieldControlProps) {
  return (
    <YesNoField
      name={field.id}
      label={field.label}
      {...(field.hint ? { hint: field.hint } : {})}
      value={typeof value === "boolean" ? value : undefined}
      onChange={onChange}
      required={field.required}
      {...(error ? { error } : {})}
      note={note}
    />
  );
}

export function ChoicesControl({
  field,
  value,
  onChange,
  error,
}: FieldControlProps) {
  return (
    <ChoiceField
      name={field.id}
      label={field.label}
      {...(field.hint ? { hint: field.hint } : {})}
      value={
        Array.isArray(value)
          ? value.filter((item) => typeof item === "string")
          : []
      }
      options={field.options ?? []}
      onChange={(next) => onChange(next)}
      {...(error ? { error } : {})}
    />
  );
}
