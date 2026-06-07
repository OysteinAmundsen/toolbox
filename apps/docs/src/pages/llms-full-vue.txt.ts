/**
 * llms-full-vue.txt.ts — Vue-scoped variant of `llms-full.txt`.
 *
 * Thin wrapper over the shared `buildFull` builder: keeps only Vue code examples
 * and drops the React/Angular adapter pages. See `_llm-full-builder.ts`.
 */
import type { APIRoute } from 'astro';

import { buildFull } from './_llm-full-builder';

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://toolboxjs.com';
  return new Response(buildFull(origin, 'vue'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
