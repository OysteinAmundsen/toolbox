import { Component, input } from '@angular/core';
import type { Employee } from '@demo/shared';
import type { ColumnConfig } from '@toolbox-web/grid';
import type { CellRenderer } from '@toolbox-web/grid-angular';

/**
 * Status badge renderer component implementing CellRenderer interface.
 * Can be used via both template syntax (*tbwRenderer) and component-class column config.
 */
@Component({
  selector: 'app-status-badge',
  template: `<span class="status-badge" [class]="badgeClass()">{{ value() }}</span>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class StatusBadgeComponent implements CellRenderer<Employee, string> {
  // CellRenderer interface inputs
  value = input<string>('');
  row = input<Employee>();
  column = input<ColumnConfig<Employee>>();

  badgeClass = () => {
    const v = this.value();
    return v ? `status-badge--${v.toLowerCase().replace(/\s+/g, '-')}` : '';
  };
}
