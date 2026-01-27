/**
 * Tests for lazy plugin loading infrastructure.
 *
 * Tests cover:
 * - Preset merging logic
 * - Plugin dependency validation
 * - Feature prop extraction
 * - Child component detection
 *
 * Note: Plugin loader invocation tests are skipped in unit tests because
 * they require the built @toolbox-web/grid/all bundle. These are covered
 * by integration tests instead.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureProps } from './feature-props';
import { getFeaturePropNames, PLUGIN_LOADERS } from './plugin-loaders';
import { getPreset, getPresetNames, mergePresetWithProps, PRESETS } from './presets';

// ═══════════════════════════════════════════════════════════════════════════
// PRESET TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('presets', () => {
  describe('PRESETS', () => {
    it('should define minimal preset with reorder only', () => {
      expect(PRESETS.minimal).toEqual({
        reorder: true,
      });
    });

    it('should define standard preset with common features', () => {
      expect(PRESETS.standard).toMatchObject({
        reorder: true,
        selection: 'row',
        filtering: true,
        editing: 'dblclick',
        sorting: 'multi',
      });
    });

    it('should define full preset with all interactive features', () => {
      expect(PRESETS.full).toMatchObject({
        reorder: true,
        selection: 'row',
        filtering: true,
        editing: 'dblclick',
        sorting: 'multi',
        clipboard: true,
        contextMenu: true,
        undoRedo: true,
        visibility: true,
        export: true,
        print: true,
      });
    });
  });

  describe('getPreset', () => {
    it('should return preset by name', () => {
      const preset = getPreset('minimal');
      expect(preset).toEqual(PRESETS.minimal);
    });

    it('should return empty object for unknown preset', () => {
      const preset = getPreset('unknown' as any);
      expect(preset).toEqual({});
    });
  });

  describe('getPresetNames', () => {
    it('should return all preset names', () => {
      const names = getPresetNames();
      expect(names).toContain('minimal');
      expect(names).toContain('standard');
      expect(names).toContain('full');
      expect(names).toHaveLength(3);
    });
  });

  describe('mergePresetWithProps', () => {
    it('should return props unchanged when no preset', () => {
      const props: FeatureProps = { selection: 'range', editing: 'click' };
      const result = mergePresetWithProps(undefined, props);
      expect(result).toEqual(props);
    });

    it('should return preset values when no props', () => {
      const result = mergePresetWithProps('minimal', {});
      expect(result).toEqual(PRESETS.minimal);
    });

    it('should override preset values with explicit props', () => {
      const result = mergePresetWithProps('standard', { selection: 'range' });
      expect(result.selection).toBe('range'); // Override
      expect(result.filtering).toBe(true); // From preset
      expect(result.editing).toBe('dblclick'); // From preset
    });

    it('should disable preset features when prop is false', () => {
      const result = mergePresetWithProps('full', { editing: false as any });
      expect(result.editing).toBeUndefined(); // Disabled
      expect(result.selection).toBe('row'); // Still from preset
    });

    it('should not override with undefined props', () => {
      const result = mergePresetWithProps('standard', { selection: undefined });
      expect(result.selection).toBe('row'); // From preset, not overridden
    });

    it('should warn for unknown preset', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = mergePresetWithProps('unknown' as any, { selection: 'row' });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown preset'));
      expect(result).toEqual({ selection: 'row' }); // Just props
      warnSpy.mockRestore();
    });

    it('should handle object config values', () => {
      const result = mergePresetWithProps('minimal', {
        filtering: { debounceMs: 300 },
      });
      expect(result.reorder).toBe(true); // From preset
      expect(result.filtering).toEqual({ debounceMs: 300 }); // From props
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PLUGIN LOADERS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('plugin-loaders', () => {
  describe('PLUGIN_LOADERS dependencies', () => {
    it('should define undoRedo depending on editing', () => {
      expect(PLUGIN_LOADERS.undoRedo.dependencies).toContain('editing');
    });

    it('should define clipboard depending on selection', () => {
      expect(PLUGIN_LOADERS.clipboard.dependencies).toContain('selection');
    });
  });

  describe('PLUGIN_LOADERS', () => {
    it('should have loaders for all 22 feature props', () => {
      const loaderCount = Object.keys(PLUGIN_LOADERS).length;
      expect(loaderCount).toBe(22);
    });

    it('should have selection loader', () => {
      expect(PLUGIN_LOADERS.selection).toBeDefined();
      expect(PLUGIN_LOADERS.selection.name).toBe('selection');
      expect(typeof PLUGIN_LOADERS.selection.loader).toBe('function');
    });

    it('should have editing loader', () => {
      expect(PLUGIN_LOADERS.editing).toBeDefined();
      expect(PLUGIN_LOADERS.editing.name).toBe('editing');
    });

    it('should have filtering loader', () => {
      expect(PLUGIN_LOADERS.filtering).toBeDefined();
      expect(PLUGIN_LOADERS.filtering.name).toBe('filtering');
    });

    it('should have sorting loader that maps to multiSort plugin', () => {
      expect(PLUGIN_LOADERS.sorting).toBeDefined();
      expect(PLUGIN_LOADERS.sorting.name).toBe('multiSort');
    });

    it('should have clipboard loader with selection dependency', () => {
      expect(PLUGIN_LOADERS.clipboard).toBeDefined();
      expect(PLUGIN_LOADERS.clipboard.dependencies).toContain('selection');
    });

    it('should have undoRedo loader with editing dependency', () => {
      expect(PLUGIN_LOADERS.undoRedo).toBeDefined();
      expect(PLUGIN_LOADERS.undoRedo.dependencies).toContain('editing');
    });

    it('should have tree loader', () => {
      expect(PLUGIN_LOADERS.tree).toBeDefined();
      expect(PLUGIN_LOADERS.tree.name).toBe('tree');
    });

    it('should have masterDetail loader', () => {
      expect(PLUGIN_LOADERS.masterDetail).toBeDefined();
      expect(PLUGIN_LOADERS.masterDetail.name).toBe('masterDetail');
    });

    it('should have responsive loader', () => {
      expect(PLUGIN_LOADERS.responsive).toBeDefined();
      expect(PLUGIN_LOADERS.responsive.name).toBe('responsive');
    });

    it('should have export loader', () => {
      expect(PLUGIN_LOADERS.export).toBeDefined();
      expect(PLUGIN_LOADERS.export.name).toBe('export');
    });
  });

  describe('getFeaturePropNames', () => {
    it('should return all feature prop names', () => {
      const names = getFeaturePropNames();
      expect(names.has('selection')).toBe(true);
      expect(names.has('editing')).toBe(true);
      expect(names.has('filtering')).toBe(true);
      expect(names.has('sorting')).toBe(true);
      expect(names.has('clipboard')).toBe(true);
      expect(names.size).toBe(22);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOPOLOGICAL SORT TESTS (via validateDependencies)
// ═══════════════════════════════════════════════════════════════════════════

describe('validateDependencies', () => {
  // Import the function from the hook module
  let validateDependencies: (props: FeatureProps) => string[];

  beforeEach(async () => {
    const module = await import('./use-lazy-plugins');
    validateDependencies = module.validateDependencies;
  });

  it('should return empty array when no dependencies are missing', () => {
    const warnings = validateDependencies({
      selection: 'row',
      clipboard: true, // Has selection dependency, which is present
    });
    expect(warnings).toHaveLength(0);
  });

  it('should warn when clipboard is used without selection', () => {
    const warnings = validateDependencies({
      clipboard: true,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('clipboard');
    expect(warnings[0]).toContain('selection');
  });

  it('should warn when undoRedo is used without editing', () => {
    const warnings = validateDependencies({
      undoRedo: true,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('undoRedo');
    expect(warnings[0]).toContain('editing');
  });

  it('should not warn for features without dependencies', () => {
    const warnings = validateDependencies({
      selection: 'row',
      filtering: true,
      sorting: 'multi',
    });
    expect(warnings).toHaveLength(0);
  });

  it('should handle multiple missing dependencies', () => {
    const warnings = validateDependencies({
      clipboard: true, // Missing selection
      undoRedo: true, // Missing editing
    });
    expect(warnings).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PLUGIN LOADER INVOCATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

// Loaders use dynamic imports - these tests verify the imports work correctly.
describe('plugin loader invocation', () => {
  it('should create SelectionPlugin with string mode', async () => {
    const loader = PLUGIN_LOADERS.selection;
    const plugin = await loader.loader('range');
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('selection');
  });

  it('should create SelectionPlugin with object config', async () => {
    const loader = PLUGIN_LOADERS.selection;
    const plugin = await loader.loader({ mode: 'row', checkbox: true });
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('selection');
  });

  it('should create EditingPlugin with boolean', async () => {
    const loader = PLUGIN_LOADERS.editing;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('editing');
  });

  it('should create EditingPlugin with trigger string', async () => {
    const loader = PLUGIN_LOADERS.editing;
    const plugin = await loader.loader('click');
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('editing');
  });

  it('should create FilteringPlugin', async () => {
    const loader = PLUGIN_LOADERS.filtering;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('filtering');
  });

  it('should create MultiSortPlugin with single mode', async () => {
    const loader = PLUGIN_LOADERS.sorting;
    const plugin = await loader.loader('single');
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('multiSort');
  });

  it('should create MultiSortPlugin with multi mode', async () => {
    const loader = PLUGIN_LOADERS.sorting;
    const plugin = await loader.loader('multi');
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('multiSort');
  });

  it('should create ClipboardPlugin', async () => {
    const loader = PLUGIN_LOADERS.clipboard;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('clipboard');
  });

  it('should create ReorderPlugin', async () => {
    const loader = PLUGIN_LOADERS.reorder;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('reorder');
  });

  it('should create VisibilityPlugin', async () => {
    const loader = PLUGIN_LOADERS.visibility;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('visibility');
  });

  it('should create TreePlugin', async () => {
    const loader = PLUGIN_LOADERS.tree;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('tree');
  });

  it('should create ExportPlugin', async () => {
    const loader = PLUGIN_LOADERS.export;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('export');
  });

  it('should create PrintPlugin', async () => {
    const loader = PLUGIN_LOADERS.print;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('print');
  });

  it('should create GroupingColumnsPlugin', async () => {
    const loader = PLUGIN_LOADERS.groupingColumns;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('groupingColumns');
  });

  it('should create PinnedColumnsPlugin', async () => {
    const loader = PLUGIN_LOADERS.pinnedColumns;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('pinnedColumns');
  });

  it('should create PinnedRowsPlugin', async () => {
    const loader = PLUGIN_LOADERS.pinnedRows;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('pinnedRows');
  });

  it('should create ResponsivePlugin', async () => {
    const loader = PLUGIN_LOADERS.responsive;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('responsive');
  });

  it('should create ColumnVirtualizationPlugin', async () => {
    const loader = PLUGIN_LOADERS.columnVirtualization;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('columnVirtualization');
  });

  it('should create UndoRedoPlugin', async () => {
    const loader = PLUGIN_LOADERS.undoRedo;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('undoRedo');
  });

  it('should create ContextMenuPlugin', async () => {
    const loader = PLUGIN_LOADERS.contextMenu;
    const plugin = await loader.loader(true);
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('contextMenu');
  });

  it('should create MasterDetailPlugin', async () => {
    const loader = PLUGIN_LOADERS.masterDetail;
    const plugin = await loader.loader({});
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('masterDetail');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT PROPS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('event-props', () => {
  let EVENT_PROP_MAP: Record<string, string>;
  let getEventPropNames: () => string[];

  beforeEach(async () => {
    const module = await import('./event-props');
    EVENT_PROP_MAP = module.EVENT_PROP_MAP;
    getEventPropNames = module.getEventPropNames;
  });

  it('should map onCellClick to cell-click event', () => {
    expect(EVENT_PROP_MAP.onCellClick).toBe('cell-click');
  });

  it('should map onRowClick to row-click event', () => {
    expect(EVENT_PROP_MAP.onRowClick).toBe('row-click');
  });

  it('should map onSelectionChange to selection-change event', () => {
    expect(EVENT_PROP_MAP.onSelectionChange).toBe('selection-change');
  });

  it('should map onCellCommit to cell-commit event', () => {
    expect(EVENT_PROP_MAP.onCellCommit).toBe('cell-commit');
  });

  it('should map onSortChange to sort-change event', () => {
    expect(EVENT_PROP_MAP.onSortChange).toBe('sort-change');
  });

  it('should map onFilterChange to filter-change event', () => {
    expect(EVENT_PROP_MAP.onFilterChange).toBe('filter-change');
  });

  it('should map onColumnResize to column-resize event', () => {
    expect(EVENT_PROP_MAP.onColumnResize).toBe('column-resize');
  });

  it('should map onColumnMove to column-move event', () => {
    expect(EVENT_PROP_MAP.onColumnMove).toBe('column-move');
  });

  it('should have all event props defined', () => {
    const names = getEventPropNames();
    expect(names.length).toBeGreaterThan(15); // We have ~24 events
  });
});
