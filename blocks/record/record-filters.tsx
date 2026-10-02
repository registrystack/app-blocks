import { useId, useState } from "react";
import { Search } from "lucide-react";
import type { EntityModel } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBlockContent } from "@/blocks/lib/content";

/**
 * The one-field identifier search a record list offers. `label` and `hint`
 * are the app's own wording for the field the model filters on; the submit
 * and clear words are generic. Clear only shows once a search is applied.
 */
export function RecordSearchForm({
  label,
  hint,
  applied,
  onSearch,
  onClear,
}: {
  label: string;
  hint: string;
  /** The applied filter value, or "" when none is applied. */
  applied: string;
  onSearch: (value: string) => void;
  onClear: () => void;
}) {
  const c = useBlockContent();
  const [search, setSearch] = useState(applied);
  const inputId = useId();
  return (
    <form
      className="search-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(search);
      }}
    >
      <div>
        <label htmlFor={inputId}>{label}</label>
        <Input
          id={inputId}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={hint}
        />
      </div>
      <Button type="submit" variant="outline">
        <Search />
        {c.search}
      </Button>
      {applied && (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            onClear();
          }}
        >
          {c.clearSearch}
        </Button>
      )}
    </form>
  );
}

/** The choice that selects a record where the field is empty, in a filter select. */
const EMPTY_CHOICE = "empty";
const VALUE_PREFIX = "value:";

/**
 * One select per filter field that offers options, each narrowing the list as
 * soon as a choice is made. A nullable field with an empty label also offers
 * the records where it is empty, worded by that label. `applied` maps a field
 * id to its chosen value, or null for "empty"; `onChange` gets the field and
 * its new value, undefined when the choice applies no filter. `allLabel` words
 * that choice, `BlockContent.filterAll` by default.
 */
export function RecordFilterBar({
  entity,
  applied,
  onChange,
  allLabel,
}: {
  entity: EntityModel;
  applied: Readonly<Record<string, string | null>>;
  onChange: (field: string, value: string | null | undefined) => void;
  allLabel?: string;
}) {
  const c = useBlockContent();
  const selects = entity.list.filters.flatMap((filter) => {
    const field = entity.fields.find((item) => item.id === filter.field);
    return field?.options?.length ? [{ filter, field }] : [];
  });
  if (selects.length === 0) return null;
  return (
    <div className="filter-bar">
      {selects.map(({ filter, field }) => {
        const current = applied[field.id];
        const value =
          current === null
            ? EMPTY_CHOICE
            : current === undefined
              ? ""
              : `${VALUE_PREFIX}${current}`;
        const id = `filter-${field.id}`;
        return (
          <div key={field.id}>
            <label htmlFor={id}>{filter.label}</label>
            <select
              id={id}
              value={value}
              onChange={(e) => {
                const next = e.target.value;
                onChange(
                  field.id,
                  next === ""
                    ? undefined
                    : next === EMPTY_CHOICE
                      ? null
                      : next.slice(VALUE_PREFIX.length),
                );
              }}
            >
              <option value="">{allLabel ?? c.filterAll}</option>
              {field.nullable && field.emptyLabel && (
                <option value={EMPTY_CHOICE}>{field.emptyLabel}</option>
              )}
              {field.options!.map((option) => (
                <option
                  key={option.value}
                  value={`${VALUE_PREFIX}${option.value}`}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
