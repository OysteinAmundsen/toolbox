/**
 * Configuration Validation
 *
 * Runtime validators that check for plugin-specific properties in config
 * and throw helpful errors if the required plugin is not loaded.
 *
 * This catches common mistakes like using `editable: true` without EditingPlugin.
 */

import type { BaseGridPlugin } from '../plugin';
import type { ColumnConfig, GridConfig } from '../types';

/**
 * Plugin-owned column property definition.
 * Each entry maps a property name to the plugin that owns it.
 */
interface PluginPropertyDefinition {
  /** The property name on column config */
  property: string;
  /** The plugin name (from plugin.name) that owns this property */
  pluginName: string;
  /** Human-readable description for error messages */
  description: string;
  /** Import path hint for the error message */
  importHint: string;
  /** Custom check for whether property is used (default: truthy check) */
  isUsed?: (value: unknown) => boolean;
}

/**
 * Plugin-owned grid config property definition.
 * For properties on GridConfig (not column-level).
 */
interface PluginConfigPropertyDefinition {
  /** The property name on grid config */
  property: string;
  /** The plugin name (from plugin.name) that owns this property */
  pluginName: string;
  /** Human-readable description for error messages */
  description: string;
  /** Import path hint for the error message */
  importHint: string;
  /** Custom check for whether property is used (default: non-empty array or truthy) */
  isUsed?: (value: unknown) => boolean;
}

/**
 * Registry of plugin-owned column properties.
 * This is the single source of truth for which properties require which plugins.
 */
const PLUGIN_OWNED_COLUMN_PROPERTIES: PluginPropertyDefinition[] = [
  // EditingPlugin
  {
    property: 'editable',
    pluginName: 'editing',
    description: 'the "editable" column property',
    importHint: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
    isUsed: (v) => v === true,
  },
  {
    property: 'editor',
    pluginName: 'editing',
    description: 'the "editor" column property',
    importHint: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
  },
  // GroupingColumnsPlugin
  {
    property: 'group',
    pluginName: 'groupingColumns',
    description: 'the "group" column property',
    importHint: "import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';",
  },
  // PinnedColumnsPlugin
  {
    property: 'sticky',
    pluginName: 'pinnedColumns',
    description: 'the "sticky" column property',
    importHint: "import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';",
    isUsed: (v) => v === 'left' || v === 'right',
  },
];

/**
 * Registry of plugin-owned grid config properties.
 */
const PLUGIN_OWNED_CONFIG_PROPERTIES: PluginConfigPropertyDefinition[] = [
  // GroupingColumnsPlugin
  {
    property: 'columnGroups',
    pluginName: 'groupingColumns',
    description: 'the "columnGroups" config property',
    importHint: "import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';",
    isUsed: (v) => Array.isArray(v) && v.length > 0,
  },
];

// ============================================================================
// Plugin-to-Plugin Dependencies
// ============================================================================

/**
 * Plugin-to-plugin dependency definition.
 * Each entry defines what plugins require other plugins.
 */
interface PluginDependencyDefinition {
  /** The dependent plugin name (the one that needs the dependency) */
  pluginName: string;
  /** The required plugin name (the one being depended upon) */
  requiresPlugin: string;
  /** Is this a hard (required) or soft (optional) dependency? */
  required: boolean;
  /** Human-readable description for error messages */
  description: string;
  /** Import path hint for the error message */
  importHint: string;
}

/**
 * Registry of plugin-to-plugin dependencies.
 * This is a fallback for backward compatibility with older plugins.
 *
 * **Preferred approach**: Plugins should declare dependencies using `static dependencies`
 * on their class. See UndoRedoPlugin, ClipboardPlugin, VisibilityPlugin for examples.
 *
 * Hard dependencies (required: true) throw an error if not satisfied.
 * Soft dependencies (required: false) log an info message but continue.
 */
