/**
 * Column shorthand parsing for `@toolbox-web/grid-angular`.
 *
 * The parser, header generation and defaults helpers live in `@toolbox-web/grid`
 * core (issue #276). This module re-exports them so the adapter's public import
 * path is unchanged while the implementation stays in one place. Angular's
 * shorthand API types against core's `ColumnConfig` (these helpers take no
 * component-typed override), so a direct re-export is type-identical.
 */
export { applyColumnDefaults, hasColumnShorthands, normalizeColumns, parseColumnShorthand } from '@toolbox-web/grid';
export type { ColumnShorthand } from '@toolbox-web/grid';
