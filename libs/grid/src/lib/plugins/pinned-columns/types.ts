/**
 * Sticky Columns Plugin Types
 *
 * Type definitions for column pinning (sticky left/right columns).
 */

/**
 * Sticky column position.
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
 * { field: 'id', sticky: 'left' }
 *
 * // Logical - pins to visual start (left in LTR, right in RTL)
 * { field: 'id', sticky: 'start' }
 * ```
 */
export type StickyPosition = 'left' | 'right' | 'start' | 'end';

/**
 * Physical sticky position after resolving logical values.
 * Used internally after applying RTL resolution.
 */
export type ResolvedStickyPosition = 'left' | 'right';

// ============================================================================
// Module Augmentation - Add sticky property to column config
// ============================================================================

/**
 * When PinnedColumnsPlugin is imported, the `sticky` property becomes available on column config.
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
    sticky?: StickyPosition;
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
