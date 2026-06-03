import { afterEach, describe, expect, it } from 'vitest';
import '../core/grid';
import { ShellPlugin } from '../plugins/shell';
// Side-effect import: registers the `shell` feature factory.
import './shell';

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
  if (grid.forceLayout) {
    try {
      await grid.forceLayout();
    } catch {
      /* empty */
    }
  }
  await nextFrame();
}

describe('shell feature (features: { shell })', () => {
  let grid: any;

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('attaches exactly one shell plugin and renders the header from feature config', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      features: { shell: { header: { title: 'Feature Title' } } },
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Exactly one shell plugin attached (no double-attach from the static
    // auto-register — the dedup guard in #initializePlugins keeps a single
    // shell-named plugin).
    const shellPlugin = grid.getPluginByName('shell');
    expect(shellPlugin).toBeDefined();

    // Header renders with the feature-supplied title.
    const html = grid.innerHTML;
    expect(html).toContain('tbw-shell-header');
    expect(html).toContain('Feature Title');
  });

  it('does not create a second shell instance when shell also auto-registers', async () => {
    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      features: { shell: true },
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    const shellPlugin = grid.getPluginByName('shell');
    expect(shellPlugin).toBeDefined();
    // The shell plugin resolved by name is the same instance the grid uses
    // internally (no divergence between the feature instance and the cache).
    expect(grid.getPluginByName('shell')).toBe(shellPlugin);
  });

  it('renders the shell when the attached plugin class differs from core (dist duplication #370/#374)', async () => {
    // Reproduces the e2e regression: in the dist build, core bundles its own
    // ShellPlugin copy while the feature/plugin entry ships a SEPARATE copy, so
    // the attached instance's constructor differs from the class core imports.
    // A constructor-identity lookup (`getPlugin(ShellPlugin)`) misses, so core
    // never calls `ensureState` on the attached instance; `processConfig` and
    // `afterStructuralRender` then early-return on `!hasState` and no shell
    // chrome renders. Core must resolve the shell by NAME. A subclass has a
    // distinct constructor but the same `name`, faithfully reproducing this.
    class DuplicateShellPlugin extends ShellPlugin {}

    grid = document.createElement('tbw-grid');
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      plugins: [new DuplicateShellPlugin({ header: { title: 'Dup Title' } })],
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    // Core resolved the attached (differently-classed) instance by name.
    expect(grid.getPluginByName('shell')).toBeInstanceOf(DuplicateShellPlugin);

    // The shell header renders with the constructor-supplied title.
    const html = grid.innerHTML;
    expect(html).toContain('tbw-shell-header');
    expect(html).toContain('Dup Title');
  });

  it('merges light-DOM shell state onto the feature instance (#370)', async () => {
    // Regression guard: the pre-connect light-DOM parse populates the cached
    // shell instance, but `features: { shell }` attaches a *different* (feature)
    // instance. `#render()` re-parses light-DOM onto the resolved (feature)
    // instance, so both the feature-config header AND the light-DOM tool panel
    // must surface on the single attached instance.
    grid = document.createElement('tbw-grid');
    grid.innerHTML = `
      <tbw-grid-tool-panel id="filters" title="Filters" icon="🔍">
        <div>Filter UI</div>
      </tbw-grid-tool-panel>
    `;
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      features: { shell: { header: { title: 'Feature Title' } } },
    };
    grid.rows = [{ name: 'Alice' }];
    document.body.appendChild(grid);
    await waitUpgrade(grid);

    const shellPlugin = grid.getPluginByName('shell');
    expect(shellPlugin).toBeDefined();
    // Light-DOM panel registered on the attached feature instance.
    const panels = shellPlugin.getToolPanels();
    expect(panels.some((p: { id: string }) => p.id === 'filters')).toBe(true);
    // Feature-config header title still renders.
    expect(grid.innerHTML).toContain('Feature Title');
  });
});
