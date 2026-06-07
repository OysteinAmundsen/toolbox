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
inlined as fenced blocks. The exhaustive per-symbol TypeDoc API is linked (not
inlined) at the end to keep this file small; fetch any symbol by appending
\`.md\` to its page URL. For the curated link index, see \`llms.txt\`.

A few non-implementation pages (the changelogs and the AI-assistance overview) are
intentionally omitted here to keep the corpus focused on building with the grid; they
remain linked in \`llms.txt\`.
`;
  }
  return `# @toolbox-web/grid — Full Documentation (${FRAMEWORK_LABEL[framework]})

> A high-performance, framework-agnostic data grid built with pure TypeScript and native Web Components. Zero runtime dependencies.

This is the **${FRAMEWORK_LABEL[framework]}-scoped** variant of \`llms-full.txt\`: code
examples are narrowed to ${FRAMEWORK_LABEL[framework]} and the other framework adapters'
pages are omitted, so the corpus is smaller and free of irrelevant variants. For
the complete cross-framework corpus, see \`llms-full.txt\`; for the curated link
index, see \`llms.txt\`. The exhaustive per-symbol TypeDoc API is linked (not
inlined) at the end; fetch any symbol by appending \`.md\` to its page URL.
`;
}

interface ApiEntry {
  slug: string;
  title: string;
}

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
  const sections = prosePages.map((p) =>
    mdxToAgentMarkdown(p.source, {
      resolveDemo,
      resolveSource: resolveDemoSource,
      hasDoc,
      cssVarReference: cssVariableReferenceMarkdown,
      frameworkFilter: framework ?? undefined,
    }).trim(),
  );

  // Per-symbol API pages, linked (not inlined) at the end.
  const apiEntries: ApiEntry[] = allPages
    .filter((p) => sectionOf(p.slug) === 'API')
    .map((p) => ({ slug: p.slug, title: titleFromSlug(p.slug) }));

  const body = [buildHeader(framework).trim(), sections.join('\n\n---\n\n'), renderApiIndex(origin, apiEntries)];
  return body.join('\n\n---\n\n') + '\n';
}
