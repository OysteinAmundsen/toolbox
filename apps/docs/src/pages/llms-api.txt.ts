/**
 * llms-api.txt.ts — Generated `llms-api.txt`: the exhaustive per-symbol TypeDoc
 * link index, split out of `llms.txt`.
 *
 * WHY a separate file: `llms.txt` is meant to be the CHEAP orientation read — an
 * agent fetches it to find out what exists and where to look next. The generated
 * API surface is ~600 symbol links, which was roughly three quarters of
 * `llms.txt`'s bytes and dwarfed the curated prose map it is supposed to lead
 * with. Moving it here keeps the index small enough to read on every session
 * while leaving every symbol exactly one extra fetch away — the same "link, don't
 * inline" trade `llms-full.txt` already makes for the API.
 *
 * Both files render the API from the same `docSources` glob, so the two can never
 * drift.
 */
import type { APIRoute } from 'astro';

import { extractFrontmatter } from './_llm-markdown';
import { API_AREA_ORDER, apiAreaOf, docSources, keyToSlug, sectionOf } from './_llm-sources';

/** Derive a human title from a slug when frontmatter has none (the common case for TypeDoc pages). */
function titleFromSlug(slug: string): string {
  const last = slug.split('/').pop() ?? slug;
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the exhaustive API link index for the given origin. Exported so tests and
 * the docs size widget can measure the exact bytes served.
 */
export function buildApiIndex(origin: string): string {
  const byArea = new Map<string, { slug: string; title: string }[]>();
  for (const [key, source] of Object.entries(docSources)) {
    const slug = keyToSlug(key);
    if (sectionOf(slug) !== 'API') continue;
    const area = apiAreaOf(slug);
    const list = byArea.get(area) ?? [];
    list.push({ slug, title: extractFrontmatter(source).title ?? titleFromSlug(slug) });
    byArea.set(area, list);
  }

  const total = [...byArea.values()].reduce((n, list) => n + list.length, 0);
  const parts: string[] = [
    `# @toolbox-web/grid — API Reference Index`,
    '',
    `> Complete generated TypeDoc reference: ${total} symbols, each linked to its plain-markdown companion.`,
    '',
    `This file is the API half of \`llms.txt\`, split out so the index itself stays small. Every link below is the \`.md\` companion of a generated TypeDoc page — fetch one directly, or append \`.md\` to any \`${origin}/grid/**\` docs URL. For prose documentation (guides, plugins, adapters) see \`${origin}/llms.txt\`; for the inlined corpus see \`${origin}/llms-full.txt\`.`,
  ];

  for (const area of API_AREA_ORDER) {
    const entries = (byArea.get(area) ?? []).sort((a, b) => a.title.localeCompare(b.title));
    if (entries.length === 0) continue;
    parts.push(`## ${area}\n\n${entries.map((e) => `- [${e.title}](${origin}/${e.slug}.md)`).join('\n')}`);
  }

  return parts.join('\n\n') + '\n';
}

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://toolboxjs.com';
  return new Response(buildApiIndex(origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
