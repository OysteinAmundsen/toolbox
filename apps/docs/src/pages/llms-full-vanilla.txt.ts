/**
 * llms-full-vanilla.txt.ts — Vanilla (TypeScript / JavaScript) variant of
 * `llms-full.txt`.
 *
 * Thin wrapper over the shared `buildFull` builder: keeps the plain
 * TypeScript/JS/HTML code examples and drops all three framework adapter trees
 * (React, Vue, Angular). See `_llm-full-builder.ts`.
 */
import type { APIRoute } from 'astro';

import { buildFull } from './_llm-full-builder';

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://toolboxjs.com';
  return new Response(buildFull(origin, 'vanilla'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
