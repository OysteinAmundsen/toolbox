/**
 * Cross-adapter accessor parity spec (React side).
 *
 * Every feature accessor must expose `isReady` — the Angular adapter has had
 * it since `injectGridSelection` and friends were introduced, and the three
 * adapters are one product with three façades. This spec fails the build if a
 * new accessor ships without it, or an existing one loses it.
 *
 * The Vue mirror lives at `libs/grid-vue/src/features/accessor-parity.spec.ts`.
 *
 * @vitest-environment jsdom
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGridExport } from './export';
import { useGridFiltering } from './filtering';
import { useGridPrint } from './print';
import { useGridSelection } from './selection';
import { useGridUndoRedo } from './undo-redo';

const accessors = {
  useGridSelection,
  useGridPrint,
  useGridExport,
  useGridFiltering,
  useGridUndoRedo,
} as const;

const containers: HTMLElement[] = [];

function renderAccessor(hook: () => unknown): Record<string, unknown> {
  const captured: { current: Record<string, unknown> | null } = { current: null };
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);

  function Inner() {
    captured.current = hook() as Record<string, unknown>;
    return null;
  }

  const root = createRoot(container);
  flushSync(() => root.render(createElement(Inner)));
  return captured.current as Record<string, unknown>;
}

afterEach(() => {
  containers.splice(0).forEach((el) => el.remove());
  document.body.innerHTML = '';
});

describe('feature accessor parity (grid-react)', () => {
  for (const [name, hook] of Object.entries(accessors)) {
    it(`${name}() exposes isReady`, () => {
      const result = renderAccessor(hook as () => unknown);
      expect(result).toHaveProperty('isReady');
      // No grid mounted, so the first render always reports "not ready".
      expect(result['isReady']).toBe(false);
    });
  }
});
