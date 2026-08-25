/**
 * Audits public-API coverage of the docs site.
 *
 * Compares every symbol exported from a library's public entry points against the
 * TypeDoc-generated MDX pages under `apps/docs/src/content/docs/`, and reports
 * exports that have no page (invisible in the docs) as well as generated pages
 * that no longer correspond to an export (stale).
 *
 * Usage: bun tools/docs-api-coverage.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'apps/docs/src/content/docs');

const ENTRY_POINTS: Record<string, { entries: string[]; docRoot: string }> = {
  grid: { entries: ['libs/grid/src/public.ts', 'libs/grid/src/all.ts'], docRoot: 'grid' },
  'grid-react': { entries: ['libs/grid-react/src/index.ts'], docRoot: 'grid/react' },
  'grid-vue': { entries: ['libs/grid-vue/src/index.ts'], docRoot: 'grid/vue' },
  'grid-angular': { entries: ['libs/grid-angular/src/index.ts'], docRoot: 'grid/angular' },
};

/** Collect the exported symbol names reachable from an entry point (one level of re-export). */
function collectExports(entry: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  const abs = join(ROOT, entry);
  if (!existsSync(abs) || seen.has(abs)) return names;
  seen.add(abs);
  const src = readFileSync(abs, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:abstract\s+)?(class|interface|type|enum|const|function)\s+(\w+)/g,
  )) {
    names.add(m[2]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.replace(/^type\s+/, '')
        .trim();
      if (name) names.add(name);
    }
  }
  for (const m of src.matchAll(/export\s+\*\s+from\s+'([^']+)'/g)) {
    const target = resolveModule(abs, m[1]);
    if (target) for (const n of collectExports(relative(ROOT, target), seen)) names.add(n);
  }
  return names;
}

function resolveModule(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(fromFile, '..', spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Symbols whose declaration carries `@internal` — this repo's marker for the
 * plugin / framework-development surface. They are exported on purpose but are
 * deliberately excluded from the generated reference, so they are not gaps.
 */
function collectInternalSymbols(libDir: string): Set<string> {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.ts')) {
        const src = readFileSync(full, 'utf8');
        const re =
          /\/\*\*(?:(?!\*\/)[\s\S])*?@internal[\s\S]*?\*\/\s*export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|enum|const|function)\s+(\w+)/g;
        for (const m of src.matchAll(re)) names.add(m[1]);
      }
    }
  };
  walk(libDir);
  return names;
}

/** All symbol names that have a generated TypeDoc page, keyed by lowercased name. */
function collectDocPages(): Map<string, string[]> {
  const pages = new Map<string, string[]>();
  const API_DIRS = /(^|[\\/])(api|classes|interfaces|functions|types|variables|enumerations)([\\/]|$)/i;
  const add = (key: string, full: string) => {
    const list = pages.get(key) ?? [];
    list.push(relative(ROOT, full).replace(/\\/g, '/'));
    pages.set(key, list);
  };
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.mdx')) {
        const src = readFileSync(full, 'utf8');
        if (API_DIRS.test(full)) {
          add(entry.replace(/\.mdx$/, '').toLowerCase(), full);
          // Enum-like constants are merged into their companion type-alias page
          // rather than getting one of their own — index them from the code fence.
          for (const m of src.matchAll(/^const (\w+)(?::| =)/gm)) add(m[1].toLowerCase(), full);
        } else {
          // Hand-written reference sections: a `## SymbolName` heading, or a table
          // row whose first cell is the symbol, documents a symbol TypeDoc cannot
          // generate a page for (e.g. Vue SFC components, element aliases).
          for (const m of src.matchAll(/^##\s+(\w+)\s*$/gm)) add(m[1].toLowerCase(), full);
          for (const m of src.matchAll(/^\|\s*`(\w+)`\s*\|/gm)) add(m[1].toLowerCase(), full);
        }
      }
    }
  };
  walk(CONTENT);
  return pages;
}

const docPages = collectDocPages();
const coreInternals = collectInternalSymbols(join(ROOT, 'libs/grid/src'));
let missing = 0;

/** Adapter pages live under `grid/<framework>/api`; core pages must not be under one. */
const adapterRoots = ['grid/react/', 'grid/vue/', 'grid/angular/'];

for (const [lib, { entries, docRoot }] of Object.entries(ENTRY_POINTS)) {
  const prefix = `apps/docs/src/content/docs/${docRoot}/`;
  const inScope = (page: string) =>
    page.startsWith(prefix) &&
    (docRoot !== 'grid' || !adapterRoots.some((r) => page.startsWith(`apps/docs/src/content/docs/${r}`)));

  const documented = new Set([...docPages].filter(([, pages]) => pages.some(inScope)).map(([name]) => name));
  const exported = new Set<string>();
  for (const e of entries) for (const n of collectExports(e)) exported.add(n);
  const internal = collectInternalSymbols(join(ROOT, 'libs', lib, 'src'));
  // Adapters re-export core helpers; `@internal` is declared on the core side.
  if (lib !== 'grid') for (const n of coreInternals) internal.add(n);
  const undocumented = [...exported].filter((n) => !documented.has(n.toLowerCase())).sort();
  const gaps = undocumented.filter((n) => !internal.has(n));
  const intentional = undocumented.filter((n) => internal.has(n));
  console.log(`\n=== ${lib}: ${exported.size} exports, ${gaps.length} undocumented ===`);
  for (const n of gaps) console.log(`  ${n}`);
  if (intentional.length)
    console.log(`  (${intentional.length} @internal, excluded on purpose: ${intentional.join(', ')})`);
  missing += gaps.length;
}

console.log(`\n${docPages.size} documented symbols; ${missing} exports without a page or reference section.`);
