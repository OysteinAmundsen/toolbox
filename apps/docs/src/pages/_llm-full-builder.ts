/**
 * _llm-full-builder.ts — Shared builder for the `llms-full.txt` corpus and its
 * per-framework variants (`llms-full-{react,vue,angular,vanilla}.txt`).
 *
 * Underscore prefix keeps this OUT of the route table; the actual `.txt` routes
 * are thin wrappers that call `buildFull(origin, framework)`.
 *
 * The full corpus concatenates every PROSE page's `mdxToAgentMarkdown(...)`
 * output (guides, plugins, framework adapters) — always in sync with the per-page
 * `.md` companions (same transform, same source). The exhaustive per-symbol
 * TypeDoc API is appended as a linked index, not inlined, to keep the file
 * ingestion-friendly.
 *
 * A framework-scoped variant (`framework !== null`) trims the corpus to one
 * audience: foreign adapter pages are dropped entirely and each framework tab
 * group keeps only the matching variant (see `filterFrameworkTabs`). This cuts
 * the dominant size driver — every code example shown four times — to a single
 * relevant copy per page.
 */
import { extractFrontmatter, type Framework, mdxToAgentMarkdown } from './_llm-markdown';
import {
  API_AREA_ORDER,
  apiAreaOf,
  compareSlugsInSection,
  cssVariableReferenceMarkdown,
  docSources,
  hasDoc,
  isForeignFrameworkPage,
  keyToSlug,
  resolveDemo,
  resolveDemoSource,
  SECTION_ORDER,
  sectionOf,
} from './_llm-sources';

/** Display name for a framework variant, used in the file header. */
const FRAMEWORK_LABEL: Record<Framework, string> = {
  vanilla: 'Vanilla (TypeScript / JavaScript)',
  react: 'React',
  vue: 'Vue',
  angular: 'Angular',
};

function buildHeader(framework: Framework | null): string {
  if (!framework) {
    return `# @toolbox-web/grid — Full Documentation

> A high-performance, framework-agnostic data grid built with pure TypeScript and native Web Components. Zero runtime dependencies.

This file concatenates every prose documentation page — guides, plugins, and
framework adapters — into one document for one-shot ingestion. Demo code is
inlined as fenced blocks. To keep the file ingestion-friendly, plugin pages are
condensed to a stub — intro, \`Installation\`, and \`Basic Usage\` — with each
plugin's deep API (configuration options, events, methods) linked as a \`.md\`
companion; fetch it by appending \`.md\` to the plugin's page URL. The exhaustive
per-symbol TypeDoc API is likewise linked (not inlined) at the end. For the
curated link index, see \`llms.txt\`.

A few non-implementation pages (the changelogs and the AI-assistance overview) are
intentionally omitted here to keep the corpus focused on building with the grid; they
remain linked in \`llms.txt\`.
`;
  }
  if (framework === 'vanilla') {
    return `# @toolbox-web/grid — Full Documentation (${FRAMEWORK_LABEL[framework]})

> A high-performance, framework-agnostic data grid built with pure TypeScript and native Web Components. Zero runtime dependencies.

This is the **${FRAMEWORK_LABEL[framework]}-scoped** variant of \`llms-full.txt\`: code
examples are narrowed to plain TypeScript/JavaScript and the framework adapter pages
(React, Vue, Angular) are omitted. Configure the grid through a single \`gridConfig\`
object — set \`gridConfig.features\` to enable and configure features (selection,
editing, filtering, …) rather than toggling them via light-DOM attributes. Reserve the
declarative light-DOM API (\`<tbw-column>\`, feature attributes) for the case where you
want a grid with as little JavaScript as possible. Cell renderers, editors, and header
renderers return \`HTMLElement\`s (or strings) directly. Demo code is inlined as fenced
blocks. Plugin pages are condensed to a stub (intro + \`Installation\` + \`Basic Usage\`)
with their deep API linked as \`.md\` companions. For the complete cross-framework
corpus, see \`llms-full.txt\`; for the curated link index, see \`llms.txt\`. The
exhaustive per-symbol TypeDoc API is linked (not inlined) at the end; fetch any symbol
by appending \`.md\` to its page URL.
`;
  }
  return `# @toolbox-web/grid — Full Documentation (${FRAMEWORK_LABEL[framework]})

> A high-performance, framework-agnostic data grid built with pure TypeScript and native Web Components. Zero runtime dependencies.

This is the **${FRAMEWORK_LABEL[framework]}-scoped** variant of \`llms-full.txt\`: code
examples are narrowed to ${FRAMEWORK_LABEL[framework]} and the other framework adapters'
pages are omitted, so the corpus is smaller and free of irrelevant variants. Use
${FRAMEWORK_LABEL[framework]} components as cell renderers, editors, and header
renderers — never return raw \`HTMLElement\`s. Runnable demo \`.astro\` sources are
vanilla-only, so they are linked (not inlined) here to avoid non-idiomatic code; the
${FRAMEWORK_LABEL[framework]}-native snippet shown inline next to each is the version to
follow. Plugin pages are condensed to a stub (intro + \`Installation\` + \`Basic Usage\`)
with their deep API linked as \`.md\` companions. For the complete cross-framework
corpus, see \`llms-full.txt\`; for the curated link index, see \`llms.txt\`. The
exhaustive per-symbol TypeDoc API is linked (not inlined) at the end; fetch any symbol
by appending \`.md\` to its page URL.
`;
}

