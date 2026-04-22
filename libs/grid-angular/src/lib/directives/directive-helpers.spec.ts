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
import { GridDetailView, getDetailConfig, getDetailTemplate } from './grid-detail-view.directive';
import {
  GridResponsiveCard,
  getResponsiveCardTemplate,
  responsiveCardTemplateRegistry,
} from './grid-responsive-card.directive';
import { GridColumnView, getViewTemplate } from './grid-column-view.directive';
import { GridColumnEditor, getEditorTemplate } from './grid-column-editor.directive';

afterEach(() => {
  document.body.innerHTML = '';
  responsiveCardTemplateRegistry.clear();
});

// ---------------------------------------------------------------------------
// GridDetailView
// ---------------------------------------------------------------------------

describe('GridDetailView', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof GridDetailView.ngTemplateContextGuard).toBe('function');
    expect(GridDetailView.ngTemplateContextGuard({} as GridDetailView, {})).toBe(true);
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

  it('getDetailConfig returns undefined when no detail child exists', () => {
    const grid = document.createElement('tbw-grid');
    expect(getDetailConfig(grid)).toBeUndefined();
  });

  it('getDetailConfig defaults animation to "slide" and showExpandColumn to true', () => {
    const grid = document.createElement('tbw-grid');
    const detail = document.createElement('tbw-grid-detail');
    grid.appendChild(detail);
    expect(getDetailConfig(grid)).toEqual({ showExpandColumn: true, animation: 'slide' });
  });

  it('getDetailConfig honours animation="fade"', () => {
    const grid = document.createElement('tbw-grid');
    const detail = document.createElement('tbw-grid-detail');
    detail.setAttribute('animation', 'fade');
    grid.appendChild(detail);
    expect(getDetailConfig(grid)).toEqual({ showExpandColumn: true, animation: 'fade' });
  });

  it('getDetailConfig honours animation="false"', () => {
    const grid = document.createElement('tbw-grid');
    const detail = document.createElement('tbw-grid-detail');
    detail.setAttribute('animation', 'false');
    grid.appendChild(detail);
    expect(getDetailConfig(grid)).toEqual({ showExpandColumn: true, animation: false });
  });

  it('getDetailConfig honours showExpandColumn="false"', () => {
    const grid = document.createElement('tbw-grid');
    const detail = document.createElement('tbw-grid-detail');
    detail.setAttribute('showExpandColumn', 'false');
    grid.appendChild(detail);
    expect(getDetailConfig(grid)).toEqual({ showExpandColumn: false, animation: 'slide' });
  });
});

// ---------------------------------------------------------------------------
// GridResponsiveCard
// ---------------------------------------------------------------------------

describe('GridResponsiveCard', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof GridResponsiveCard.ngTemplateContextGuard).toBe('function');
    expect(GridResponsiveCard.ngTemplateContextGuard({} as GridResponsiveCard, {})).toBe(true);
  });

  it('getResponsiveCardTemplate returns undefined when no card child is present', () => {
    const grid = document.createElement('tbw-grid');
    expect(getResponsiveCardTemplate(grid)).toBeUndefined();
  });

  it('getResponsiveCardTemplate returns undefined when card has no registered template', () => {
    const grid = document.createElement('tbw-grid');
    const card = document.createElement('tbw-grid-responsive-card');
    grid.appendChild(card);
    expect(getResponsiveCardTemplate(grid)).toBeUndefined();
  });

  it('getResponsiveCardTemplate returns the registered template for the card child', () => {
    const grid = document.createElement('tbw-grid');
    const card = document.createElement('tbw-grid-responsive-card');
    grid.appendChild(card);

    const fakeTemplate = { _isMockTemplate: true };
    responsiveCardTemplateRegistry.set(card, fakeTemplate as never);

    expect(getResponsiveCardTemplate(grid)).toBe(fakeTemplate);
  });
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

describe('GridColumnEditor', () => {
  it('exposes a static ngTemplateContextGuard that returns true', () => {
    expect(typeof GridColumnEditor.ngTemplateContextGuard).toBe('function');
    expect(GridColumnEditor.ngTemplateContextGuard({} as GridColumnEditor, {})).toBe(true);
  });

  it('getEditorTemplate returns undefined for an unregistered element', () => {
    expect(getEditorTemplate(document.createElement('tbw-grid-column-editor'))).toBeUndefined();
  });
});
