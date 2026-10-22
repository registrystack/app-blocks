// Writes the two generated pages of the registry's site, from the
// registry.json that `shadcn build` wrote: the landing page at index.html and
// the catalogue at blocks/index.html. Nothing here lists a block by name:
// the catalogue shows every item in the registry, grouped by its type, and
// the landing page counts them, so adding an item to registry.json is the
// only edit a new block needs. The runtime package's name comes from
// packages/app-runtime/package.json, two levels above this file in both the
// kit and the public repository.
//
// Usage:
//   node site/build-index.mjs --registry registry-dist/registry.json --minor 0.37 --site ../site

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  navLabel: "Site",
  home: "App Blocks",
  nav: { blocks: "Blocks", gallery: "Gallery", npm: "npm", github: "GitHub", stack: "registrystack.org" },
  landingTitle: "Registry Stack App Blocks",
  eyebrow: "Registry Stack App Blocks",
  headline: "Blocks for apps that work with a registry",
  landingLede:
    "A shadcn registry of record, request, casework, dashboard and shell blocks for apps that talk to a Registry Stack registry. An app copies a block in and then owns it.",
  browse: (count) => (count === 1 ? "Browse the block" : `Browse the ${count} blocks`),
  seeStates: "See every screen state",
  cardsHeading: "What is here",
  blocksCard: "The blocks",
  blocksCardText: "Every item installs with the shadcn CLI. The catalogue shows each one with its install line.",
  runtimeCard: "The runtime package",
  runtimeCardText:
    "The typed browser client and React hooks the blocks use to talk to the app's host. Adding a block installs it.",
  runtimeNote: "Until the first stable version, name the next tag.",
  runtimeLink: "View on npm",
  galleryCard: "The gallery",
  galleryCardLink: "Open the gallery",
  stepsHeading: "Get started",
  steps: [
    ["Add the registry", "Add it to the app's components.json:"],
    ["Add a block", "Add an item by name. The CLI copies it and the items it needs into the app, and installs their npm packages."],
    ["Own the code", "The copied files are now part of the app. Change them as you need. This command shows how the registry's version differs from your copy."],
  ],
  guaranteesHeading: "What the blocks guarantee",
  guarantees: [
    "The registry decides what is allowed. A hidden control, a route parameter or a browser-supplied reference never grants access.",
    "Blocks call typed routes of the app's own host. The registry protocol and the credentials stay on the server.",
    "Submission, approval and application are separate steps. A block shows success only after the server confirms.",
    "A double click or a dropped response never sends a second write: a retry is the same attempt.",
    "Exact field values and calendar dates are kept as the registry holds them.",
    "Every default word has a message id. Change or translate the wording by id, without forking a block.",
  ],
  kitHeading: "The full App Kit",
  kitText:
    "The blocks are one part of the Registry Stack App Kit, which also has default apps that a registry configures without code.",
  kitLink: "Registry Stack",
  pilotLink: "Implementation and support",
  licence:
    "Apache License 2.0. The shadcn/ui components under blocks/ui keep their MIT licence; NOTICE.md in the repository lists them.",
  served: (minor) => `These items go with Registry Stack ${minor}.`,
  indexLink: "Item JSON index",
};

