/**
 * Configuration Validation
 *
 * Runtime validators that check for plugin-specific properties in config
 * and throw helpful errors if the required plugin is not loaded.
 *
 * This catches common mistakes like using `editable: true` without EditingPlugin.
 *
 * Uses a static registry of known plugin-owned properties to detect when users
 * configure features that require plugins they haven't loaded.
 */

import type { BaseGridPlugin, PluginManifest, PluginPropertyDefinition } from '../plugin';
import type { ColumnConfig, GridConfig } from '../types';

/**
 * Internal property definition with plugin name attached.
 * Extends PluginPropertyDefinition with required pluginName for validation.
 */
interface InternalPropertyDefinition extends PluginPropertyDefinition {
  pluginName: string;
}

// ============================================================================
// Known Plugin-Owned Properties (Static Registry)
// ============================================================================

/**
 * Static registry of known plugin-owned column properties.
 * This enables detection of plugin properties even when the plugin isn't loaded.
 * Properties defined here allow helpful error messages when plugins are missing.
 *
 * ## Why This Exists (The Validation Paradox)
 *
 * We need to detect when a developer uses a plugin-owned property (like `editable`)
 * but forgets to add the plugin. However, if the plugin isn't loaded, we can't
 * read its manifest! The manifest only exists when the plugin class is imported.
 *
 * This static registry solves that: it's a "well-known properties" list that exists
 * independently of whether plugins are loaded.
 *
 * ## When Adding New Plugin-Owned Properties
 *
 * 1. **Always**: Add to the plugin's manifest `ownedProperties` (documentation, lives with plugin)
 * 2. **Optionally**: Add here if you want "forgot to add plugin" detection for that property
 *
 * Not every property needs to be here - only high-value ones where developers commonly
 * forget to add the plugin. Third-party plugins can't be listed here anyway.
 *
 * ## Future Improvement
 *
 * A build-time script could generate these arrays from plugin manifests,
 * creating a single source of truth. For now, they're maintained manually.
 */
const KNOWN_COLUMN_PROPERTIES: InternalPropertyDefinition[] = [
  // EditingPlugin
  {
    property: 'editable',
    pluginName: 'editing',
    level: 'column',
    description: 'the "editable" column property',
    importHint: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
    isUsed: (v) => v === true,
  },
  {
    property: 'editor',
    pluginName: 'editing',
    level: 'column',
    description: 'the "editor" column property',
    importHint: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
  },
  {
    property: 'editorParams',
    pluginName: 'editing',
    level: 'column',
    description: 'the "editorParams" column property',
    importHint: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
  },
  // GroupingColumnsPlugin
  {
    property: 'group',
    pluginName: 'groupingColumns',
    level: 'column',
    description: 'the "group" column property',
    importHint: "import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';",
  },
  // PinnedColumnsPlugin
  {
    property: 'sticky',
    pluginName: 'pinnedColumns',
    level: 'column',
    description: 'the "sticky" column property',
    importHint: "import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';",
    isUsed: (v) => v === 'left' || v === 'right' || v === 'start' || v === 'end',
  },
];

/**
 * Static registry of known plugin-owned grid config properties.
 */
const KNOWN_CONFIG_PROPERTIES: InternalPropertyDefinition[] = [
  // GroupingColumnsPlugin
  {
    property: 'columnGroups',
    pluginName: 'groupingColumns',
    level: 'config',
    description: 'the "columnGroups" config property',
    importHint: "import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';",
    isUsed: (v) => Array.isArray(v) && v.length > 0,
  },
];

// ============================================================================
// Import Hints (for error messages)
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

// ============================================================================
// Development Mode Detection
// ============================================================================

/**
 * Check if we're running in a development environment.
 * Warnings are only shown in development to avoid polluting production logs.
 */
function isDevelopment(): boolean {
  // Check for localhost (browser environment)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
  }
  // Check for NODE_ENV (build-time or SSR)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    return true;
  }
  return false;
}

// ============================================================================
// Helper Functions
// ============================================================================

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

// ============================================================================
// Property Validation
// ============================================================================

/**
 * Validate that column properties requiring plugins have those plugins loaded.
 *
 * @param config - The merged grid configuration
 * @param plugins - The array of loaded plugins
 * @throws Error if a plugin-owned property is used without the plugin
 */
