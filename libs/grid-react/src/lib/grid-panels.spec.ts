/**
 * Tests for GridDetailPanel and GridToolPanel components.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDetailRenderer } from './grid-detail-panel';
import { getToolPanelElements, getToolPanelRenderer } from './grid-tool-panel';

describe('GridDetailPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
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
  });
});

describe('GridToolPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getToolPanelRenderer', () => {
    it('should return undefined for element without registered renderer', () => {
      const panelElement = document.createElement('tbw-grid-tool-panel');
      container.appendChild(panelElement);

      const renderer = getToolPanelRenderer(panelElement);
      expect(renderer).toBeUndefined();
    });
  });

  describe('getToolPanelElements', () => {
    it('should return empty array for grid without tool panels', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      expect(elements).toEqual([]);
    });

    it('should return empty array when tool panels have no registered renderers', () => {
      const gridElement = document.createElement('tbw-grid');
      const panel1 = document.createElement('tbw-grid-tool-panel');
      const panel2 = document.createElement('tbw-grid-tool-panel');
      gridElement.appendChild(panel1);
      gridElement.appendChild(panel2);
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      expect(elements).toEqual([]);
    });
  });
});
