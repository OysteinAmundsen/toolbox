/**
 * Cross-adapter registry parity spec (gh #356 §8, post-cleanup).
 *
 * Asserts the React adapter exports exactly the registries its `<DataGrid>`
 * shell actually invokes. Each adapter ships only the registries it uses —
 * "ship-without-caller" symmetry was removed in the post-#356 cleanup
 * because it created public API surface that nothing exercised. See the
 * cleanup DECIDED entry in `.github/knowledge/adapters.md`.
 *
 * Current per-adapter map:
 * - `registerEditorMountHook` — all 3 adapters (live)
 * - `registerPostMountRefresh` — React + Vue (live); Angular N/A
 *   (`ngAfterContentInit` covers the equivalent wiring)
 * - `registerChildFeatureDetector` — React only (live, pre-registers
 *   `GridDetailPanel` / `GridResponsiveCard`); Vue uses default slots,
 *   Angular uses attribute-selector directives
 * - `registerFeaturePropKey` — React + Vue (live); Angular uses per-feature
 *   `@Input()` directives
 * - `registerFeatureConfigPreprocessor` — Angular only (live, bridges
 *   TemplateRef / Component shapes to core configs); React/Vue have no
 *   such bridging need
 */

import { describe, expect, it } from 'vitest';
import * as ReactAdapter from '..';

describe('registry-parity (grid-react)', () => {
  it('exports every registry the React shell uses', () => {
    expect(typeof ReactAdapter.registerEditorMountHook).toBe('function');
    expect(typeof ReactAdapter.registerPostMountRefresh).toBe('function');
    expect(typeof ReactAdapter.registerChildFeatureDetector).toBe('function');
    expect(typeof ReactAdapter.registerFeaturePropKey).toBe('function');
  });

  it('does NOT export Angular-only registries (documents N/A intent)', () => {
    // React's `<DataGrid>` shell never bridges framework-shaped configs
    // (JSX nodes are already core-compatible), so the preprocessor
    // registry is intentionally absent. If it ever appears, update the
    // instructions file and the Angular parity spec in the same PR.
    const adapter = ReactAdapter as Record<string, unknown>;
    expect(adapter['registerFeatureConfigPreprocessor']).toBeUndefined();
    expect(adapter['getFeatureConfigPreprocessor']).toBeUndefined();
  });
});
