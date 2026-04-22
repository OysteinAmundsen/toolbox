/**
 * Adapter conformance — ensures the Vue adapter implements every
 * FrameworkAdapter hook that the grid core consumes. Prevents regressions
 * of the kind fixed in #237 (createToolPanelRenderer was silently absent).
 *
 * @vitest-environment happy-dom
 */
import { CORE_CONSUMED_ADAPTER_METHODS } from '@toolbox-web/grid';
import { describe, expect, it } from 'vitest';
import { GridAdapter } from './vue-grid-adapter';

describe('GridAdapter conformance', () => {
  it('implements every FrameworkAdapter hook the grid core consumes', () => {
    const adapter = new GridAdapter() as unknown as Record<string, unknown>;
    const missing = CORE_CONSUMED_ADAPTER_METHODS.filter((m) => typeof adapter[m] !== 'function');
    expect(missing).toEqual([]);
  });
});
