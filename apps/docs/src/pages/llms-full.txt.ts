/**
 * llms-full.txt.ts — Generated `llms-full.txt` (the full-content file).
 *
 * Per the llmstxt.org convention, `llms-full.txt` is the documentation
 * concatenated into one file for one-shot ingestion — distinct from `llms.txt`,
 * which is only the curated link map. The concatenation/ordering logic lives in
 * the shared `buildFull` builder so the per-framework variants
 * (`llms-full-{react,vue,angular,vanilla}.txt`) reuse the exact same code.
 */
import type { APIRoute } from 'astro';

import { buildFull } from './_llm-full-builder';

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://toolboxjs.com';
  return new Response(buildFull(origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