interface ApiEntry {
  slug: string;
  title: string;
}

/**
 * H2 sections dropped from the concatenated corpus (but kept in each page's
 * standalone `.md` companion). These inline large demo `.astro` source dumps or
 * are pure intra-doc link lists — high token cost, no API truth. Every
 * API-bearing section (Installation, Basic Usage, Configuration Options,
 * Programmatic API, Events, Keyboard Shortcuts, …) is retained.
 */
const CORPUS_DROP_SECTIONS = ['Demos', 'Demo', 'See Also'];

/**
 * Plugin pages are the dominant corpus-size driver (~56% of the cross-framework
 * file across ~27 pages). In the corpus they are demoted to a compact stub: the
 * intro (one-line capability) plus these "how to enable + minimal working use"
 * sections, with the deep API (configuration tables, events, methods, advanced
 * recipes) linked as a per-page `.md` companion rather than inlined. An agent
 * still learns WHICH plugin solves a need and HOW to turn it on without a fetch,
 * and fetches the focused `.md` only when implementing that plugin's deep API.
 * The standalone `.md` companions and `llms.txt` index keep the full content.
 */
const PLUGIN_KEEP_SECTIONS = [
  'Installation',
  'Basic Usage',
  'Usage',
  'Quick Start',
  'Getting Started',
  'Enabling',
  'Setup',
];

/**
 * Adapter-framework variants (react/vue/angular) drop the plugin `## Installation`
 * block. It is a bare, non-tabbed `import '@toolbox-web/grid/features/<x>'` fence that
 * the framework filter can't rewrite (it only touches `<Tabs>`), so it leaks the
 * vanilla core import — while the framework-native import already appears in the
 * `Basic Usage` tab directly below. Vanilla and the cross-framework corpus keep it.
 */
const PLUGIN_KEEP_SECTIONS_ADAPTER = PLUGIN_KEEP_SECTIONS.filter((s) => s !== 'Installation');

