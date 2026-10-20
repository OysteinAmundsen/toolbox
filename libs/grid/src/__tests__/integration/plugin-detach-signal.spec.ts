/**
 * Integration tests: a plugin's `disconnectSignal` aborts when the plugin is detached,
 * even if its `detach()` override does not call `super.detach()` (PR #525 review).
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../../index';
import '../../lib/features/filtering';
import { BaseGridPlugin } from '../../lib/core/plugin';

class ListenerProbePlugin extends BaseGridPlugin {
  readonly name = 'listenerProbe';
  calls = 0;

  override attach(grid: Parameters<BaseGridPlugin['attach']>[0]): void {
    super.attach(grid);
    this.gridElement.addEventListener('cell-change', () => this.calls++, { signal: this.disconnectSignal });
  }

  // Deliberately no super.detach() — the plugin manager must still release the signal.
  override detach(): void {
    this.calls += 0;
  }
}

const columns = [{ field: 'id', header: 'Id' }];

describe('plugin disconnectSignal on detach', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('removes disconnectSignal listeners of a plugin whose detach() skips super.detach()', async () => {
    const probe = new ListenerProbePlugin();
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = { columns, plugins: [probe] };
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await grid.ready();

    grid.dispatchEvent(new CustomEvent('cell-change', { detail: {} }));
    expect(probe.calls).toBe(1);

    grid.gridConfig = { columns, plugins: [] }; // plugin set changed → detachAll()
    await grid.ready();
    grid.dispatchEvent(new CustomEvent('cell-change', { detail: {} }));
    expect(probe.calls).toBe(1);
  });

  it('a replaced FilteringPlugin no longer reacts to cell-change', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = { columns, features: { filtering: true } };
    grid.rows = [{ id: 1 }];
    document.body.appendChild(grid);
    await grid.ready();
    const old = grid.getPluginByName('filtering');

    grid.gridConfig = { columns, plugins: [] };
    await grid.ready();
    const sentinel: unknown[] = [];
    old.cachedInputRows = sentinel;
    grid.dispatchEvent(new CustomEvent('cell-change', { detail: {} }));
    expect(old.cachedInputRows).toBe(sentinel);
  });
});
