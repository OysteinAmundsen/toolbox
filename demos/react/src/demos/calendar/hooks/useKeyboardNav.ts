import { useEffect, useRef } from 'react';
import type { DataGridRef } from '@toolbox-web/grid-react';
import { WEEKDAY_FIELDS, type CalendarDay, type CalendarWeek } from '@demo/shared/calendar';

const ARROW_DAY_DELTA: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export interface CalendarViewState {
  year: number;
  month: number;
}

export type PendingFocus = { day: number } | { position: { rowIndex: number; colIndex: number } };

export interface KeyboardNavOptions {
  gridRef: React.RefObject<DataGridRef<CalendarWeek> | null>;
  enabled: boolean;
  rows: CalendarWeek[];
  view: CalendarViewState;
  setView: (year: number, month: number, focus?: PendingFocus) => void;
  openDialog: (day: CalendarDay) => void;
}

export function findDayPosition(
  rows: readonly CalendarWeek[],
  year: number,
  month: number,
  dayOfMonth: number,
): { rowIndex: number; colIndex: number } | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    for (let index = 0; index < WEEKDAY_FIELDS.length; index++) {
      const day = rows[rowIndex][WEEKDAY_FIELDS[index]];
      if (day.inMonth && day.date.getFullYear() === year && day.date.getMonth() === month && day.date.getDate() === dayOfMonth) {
        return { rowIndex, colIndex: index + 1 };
      }
    }
  }
  return null;
}

export function useKeyboardNav({ gridRef, enabled, rows, view, setView, openDialog }: KeyboardNavOptions): void {
  const rowsRef = useRef(rows);
  const viewRef = useRef(view);
  const openDialogRef = useRef(openDialog);
  rowsRef.current = rows;
  viewRef.current = view;
  openDialogRef.current = openDialog;

  useEffect(() => {
    if (!enabled) return;
    const grid = gridRef.current?.element;
    if (!grid) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const focused = grid.focusedCell;
      if (!focused || focused.field === 'weekNumber') return;
      const week = rowsRef.current[focused.rowIndex];
      const day = week?.[focused.field as (typeof WEEKDAY_FIELDS)[number]];
      if (!day) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        openDialogRef.current(day);
        return;
      }

      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === 'PageUp' ? -1 : 1;
        const next = new Date(viewRef.current.year, viewRef.current.month + delta, 1);
        setView(next.getFullYear(), next.getMonth(), { position: { rowIndex: focused.rowIndex, colIndex: focused.colIndex } });
        return;
      }

      const delta = ARROW_DAY_DELTA[event.key];
      if (delta === undefined) return;

      event.preventDefault();
      event.stopPropagation();
      const target = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() + delta);
      const targetYear = target.getFullYear();
      const targetMonth = target.getMonth();
      const targetDay = target.getDate();

      if (targetYear === viewRef.current.year && targetMonth === viewRef.current.month) {
        const pos = findDayPosition(rowsRef.current, targetYear, targetMonth, targetDay);
        if (pos) grid.focusCell?.(pos.rowIndex, pos.colIndex);
        return;
      }

      setView(targetYear, targetMonth, { day: targetDay });
    };

    grid.addEventListener('keydown', onKeyDown, true);
    return () => grid.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, gridRef, setView]);
}
