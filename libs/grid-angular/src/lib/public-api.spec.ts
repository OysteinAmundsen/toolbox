/**
 * Tests that verify the public API exports from @toolbox-web/grid-angular.
 * Note: Full module import testing requires @toolbox-web/grid to be built,
 * so these tests focus on the component registry which has no external deps.
 */
import { describe, expect, it } from 'vitest';
import {
  getAllRegisteredComponents,
  getRegisteredComponent,
  registerGridEditor,
  registerGridRenderer,
} from './component-registry';

describe('grid-angular public API', () => {
  describe('component registry exports', () => {
    it('should export registerGridRenderer function', () => {
      expect(registerGridRenderer).toBeDefined();
      expect(typeof registerGridRenderer).toBe('function');
    });

    it('should export registerGridEditor function', () => {
      expect(registerGridEditor).toBeDefined();
      expect(typeof registerGridEditor).toBe('function');
    });

    it('should export getRegisteredComponent function', () => {
      expect(getRegisteredComponent).toBeDefined();
      expect(typeof getRegisteredComponent).toBe('function');
    });

    it('should export getAllRegisteredComponents function', () => {
      expect(getAllRegisteredComponents).toBeDefined();
      expect(typeof getAllRegisteredComponents).toBe('function');
    });
  });
});
