/**
 * _llm-agent-preamble.ts — Static, agent-directed steering text prepended to the
 * generated agent endpoints. Underscore prefix keeps it OUT of the route table.
 *
 * WHY a hand-authored constant (not a docs page): this content is imperative
 * code-generation guidance for an LLM ("RULE 0 — you MUST default to…"), not
 * documentation a human reads. It has no human audience, so it does not belong
 * in `content/docs/`. The *factual* gotchas it summarises (height-required,
 * editing-is-opt-in, plugin order) DO live in the human docs (Getting Started,
 * Plugins Overview) — this block only re-frames them as front-loaded directives
 * so an agent ingesting the corpus reads the rules before the first line of code.
 *
 * Two variants:
 * - `AGENT_PREAMBLE_FULL`  → prepended to `llms-full.txt` (full directives).
 * - `AGENT_PREAMBLE_SHORT` → prepended to `llms.txt` (condensed, fits the index's
 *   small-context budget; agents that only fetch the map still get steered).
 *
 * Keep both in sync with the human docs they summarise. They are intentionally
 * NOT generated from any page — they are the one exception to the "everything is
 * derived from `docSources`" rule, because no source page carries this framing.
 */

/** Full agent-steering directives — prepended to `llms-full.txt`. */
export const AGENT_PREAMBLE_FULL = `## RULE 0 (HIGHEST PRIORITY) — Prefer a single \`gridConfig\` over fragmented props

When generating grid code for ANY framework (React, Angular, Vue, vanilla JS/TS, Svelte), **default to one \`gridConfig\` object** holding columns, features, plugins, and all other configuration. Reserve framework props for reactive data (\`rows\`) and the imperative \`ref\`/handle. Do NOT spread configuration across many individual props/inputs/attributes unless the user explicitly asks.

WHY: one object describes the whole grid, is portable across frameworks (the same \`GridConfig\` works in vanilla, React, Angular, Vue), and keeps multi-line config (callbacks like \`groupOn\`, \`dataSource\`, renderers) readable.

\`\`\`ts
const gridConfig: GridConfig<Employee> = {
  columns: [/* … */],
  features: { selection: 'range', editing: 'dblclick' },
};
\`\`\`

- **React:**   \`<DataGrid rows={data} gridConfig={gridConfig} />\` (memoize with \`useMemo\`)
- **Angular:** \`<tbw-grid [rows]="data" [gridConfig]="gridConfig" />\`
- **Vue:**     \`<TbwGrid :rows="data" :grid-config="gridConfig" />\` (wrap with \`markRaw()\`)
- **Vanilla:** \`const grid = createGrid<Employee>(gridConfig); grid.rows = data;\`

Individual feature props (\`<DataGrid selection="row" />\`) remain fully supported — use them ONLY for very small grids (≤ 2 features, each a boolean/short string) or when explicitly requested.

## CRITICAL RULES — read before generating any code

These apply to ALL frameworks. Violating them produces broken grids.

1. **Side-effect imports are always required.** \`gridConfig.features.X\` (or a feature prop) does NOT remove the need to import the feature factory — without the import the merge produces no plugin:
   \`\`\`ts
   import '@toolbox-web/grid/features/selection';        // vanilla / any framework
   import '@toolbox-web/grid-react/features/selection';  // or the adapter path
   \`\`\`
   Vanilla JS must also register the element itself: \`import '@toolbox-web/grid';\` (adapters auto-import it).
2. **Height is required.** The grid needs an explicit height or it renders at zero height: \`tbw-grid { height: 400px; }\`. (\`display: block\` is set automatically — do not add it.)
3. **Editing is opt-in.** \`editable: true\` on a column WITHOUT the editing feature/plugin throws. Load \`@toolbox-web/grid/features/editing\` and set \`features: { editing: true }\`.
4. **Plugin load order matters.** \`ClipboardPlugin\` requires \`SelectionPlugin\`; \`UndoRedoPlugin\` requires \`EditingPlugin\` — load the dependency first.
5. **Some plugins are mutually exclusive.** \`GroupingRows\` ✗ \`Tree\` ✗ \`Pivot\` (all rewrite the row model); \`ServerSide\` ✗ \`Pivot\`. A dev-mode warning fires on conflict. (\`ServerSide\` + \`Tree\` and \`ServerSide\` + \`GroupingRows\` DO coexist.)
6. **Light DOM, no Shadow DOM.** CSS cascade works normally — no \`::part()\`/\`::slotted()\`.
7. **Em-based sizing.** All dimensions use \`em\`; scale the whole grid by changing \`font-size\` on \`tbw-grid\`.
8. **Type import:** \`import type { DataGridElement } from '@toolbox-web/grid';\` (the old \`GridElement\` alias is deprecated).

## ANTI-PATTERNS — don't reach for a plugin first

- **Don't add \`SelectionPlugin\` just to make a row clickable.** For "click row → open detail", listen for \`cell-activate\` (fires for pointer AND keyboard, so it's accessible for free). Add \`SelectionPlugin\` only for persistent visible selection state, checkboxes, or multi-select.
- **Don't write \`cell-click\`/\`row-click\` when you mean "activate".** Those are pointer-only — keyboard users won't trigger them. \`cell-activate\` is the unified, cancelable activation event. Use \`cell-click\` only when you specifically need pointer-only behaviour (e.g. left-vs-right button).
- **Don't subclass \`BaseGridEditor\` before trying \`column.type\`.** Built-in types (\`'select'\`, \`'number'\`, \`'date'\`, …) plus \`gridConfig.typeDefaults\` cover most editor needs. Subclass only for genuinely custom editor UI.
- **Don't reinvent post-render orchestration.** To act after first render (focus a cell, scroll to row, begin an edit), \`await grid.ready()\` instead of chaining \`setTimeout\`/\`requestAnimationFrame\`/\`afterNextRender\`.

The rest of this file is the full prose documentation — guides, plugins, and framework adapters — followed by a linked API index.`;

/** Condensed agent-steering summary — prepended to the `llms.txt` index. */
export const AGENT_PREAMBLE_SHORT = `**Agent rules (read before generating code):**

- **RULE 0 — prefer one \`gridConfig\` object** over fragmented props/inputs/attributes. Reserve props for reactive \`rows\` and the imperative \`ref\`/handle. The same \`GridConfig\` is portable across vanilla, React, Angular, Vue.
- **Side-effect imports are always required** even when using \`gridConfig.features.X\` (\`import '@toolbox-web/grid/features/selection'\`). Vanilla JS must also \`import '@toolbox-web/grid'\`.
- **Height is required** (\`tbw-grid { height: 400px; }\`) — the grid renders at zero height without it.
- **Editing is opt-in** — \`editable: true\` throws unless the editing feature/plugin is loaded.
- **Plugin order/compat:** \`Clipboard\` needs \`Selection\`; \`UndoRedo\` needs \`Editing\`. \`GroupingRows\`/\`Tree\`/\`Pivot\` are mutually exclusive.
- **Use \`cell-activate\`** (pointer + keyboard, cancelable) for click-to-open, not \`cell-click\`/\`row-click\` (pointer-only). Don't add \`SelectionPlugin\` just to make a row clickable.
- Light DOM (no Shadow DOM); em-based sizing (scale via \`font-size\`); \`await grid.ready()\` for post-render work.

For the full directives and copy-paste recipes, see \`llms-full.txt\`.`;
