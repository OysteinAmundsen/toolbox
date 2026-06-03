/**
 * Shell feature for @toolbox-web/grid-react
 *
 * Import this module to opt the grid shell (header bar + tool panels) into
 * the build. The shell also auto-registers in v2.x (so it is on by default
 * and non-breaking); importing this module makes the opt-in explicit and
 * tree-shakeable for v3, where the auto-register is removed.
 *
 * The shell is configured through `gridConfig` (`features: { shell }` or the
 * `<GridHeaderContent>` / `<GridToolbarContent>` / `<GridToolPanel>`
 * wrappers), not a boolean prop.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/shell';
 *
 * <DataGrid gridConfig={{ features: { shell: { header: { title: 'Employees' } } } }} />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/shell';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _ShellAugmentation } from '@toolbox-web/grid/features/shell';
