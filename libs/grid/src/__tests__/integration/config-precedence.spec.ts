import { describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { FitModeEnum } from '../../lib/core/types';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows';

async function waitForUpgraded(el: HTMLElement, timeout = 5000) {
  const start = Date.now();
  while (!el.hasAttribute('data-upgraded')) {
    if (Date.now() - start > timeout) throw new Error('upgrade timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
  // allow double rAF like other tests in suite
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

describe('config precedence', () => {
  it('prop fitMode overrides gridConfig.fitMode', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.gridConfig = {
      fitMode: FitModeEnum.STRETCH,
      plugins: [new GroupingRowsPlugin({ groupOn: (r: any) => r.type })],
    };
    // Assign overriding props after base config
    grid.fitMode = 'fixed';
    grid.rows = [{ id: 1, type: 'a' }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    expect(cfg.fitMode).toBe('fixed');
  }, 20000);

  it('columns prop wins over gridConfig.columns', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.innerHTML = '';
    document.body.appendChild(grid);
    grid.gridConfig = { columns: [{ field: 'a' }], fitMode: FitModeEnum.STRETCH };
    grid.columns = [{ field: 'b' }];
    grid.rows = [{ a: 1, b: 2 }];
    await customElements.whenDefined('tbw-grid');
    await waitForUpgraded(grid);
    const cfg = await grid.getConfig();
    expect(cfg.columns.map((c: any) => c.field)).toEqual(['b']);
  }, 20000);
});
