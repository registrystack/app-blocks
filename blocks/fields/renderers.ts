import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import type { FieldModel, JsonValue } from "@registrystack/app-runtime";
import {
  BooleanControl,
  ChoicesControl,
  DateControl,
  EnumControl,
  NumberControl,
  TextControl,
  TextareaControl,
} from "@/blocks/fields/controls";
import {
  BooleanValue,
  DateValue,
  EnumValue,
  JsonValueView,
  NumberValue,
  TextValue,
} from "@/blocks/fields/values";
import { GroupControl, GroupValue } from "@/blocks/fields/group-field";

/** A recorded value to show; missing, blank and empty values never reach it. */
export interface FieldValueProps {
  field: FieldModel;
  value: JsonValue;
}

export interface FieldControlProps {
  field: FieldModel;
  value: JsonValue | undefined;
  /** The answer as the form keeps it: undefined when there is none. */
  onChange: (value: JsonValue | undefined) => void;
  error?: string;
  /** A line shown under the control. */
  note?: ReactNode;
}

/**
 * How one kind of field shows a value and, when it can be entered, takes one.
 * A kind without a `Control` is shown read-only in a form.
 */
export interface FieldRenderer {
  Value: ComponentType<FieldValueProps>;
  Control?: ComponentType<FieldControlProps>;
}

export type FieldRenderers = Readonly<Record<string, FieldRenderer>>;

/** An override of some kinds, or of one half of a kind. */
export type FieldRendererOverrides = Readonly<
  Record<string, Partial<FieldRenderer>>
>;

export const defaultRenderers: FieldRenderers = {
  text: { Value: TextValue, Control: TextControl },
  textarea: { Value: TextValue, Control: TextareaControl },
  integer: { Value: NumberValue, Control: NumberControl },
  number: { Value: NumberValue, Control: NumberControl },
  boolean: { Value: BooleanValue, Control: BooleanControl },
  date: { Value: DateValue, Control: DateControl },
  enum: { Value: EnumValue, Control: EnumControl },
  "multi-enum": { Value: JsonValueView, Control: ChoicesControl },
  reference: { Value: TextValue, Control: TextControl },
  "json-value": { Value: JsonValueView },
  group: { Value: GroupValue, Control: GroupControl },
};

/**
 * The renderer a field uses: the one its widget names when the map has it,
 * otherwise the one its type, options, reference and format choose.
 */
export function fieldKind(
  field: FieldModel,
  renderers: FieldRenderers = defaultRenderers,
): string {
  if (field.widget && Object.hasOwn(renderers, field.widget))
    return field.widget;
  if (field.type === "group") return "group";
  if (field.type === "object") return "json-value";
  if (field.type === "array")
    return field.options ? "multi-enum" : "json-value";
  if (field.type === "boolean") return "boolean";
  if (field.options) return "enum";
  if (field.type === "integer" || field.type === "number") return field.type;
  if (field.reference) return "reference";
  if (field.format === "date") return "date";
  return "text";
}

const FieldRenderersContext = createContext<FieldRenderers>(defaultRenderers);

export function useFieldRenderers(): FieldRenderers {
  return useContext(FieldRenderersContext);
}

/**
 * Replaces renderers for the blocks inside it. An override may add a kind a
 * widget can name, or replace only the `Value` or the `Control` of a kind and
 * keep the other half.
 */
export function FieldRenderersProvider({
  renderers,
  children,
}: {
  renderers: FieldRendererOverrides;
  children?: ReactNode;
}) {
  const outer = useFieldRenderers();
  const merged = useMemo(() => {
    const next: Record<string, FieldRenderer> = { ...outer };
    for (const [kind, override] of Object.entries(renderers)) {
      const renderer = { ...outer[kind], ...override };
      if (!renderer.Value)
        throw new Error(`The field renderer "${kind}" needs a Value.`);
      next[kind] = renderer as FieldRenderer;
    }
    return next;
  }, [outer, renderers]);
  return createElement(
    FieldRenderersContext.Provider,
    { value: merged },
    children,
  );
}
