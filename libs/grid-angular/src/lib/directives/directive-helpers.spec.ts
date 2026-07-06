/**
 * Tests for the small light-DOM template directives.
 *
 * These directives use `inject()` heavily, so we cannot construct them outside
 * an Angular injection context (the project deliberately avoids TestBed — see
 * `angular-grid-adapter.conformance.spec.ts`). The tests below cover the
 * exported helper functions, registry behaviour, and static type guards —
 * everything that is meaningful without bootstrapping Angular.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GridColumnView, getViewTemplate } from './grid-column-view.directive';

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// GridColumnView / GridColumnEditor
// ---------------------------------------------------------------------------

describe('GridColumnView', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof GridColumnView.ngTemplateContextGuard).toBe('function');
    expect(GridColumnView.ngTemplateContextGuard({} as GridColumnView, {})).toBe(true);
  });

  it('getViewTemplate returns undefined for an unregistered element', () => {
    expect(getViewTemplate(document.createElement('tbw-grid-column-view'))).toBeUndefined();
  });
});
