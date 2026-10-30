// Prove a CSS pipeline change (lightningcss targets, prefixes, nesting, partial
// restructuring) renders identically: mount a real grid from dist/ in Chromium,
// snapshot every computed property of every element (+ ::before/::after), swap
// the injected stylesheet for another build's, re-snapshot, diff.
//
//   bun nx build grid                                     # build A (e.g. with the change)
//   node .github/skills/bundle-check/css-parity.mjs --dump=tmp/styles-a.css
//   <build the baseline revision in a detached worktree and copy its dist/libs/grid over>
//   node .github/skills/bundle-check/css-parity.mjs --compare=tmp/styles-a.css
//   bun nx build grid                                     # restore dist to build A
//
// Full recipe (worktree + node_modules junction) in SKILL.md. Exit 1 and a DIFF line per
// differing property when the two stylesheets disagree; exit 2 when the fixture is
// incomplete or unstable (the comparison would be meaningless).
// Set CHROME_EXE to a Chromium binary when Playwright's bundled one is not installed
// (e.g. `%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`).
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dumpTo = arg('dump');
const compareWith = arg('compare');
if (!dumpTo && !compareWith) {
  console.error('usage: css-parity.mjs --dump=<file> | --compare=<file>');
  process.exit(2);
}

const dist = resolve('dist/libs/grid');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };
const browser = await chromium.launch(process.env.CHROME_EXE ? { executablePath: process.env.CHROME_EXE } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.route('http://grid.test/**', (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/') {
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head>
<script type="importmap">{"imports":{"@toolbox-web/grid":"/index.js"}}</script>
<style>body{margin:0;font-family:sans-serif} tbw-grid{height:600px;display:block}</style>
</head><body><tbw-grid></tbw-grid></body></html>`,
    });
  }
  const file = resolve(dist, '.' + url.pathname);
  if (!existsSync(file)) return route.fulfill({ status: 404, body: 'not found: ' + file });
  return route.fulfill({ contentType: mime[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) });
});
await page.goto('http://grid.test/');
// A representative fixture: sorted + grouped header, boolean/date cells, filter icons,
// range selection with a focused cell, virtualized row count.
await page.addScriptTag({
  type: 'module',
  content: `
import '/index.js';
import { SelectionPlugin } from '/lib/plugins/selection/index.js';
import { GroupingColumnsPlugin } from '/lib/plugins/grouping-columns/index.js';
import { FilteringPlugin } from '/lib/plugins/filtering/index.js';
const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', width: 80 },
    { field: 'name', header: 'Name', group: 'Person', sortable: true },
    { field: 'email', header: 'Email', group: 'Person' },
    { field: 'active', header: 'Active', type: 'boolean' },
    { field: 'joined', header: 'Joined', type: 'date' },
  ],
  plugins: [new SelectionPlugin({ mode: 'range' }), new GroupingColumnsPlugin(), new FilteringPlugin()],
};
grid.rows = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: 'Person ' + i, email: 'p' + i + '@x.io', active: i % 2 === 0, joined: new Date(2024, i % 12, 1) }));
await grid.ready();
grid.sort('name', 'asc');
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
window.__ready = true;`,
});
await page.waitForFunction(() => window.__ready === true);
await page.locator('.data-grid-row .cell').nth(3).click();
await page.waitForTimeout(300);

// Guard the fixture itself: every state the comparison is meant to cover must be live,
// otherwise a parity "pass" silently stops covering it.
const fixture = await page.evaluate(() => ({
  sorted: !!document.querySelector('tbw-grid [role="columnheader"][aria-sort="ascending"]'),
  grouped: !!document.querySelector('tbw-grid .header-group-row'),
  selected: !!document.querySelector('tbw-grid .data-grid-row > .cell.selected'),
  rows: document.querySelectorAll('tbw-grid .data-grid-row').length,
}));
const missing = Object.entries(fixture)
  .filter(([k, v]) => (k === 'rows' ? v === 0 : !v))
  .map(([k]) => k);
if (missing.length) {
  console.log('fixture incomplete:', missing.join(', '), JSON.stringify(fixture));
  await browser.close();
  process.exit(2);
}

const styleSelector = 'style[data-tbw-grid]';
if (dumpTo) {
  writeFileSync(dumpTo, await page.evaluate((s) => document.querySelector(s).textContent, styleSelector));
  console.log('dumped stylesheet to', dumpTo);
  await browser.close();
  process.exit(0);
}

const snapshot = () =>
  page.evaluate(() => {
    const out = {};
    const root = document.querySelector('tbw-grid');
    const path = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const idx = e.parentElement ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0;
        const cls =
          typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '';
        parts.unshift(e.tagName.toLowerCase() + cls + ':' + idx);
      }
      return parts.join('>');
    };
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && cs.content === 'none') continue;
        const o = {};
        for (let i = 0; i < cs.length; i++) o[cs[i]] = cs.getPropertyValue(cs[i]);
        out[path(el) + (pseudo ?? '')] = o;
      }
    }
    return out;
  });

// Two snapshots of the SAME stylesheet first: any difference here is DOM/state drift,
// not CSS, and would poison the comparison.
const a0 = await snapshot();
await page.waitForTimeout(400);
const a = await snapshot();
let drift = 0;
for (const k of Object.keys(a)) for (const p of Object.keys(a[k])) if (a0[k]?.[p] !== a[k][p]) drift++;
if (drift) {
  console.log(`fixture not stable (${drift} drifting properties) — aborting`);
  await browser.close();
  process.exit(2);
}

await page.evaluate(
  ([s, css]) => (document.querySelector(s).textContent = css),
  [styleSelector, readFileSync(compareWith, 'utf8')],
);
await page.waitForTimeout(300);
const b = await snapshot();

let diffs = 0;
for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (!a[key] || !b[key]) {
    diffs++;
    console.log('MISSING in', !a[key] ? 'current build' : 'compared stylesheet', key.slice(-100));
    continue;
  }
  for (const p of new Set([...Object.keys(a[key]), ...Object.keys(b[key])])) {
    if (a[key][p] !== b[key][p]) {
      diffs++;
      console.log('DIFF', key.slice(-100), p, JSON.stringify(b[key][p]), '→', JSON.stringify(a[key][p]));
    }
  }
}
console.log(`compared ${Object.keys(a).length} elements/pseudos — ${diffs} differing properties`);
await browser.close();
process.exit(diffs ? 1 : 0);
