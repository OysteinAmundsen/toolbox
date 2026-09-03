/**
 * Cross-adapter accessor parity spec (Vue side).
 *
 * Mirror of `libs/grid-react/src/features/accessor-parity.spec.ts`: every
 * feature accessor must expose `isReady`, matching the Angular adapter's
 * `injectGrid*` signals.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, isRef } from 'vue';
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

const teardown: Array<() => void> = [];

function mountAccessor(composable: () => unknown): Record<string, unknown> {
  let captured: Record<string, unknown> | null = null;
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(
    defineComponent({
      setup() {
        captured = composable() as Record<string, unknown>;
        return () => h('div');
      },
    }),
  );
  app.mount(container);
  teardown.push(() => {
    app.unmount();
    container.remove();
  });

  if (!captured) throw new Error('composable did not run during setup()');
  return captured;
}

afterEach(() => {
  teardown.splice(0).forEach((fn) => fn());
  document.body.innerHTML = '';
});

describe('feature accessor parity (grid-vue)', () => {
  for (const [name, composable] of Object.entries(accessors)) {
    it(`${name}() exposes an isReady ref`, () => {
      const result = mountAccessor(composable as () => unknown);
      expect(result).toHaveProperty('isReady');
      expect(isRef(result['isReady'])).toBe(true);
      // No grid mounted, so it never flips to true.
      expect((result['isReady'] as { value: boolean }).value).toBe(false);
    });
  }
});
