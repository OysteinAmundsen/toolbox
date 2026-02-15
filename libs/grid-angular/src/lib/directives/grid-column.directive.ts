import { Directive } from '@angular/core';

/**
 * Directive that registers `<tbw-grid-column>` as a known Angular element.
 *
 * This directive exists so that Angular's template compiler recognises
 * `<tbw-grid-column>` without requiring `CUSTOM_ELEMENTS_SCHEMA`.
 * The underlying web component reads its attributes (`field`, `header`,
 * `type`, `width`, etc.) directly from the DOM, so no `@Input()` forwarding
 * is needed — Angular's standard property/attribute binding handles it.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { Grid, TbwGridColumn, TbwRenderer } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [Grid, TbwGridColumn, TbwRenderer],
 *   template: `
 *     <tbw-grid [rows]="rows" [gridConfig]="config">
 *       <tbw-grid-column field="status">
 *         <app-status-badge *tbwRenderer="let value" [value]="value" />
 *       </tbw-grid-column>
 *     </tbw-grid>
 *   `
 * })
 * export class MyComponent { }
 * ```
 */
@Directive({
  selector: 'tbw-grid-column',
})
export class TbwGridColumn {}
