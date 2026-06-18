/**
 * _llm-agent-preamble.ts — Static, agent-directed steering text for the `llms.txt`
 * index. Underscore prefix keeps it OUT of the route table.
 *
 * WHY a hand-authored constant (not a docs page): this is the condensed steering
 * summary prepended to the `llms.txt` INDEX. The index is a pure link map — it does
 * NOT inline any page body — so the summary cannot be sourced from a doc page and
 * must live here.
 *
 * The FULL directives previously lived here too (`AGENT_PREAMBLE_FULL`, prepended to
 * `llms-full.txt`). They now live in `content/docs/grid/introduction.mdx` inside an
 * `<Audience only="agent">` block, so they flow into the agent corpus (`llms-full.txt`
 * + the `introduction.md` companion) through the normal `mdxToAgentMarkdown` pipeline
 * and render as nothing on the HTML site. Keep this short summary in sync with that
 * block and with the human docs both summarise (Getting Started, Plugins Overview).
 */

/** Condensed agent-steering summary — prepended to the `llms.txt` index. */
export const AGENT_PREAMBLE_SHORT = `**Agent rules (read before generating code):**

- **RULE 0 — prefer one \`gridConfig\` object** over fragmented props/inputs/attributes. Reserve props for reactive \`rows\` and the imperative \`ref\`/handle. The same \`GridConfig\` is portable across vanilla, React, Angular, Vue.
- **Inside React/Vue/Angular, default to framework-native renderers/editors** (JSX renderers, Vue slots/components, Angular template/component renderers). Do NOT default to plain \`HTMLElement\` renderers unless the user explicitly asks for framework-agnostic/vanilla code.
- **Default to features in \`gridConfig.features\`**, not manual plugin instances. Treat \`plugins: [new ...Plugin()]\` as advanced/exceptional (custom-plugin development or tightly-scoped imperative needs).
- **In React/Vue/Angular, configure features through \`gridConfig.features\` by default**. Per-feature props/inputs/directives are supported, but they are shorthand for tiny examples.
- **Side-effect imports are always required** even when using \`gridConfig.features.X\` (\`import '@toolbox-web/grid/features/selection'\`). Vanilla JS must also \`import '@toolbox-web/grid'\`.
- **Height is required** (\`tbw-grid { height: 400px; }\`) — the grid renders at zero height without it.
- **Editing is opt-in** — \`editable: true\` throws unless the editing feature/plugin is loaded.
- **Plugin order/compat:** \`Clipboard\` needs \`Selection\`; \`UndoRedo\` needs \`Editing\`. \`GroupingRows\`/\`Tree\`/\`Pivot\` are mutually exclusive.
- **Use \`cell-activate\`** (pointer + keyboard, cancelable) for click-to-open, not \`cell-click\`/\`row-click\` (pointer-only). Don't add \`SelectionPlugin\` just to make a row clickable.
- Light DOM (no Shadow DOM); em-based sizing (scale via \`font-size\`); \`await grid.ready()\` for post-render work.

For the full directives and copy-paste recipes, see \`llms-full.txt\`.`;
