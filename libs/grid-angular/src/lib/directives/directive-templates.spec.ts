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
import { getViewTemplate, GridColumnView } from './grid-column-view.directive';

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
});
