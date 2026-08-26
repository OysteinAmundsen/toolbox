/**
 * Audits internal links across the docs content collection.
 *
 * Checks, for every markdown/MDX link that targets an internal docs path:
 *  - the target page exists (matching Astro's lowercased slugs) or is covered by a redirect
 *  - the `#anchor` fragment matches a heading (or explicit id) on the target page
 *  - the link is not a relative link written from a non-index page (resolves one level too deep)
 *  - the link contains no uppercase segments (Astro lowercases every slug)
 *
 * Usage: bun tools/docs-link-audit.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'apps/docs/src/content/docs');
const CONFIG = join(ROOT, 'apps/docs/astro.config.mjs');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.mdx') || entry.endsWith('.md')) out.push(full);
  }
  return out;
}

const files = walk(CONTENT);

/** file path -> slug, e.g. `grid/plugins/tree/index.mdx` -> `grid/plugins/tree` */
function slugOf(file: string): string {
  const rel = relative(CONTENT, file).replace(/\\/g, '/');
  return rel
    .replace(/\.mdx?$/, '')
    .replace(/(^|\/)index$/, '')
    .toLowerCase()
    .replace(/\/$/, '');
}

/** Repeats until stable so a nested `<<b>script>` cannot reassemble into a tag. */
function stripTags(text: string): string {
  let previous: string;
  let out = text;
  do {
    previous = out;
    out = out.replace(/<[^>]+>/g, '');
  } while (out !== previous);
  return out;
}

function slugify(text: string): string {
  return stripTags(text.trim().toLowerCase().replace(/`/g, ''))
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^\w\- ]/g, '')
    .trim()
    .replace(/\s/g, '-');
}

const anchors = new Map<string, Set<string>>();
const slugs = new Set<string>();

for (const file of files) {
  const slug = slugOf(file);
  slugs.add(slug);
  const src = readFileSync(file, 'utf8');
  const ids = new Set<string>();
  // strip fenced code so headings inside examples don't register
  const prose = src.replace(/```[\s\S]*?```/g, '');
  for (const m of prose.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    let heading = m[1];
    const explicit = heading.match(/\{#([\w-]+)\}\s*$/);
    if (explicit) {
      ids.add(explicit[1]);
      heading = heading.replace(/\{#[\w-]+\}\s*$/, '');
    }
    ids.add(slugify(heading));
  }
  // explicit anchors emitted as html ids
  for (const m of prose.matchAll(/\bid="([\w-]+)"/g)) ids.add(m[1]);
  anchors.set(slug, ids);
}

// redirects from astro config
const config = readFileSync(CONFIG, 'utf8');
const redirectBlock = config.match(/redirects:\s*\{([\s\S]*?)\n\s{2}\}/);
const redirects = new Map<string, string>();
if (redirectBlock) {
  for (const m of redirectBlock[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    redirects.set(m[1].replace(/^\/|\/$/g, '').toLowerCase(), m[2]);
  }
}

type Issue = { file: string; kind: string; detail: string };
const issues: Issue[] = [];

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)|href="([^"]+)"|href=\{'([^']+)'\}/g;

for (const file of files) {
  const relFile = relative(ROOT, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8');
  const prose = src.replace(/```[\s\S]*?```/g, '');
  const isIndex = /(^|[\\/])index\.mdx?$/.test(file);
  const selfSlug = slugOf(file);

  for (const m of prose.matchAll(LINK_RE)) {
    const raw = m[1] ?? m[2] ?? m[3];
    if (!raw) continue;
    if (/^(https?:|mailto:|#|\{)/.test(raw)) {
      if (raw.startsWith('#')) {
        const frag = raw.slice(1).toLowerCase();
        if (!anchors.get(selfSlug)?.has(frag)) {
          issues.push({ file: relFile, kind: 'missing-anchor', detail: `${raw} (self)` });
        }
      }
      continue;
    }
    if (!raw.startsWith('/') && !raw.startsWith('.')) continue; // bare filenames / external

    let [path, frag] = raw.split('#');
    if (raw.startsWith('.')) {
      // Every docs page is served with a trailing slash, so relative links resolve
      // from the page's own URL — including non-index pages (a common 404 source).
      path = '/' + join(selfSlug, path).replace(/\\/g, '/');
      if (!isIndex) issues.push({ file: relFile, kind: 'relative-from-non-index', detail: raw });
    }
    const norm = path.replace(/^\/|\/$/g, '');
    if (/[A-Z]/.test(norm)) {
      issues.push({ file: relFile, kind: 'uppercase-link', detail: raw });
    }
    // `/grid/foo.md` is the agent-markdown companion of `/grid/foo/`, served by `[...slug].md.ts`.
    const target = norm.replace(/\.md$/, '').toLowerCase();
    if (target === '') continue;
    let resolved = target;
    if (!slugs.has(resolved)) {
      const red = redirects.get(resolved);
      if (red) {
        resolved = red.replace(/^\/|\/$/g, '').toLowerCase();
        issues.push({ file: relFile, kind: 'via-redirect', detail: `${raw} -> /${resolved}/` });
      }
    }
    if (!slugs.has(resolved)) {
      // ignore non-content assets
      if (/\.(png|jpg|svg|json|txt|xml|css|js|zip)$/.test(resolved)) continue;
      issues.push({ file: relFile, kind: 'missing-page', detail: raw });
      continue;
    }
    if (frag) {
      const f = frag.toLowerCase();
      if (!anchors.get(resolved)?.has(f)) {
        issues.push({ file: relFile, kind: 'missing-anchor', detail: `${raw}` });
      }
    }
  }
}

const byKind = new Map<string, Issue[]>();
for (const i of issues) {
  if (!byKind.has(i.kind)) byKind.set(i.kind, []);
  byKind.get(i.kind)!.push(i);
}
for (const [kind, list] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n=== ${kind} (${list.length}) ===`);
  for (const i of list) console.log(`  ${i.file}: ${i.detail}`);
}
console.log(`\nTotal issues: ${issues.length} across ${files.length} files`);
