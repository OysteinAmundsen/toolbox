/**
 * Tests for multi-version coexistence of `tbw-grid` registrations.
 *
 * Issue #339 — when two `@toolbox-web/grid` bundles at different versions
 * load on the same page, the second-to-load must register itself under a
 * version-suffixed tag (`tbw-grid-v<version>`) instead of throwing or
 * silently sharing the first bundle's class.
 *
 * The production registration runs at module-import time and consumes the
 * bare `tbw-grid` slot. These tests therefore drive the registration
 * function directly with synthetic subclasses and assert the resulting
 * `activeTag` + `customElements` registry state.
 */
import { describe, expect, it } from 'vitest';
import { DataGridElement } from './grid';

describe('multi-version tag registration', () => {
  // Reusable factory: produce a fresh subclass of HTMLElement that masquerades
  // as a DataGridElement (same `tagName` + chosen `version` + mutable
  // `activeTag`). We define each as a distinct constructor so the platform
  // accepts multiple `customElements.define()` calls. The return type is
  // inferred as `typeof FakeGrid`, which already exposes the extra statics
  // so no cast is needed at the call sites.
  function makeFakeGridClass(version: string) {
    class FakeGrid extends HTMLElement {
      static readonly tagName = 'tbw-grid';
      static readonly version = version;
      static activeTag = 'tbw-grid';
    }
    return FakeGrid;
  }

  // Mirror of the production `registerDataGrid()` in `grid.ts`, parameterised
  // over the target class so each test can drive the algorithm without having
  // to reload the grid module.
  function registerWith(target: ReturnType<typeof makeFakeGridClass>): void {
    const base = target.tagName;
    const existing = customElements.get(base) as (CustomElementConstructor & { version: string }) | undefined;
    if (!existing) {
      customElements.define(base, target);
      target.activeTag = base;
      return;
    }
    if (existing.version === target.version) {
      target.activeTag = base;
      return;
    }
    const versionSuffix = target.version.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const suffixed = `${base}-v${versionSuffix}`;
    if (!customElements.get(suffixed)) {
      customElements.define(suffixed, target);
    }
    target.activeTag = suffixed;
  }

  it('first registration takes the bare `tbw-grid` tag', () => {
    // The real `DataGridElement` is already registered under `tbw-grid` by the
    // grid module import at the top of this file, so the bare tag is taken.
    expect(customElements.get(DataGridElement.tagName)).toBe(DataGridElement);
    expect(DataGridElement.activeTag).toBe('tbw-grid');
  });

  it('second class at a DIFFERENT version registers under a suffixed tag', () => {
    const v2 = makeFakeGridClass('2.99.0');
    registerWith(v2);

    expect(v2.activeTag).toBe('tbw-grid-v2-99-0');
    expect(customElements.get('tbw-grid-v2-99-0')).toBe(v2);
    // The first bundle still owns the bare tag.
    expect(customElements.get('tbw-grid')).toBe(DataGridElement);
  });

  it('second class at the SAME version reuses the bare tag (no duplicate define)', () => {
    const sameVersion = makeFakeGridClass(DataGridElement.version);
    registerWith(sameVersion);

    // Bare tag still points at the first-registered class.
    expect(customElements.get('tbw-grid')).toBe(DataGridElement);
    // But the second class's `activeTag` mirrors the bare tag so adapters
    // sharing this class render `<tbw-grid>` and pick up the first bundle's
    // implementation transparently.
    expect(sameVersion.activeTag).toBe('tbw-grid');
  });

  it('sanitises non-alphanumeric characters in the version suffix', () => {
    // Semver pre-release / build metadata strings contain `.`, `+`, and `-`.
    // Suffix must be a valid custom-element name fragment (lowercase, dashes).
    const pre = makeFakeGridClass('3.0.0-beta.1+build.42');
    registerWith(pre);

    expect(pre.activeTag).toBe('tbw-grid-v3-0-0-beta-1-build-42');
    expect(customElements.get('tbw-grid-v3-0-0-beta-1-build-42')).toBe(pre);
  });
});
