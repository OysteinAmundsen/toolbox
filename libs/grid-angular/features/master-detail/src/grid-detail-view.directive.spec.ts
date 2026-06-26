/**
 * Tests for the master-detail light-DOM template directive.
 *
 * `GridDetailView` uses `inject()` heavily, so we cannot construct it outside
 * an Angular injection context (the project deliberately avoids TestBed). The
 * tests below cover the exported helper function, registry behaviour, and the
 * static type guard — everything meaningful without bootstrapping Angular.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GridDetailView, getDetailTemplate } from './grid-detail-view.directive';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('GridDetailView', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof GridDetailView.ngTemplateContextGuard).toBe('function');
    expect(GridDetailView.ngTemplateContextGuard({} as GridDetailView, {})).toBe(true);
  });

  it('is a defined directive class', () => {
    expect(GridDetailView).toBeDefined();
    expect(typeof GridDetailView).toBe('function');
  });

  it('getDetailTemplate returns undefined when no detail child is present', () => {
    const grid = document.createElement('tbw-grid');
    expect(getDetailTemplate(grid)).toBeUndefined();
  });

  it('getDetailTemplate returns undefined when detail child has no registered template', () => {
    const grid = document.createElement('tbw-grid');
    const detail = document.createElement('tbw-grid-detail');
    grid.appendChild(detail);
    expect(getDetailTemplate(grid)).toBeUndefined();
  });
});
