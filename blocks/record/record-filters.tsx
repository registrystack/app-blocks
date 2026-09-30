import { useState } from "react";
import { Search } from "lucide-react";
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
  return (
    <form
      className="search-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(search);
      }}
    >
      <div>
        <label htmlFor="identifier-search">{label}</label>
        <Input
          id="identifier-search"
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
