/**
 * llms.txt.ts — Generated `llms.txt` index (the curated "map").
 *
 * Follows the llmstxt.org convention: an H1, a blockquote summary, a short
 * curated overview, then H2 sections of links — here every link points at the
 * page's plain-markdown `.md` companion so agents stay in the markdown graph.
 *
 * Generated (not hand-maintained) so the link list can never drift from the
 * actual docs: the page set, slugs, titles and descriptions all come from the
 * same `docSources` glob that backs the per-page `[...slug].md.ts` endpoint.
 * The only hand-authored part is the editorial intro below.
 *
 * Companion file `llms-full.txt` carries the full inlined content; this file is
 * deliberately lean so it fits a small context window.
 */
import type { APIRoute } from 'astro';

import { extractFrontmatter } from './_llm-markdown';
import { API_AREA_ORDER, apiAreaOf, docSources, keyToSlug, SECTION_ORDER, sectionOf } from './_llm-sources';

type Section = (typeof SECTION_ORDER)[number];

// Hand-authored editorial header. The link sections below are generated.
const INTRO = `# @toolbox-web/grid

> A high-performance, framework-agnostic data grid built with pure TypeScript and native Web Components. Zero runtime dependencies. Works in vanilla JS, React, Angular, Vue, Svelte, and any JavaScript environment.

This is a **Web Component** (\`<tbw-grid>\`) that works natively in all frameworks without wrappers (optional adapter packages for React, Angular, and Vue add JSX/template/slot renderers). Configuration uses a **single source of truth** pattern via the \`gridConfig\` property. Capabilities are enabled through tree-shakeable \`features\` (declarative, recommended) or \`plugins\` (manual class instantiation). The grid uses **light DOM** (not Shadow DOM) for CSS cascade and accessibility.

**Agent conventions:**

- **Prefer a single \`gridConfig\` object** over many individual props/attributes — it is portable across frameworks and far more readable for multi-line feature config.
- **Every documentation page has a plain-markdown companion**: append \`.md\` to any docs URL (e.g. \`/grid/getting-started.md\`) to fetch a lean, self-contained Markdown rendering with demo code inlined. All links below already use that \`.md\` form.
`;

// Within "Core Documentation", surface the conceptual pages in reading order;
// everything else falls back to alphabetical.
const CORE_ORDER = [
  'grid/introduction',
  'grid/getting-started',
  'grid/core',
  'grid/demos',
  'grid/comparison',
  'grid/architecture',
  'grid/api-reference',
];

interface Entry {
  slug: string;
  title: string;
  description?: string;
}

/** Derive a human title from a slug when frontmatter has none (rare). */
function titleFromSlug(slug: string): string {
  const last = slug.split('/').pop() ?? slug;
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function collectEntries(): Map<Section, Entry[]> {
  const bySection = new Map<Section, Entry[]>();
  for (const section of SECTION_ORDER) bySection.set(section, []);

  for (const [key, source] of Object.entries(docSources)) {
    const slug = keyToSlug(key);
    const section = sectionOf(slug) as Section;
    const fm = extractFrontmatter(source);
    const list = bySection.get(section) ?? [];
    list.push({ slug, title: fm.title ?? titleFromSlug(slug), description: fm.description });
    bySection.set(section, list);
  }

  for (const [section, entries] of bySection) {
    entries.sort((a, b) => {
      if (section === 'Core Documentation') {
        const ai = CORE_ORDER.indexOf(a.slug);
        const bi = CORE_ORDER.indexOf(b.slug);
        if (ai !== bi) return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      }
      return a.slug.localeCompare(b.slug);
    });
  }
  return bySection;
}

function renderLink(origin: string, e: Entry): string {
  const url = `${origin}/${e.slug}.md`;
  return `- [${e.title}](${url})${e.description ? `: ${e.description}` : ''}`;
}

/** Render the exhaustive `## API Reference` section, grouped by area. */
function renderApiSection(origin: string, apiEntries: Entry[]): string {
  const byArea = new Map<string, Entry[]>();
  for (const e of apiEntries) {
    const area = apiAreaOf(e.slug);
    const list = byArea.get(area) ?? [];
    list.push(e);
    byArea.set(area, list);
  }
  const blocks: string[] = [
    '## API Reference',
    '',
    'Complete, generated TypeDoc reference. Every symbol has a plain-markdown companion (the `.md` links below).',
  ];
  for (const area of API_AREA_ORDER) {
    const entries = (byArea.get(area) ?? []).sort((a, b) => a.title.localeCompare(b.title));
    if (entries.length === 0) continue;
    blocks.push(`### ${area}\n\n${entries.map((e) => renderLink(origin, e)).join('\n')}`);
  }
  return blocks.join('\n\n');
}

function buildIndex(origin: string): string {
  const bySection = collectEntries();
  const parts: string[] = [INTRO.trim()];

  for (const section of SECTION_ORDER) {
    if (section === 'API') continue; // the exhaustive API gets its own section below
    const entries = bySection.get(section) ?? [];
    if (entries.length === 0) continue;
    parts.push(`## ${section}\n\n${entries.map((e) => renderLink(origin, e)).join('\n')}`);
  }

  const apiEntries = bySection.get('API') ?? [];
  if (apiEntries.length > 0) parts.push(renderApiSection(origin, apiEntries));

  parts.push(
    [
      '## Optional',
      '',
      `- [Full documentation](${origin}/llms-full.txt): Every guide, plugin and adapter page inlined into one file for one-shot ingestion.`,
    ].join('\n'),
  );

  return parts.join('\n\n') + '\n';
}

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://toolboxjs.com';
  return new Response(buildIndex(origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
