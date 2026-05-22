import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    inject,
    Output,
    ViewChild,
} from '@angular/core';
import type { CalendarDay, CalendarEvent } from '@demo/shared/calendar';
import { CATEGORIES } from '@demo/shared/calendar';

@Component({
  selector: 'app-calendar-event-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="cal-event-dialog">
      <form method="dialog" class="cal-event-dialog__form" (submit)="submit($event)">
        <h2 class="cal-event-dialog__title">{{ title }}</h2>

        <label class="cal-event-dialog__field">
          <span>Title</span>
          <input
            #titleInput
            type="text"
            name="title"
            required
            placeholder="e.g. Team sync"
          />
        </label>

        <label class="cal-event-dialog__field">
          <span>Category</span>
          <select #categorySelect name="category">
            @for (category of categories; track category.id) {
              <option [value]="category.id">{{ category.label }}</option>
            }
          </select>
        </label>

        <label class="cal-event-dialog__field">
          <span>Start time</span>
          <input #timeInput type="time" name="startTime" required value="09:00" />
        </label>

        <div class="cal-event-dialog__actions">
          <button type="button" class="cal-header__btn" (click)="close()">Cancel</button>
          <button type="submit" class="cal-header__btn cal-header__btn--primary">Add entry</button>
        </div>
      </form>
    </dialog>
  `,
})
export class EventDialogComponent {
  @ViewChild('dialog', { static: true }) private dialogRef!: ElementRef<HTMLDialogElement>;
  @ViewChild('titleInput', { static: true }) private titleInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('categorySelect', { static: true }) private categorySelectRef!: ElementRef<HTMLSelectElement>;
  @ViewChild('timeInput', { static: true }) private timeInputRef!: ElementRef<HTMLInputElement>;

  @Output() createEvent = new EventEmitter<{ event: CalendarEvent; day: CalendarDay }>();

  readonly categories = CATEGORIES;
  title = 'New entry';

  private changeDetectorRef = inject(ChangeDetectorRef);
  private currentDay: CalendarDay | null = null;

  open(day: CalendarDay): void {
    this.currentDay = day;
    this.title = `New entry — ${day.date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`;
    this.titleInputRef.nativeElement.value = '';
    this.categorySelectRef.nativeElement.value = CATEGORIES[0].id;
    this.timeInputRef.nativeElement.value = '09:00';
    this.changeDetectorRef.detectChanges();
    this.dialogRef.nativeElement.showModal();
    queueMicrotask(() => this.titleInputRef.nativeElement.focus());
  }

  close(): void {
    this.dialogRef.nativeElement.close();
  }

  submit(event: Event): void {
    event.preventDefault();
    const day = this.currentDay;
    if (!day) {
      this.close();
      return;
    }

    const newEvent: CalendarEvent = {
      id: `user-${crypto.randomUUID()}`,
      title: this.titleInputRef.nativeElement.value.trim() || 'Untitled',
      category: this.categorySelectRef.nativeElement.value as CalendarEvent['category'],
      startTime: this.timeInputRef.nativeElement.value || '09:00',
    };

    this.close();
    this.createEvent.emit({ event: newEvent, day });
  }
}
