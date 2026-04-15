/**
 * Centralized diagnostic messages for @toolbox-web/grid.
 *
 * Every user-facing warning, error, or info message in the grid has a unique
 * diagnostic code (e.g. `TBW001`). Each code maps to a section on the online
 * troubleshooting page, giving developers a direct link to resolution steps.
 *
 * ## Usage
 *
 * ```ts
 * import { MISSING_BREAKPOINT, warnDiagnostic, throwDiagnostic } from './diagnostics';
 *
 * // Warn with a code
 * warnDiagnostic(MISSING_BREAKPOINT, 'Set a breakpoint...', gridId);
 *
 * // Throw with a code
 * throwDiagnostic(MISSING_ROW_ID, 'Configure getRowId...', gridId);
 * ```
 *
 * Plugins should prefer `this.warn(MISSING_BREAKPOINT, message)` via BaseGridPlugin
 * instead of importing this module directly.
 *
 * @internal
 */

// #region Grid Prefix

/**
 * Build the `[tbw-grid]` or `[tbw-grid#my-id]` log prefix.
 * Pass `pluginName` for a scoped prefix like `[tbw-grid:SelectionPlugin]`.
 */
export function gridPrefix(gridId?: string, pluginName?: string): string {
  const id = gridId ? `#${gridId}` : '';
  const plugin = pluginName ? `:${pluginName}` : '';
  return `[tbw-grid${id}${plugin}]`;
}

// #endregion

// #region Diagnostic Codes

/**
 * Diagnostic codes used across the grid library.
 *
 * Each code is an individual export so that unused codes are tree-shaken
 * from bundles that don't reference them (esbuild can't tree-shake
 * properties from a single object).
 *
 * Naming: TBW + 3-digit number.
 * Ranges:
 *   001–019  Configuration validation (missing plugins, bad config)
 *   020–029  Plugin lifecycle (dependencies, incompatibilities, deprecation)
 *   030–039  Feature registry
 *   040–049  Row operations (row ID, row mutations)
 *   050–059  Column operations (width, template)
 *   060–069  Rendering (callbacks, formatters, external views)
 *   070–079  Shell (tool panels, header/toolbar content)
 *   080–089  Editing & editors
 *   090–099  Print
 *   100–109  Clipboard
 *   110–119  Plugin-specific (responsive, undo-redo, grouping-columns)
 *   120–129  Style injection
 *   130–139  Attribute parsing
 */

// --- Config validation (001–019) ---
/** Column uses a plugin-owned property but the plugin is not loaded. */
export const MISSING_PLUGIN = 'TBW001' as const;
/** Grid config uses a plugin-owned property but the plugin is not loaded. */
export const MISSING_PLUGIN_CONFIG = 'TBW002' as const;
/** Plugin config rule violation (error severity). */
export const CONFIG_RULE_ERROR = 'TBW003' as const;
/** Plugin config rule violation (warning severity). */
export const CONFIG_RULE_WARN = 'TBW004' as const;

// --- Plugin lifecycle (020–029) ---
/** Required plugin dependency is missing. */
export const MISSING_DEPENDENCY = 'TBW020' as const;
/** Optional plugin dependency is missing. */
export const OPTIONAL_DEPENDENCY = 'TBW021' as const;
/** Two loaded plugins are incompatible. */
export const INCOMPATIBLE_PLUGINS = 'TBW022' as const;
/** Error thrown inside a plugin event handler. */
export const PLUGIN_EVENT_ERROR = 'TBW024' as const;

// --- Feature registry (030–039) ---
/** Feature was re-registered (overwritten). */
export const FEATURE_REREGISTERED = 'TBW030' as const;
/** Feature configured but not imported. */
export const FEATURE_NOT_IMPORTED = 'TBW031' as const;
/** Feature depends on another feature that is not enabled. */
export const FEATURE_MISSING_DEP = 'TBW032' as const;

// --- Row operations (040–049) ---
/** Cannot determine row ID (no getRowId and no id property). */
export const MISSING_ROW_ID = 'TBW040' as const;
/** Row with given ID not found. */
export const ROW_NOT_FOUND = 'TBW041' as const;

// --- Column operations (050–059) ---
/** Column has an invalid CSS width value. */
export const INVALID_COLUMN_WIDTH = 'TBW050' as const;