const links = {
  github: "https://github.com/registrystack/app-blocks",
  stack: "https://registrystack.org",
  pilot: "https://registrystack.org/pilot/",
  npm: (name) => `https://www.npmjs.com/package/${name}`,
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
.wrap { max-width: 64rem; margin: 0 auto; padding: 0 1rem; }
main.wrap { padding-top: 2rem; padding-bottom: 4rem; }
h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 0.5rem; }
.site-header { background: var(--surface); border-bottom: 1px solid var(--border); }
.site-header .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.5rem; padding-top: 0.75rem; padding-bottom: 0.75rem; }
.site-header .home { color: var(--text); font-weight: 600; text-decoration: none; }
.site-nav ul { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; padding: 0; margin: 0; list-style: none; }
.site-nav a[aria-current] { color: var(--text); font-weight: 600; text-decoration: none; }
.eyebrow { color: var(--muted); font-size: 0.875rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.5rem; }
.hero { padding: 1rem 0 0.5rem; }
.hero h1 { font-size: clamp(1.75rem, 6vw, 2.5rem); max-width: 40rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1.5rem 0 0; }
.button {
  display: inline-block;
  min-height: 44px;
  padding: 0.6rem 1.1rem;
  border: 1px solid var(--accent);
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: none;
}
.button-primary { background: var(--accent); color: var(--bg); }
.cards, .steps, .guarantees { padding: 0; margin: 0; display: grid; gap: 0.75rem; }
.cards { list-style: none; }
@media (min-width: 48rem) { .cards { grid-template-columns: repeat(3, 1fr); } }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
}
.card h3 { font-size: 1.0625rem; margin: 0 0 0.5rem; }
.card p { color: var(--muted); }
.card p:last-child { margin-bottom: 0; }
.counts { list-style: none; padding: 0; margin: 0 0 0.75rem; }
.counts .count { font-weight: 600; font-variant-numeric: tabular-nums; margin-right: 0.35rem; }
.steps { padding-left: 1.5rem; }
.steps h3 { font-size: 1rem; margin: 0 0 0.25rem; }
.guarantees { padding-left: 1.25rem; gap: 0.5rem; max-width: 46rem; }
.site-footer { border-top: 1px solid var(--border); color: var(--muted); font-size: 0.875rem; }
.site-footer .wrap { padding-top: 1.5rem; padding-bottom: 2rem; }
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
<p class="links"><a href="../r/${escapeHtml(minor)}/${escapeHtml(file)}">${words.itemLink}</a></p>
</li>`;
}

function setupJson(home, minor) {
  return JSON.stringify({ registries: { "@registrystack": `${home}/r/${minor}/{name}.json` } }, null, 2);
}

/** The header both pages share; `root` is the relative path to the site root. */
function header({ root, current, runtimePackage }) {
  const item = (key, href) =>
    `<li><a href="${escapeHtml(href)}"${current === key ? ' aria-current="page"' : ""}>${escapeHtml(words.nav[key])}</a></li>`;
  return `<header class="site-header"><div class="wrap">
<a class="home" href="${root || "./"}">${escapeHtml(words.home)}</a>
<nav class="site-nav" aria-label="${escapeHtml(words.navLabel)}"><ul>
${item("blocks", current === "blocks" ? "./" : `${root}blocks/`)}
${item("gallery", `${root}gallery/`)}
${item("npm", links.npm(runtimePackage))}
${item("github", links.github)}
${item("stack", links.stack)}
</ul></nav>
</div></header>`;
}

function page({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${styles}</style>
${body.head ?? ""}</head>
<body>
${body.main}
</body>
</html>
`;
}

// Links to the catalogue used to point at the site root; this sends their
// #item-* and #type-* hashes on to blocks/.
const forwardOldHashes = `<script>if (/^#(item|type)-/.test(location.hash)) location.replace("blocks/" + location.hash);</script>
`;

function renderCatalogue({ home, minor, groups, runtimePackage }) {
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
  return page({
    title: words.title,
    body: {
      main: `${header({ root: "../", current: "blocks", runtimePackage })}
<main class="wrap">
<h1>${escapeHtml(words.title)}</h1>
<p class="lede">${escapeHtml(words.lede)}</p>
<div class="gallery-callout">
<p><a href="../gallery/">${escapeHtml(words.galleryLink)}</a></p>
<p>${escapeHtml(words.galleryNote)}</p>
</div>
<h2>${escapeHtml(words.setupHeading)}</h2>
<p>${escapeHtml(words.setupLede)}</p>
<pre><code>${escapeHtml(setupJson(home, minor))}</code></pre>
<pre><code>npx shadcn@latest add @registrystack/&lt;item&gt;</code></pre>
<h2>${escapeHtml(words.itemsHeading)}</h2>
<nav aria-label="${escapeHtml(words.jumpLabel)}"><ul class="jump">
${jump}
</ul></nav>
${sections}
</main>`,
    },
  });
}

