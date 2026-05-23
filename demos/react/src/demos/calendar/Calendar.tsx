import '@toolbox-web/grid-react/features/pinned-rows';
import './Calendar.css';

import type { CalendarDay, CalendarEvent, CalendarWeek, WeekdayField } from '@demo/shared/calendar';
import {
  buildWeeks,
  generateEvents,
  isoKey,
  WEEKDAY_FIELDS,
  WEEKDAY_HEADERS,
  WEEKDAY_HEADERS_FULL,
  WEEKDAY_HEADERS_MINI,
} from '@demo/shared/calendar';
import { DataGrid, useGrid, type GridConfig } from '@toolbox-web/grid-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { DayCell } from './components/DayCell';
import { EventDialog } from './components/EventDialog';
import { HeaderNav } from './components/HeaderNav';
import { Legend } from './components/Legend';
import { ToolbarNav } from './components/ToolbarNav';
import { useDoubleClick } from './hooks/useDoubleClick';
import { useDynamicRowHeight } from './hooks/useDynamicRowHeight';
import { useGridCallbackRoot } from './hooks/useGridCallbackRoot';
import { findDayPosition, useKeyboardNav, type PendingFocus } from './hooks/useKeyboardNav';

const DEFAULT_ROW_HEIGHT_PX = 110;

type UserEvents = Record<string, CalendarEvent[]>;

interface CalendarState {
  year: number;
  month: number;
  userEvents: UserEvents;
}

type CalendarAction =
  | { type: 'set-view'; year: number; month: number }
  | { type: 'shift-month'; delta: number }
  | { type: 'today' }
  | { type: 'set-year'; year: number }
  | { type: 'add-event'; day: CalendarDay; event: CalendarEvent };

function initialState(): CalendarState {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth(), userEvents: {} };
}

function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  switch (action.type) {
    case 'set-view':
      return { ...state, year: action.year, month: action.month };
    case 'shift-month': {
      const next = new Date(state.year, state.month + action.delta, 1);
      return { ...state, year: next.getFullYear(), month: next.getMonth() };
    }
    case 'today': {
      const today = new Date();
      return { ...state, year: today.getFullYear(), month: today.getMonth() };
    }
    case 'set-year':
      return { ...state, year: action.year };
    case 'add-event': {
      const key = isoKey(action.day.date);
      const existing = state.userEvents[key] ?? [];
      const nextEvents = [...existing, action.event].sort((a, b) => a.startTime.localeCompare(b.startTime));
      return { ...state, userEvents: { ...state.userEvents, [key]: nextEvents } };
    }
  }
}

function makeRows(state: CalendarState): CalendarWeek[] {
  const generated = generateEvents(state.year, state.month);
  const byDate = new Map(generated.byDate);

  for (const [key, events] of Object.entries(state.userEvents) as [string, CalendarEvent[]][]) {
    const existing = (byDate.get(key) ?? []) as CalendarEvent[];
    const merged = [...existing, ...events].sort((a: CalendarEvent, b: CalendarEvent) =>
      a.startTime.localeCompare(b.startTime),
    );
    byDate.set(key, merged);
  }

  return buildWeeks(state.year, state.month, byDate);
}

function WeekdayHeader({ field }: { field: WeekdayField }) {
  return (
    <span className="cal-wday">
      <span className="cal-wday__full">{WEEKDAY_HEADERS_FULL[field]}</span>
      <span className="cal-wday__short">{WEEKDAY_HEADERS[field]}</span>
      <span className="cal-wday__mini">{WEEKDAY_HEADERS_MINI[field]}</span>
    </span>
  );
}

function resolveDayFromCell(rows: readonly CalendarWeek[], cell: HTMLElement): CalendarDay | null {
  const colIndex = Number(cell.getAttribute('data-col'));
  if (!Number.isFinite(colIndex) || colIndex <= 0) return null;

  const row = cell.closest<HTMLElement>('.data-grid-row');
  const ariaRowIndex = Number(row?.getAttribute('aria-rowindex'));
  if (!Number.isFinite(ariaRowIndex)) return null;

  const week = rows[ariaRowIndex - 2];
  const field = WEEKDAY_FIELDS[colIndex - 1];
  return field && week ? week[field] : null;
}

