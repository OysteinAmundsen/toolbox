/**
 * All features bundle for @toolbox-web/grid-angular
 *
 * Import this module to enable ALL feature inputs on Grid directive.
 * Warning: This includes all plugins in your bundle. For smaller bundles,
 * import only the features you need.
 *
 * @example
 * ```typescript
 * // Import all features at once (large bundle)
 * import '@toolbox-web/grid-angular/features';
 *
 * // Now all feature inputs work
 * <tbw-grid [selection]="'range'" [editing]="'dblclick'" [filtering]="true" />
 * ```
 *
 * @packageDocumentation
 */

import './clipboard';
import './column-virtualization';
import './context-menu';
import './editing';
import './export';
import './filtering';
import './grouping-columns';
import './grouping-rows';
import './master-detail';
import './multi-sort';
import './pinned-columns';
import './pinned-rows';
import './pivot';
import './print';
import './reorder';
import './responsive';
import './row-reorder';
import './selection';
import './server-side';
// './sorting' is deprecated, imports './multi-sort' internally
import './tree';
import './undo-redo';
import './visibility';