function renderLanding({ home, minor, groups, runtimePackage }) {
  const blockCount = groups.find((g) => g.type === "registry:block")?.items.length ?? 0;
  const counts = groups
    .map(
      (g) =>
        `<li><a href="blocks/#${g.id}"><span class="count">${g.items.length}</span>${escapeHtml(g.label)}</a></li>`,
    )
    .join("\n");
  const commands = [
    `<pre><code>${escapeHtml(setupJson(home, minor))}</code></pre>`,
    `<pre><code>npx shadcn@latest add @registrystack/&lt;item&gt;</code></pre>`,
    `<pre><code>npx shadcn@latest add @registrystack/&lt;item&gt; --diff</code></pre>`,
  ];
  const steps = words.steps
    .map(
      ([heading, text], at) => `<li>
<h3>${escapeHtml(heading)}</h3>
<p>${escapeHtml(text)}</p>
${commands[at]}
</li>`,
    )
    .join("\n");
  const npm = links.npm(runtimePackage);
  return page({
    title: words.landingTitle,
    body: {
      head: forwardOldHashes,
      main: `${header({ root: "", current: "home", runtimePackage })}
<main class="wrap">
<section class="hero">
<p class="eyebrow">${escapeHtml(words.eyebrow)}</p>
<h1>${escapeHtml(words.headline)}</h1>
<p class="lede">${escapeHtml(words.landingLede)}</p>
<p class="actions">
<a class="button button-primary" href="blocks/">${escapeHtml(words.browse(blockCount))}</a>
<a class="button" href="gallery/">${escapeHtml(words.seeStates)}</a>
</p>
</section>
<h2>${escapeHtml(words.cardsHeading)}</h2>
<ul class="cards">
<li class="card">
<h3>${escapeHtml(words.blocksCard)}</h3>
<ul class="counts">
${counts}
</ul>
<p>${escapeHtml(words.blocksCardText)}</p>
</li>
<li class="card">
<h3>${escapeHtml(words.runtimeCard)}</h3>
<p><code>${escapeHtml(runtimePackage)}</code></p>
<p>${escapeHtml(words.runtimeCardText)}</p>
<pre><code>npm install ${escapeHtml(runtimePackage)}@next</code></pre>
<p>${escapeHtml(words.runtimeNote)} <a href="${escapeHtml(npm)}">${escapeHtml(words.runtimeLink)}</a></p>
</li>
<li class="card">
<h3>${escapeHtml(words.galleryCard)}</h3>
<p>${escapeHtml(words.galleryNote)}</p>
<p><a href="gallery/">${escapeHtml(words.galleryCardLink)}</a></p>
</li>
</ul>
<h2>${escapeHtml(words.stepsHeading)}</h2>
<ol class="steps">
${steps}
</ol>
<h2>${escapeHtml(words.guaranteesHeading)}</h2>
<ul class="guarantees">
${words.guarantees.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n")}
</ul>
<h2>${escapeHtml(words.kitHeading)}</h2>
<p>${escapeHtml(words.kitText)}</p>
<p><a href="${links.stack}">${escapeHtml(words.kitLink)}</a> · <a href="${links.pilot}">${escapeHtml(words.pilotLink)}</a></p>
</main>
<footer class="site-footer"><div class="wrap">
<p>${escapeHtml(words.licence)}</p>
<p>${escapeHtml(words.served(minor))} <a href="r/${escapeHtml(minor)}/registry.json">${escapeHtml(words.indexLink)}</a></p>
</div></footer>`,
    },
  });
}

/** The site's generated pages, keyed by their path under the site root. */
export function renderSite({ registry, minor, runtimePackage }) {
  if (!Array.isArray(registry?.items)) throw new Error("the registry has no items array");
  if (!registry.homepage) throw new Error("the registry has no homepage");
  if (!/^\d+\.\d+$/.test(minor ?? "")) throw new Error(`minor must look like 0.37, got ${minor}`);
  if (!runtimePackage) throw new Error("the runtime package has no name");
  const home = String(registry.homepage).replace(/\/+$/, "");
  const groups = groupsOf(registry.items);
  const context = { home, minor, groups, runtimePackage };
  return {
    "index.html": renderLanding(context),
    "blocks/index.html": renderCatalogue(context),
  };
}

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const registry = JSON.parse(readFileSync(arg("registry"), "utf8"));
  const runtimeManifest = new URL("../../packages/app-runtime/package.json", import.meta.url);
  const runtimePackage = JSON.parse(readFileSync(runtimeManifest, "utf8")).name;
  const site = arg("site");
  const pages = renderSite({ registry, minor: arg("minor"), runtimePackage });
  for (const [path, html] of Object.entries(pages)) {
    const out = join(site, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    process.stdout.write(`Wrote ${out}\n`);
  }
  process.stdout.write(`${registry.items.length} items\n`);
}
