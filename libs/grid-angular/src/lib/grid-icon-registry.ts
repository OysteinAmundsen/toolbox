/**
 * Icon configuration registry for Angular applications.
 *
 * Provides application-wide icon overrides for all grids via
 * Angular's dependency injection.
 */
import { EnvironmentProviders, inject, Injectable, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { GridIcons } from '@toolbox-web/grid';

/**
 * Injection token for providing icon overrides at app level.
 */
export const GRID_ICONS = new InjectionToken<Partial<GridIcons>>('GRID_ICONS');

/**
 * Injectable service for managing grid icons.
 *
 * Use `provideGridIcons()` in your app config to set up icons,
 * or inject this service for dynamic registration.
 *
 * @example
 * ```typescript
 * // App-level setup (app.config.ts)
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideGridIcons({
 *       expand: '➕',
 *       collapse: '➖',
 *       sortAsc: '↑',
 *       sortDesc: '↓',
 *     })
 *   ]
 * };
 *
 * // Dynamic registration
 * @Component({ ... })
 * export class AppComponent {
 *   private registry = inject(GridIconRegistry);
 *
 *   ngOnInit() {
 *     this.registry.set('filter', '<svg>...</svg>');
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class GridIconRegistry {
  private readonly icons = new Map<keyof GridIcons, GridIcons[keyof GridIcons]>();

  constructor() {
    // Merge any initial icons from provider
    const initial = inject(GRID_ICONS, { optional: true });
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        this.icons.set(key as keyof GridIcons, value);
      }
    }
  }

  /**
   * Set an icon override.
   *
   * @param name - The icon name (e.g., 'expand', 'collapse', 'filter')
   * @param value - The icon value (string text or SVG markup)
   */
  set<K extends keyof GridIcons>(name: K, value: GridIcons[K]): void {
    this.icons.set(name, value);
  }

  /**
   * Get an icon value.
   */
  get<K extends keyof GridIcons>(name: K): GridIcons[K] | undefined {
    return this.icons.get(name) as GridIcons[K] | undefined;
  }

  /**
   * Remove an icon override.
   */
  remove(name: keyof GridIcons): void {
    this.icons.delete(name);
  }

  /**
   * Check if an icon has an override.
   */
  has(name: keyof GridIcons): boolean {
    return this.icons.has(name);
  }

  /**
   * Get all icon overrides as a GridIcons partial.
   * Used internally by the adapter.
   *
   * @internal
   */
  getAll(): Partial<GridIcons> {
    const result: Partial<GridIcons> = {};
    for (const [key, value] of this.icons) {
      (result as Record<keyof GridIcons, GridIcons[keyof GridIcons]>)[key] = value;
    }
    return result;
  }

  /**
   * Get all registered icon names.
   */
  getRegisteredIcons(): (keyof GridIcons)[] {
    return Array.from(this.icons.keys());
  }
}

/**
 * Provides application-level icon overrides for all grids.
 *
 * Available icons to override:
 * - `expand` - Expand icon for collapsed items (trees, groups, details)
 * - `collapse` - Collapse icon for expanded items
 * - `sortAsc` - Sort ascending indicator
 * - `sortDesc` - Sort descending indicator
 * - `sortNone` - Sort neutral/unsorted indicator
 * - `submenuArrow` - Submenu arrow for context menus
 * - `dragHandle` - Drag handle icon for reordering
 * - `toolPanel` - Tool panel toggle icon in toolbar
 * - `filter` - Filter icon in column headers
 * - `filterActive` - Filter icon when filter is active
 * - `print` - Print icon for print button
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { provideGridIcons } from '@toolbox-web/grid-angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideGridIcons({
 *       expand: '➕',
 *       collapse: '➖',
 *       sortAsc: '↑',
 *       sortDesc: '↓',
 *       filter: '<svg viewBox="0 0 16 16">...</svg>',
 *     })
 *   ]
 * };
 * ```
 */
export function provideGridIcons(icons: Partial<GridIcons>): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: GRID_ICONS, useValue: icons }]);
}
