/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { GridElement } from '../../core/plugin/base-plugin';
import { ShellPlugin } from './ShellPlugin';

/**
 * Smoke tests for the ShellPlugin skeleton (extraction #370, Phase 1a).
 *
 * These assert only the plugin's identity and that it ships shell CSS. State,
 * light-DOM parsing, and DOM construction are added (and tested) in Phase 1b.
 */

function createMockGrid(): GridElement {
  const grid = document.createElement('div') as unknown as GridElement;
  document.body.appendChild(grid as unknown as HTMLElement);
  return grid;
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
