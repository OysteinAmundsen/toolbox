import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CATEGORIES } from '@demo/shared/calendar';

@Component({
  selector: 'app-calendar-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cal-legend">
      @for (category of categories; track category.id) {
        <span class="cal-legend__item">
          <span
            class="cal-legend__swatch"
            [style.background]="'var(--cal-cat-' + category.id + ')'"
          ></span>
          <span>{{ category.label }}</span>
        </span>
      }
    </div>
  `,
})
export class LegendComponent {
  readonly categories = CATEGORIES;
}