const PLUGIN_DEPENDENCIES: PluginDependencyDefinition[] = [
  // Built-in plugins now declare their own dependencies via static class property.
  // This registry is kept empty but available for backward compatibility.
];

/**
 * Helper to capitalize a plugin name for display.
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Check if a plugin with the given name is present in the plugins array.
 */
function hasPlugin(plugins: readonly BaseGridPlugin[], pluginName: string): boolean {
  return plugins.some((p) => p.name === pluginName);
}

/**
 * Validate that column properties requiring plugins have those plugins loaded.
 *
 * @param config - The merged grid configuration
 * @param plugins - The array of loaded plugins
 * @throws Error if a plugin-owned property is used without the plugin
 */
export function validatePluginProperties<T>(config: GridConfig<T>, plugins: readonly BaseGridPlugin[]): void {
  // Group errors by plugin to avoid spamming multiple errors
  const missingPlugins = new Map<
    string,
    { description: string; importHint: string; fields: string[]; isConfigProperty?: boolean }
  >();

  // Helper to add an error for a missing plugin
  function addError(
    pluginName: string,
    description: string,
    importHint: string,
    field: string,
    isConfigProperty = false,
  ) {
    if (!missingPlugins.has(pluginName)) {
      missingPlugins.set(pluginName, { description, importHint, fields: [], isConfigProperty });
    }
    const entry = missingPlugins.get(pluginName)!;
    if (!entry.fields.includes(field)) {
      entry.fields.push(field);
    }
  }

  // Validate grid config properties
  for (const def of PLUGIN_OWNED_CONFIG_PROPERTIES) {
    const value = (config as Record<string, unknown>)[def.property];
    const isUsed = def.isUsed ? def.isUsed(value) : value !== undefined;

    if (isUsed && !hasPlugin(plugins, def.pluginName)) {
      addError(def.pluginName, def.description, def.importHint, def.property, true);
    }
  }

  // Validate column properties
  const columns = config.columns;
  if (columns && columns.length > 0) {
    for (const column of columns) {
      for (const def of PLUGIN_OWNED_COLUMN_PROPERTIES) {
        const value = (column as unknown as Record<string, unknown>)[def.property];
        // Use custom isUsed check if provided, otherwise check for defined value
        const isUsed = def.isUsed ? def.isUsed(value) : value !== undefined;

        if (isUsed && !hasPlugin(plugins, def.pluginName)) {
          const field = (column as ColumnConfig).field || '<unknown>';
          addError(def.pluginName, def.description, def.importHint, field);
        }
      }
    }
  }

  // Throw a single consolidated error if any missing plugins
  if (missingPlugins.size > 0) {
    const errors: string[] = [];
    for (const [pluginName, { description, importHint, fields, isConfigProperty }] of missingPlugins) {
      if (isConfigProperty) {
        // Config-level property error
        errors.push(
          `Config uses ${description}, but the required plugin is not loaded.\n` +
            `  → Add the plugin to your gridConfig.plugins array:\n` +
            `    ${importHint}\n` +
            `    plugins: [new ${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Plugin(), ...]`,
        );
      } else {
        // Column-level property error
        const fieldList = fields.slice(0, 3).join(', ') + (fields.length > 3 ? `, ... (${fields.length} total)` : '');
        errors.push(
          `Column(s) [${fieldList}] use ${description}, but the required plugin is not loaded.\n` +
            `  → Add the plugin to your gridConfig.plugins array:\n` +
            `    ${importHint}\n` +
            `    plugins: [new ${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Plugin(), ...]`,
        );
      }
    }

    throw new Error(
      `[tbw-grid] Configuration error:\n\n${errors.join('\n\n')}\n\n` +
        `This validation helps catch misconfigurations early. ` +
        `The properties listed above require their respective plugins to function.`,
    );
  }
}
// ============================================================================
// Plugin Dependency Validation
// ============================================================================

/**
 * Map of known plugin names to their npm import paths.
 * Used to generate helpful error messages with import hints.
 */
