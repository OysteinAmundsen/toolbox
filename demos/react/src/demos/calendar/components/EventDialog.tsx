import { CATEGORIES, type CalendarDay, type CalendarEvent, type CategoryId } from '@demo/shared/calendar';
import { useEffect, useRef } from 'react';

export interface EventDialogProps {
  day: CalendarDay | null;
  onCancel: () => void;
  onSubmit: (event: CalendarEvent, day: CalendarDay) => void;
}

function formatDate(day: CalendarDay): string {
  return day.date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function EventDialog({ day, onCancel, onSubmit }: EventDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (day && !dialog.open) {
      dialog.showModal();
      queueMicrotask(() => titleRef.current?.focus());
      return;
    }

    if (!day && dialog.open) {
      dialog.close();
    }
  }, [day]);

  return (
    <dialog ref={dialogRef} className="cal-event-dialog" onClose={onCancel}>
      <form
        method="dialog"
        className="cal-event-dialog__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!day) return;

          const form = new FormData(event.currentTarget);
          const newEvent: CalendarEvent = {
            id: `user-${crypto.randomUUID()}`,
            title: String(form.get('title') ?? '').trim() || 'Untitled',
            category: String(form.get('category') ?? CATEGORIES[0].id) as CategoryId,
            startTime: String(form.get('startTime') ?? '') || '09:00',
          };
          onSubmit(newEvent, day);
        }}
      >
        <h2 className="cal-event-dialog__title">{day ? `New entry — ${formatDate(day)}` : 'New entry'}</h2>
        <label className="cal-event-dialog__field">
          <span>Title</span>
          <input ref={titleRef} type="text" name="title" required placeholder="e.g. Team sync" />
        </label>
        <label className="cal-event-dialog__field">
          <span>Category</span>
          <select name="category" defaultValue={CATEGORIES[0].id}>
            {CATEGORIES.map((category: { id: CategoryId; label: string }) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cal-event-dialog__field">
          <span>Start time</span>
          <input type="time" name="startTime" required defaultValue="09:00" />
        </label>
        <div className="cal-event-dialog__actions">
          <button type="button" className="cal-header__btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="cal-header__btn cal-header__btn--primary">
            Add entry
          </button>
        </div>
      </form>
    </dialog>
  );
}
