# Doc templates & per-page rules

Read from the `docs-update` skill when writing or restructuring a specific page type.

### Multi-Path Features

When a feature has multiple configuration paths (e.g., CSS vs JS, declarative vs programmatic), apply this checklist to **every documentation file that has a dedicated section explaining that feature, a configuration table for it, or a code example using it (not merely a passing hyperlink or index entry)** (i.e. the feature's plugin/core MDX page, its README, and any adapter MDX page that documents it in detail). You do **not** need to touch unrelated documentation files. (The LLM files pick up the change automatically once the MDX is updated.)

For each such file, complete all four steps in order:

1. [ ] **State that both paths exist** — even if the file only covers one in detail.
2. [ ] **Explain when to use which** — include a comparison table with trade-offs.
3. [ ] **Cross-reference** — link to the other doc surface that covers the other path in detail.
4. [ ] **Identify the recommended default** — guide developers toward the simpler path unless they have specific needs.

Apply this to: icons (CSS vars vs `gridConfig.icons`), column config (declarative `<tbw-grid-column>` vs JS `columns`), features (declarative `features` vs manual `plugins`), styling (CSS custom properties vs `registerStyles()` vs `cellClass`/`rowClass`), etc.

### Plugin MDX (`.mdx`)

Plugin MDX pages live in `apps/docs/src/content/docs/grid/plugins/`. Structure:

```mdx
---
title: Plugin Name
description: One-line description.
---

import PluginDefaultDemo from '@components/demos/plugin-name/PluginNameDefaultDemo.astro';
import ShowSource from '@components/ShowSource.astro';

## Installation

\`\`\`typescript
import { MyPlugin } from '@toolbox-web/grid/plugins/my-plugin';
\`\`\`

## Basic Usage

<ShowSource component="plugin-name/PluginNameDefaultDemo">
  <PluginDefaultDemo />
</ShowSource>

## Demos

Additional interactive demos, one `###` subsection each.

## Configuration Options

Auto-generated from the plugin's config interface by \`genPluginConfigTable()\`.

## Events

| Event | Detail | Description |
| ----- | ------ | ----------- |

## Styling

## See Also
```

> **Heading names are part of the contract.** Use exactly `## Installation`, `## Basic Usage`,
> `## Demos`, `## Configuration Options`, `## Events`, `## Styling`, `## See Also` — not
> `## Demo`, `## Interactive Demo`, `## Configuration`, or `## Configuration Reference`.
> Uniform headings keep the sidebar, the agent corpus, and cross-page anchors predictable.
> Every plugin page must end with `## See Also`. Heading text must be unique within a page;
> duplicates get a `-1` anchor suffix and break inbound links.

> **Link, don't duplicate.** `## Configuration Options` on a curated plugin page must NOT
> restate the config interface's member list. Write:
>
> ```md
> See [`XConfig`](./interfaces/xconfig/) for the full list of options and defaults.
> ```
>
> …optionally followed by a short **Key options** list covering only members whose _shape_ needs
> prose (mutually exclusive modes, security-relevant defaults, cross-plugin interactions). The same
> rule applies to any `### <Interface> Reference` section, editor-context tables, and adapter
> base-class API tables. Hand-maintained exhaustive tables go stale — four were already wrong when
> this rule was introduced, and one documented an option that did not exist.
>
> **Before deleting such a table, prove the generated page is equal or better for every row.** If it
> isn't, enrich the source JSDoc or fix `tools/typedoc-mdx-shared.ts` and regenerate — never accept
> a downgrade. Mechanical check: `git diff` the page, extract removed rows via `^-\|\s*` + a
> backticked identifier, and assert each name appears on the target page.

> **Plugin JSDoc conventions for auto-generated API docs:**
>
> - `## Configuration Options` tables are **auto-generated** from the constructor's config interface — do not hand-write them in JSDoc
> - `## Programmatic API` tables are redundant with auto-generated Methods — do not hand-write them in JSDoc
> - Use `{@link TypeName}` in hand-written sections (Column Configuration, CSS Custom Properties, Events) to cross-link types
> - Run `bun nx typedoc grid` after changing JSDoc to regenerate MDX

### Plugin README (`README.md`)

Keep concise — links to docs site for live examples:

```markdown
# @toolbox-web/grid — Plugin Name

Brief description.

## Usage

\`\`\`typescript
import { MyPlugin } from '@toolbox-web/grid/plugins/my-plugin';
\`\`\`

## Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |

## Documentation

See the [docs site](https://toolboxjs.com/grid/plugins/my-plugin/) for live examples.
```

### `api-reference.mdx` Events section

**`api-reference.mdx`** (`apps/docs/src/content/docs/grid/api-reference.mdx`) Events section — Update when:

- Event cancelability changes (the cancelable events table is curated)
- Framework-specific listening patterns change

:::note
Individual event descriptions, payload types, and code examples are auto-generated from JSDoc in `DataGridEventMap` — update the JSDoc, not the curated docs. Run `bun nx typedoc grid` to regenerate.
:::

### Core MDX Docs (`apps/docs/src/content/docs/grid/`)

| File                  | Contents                                           |
| --------------------- | -------------------------------------------------- |
| `index.mdx`           | Landing page, key features                         |
| `getting-started.mdx` | Installation, first grid setup                     |
| `api-reference.mdx`   | Public API reference (properties, methods, events) |
| `theming.mdx`         | CSS custom properties, theme files                 |
| `core.mdx`            | Core features guide (columns, rows, etc.)          |
| `custom-plugins.mdx`  | How to write a plugin                              |
| `performance.mdx`     | Performance tips                                   |
| `accessibility.mdx`   | A11y features                                      |
| `troubleshooting.mdx` | Common issues and fixes                            |
| `demos.mdx`           | Full-featured demo applications                    |
| `comparison.mdx`      | Feature comparison table                           |
| `architecture.mdx`    | Internal architecture documentation                |

### `comparison.mdx` carries perishable third-party claims

This page is the only doc that asserts facts about **other vendors' products** — feature matrices for
AG Grid / Tabulator / SlickGrid / Handsontable / TreeGrid, and a list-price table. Those rot silently:
a competitor moves a feature from Enterprise to Community, or changes its pricing, and our page becomes
a false claim rather than a stale one.

- The page carries a **verified-on date** in the `<details>Sources and disclaimer</details>` block near the top
  and again under the pricing table. Re-verify against each vendor's own public page at least every six months
  and bump both dates together.
- Never quote a price that is not currently on the vendor's own pricing page. There is a `{/* MAINTENANCE: … */}`
  comment above the pricing table stating this — keep it.
- **A wrong ❌ against a competitor is the worst error on the page.** When you cannot source a cell, leave
  the product out of that table and link to its feature docs in prose instead of guessing.
- The page also drifts in _our_ favour-losing direction: it understated our own styled Excel export and
  overstated pagination for a long time. When a plugin gains or loses a capability, check whether a
  `comparison.mdx` row asserts the opposite.
- Whenever a limitation row says ❌ but a [recipe](../../../apps/docs/src/content/docs/grid/recipes/) covers
  the seam, mark it ⚙️ and link the recipe. "We don't ship it, here's how you wire it" is the honest answer,
  not ❌.
- **One capability claim lives in exactly one place: the Feature Comparison table.** The page previously
  carried a second "What the paid tier gates" table whose 17 rows were 15/17 duplicates of that table's
  AG Grid column, plus bullet lists restating the Quick Summary. Two tables asserting the same fact drift
  apart and double the re-verification cost. If a section needs to reference a capability, link or point at
  the row ("the rows marked **❌ / ✅ Paid** above") instead of restating it. Prose sections should add
  reasoning the tables cannot express — "When _not_ to choose Toolbox Grid" is the model.
