# @registrystack/app-blocks registry

`registry.json` packages the reusable pieces under this directory (`lib/`, `ui/`, `fields/`,
`record/`, `request/`) as a shadcn registry an adopter installs with the `shadcn` CLI, one item
per file or cohesive group. Every `ui/` file ships as its own kit item, including the ones that
are unmodified from upstream shadcn, so an install never needs network access to shadcn.com and
always matches what this repository tests. See `NOTICE.md` for where each `ui/` file comes from,
which ones carry local changes or have drifted from live upstream, and how the
`@registrystack/app-runtime` dependency reaches npm. This directory is maintained in the
Registry Stack App Kit and published without its tests; the commands below run there.

## Building

    pnpm run build:registry

Runs `shadcn build registry.json --output registry-dist` from this directory, writing one JSON
file per item plus a copied index to `registry-dist/` (git-ignored, rebuilt from `registry.json`
each time; nothing under `registry-dist/` is checked in or hand-edited).

## Checking it installs

    pnpm run test:registry-install

Builds the registry, packs `@registrystack/app-runtime` and serves both it and the built items
from a loopback HTTP server, scaffolds a throwaway
React + TypeScript project with a fresh project's default shadcn aliases, runs `shadcn add` for
`record-form`, `request-changes`, `field-renderers`, `request-attachment-slots` and
`ui-input-group` (pulling in `ui-field` and `ui-textarea`, two files that are unmodified from
upstream but still shipped as kit items rather than left as a live registryDependency), and
typechecks the result. It talks only to `127.0.0.1` and the monorepo's own pnpm store; nothing is
published or fetched from a real registry, and the `shadcn` CLI is never pointed at
`ui.shadcn.com`. The fixture's default npm registry is pointed at a closed local port rather than
left at whatever the ambient config says, so a package that was not already in the shared store
would fail the install with a connection error instead of silently reaching the real registry;
the check passing is itself the proof that nothing here needed real network access.

## Adding an item

1. Add the file(s) under `lib/`, `ui/`, `fields/`, `record/` or `request/` as normal.
2. Add an entry to `registry.json`: a unique `name`, the right `type`
   (`registry:lib` | `registry:ui` | `registry:component` | `registry:block`), a `title`, an
   adopter-facing `description`, and `files` with a `target` using the alias placeholders
   (`@lib/`, `@ui/`, `@components/`, `@hooks/`) an adopter's own `components.json` resolves.
3. Declare every bare package import the new file makes in `dependencies`, pinned to the
   version in this package's `package.json` (`react` is assumed and does not need declaring).
   `@registrystack/app-runtime` is the exception: declare it with the same `~` range every other
   item declares it with, a range that must admit the version in
   `packages/app-runtime/package.json`.
4. Declare every other kit item the new file imports from in `registryDependencies`, addressed
   as `@registrystack/<item-name>`, including a `ui/` file that is unmodified from upstream
   shadcn: this registry ships its own copy of every `ui/` file rather than pointing at a live
   upstream item, so the reference is always `@registrystack/ui-<name>`, never a bare shadcn
   name. Diff a `ui/` file against live upstream yourself with `shadcn add <name> --diff` if you
   want to know whether it still matches; NOTICE.md records the answer as of its last check.
5. Run `pnpm vitest run blocks/test/registry-completeness.test.ts` from `project/`: it fails if
   the new file is not registered in exactly one item, if an import does not resolve to the
   same item or a declared `registryDependencies` entry, if a bare import is undeclared, or if
   a declared `@registrystack/app-runtime` range does not admit the runtime's own version.
6. Run `pnpm run build:registry` and `pnpm run test:registry-install` to confirm the item
   actually installs and typechecks in a fresh project.

## Hosting

The registry is served at `https://ui.registrystack.org` (`registry.json`'s `homepage`), under
`r/<minor>/` and `r/latest/`. Nothing here publishes it: a release pushes this directory, without
its tests, to the public repository `registrystack/app-blocks`, whose workflow builds and deploys
it (the kit's release procedure). Locally, `--output registry-dist` and pointing `shadcn add` at
a built item's path or a loopback URL (as `test:registry-install` does) is how it is exercised.
