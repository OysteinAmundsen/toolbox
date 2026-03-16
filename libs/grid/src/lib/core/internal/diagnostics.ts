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
 * import { Diagnostic, warnDiagnostic, throwDiagnostic } from './diagnostics';
 *
 * // Warn with a code
 * warnDiagnostic(Diagnostic.MISSING_BREAKPOINT, 'Set a breakpoint...', gridId);
 *
 * // Throw with a code
 * throwDiagnostic(Diagnostic.MISSING_ROW_ID, 'Configure getRowId...', gridId);
 * ```
 *
 * Plugins should prefer `this.warn(Diagnostic.CODE, message)` via BaseGridPlugin
 * instead of importing this module directly.
 *
 * @internal
 */
import { gridPrefix } from './utils';

// #region Diagnostic Codes

/**
 * All diagnostic codes used across the grid library.
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
export const Diagnostic = {
  // --- Config validation (001–019) ---
  /** Column uses a plugin-owned property but the plugin is not loaded. */
  MISSING_PLUGIN: 'TBW001',
  /** Grid config uses a plugin-owned property but the plugin is not loaded. */
  MISSING_PLUGIN_CONFIG: 'TBW002',
  /** Plugin config rule violation (error severity). */
  CONFIG_RULE_ERROR: 'TBW003',
  /** Plugin config rule violation (warning severity). */
  CONFIG_RULE_WARN: 'TBW004',

  // --- Plugin lifecycle (020–029) ---
  /** Required plugin dependency is missing. */
  MISSING_DEPENDENCY: 'TBW020',
  /** Optional plugin dependency is missing. */
  OPTIONAL_DEPENDENCY: 'TBW021',
  /** Two loaded plugins are incompatible. */
  INCOMPATIBLE_PLUGINS: 'TBW022',
  /** Plugin uses deprecated hooks. */
  DEPRECATED_HOOK: 'TBW023',
  /** Error thrown inside a plugin event handler. */
  PLUGIN_EVENT_ERROR: 'TBW024',

  // --- Feature registry (030–039) ---
  /** Feature was re-registered (overwritten). */
  FEATURE_REREGISTERED: 'TBW030',
  /** Feature configured but not imported. */
  FEATURE_NOT_IMPORTED: 'TBW031',
  /** Feature depends on another feature that is not enabled. */
  FEATURE_MISSING_DEP: 'TBW032',

  // --- Row operations (040–049) ---
  /** Cannot determine row ID (no getRowId and no id property). */
  MISSING_ROW_ID: 'TBW040',
  /** Row with given ID not found. */
  ROW_NOT_FOUND: 'TBW041',

  // --- Column operations (050–059) ---
  /** Column has an invalid CSS width value. */
  INVALID_COLUMN_WIDTH: 'TBW050',

  // --- Rendering callbacks (060–069) ---
  /** rowClass callback threw an error. */
  ROW_CLASS_ERROR: 'TBW060',
  /** cellClass callback threw an error. */
  CELL_CLASS_ERROR: 'TBW061',
  /** Column format function threw an error. */
  FORMAT_ERROR: 'TBW062',
  /** External view mount() threw an error. */
  VIEW_MOUNT_ERROR: 'TBW063',
  /** External view event dispatch error. */
  VIEW_DISPATCH_ERROR: 'TBW064',

  // --- Shell (070–079) ---
  /** Tool panel missing required id or title. */
  TOOL_PANEL_MISSING_ATTR: 'TBW070',
  /** No tool panels registered. */
  NO_TOOL_PANELS: 'TBW071',
  /** Tool panel section not found. */
  TOOL_PANEL_NOT_FOUND: 'TBW072',
  /** Tool panel already registered. */
  TOOL_PANEL_DUPLICATE: 'TBW073',
  /** Header content already registered. */
  HEADER_CONTENT_DUPLICATE: 'TBW074',
  /** Toolbar content already registered. */
  TOOLBAR_CONTENT_DUPLICATE: 'TBW075',

  // --- Editing & editors (080–089) ---
  /** External editor mount() threw an error. */
  EDITOR_MOUNT_ERROR: 'TBW080',

  // --- Print (090–099) ---
  /** Print already in progress. */
  PRINT_IN_PROGRESS: 'TBW090',
  /** Grid not available for printing. */
  PRINT_NO_GRID: 'TBW091',
  /** Print operation failed. */
  PRINT_FAILED: 'TBW092',
  /** Multiple elements share the same grid ID (print isolation issue). */
  PRINT_DUPLICATE_ID: 'TBW093',

  // --- Clipboard (100–109) ---
  /** Clipboard API write failed. */
  CLIPBOARD_FAILED: 'TBW100',

  // --- Plugin-specific (110–119) ---
  /** ResponsivePlugin: no breakpoint configured. */
  MISSING_BREAKPOINT: 'TBW110',
  /** UndoRedoPlugin: transaction already in progress. */
  TRANSACTION_IN_PROGRESS: 'TBW111',
  /** UndoRedoPlugin: no transaction in progress. */
  NO_TRANSACTION: 'TBW112',
  /** GroupingColumnsPlugin: missing id or header on column group definition. */
  COLUMN_GROUP_NO_ID: 'TBW113',
  /** GroupingColumnsPlugin: conflicting columnGroups sources. */
  COLUMN_GROUPS_CONFLICT: 'TBW114',

  // --- Style injection (120–129) ---
  /** Failed to extract grid.css from document stylesheets. */
  STYLE_EXTRACT_FAILED: 'TBW120',
  /** Could not find grid.css in document.styleSheets. */
  STYLE_NOT_FOUND: 'TBW121',

  // --- Attribute parsing (130–139) ---
  /** Invalid JSON in an HTML attribute. */
  INVALID_ATTRIBUTE_JSON: 'TBW130',
} as const;

export type DiagnosticCode = (typeof Diagnostic)[keyof typeof Diagnostic];

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
 * Log an info message with a diagnostic code and docs link.
 * Use for optional/soft dependency notifications.
 */
export function infoDiagnostic(code: DiagnosticCode, message: string, gridId?: string, pluginName?: string): void {
  console.info(formatDiagnostic(code, message, gridId, pluginName));
}

/**
 * Log an error with a diagnostic code and docs link.
 * Use for non-throwing errors (e.g., failed async operations).
 */
export function errorDiagnostic(code: DiagnosticCode, message: string, gridId?: string, pluginName?: string): void {
  console.error(formatDiagnostic(code, message, gridId, pluginName));
}

// #endregion
