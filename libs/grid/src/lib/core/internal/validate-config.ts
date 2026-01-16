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
}

/**
 * Registry of plugin-owned column properties.
 * This is the single source of truth for which properties require which plugins.
 */
const PLUGIN_OWNED_COLUMN_PROPERTIES: PluginPropertyDefinition[] = [
  {
    property: 'editable',
    pluginName: 'editing',
    description: 'the "editable" column property',
    importHint: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
  },
  {
    property: 'editor',
    pluginName: 'editing',
    description: 'the "editor" column property',
    importHint: "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';",
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
  const columns = config.columns;
  if (!columns || columns.length === 0) return;

  // Group errors by plugin to avoid spamming multiple errors
  const missingPlugins = new Map<string, { def: PluginPropertyDefinition; fields: string[] }>();

  for (const column of columns) {
    for (const def of PLUGIN_OWNED_COLUMN_PROPERTIES) {
      const value = (column as Record<string, unknown>)[def.property];
      // Check if property is set to a truthy value (for boolean) or defined (for others)
      const isUsed = def.property === 'editable' ? value === true : value !== undefined;

      if (isUsed && !hasPlugin(plugins, def.pluginName)) {
        // Track this error
        if (!missingPlugins.has(def.pluginName)) {
          missingPlugins.set(def.pluginName, { def, fields: [] });
        }
        const field = (column as ColumnConfig).field || '<unknown>';
        const entry = missingPlugins.get(def.pluginName)!;
        if (!entry.fields.includes(field)) {
          entry.fields.push(field);
        }
      }
    }
  }

  // Throw a single consolidated error if any missing plugins
  if (missingPlugins.size > 0) {
    const errors: string[] = [];
    for (const [pluginName, { def, fields }] of missingPlugins) {
      const fieldList = fields.slice(0, 3).join(', ') + (fields.length > 3 ? `, ... (${fields.length} total)` : '');
      errors.push(
        `Column(s) [${fieldList}] use ${def.description}, but the required plugin is not loaded.\n` +
          `  → Add the plugin to your gridConfig.plugins array:\n` +
          `    ${def.importHint}\n` +
          `    plugins: [new ${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Plugin(), ...]`,
      );
    }

    throw new Error(
      `[tbw-grid] Configuration error:\n\n${errors.join('\n\n')}\n\n` +
        `This validation helps catch misconfigurations early. ` +
        `The properties listed above require their respective plugins to function.`,
    );
  }
}
