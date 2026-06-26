/**
 * Tests for the responsive-card light-DOM template directive.
 *
 * `GridResponsiveCard` uses `inject()` heavily, so we cannot construct it
 * outside an Angular injection context (the project deliberately avoids
 * TestBed). The tests below cover the exported helper function, registry
 * behaviour, and the static type guard.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  GridResponsiveCard,
  getResponsiveCardTemplate,
  responsiveCardTemplateRegistry,
} from './grid-responsive-card.directive';

afterEach(() => {
  document.body.innerHTML = '';
  responsiveCardTemplateRegistry.clear();
});

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
