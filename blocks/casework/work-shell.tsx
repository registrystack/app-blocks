import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  LogOut,
  UserRoundCog,
  Menu,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useSignOut } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCaseworkContent } from "@/blocks/casework/casework-content";
import { useLocale } from "@/blocks/lib/content";
import { fill } from "@/blocks/lib/format";
import { Notice, caseworkLocalZone } from "@/blocks/casework/shared";
import { CommandPalette, type Place } from "@/blocks/casework/command-palette";
import {
  modifierLabel,
  ShortcutsHelp,
  ShortcutsProvider,
  useShortcut,
  useShortcutsSetting,
} from "@/blocks/casework/shortcuts";

/**
 * The staff work shell: a dark sidebar that is a plain list of places, one
 * dense header with the breadcrumb, search and account, and the page. It is built for the officer who lives in it all day,
 * so it spends no height on a service name or a signed-in line: the account
 * menu carries those, the palette and the shortcuts carry the navigation.
 * Which places exist, which one is current for a route, and where a route
 * sends the officer are all decisions specific to a session's role; the
 * caller makes them and hands this shell the result.
 */

export interface NavItem extends Place {
  icon: LucideIcon;
  /** Paths under which this place is the current one, beyond its own. */
  under?: string[];
}

export type NavGroup = NavItem[];

/** Ends the session and signs the officer in again as another account. */
export interface SwitchAccountAction {
  label: string;
  /** Rejects when the sign-out is refused, so the officer stays signed in and is told. */
  run: () => Promise<void>;
}

/**
 * The current place is the one whose path, or one of the paths it stands
 * under, is the longest prefix of the route. Query parameters belong to the
 * page and never change which place is current.
 */
