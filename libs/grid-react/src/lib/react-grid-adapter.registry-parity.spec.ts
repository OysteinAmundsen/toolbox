/**
 * Cross-adapter registry parity spec (gh #356 §8).
 *
 * Asserts every canonical registry name from the cross-adapter contract is
 * exported from the React adapter's primary entry. The Vue and Angular
 * adapters carry the same spec with the same registry names — if any
 * adapter drops one of these exports, this spec (or its peer in the other
 * adapter) fails.
 *
 * Per §8, applicability differs by adapter:
 * - `registerEditorMountHook` — all 3 adapters
 * - `registerPostMountRefresh` — all 3 adapters
 * - `registerFeatureConfigPreprocessor` / `getFeatureConfigPreprocessor` — all 3 adapters
 * - `registerChildFeatureDetector` — React + Vue only (Angular uses
 *   attribute-selector directives instead)
 * - `registerFeaturePropKey` — React + Vue only (Angular has no `...rest`
 *   prop split; uses per-feature `@Input()`)
 */

import { describe, expect, it } from 'vitest';
import * as ReactAdapter from '..';

describe('registry-parity (grid-react)', () => {
  it('exports every cross-adapter registry from the primary entry', () => {
    expect(typeof ReactAdapter.registerEditorMountHook).toBe('function');
    expect(typeof ReactAdapter.registerPostMountRefresh).toBe('function');
    expect(typeof ReactAdapter.registerFeatureConfigPreprocessor).toBe('function');
    expect(typeof ReactAdapter.getFeatureConfigPreprocessor).toBe('function');
    expect(typeof ReactAdapter.registerChildFeatureDetector).toBe('function');
    expect(typeof ReactAdapter.registerFeaturePropKey).toBe('function');
  });
});