export function Calendar() {
  const [state, dispatch] = useReducer(calendarReducer, undefined, initialState);
  const [dialogDay, setDialogDay] = useState<CalendarDay | null>(null);
  const grid = useGrid<CalendarWeek>();
  const callbackRoot = useGridCallbackRoot();
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  // Cache the legend container so the pinned-rows plugin can short-circuit
  // DOM mutation across grid renders (fresh element each call = unmount loop).
  const legendElementRef = useRef<HTMLElement | null>(null);

  const rows = useMemo(() => makeRows(state), [state]);

  const setView = useCallback((year: number, month: number, focus?: PendingFocus) => {
    pendingFocusRef.current = focus ?? null;
    dispatch({ type: 'set-view', year, month });
  }, []);

  const gridConfig = useMemo<GridConfig<CalendarWeek>>(
    () => ({
      fitMode: 'stretch',
      shell: { header: { toolPanelToggle: false } },
      rowHeight: DEFAULT_ROW_HEIGHT_PX,
      features: {
        pinnedRows: {
          slots: [
            {
              id: 'calendar-legend',
              position: 'bottom',
              render: () => {
                if (!legendElementRef.current) {
                  legendElementRef.current = callbackRoot.renderElement(<Legend />);
                }
                return legendElementRef.current;
              },
            },
          ],
        },
      },
      columns: [
        {
          field: 'weekNumber',
          header: 'W',
          width: 44,
          sortable: false,
          resizable: false,
          cellClass: () => 'cal-week-cell',
        },
        ...WEEKDAY_FIELDS.map((field: WeekdayField) => ({
          field,
          header: WEEKDAY_HEADERS_FULL[field],
          headerLabelRenderer: () => <WeekdayHeader field={field} />,
          minWidth: 60,
          sortable: false,
          resizable: false,
          renderer: (ctx: { value: CalendarDay }) => <DayCell day={ctx.value} />,
        })),
      ],
    }),
    [callbackRoot],
  );

  useEffect(() => {
    if (!grid.isReady) return;
    const gridElement = grid.ref.current?.element;
    if (!gridElement) return;

    gridElement.registerHeaderContent?.({
      id: 'calendar-nav',
      order: 0,
      render: (container: HTMLElement) =>
        callbackRoot.renderInto(
          container,
          <HeaderNav
            year={state.year}
            month={state.month}
            onYearChange={(year) => dispatch({ type: 'set-year', year })}
          />,
        ),
    });
    gridElement.registerToolbarContent?.({
      id: 'calendar-nav-buttons',
      order: 0,
      render: (container: HTMLElement) =>
        callbackRoot.renderInto(
          container,
          <ToolbarNav
            onPrevious={() => dispatch({ type: 'shift-month', delta: -1 })}
            onToday={() => {
              const today = new Date();
              pendingFocusRef.current = { day: today.getDate() };
              dispatch({ type: 'today' });
            }}
            onNext={() => dispatch({ type: 'shift-month', delta: 1 })}
          />,
        ),
    });
    gridElement.refreshShellHeader?.();

    return () => {
      gridElement.unregisterHeaderContent?.('calendar-nav');
      gridElement.unregisterToolbarContent?.('calendar-nav-buttons');
    };
  }, [callbackRoot, grid.isReady, grid.ref, state.month, state.year]);

  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target || !grid.isReady) return;
    const gridElement = grid.ref.current?.element;
    if (!gridElement) return;

    const position =
      'day' in target
        ? findDayPosition(rows, state.year, state.month, target.day)
        : {
            rowIndex: Math.min(target.position.rowIndex, Math.max(rows.length - 1, 0)),
            colIndex: target.position.colIndex,
          };
    pendingFocusRef.current = null;
    if (position) queueMicrotask(() => gridElement.focusCell?.(position.rowIndex, position.colIndex));
  }, [grid.isReady, grid.ref, rows, state.month, state.year]);

  const openDialog = useCallback((day: CalendarDay) => setDialogDay(day), []);

  useKeyboardNav({ gridRef: grid.ref, enabled: grid.isReady, rows, view: state, setView, openDialog });
  useDynamicRowHeight(grid.ref, grid.isReady, rows.length, gridConfig);
  useDoubleClick(
    grid.ref,
    grid.isReady,
    useCallback(
      (cell) => {
        const day = resolveDayFromCell(rows, cell);
        if (day) setDialogDay(day);
      },
      [rows],
    ),
  );

  return (
    <div id="app">
      <div className="demo-container">
        <div className="calendar-demo">
          <DataGrid ref={grid.ref} rows={rows} gridConfig={gridConfig} className="calendar-demo__grid" />
          <EventDialog
            day={dialogDay}
            onCancel={() => setDialogDay(null)}
            onSubmit={(event, day) => {
              const focused = grid.ref.current?.element?.focusedCell;
              pendingFocusRef.current = focused
                ? { position: { rowIndex: focused.rowIndex, colIndex: focused.colIndex } }
                : { day: day.date.getDate() };
              dispatch({ type: 'add-event', event, day });
              setDialogDay(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
