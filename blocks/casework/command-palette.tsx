import { useState } from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import {
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useCaseworkContent } from "@/blocks/casework/casework-content";

/** A place the palette can jump to. */
export interface Place {
  path: string;
  label: string;
}

/**
 * The jump palette: a dialog holding one combobox whose list is rendered
 * inline, so the officer types a place's name and presses Enter. The
 * combobox's open state is the dialog's, as Base UI asks for this
 * composition, so closing either closes both.
 */
export function CommandPalette({
  open,
  onOpenChange,
  places,
  navigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  places: Place[];
  /** Where picking a place goes. The palette assumes no router of its own. */
  navigate: (path: string) => void;
}) {
  const c = useCaseworkContent();
  const [query, setQuery] = useState("");
  const close = () => {
    setQuery("");
    onOpenChange(false);
  };
  return (
    <ComboboxPrimitive.Root
      items={places}
      inline
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      value={null}
      onValueChange={(place: Place | null) => {
        if (!place) return;
        close();
        navigate(place.path);
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(place: Place) => place.label}
      autoHighlight
      modal={false}
    >
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => !next && close()}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Popup
            className="command-palette"
            aria-label={c.goTo}
          >
            <ComboboxInput
              placeholder={c.goToPlaceholder}
              showTrigger={false}
              autoFocus
              aria-label={c.goTo}
            />
            <ComboboxEmpty>{c.noMatchingPlace}</ComboboxEmpty>
            <ComboboxList aria-label={c.goToList}>
              {(place: Place) => (
                <ComboboxItem key={place.path} value={place}>
                  {place.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </DialogPrimitive.Popup>
        </DialogPortal>
      </DialogPrimitive.Root>
    </ComboboxPrimitive.Root>
  );
}