const PLUGIN_IMPORT_HINTS: Record<string, string> = {
  editing: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
  selection: "import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';",
  reorder: "import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';",
  clipboard: "import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';",
  filtering: "import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';",
  multiSort: "import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';",
  groupingRows: "import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';",
  groupingColumns: "import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';",
  tree: "import { TreePlugin } from '@toolbox-web/grid/plugins/tree';",
  masterDetail: "import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';",
  pinnedColumns: "import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';",
  pinnedRows: "import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';",
  visibility: "import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';",
  undoRedo: "import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';",
  export: "import { ExportPlugin } from '@toolbox-web/grid/plugins/export';",
  contextMenu: "import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';",
  pivot: "import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';",
  serverSide: "import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';",
  columnVirtualization: "import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';",
};

/**
 * Get the import hint for a plugin, with a fallback for unknown plugins.
 */
function getImportHint(pluginName: string): string {
  return (
    PLUGIN_IMPORT_HINTS[pluginName] ??
    `import { ${capitalize(pluginName)}Plugin } from '@toolbox-web/grid/plugins/${pluginName}';`
  );
}

/**
 * Validate plugin-to-plugin dependencies.
 * Called by PluginManager when attaching a new plugin.
 *
 * Dependencies are read from the plugin's static `dependencies` property.
 * Falls back to the centralized PLUGIN_DEPENDENCIES registry for built-in plugins
 * that haven't been updated yet.
 *
 * For hard dependencies (required: true), throws an error if the dependency is not loaded.
 * For soft dependencies (required: false), logs an info message but continues.
 *
 * @param plugin - The plugin instance being attached
 * @param loadedPlugins - The array of already-loaded plugins
 * @throws Error if a required dependency is missing
 */
export function validatePluginDependencies(plugin: BaseGridPlugin, loadedPlugins: readonly BaseGridPlugin[]): void {
  const pluginName = plugin.name;
  const PluginClass = plugin.constructor as typeof BaseGridPlugin;

  // Get dependencies from plugin's static property (preferred)
  const classDeps = PluginClass.dependencies ?? [];

  // Get dependencies from centralized registry (fallback for backward compatibility)
  const registryDeps = PLUGIN_DEPENDENCIES.filter((d) => d.pluginName === pluginName);

  // Combine: class dependencies take precedence, registry fills in gaps
  const allDeps = new Map<string, { required: boolean; reason?: string }>();

  // Add registry deps first (lower priority)
  for (const dep of registryDeps) {
    allDeps.set(dep.requiresPlugin, {
      required: dep.required,
      reason: dep.description,
    });
  }

  // Add class deps (higher priority - overwrites registry)
  for (const dep of classDeps) {
    allDeps.set(dep.name, {
      required: dep.required ?? true, // Default to required
      reason: dep.reason,
    });
  }

  // Validate each dependency
  for (const [requiredPlugin, { required, reason }] of allDeps) {
    const hasRequired = loadedPlugins.some((p) => p.name === requiredPlugin);

    if (!hasRequired) {
      const reasonText = reason ?? `${capitalize(pluginName)}Plugin requires ${capitalize(requiredPlugin)}Plugin`;
      const importHint = getImportHint(requiredPlugin);

      if (required) {
        throw new Error(
          `[tbw-grid] Plugin dependency error:\n\n` +
            `${reasonText}.\n\n` +
            `  → Add the plugin to your gridConfig.plugins array BEFORE ${capitalize(pluginName)}Plugin:\n` +
            `    ${importHint}\n` +
            `    plugins: [new ${capitalize(requiredPlugin)}Plugin(), new ${capitalize(pluginName)}Plugin()]`,
        );
      } else {
        // Soft dependency - log info message but continue
        console.info(
          `[tbw-grid] ${capitalize(pluginName)}Plugin: Optional "${requiredPlugin}" plugin not found. ` +
            `Some features may be unavailable.`,
        );
      }
    }
  }
}
