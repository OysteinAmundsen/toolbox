/**
 * Directive Template Registry Unit Tests
 *
 * Tests the exported getter functions for template registries.
 * Note: The actual template registration happens via Angular directives
 * which would need full Angular TestBed. These tests verify the getter
 * logic on the Maps directly.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEditorTemplate, GridColumnEditor } from './grid-column-editor.directive';
import { getViewTemplate, GridColumnView } from './grid-column-view.directive';
import { getDetailConfig, getDetailTemplate } from './grid-detail-view.directive';
import { getToolPanelElements, getToolPanelTemplate, GridToolPanel } from './grid-tool-panel.directive';

describe('directive template registries', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // #region GridColumnView

  describe('GridColumnView', () => {
    it('should be a defined directive class', () => {
      expect(GridColumnView).toBeDefined();
      expect(typeof GridColumnView).toBe('function');
    });

    it('should have ngTemplateContextGuard static method', () => {
      expect(typeof GridColumnView.ngTemplateContextGuard).toBe('function');
    });

    it('ngTemplateContextGuard should always return true', () => {
      const result = GridColumnView.ngTemplateContextGuard({} as any, {});
      expect(result).toBe(true);
    });
  });

  describe('getViewTemplate', () => {
    it('should return undefined for element without registered template', () => {
      const element = document.createElement('div');
      const result = getViewTemplate(element);
      expect(result).toBeUndefined();
    });

    it('should return undefined for different element types', () => {
      const span = document.createElement('span');
      const section = document.createElement('section');
      expect(getViewTemplate(span)).toBeUndefined();
      expect(getViewTemplate(section)).toBeUndefined();
    });
  });

  // #endregion

  // #region GridColumnEditor

  describe('GridColumnEditor', () => {
    it('should be a defined directive class', () => {
      expect(GridColumnEditor).toBeDefined();
      expect(typeof GridColumnEditor).toBe('function');
    });

    it('should have ngTemplateContextGuard static method', () => {
      expect(typeof GridColumnEditor.ngTemplateContextGuard).toBe('function');
    });

    it('ngTemplateContextGuard should always return true', () => {
      const result = GridColumnEditor.ngTemplateContextGuard({} as any, {});
      expect(result).toBe(true);
    });
  });

  describe('getEditorTemplate', () => {
    it('should return undefined for element without registered template', () => {
      const element = document.createElement('div');
      const result = getEditorTemplate(element);
      expect(result).toBeUndefined();
    });

    it('should return undefined for different element types', () => {
      const span = document.createElement('span');
      expect(getEditorTemplate(span)).toBeUndefined();
    });
  });

  // #endregion

  describe('getDetailTemplate', () => {
    it('should return undefined when grid has no tbw-grid-detail child', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const result = getDetailTemplate(gridElement);
      expect(result).toBeUndefined();
    });

    it('should return undefined when detail element has no registered template', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const result = getDetailTemplate(gridElement);
      expect(result).toBeUndefined();
    });
  });

  describe('getDetailConfig', () => {
    it('should return undefined when grid has no tbw-grid-detail child', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const result = getDetailConfig(gridElement);
      expect(result).toBeUndefined();
    });

    it('should return default config when detail element has no attributes', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const result = getDetailConfig(gridElement);
      expect(result).toEqual({
        showExpandColumn: true,
        animation: 'slide',
      });
    });

    it('should parse showExpandColumn="false" attribute', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      detailElement.setAttribute('showExpandColumn', 'false');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const result = getDetailConfig(gridElement);
      expect(result?.showExpandColumn).toBe(false);
    });

    it('should parse animation="false" attribute', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      detailElement.setAttribute('animation', 'false');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const result = getDetailConfig(gridElement);
      expect(result?.animation).toBe(false);
    });

    it('should parse animation="fade" attribute', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      detailElement.setAttribute('animation', 'fade');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const result = getDetailConfig(gridElement);
      expect(result?.animation).toBe('fade');
    });

    it('should default animation to "slide" for unknown values', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      detailElement.setAttribute('animation', 'unknown');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const result = getDetailConfig(gridElement);
      expect(result?.animation).toBe('slide');
    });
  });

  // #region GridToolPanel

  describe('GridToolPanel directive', () => {
    it('should be a defined directive class', () => {
      expect(GridToolPanel).toBeDefined();
      expect(typeof GridToolPanel).toBe('function');
    });
  });

  describe('getToolPanelTemplate', () => {
    it('should return undefined for element without registered template', () => {
      const element = document.createElement('tbw-grid-tool-panel');
      const result = getToolPanelTemplate(element);
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-tool-panel elements', () => {
      const div = document.createElement('div');
      expect(getToolPanelTemplate(div)).toBeUndefined();
    });
  });

  describe('getToolPanelElements', () => {
    it('should return empty array when grid has no tool panels', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const result = getToolPanelElements(gridElement);
      expect(result).toEqual([]);
    });

    it('should return empty array when tool panels have no registered templates', () => {
      const gridElement = document.createElement('tbw-grid');
      const panel1 = document.createElement('tbw-grid-tool-panel');
      const panel2 = document.createElement('tbw-grid-tool-panel');
      gridElement.appendChild(panel1);
      gridElement.appendChild(panel2);
      container.appendChild(gridElement);

      // No templates registered, so should return empty
      const result = getToolPanelElements(gridElement);
      expect(result).toEqual([]);
    });

    it('should not find tool panels in nested elements', () => {
      const gridElement = document.createElement('tbw-grid');
      const wrapper = document.createElement('div');
      const panel = document.createElement('tbw-grid-tool-panel');
      wrapper.appendChild(panel);
      gridElement.appendChild(wrapper);
      container.appendChild(gridElement);

      // querySelectorAll finds descendants, but no templates registered
      const result = getToolPanelElements(gridElement);
      expect(result).toEqual([]);
    });
  });

  // #endregion
});
