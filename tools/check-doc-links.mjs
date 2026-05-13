#!/usr/bin/env node
// Audit internal markdown links in curated MDX docs (skip typedoc-generated subfolders).
import { readFileSync, statSync } from 'node:fs';
import { globSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve('apps/docs/src/content/docs');

// Collect curated mdx files
const all = execSync('find apps/docs/src/content/docs -name "*.mdx"', { encoding: 'utf8' }).trim().split('\n');

const TYPEDOC_DIRS = ['/api/', '/Classes/', '/Interfaces/', '/Functions/', '/Types/', '/Variables/', '/Enumerations/'];
const curated = all.filter((f) => !TYPEDOC_DIRS.some((d) => f.includes(d)));

// Build a set of all valid page slugs (every mdx becomes a route).
// Astro is configured with `trailingSlash: 'always'` (apps/docs/astro.config.mjs),
// so the canonical form is /foo/bar/ — links without the trailing slash 404.
// We store ONLY the trailing-slash form so the audit catches missing slashes.
const slugs = new Set();
for (const f of all) {
  const rel = path
    .relative(ROOT, f)
    .replaceAll('\\', '/')
    .replace(/\.mdx$/, '');
  let slug = '/' + rel.toLowerCase();
  if (slug.endsWith('/index')) slug = slug.slice(0, -'/index'.length) || '/';
  slugs.add(slug === '/' ? '/' : slug + '/');
}

// Also accept root '/'
slugs.add('/');

// Find anchors in each page (## headings -> slugified)
const anchorsByPage = new Map();
function slugify(s) {
  // Mirror github-slugger behavior used by Starlight: lowercase, strip
  // backticks/punctuation, replace each whitespace with '-' (do NOT collapse
  // runs of whitespace into a single dash — "A & B" becomes "a--b").
  return s
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');
}
for (const f of all) {
  const rel = path
    .relative(ROOT, f)
    .replaceAll('\\', '/')
    .replace(/\.mdx$/, '');
  let slug = '/' + rel.toLowerCase();
  if (slug.endsWith('/index')) slug = slug.slice(0, -'/index'.length) || '/';
  const content = readFileSync(f, 'utf8');
  const anchors = new Set();
  for (const m of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    anchors.add(slugify(m[1]));
  }
  // Also pick up explicit {#id} anchors
  for (const m of content.matchAll(/\{#([a-z0-9-]+)\}/gi)) {
    anchors.add(m[1].toLowerCase());
  }
  anchorsByPage.set(slug === '/' ? '/' : slug + '/', anchors);
}

const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
const broken = [];

for (const f of curated) {
  const content = readFileSync(f, 'utf8');
  const lines = content.split('\n');
  for (const m of content.matchAll(linkRe)) {
    const url = m[2].trim();
    // Skip external, mailto, anchors-only, images-data
    if (/^(https?:|mailto:|tel:|data:|#)/i.test(url)) continue;
    // Resolve relative to file
    let target = url.split('?')[0];
    let hash = '';
    const hi = target.indexOf('#');
    if (hi >= 0) {
      hash = target.slice(hi + 1);
      target = target.slice(0, hi);
    }
    if (target === '') {
      // Pure hash link, skip
      continue;
    }
    let resolved;
    if (target.startsWith('/')) {
      resolved = target.toLowerCase();
    } else if (target.startsWith('./') || target.startsWith('../') || !target.startsWith('/')) {
      // Resolve relative to the directory the file lives in (Starlight serves
      // index.mdx at /foo/bar/, so relative links resolve from /foo/bar/).
      const relDir = path.relative(ROOT, path.dirname(f)).replaceAll('\\', '/');
      const baseDir = '/' + relDir.toLowerCase();
      resolved = path.posix.normalize(baseDir + '/' + target).toLowerCase();
    }
    // Strip trailing slash for slug lookup, but keep for set membership
    const norm1 = resolved.replace(/\/+$/, '') || '/';
    const norm2 = norm1 === '/' ? '/' : norm1 + '/';
    // Skip non-doc paths (e.g., /assets/, .png)
    if (/\.(png|jpg|jpeg|svg|gif|webp|css|js|json|pdf|zip)$/i.test(norm1)) continue;

    const exists = slugs.has(norm2);
    if (!exists) {
      // Find line number
      const idx = content.indexOf(m[0]);
      const line = content.slice(0, idx).split('\n').length;
      // Distinguish "page missing" from "missing trailing slash" — both 404
      // under trailingSlash:'always', but the latter has a clearer fix.
      const reason =
        slugs.has(norm1 + '/') && !resolved.endsWith('/')
          ? `missing trailing slash (site uses trailingSlash: 'always')`
          : 'page not found';
      broken.push({ file: f, line, link: m[0], url, reason });
      continue;
    }
    if (hash) {
      const anchors = anchorsByPage.get(norm2);
      if (anchors && !anchors.has(hash.toLowerCase())) {
        const idx = content.indexOf(m[0]);
        const line = content.slice(0, idx).split('\n').length;
        broken.push({ file: f, line, link: m[0], url, reason: `anchor #${hash} not found on ${norm2}` });
      }
    }
  }
}

if (broken.length === 0) {
  console.log('No broken internal links found.');
} else {
  console.log(`Found ${broken.length} broken internal links:\n`);
  for (const b of broken) {
    console.log(`${b.file}:${b.line}  -> ${b.url}  (${b.reason})`);
  }
  process.exitCode = 1;
}
