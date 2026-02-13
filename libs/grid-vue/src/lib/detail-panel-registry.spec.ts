/**
 * Tests for the detail panel registry.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detailRegistry, getDetailRenderer, type DetailPanelContext } from './detail-panel-registry';

describe('detail-panel-registry', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('detailRegistry', () => {
    it('should be a WeakMap', () => {
      expect(detailRegistry).toBeInstanceOf(WeakMap);
    });

    it('should store and retrieve renderer for an element', () => {
      const element = document.createElement('tbw-grid-detail');
      const renderer = (ctx: DetailPanelContext) => undefined;

      detailRegistry.set(element, renderer);
      expect(detailRegistry.get(element)).toBe(renderer);

      // Cleanup
      detailRegistry.delete(element);
    });
  });

  describe('getDetailRenderer', () => {
    it('should return undefined for grid without detail element', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid with unregistered detail element', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return renderer when detail element is registered', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const mockRenderer = (ctx: DetailPanelContext) => undefined;
      detailRegistry.set(detailElement, mockRenderer);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBe(mockRenderer);

      // Cleanup
      detailRegistry.delete(detailElement);
    });

    it('should not find detail element outside the grid', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      // Append detail outside the grid
      container.appendChild(gridElement);
      container.appendChild(detailElement);

      const mockRenderer = (ctx: DetailPanelContext) => undefined;
      detailRegistry.set(detailElement, mockRenderer);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();

      // Cleanup
      detailRegistry.delete(detailElement);
    });
  });

  describe('DetailPanelContext', () => {
    it('should have row and rowIndex properties', () => {
      const ctx: DetailPanelContext<{ name: string }> = {
        row: { name: 'Alice' },
        rowIndex: 0,
      };
      expect(ctx.row.name).toBe('Alice');
      expect(ctx.rowIndex).toBe(0);
    });

    it('should default TRow generic to unknown', () => {
      const ctx: DetailPanelContext = {
        row: { any: 'value' },
        rowIndex: 5,
      };
      expect(ctx.rowIndex).toBe(5);
    });
  });
});
