/**
 * Audits the built documentation site against WCAG 2.2 AA with axe-core.
 *
 * The docs-e2e Playwright project deliberately runs against a bare Astro
 * harness (vite aliases + `/demo/<slug>` routes, no Starlight, no MDX), so it
 * can never see the prose pages, the sidebar, the search dialog, or the
 * generated TypeDoc reference. That surface is the majority of what a reader
 * actually navigates, and until this script existed nothing checked it.
 *
 * Scans a curated route sample — one page per structural template, plus a
 * TypeDoc class/interface/type/function page — in both `light` and `dark`, and
 * aggregates the findings by rule so the output stays readable.
 *
 * Run it with **node**, not bun. Playwright drives the browser over
 * `--remote-debugging-pipe`, and under Bun on Windows the child process
 * launches but never becomes controllable — `chromium.launch()` just sits
 * there until its 180s timeout. The Playwright *test runner* is unaffected
 * because it spawns its own node worker, which is why `bun nx e2e docs-e2e`
 * works while a `bun tools/*.ts` script using the same API does not.
 *
 * Usage:
 *   bun nx build docs                 # dist/docs must exist and be current
 *   node --experimental-strip-types tools/docs-a11y-audit.ts
 *   node --experimental-strip-types tools/docs-a11y-audit.ts --all        # every built route (slow)
 *   node --experimental-strip-types tools/docs-a11y-audit.ts --theme=dark # single theme
 *   node --experimental-strip-types tools/docs-a11y-audit.ts --json       # machine-readable output
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist/docs');
const AXE = join(ROOT, 'node_modules/axe-core/axe.min.js');

/** The published conformance target. Tags are additive, not hierarchical. */
const WCAG22AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

/**
 * `target-size` is checked by the docs-e2e suite with a hand-rolled
 * measurement instead: axe cannot tell scroll clipping from occlusion, and the
 * docs pages embed live grids whose last virtualized row is always half cut.
 */
const DISABLED_RULES = ['target-size'];

/**
 * One route per page template. Adding a route here is cheap; adding a *kind* of
 * page to the docs without adding it here is how a template regression hides.
 */
const CURATED_ROUTES: ReadonlyArray<readonly [label: string, route: string]> = [
  ['splash / landing', '/'],
  ['introduction', '/grid/introduction'],
  ['getting started', '/grid/getting-started'],
  // Prose guides with tables, asides, code blocks, and heading-anchor links.
  ['guide (accessibility)', '/grid/guides/accessibility'],
  ['guide (theming)', '/grid/guides/theming'],
  ['guide (conformance report)', '/grid/guides/conformance-report'],
  // Plugin overview pages embed live `<tbw-grid>` demos inside prose.
  ['plugin overview', '/grid/plugins/filtering'],
  ['plugin index', '/grid/plugins'],
  // Framework-adapter pages carry per-framework tab groups.
  ['framework adapters', '/grid/framework-adapters'],
  ['angular getting started', '/grid/angular/getting-started'],
  // Generated TypeDoc — one of each emitted kind, since they use distinct
  // templates (member tables, signature blocks, inherited-from lists).
  ['typedoc class', '/grid/plugins/filtering/classes/filteringplugin'],
  ['typedoc interface', '/grid/plugins/filtering/interfaces/filterconfig'],
  ['typedoc type alias', '/grid/plugins/filtering/types/filteroperator'],
  ['typedoc function', '/grid/plugins/pinned-rows/functions/rowcountpanel'],
  ['typedoc variable', '/grid/plugins/filtering/variables/blank_filter_value'],
  ['api reference index', '/grid/api-reference'],
  // Long generated tables.
  ['errors reference', '/grid/errors'],
  ['changelog', '/grid/changelog'],
  // 404 is a real page a reader can land on.
  ['not found', '/404'],
];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

interface AxeNode {
  html: string;
  target: string[];
  failureSummary?: string;
}
interface AxeViolation {
  id: string;
  help: string;
  helpUrl: string;
  impact?: string | null;
  nodes: AxeNode[];
}
interface Finding {
  route: string;
  label: string;
  theme: string;
  violation: AxeViolation;
}

declare global {
  interface Window {
    axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: AxeViolation[] }> };
  }
}

function listBuiltRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'index.html') {
        const rel = relative(DIST, full)
          .replace(/\\/g, '/')
          .replace(/index\.html$/, '');
        out.push(`/${rel}`.replace(/\/+$/, '') || '/');
      }
    }
  };
  walk(DIST);
  return out.sort();
}

/**
 * Serves `dist/docs` exactly as a static host would: a bare directory route
 * resolves to its `index.html`, anything unmatched falls through to `404.html`.
 */
