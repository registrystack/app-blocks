// Writes the catalogue page at the root of the registry's site, from the
// registry.json that `shadcn build` wrote. Nothing here lists a block by name:
// every item in the registry appears, grouped by its type, so adding an item
// to registry.json is the only edit a new block needs.
//
// Usage:
//   node site/build-index.mjs --registry registry-dist/registry.json --minor 0.37 --out ../site/index.html

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const words = {
  title: "Registry Stack App Blocks",
  lede: "A shadcn registry of record, request, casework and shell blocks for apps that talk to a Registry Stack registry. An app copies a block in and then owns it.",
  galleryLink: "Open the states gallery",
  galleryNote:
    "The gallery renders every screen state the blocks can show, for a fictional nursing licence register with synthetic data.",
  setupHeading: "Add the registry",
  setupLede:
    "Add the registry to the app's components.json, then add items by name:",
  installLabel: "Install",
  itemLink: "Item JSON",
  itemsHeading: "Items",
  jumpLabel: "Item types",
  untitled: "No description.",
};

const typeOrder = [
  ["registry:block", "Blocks"],
  ["registry:component", "Components"],
  ["registry:ui", "UI primitives"],
  ["registry:lib", "Libraries"],
  ["registry:file", "Files"],
];

const styles = `
:root {
  color-scheme: light dark;
  --bg: #fafaf9;
  --surface: #ffffff;
  --text: #1c1917;
  --muted: #57534e;
  --border: #d6d3d1;
  --accent: #1d4ed8;
  --code-bg: #f1f5f9;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #12100e;
    --surface: #1c1917;
    --text: #f5f5f4;
    --muted: #a8a29e;
    --border: #3a3633;
    --accent: #93b4ff;
    --code-bg: #0c0a09;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
}
main { max-width: 64rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 0.5rem; }
h2 { font-size: 1.25rem; margin: 2.5rem 0 0.75rem; }
a { color: var(--accent); }
p { margin: 0 0 0.75rem; }
.lede { color: var(--muted); max-width: 42rem; }
.gallery-callout {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1.5rem 0;
}
.gallery-callout p:last-child { margin-bottom: 0; }
code, pre {
  font: 0.875rem/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
}
code { padding: 0.1rem 0.35rem; overflow-wrap: anywhere; }
pre { padding: 0.75rem; margin: 0 0 0.75rem; white-space: pre-wrap; overflow-wrap: anywhere; }
pre code { border: 0; padding: 0; background: none; }
.jump { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; padding: 0; margin: 1rem 0 0; list-style: none; }
.items { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
.item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
}
.item h3 { font-size: 1rem; margin: 0 0 0.25rem; overflow-wrap: anywhere; }
.item h3 .name { color: var(--muted); font-weight: 400; font-size: 0.875rem; }
.item p { color: var(--muted); }
.item pre { margin-bottom: 0.5rem; }
.item .links { margin: 0; font-size: 0.875rem; }
`;

/** Escapes a value for use in HTML text or a double-quoted attribute. */
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function groupLabel(type) {
  const known = typeOrder.find(([name]) => name === type);
  if (known) return known[1];
  const bare = String(type).replace(/^registry:/, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/** The item types present, known ones first in a fixed order, the rest alphabetically. */
function groupsOf(items) {
  const byType = new Map();
  for (const item of items) {
    const list = byType.get(item.type) ?? [];
    list.push(item);
    byType.set(item.type, list);
  }
  const known = typeOrder.map(([name]) => name).filter((name) => byType.has(name));
  const rest = [...byType.keys()].filter((name) => !known.includes(name)).sort();
  return [...known, ...rest].map((type) => ({
    type,
    id: `type-${String(type).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    label: groupLabel(type),
    items: byType.get(type),
  }));
}

function renderItem(item, { home, minor }) {
  const file = `${encodeURIComponent(item.name)}.json`;
  const installUrl = `${home}/r/${minor}/${file}`;
  const title = item.title ? escapeHtml(item.title) : escapeHtml(item.name);
  const description = item.description ? escapeHtml(item.description) : words.untitled;
  return `<li class="item" id="item-${escapeHtml(item.name)}">
<h3>${title} <span class="name"><code>${escapeHtml(item.name)}</code></span></h3>
<p>${description}</p>
<pre><code>npx shadcn@latest add ${escapeHtml(installUrl)}</code></pre>
<p class="links"><a href="r/${escapeHtml(minor)}/${escapeHtml(file)}">${words.itemLink}</a></p>
</li>`;
}

/** The catalogue page for a registry, as one HTML document. */
export function renderIndex({ registry, minor }) {
  if (!Array.isArray(registry?.items)) throw new Error("the registry has no items array");
  if (!registry.homepage) throw new Error("the registry has no homepage");
  if (!/^\d+\.\d+$/.test(minor ?? "")) throw new Error(`minor must look like 0.37, got ${minor}`);
  const home = String(registry.homepage).replace(/\/+$/, "");
  const groups = groupsOf(registry.items);
  const setup = JSON.stringify(
    { registries: { "@registrystack": `${home}/r/${minor}/{name}.json` } },
    null,
    2,
  );
  const jump = groups
    .map((g) => `<li><a href="#${g.id}">${escapeHtml(g.label)} (${g.items.length})</a></li>`)
    .join("\n");
  const sections = groups
    .map(
      (g) => `<section id="${g.id}">
<h2>${escapeHtml(g.label)}</h2>
<ul class="items">
${g.items.map((item) => renderItem(item, { home, minor })).join("\n")}
</ul>
</section>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(words.title)}</title>
<style>${styles}</style>
</head>
<body>
<main>
<h1>${escapeHtml(words.title)}</h1>
<p class="lede">${escapeHtml(words.lede)}</p>
<div class="gallery-callout">
<p><a href="gallery/">${escapeHtml(words.galleryLink)}</a></p>
<p>${escapeHtml(words.galleryNote)}</p>
</div>
<h2>${escapeHtml(words.setupHeading)}</h2>
<p>${escapeHtml(words.setupLede)}</p>
<pre><code>${escapeHtml(setup)}</code></pre>
<pre><code>npx shadcn@latest add @registrystack/&lt;item&gt;</code></pre>
<h2>${escapeHtml(words.itemsHeading)}</h2>
<nav aria-label="${escapeHtml(words.jumpLabel)}"><ul class="jump">
${jump}
</ul></nav>
${sections}
</main>
</body>
</html>
`;
}

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const registry = JSON.parse(readFileSync(arg("registry"), "utf8"));
  const out = arg("out");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderIndex({ registry, minor: arg("minor") }));
  process.stdout.write(`Wrote ${out} (${registry.items.length} items)\n`);
}
