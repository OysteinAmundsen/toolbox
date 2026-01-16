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
