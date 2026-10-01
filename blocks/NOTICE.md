# Component provenance

Everything under `ui/` comes from shadcn/ui on Base UI, style `base-nova`. The registry revision is the one served by `https://ui.shadcn.com/r/styles/base-nova/<name>.json` with `last-modified: Thu, 10 Sep 2026 02:10:18 GMT`, copied on 11 September 2026 with `shadcn` CLI 4.21.0.

Copied unchanged, cross-component imports included: they keep the `@/components/ui/<name>` alias, which `components.json` and `tsconfig.json` here, and the project's `tsconfig.base.json`, resolve to `ui/`:

`alert.tsx`, `alert-dialog.tsx`, `badge.tsx`, `checkbox.tsx`, `empty.tsx`, `field.tsx`, `input-group.tsx`, `label.tsx`, `select.tsx`, `separator.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`.

Copied the same way from the registry revision with `last-modified: Wed, 09 Sep 2026 23:20:39 GMT` on 11 September 2026 with the same CLI: `dialog.tsx`, `dropdown-menu.tsx`, `kbd.tsx`, `popover.tsx`, `sheet.tsx`, `tooltip.tsx`. `Tooltip` needs a `TooltipProvider` above it; `WorkShell` supplies one.

Carrying local differences:

- `button.tsx` keeps the kit's variant and size set, a 44-pixel minimum target, wrapping labels and a native button default type. It composes `useRender` from `@base-ui/react/use-render` rather than the Base UI button primitive, because that primitive adds `role="button"` and the kit renders links through `render`. `nativeButton` is accepted so registry components type-check against it, and dropped rather than passed to the DOM.
- `combobox.tsx` requires an accessible name where the copy leaves a control unnamed: `ComboboxTrigger` takes a `label` for the chevron-only button, `ComboboxInput` requires `triggerLabel` whenever it shows that trigger, and `ComboboxList` requires an `aria-label` because it is portalled away from the field it belongs to.
- `input.tsx` predates the CLI adoption and carries the kit's `Input` and `Textarea` with the same 44-pixel minimum target.

Base UI is the single primitive family in these blocks; it does not combine Base UI with Radix.

## Registry packaging

`registry.json` packages these files as a shadcn registry, `@registrystack/app-blocks` (see
`README.md` for how to build it and add an item). Every file under `ui/` ships as its own kit
item, including the ones that are unmodified from upstream: an install then always matches what
this repository actually carries and tests, and needs no network access to shadcn.com. `shadcn
add <name> --diff` against the live `base-nova` registry, run 29 September 2026, is what
confirmed which files still match upstream and which have already drifted since the copy dates
above:

| File | Status vs. live upstream (29 Sep 2026) | Kit item |
|---|---|---|
| `alert.tsx` | unmodified (cosmetic formatting only) | `ui-alert` |
| `alert-dialog.tsx` | unmodified (cosmetic formatting only) | `ui-alert-dialog` |
| `badge.tsx` | unmodified (cosmetic formatting only) | `ui-badge` |
| `button.tsx` | modified, intentionally (see above) | `ui-button` |
| `checkbox.tsx` | drifted: indicator corner radius changed (`rounded-none` to `rounded-[4px]`), `"use client"` dropped | `ui-checkbox` |
| `combobox.tsx` | modified, intentionally (see above) | `ui-combobox` |
| `dialog.tsx` | drifted: close button's `closeLabel` prop removed, upstream hardcodes "Close"; `"use client"` dropped | `ui-dialog` |
| `dropdown-menu.tsx` | drifted: `container` prop and portal's `contents`-class wrapping removed; `"use client"` dropped | `ui-dropdown-menu` |
| `empty.tsx` | unmodified (cosmetic formatting only) | `ui-empty` |
| `field.tsx` | unmodified (cosmetic formatting only) | `ui-field` |
| `input.tsx` | modified, intentionally (see above) | `ui-input` |
| `input-group.tsx` | unmodified in substance (`"use client"` dropped) | `ui-input-group` |
| `kbd.tsx` | unmodified (cosmetic formatting only) | `ui-kbd` |
| `label.tsx` | unmodified (cosmetic formatting only) | `ui-label` |
| `popover.tsx` | drifted: `keepMounted` prop removed | `ui-popover` |
| `select.tsx` | unmodified (cosmetic formatting only) | `ui-select` |
| `separator.tsx` | unmodified (`"use client"` added upstream) | `ui-separator` |
| `sheet.tsx` | drifted: close button's `closeLabel` prop removed, upstream hardcodes "Close" | `ui-sheet` |
| `table.tsx` | drifted: header and cell padding, weight and hover colours changed | `ui-table` |
| `tabs.tsx` | drifted: inactive tab's text colour changed (`text-muted-foreground` to `text-foreground/60`) | `ui-tabs` |
| `textarea.tsx` | unmodified (cosmetic formatting only) | `ui-textarea` |
| `tooltip.tsx` | unmodified (cosmetic formatting only) | `ui-tooltip` |

None of the removed props (`closeLabel`, `container`, `keepMounted`) are used by any other block
here, so the drift in the seven affected files has not broken anything in this kit, but it does
mean the upstream item's current API is narrower than what these files still offer. An adopter
who wants the live upstream version of any file in this table instead of the kit's copy can run
`shadcn add <name>` themselves against `https://ui.shadcn.com`; this registry does not do that
for them, on purpose, so that what installs from it is always what this repository tests.

## Known gaps

- `@registrystack/app-runtime`, the one runtime npm dependency several blocks declare, is
  `workspace:*` in this monorepo. Each release publishes it to npm's `next` dist-tag from the
  public repository `registrystack/app-blocks`, after the maintainer approves the publish. Until
  the first stable version, npm's `latest` tag holds only an inert `0.0.0` placeholder, so an
  install that names no version gets the placeholder. `registry.json` declares it at a range on
  its current version (`@registrystack/app-runtime@~0.37.0-next.0`), which resolves to the newest
  `next` release of that version. The kit's `test:registry-install` packs the workspace package
  with `pnpm pack` and serves it from a loopback registry for the duration of the test, so it
  proves what this repository builds, not what npm serves.

Upstream license, shadcn/ui:

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
