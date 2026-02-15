import { Directive } from '@angular/core';

/**
 * Directive that registers `<tbw-grid-header>` as a known Angular element.
 *
 * This directive exists so that Angular's template compiler recognises
 * `<tbw-grid-header>` without requiring `CUSTOM_ELEMENTS_SCHEMA`.
 * The grid's `config-manager` reads attributes like `title` directly
 * from the DOM element.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { Grid, TbwGridHeader } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [Grid, TbwGridHeader],
 *   template: `
 *     <tbw-grid [rows]="rows" [gridConfig]="config">
 *       <tbw-grid-header title="My Grid Title"></tbw-grid-header>
 *     </tbw-grid>
 *   `
 * })
 * export class MyComponent { }
 * ```
 */
@Directive({
  selector: 'tbw-grid-header',
})
export class TbwGridHeader {}
