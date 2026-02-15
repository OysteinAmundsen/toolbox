import { Directive } from '@angular/core';

/**
 * Directive that registers `<tbw-grid-tool-buttons>` as a known Angular element.
 *
 * This directive exists so that Angular's template compiler recognises
 * `<tbw-grid-tool-buttons>` without requiring `CUSTOM_ELEMENTS_SCHEMA`.
 * The grid's shell reads toolbar buttons directly from the DOM.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { Grid, TbwGridToolButtons } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [Grid, TbwGridToolButtons],
 *   template: `
 *     <tbw-grid [rows]="rows" [gridConfig]="config">
 *       <tbw-grid-tool-buttons>
 *         <button (click)="doSomething()">Action</button>
 *       </tbw-grid-tool-buttons>
 *     </tbw-grid>
 *   `
 * })
 * export class MyComponent { }
 * ```
 */
@Directive({
  selector: 'tbw-grid-tool-buttons',
})
export class TbwGridToolButtons {}
