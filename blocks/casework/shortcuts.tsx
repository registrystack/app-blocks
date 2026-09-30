import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import {
  useRememberedState,
  type BrowserMemory,
} from "@registrystack/app-runtime/react";
import { useCaseworkContent } from "@/blocks/casework/casework-content";

/**
 * Keyboard shortcuts for the work shell. A single key fires only while no
 * text field, dialog or menu has focus and only while the officer has left
 * them on: WCAG 2.1.4 asks that single-character shortcuts can be switched
 * off, and the switch lives in the account menu. A chord with the platform
 * modifier (Cmd on macOS, Ctrl elsewhere) fires everywhere, like a browser
 * shortcut does.
 */

export interface Shortcut {
  /** The key as `KeyboardEvent.key` reports it, such as `j` or `?`. */
  key: string;
  /** What the key does, for the shortcuts list. */
  label: string;
  /** Whether the platform modifier is part of the shortcut. */
  chord?: "mod";
}

interface Registered extends Shortcut {
  handler: () => void;
}

interface ShortcutsState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  register: (shortcut: Registered) => () => void;
  shortcuts: Shortcut[];
}

const ShortcutsContext = createContext<ShortcutsState | null>(null);

/** Where the switch is kept between sessions: "off" is the only value read. */
const settingKey = "appkit.shortcuts";
const setting: BrowserMemory<boolean> = {
  decode: (raw) => raw !== "off",
  encode: (on) => (on ? "on" : "off"),
};

/** An element that takes typed text, where a single key must stay a character. */
function takesText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** An element inside a popup, where a single key belongs to that popup. */
function inPopup(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null
  );
}

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  // Storage the browser refuses reads as on, and a refused write keeps the
  // setting for the session only; the switch still works.
  const [enabled, setEnabled] = useRememberedState(settingKey, true, setting);
  const registry = useRef(new Map<symbol, Registered>());
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const register = useCallback((shortcut: Registered) => {
    const id = Symbol(shortcut.key);
    registry.current.set(id, shortcut);
    const list = () =>
      setShortcuts(
        [...registry.current.values()].map(({ handler: _, ...rest }) => rest),
      );
    list();
    return () => {
      registry.current.delete(id);
      list();
    };
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.repeat) return;
      const mod = event.metaKey || event.ctrlKey;
      const single = !mod;
      if (
        single &&
        (!enabled || takesText(event.target) || inPopup(event.target))
      )
        return;
      for (const shortcut of registry.current.values()) {
        const wantsMod = shortcut.chord === "mod";
        if (wantsMod !== mod) continue;
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
        event.preventDefault();
        shortcut.handler();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
  const value = useMemo(
    () => ({ enabled, setEnabled, register, shortcuts }),
    [enabled, setEnabled, register, shortcuts],
  );
  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

function useShortcutsContext(): ShortcutsState {
  const context = useContext(ShortcutsContext);
  if (!context) throw new Error("ShortcutsProvider is required.");
  return context;
}

/** The officer's switch for single-key shortcuts. */
export function useShortcutsSetting(): [boolean, (enabled: boolean) => void] {
  const { enabled, setEnabled } = useShortcutsContext();
  return [enabled, setEnabled];
}

/**
 * Binds a key for as long as the calling screen is mounted. The handler may
 * change every render; the binding does not.
 */
export function useShortcut(
  shortcut: Shortcut,
  handler: () => void,
  active = true,
) {
  const { register } = useShortcutsContext();
  const latest = useRef(handler);
  latest.current = handler;
  const { key, label, chord } = shortcut;
  useEffect(() => {
    if (!active) return;
    return register({
      key,
      label,
      ...(chord ? { chord } : {}),
      handler: () => latest.current(),
    });
  }, [register, key, label, chord, active]);
}

/** The modifier key as this platform names it. */
export function modifierLabel(): string {
  return typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";
}

function keyLabel(shortcut: Shortcut): string {
  const key =
    shortcut.key === " "
      ? "Space"
      : shortcut.key.length === 1
        ? shortcut.key.toUpperCase()
        : shortcut.key;
  return shortcut.chord === "mod" ? `${modifierLabel()} ${key}` : key;
}

/** The list of every shortcut bound right now, opened with `?`. */
export function ShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = useCaseworkContent();
  const { shortcuts } = useShortcutsContext();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={c.close} className="shortcuts-help">
        <DialogHeader>
          <DialogTitle>{c.shortcutsTitle}</DialogTitle>
          <DialogDescription>{c.shortcutsDescription}</DialogDescription>
        </DialogHeader>
        <table>
          <thead>
            <tr>
              <th scope="col">{c.shortcutKey}</th>
              <th scope="col">{c.shortcutDoes}</th>
            </tr>
          </thead>
          <tbody>
            {shortcuts.map((shortcut) => (
              <tr key={`${shortcut.chord ?? ""}${shortcut.key}`}>
                <td>
                  <Kbd>{keyLabel(shortcut)}</Kbd>
                </td>
                <td>{shortcut.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
