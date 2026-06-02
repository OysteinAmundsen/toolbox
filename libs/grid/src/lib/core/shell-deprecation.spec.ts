import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './grid';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

async function waitUpgrade(grid: any) {
  await customElements.whenDefined('tbw-grid');
  const start = Date.now();
  while (!grid.hasAttribute('data-upgraded')) {
    if (Date.now() - start > 3000) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (grid.ready) {
    try {
      await grid.ready();
    } catch {
      /* empty */
    }
  }
  await nextFrame();
}

/** Count console.warn calls whose first arg mentions a given diagnostic code. */
function warnCountFor(spy: ReturnType<typeof vi.spyOn>, code: string): number {
  return spy.mock.calls.filter((args) => String(args[0]).includes(code)).length;
}

describe('core shell API deprecation (#370)', () => {
  let grid: any;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  async function makeGrid() {
    const el: any = document.createElement('tbw-grid');
    el.gridConfig = { columns: [{ field: 'name' }] };
    el.rows = [{ name: 'Alice' }];
    document.body.appendChild(el);
    await waitUpgrade(el);
    return el;
  }

  it('warns once per method with TBW076 and still performs the action', async () => {
    grid = await makeGrid();
    const shell = grid.getPluginByName('shell');
    shell.registerToolPanel({ id: 'demo', title: 'Demo', render: () => undefined });

    grid.openToolPanel('demo');
    expect(shell.isToolPanelOpen).toBe(true); // action still works
    expect(warnCountFor(warnSpy, 'TBW076')).toBe(1);

    // Second call to the same deprecated method does NOT re-warn.
    shell.closeToolPanel();
    grid.openToolPanel('demo');
    expect(warnCountFor(warnSpy, 'TBW076')).toBe(1);
  });

  it('warns separately for each distinct deprecated method', async () => {
    grid = await makeGrid();

    grid.getToolPanels();
    grid.getHeaderContents();
    expect(warnCountFor(warnSpy, 'TBW076')).toBe(2);
  });

  it('does not warn when the shell is used via the plugin instance', async () => {
    grid = await makeGrid();
    const shell = grid.getPluginByName('shell');
    shell.registerToolPanel({ id: 'demo', title: 'Demo', render: () => undefined });
    shell.openToolPanel('demo');

    expect(warnCountFor(warnSpy, 'TBW076')).toBe(0);
  });
});
