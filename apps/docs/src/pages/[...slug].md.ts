/**
 * [...slug].md.ts — Plain-Markdown companion route for AI agents.
 *
 * For every docs page under `grid/`, this emits a `<slug>.md` document containing
 * a lean Markdown rendering of the same source the human-facing HTML is built
 * from — single source of truth, no parallel agent docs to keep in sync. Demo
 * `<script>` blocks are inlined as fenced code (see `_llm-markdown.ts`).
 *
 * Why a route (not a CI copy step): only here do we have Astro/Vite's
 * `import.meta.glob` to resolve imported demo components back to their `.astro`
 * source and inline their code — a raw file copy would re-expose the demo as an
 * opaque component tag.
 *
 * URL shape: append `.md` to any docs route — `/grid/introduction/` becomes
 * `/grid/introduction.md`. The `.md` filename suffix keeps this root-level route
 * from colliding with Starlight's own catch-all (which only serves `/`-suffixed
 * HTML routes).
 *
 * PROTOTYPE SCOPE: limited to `grid/` prose pages. Generated TypeDoc API MDX
 * (gitignored, regenerated into the grid docs `api` tree) flows through the
 * same glob automatically once present at build time.
 */
import type { APIRoute, GetStaticPaths } from 'astro';

import { mdxToAgentMarkdown } from './_llm-markdown';
import { docSources, hasDoc, keyToSlug, resolveDemo } from './_llm-sources';

export const getStaticPaths: GetStaticPaths = () =>
  // `.md` is a STATIC suffix in the route filename (`[...slug].md.ts`), so the
  // captured slug is the bare doc path. A real file extension in the route path
  // is exempt from `trailingSlash: 'always'`, so appending `.md` to ANY docs
  // route (e.g. `/grid/introduction/` -> `/grid/introduction.md`) yields a clean
  // agent-markdown URL with no trailing slash, in BOTH dev and the static build.
  Object.keys(docSources).map((key) => ({ params: { slug: keyToSlug(key) } }));

export const GET: APIRoute = ({ params }) => {
  const slug = params.slug ?? '';
  const entry = Object.entries(docSources).find(([key]) => keyToSlug(key) === slug);
  if (!entry) return new Response('Not found', { status: 404 });

  const markdown = mdxToAgentMarkdown(entry[1], { resolveDemo, hasDoc });
  return new Response(markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
