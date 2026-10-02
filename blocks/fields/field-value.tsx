import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import { useBlockContent } from "@/blocks/lib/content";
import { fieldKind, useFieldRenderers } from "@/blocks/fields/renderers";

/**
 * One recorded value, in the words and format its field model describes. A
 * missing value or an empty list reads as the field's own empty label, else
 * as not recorded, and a blank answer in the words the content keeps for that
 * field; any other value goes to the
 * renderer the field's kind chooses.
 */
export function FieldValue({
  field,
  value,
}: {
  field: FieldModel;
  value: JsonValue | undefined;
}) {
  const c = useBlockContent(),
    renderers = useFieldRenderers();
  const none = field.emptyLabel ?? c.notRecorded;
  if (value === undefined || value === null) return <>{none}</>;
  if (value === "") return <>{c.blankValues[field.id] ?? none}</>;
  if (Array.isArray(value) && value.length === 0) return <>{none}</>;
  const { Value } = renderers[fieldKind(field, renderers)]!;
  return <Value field={field} value={value} />;
}
