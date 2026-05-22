import { CATEGORIES, type CalendarDay, type CalendarEvent, type CategoryId } from '@demo/shared/calendar';

const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((category: { id: CategoryId; label: string }) => [category.id, category.label]),
) as Record<CategoryId, string>;

let todayYmd = computeToday();
let todayComputedAt = Date.now();

function computeToday(): { year: number; month: number; day: number } {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
}

function isToday(date: Date): boolean {
  if (Date.now() - todayComputedAt > 60_000) {
    todayYmd = computeToday();
    todayComputedAt = Date.now();
  }

  return date.getFullYear() === todayYmd.year && date.getMonth() === todayYmd.month && date.getDate() === todayYmd.day;
}

export interface DayCellProps {
  day: CalendarDay;
}

export function DayCell({ day }: DayCellProps) {
  const classes = ['cal-cell'];
  if (!day.inMonth) classes.push('cal-cell--out-of-month');
  if (isToday(day.date)) classes.push('cal-cell--today');

  const visibleDots = day.events.slice(0, 6);
  const hiddenCount = day.events.length - visibleDots.length;

  return (
    <div className={classes.join(' ')}>
      <div className="cal-cell__date">{day.date.getDate()}</div>
      <div className="cal-cell__events">
        <ul className="cal-cell__list">
          {day.events.map((event: CalendarEvent) => (
            <li
              key={event.id}
              className={`cal-event cal-event--${event.category}`}
              title={`${event.startTime} — ${event.title} (${CATEGORY_LABEL[event.category]})`}
            >
              <span className="cal-event__time">{event.startTime}</span>
              <span className="cal-event__title">{event.title}</span>
            </li>
          ))}
        </ul>
        <div className="cal-cell__dots">
          {visibleDots.map((event: CalendarEvent) => (
            <span key={event.id} className={`cal-dot cal-dot--${event.category}`} title={`${event.startTime} — ${event.title}`} />
          ))}
          {hiddenCount > 0 && <span className="cal-dot__more">+{hiddenCount}</span>}
        </div>
      </div>
    </div>
  );
}
