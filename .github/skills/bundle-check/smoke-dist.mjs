/**
 * Runtime smoke test of the BUILT grid (dist/libs/grid) — ESM and UMD.
 * Loads core + every plugin bundle in happy-dom and drives a real grid, so a
 * plugin that reads a missing core export or carries a duplicate copy of core
 * state fails here even when the build is green.
 *
 * Usage (after `bun nx build grid`):  bun .github/skills/bundle-check/smoke-dist.mjs
 * Requires node_modules/@toolbox-web/grid → dist/libs/grid (workspace junction).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const dist = 'dist/libs/grid';
const failures = [];
const check = (label, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures.push(label);
};
const waitFor = async (fn, ms = 3000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) return false;
    await new Promise((r) => setTimeout(r, 20));
  }
  return true;
};
/** A broken bundle can leave `grid.ready()` pending forever — never block the run on it. */
const settle = (promise, ms = 3000) =>
  Promise.race([
    promise.then(
      () => true,
      () => false,
    ),
    new Promise((r) => setTimeout(() => r(false), ms)),
  ]);

/** ServerSide grid whose second block resolves only when `release()` is called. */
function serverSideConfig(ServerSidePlugin, extraPlugins) {
  let release;
  const plugin = new ServerSidePlugin({
    pageSize: 5,
    maxConcurrentRequests: 1,
    dataSource: {
      getRows: (p) =>
        new Promise((res) => {
          const rows = [];
          for (let i = p.startNode; i < Math.min(p.endNode, 10); i++) rows.push({ id: i, name: `Row ${i}` });
          const done = () => res({ rows, totalNodeCount: 10 });
          if (p.startNode === 0) done();
          else release = done;
        }),
    },
  });
  return {
    config: { columns: [{ field: 'name' }, { field: 'id' }], plugins: [...extraPlugins, plugin] },
    release: () => release?.(),
    released: () => !!release,
  };
}

async function exerciseServerSide(label, grid, ss) {
  const loading = () => grid.querySelectorAll('.data-grid-row.tbw-row-loading').length;
  check(`${label}: placeholders render in the row-loading state`, await waitFor(() => loading() > 0));
  await waitFor(ss.released);
  ss.release();
  check(`${label}: loading state clears when the block lands`, await waitFor(() => loading() === 0));
  check(
    `${label}: loaded data renders`,
    [...grid.querySelectorAll('.cell')].some((c) => c.textContent === 'Row 9'),
  );
}

// #region UMD
{
  const window = new Window({ url: 'http://localhost/' });
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.error ?? e.message)));
  const load = (file) => {
    try {
      window.eval(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${file}: ${e}`);
    }
  };
  load(`${dist}/umd/grid.umd.js`);
  const files = readdirSync(`${dist}/umd/plugins`).filter((f) => f.endsWith('.umd.js'));
  for (const f of files) load(`${dist}/umd/plugins/${f}`);
  check(
    `UMD: ${files.length} plugin globals registered`,
    Object.keys(window).filter((k) => k.startsWith('TbwGridPlugin_')).length === files.length,
  );

  const ss = serverSideConfig(window.TbwGridPlugin_serverSide.ServerSidePlugin, [
    new window.TbwGridPlugin_selection.SelectionPlugin(),
  ]);
  const grid = window.document.createElement('tbw-grid');
  grid.gridConfig = ss.config;
  window.document.body.appendChild(grid);
  check('UMD: grid becomes ready', await settle(grid.ready()));
  await exerciseServerSide('UMD', grid, ss);
  check(`UMD: no runtime errors${errors.length ? ` (${errors.join('; ')})` : ''}`, errors.length === 0);
  await settle(window.happyDOM.close());
}
// #endregion

// #region ESM
{
  const window = new Window({ url: 'http://localhost/' });
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    try {
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
    } catch {
      // non-configurable global — keep the host's
    }
  }
  for (const key of [
    'document',
    'customElements',
    'HTMLElement',
    'Element',
    'Node',
    'CustomEvent',
    'Event',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'MutationObserver',
    'ResizeObserver',
    'CSSStyleSheet',
    'matchMedia',
  ]) {
    if (window[key] !== undefined)
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  }
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.error ?? e.message)));

  const core = await import('@toolbox-web/grid');
  const names = readdirSync(`${dist}/lib/plugins`).filter((n) => existsSync(`${dist}/lib/plugins/${n}/index.js`));
  const mods = {};
  for (const n of names) mods[n] = await import(`@toolbox-web/grid/plugins/${n}`);
  check(`ESM: imported ${names.length} plugin bundles`, names.length > 0);
  check(
    'ESM: plugins share core’s BaseGridPlugin',
    new mods['server-side'].ServerSidePlugin() instanceof core.BaseGridPlugin,
  );

  // Shared module state: an aggregator registered through core must be visible to plugin bundles.
  core.aggregatorRegistry.register('__smoke', () => 42);
  const grouped = document.createElement('tbw-grid');
  grouped.gridConfig = {
    columns: [{ field: 'dept' }, { field: 'n' }],
    plugins: [
      new mods['grouping-rows'].GroupingRowsPlugin({ groupOn: (r) => [r.dept], aggregators: { n: '__smoke' } }),
    ],
  };
  grouped.rows = [
    { dept: 'A', n: 1 },
    { dept: 'A', n: 2 },
  ];
  document.body.appendChild(grouped);
  await settle(grouped.ready());
  check(
    'ESM: core aggregatorRegistry is shared with grouping-rows',
    await waitFor(() => !!grouped.querySelector('.group-row')?.textContent?.includes('42')),
  );
  core.aggregatorRegistry.unregister('__smoke');

  const ss = serverSideConfig(mods['server-side'].ServerSidePlugin, [new mods.selection.SelectionPlugin()]);
  const grid = document.createElement('tbw-grid');
  grid.gridConfig = ss.config;
  document.body.appendChild(grid);
  check('ESM: grid becomes ready', await settle(grid.ready()));
  await exerciseServerSide('ESM', grid, ss);
  check(`ESM: no runtime errors${errors.length ? ` (${errors.join('; ')})` : ''}`, errors.length === 0);
  await settle(window.happyDOM.close());
}
// #endregion

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll dist smoke checks passed');
process.exit(failures.length ? 1 : 0);
