/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Unit-test config for the docs app. Scoped to pure, framework-free helpers
 * (the agent-markdown transform, the CSS-variable registry) — NOT Astro pages
 * or components, which are validated by `astro build`. Picked up by the
 * `@nx/vitest` plugin to provide the `test` target (`bun nx test docs`).
 */
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/docs',
  test: {
    name: 'docs',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
  },
});
