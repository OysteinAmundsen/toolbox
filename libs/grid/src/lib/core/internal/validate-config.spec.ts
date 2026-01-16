import { describe, expect, it } from 'vitest';
import type { BaseGridPlugin } from '../plugin';
import type { GridConfig } from '../types';
import { validatePluginProperties } from './validate-config';

// Mock plugin that simulates EditingPlugin
const mockEditingPlugin: BaseGridPlugin = {
  name: 'editing',
  version: '1.0.0',
  attach: () => {},
  detach: () => {},
};

describe('validatePluginProperties', () => {
  describe('editable property', () => {
    it('does not throw when editable is used with EditingPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', editable: true }],
      };

      expect(() => {
        validatePluginProperties(config, [mockEditingPlugin]);
      }).not.toThrow();
    });

    it('throws when editable is used without EditingPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', editable: true }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/\[tbw-grid\] Configuration error/);
    });

    it('does not throw when editable is false', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', editable: false }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).not.toThrow();
    });

    it('does not throw when editable is undefined', () => {
      const config: GridConfig = {
        columns: [{ field: 'name' }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).not.toThrow();
    });
  });

  describe('editor property', () => {
    it('does not throw when editor is used with EditingPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', editor: 'text' }],
      };

      expect(() => {
        validatePluginProperties(config, [mockEditingPlugin]);
      }).not.toThrow();
    });

    it('throws when editor is used without EditingPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', editor: 'text' }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/\[tbw-grid\] Configuration error/);
    });
  });

  describe('error message formatting', () => {
    it('includes column field names in error message', () => {
      const config: GridConfig = {
        columns: [
          { field: 'name', editable: true },
          { field: 'email', editable: true },
        ],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/name.*email|email.*name/);
    });

    it('includes import hint in error message', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', editable: true }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/import.*EditingPlugin.*from.*@toolbox-web\/grid\/plugins\/editing/);
    });
  });

  describe('edge cases', () => {
    it('does not throw when config has no columns', () => {
      const config: GridConfig = {};

      expect(() => {
        validatePluginProperties(config, []);
      }).not.toThrow();
    });

    it('does not throw when columns is empty array', () => {
      const config: GridConfig = { columns: [] };

      expect(() => {
        validatePluginProperties(config, []);
      }).not.toThrow();
    });

    it('handles multiple columns with same issue', () => {
      const config: GridConfig = {
        columns: [
          { field: 'a', editable: true },
          { field: 'b', editable: true },
          { field: 'c', editable: true },
          { field: 'd', editable: true },
        ],
      };

      // Should not throw 4 separate errors, just one consolidated error
      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/a.*b.*c/);
    });
  });
});