export function currentPlace(items: NavItem[], path: string): NavItem | null {
  let best: NavItem | null = null;
  let bestLength = -1;
  for (const item of items) {
    for (const prefix of [item.path, ...(item.under ?? [])]) {
      const matches =
        prefix === "/"
          ? path === "/"
          : path === prefix || path.startsWith(`${prefix}/`);
      if (matches && prefix.length > bestLength) {
        best = item;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

/**
 * The brand at the head of the sidebar: a mark of three leaning bars, the
 * service name and the beta chip.
 */
function Brand({ brand, href }: { brand: string; href: string }) {
  const c = useCaseworkContent();
  return (
    <a href={href} className="brand">
      <svg
        className="work-brand-mark"
        viewBox="0 0 28 28"
        width="28"
        height="28"
        aria-hidden="true"
      >
        <path d="M6 20 9 8h3.5L9.5 20zM12 20l3-12h3.5L15.5 20zM18 20l3-12h3.5L21.5 20z" />
      </svg>
      <span className="work-brand-name">{brand}</span>
      <span className="beta">{c.beta}</span>
    </a>
  );
}

/**
 * The places, grouped by the dividers between them. The sidebar shows them on
 * a wide screen and the menu drawer on a narrow one; only one is ever shown,
 * so the page always has exactly one main navigation.
 */
function Places({
  groups,
  current,
  hrefFor,
  onNavigate,
}: {
  groups: NavGroup[];
  current: NavItem | null;
  hrefFor: (path: string) => string;
  onNavigate?: () => void;
}) {
  const c = useCaseworkContent();
  return (
    <nav aria-label={c.navMain} className="work-places">
      {groups.map((group, index) => (
        <div key={index} className="work-nav-group">
          {group.map((item) => (
            <a
              key={item.path}
              href={hrefFor(item.path)}
              aria-current={current === item ? "page" : undefined}
              onClick={onNavigate}
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * The signed-in officer's own corner: their name and time zone, the caller's
 * own choices, the switch for single-key shortcuts, switching account where
 * the caller offers it, and sign-out. A failed sign-out or switch leaves the
 * officer signed in and says so; it does not stop them working.
 */
function AccountMenu({
  displayName,
  container,
  choices,
  switchAccount,
  renderSignOutError,
}: {
  displayName?: string;
  container: RefObject<HTMLElement | null>;
  choices?: ReactNode;
  switchAccount?: SwitchAccountAction;
  /** Renders the host's own error when sign-out fails. Falls back to a generic notice when omitted. */
  renderSignOutError?: (error: unknown) => ReactNode;
}) {
  const c = useCaseworkContent();
  const [shortcuts, setShortcuts] = useShortcutsSetting();
  const signOut = useSignOut();
  const [error, setError] = useState<unknown>(null);
  const name = displayName ?? c.account;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="work-account"
              aria-label={name}
            />
          }
        >
          <CircleUserRound aria-hidden="true" className="work-account-icon" />
          <span>{name}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="work-account-menu"
          container={container}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="work-account-name">{name}</span>
              <span className="work-account-zone">{caseworkLocalZone()}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {choices}
          <DropdownMenuCheckboxItem
            checked={shortcuts}
            onCheckedChange={setShortcuts}
          >
            {c.shortcutsSetting}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {switchAccount && (
            <DropdownMenuItem
              onClick={() => void switchAccount.run().catch(setError)}
            >
              <UserRoundCog size={16} aria-hidden="true" />
              {switchAccount.label}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => void signOut().catch(setError)}>
            <LogOut size={16} aria-hidden="true" />
            {c.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error != null &&
        (renderSignOutError ? (
          renderSignOutError(error)
        ) : (
          <Notice tone="warning">{c.signOutFailed}</Notice>
        ))}
    </>
  );
}

function Frame({
  displayName,
  brand,
  description,
  accountChoices,
  switchAccount,
  groups,
  current,
  route,
  hrefFor,
  navigate,
  renderSignOutError,
  children,
}: {
  displayName?: string;
  brand: string;
  description?: string;
  accountChoices?: ReactNode;
  switchAccount?: SwitchAccountAction;
  groups: NavGroup[];
  current: NavItem | null;
  route: string;
  hrefFor: (path: string) => string;
  navigate: (path: string) => void;
  renderSignOutError?: (error: unknown) => ReactNode;
  children: ReactNode;
}) {
  const c = useCaseworkContent();
  const locale = useLocale();
  const items = useMemo(() => groups.flat(), [groups]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The account menu opens inside the header, and so inside its landmark.
  const header = useRef<HTMLElement>(null);
  // Any route change, a link in the drawer or a shortcut, closes the drawer.
  useEffect(() => setMenuOpen(false), [route]);
  useShortcut({ key: "k", label: c.shortcutGoTo, chord: "mod" }, () =>
    setPaletteOpen(true),
  );
  useShortcut({ key: "?", label: c.shortcutHelp }, () => setHelpOpen(true));
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <div className="work-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        {c.skip}
      </a>
      <aside className="work-sidebar" aria-label={c.staffName}>
        <div className="work-sidebar-inner">
          <Brand brand={brand} href={hrefFor("/")} />
          <p className="work-workspace">{c.staffName}</p>
          {description && (
            <p className="work-workspace-description">{description}</p>
          )}
          <Places groups={groups} current={current} hrefFor={hrefFor} />
          <p className="work-sidebar-note">{c.footerNote}</p>
        </div>
      </aside>
      <div className="work-column">
        <header ref={header} className="work-header">
          <Button
            variant="ghost"
            size="icon"
            className="work-menu"
            aria-label={c.navMenu}
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <a href={hrefFor("/")} className="work-header-brand">
            {brand}
          </a>
          <p className="work-crumb">
            <span>{brand}</span>
            {current && (
              <>
                <ChevronRight size={14} aria-hidden="true" />
                <span>{current.label}</span>
              </>
            )}
          </p>
          <button
            type="button"
            className="work-search"
            onClick={() => setPaletteOpen(true)}
            aria-label={c.goTo}
          >
            <Search size={15} aria-hidden="true" />
            <span aria-hidden="true">{c.goToPlaceholder}</span>
            <Kbd aria-hidden="true">
              {fill(
                c.shortcutChord,
                { modifier: modifierLabel(c), key: "K" },
                locale,
              )}
            </Kbd>
          </button>
          <AccountMenu
            displayName={displayName}
            container={header}
            choices={accountChoices}
            switchAccount={switchAccount}
            renderSignOutError={renderSignOutError}
          />
        </header>
        <main id="main" tabIndex={-1} className="work-main">
          {!online && <Notice tone="warning">{c.offline}</Notice>}
          {children}
        </main>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="inline-start"
          closeLabel={c.close}
          className="work-menu-sheet w-72"
        >
          <SheetHeader>
            <SheetTitle>{brand}</SheetTitle>
          </SheetHeader>
          <Places
            groups={groups}
            current={current}
            hrefFor={hrefFor}
            onNavigate={() => setMenuOpen(false)}
          />
          <p className="work-sidebar-note">{c.footerNote}</p>
        </SheetContent>
      </Sheet>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        places={items}
        navigate={navigate}
      />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

export interface WorkShellProps {
  /** The signed-in officer's display name, shown in the header and menu. */
  displayName?: string;
  /** The service name, shown in the header and the mobile drawer. */
  brand: string;
  /** What the app is for, shown under the workspace name in the sidebar. */
  description?: string;
  /**
   * Further choices in the account menu, above the shortcuts setting, each
   * group ending in a separator. They render only while the menu is open.
   */
  accountChoices?: ReactNode;
  /** Offers switching account in the account menu where given. */
  switchAccount?: SwitchAccountAction;
  /** The places this session can go, grouped by the dividers between them. */
  groups: NavGroup[];
  /** The place the current route stands for, or null off every place. */
  current: NavItem | null;
  /** The current route, so a navigation closes the mobile drawer. */
  route: string;
  /** Builds an in-app link's href from its path. The shell assumes no router of its own. */
  hrefFor: (path: string) => string;
  /** Sends the officer to a path chosen outside a link, such as the palette. */
  navigate: (path: string) => void;
  /** Renders the host's own error when sign-out fails. Falls back to a generic notice when omitted. */
  renderSignOutError?: (error: unknown) => ReactNode;
  children: ReactNode;
}

export function WorkShell({
  displayName,
  brand,
  description,
  accountChoices,
  switchAccount,
  groups,
  current,
  route,
  hrefFor,
  navigate,
  renderSignOutError,
  children,
}: WorkShellProps) {
  return (
    <ShortcutsProvider>
      <TooltipProvider>
        <Frame
          displayName={displayName}
          brand={brand}
          description={description}
          accountChoices={accountChoices}
          switchAccount={switchAccount}
          groups={groups}
          current={current}
          route={route}
          hrefFor={hrefFor}
          navigate={navigate}
          renderSignOutError={renderSignOutError}
        >
          {children}
        </Frame>
      </TooltipProvider>
    </ShortcutsProvider>
  );
}
