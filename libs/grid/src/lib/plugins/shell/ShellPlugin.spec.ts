/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GridElement } from '../../core/plugin/base-plugin';
import type { InternalGrid } from '../../core/types';
import { ShellPlugin } from './ShellPlugin';

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
      const mock: Partial<InternalGrid> = {
        id: 'g1',
        _renderRoot: renderRoot,
        _hostElement: host,
        _registerLightDomHandler: () => undefined,
        _unregisterLightDomHandler: () => undefined,
        effectiveConfig: { shell: { toolPanel } },
      };
      const grid = mock as InternalGrid;

      const plugin = new ShellPlugin();
      plugin.attach(grid as GridElement);
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
