/**
 * All features for @toolbox-web/grid-react
 *
 * Import this module to enable ALL feature props on DataGrid.
 * Use this when you want the full grid functionality without managing individual imports.
 *
 * For smaller bundles, import only the features you need:
 * ```tsx
 * import '@toolbox-web/grid-react/features/selection';
 * import '@toolbox-web/grid-react/features/filtering';
 * ```
 *
 * @example
 * ```tsx
 * // Enable all features at once
 * import '@toolbox-web/grid-react/features';
 *
 * <DataGrid
 *   selection="range"
 *   filtering
 *   sorting="multi"
 *   editing="dblclick"
 *   // ... all props work!
 * />
 * ```
 *
 * @packageDocumentation
 */

// Import all features - side effects register them
import './clipboard';
import './column-virtualization';
import './context-menu';
import './editing';
import './export';
import './filtering';
import './grouping-columns';
import './grouping-rows';
import './master-detail';
import './pinned-columns';
import './pinned-rows';
import './pivot';
import './print';
import './reorder';
import './responsive';
import './row-reorder';
import './selection';
import './server-side';
import './sorting';
import './tree';
import './undo-redo';
import './visibility';
