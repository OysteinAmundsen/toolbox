/**
 * Component Registry Unit Tests
 */
import { describe, expect, it } from 'vitest';
import {
  getAllRegisteredComponents,
  getRegisteredComponent,
  registerGridEditor,
  registerGridRenderer,
} from './component-registry';

// Mock component class for testing
class MockRendererComponent {
  static componentName = 'MockRenderer';
}

class MockEditorComponent {
  static componentName = 'MockEditor';
}

class AnotherComponent {
  static componentName = 'Another';
}

describe('component-registry', () => {
  describe('registerGridRenderer', () => {
    it('should register a renderer component by tag name', () => {
      registerGridRenderer('app-test-renderer', MockRendererComponent);

      const retrieved = getRegisteredComponent('app-test-renderer');
      expect(retrieved).toBe(MockRendererComponent);
    });

    it('should handle case-insensitive tag names', () => {
      registerGridRenderer('APP-UPPER-CASE', MockRendererComponent);

      const retrieved = getRegisteredComponent('app-upper-case');
      expect(retrieved).toBe(MockRendererComponent);
    });

    it('should allow registering multiple different renderers', () => {
      registerGridRenderer('app-renderer-one', MockRendererComponent);
      registerGridRenderer('app-renderer-two', AnotherComponent);

      expect(getRegisteredComponent('app-renderer-one')).toBe(MockRendererComponent);
      expect(getRegisteredComponent('app-renderer-two')).toBe(AnotherComponent);
    });
  });

  describe('registerGridEditor', () => {
    it('should register an editor component by tag name', () => {
      registerGridEditor('app-test-editor', MockEditorComponent);

      const retrieved = getRegisteredComponent('app-test-editor');
      expect(retrieved).toBe(MockEditorComponent);
    });

    it('should handle case-insensitive tag names', () => {
      registerGridEditor('APP-EDITOR-UPPER', MockEditorComponent);

      const retrieved = getRegisteredComponent('app-editor-upper');
      expect(retrieved).toBe(MockEditorComponent);
    });
  });

  describe('getRegisteredComponent', () => {
    it('should return undefined for unregistered tag name', () => {
      const result = getRegisteredComponent('non-existent-component');
      expect(result).toBeUndefined();
    });

    it('should find renderer when no editor exists', () => {
      registerGridRenderer('app-only-renderer', MockRendererComponent);

      const result = getRegisteredComponent('app-only-renderer');
      expect(result).toBe(MockRendererComponent);
    });

    it('should find editor when no renderer exists', () => {
      registerGridEditor('app-only-editor', MockEditorComponent);

      const result = getRegisteredComponent('app-only-editor');
      expect(result).toBe(MockEditorComponent);
    });

    it('should prioritize renderer over editor when both exist', () => {
      // Register both renderer and editor for same tag
      registerGridRenderer('app-both-types', MockRendererComponent);
      registerGridEditor('app-both-types', MockEditorComponent);

      // getRegisteredComponent uses ?? so renderer wins if it exists
      const result = getRegisteredComponent('app-both-types');
      expect(result).toBe(MockRendererComponent);
    });
  });

  describe('getAllRegisteredComponents', () => {
    it('should return a map of all registered components', () => {
      registerGridRenderer('app-all-renderer', MockRendererComponent);
      registerGridEditor('app-all-editor', MockEditorComponent);

      const allComponents = getAllRegisteredComponents();
      expect(allComponents instanceof Map).toBe(true);
      expect(allComponents.get('app-all-renderer')).toBe(MockRendererComponent);
      expect(allComponents.get('app-all-editor')).toBe(MockEditorComponent);
    });

    it('should include both renderers and editors in the map', () => {
      registerGridRenderer('app-multi-renderer-1', MockRendererComponent);
      registerGridRenderer('app-multi-renderer-2', AnotherComponent);
      registerGridEditor('app-multi-editor-1', MockEditorComponent);

      const allComponents = getAllRegisteredComponents();
      expect(allComponents.has('app-multi-renderer-1')).toBe(true);
      expect(allComponents.has('app-multi-renderer-2')).toBe(true);
      expect(allComponents.has('app-multi-editor-1')).toBe(true);
    });

    it('should return a new Map instance each time', () => {
      const first = getAllRegisteredComponents();
      const second = getAllRegisteredComponents();
      expect(first).not.toBe(second);
    });
  });
});
