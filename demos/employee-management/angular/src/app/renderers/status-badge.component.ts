import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `<span class="status-badge" [class]="badgeClass()">{{ value() }}</span>`,
  styles: [],
})
export class StatusBadgeComponent {
  value = input<string>('');

  badgeClass = () => {
    const v = this.value();
    return v ? `status-badge--${v.toLowerCase().replace(/\s+/g, '-')}` : '';
  };
}
