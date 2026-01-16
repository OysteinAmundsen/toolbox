import { describe, expect, it, vi } from 'vitest';
import type { BaseGridPlugin } from '../plugin';
import type { GridConfig } from '../types';
import { validatePluginDependencies, validatePluginProperties } from './validate-config';

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
// Mock plugins for dependency testing - using classes to support static dependencies

/** Mock plugin with static dependencies - simulates UndoRedoPlugin requiring EditingPlugin */
class MockUndoRedoPlugin {
  static readonly dependencies = [{ name: 'editing', required: true, reason: 'UndoRedoPlugin tracks edit history' }];
  readonly name = 'undoRedo';
  readonly version = '1.0.0';
  attach() {
    /* noop */
  }
  detach() {
    /* noop */
  }
}

/** Mock plugin with static dependencies - simulates ClipboardPlugin requiring SelectionPlugin */
class MockClipboardPlugin {
  static readonly dependencies = [
    { name: 'selection', required: true, reason: 'ClipboardPlugin needs cell selection' },
  ];
  readonly name = 'clipboard';
  readonly version = '1.0.0';
  attach() {
    /* noop */
  }
  detach() {
    /* noop */
  }
}

/** Mock plugin with static optional dependency - simulates VisibilityPlugin optionally using ReorderPlugin */
class MockVisibilityPlugin {
  static readonly dependencies = [{ name: 'reorder', required: false, reason: 'Enables drag-to-hide column feature' }];
  readonly name = 'visibility';
  readonly version = '1.0.0';
  attach() {
    /* noop */
  }
  detach() {
    /* noop */
  }
}

/** Mock plugin with no dependencies */
class MockSelectionPlugin {
  readonly name = 'selection';
  readonly version = '1.0.0';
  attach() {
    /* noop */
  }
  detach() {
    /* noop */
  }
}

/** Mock plugin with no dependencies */
class MockReorderPlugin {
  readonly name = 'reorder';
  readonly version = '1.0.0';
  attach() {
    /* noop */
  }
  detach() {
    /* noop */
  }
}

// Create instances for tests
const mockUndoRedoPlugin = new MockUndoRedoPlugin() as unknown as BaseGridPlugin;
const mockClipboardPlugin = new MockClipboardPlugin() as unknown as BaseGridPlugin;
const mockVisibilityPlugin = new MockVisibilityPlugin() as unknown as BaseGridPlugin;
const mockSelectionPlugin = new MockSelectionPlugin() as unknown as BaseGridPlugin;
const mockReorderPlugin = new MockReorderPlugin() as unknown as BaseGridPlugin;

describe('validatePluginDependencies', () => {
  describe('hard dependencies (required)', () => {
    it('throws when UndoRedoPlugin is used without EditingPlugin', () => {
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, []);
      }).toThrow(/Plugin dependency error/);
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, []);
      }).toThrow(/UndoRedoPlugin tracks edit history/);
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, []);
      }).toThrow(/EditingPlugin/);
    });

    it('does not throw when UndoRedoPlugin is used with EditingPlugin', () => {
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, [mockEditingPlugin]);
      }).not.toThrow();
    });

    it('throws when ClipboardPlugin is used without SelectionPlugin', () => {
      expect(() => {
        validatePluginDependencies(mockClipboardPlugin, []);
      }).toThrow(/Plugin dependency error/);
      expect(() => {
        validatePluginDependencies(mockClipboardPlugin, []);
      }).toThrow(/ClipboardPlugin needs cell selection/);
    });

    it('does not throw when ClipboardPlugin is used with SelectionPlugin', () => {
      expect(() => {
        validatePluginDependencies(mockClipboardPlugin, [mockSelectionPlugin]);
      }).not.toThrow();
    });

    it('includes helpful import hints in error message', () => {
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, []);
      }).toThrow(/@toolbox-web\/grid\/plugins\/editing/);
    });

    it('includes plugin order guidance in error message', () => {
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, []);
      }).toThrow(/BEFORE UndoRedoPlugin/);
    });
  });

  describe('soft dependencies (optional)', () => {
    it('does not throw when VisibilityPlugin is used without ReorderPlugin', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {
        /* intentionally empty - suppress console output */
      });

      expect(() => {
        validatePluginDependencies(mockVisibilityPlugin, []);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('logs info message for missing optional dependency', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {
        /* intentionally empty - suppress console output */
      });

      validatePluginDependencies(mockVisibilityPlugin, []);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Optional "reorder" plugin not found'));

      consoleSpy.mockRestore();
    });

    it('does not log when optional dependency is present', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {
        /* intentionally empty - suppress console output */
      });

      validatePluginDependencies(mockVisibilityPlugin, [mockReorderPlugin]);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('plugins without dependencies', () => {
    it('does not throw for plugins with no dependencies', () => {
      // Plugins without static dependencies property - should just pass through
      expect(() => {
        validatePluginDependencies(mockEditingPlugin, []);
      }).not.toThrow();

      expect(() => {
        validatePluginDependencies(mockSelectionPlugin, []);
      }).not.toThrow();
    });
  });

  describe('correct plugin order', () => {
    it('validates that dependency is already loaded', () => {
      // Simulating: plugins: [EditingPlugin, UndoRedoPlugin]
      // When UndoRedoPlugin is being attached, EditingPlugin should already be in the array
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, [mockEditingPlugin]);
      }).not.toThrow();
    });

    it('fails when dependency is not yet loaded', () => {
      // Simulating: plugins: [UndoRedoPlugin, EditingPlugin]
      // When UndoRedoPlugin is being attached, EditingPlugin is NOT yet in the array
      expect(() => {
        validatePluginDependencies(mockUndoRedoPlugin, []);
      }).toThrow(/Plugin dependency error/);
    });
  });
});
