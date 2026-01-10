import { Type } from '@angular/core';

/**
 * Global registry for Angular grid components.
 * Components register themselves at module load time.
 */
class GridComponentRegistry {
  private static renderers = new Map<string, Type<unknown>>();
  private static editors = new Map<string, Type<unknown>>();

  static registerRenderer(tagName: string, componentType: Type<unknown>): void {
    this.renderers.set(tagName.toLowerCase(), componentType);
  }

  static registerEditor(tagName: string, componentType: Type<unknown>): void {
    this.editors.set(tagName.toLowerCase(), componentType);
  }

  static getRenderer(tagName: string): Type<unknown> | undefined {
    return this.renderers.get(tagName.toLowerCase());
  }

  static getEditor(tagName: string): Type<unknown> | undefined {
    return this.editors.get(tagName.toLowerCase());
  }

  static getComponent(tagName: string): Type<unknown> | undefined {
    return this.renderers.get(tagName.toLowerCase()) ?? this.editors.get(tagName.toLowerCase());
  }

  static getAllComponents(): Map<string, Type<unknown>> {
    return new Map([...this.renderers, ...this.editors]);
  }
}

/**
 * Register an Angular component as a grid cell renderer.
 * Call this at module level (outside the class) to register on import.
 *
 * @example
 * ```typescript
 * import { Component, input } from '@angular/core';
 * import { registerGridRenderer, GridCellRenderer } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-status-badge',
 *   template: `<span [class]="'status-' + value()">{{ value() }}</span>`,
 * })
 * export class StatusBadgeComponent implements GridCellRenderer<string> {
 *   value = input.required<string>();
 *   row = input<unknown>();
 * }
 *
 * // Register at module level - runs when file is imported
 * registerGridRenderer('app-status-badge', StatusBadgeComponent);
 * ```
 */
export function registerGridRenderer(tagName: string, componentType: Type<unknown>): void {
  GridComponentRegistry.registerRenderer(tagName, componentType);
}

/**
 * Register an Angular component as a grid cell editor.
 * Call this at module level (outside the class) to register on import.
 *
 * @example
 * ```typescript
 * import { Component, input, output } from '@angular/core';
 * import { registerGridEditor, GridCellEditor } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-status-select',
 *   template: `<select [value]="value()" (change)="onChange($event)">...</select>`,
 * })
 * export class StatusSelectComponent implements GridCellEditor<string> {
 *   value = input.required<string>();
 *   commit = output<string>();
 *   cancel = output<void>();
 *
 *   onChange(e: Event) {
 *     this.commit.emit((e.target as HTMLSelectElement).value);
 *   }
 * }
 *
 * // Register at module level - runs when file is imported
 * registerGridEditor('app-status-select', StatusSelectComponent);
 * ```
 */
export function registerGridEditor(tagName: string, componentType: Type<unknown>): void {
  GridComponentRegistry.registerEditor(tagName, componentType);
}

/**
 * Get a registered component by tag name.
 * Used internally by AngularGridAdapter.
 */
export function getRegisteredComponent(tagName: string): Type<unknown> | undefined {
  return GridComponentRegistry.getComponent(tagName);
}

/**
 * Get all registered components.
 * Used internally by AngularGridAdapter.
 */
export function getAllRegisteredComponents(): Map<string, Type<unknown>> {
  return GridComponentRegistry.getAllComponents();
}
