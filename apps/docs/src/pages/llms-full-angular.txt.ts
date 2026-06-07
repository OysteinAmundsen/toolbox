/**
 * llms-full-angular.txt.ts — Angular-scoped variant of `llms-full.txt`.
 *
 * Thin wrapper over the shared `buildFull` builder: keeps only Angular code
 * examples and drops the React/Vue adapter pages. See `_llm-full-builder.ts`.
 */
import type { APIRoute } from 'astro';

import { buildFull } from './_llm-full-builder';

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://toolboxjs.com';
  return new Response(buildFull(origin, 'angular'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
