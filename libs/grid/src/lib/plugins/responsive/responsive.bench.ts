import { afterAll, bench, describe } from 'vitest';
import type { GridElement } from '../../core/plugin/base-plugin';
import { ResponsivePlugin } from './responsive-plugin';

describe('Responsive scroll render with unchanged sticky overlays', () => {
  for (const cloneCount of [1, 100]) {
    const host = document.createElement('tbw-grid');
    const body = document.createElement('div');
    const overlay = document.createElement('div');
    overlay.className = 'tbw-sticky-rows';
    for (let i = 0; i < 10; i++) {
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      row.innerHTML = '<div class="cell"></div>';
      body.appendChild(row);
    }
    for (let i = 0; i < cloneCount; i++) {
      const clone = document.createElement('div');
      clone.className = 'tbw-sticky-row';
      clone.innerHTML = '<div class="cell"></div>'.repeat(10);
      overlay.appendChild(clone);
    }
    host.append(body, overlay);
    const grid = Object.assign(host, {
      _hostElement: host,
      _bodyEl: body,
      rows: [],
      columns: [],
      gridConfig: {},
      disconnectSignal: new AbortController().signal,
      requestRender: () => undefined,
      getPluginByName: (name: string) => (name === 'stickyRows' ? {} : undefined),
    });
    const plugin = new ResponsivePlugin({ breakpoint: 500, animation: false });
    plugin.attach(grid as GridElement);
    host.setAttribute('data-responsive', '');
    plugin.afterRender();
    afterAll(() => plugin.detach());

    bench(`10 body rows / ${cloneCount} unchanged sticky clones`, async () => {
      body.firstElementChild!.removeAttribute('data-responsive-card');
      plugin.onScrollRender();
      await Promise.resolve();
    });
  }
});
