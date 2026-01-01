/**
 * Sticky Columns Plugin Types
 *
 * Type definitions for column pinning (sticky left/right columns).
 */

 

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

/** Sticky column position */
export type StickyPosition = 'left' | 'right';
