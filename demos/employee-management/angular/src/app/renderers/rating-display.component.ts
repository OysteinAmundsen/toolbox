import { Component, computed, input } from '@angular/core';
import type { Employee } from '@demo/shared';
import type { ColumnConfig } from '@toolbox-web/grid';
import type { AngularCellRenderer } from '@toolbox-web/grid-angular';

/**
 * Rating display renderer implementing AngularCellRenderer interface.
 * Can be used via template syntax (*tbwRenderer) or component-class column config.
 */
@Component({
  selector: 'app-rating-display',
  template: `<span class="rating-display" [class]="levelClass()">{{ displayValue() }} ★</span>`,
  styles: [],
})
export class RatingDisplayComponent implements AngularCellRenderer<Employee, number> {
  // AngularCellRenderer interface inputs
  value = input<number>(0);
  row = input<Employee>();
  column = input<ColumnConfig<Employee>>();

  displayValue = computed(() => (this.value() ?? 0).toFixed(1));

  levelClass = computed(() => {
    const v = this.value() ?? 0;
    const level = v >= 4.5 ? 'high' : v >= 3.5 ? 'medium' : 'low';
    return `rating-display--${level}`;
  });
}
