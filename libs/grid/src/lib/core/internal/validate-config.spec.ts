import { describe, expect, it, vi } from 'vitest';
import type { BaseGridPlugin, PluginIncompatibility, PluginManifest } from '../plugin';
import type { GridConfig } from '../types';
import {
  validatePluginConfigRules,
  validatePluginDependencies,
  validatePluginIncompatibilities,
  validatePluginProperties,
} from './validate-config';

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
      }).toThrow(/\[tbw-grid\].*Configuration error/);
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
      }).toThrow(/\[tbw-grid\].*Configuration error/);
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
      }).toThrow(/\[tbw-grid\].*Configuration error/);
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
      }).toThrow(/\[tbw-grid\].*Configuration error/);
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
      }).toThrow(/\[tbw-grid\].*Configuration error/);
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

  describe('multiple plugins missing', () => {
    it('consolidates errors from multiple missing plugins', () => {
      const config: GridConfig = {
        columns: [
          { field: 'name', editable: true },
          { field: 'email', group: 'contact' },
        ],
      } as GridConfig;

      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/EditingPlugin/);
      expect(() => {
        validatePluginProperties(config, []);
      }).toThrow(/GroupingColumnsPlugin/);
    });

    it('only reports errors for missing plugins', () => {
      const config: GridConfig = {
        columns: [
          { field: 'name', editable: true },
          { field: 'email', group: 'contact' },
        ],
      } as GridConfig;

      // With editing plugin present, only group should fail
      expect(() => {
        validatePluginProperties(config, [mockEditingPlugin]);
      }).toThrow(/GroupingColumnsPlugin/);
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
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
        /* intentionally empty - suppress console output */
      });

      expect(() => {
        validatePluginDependencies(mockVisibilityPlugin, []);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('silently continues when optional dependency is missing (no log)', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
        /* intentionally empty - suppress console output */
      });

      validatePluginDependencies(mockVisibilityPlugin, []);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('does not log when optional dependency is present', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
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

describe('validatePluginConfigRules', () => {
  // Create a mock plugin with manifest configRules
  const createMockPluginWithRules = (
    name: string,
    config: Record<string, unknown>,
    rules: PluginManifest['configRules'],
  ): BaseGridPlugin => {
    // Create a unique class for each mock to avoid polluting shared prototypes
    class MockPlugin {
      static manifest: PluginManifest = { configRules: rules };
      name = name;
      version = '1.0.0';
      config = config; // Simulates merged config
      attach() {
        /* noop */
      }
      detach() {
        /* noop */
      }
    }

    return new MockPlugin() as unknown as BaseGridPlugin;
  };

  describe('warning rules', () => {
    it('logs warning when rule with severity "warn" is violated', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const plugin = createMockPluginWithRules('test', { optionA: true }, [
        {
          id: 'test/invalid',
          severity: 'warn',
          message: 'optionA should not be true',
          check: (c: { optionA?: boolean }) => c.optionA === true,
        },
      ]);

      validatePluginConfigRules([plugin]);

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('[TestPlugin]');
      expect(warnSpy.mock.calls[0]?.[0]).toContain('optionA should not be true');

      warnSpy.mockRestore();
    });

    it('does not log warning when rule is not violated', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const plugin = createMockPluginWithRules('test', { optionA: false }, [
        {
          id: 'test/invalid',
          severity: 'warn',
          message: 'optionA should not be true',
          check: (c: { optionA?: boolean }) => c.optionA === true,
        },
      ]);

      validatePluginConfigRules([plugin]);

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('error rules', () => {
    it('throws error when rule with severity "error" is violated', () => {
      const plugin = createMockPluginWithRules('test', { criticalOption: 'invalid' }, [
        {
          id: 'test/critical',
          severity: 'error',
          message: 'criticalOption cannot be "invalid"',
          check: (c: { criticalOption?: string }) => c.criticalOption === 'invalid',
        },
      ]);

      expect(() => validatePluginConfigRules([plugin])).toThrow(/Configuration error/);
      expect(() => validatePluginConfigRules([plugin])).toThrow(/criticalOption cannot be "invalid"/);
    });

    it('does not throw when error rule is not violated', () => {
      const plugin = createMockPluginWithRules('test', { criticalOption: 'valid' }, [
        {
          id: 'test/critical',
          severity: 'error',
          message: 'criticalOption cannot be "invalid"',
          check: (c: { criticalOption?: string }) => c.criticalOption === 'invalid',
        },
      ]);

      expect(() => validatePluginConfigRules([plugin])).not.toThrow();
    });
  });

  describe('multiple rules', () => {
    it('logs all warnings before throwing errors', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const plugin = createMockPluginWithRules('test', { a: true, b: true }, [
        {
          id: 'test/warn-a',
          severity: 'warn',
          message: 'a is true',
          check: (c: { a?: boolean }) => c.a === true,
        },
        {
          id: 'test/error-b',
          severity: 'error',
          message: 'b is true',
          check: (c: { b?: boolean }) => c.b === true,
        },
      ]);

      expect(() => validatePluginConfigRules([plugin])).toThrow(/b is true/);
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('a is true');

      warnSpy.mockRestore();
    });
  });

  describe('plugins without manifest', () => {
    it('does not error for plugins without manifest', () => {
      const plugin: BaseGridPlugin = {
        name: 'noManifest',
        version: '1.0.0',
        attach: () => {
          /* noop */
        },
        detach: () => {
          /* noop */
        },
      } as unknown as BaseGridPlugin;

      expect(() => validatePluginConfigRules([plugin])).not.toThrow();
    });
  });
});
describe('validatePluginIncompatibilities', () => {
  // Helper to create a mock plugin with incompatibilities
  function createMockPluginWithIncompatibilities(
    name: string,
    incompatibleWith: PluginIncompatibility[],
  ): BaseGridPlugin {
    class MockPlugin {
      static readonly manifest: PluginManifest = { incompatibleWith };
      readonly name = name;
      readonly version = '1.0.0';
      attach() {
        /* noop */
      }
      detach() {
        /* noop */
      }
    }
    return new MockPlugin() as unknown as BaseGridPlugin;
  }

  // Simple mock plugin without manifest
  function createSimpleMockPlugin(name: string): BaseGridPlugin {
    return {
      name,
      version: '1.0.0',
      attach: () => {
        /* noop */
      },
      detach: () => {
        /* noop */
      },
    } as unknown as BaseGridPlugin;
  }

  it('does not warn when no incompatible plugins are loaded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });

    const pluginA = createMockPluginWithIncompatibilities('responsive', [
      { name: 'groupingRows', reason: 'incompatible with row grouping' },
    ]);
    const pluginB = createSimpleMockPlugin('selection');

    validatePluginIncompatibilities([pluginA, pluginB]);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns when incompatible plugins are loaded together', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });

    const groupingRows = createMockPluginWithIncompatibilities('groupingRows', [
      { name: 'tree', reason: 'Both transform the entire row model' },
    ]);
    const tree = createSimpleMockPlugin('tree');

    validatePluginIncompatibilities([groupingRows, tree]);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain('incompatib');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('GroupingRowsPlugin');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('TreePlugin');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('row model');
    warnSpy.mockRestore();
  });

  it('only warns once for symmetric conflicts (A→B and B→A)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });

    // Both plugins declare each other as incompatible
    const pluginA = createMockPluginWithIncompatibilities('pluginA', [
      { name: 'pluginB', reason: 'A conflicts with B' },
    ]);
    const pluginB = createMockPluginWithIncompatibilities('pluginB', [
      { name: 'pluginA', reason: 'B conflicts with A' },
    ]);

    validatePluginIncompatibilities([pluginA, pluginB]);

    // Should only warn once, not twice
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('handles plugins without manifest gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });

    const pluginA = createSimpleMockPlugin('pluginA');
    const pluginB = createSimpleMockPlugin('pluginB');

    expect(() => validatePluginIncompatibilities([pluginA, pluginB])).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  describe('real plugin manifest incompatibilities', () => {
    it('GroupingRowsPlugin declares tree and pivot as incompatible', async () => {
      const { GroupingRowsPlugin } = await import('../../plugins/grouping-rows/GroupingRowsPlugin');
      const names = GroupingRowsPlugin.manifest?.incompatibleWith?.map((i) => i.name) ?? [];
      expect(names).toContain('tree');
      expect(names).toContain('pivot');
      expect(names).not.toContain('serverSide');
    });

    it('TreePlugin declares groupingRows and pivot as incompatible', async () => {
      const { TreePlugin } = await import('../../plugins/tree/TreePlugin');
      const names = TreePlugin.manifest?.incompatibleWith?.map((i) => i.name) ?? [];
      expect(names).toContain('groupingRows');
      expect(names).toContain('pivot');
      expect(names).not.toContain('serverSide');
    });

    it('PivotPlugin declares groupingRows, tree, and serverSide as incompatible', async () => {
      const { PivotPlugin } = await import('../../plugins/pivot/PivotPlugin');
      const names = PivotPlugin.manifest?.incompatibleWith?.map((i) => i.name) ?? [];
      expect(names).toContain('groupingRows');
      expect(names).toContain('tree');
      expect(names).toContain('serverSide');
    });

    it('ServerSidePlugin declares pivot as incompatible but not tree', async () => {
      const { ServerSidePlugin } = await import('../../plugins/server-side/ServerSidePlugin');
      const names = ServerSidePlugin.manifest?.incompatibleWith?.map((i) => i.name) ?? [];
      expect(names).not.toContain('groupingRows');
      expect(names).not.toContain('tree');
      expect(names).toContain('pivot');
    });

    it('warns for groupingRows + tree combination', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const grouping = createMockPluginWithIncompatibilities('groupingRows', [
        { name: 'tree', reason: 'row model conflict' },
      ]);
      const tree = createMockPluginWithIncompatibilities('tree', [
        { name: 'groupingRows', reason: 'row model conflict' },
      ]);

      validatePluginIncompatibilities([grouping, tree]);

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('incompatib');
      warnSpy.mockRestore();
    });

    it('warns for serverSide + pivot combination', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });

      const serverSide = createMockPluginWithIncompatibilities('serverSide', [
        { name: 'pivot', reason: 'lazy-load blocks cannot be aggregated' },
      ]);
      const pivot = createMockPluginWithIncompatibilities('pivot', [
        { name: 'serverSide', reason: 'requires full dataset' },
      ]);

      validatePluginIncompatibilities([serverSide, pivot]);

      expect(warnSpy).toHaveBeenCalledOnce();
      warnSpy.mockRestore();
    });

    it('ResponsivePlugin does not declare groupingRows as incompatible', async () => {
      const { ResponsivePlugin } = await import('../../plugins/responsive/ResponsivePlugin');
      const names = ResponsivePlugin.manifest?.incompatibleWith?.map((i) => i.name) ?? [];
      expect(names).not.toContain('groupingRows');
    });
  });
});

describe('gridId parameter', () => {
  it('includes grid ID in validatePluginProperties error', () => {
    const config: GridConfig = {
      columns: [{ field: 'name', editable: true }],
    };

    expect(() => {
      validatePluginProperties(config, [], 'my-grid');
    }).toThrow(/\[tbw-grid#my-grid\].*Configuration error/);
  });

  it('includes grid ID in validatePluginDependencies error', () => {
    expect(() => {
      validatePluginDependencies(mockUndoRedoPlugin, [], 'employee-grid');
    }).toThrow(/\[tbw-grid#employee-grid\].*Plugin dependency error/);
  });

  it('includes grid ID in validatePluginConfigRules warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });

    class RulePlugin {
      static manifest = {
        configRules: [
          {
            id: 'test/invalid',
            severity: 'warn' as const,
            message: 'optionA should not be true',
            check: (c: { optionA?: boolean }) => c.optionA === true,
          },
        ],
      };
      name = 'test';
      version = '1.0.0';
      config = { optionA: true };
      attach() {
        /* noop */
      }
      detach() {
        /* noop */
      }
    }

    validatePluginConfigRules([new RulePlugin() as unknown as BaseGridPlugin], 'settings-grid');

    expect(warnSpy.mock.calls[0]?.[0]).toContain('[tbw-grid#settings-grid]');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('TestPlugin');
    warnSpy.mockRestore();
  });

  it('includes grid ID in validatePluginIncompatibilities warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });

    class ResponsivePlugin {
      static readonly manifest = {
        incompatibleWith: [{ name: 'groupingRows', reason: 'does not support row grouping' }],
      };
      readonly name = 'responsive';
      readonly version = '1.0.0';
      attach() {
        /* noop */
      }
      detach() {
        /* noop */
      }
    }

    const groupingRows: BaseGridPlugin = {
      name: 'groupingRows',
      version: '1.0.0',
      attach: () => {
        /* noop */
      },
      detach: () => {
        /* noop */
      },
    } as unknown as BaseGridPlugin;

    validatePluginIncompatibilities([new ResponsivePlugin() as unknown as BaseGridPlugin, groupingRows], 'demo-grid');

    expect(warnSpy.mock.calls[0]?.[0]).toContain('[tbw-grid#demo-grid]');
    warnSpy.mockRestore();
  });
});
