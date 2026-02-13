/**
 * Tests for the responsive card registry.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cardRegistry, getResponsiveCardRenderer, type ResponsiveCardContext } from './responsive-card-registry';

describe('responsive-card-registry', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('cardRegistry', () => {
    it('should be a WeakMap', () => {
      expect(cardRegistry).toBeInstanceOf(WeakMap);
    });

    it('should store and retrieve renderer for an element', () => {
      const element = document.createElement('tbw-grid-responsive-card');
      const renderer = (ctx: ResponsiveCardContext) => undefined;

      cardRegistry.set(element, renderer);
      expect(cardRegistry.get(element)).toBe(renderer);

      // Cleanup
      cardRegistry.delete(element);
    });
  });

  describe('getResponsiveCardRenderer', () => {
    it('should return undefined for grid without responsive card element', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid with unregistered card element', () => {
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return renderer when card element is registered', () => {
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      gridElement.appendChild(cardElement);
      container.appendChild(gridElement);

      const mockRenderer = (ctx: ResponsiveCardContext) => undefined;
      cardRegistry.set(cardElement, mockRenderer);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBe(mockRenderer);

      // Cleanup
      cardRegistry.delete(cardElement);
    });

    it('should not find card element outside the grid', () => {
      const gridElement = document.createElement('tbw-grid');
      const cardElement = document.createElement('tbw-grid-responsive-card');
      // Card element is sibling, not child
      container.appendChild(gridElement);
      container.appendChild(cardElement);

      const mockRenderer = (ctx: ResponsiveCardContext) => undefined;
      cardRegistry.set(cardElement, mockRenderer);

      const renderer = getResponsiveCardRenderer(gridElement);
      expect(renderer).toBeUndefined();

      // Cleanup
      cardRegistry.delete(cardElement);
    });
  });

  describe('ResponsiveCardContext', () => {
    it('should have row and rowIndex properties', () => {
      const ctx: ResponsiveCardContext<{ name: string }> = {
        row: { name: 'Bob' },
        rowIndex: 3,
      };
      expect(ctx.row.name).toBe('Bob');
      expect(ctx.rowIndex).toBe(3);
    });

    it('should default TRow generic to unknown', () => {
      const ctx: ResponsiveCardContext = {
        row: { id: 42 },
        rowIndex: 0,
      };
      expect(ctx.rowIndex).toBe(0);
    });
  });
});