// --- Rendering callbacks (060–069) ---
/** rowClass callback threw an error. */
export const ROW_CLASS_ERROR = 'TBW060' as const;
/** cellClass callback threw an error. */
export const CELL_CLASS_ERROR = 'TBW061' as const;
/** Column format function threw an error. */
export const FORMAT_ERROR = 'TBW062' as const;
/** External view mount() threw an error. */
export const VIEW_MOUNT_ERROR = 'TBW063' as const;
/** External view event dispatch error. */
export const VIEW_DISPATCH_ERROR = 'TBW064' as const;

// --- Shell (070–079) ---
/** Tool panel missing required id or title. */
export const TOOL_PANEL_MISSING_ATTR = 'TBW070' as const;
/** No tool panels registered. */
export const NO_TOOL_PANELS = 'TBW071' as const;
/** Tool panel section not found. */
export const TOOL_PANEL_NOT_FOUND = 'TBW072' as const;
/** Tool panel already registered. */
export const TOOL_PANEL_DUPLICATE = 'TBW073' as const;
/** Header content already registered. */
export const HEADER_CONTENT_DUPLICATE = 'TBW074' as const;
/** Toolbar content already registered. */
export const TOOLBAR_CONTENT_DUPLICATE = 'TBW075' as const;

// --- Editing & editors (080–089) ---
/** External editor mount() threw an error. */
export const EDITOR_MOUNT_ERROR = 'TBW080' as const;

// --- Print (090–099) ---
/** Print already in progress. */
export const PRINT_IN_PROGRESS = 'TBW090' as const;
/** Grid not available for printing. */
export const PRINT_NO_GRID = 'TBW091' as const;
/** Print operation failed. */
export const PRINT_FAILED = 'TBW092' as const;
/** Multiple elements share the same grid ID (print isolation issue). */
export const PRINT_DUPLICATE_ID = 'TBW093' as const;

// --- Clipboard (100–109) ---
/** Clipboard API write failed. */
export const CLIPBOARD_FAILED = 'TBW100' as const;

// --- Plugin-specific (110–119) ---
/** ResponsivePlugin: no breakpoint configured. */
export const MISSING_BREAKPOINT = 'TBW110' as const;
/** UndoRedoPlugin: transaction already in progress. */
export const TRANSACTION_IN_PROGRESS = 'TBW111' as const;
/** UndoRedoPlugin: no transaction in progress. */
export const NO_TRANSACTION = 'TBW112' as const;
/** GroupingColumnsPlugin: missing id or header on column group definition. */
export const COLUMN_GROUP_NO_ID = 'TBW113' as const;
/** GroupingColumnsPlugin: conflicting columnGroups sources. */
export const COLUMN_GROUPS_CONFLICT = 'TBW114' as const;

// --- Style injection (120–129) ---
/** Failed to extract grid.css from document stylesheets. */
export const STYLE_EXTRACT_FAILED = 'TBW120' as const;
/** Could not find grid.css in document.styleSheets. */
export const STYLE_NOT_FOUND = 'TBW121' as const;

// --- Attribute parsing (130–139) ---
/** Invalid JSON in an HTML attribute. */
export const INVALID_ATTRIBUTE_JSON = 'TBW130' as const;

// --- DataSource / ServerSide (140–149) ---
/** ServerSidePlugin: getRows() rejected. */
export const DATASOURCE_FETCH_ERROR = 'TBW140' as const;
/** ServerSidePlugin: getChildRows() rejected. */
export const DATASOURCE_CHILD_FETCH_ERROR = 'TBW141' as const;
/** ServerSidePlugin: getChildRows() not implemented but a plugin queried for children. */
export const DATASOURCE_NO_CHILD_HANDLER = 'TBW142' as const;
/** ServerSidePlugin: concurrent request limit reached, request deferred. */
export const DATASOURCE_THROTTLED = 'TBW143' as const;

