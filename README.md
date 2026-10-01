# Registry Stack App Blocks

Two published parts of the Registry Stack App Kit:

- `@registrystack/app-runtime` (`packages/app-runtime`), on npm: the typed browser client and
  React hooks that the kit's apps and blocks use to talk to their app host.
- A [shadcn](https://ui.shadcn.com) registry of blocks (`blocks/`), served at
  <https://ui.registrystack.org>: record, request, casework and shell components that an app
  copies in and then owns. The site's front page lists every item with its install line, and
  `/gallery/` (`gallery/`, prebuilt static files) shows the blocks' screen states for a fictional
  nursing licence register with synthetic data.

## Adding blocks

Add the registry to your app's `components.json`:

```json
{
  "registries": {
    "@registrystack": "https://ui.registrystack.org/r/latest/{name}.json"
  }
}
```

Then add an item with the [shadcn CLI](https://ui.shadcn.com/docs/cli):

```sh
npx shadcn@latest add @registrystack/record-form
```

`add` copies the item and the items it depends on into your app, and installs their npm
dependencies, `@registrystack/app-runtime` among them. `--dry-run` shows what it would write, and
`--diff` how the registry's version differs from your copy; neither writes anything.

`r/latest/` follows the newest release. `r/<minor>/` (for example `r/0.37/`) serves the same
files, named for the Registry Stack minor they go with; only the newest release's minor is served.

## The runtime

```sh
npm install @registrystack/app-runtime@next
```

Until the first stable version, npm's `latest` tag points at an inert `0.0.0` placeholder, so
name a version or the `next` tag.

## How this repository changes

The code is written and tested in a private development repository. This repository receives
one commit per release from it, which replaces the whole tree and is tagged `v<version>`. The
tag's workflow publishes the runtime to npm with a provenance statement and deploys the
registry. A change made here directly is replaced by the next release.

## License

Apache License, Version 2.0 (`LICENSE`). The shadcn/ui components under `blocks/ui/` keep their
MIT license; see `NOTICE.md`.
