/**
 * Type-level default registry for Angular applications.
 *
 * Provides application-wide type defaults for renderers and editors
 * that all grids inherit automatically.
 */
import {
  EnvironmentProviders,
  inject,
  Injectable,
  InjectionToken,
  makeEnvironmentProviders,
  Type,
} from '@angular/core';
import type { TypeDefault } from '@toolbox-web/grid';

/**
 * Angular-specific type default configuration.
 * Uses Angular component types instead of function-based renderers/editors.
 */
export interface AngularTypeDefault<TRow = unknown> {
  /** Angular component class for rendering cells of this type */
  renderer?: Type<any>;
  /** Angular component class for editing cells of this type */
  editor?: Type<any>;
  /** Default editorParams for this type */
  editorParams?: Record<string, unknown>;
}

/**
 * Injection token for providing type defaults at app level.
 */
export const GRID_TYPE_DEFAULTS = new InjectionToken<Record<string, AngularTypeDefault>>('GRID_TYPE_DEFAULTS');

/**
 * Injectable service for managing type-level defaults.
 *
 * Use `provideGridTypeDefaults()` in your app config to set up defaults,
 * or inject this service for dynamic registration.
 *
 * @example
 * ```typescript
 * // App-level setup (app.config.ts)
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideGridTypeDefaults({
 *       country: {
 *         renderer: CountryCellComponent,
 *         editor: CountryEditorComponent
 *       },
 *       status: {
 *         renderer: StatusBadgeComponent
 *       }
 *     })
 *   ]
 * };
 *
 * // Dynamic registration
 * @Component({ ... })
 * export class AppComponent {
 *   private registry = inject(GridTypeRegistry);
 *
 *   ngOnInit() {
 *     this.registry.register('currency', {
 *       renderer: CurrencyCellComponent
 *     });
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class GridTypeRegistry {
  private readonly defaults = new Map<string, AngularTypeDefault>();

  constructor() {
    // Merge any initial defaults from provider
    const initial = inject(GRID_TYPE_DEFAULTS, { optional: true });
    if (initial) {
      for (const [type, config] of Object.entries(initial)) {
        this.defaults.set(type, config);
      }
    }
  }

  /**
   * Register type-level defaults for a custom type.
   *
   * @param type - The type name (e.g., 'country', 'currency')
   * @param defaults - Renderer/editor configuration
   */
  register<T = unknown>(type: string, defaults: AngularTypeDefault<T>): void {
    this.defaults.set(type, defaults);
  }

  /**
   * Get type defaults for a given type.
   */
  get(type: string): AngularTypeDefault | undefined {
    return this.defaults.get(type);
  }

  /**
   * Remove type defaults for a type.
   */
  unregister(type: string): void {
    this.defaults.delete(type);
  }

  /**
   * Check if a type has registered defaults.
   */
  has(type: string): boolean {
    return this.defaults.has(type);
  }

  /**
   * Get all registered type names.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.defaults.keys());
  }

  /**
   * Convert to TypeDefault for use with grid's typeDefaults.
   * This is used internally by the adapter.
   *
   * @internal
   */
  getAsTypeDefault(type: string): TypeDefault | undefined {
    const config = this.defaults.get(type);
    if (!config) return undefined;

    // Note: The actual renderer/editor functions are created by the adapter
    // when it calls getTypeDefault() - we just return the config here
    return {
      editorParams: config.editorParams,
      // renderer and editor are handled by the adapter which creates
      // the actual functions that instantiate Angular components
    };
  }
}

/**
 * Provides application-level type defaults for all grids.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { provideGridTypeDefaults } from '@toolbox-web/grid-angular';
 * import { CountryCellComponent, StatusBadgeComponent } from './components';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideGridTypeDefaults({
 *       country: { renderer: CountryCellComponent },
 *       status: { renderer: StatusBadgeComponent },
 *       date: { editor: DatePickerComponent }
 *     })
 *   ]
 * };
 * ```
 */
export function provideGridTypeDefaults(defaults: Record<string, AngularTypeDefault>): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: GRID_TYPE_DEFAULTS, useValue: defaults }]);
}
