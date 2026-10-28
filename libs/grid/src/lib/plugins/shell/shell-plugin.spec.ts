/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GridElement } from '../../core/plugin/base-plugin';
import { ShellPlugin } from './shell-plugin';

/**
 * Smoke tests for the ShellPlugin skeleton (extraction #370, Phase 1a).
 *
 * These assert only the plugin's identity and that it ships shell CSS. State,
 * light-DOM parsing, and DOM construction are added (and tested) in Phase 1b.
 */

function createMockGrid(): GridElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  // The plugin's `attach` registers light-DOM shell handlers via these generic
  // seams (extraction #370); stub them so the skeleton smoke test can attach.
  const mock: Partial<GridElement> = Object.assign(el, {
    _registerLightDomHandler: () => undefined,
    _unregisterLightDomHandler: () => undefined,
  });
  return mock as GridElement;
}

describe('ShellPlugin (skeleton)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes the "shell" plugin name', () => {
    const plugin = new ShellPlugin();
    expect(plugin.name).toBe('shell');
  });

  it('declares a styles property (CSS content is bundled at build time)', () => {
    // `?inline` CSS imports resolve to '' under vitest — the actual shell CSS
    // payload is asserted by the build chunk check (plan Step 1a.1.4), not here.
    const plugin = new ShellPlugin();
    expect(typeof plugin.styles).toBe('string');
  });

  it('attaches and detaches without throwing', () => {
    const plugin = new ShellPlugin();
    const grid = createMockGrid();
    expect(() => {
      plugin.attach(grid);
      plugin.detach();
    }).not.toThrow();
  });
});

describe('ShellPlugin toolPanel.width (#575)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function setup() {
    const host = document.createElement('div');
    const renderRoot = document.createElement('div');
    const panel = document.createElement('div');
    panel.className = 'tbw-tool-panel';
    renderRoot.appendChild(panel);
    host.appendChild(renderRoot);
    document.body.appendChild(host);
    const mock: Partial<GridElement> = {
      _renderRoot: renderRoot,
      _hostElement: host,
      _registerLightDomHandler: () => undefined,
      _unregisterLightDomHandler: () => undefined,
      _getToolPanelRendererFactory: () => undefined,
      _pluginShellContributions: () => ({ toolPanels: [], headerContents: [] }),
    };
    // Each call models a fresh `new ShellPlugin()` replacing the previous one.
    const attachInstance = () => {
      const plugin = new ShellPlugin();
      plugin.attach(mock as GridElement);
      return (width?: number) => plugin.processConfig({ shell: { toolPanel: { width } } });
    };
    const merge = attachInstance();
    const cssVar = () => host.style.getPropertyValue('--tbw-tool-panel-width');
    return { merge, attachInstance, host, panel, cssVar };
  }

  it('writes the configured width to --tbw-tool-panel-width', () => {
    const { merge, cssVar } = setup();
    merge(400);
    expect(cssVar()).toBe('400px');
  });

  it('re-applies when the configured width changes', () => {
    const { merge, cssVar } = setup();
    merge(400);
    merge(320);
    expect(cssVar()).toBe('320px');
  });

  it('clears the variable when the configured width is removed', () => {
    const { merge, cssVar } = setup();
    merge(400);
    merge(undefined);
    expect(cssVar()).toBe('');
  });

  it('keeps a user-dragged width while the configured width is unchanged or removed', () => {
    const { merge, host, cssVar } = setup();
    merge(400);
    // The resize handle writes the dragged width to the same host variable.
    host.style.setProperty('--tbw-tool-panel-width', '512px');
    merge(400);
    expect(cssVar()).toBe('512px');
    merge(undefined);
    expect(cssVar()).toBe('512px');
  });

  it('leaves a consumer-set variable alone when no width is configured', () => {
    const { merge, host, cssVar } = setup();
    host.style.setProperty('--tbw-tool-panel-width', '300px');
    merge(undefined);
    expect(cssVar()).toBe('300px');
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])('ignores an invalid width (%s)', (width) => {
    const { merge, cssVar } = setup();
    merge(width);
    expect(cssVar()).toBe('');
  });

  it("releases a replaced instance's configured width", () => {
    const { merge, attachInstance, cssVar } = setup();
    merge(400);
    attachInstance()(undefined);
    expect(cssVar()).toBe('');
  });

  it('keeps a dragged width when a replacing instance carries the same configured width', () => {
    const { merge, attachInstance, host, cssVar } = setup();
    merge(400);
    host.style.setProperty('--tbw-tool-panel-width', '512px');
    attachInstance()(400);
    expect(cssVar()).toBe('512px');
  });

  it('clears the dragged inline panel width only when the configured width changes', () => {
    const { merge, panel } = setup();
    merge(400);
    // `setupToolPanelResize` leaves the dragged width inline on the panel.
    panel.style.width = '512px';
    merge(400);
    expect(panel.style.width).toBe('512px');
    merge(320);
    expect(panel.style.width).toBe('');
  });
});

describe('ShellPlugin re-anchor observer lifecycle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('stops the re-anchor observer when the tool-panel mode changes away from dropdown while the panel stays open', () => {
    // happy-dom ships no MutationObserver — polyfill a minimal spy so the
    // observer start/stop lifecycle is observable.
    const observe = vi.fn();
    const disconnect = vi.fn();
    class FakeObserver {
      observe = observe;
      disconnect = disconnect;
      takeRecords = (): MutationRecord[] => [];
    }
    const globalRef: { MutationObserver?: typeof MutationObserver } = globalThis;
    const original = globalRef.MutationObserver;
    globalRef.MutationObserver = FakeObserver as typeof MutationObserver;

    try {
      const host = document.createElement('div');
      const renderRoot = document.createElement('div');
      host.appendChild(renderRoot);
      document.body.appendChild(host);
      const toolPanel = { mode: 'dropdown' as 'dropdown' | 'overlay' | 'push' };
      const mock: Partial<GridElement> = {
        id: 'g1',
        _renderRoot: renderRoot,
        _hostElement: host,
        _registerLightDomHandler: () => undefined,
        _unregisterLightDomHandler: () => undefined,
        effectiveConfig: { shell: { toolPanel } },
      };
      const grid = mock as GridElement;

      const plugin = new ShellPlugin();
      plugin.attach(grid);
      plugin.ensureState(grid);
      plugin.shellState.isPanelOpen = true;

      // First render in dropdown mode starts the observer.
      plugin.afterRender();
      expect(observe).toHaveBeenCalledTimes(1);
      expect(disconnect).not.toHaveBeenCalled();

      // Mode flips away from dropdown while the panel is still open — the
      // observer must be torn down rather than left watching the render root.
      toolPanel.mode = 'overlay';
      plugin.afterRender();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      globalRef.MutationObserver = original;
    }
  });
});
