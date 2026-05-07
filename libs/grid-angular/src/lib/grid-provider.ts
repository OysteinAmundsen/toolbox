/**
 * Combined provider helper for grid type defaults and icons.
 *
 * Convenience function that combines `provideGridTypeDefaults` and
 * `provideGridIcons` into a single call for application bootstrap.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { ApplicationConfig } from '@angular/core';
 * import { provideGrid } from '@toolbox-web/grid-angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideGrid({
 *       typeDefaults: {
 *         country: { renderer: CountryCellComponent },
 *       },
 *       icons: {
 *         sortAsc: '↑',
 *         sortDesc: '↓',
 *       },
 *     }),
 *   ],
 * };
 * ```
 */
import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { GridIcons } from '@toolbox-web/grid';
import { provideGridIcons } from './grid-icon-registry';
import { provideGridTypeDefaults, type TypeDefaultRegistration } from './grid-type-registry';

/**
 * Options for {@link provideGrid}.
 * @since 1.4.0
 */
export interface ProvideGridOptions {
  /** Type defaults to register globally. Equivalent to `provideGridTypeDefaults`. */
  typeDefaults?: Record<string, TypeDefaultRegistration>;
  /** Icon overrides to register globally. Equivalent to `provideGridIcons`. */
  icons?: Partial<GridIcons>;
}

/**
 * Combined provider for grid type defaults and icons.
 *
 * Returns environment providers that can be added to your `ApplicationConfig`
 * `providers` array. Either field is optional — only the registries you
 * supply are wired up.
 *
 * Equivalent to calling `provideGridTypeDefaults(options.typeDefaults)` and
 * `provideGridIcons(options.icons)` separately.
 * @since 1.4.0
 */
export function provideGrid(options: ProvideGridOptions = {}): EnvironmentProviders {
  const providers: EnvironmentProviders[] = [];
  if (options.typeDefaults) {
    providers.push(provideGridTypeDefaults(options.typeDefaults));
  }
  if (options.icons) {
    providers.push(provideGridIcons(options.icons));
  }
  return makeEnvironmentProviders(providers);
}