export type DiagnosticCode =
  | typeof MISSING_PLUGIN
  | typeof MISSING_PLUGIN_CONFIG
  | typeof CONFIG_RULE_ERROR
  | typeof CONFIG_RULE_WARN
  | typeof MISSING_DEPENDENCY
  | typeof OPTIONAL_DEPENDENCY
  | typeof INCOMPATIBLE_PLUGINS
  | typeof PLUGIN_EVENT_ERROR
  | typeof FEATURE_REREGISTERED
  | typeof FEATURE_NOT_IMPORTED
  | typeof FEATURE_MISSING_DEP
  | typeof MISSING_ROW_ID
  | typeof ROW_NOT_FOUND
  | typeof INVALID_COLUMN_WIDTH
  | typeof ROW_CLASS_ERROR
  | typeof CELL_CLASS_ERROR
  | typeof FORMAT_ERROR
  | typeof VIEW_MOUNT_ERROR
  | typeof VIEW_DISPATCH_ERROR
  | typeof TOOL_PANEL_MISSING_ATTR
  | typeof NO_TOOL_PANELS
  | typeof TOOL_PANEL_NOT_FOUND
  | typeof TOOL_PANEL_DUPLICATE
  | typeof HEADER_CONTENT_DUPLICATE
  | typeof TOOLBAR_CONTENT_DUPLICATE
  | typeof EDITOR_MOUNT_ERROR
  | typeof PRINT_IN_PROGRESS
  | typeof PRINT_NO_GRID
  | typeof PRINT_FAILED
  | typeof PRINT_DUPLICATE_ID
  | typeof CLIPBOARD_FAILED
  | typeof MISSING_BREAKPOINT
  | typeof TRANSACTION_IN_PROGRESS
  | typeof NO_TRANSACTION
  | typeof COLUMN_GROUP_NO_ID
  | typeof COLUMN_GROUPS_CONFLICT
  | typeof STYLE_EXTRACT_FAILED
  | typeof STYLE_NOT_FOUND
  | typeof INVALID_ATTRIBUTE_JSON
  | typeof DATASOURCE_FETCH_ERROR
  | typeof DATASOURCE_CHILD_FETCH_ERROR
  | typeof DATASOURCE_NO_CHILD_HANDLER
  | typeof DATASOURCE_THROTTLED;

// #endregion

// #region Docs URL

const DOCS_BASE = 'https://toolboxjs.com/grid/errors';

/** Build a direct link to the troubleshooting section for a code. */
function docsUrl(code: DiagnosticCode): string {
  return `${DOCS_BASE}#${code.toLowerCase()}`;
}

// #endregion

// #region Formatting

/**
 * Format a diagnostic message with prefix, code, and docs link.
 *
 * Output format:
 * ```
 * [tbw-grid#my-id] TBW001: Your message here.
 *
 *   → More info: https://toolboxjs.com/grid/errors#tbw001
 * ```
 */
export function formatDiagnostic(code: DiagnosticCode, message: string, gridId?: string, pluginName?: string): string {
  const prefix = gridPrefix(gridId, pluginName);
  return `${prefix} ${code}: ${message}\n\n  → More info: ${docsUrl(code)}`;
}

// #endregion

// #region Public API

/**
 * Throw an error with a diagnostic code and docs link.
 * Use for configuration errors and API misuse that should halt execution.
 */
export function throwDiagnostic(code: DiagnosticCode, message: string, gridId?: string, pluginName?: string): never {
  throw new Error(formatDiagnostic(code, message, gridId, pluginName));
}

/**
 * Log a warning with a diagnostic code and docs link.
 * Use for recoverable issues the developer should fix.
 */
export function warnDiagnostic(code: DiagnosticCode, message: string, gridId?: string, pluginName?: string): void {
  console.warn(formatDiagnostic(code, message, gridId, pluginName));
}

/**
 * Log a debug message with a diagnostic code and docs link.
 * Use for optional/soft dependency notifications — visible only when
 * the browser DevTools "Verbose" log level is enabled.
 */
export function debugDiagnostic(code: DiagnosticCode, message: string, gridId?: string, pluginName?: string): void {
  console.debug(formatDiagnostic(code, message, gridId, pluginName));
}

/**
 * Log an error with a diagnostic code and docs link.
 * Use for non-throwing errors (e.g., failed async operations).
 */
export function errorDiagnostic(code: DiagnosticCode, message: string, gridId?: string, pluginName?: string): void {
  console.error(formatDiagnostic(code, message, gridId, pluginName));
}

// #endregion
