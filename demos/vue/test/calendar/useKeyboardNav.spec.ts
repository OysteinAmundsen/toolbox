import { describe, expect, test } from 'bun:test';
import { buildWeeks, generateEvents } from '@demo/shared/calendar';
import type { CalendarWeek } from '@demo/shared/calendar';
import { findDayPosition, resolveCalendarKeyAction, shiftCalendarMonth } from '../../src/demos/calendar/composables/useKeyboardNav';

function rowsFor(year: number, month: number): CalendarWeek[] {
  return buildWeeks(year, month, generateEvents(year, month).byDate);
}

describe('calendar keyboard navigation helpers', () => {
  test('findDayPosition returns the grid coordinates for an in-month day', () => {
    const rows = rowsFor(2026, 0);

    expect(findDayPosition(rows, 2026, 0, 1)).toEqual({ rowIndex: 0, colIndex: 4 });
  });

  test('shiftCalendarMonth normalizes year boundaries', () => {
    expect(shiftCalendarMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftCalendarMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  test('resolveCalendarKeyAction moves ArrowLeft from month start to previous month', () => {
    const rows = rowsFor(2026, 0);
    const focused = findDayPosition(rows, 2026, 0, 1);
    expect(focused).not.toBeNull();

    const action = resolveCalendarKeyAction({
      key: 'ArrowLeft',
      focused: { ...focused!, field: 'thu' },
      rows,
      state: { year: 2026, month: 0 },
    });

    expect(action).toEqual({ kind: 'switch-month', year: 2025, month: 11, day: 31 });
  });

  test('resolveCalendarKeyAction keeps PageDown in the same visual slot', () => {
    const rows = rowsFor(2026, 0);

    const action = resolveCalendarKeyAction({
      key: 'PageDown',
      focused: { rowIndex: 2, colIndex: 3, field: 'wed' },
      rows,
      state: { year: 2026, month: 0 },
    });

    expect(action).toEqual({ kind: 'switch-position', year: 2026, month: 1, rowIndex: 2, colIndex: 3 });
  });
});
