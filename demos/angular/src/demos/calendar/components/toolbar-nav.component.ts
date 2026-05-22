import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-calendar-toolbar-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `display: contents` removes this wrapper from the layout tree so its
  // buttons become direct flex items of the parent toolbar (matching
  // vanilla / Vue, where the same buttons sit at the top level and inherit
  // the parent's gap).
  host: { style: 'display: contents' },
  template: `
    <button
      type="button"
      class="cal-header__btn"
      title="Previous month"
      aria-label="Previous month"
      (click)="previous.emit()"
    >
      ‹
    </button>
    <button
      type="button"
      class="cal-header__btn"
      title="Jump to current month"
      aria-label="Jump to current month"
      (click)="today.emit()"
    >
      Today
    </button>
    <button
      type="button"
      class="cal-header__btn"
      title="Next month"
      aria-label="Next month"
      (click)="next.emit()"
    >
      ›
    </button>
  `,
})
export class ToolbarNavComponent {
  @Output() previous = new EventEmitter<void>();
  @Output() today = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
}
