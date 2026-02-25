/**
 * Pinned Columns Plugin Types
 *
 * Type definitions for column pinning (sticky left/right columns).
 */

/**
 * Column pin position.
 *
 * **Physical values** (always pin to specified side):
 * - `'left'` - Pin to left edge
 * - `'right'` - Pin to right edge
 *
 * **Logical values** (flip based on text direction for RTL support):
 * - `'start'` - Pin to inline-start (left in LTR, right in RTL)
 * - `'end'` - Pin to inline-end (right in LTR, left in RTL)
 *
 * Use logical values (`start`/`end`) for grids that need to work in both
 * LTR and RTL layouts with the same configuration.
 *
 * @example
 * ```typescript
 * // Physical - always pins to left side regardless of direction
 * { field: 'id', pinned: 'left' }
 *
 * // Logical - pins to visual start (left in LTR, right in RTL)
 * { field: 'id', pinned: 'start' }
 * ```
 */
export type PinnedPosition = 'left' | 'right' | 'start' | 'end';

/**
 * @deprecated Use {@link PinnedPosition} instead. Will be removed in a future major version.
 */
export type StickyPosition = PinnedPosition;

/**
 * Physical pin position after resolving logical values.
 * Used internally after applying RTL resolution.
 */
export type ResolvedPinnedPosition = 'left' | 'right';

/**
 * @deprecated Use {@link ResolvedPinnedPosition} instead. Will be removed in a future major version.
 */
export type ResolvedStickyPosition = ResolvedPinnedPosition;

// ============================================================================
// Module Augmentation - Add pinned property to column config
// ============================================================================

/**
 * When PinnedColumnsPlugin is imported, the `pinned` property becomes available on column config.
 * This augments the core BaseColumnConfig interface.
 */
declare module '../../core/types' {
  interface BaseColumnConfig<TRow, TValue> {
    /**
     * Pin column to an edge of the grid.
     *
     * **Physical values** (always pin to specified side):
     * - `'left'` - Pin to left edge
     * - `'right'` - Pin to right edge
     *
     * **Logical values** (flip based on text direction for RTL support):
     * - `'start'` - Pin to inline-start (left in LTR, right in RTL)
     * - `'end'` - Pin to inline-end (right in LTR, left in RTL)
     *
     * Requires PinnedColumnsPlugin.
     */
    pinned?: PinnedPosition;

    /**
     * @deprecated Use `pinned` instead. Will be removed in a future major version.
     */
    sticky?: PinnedPosition;
  }

  interface PluginNameMap {
    pinnedColumns: import('./PinnedColumnsPlugin').PinnedColumnsPlugin;
  }
}

/** Configuration options for the pinned columns plugin */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface PinnedColumnsConfig {
  // Currently no configuration options - plugin is active when columns have sticky position
}

/** Internal state managed by the pinned columns plugin */
export interface PinnedColumnsState {
  /** Whether sticky columns are currently applied */
  isApplied: boolean;
  /** Cached left offsets by field */
  leftOffsets: Map<string, number>;
  /** Cached right offsets by field */
  rightOffsets: Map<string, number>;
}
