/**
 * Tests for the GridResponsiveCard component and registry.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResponsiveCardRenderer, type ResponsiveCardContext } from './grid-responsive-card';

describe('GridResponsiveCard', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getResponsiveCardRenderer', () => {
    it('should return undefined for grid without responsive card element', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid with unregistered responsive card element', () => {
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined when grid has no id for fallback lookup', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      // No child element, no id — should return undefined
      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });
  });

  describe('ResponsiveCardContext type', () => {
    it('should have expected shape', () => {
      const ctx: ResponsiveCardContext<{ name: string }> = {
        row: { name: 'Test' },
        index: 0,
      };
      expect(ctx.row.name).toBe('Test');
      expect(ctx.index).toBe(0);
    });
  });
});
