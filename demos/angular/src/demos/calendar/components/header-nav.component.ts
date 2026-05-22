import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-calendar-header-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `display: contents` removes this wrapper from the layout tree so its
  // children become direct flex items of the parent `.cal-header` (matching
  // vanilla / Vue, where the same elements sit at the top level and inherit
  // the parent's gap).
  host: { style: 'display: contents' },
  template: `
    <span class="cal-header__title">{{ monthLabel }}</span>
    <select
      class="cal-header__year"
      aria-label="Year"
      (change)="onYearSelect($event)"
    >
      @for (option of yearOptions; track option) {
        <option [value]="option" [selected]="option === year">{{ option }}</option>
      }
    </select>
  `,
})
export class HeaderNavComponent {
  @Input({ required: true }) monthLabel = '';
  @Input({ required: true }) year = new Date().getFullYear();
  @Input({ required: true }) yearOptions: readonly number[] = [];

  @Output() yearChange = new EventEmitter<number>();

  onYearSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.yearChange.emit(Number(select.value));
  }
}
