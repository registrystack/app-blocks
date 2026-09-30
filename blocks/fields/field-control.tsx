import { FieldValue } from "@/blocks/fields/field-value";
import { FieldError } from "@/blocks/fields/input-field";
import {
  fieldKind,
  useFieldRenderers,
  type FieldControlProps,
} from "@/blocks/fields/renderers";

import { controlValue } from "@/blocks/fields/controls";
export { controlValue };

/**
 * The control that answers one field, chosen by its kind. A read-only field,
 * or a kind with no control, shows its label, any refusal and its recorded
 * value instead.
 */
export function FieldControl(props: FieldControlProps) {
  const renderers = useFieldRenderers();
  const { field } = props;
  const { Control } = renderers[fieldKind(field, renderers)]!;
  if (field.readOnly || !Control)
    return (
      <div
        className={`field ${props.error ? "field-error" : ""}`}
        id={field.id}
      >
        <p className="field-label">{field.label}</p>
        {props.error && <FieldError name={field.id} error={props.error} />}
        <div>
          <FieldValue field={field} value={props.value} />
        </div>
      </div>
    );
  return <Control {...props} />;
}
