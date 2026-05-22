import type { DataGridElement } from '@toolbox-web/grid';
import type { CalendarDay, CalendarWeek, WeekdayField } from '@demo/shared/calendar';
import { WEEKDAY_FIELDS } from '@demo/shared/calendar';

export interface CalendarViewState {
  year: number;
  month: number;
}

export interface FocusedCalendarCell {
  rowIndex: number;
  colIndex: number;
  field: string;
}

export type CalendarKeyAction =
  | { kind: 'focus'; rowIndex: number; colIndex: number }
  | { kind: 'switch-month'; year: number; month: number; day: number }
  | { kind: 'switch-position'; year: number; month: number; rowIndex: number; colIndex: number }
  | { kind: 'none' };

const ARROW_DAY_DELTA: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export function shiftCalendarMonth(state: CalendarViewState, delta: number): CalendarViewState {
  const d = new Date(state.year, state.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function findDayPosition(
  rows: readonly CalendarWeek[],
  year: number,
  month: number,
  dayOfMonth: number,
): { rowIndex: number; colIndex: number } | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    for (let i = 0; i < WEEKDAY_FIELDS.length; i++) {
      const day = row[WEEKDAY_FIELDS[i]];
      if (
        day.inMonth &&
        day.date.getFullYear() === year &&
        day.date.getMonth() === month &&
        day.date.getDate() === dayOfMonth
      ) {
        return { rowIndex, colIndex: i + 1 };
      }
    }
  }
  return null;
}

export function resolveCalendarKeyAction(options: {
  key: string;
  focused: FocusedCalendarCell | null;
  rows: readonly CalendarWeek[];
  state: CalendarViewState;
}): CalendarKeyAction {
  const { key, focused, rows, state } = options;
  if (!focused || focused.field === 'weekNumber') return { kind: 'none' };

  const week = rows[focused.rowIndex];
  if (!week) return { kind: 'none' };
  const day = week[focused.field as WeekdayField] as CalendarDay | undefined;
  if (!day) return { kind: 'none' };

  if (key === 'PageUp' || key === 'PageDown') {
    const next = shiftCalendarMonth(state, key === 'PageUp' ? -1 : 1);
    return { kind: 'switch-position', ...next, rowIndex: focused.rowIndex, colIndex: focused.colIndex };
  }

  const delta = ARROW_DAY_DELTA[key];
  if (delta === undefined) return { kind: 'none' };

  const target = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() + delta);
  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth();
  const targetDay = target.getDate();

  if (targetYear === state.year && targetMonth === state.month) {
    const pos = findDayPosition(rows, targetYear, targetMonth, targetDay);
    return pos ? { kind: 'focus', ...pos } : { kind: 'none' };
  }

  return { kind: 'switch-month', year: targetYear, month: targetMonth, day: targetDay };
}

export function useKeyboardNav(options: {
  grid: DataGridElement<CalendarWeek>;
  getRows: () => readonly CalendarWeek[];
  getState: () => CalendarViewState;
  setState: (state: CalendarViewState) => void;
  rerender: (focusTarget?: { day: number } | { position: { rowIndex: number; colIndex: number } }) => void;
  openDialog: (day: CalendarDay) => void;
}): () => void {
  const onKeydown: EventListener = (event): void => {
    const ev = event as KeyboardEvent;
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;

    const focused = options.grid.focusedCell ?? null;
    if (ev.key === 'Enter') {
      if (focused && focused.field !== 'weekNumber') {
        const week = options.getRows()[focused.rowIndex];
        const day = week?.[focused.field as WeekdayField] as CalendarDay | undefined;
        if (day) {
          ev.preventDefault();
          ev.stopPropagation();
          options.openDialog(day);
        }
      }
      return;
    }

    const action = resolveCalendarKeyAction({
      key: ev.key,
      focused,
      rows: options.getRows(),
      state: options.getState(),
    });
    if (action.kind === 'none') return;

    ev.preventDefault();
    ev.stopPropagation();

    if (action.kind === 'focus') {
      options.grid.focusCell?.(action.rowIndex, action.colIndex);
      return;
    }

    options.setState({ year: action.year, month: action.month });
    if (action.kind === 'switch-month') {
      options.rerender({ day: action.day });
    } else {
      options.rerender({ position: { rowIndex: action.rowIndex, colIndex: action.colIndex } });
    }
  };

  options.grid.addEventListener('keydown', onKeydown, true);
  return () => options.grid.removeEventListener('keydown', onKeydown, true);
}
