import { Component, input } from '@angular/core';
import type { Employee } from '@demo/shared';
import type { ColumnConfig } from '@toolbox-web/grid';
import type { AngularCellRenderer } from '@toolbox-web/grid-angular';

/**
 * Status badge renderer component implementing AngularCellRenderer interface.
 * Can be used via both template syntax (*tbwRenderer) and component-class column config.
 */
@Component({
  selector: 'app-status-badge',
  template: `<span class="status-badge" [class]="badgeClass()">{{ value() }}</span>`,
  styles: [],
})
export class StatusBadgeComponent implements AngularCellRenderer<Employee, string> {
  // AngularCellRenderer interface inputs
  value = input<string>('');
  row = input<Employee>();
  column = input<ColumnConfig<Employee>>();

  badgeClass = () => {
    const v = this.value();
    return v ? `status-badge--${v.toLowerCase().replace(/\s+/g, '-')}` : '';
  };
}