export function validatePluginProperties<T>(config: GridConfig<T>, plugins: readonly BaseGridPlugin[]): void {
  // Use static registries of known plugin-owned properties
  const columnProps = KNOWN_COLUMN_PROPERTIES;
  const configProps = KNOWN_CONFIG_PROPERTIES;

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
    // Entry is guaranteed to exist after the set above
    const entry = missingPlugins.get(pluginName)!;
    if (!entry.fields.includes(field)) {
      entry.fields.push(field);
    }
  }

  // Validate grid config properties
  for (const def of configProps) {
    const value = (config as Record<string, unknown>)[def.property];
    const isUsed = def.isUsed ? def.isUsed(value) : value !== undefined;

    if (isUsed && !hasPlugin(plugins, def.pluginName)) {
      addError(def.pluginName, def.description, def.importHint ?? getImportHint(def.pluginName), def.property, true);
    }
  }

  // Validate column properties
  const columns = config.columns;
  if (columns && columns.length > 0) {
    for (const column of columns) {
      for (const def of columnProps) {
        const value = (column as unknown as Record<string, unknown>)[def.property];
        // Use custom isUsed check if provided, otherwise check for defined value
        const isUsed = def.isUsed ? def.isUsed(value) : value !== undefined;

        if (isUsed && !hasPlugin(plugins, def.pluginName)) {
          const field = (column as ColumnConfig).field || '<unknown>';
          addError(def.pluginName, def.description, def.importHint ?? getImportHint(def.pluginName), field);
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
// Plugin Config Rules Validation
// ============================================================================

/**
 * Validate plugin configuration rules declared in manifests.
 * Called after plugins are attached to check for invalid/conflicting configurations.
 *
 * Rules with severity 'error' throw an error.
 * Rules with severity 'warn' log a warning to console.
 *
 * @param plugins - The array of attached plugins (with config already merged)
 */
export function validatePluginConfigRules(plugins: readonly BaseGridPlugin[]): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const plugin of plugins) {
    const PluginClass = plugin.constructor as typeof BaseGridPlugin;
    const manifest = PluginClass.manifest as PluginManifest | undefined;
    if (!manifest?.configRules) continue;

    for (const rule of manifest.configRules) {
      // Access plugin's merged config via protected property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pluginConfig = (plugin as any).config;
      if (rule.check(pluginConfig)) {
        const prefix = `[tbw-grid:${capitalize(plugin.name)}Plugin]`;
        const formatted = `${prefix} Configuration warning: ${rule.message}`;
        if (rule.severity === 'error') {
          errors.push(formatted);
        } else {
          warnings.push(formatted);
        }
      }
    }
  }

  // Log warnings only in development (don't pollute production logs)
  if (warnings.length > 0 && isDevelopment()) {
    for (const warning of warnings) {
      console.warn(warning);
    }
  }

  // Throw consolidated error if any (always, regardless of environment)
  if (errors.length > 0) {
    throw new Error(`[tbw-grid] Configuration error:\n\n${errors.join('\n\n')}`);
  }
}

// ============================================================================
// Plugin Dependency Validation
// ============================================================================

/**
 * Validate plugin-to-plugin dependencies.
 * Called by PluginManager when attaching a new plugin.
 *
 * Dependencies are read from the plugin's static `dependencies` property.
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

  // Get dependencies from plugin's static property
  const dependencies = PluginClass.dependencies ?? [];

  // Validate each dependency
  for (const dep of dependencies) {
    const requiredPlugin = dep.name;
    const required = dep.required ?? true; // Default to required
    const reason = dep.reason;
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
// ============================================================================
// Plugin Incompatibility Validation
// ============================================================================

/**
 * Validate that no incompatible plugins are loaded together.
 * Called after all plugins are attached to the grid.
 *
 * Incompatibilities are read from each plugin's manifest `incompatibleWith` property.
 * When a conflict is detected, a warning is logged (in development mode).
 *
 * @param plugins - All attached plugins
 */
export function validatePluginIncompatibilities(plugins: readonly BaseGridPlugin[]): void {
  // Only warn in development mode to avoid polluting production logs
  if (!isDevelopment()) return;

  const pluginNames = new Set(plugins.map((p) => p.name));
  const warned = new Set<string>(); // Avoid duplicate warnings for symmetric conflicts

  for (const plugin of plugins) {
    const PluginClass = plugin.constructor as typeof BaseGridPlugin;
    const manifest = PluginClass.manifest as PluginManifest | undefined;
    if (!manifest?.incompatibleWith) continue;

    for (const incompatibility of manifest.incompatibleWith) {
      if (pluginNames.has(incompatibility.name)) {
        // Create a symmetric key to avoid warning twice (A→B and B→A)
        const key = [plugin.name, incompatibility.name].sort().join('↔');
        if (warned.has(key)) continue;
        warned.add(key);

        console.warn(
          `[tbw-grid] Plugin incompatibility warning:\n\n` +
            `${capitalize(plugin.name)}Plugin and ${capitalize(incompatibility.name)}Plugin are both loaded, ` +
            `but they are currently incompatible.\n\n` +
            `  → ${incompatibility.reason}\n\n` +
            `  Consider removing one of these plugins to avoid unexpected behavior.`,
        );
      }
    }
  }
}