/** Derive a human title from an API slug (TypeDoc pages rarely have frontmatter). */
function titleFromSlug(slug: string): string {
  const last = slug.split('/').pop() ?? slug;
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render the linked `## API Reference` index, grouped by area. */
function renderApiIndex(origin: string, apiEntries: ApiEntry[]): string {
  const byArea = new Map<string, ApiEntry[]>();
  for (const e of apiEntries) {
    const area = apiAreaOf(e.slug);
    const list = byArea.get(area) ?? [];
    list.push(e);
    byArea.set(area, list);
  }
  const blocks: string[] = [
    '## API Reference',
    '',
    'The complete generated TypeDoc reference is not inlined above. Every symbol has a plain-markdown companion — fetch any link below (or append `.md` to its page URL).',
  ];
  for (const area of API_AREA_ORDER) {
    const entries = (byArea.get(area) ?? []).sort((a, b) => a.title.localeCompare(b.title));
    if (entries.length === 0) continue;
    const links = entries.map((e) => `- [${e.title}](${origin}/${e.slug}.md)`).join('\n');
    blocks.push(`### ${area}\n\n${links}`);
  }
  return blocks.join('\n\n');
}

/**
 * Build the `llms-full.txt` body. With `framework === null` (default) this is the
 * complete cross-framework corpus; with a framework it is the scoped variant.
 */
export function buildFull(origin: string, framework: Framework | null = null): string {
  const allPages = Object.entries(docSources)
    .map(([key, source]) => ({ slug: keyToSlug(key), source }))
    .filter((p) => !isForeignFrameworkPage(p.slug, framework));

  // Prose pages (everything except per-symbol API), grouped by section then slug.
  // Pages whose frontmatter sets `llmsFull: false` (release-history changelogs and
  // the AI-assistance meta page) are omitted here but stay linked in `llms.txt`.
  const prosePages = allPages
    .filter((p) => sectionOf(p.slug) !== 'API' && extractFrontmatter(p.source).llmsFull !== false)
    .sort((a, b) => {
      const sa = sectionOf(a.slug);
      const sb = sectionOf(b.slug);
      const ai = SECTION_ORDER.indexOf(sa as (typeof SECTION_ORDER)[number]);
      const bi = SECTION_ORDER.indexOf(sb as (typeof SECTION_ORDER)[number]);
      return ai !== bi ? ai - bi : compareSlugsInSection(sa, a.slug, b.slug);
    });
  const sections = prosePages.map((p) => {
    // Plugin pages (but not the `grid/plugins` catalog index) are demoted to a
    // stub: intro + enable/basic-usage, with deep API linked, not inlined.
    const isPluginStub = sectionOf(p.slug) === 'Plugins' && p.slug !== 'grid/plugins';
    // In a real framework-scoped variant (react/vue/angular — NOT vanilla, NOT the
    // cross-framework null), the demo `.astro` sources are vanilla-only, so inlining
    // them contradicts that framework's "use components, not HTMLElements" guidance.
    // Replace each demo with a `.md` pointer; the framework-native tab snippet stays.
    const omitDemoComponents = framework !== null && framework !== 'vanilla';
    const pluginKeepSections = omitDemoComponents ? PLUGIN_KEEP_SECTIONS_ADAPTER : PLUGIN_KEEP_SECTIONS;
    const md = mdxToAgentMarkdown(p.source, {
      resolveDemo,
      resolveSource: resolveDemoSource,
      hasDoc,
      cssVarReference: cssVariableReferenceMarkdown,
      frameworkFilter: framework ?? undefined,
      omitDemoComponents,
      demoPageUrl: `${origin}/${p.slug}.md`,
      ...(isPluginStub ? { keepSections: pluginKeepSections } : { dropSections: CORPUS_DROP_SECTIONS }),
    }).trim();
    if (!isPluginStub) return md;
    const title = extractFrontmatter(p.source).title ?? titleFromSlug(p.slug);
    return `${md}\n\n**Full plugin API — configuration options, events, methods, and advanced usage:** [${title}](${origin}/${p.slug}.md)`;
  });

  // Per-symbol API pages, linked (not inlined) at the end.
  const apiEntries: ApiEntry[] = allPages
    .filter((p) => sectionOf(p.slug) === 'API')
    .map((p) => ({ slug: p.slug, title: titleFromSlug(p.slug) }));

  const body = [buildHeader(framework).trim(), sections.join('\n\n---\n\n'), renderApiIndex(origin, apiEntries)];
  return body.join('\n\n---\n\n') + '\n';
}