function serveDist(port: number) {
  const handler = (req: IncomingMessage, res: ServerResponse) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    // Reject traversal before touching the filesystem.
    const candidate = resolve(DIST, `.${url}`);
    if (!candidate.startsWith(DIST)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let file = candidate;
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const indexed = join(file, 'index.html');
      file = existsSync(indexed) ? indexed : join(DIST, '404.html');
    }
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }

    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  };

  const server = createServer(handler);
  return new Promise<{ close: () => Promise<void> }>((ok) => {
    server.listen(port, () => ok({ close: () => new Promise<void>((done) => server.close(() => done())) }));
  });
}

async function scanRoute(page: Page, url: string, theme: string): Promise<AxeViolation[]> {
  await page.goto(url, { waitUntil: 'networkidle' });

  // Starlight reads the theme from `data-theme` and mirrors it to storage. Set
  // both so the toggle does not race us back to the system preference.
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('starlight-theme', t);
  }, theme);

  // Embedded demos mount a real `<tbw-grid>`; give the custom element a frame
  // to upgrade so we scan the rendered tree rather than the placeholder.
  await page.waitForTimeout(250);

  await page.addScriptTag({ path: AXE });
  return page.evaluate(
    async ([tags, disabled]) => {
      const results = await window.axe.run(document, {
        runOnly: { type: 'tag', values: tags },
        rules: Object.fromEntries((disabled as string[]).map((id) => [id, { enabled: false }])),
        resultTypes: ['violations'],
      });
      // Trim to what the report prints — a raw axe payload is enormous.
      return results.violations.map((v) => ({
        id: v.id,
        help: v.help,
        helpUrl: v.helpUrl,
        impact: v.impact,
        nodes: v.nodes.slice(0, 3).map((n) => ({
          html: n.html.slice(0, 200),
          target: n.target,
          failureSummary: n.failureSummary,
        })),
      }));
    },
    [WCAG22AA_TAGS, DISABLED_RULES] as const,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const themeArg = args.find((a) => a.startsWith('--theme='))?.slice('--theme='.length);
  const themes = themeArg ? [themeArg] : ['light', 'dark'];

  // Fail in a second rather than after Playwright's 180s launch timeout.
  if ('Bun' in globalThis) {
    console.error(
      'This script cannot run under bun — Playwright\u2019s pipe transport hangs.\n' +
        'Run: node --experimental-strip-types tools/docs-a11y-audit.ts',
    );
    process.exit(1);
  }

  if (!existsSync(DIST)) {
    console.error('dist/docs not found. Run `bun nx build docs` first.');
    process.exit(1);
  }
  if (!existsSync(AXE)) {
    console.error('axe-core not found in node_modules. Run `bun install` first.');
    process.exit(1);
  }

  const routes: ReadonlyArray<readonly [string, string]> = args.includes('--all')
    ? listBuiltRoutes().map((r) => [r, r] as const)
    : CURATED_ROUTES;

  const port = 4401;
  const server = await serveDist(port);
  const browser = await chromium.launch();
  const findings: Finding[] = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    for (const [label, route] of routes) {
      for (const theme of themes) {
        const violations = await scanRoute(page, `http://localhost:${port}${route}`, theme);
        for (const violation of violations) findings.push({ route, label, theme, violation });
        if (!asJson) {
          const mark = violations.length ? `${violations.length} issue(s)` : 'ok';
          console.log(`  ${violations.length ? '✗' : '✓'} [${theme}] ${label} — ${route} — ${mark}`);
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  if (asJson) {
    console.log(JSON.stringify({ routes: routes.length, themes, findings }, null, 2));
    process.exit(findings.length ? 1 : 0);
  }

  // Aggregate by rule: the same template defect repeats on every page, and a
  // per-page dump buries the handful of distinct causes.
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    const bucket = byRule.get(f.violation.id) ?? [];
    bucket.push(f);
    byRule.set(f.violation.id, bucket);
  }

  console.log(`\nScanned ${routes.length} route(s) × ${themes.length} theme(s).`);
  for (const [rule, group] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
    const first = group[0].violation;
    console.log(`\n[${rule}] ${first.help} (${first.impact ?? 'n/a'}) — ${group.length} occurrence(s)`);
    console.log(`  ${first.helpUrl}`);
    console.log(`  routes: ${[...new Set(group.map((g) => `${g.route} (${g.theme})`))].slice(0, 8).join(', ')}`);
    for (const node of first.nodes) console.log(`    - ${node.target.join(' ')}\n      ${node.html}`);
  }

  console.log(`\nTotal issues: ${findings.length}`);
  process.exit(findings.length ? 1 : 0);
}

await main();
