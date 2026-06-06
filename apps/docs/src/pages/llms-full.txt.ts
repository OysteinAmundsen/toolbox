/**
 * llms-full.txt.ts — Generated `llms-full.txt` (the full-content file).
 *
 * Per the llmstxt.org convention, `llms-full.txt` is the documentation
 * concatenated into one file for one-shot ingestion — distinct from `llms.txt`,
 * which is only the curated link map. Here it is the concatenation of every
 * PROSE page's `mdxToAgentMarkdown(...)` output (guides, plugins, framework
 * adapters), so it is ALWAYS in sync with the per-page `.md` companions (same
 * transform, same source) — zero drift.
 *
 * The exhaustive per-symbol TypeDoc API (~580 pages, ~1 MB) is NOT inlined —
 * that would more than double the file and bury the conceptual docs. Instead it
 * is appended as a linked `## API Reference` index (grouped by area), so each
 * symbol stays one `.md` fetch away while the file stays ingestion-friendly.
 *
 * Ordering: prose pages are grouped by section (intro → guides → plugins →
 * adapters) then by slug; the linked API index closes the file.
 */
import type { APIRoute } from 'astro';

import { extractFrontmatter, mdxToAgentMarkdown } from './_llm-markdown';
import {
  API_AREA_ORDER,
  apiAreaOf,
  compareSlugsInSection,
  cssVariableReferenceMarkdown,
  docSources,
  hasDoc,
  keyToSlug,
  resolveDemo,
  SECTION_ORDER,
  sectionOf,
} from './_llm-sources';

const HEADER = `# @toolbox-web/grid — Full Documentation

> A high-performance, framework-agnostic data grid built with pure TypeScript and native Web Components. Zero runtime dependencies.

This file concatenates every prose documentation page — guides, plugins, and
framework adapters — into one document for one-shot ingestion. Demo code is
inlined as fenced blocks. The exhaustive per-symbol TypeDoc API is linked (not
inlined) at the end to keep this file small; fetch any symbol by appending
\`.md\` to its page URL. For the curated link index, see \`llms.txt\`.

A few non-implementation pages (e.g. the competitor comparison) are intentionally
omitted here to keep the corpus focused on building with the grid; they remain
linked in \`llms.txt\`.
`;

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

function buildFull(origin: string): string {
  const allPages = Object.entries(docSources).map(([key, source]) => ({ slug: keyToSlug(key), source }));

  // Prose pages (everything except per-symbol API), grouped by section then slug.
  // Pages whose frontmatter sets `llmsFull: false` (sales/marketing — e.g. the
  // competitor comparison) are omitted here but stay linked in `llms.txt`.
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
    mdxToAgentMarkdown(p.source, { resolveDemo, hasDoc, cssVarReference: cssVariableReferenceMarkdown }).trim(),
  );

  // Per-symbol API pages, linked (not inlined) at the end.
  const apiEntries: ApiEntry[] = allPages
    .filter((p) => sectionOf(p.slug) === 'API')
    .map((p) => ({ slug: p.slug, title: titleFromSlug(p.slug) }));

  const body = [HEADER.trim(), sections.join('\n\n---\n\n'), renderApiIndex(origin, apiEntries)];
  return body.join('\n\n---\n\n') + '\n';
}

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://toolboxjs.com';
  return new Response(buildFull(origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
