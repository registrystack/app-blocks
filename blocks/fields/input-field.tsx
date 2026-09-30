import type { ChangeEvent, ReactNode } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { useBlockContent, type BlockContent } from "@/blocks/lib/content";

export interface FieldOptionWords {
  value: string;
  label: string;
}

/** The words for one option: the content's term first, then the option's own. */
export function optionWords(content: BlockContent, option: FieldOptionWords) {
  return content.terms[option.value] ?? option.label;
}

/** The ids of a control's hint and error, for `aria-describedby`. */
export function describedBy(name: string, hint: ReactNode, error?: string) {
  return (
    [hint ? `${name}-hint` : "", error ? `${name}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

/** The message a field was refused with, announced with the error prefix. */
export function FieldError({ name, error }: { name: string; error: string }) {
  const c = useBlockContent();
  return (
    <p className="field-error-message" id={`${name}-error`}>
      <span className="sr-only">{c.errorPrefix} </span>
      {error}
    </p>
  );
}

/** A labelled field's label, hint and error, above its control. */
export function FieldFrame({
  name,
  label,
  hint,
  error,
  required,
  children,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required: boolean;
  children: ReactNode;
}) {
  const c = useBlockContent();
  return (
    <div className={`field ${error ? "field-error" : ""}`}>
      <label htmlFor={name}>
        {label}
        {!required && <span className="optional"> ({c.optional})</span>}
      </label>
      {hint && (
        <p className="field-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {error && <FieldError name={name} error={error} />}
      {children}
    </div>
  );
}

/**
 * One labelled text input, textarea or option list, with its hint and error
 * tied to it. The input's id and name are the field's name.
 */
export function InputField({
  name,
  label,
  value,
  onChange,
  error,
  hint,
  multiline = false,
  type = "text",
  required = true,
  options,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
  type?: string;
  required?: boolean;
  options?: readonly FieldOptionWords[];
  /** Numeric and date bounds, passed to the input as written. */
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  const c = useBlockContent();
  const props = {
    id: name,
    name,
    value,
    onChange: (
      e: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onChange(e.target.value),
    "aria-invalid": !!error,
    "aria-describedby": describedBy(name, hint, error),
    required,
  };
  return (
    <FieldFrame
      name={name}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      {options?.length ? (
        <select {...props}>
          <option value="">{c.selectOption}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {optionWords(c, option)}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <Textarea {...props} />
      ) : (
        <Input
          {...props}
          type={type}
          {...(min !== undefined ? { min } : {})}
          {...(max !== undefined ? { max } : {})}
          {...(step !== undefined ? { step } : {})}
        />
      )}
    </FieldFrame>
  );
}

/** A yes or no choice that may be left unanswered, with a line under it. */
export function YesNoField({
  name,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  note,
}: {
  name: string;
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  error?: string;
  hint?: string;
  required: boolean;
  note?: ReactNode;
}) {
  const c = useBlockContent();
  return (
    <FieldFrame
      name={name}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <select
        id={name}
        value={value === undefined ? "" : String(value)}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, hint, error)}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? undefined
              : event.target.value === "true",
          )
        }
      >
        <option value="">{c.notSupplied}</option>
        <option value="true">{c.yes}</option>
        <option value="false">{c.no}</option>
      </select>
      {note}
    </FieldFrame>
  );
}

/** A group of checkboxes, one per option, whose answer is the checked values. */
export function ChoiceField({
  name,
  label,
  value,
  options,
  onChange,
  error,
  hint,
}: {
  name: string;
  label: string;
  value: readonly string[];
  options: readonly FieldOptionWords[];
  onChange: (value: string[]) => void;
  error?: string;
  hint?: string;
}) {
  const c = useBlockContent();
  return (
    <fieldset
      id={name}
      tabIndex={-1}
      className={`field choice-field ${error ? "field-error" : ""}`}
      aria-describedby={`${name}-hint${error ? ` ${name}-error` : ""}`}
      aria-invalid={!!error}
    >
      <legend>{label}</legend>
      <p className="field-hint" id={`${name}-hint`}>
        {hint ?? c.choicesHint}
      </p>
      {error && (
        <p className="field-error-message" id={`${name}-error`}>
          <span className="sr-only">{c.errorPrefix} </span>
          {error}
        </p>
      )}
      {options.map((option) => (
        <label className="checkbox-option" key={option.value}>
          <input
            type="checkbox"
            name={name}
            value={option.value}
            checked={value.includes(option.value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, option.value]
                  : value.filter((item) => item !== option.value),
              )
            }
          />
          <span>{optionWords(c, option)}</span>
        </label>
      ))}
    </fieldset>
  );
}
