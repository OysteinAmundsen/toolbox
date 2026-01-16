import { describe, expect, it } from 'vitest';
import type { BaseGridPlugin } from '../plugin';
import type { GridConfig } from '../types';
import { validatePluginProperties } from './validate-config';

// Mock plugins for testing
const mockEditingPlugin: BaseGridPlugin = {
  name: 'editing',
  version: '1.0.0',
  attach: () => {
    /* noop */
  },
  detach: () => {
    /* noop */
  },
};

const mockGroupingColumnsPlugin: BaseGridPlugin = {
  name: 'groupingColumns',
  version: '1.0.0',
  attach: () => {
    /* noop */
  },
  detach: () => {
    /* noop */
  },
};

const mockPinnedColumnsPlugin: BaseGridPlugin = {
  name: 'pinnedColumns',
  version: '1.0.0',
  attach: () => {
    /* noop */
  },
  detach: () => {
    /* noop */
  },
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

  describe('group property (GroupingColumnsPlugin)', () => {
    it('does not throw when group is used with GroupingColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', group: 'personal' }],
      };

      expect(() => {
        validatePluginProperties(config, [mockGroupingColumnsPlugin]);
      }).not.toThrow();
    });

    it('throws when group is used without GroupingColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', group: 'personal' }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/\[tbw-grid\] Configuration error/);
      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/GroupingColumnsPlugin/);
    });

    it('throws when group is used as object without GroupingColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name', group: { id: 'personal', label: 'Personal Info' } }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/\[tbw-grid\] Configuration error/);
    });
  });

  describe('columnGroups config property (GroupingColumnsPlugin)', () => {
    it('does not throw when columnGroups is used with GroupingColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name' }],
        columnGroups: [{ id: 'personal', header: 'Personal', children: ['name'] }],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, [mockGroupingColumnsPlugin]);
      }).not.toThrow();
    });

    it('throws when columnGroups is used without GroupingColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'name' }],
        columnGroups: [{ id: 'personal', header: 'Personal', children: ['name'] }],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/\[tbw-grid\] Configuration error/);
      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/columnGroups.*config property/);
    });

    it('does not throw when columnGroups is empty array', () => {
      const config: GridConfig = {
        columns: [{ field: 'name' }],
        columnGroups: [],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, []);
      }).not.toThrow();
    });

    it('does not throw when columnGroups is undefined', () => {
      const config: GridConfig = {
        columns: [{ field: 'name' }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).not.toThrow();
    });
  });

  describe('sticky property (PinnedColumnsPlugin)', () => {
    it('does not throw when sticky is used with PinnedColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'id', sticky: 'left' }],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, [mockPinnedColumnsPlugin]);
      }).not.toThrow();
    });

    it('throws when sticky: left is used without PinnedColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'id', sticky: 'left' }],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/\[tbw-grid\] Configuration error/);
      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/PinnedColumnsPlugin/);
    });

    it('throws when sticky: right is used without PinnedColumnsPlugin', () => {
      const config: GridConfig = {
        columns: [{ field: 'actions', sticky: 'right' }],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/\[tbw-grid\] Configuration error/);
    });

    it('does not throw when sticky is undefined', () => {
      const config: GridConfig = {
        columns: [{ field: 'name' }],
      };

      expect(() => {
        validatePluginProperties(config, []);
      }).not.toThrow();
    });
  });

  describe('multiple plugins missing', () => {
    it('consolidates errors from multiple missing plugins', () => {
      const config: GridConfig = {
        columns: [
          { field: 'name', editable: true },
          { field: 'id', sticky: 'left' },
          { field: 'email', group: 'contact' },
        ],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/EditingPlugin/);
      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/PinnedColumnsPlugin/);
      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/GroupingColumnsPlugin/);
    });

    it('only reports errors for missing plugins', () => {
      const config: GridConfig = {
        columns: [
          { field: 'name', editable: true },
          { field: 'id', sticky: 'left' },
        ],
      } as GridConfig;

      // With editing plugin present, only sticky should fail
      expect(() => {
        validatePluginProperties(config, [mockEditingPlugin]);
      }).toThrow(/PinnedColumnsPlugin/);
      expect(() => {
        validatePluginProperties(config, [mockEditingPlugin]);
      }).not.toThrow(/EditingPlugin/);
    });
  });
});
