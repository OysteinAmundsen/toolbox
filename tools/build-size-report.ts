/**
 * Build Size Report — generates a Markdown summary of bundle sizes.
 *
 * Usage:
 *   bun run tools/build-size-report.ts [--ci]
 *
 * Without --ci: prints a table to stdout.
 * With --ci:    appends a Markdown table to $GITHUB_STEP_SUMMARY.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = resolve(import.meta.dirname, '..', 'dist', 'libs');
const CI = process.argv.includes('--ci');

// ─── Helpers ──────────────────────────────────────────────────────────

function sizeOf(filePath: string): { raw: number; gzip: number } | null {
  if (!existsSync(filePath)) return null;
  const buf = readFileSync(filePath);
  return { raw: buf.length, gzip: gzipSync(buf).length };
}

function fmt(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

function fmtCell(info: { raw: number; gzip: number } | null): string {
  if (!info) return '—';
  return `${fmt(info.raw)} (${fmt(info.gzip)})`;
}

// ─── Collect sizes ────────────────────────────────────────────────────

interface LibRow {
  label: string;
  grid: { raw: number; gzip: number } | null;
  angular: { raw: number; gzip: number } | null;
  react: { raw: number; gzip: number } | null;
  vue: { raw: number; gzip: number } | null;
}

const rows: LibRow[] = [];

// Core entry (index.js)
rows.push({
  label: '**core** (index.js)',
  grid: sizeOf(resolve(DIST, 'grid/index.js')),
  angular: sizeOf(resolve(DIST, 'grid-angular/fesm2022/toolbox-web-grid-angular.mjs')),
  react: sizeOf(resolve(DIST, 'grid-react/index.js')),
  vue: sizeOf(resolve(DIST, 'grid-vue/index.js')),
});

// All-in-one (grid only)
rows.push({
  label: '**all** (all.js)',
  grid: sizeOf(resolve(DIST, 'grid/all.js')),
  angular: null,
  react: null,
  vue: null,
});

// Individual plugins / features
// Discover from grid plugins (canonical source of truth)
const gridPluginsDir = resolve(DIST, 'grid/lib/plugins');
const pluginNames = existsSync(gridPluginsDir)
  ? readdirSync(gridPluginsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'shared')
      .map((d) => d.name)
      .sort()
  : [];

for (const name of pluginNames) {
  // Angular features use a slightly different naming: toolbox-web-grid-angular-features-<name>.mjs
  const angularFile = resolve(DIST, 'grid-angular/fesm2022', `toolbox-web-grid-angular-features-${name}.mjs`);

  rows.push({
    label: name,
    grid: sizeOf(resolve(DIST, `grid/lib/plugins/${name}/index.js`)),
    angular: sizeOf(angularFile),
    react: sizeOf(resolve(DIST, `grid-react/features/${name}.js`)),
    vue: sizeOf(resolve(DIST, `grid-vue/features/${name}.js`)),
  });
}

// ─── Render Markdown ──────────────────────────────────────────────────

const lines: string[] = [];
lines.push('## 📦 Build Size Report');
lines.push('');
lines.push('> Sizes shown as raw (gzip)');
lines.push('');
lines.push('| Entry | grid | angular | react | vue |');
lines.push('| :--- | ---: | ---: | ---: | ---: |');

for (const row of rows) {
  lines.push(
    `| ${row.label} | ${fmtCell(row.grid)} | ${fmtCell(row.angular)} | ${fmtCell(row.react)} | ${fmtCell(row.vue)} |`,
  );
}

lines.push('');

const md = lines.join('\n');

// ─── Output ───────────────────────────────────────────────────────────

if (CI) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    writeFileSync(summaryPath, md, { flag: 'a' });
    console.log('Build size report appended to $GITHUB_STEP_SUMMARY');
  } else {
    console.warn('$GITHUB_STEP_SUMMARY not set — printing to stdout instead');
    console.log(md);
  }
} else {
  console.log(md);
}
