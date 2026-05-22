import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CalendarDay, CategoryId } from '@demo/shared/calendar';
import { CATEGORIES } from '@demo/shared/calendar';

const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category.label]),
) as Record<CategoryId, string>;

@Component({
  selector: 'app-calendar-day-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="cal-cell"
      [class.cal-cell--out-of-month]="!day().inMonth"
      [class.cal-cell--today]="isToday()"
    >
      <div class="cal-cell__date">{{ day().date.getDate() }}</div>
      <div class="cal-cell__events">
        <ul class="cal-cell__list">
          @for (event of day().events; track event.id) {
            <li
              class="cal-event cal-event--{{ event.category }}"
              [title]="event.startTime + ' — ' + event.title + ' (' + categoryLabel(event.category) + ')'"
            >
              <span class="cal-event__time">{{ event.startTime }}</span>
              <span class="cal-event__title">{{ event.title }}</span>
            </li>
          }
        </ul>
        <div class="cal-cell__dots">
          @for (event of dotEvents(); track event.id) {
            <span
              class="cal-dot cal-dot--{{ event.category }}"
              [title]="event.startTime + ' — ' + event.title"
            ></span>
          }
          @if (moreCount() > 0) {
            <span class="cal-dot__more">+{{ moreCount() }}</span>
          }
        </div>
      </div>
    </div>
  `,
})
export class DayCellComponent {
  day = input.required<CalendarDay>();

  dotEvents = computed(() => this.day().events.slice(0, 6));
  moreCount = computed(() => Math.max(this.day().events.length - 6, 0));

  isToday(): boolean {
    const date = this.day().date;
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  categoryLabel(category: CategoryId): string {
    return CATEGORY_LABEL[category];
  }
}
