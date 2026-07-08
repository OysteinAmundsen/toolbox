/**
 * Column shorthand parsing for `@toolbox-web/grid-vue`.
 *
 * The parser, header generation and defaults helpers live in `@toolbox-web/grid`
 * core (issue #276). This module re-exports them so the adapter's public import
 * path is unchanged while the implementation stays in one place. Vue's shorthand
 * API types against core's `ColumnConfig` (these helpers take no VNode-typed
 * override), so a direct re-export is type-identical.
 */
export { applyColumnDefaults, hasColumnShorthands, normalizeColumns, parseColumnShorthand } from '@toolbox-web/grid';
export type { ColumnShorthand } from '@toolbox-web/grid';
