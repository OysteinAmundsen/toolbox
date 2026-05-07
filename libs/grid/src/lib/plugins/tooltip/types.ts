/**
 * Tooltip Plugin Types
 *
 * Type definitions for the tooltip feature.
 */

import type { CellRenderContext, HeaderLabelContext } from '../../core/types';
import { TooltipPlugin } from './TooltipPlugin';

// #region Module Augmentation
declare module '../../core/types' {
  interface BaseColumnConfig<TRow, TValue> {
    /**
     * Cell tooltip configuration. Requires TooltipPlugin.
     *
     * - `false` — disable cell tooltips for this column
     * - `string` — static tooltip text for all cells in this column
     * - `(ctx) => string | null` — dynamic tooltip from row data; return `null` to suppress
     *
     * When omitted, the plugin uses the cell's `textContent` on overflow (if `cell` is enabled).
     *
     * @example
     * ```typescript
     * // Static tooltip
     * { field: 'status', cellTooltip: 'Current status of the record' }
     *
     * // Dynamic tooltip from row data
     * { field: 'name', cellTooltip: (ctx) => `${ctx.row.firstName} ${ctx.row.lastName}\nDept: ${ctx.row.department}` }
     *
     * // Disable for this column
     * { field: 'actions', cellTooltip: false }
     * ```
     */
    cellTooltip?: false | string | ((ctx: CellRenderContext<TRow, TValue>) => string | null);

    /**
     * Header tooltip configuration. Requires TooltipPlugin.
     *
     * - `false` — disable header tooltip for this column
     * - `string` — static tooltip text
     * - `(ctx) => string | null` — dynamic tooltip; return `null` to suppress
     *
     * When omitted, the plugin uses the column `header` text on overflow (if `header` is enabled).
     *
     * @example
     * ```typescript
     * // Custom header tooltip with description
     * { field: 'revenue', headerTooltip: 'Total revenue in USD (before tax)' }
     *
     * // Disable for this column
     * { field: 'id', headerTooltip: false }
     * ```
     */
    headerTooltip?: false | string | ((ctx: HeaderLabelContext<TRow>) => string | null);
  }

  interface PluginNameMap {
    tooltip: TooltipPlugin;
  }
}
// #endregion

// #region Plugin Config
/**
 * Configuration for the Tooltip plugin.
 *
 * @example
 * ```typescript
 * // Enable both header and cell tooltips (default)
 * new TooltipPlugin()
 *
 * // Header tooltips only
 * new TooltipPlugin({ cell: false })
 *
 * // Disable all tooltips temporarily
 * new TooltipPlugin({ header: false, cell: false })
 * ```
 * @since 1.28.0
 */
export interface TooltipConfig {
  /**
   * Enable automatic header tooltips when text overflows.
   * Individual columns can override with `headerTooltip`.
   * @default true
   */
  header?: boolean;

  /**
   * Enable automatic cell tooltips when text overflows.
   * Individual columns can override with `cellTooltip`.
   * @default true
   */
  cell?: boolean;
}
// #endregion
