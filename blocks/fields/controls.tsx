import {
  crs84PointContract,
  type FieldModel,
  type JsonValue,
} from "@registrystack/app-runtime";
import {
  ChoiceField,
  describedBy,
  FieldError,
  InputField,
  YesNoField,
} from "@/blocks/fields/input-field";
import type { FieldControlProps } from "@/blocks/fields/renderers";
import { useBlockContent } from "@/blocks/lib/content";

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

function pointCoordinates(value: JsonValue | undefined): [string, string] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return ["", ""];
  const coordinates = value.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return ["", ""];
  const text = (coordinate: JsonValue): string =>
    typeof coordinate === "string" || typeof coordinate === "number"
      ? String(coordinate)
      : "";
  return [text(coordinates[0]!), text(coordinates[1]!)];
}

/**
 * One coordinate changed in a native GeoJSON Point. Form state keeps exact
 * decimal text; the app host turns each validated coordinate into a JSON
 * number without sending it through a lossy JavaScript number.
 */
export function withPointCoordinate(
  field: FieldModel,
  current: JsonValue | undefined,
  index: 0 | 1,
  typed: string,
): JsonValue | undefined {
  const coordinates = pointCoordinates(current);
  coordinates[index] = typed;
  if (!field.required && coordinates.every((coordinate) => coordinate === ""))
    return undefined;
  return { type: "Point", coordinates };
}

/** Longitude and latitude controls for BReg's strict CRS84 GeoJSON Point. */
export function Crs84PointControl({
  field,
  value,
  onChange,
  error,
}: FieldControlProps) {
  const content = useBlockContent(),
    contract = crs84PointContract(field.schema) ?? {
      precision: 9,
      longitude: { minimum: -180, maximum: 180 },
      latitude: { minimum: -90, maximum: 90 },
    },
    coordinates = pointCoordinates(value),
    step = contract.precision === 0 ? 1 : 10 ** -contract.precision;
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
      {error && <FieldError name={field.id} error={error} />}
      <InputField
        name={`${field.id}-longitude`}
        label={content.longitudeLabel}
        value={coordinates[0]}
        type="number"
        min={contract.longitude.minimum}
        max={contract.longitude.maximum}
        step={step}
        required={field.required}
        onChange={(typed) =>
          onChange(withPointCoordinate(field, value, 0, typed))
        }
      />
      <InputField
        name={`${field.id}-latitude`}
        label={content.latitudeLabel}
        value={coordinates[1]}
        type="number"
        min={contract.latitude.minimum}
        max={contract.latitude.maximum}
        step={step}
        required={field.required}
        onChange={(typed) =>
          onChange(withPointCoordinate(field, value, 1, typed))
        }
      />
    </fieldset>
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
