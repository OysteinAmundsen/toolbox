import { Directive } from '@angular/core';

/**
 * Directive that registers `<tbw-grid-type>` as a known Angular element.
 *
 * This keeps Angular template compilation happy without requiring
 * `CUSTOM_ELEMENTS_SCHEMA` and mirrors the existing `TbwGridColumn` directive.
 *
 * @category Directive
 * @since 2.0.0
 */
@Directive({
  selector: 'tbw-grid-type',
})
export class TbwGridType {}
