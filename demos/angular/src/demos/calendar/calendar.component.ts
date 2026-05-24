import '@toolbox-web/grid-angular/features/pinned-rows';

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
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
import type { ColumnConfig, DataGridElement } from '@toolbox-web/grid';
import {
  Grid,
  GridHeaderContent,
  GridToolbarContent,
  TbwGridColumn,
  TbwRenderer,
  type GridConfig,
} from '@toolbox-web/grid-angular';
import { DayCellComponent } from './components/day-cell.component';
import { EventDialogComponent } from './components/event-dialog.component';
import { HeaderNavComponent } from './components/header-nav.component';
import { LegendComponent } from './components/legend.component';
import { ToolbarNavComponent } from './components/toolbar-nav.component';
import { MountIntoContainer, type MountedComponent } from './services/mount-into-container';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// Density tiers (full / compact / minimal) are driven purely by CSS
// `@container calendar (...)` queries in `demo-styles.css` — no JS
// width observer is needed.
const DEFAULT_ROW_HEIGHT_PX = 110;
const YEAR_RANGE = 5;
const DBLCLICK_MS = 400;

const ARROW_DAY_DELTA: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

type CalendarGridElement = DataGridElement<CalendarWeek>;
type FocusTarget = { day: number } | { position: { rowIndex: number; colIndex: number } };

@Component({
  selector: 'app-calendar',
  imports: [
    Grid,
    GridHeaderContent,
    GridToolbarContent,
    TbwGridColumn,
    TbwRenderer,
    DayCellComponent,
    EventDialogComponent,
    HeaderNavComponent,
    ToolbarNavComponent,
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class CalendarComponent implements AfterViewInit, OnDestroy {
  @ViewChild('calendarGrid', { static: true }) private gridRef!: ElementRef<CalendarGridElement>;
  @ViewChild(EventDialogComponent, { static: true }) private eventDialog!: EventDialogComponent;

  readonly weekdayFields = WEEKDAY_FIELDS;
  readonly yearOptions = buildYearOptions();

  private mountIntoContainer = inject(MountIntoContainer);
  private today = new Date();
  private yearSignal = signal(this.today.getFullYear());
  private monthSignal = signal(this.today.getMonth());
  private userEvents = signal<ReadonlyMap<string, CalendarEvent[]>>(new Map());
  private rowHeight = signal(DEFAULT_ROW_HEIGHT_PX);
  private mountedShellComponents: Array<MountedComponent<unknown>> = [];
  private heightObserver: ResizeObserver | null = null;
  private lastViewportHeight = 0;
  private lastMousedownCell: HTMLElement | null = null;
  private lastMousedownTime = 0;

  /** Exposed for the template-driven `<tbw-grid-header-content>` binding. */
  readonly year = this.yearSignal.asReadonly();
  /** Exposed for the template-driven `<tbw-grid-header-content>` binding. */
  readonly monthLabel = computed(() => MONTH_NAMES[this.monthSignal()]);

  readonly rows = computed(() => makeRows(this.year(), this.monthSignal(), this.userEvents()));

  readonly gridConfig = computed<GridConfig<CalendarWeek>>(() => ({
    fitMode: 'stretch',
    shell: { header: { toolPanelToggle: false } },
    rowHeight: this.rowHeight(),
    features: {
      pinnedRows: {
        slots: [
          {
            id: 'calendar-legend',
            position: 'bottom',
            render: () => this.renderLegend(),
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
      ...this.weekdayFields.map((field) => this.createWeekdayColumn(field)),
    ],
  }));

  ngAfterViewInit(): void {
    const grid = this.gridRef.nativeElement;
    grid.ready?.().then(() => {
      grid.refreshShellHeader?.();
      const viewport = grid.querySelector<HTMLElement>('.rows-viewport');
      if (viewport) {
        this.lastViewportHeight = viewport.clientHeight;
        this.applyRowHeight(grid);
        this.heightObserver?.observe(viewport);
      }
    });

    this.installKeyboardNavigation(grid);
    this.installMousedownPairDetection(grid);
    this.installResizeObserver(grid);
  }

  ngOnDestroy(): void {
    const grid = this.gridRef.nativeElement;
    this.heightObserver?.disconnect();
    grid.removeEventListener('keydown', this.onKeydown, true);
    grid.removeEventListener('mousedown', this.onMousedown, true);
    this.mountedShellComponents.forEach((mounted) => mounted.destroy());
  }

  addEvent(event: CalendarEvent, day: CalendarDay): void {
    const key = isoKey(day.date);
    const next = new Map(this.userEvents());
    const bucket = next.get(key);
    const merged = bucket ? [...bucket, event] : [event];
    merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
    next.set(key, merged);
    this.userEvents.set(next);

    const focused = this.gridRef.nativeElement.focusedCell;
    this.rerender(
      focused
        ? { position: { rowIndex: focused.rowIndex, colIndex: focused.colIndex } }
        : { day: day.date.getDate() },
    );
  }

  private createWeekdayColumn(field: WeekdayField): ColumnConfig<CalendarWeek> {
    return {
      field,
      header: WEEKDAY_HEADERS_FULL[field],
      headerLabelRenderer: () => renderWeekdayHeader(field),
      minWidth: 60,
      sortable: false,
      resizable: false,
    };
  }

  /** Handler for the header-nav `<select>` year picker (template binding). */
  onYearChange(year: number): void {
    this.yearSignal.set(year);
    this.rerender();
  }

  /** Handler for the toolbar-nav previous button (template binding). */
  onPrevious(): void {
    this.shiftMonth(-1);
  }

  /** Handler for the toolbar-nav today button (template binding). */
  onToday(): void {
    this.goToday();
  }

  /** Handler for the toolbar-nav next button (template binding). */
  onNext(): void {
    this.shiftMonth(1);
  }

  private legendContainer: HTMLElement | null = null;

  private renderLegend(): HTMLElement {
    // Cache the container + mounted component so the grid's pinned-rows plugin
    // can short-circuit DOM mutation on subsequent renders. Creating a fresh
    // element every call triggered an unmount/remount loop with ResizeObserver.
    if (this.legendContainer) return this.legendContainer;
    const container = document.createElement('div');
    const mounted = this.mountIntoContainer.mount(container, LegendComponent);
    this.mountedShellComponents.push(mounted);
    this.legendContainer = container;
    return container;
  }

  private shiftMonth(delta: number, focusTarget?: FocusTarget): void {
    const date = new Date(this.year(), this.monthSignal() + delta, 1);
    this.yearSignal.set(date.getFullYear());
    this.monthSignal.set(date.getMonth());
    this.rerender(focusTarget);
  }

  private goToday(): void {
    const today = new Date();
    this.yearSignal.set(today.getFullYear());
    this.monthSignal.set(today.getMonth());
    this.rerender({ day: today.getDate() });
  }

  private rerender(focusTarget?: FocusTarget): void {
    const grid = this.gridRef.nativeElement;
    // Header re-renders automatically via signal-bound template inputs
    // (monthLabel / year) on <app-calendar-header-nav>.
    this.applyRowHeight(grid);

    if (!focusTarget) return;
    const rows = this.rows();
    let position: { rowIndex: number; colIndex: number } | null = null;
    if ('day' in focusTarget) {
      position = findDayPosition(rows, this.year(), this.monthSignal(), focusTarget.day);
    } else {
      position = {
        rowIndex: Math.min(focusTarget.position.rowIndex, Math.max(rows.length - 1, 0)),
        colIndex: focusTarget.position.colIndex,
      };
    }

    if (position) {
      const target = position;
      queueMicrotask(() => grid.focusCell?.(target.rowIndex, target.colIndex));
    }
  }

  private installKeyboardNavigation(grid: CalendarGridElement): void {
    grid.addEventListener('keydown', this.onKeydown, true);
  }

  private readonly onKeydown: EventListener = (event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (
      event.key === 'Enter' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      const focused = this.gridRef.nativeElement.focusedCell;
      if (focused && focused.field !== 'weekNumber') {
        const day = this.rows()[focused.rowIndex]?.[focused.field as WeekdayField];
        if (day) {
          event.preventDefault();
          event.stopPropagation();
          this.eventDialog.open(day);
          return;
        }
      }
    }
    this.handleDateKeydown(event);
  };

  private handleDateKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const grid = this.gridRef.nativeElement;
    const focused = grid.focusedCell;
    if (!focused || focused.field === 'weekNumber') return;

    const week = this.rows()[focused.rowIndex];
    const day = week?.[focused.field as WeekdayField];
    if (!day) return;

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      event.stopPropagation();
      this.shiftMonth(event.key === 'PageUp' ? -1 : 1, {
        position: { rowIndex: focused.rowIndex, colIndex: focused.colIndex },
      });
      return;
    }

    const delta = ARROW_DAY_DELTA[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    event.stopPropagation();
    const target = new Date(
      day.date.getFullYear(),
      day.date.getMonth(),
      day.date.getDate() + delta,
    );
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    const targetDay = target.getDate();

    if (targetYear === this.year() && targetMonth === this.monthSignal()) {
      const position = findDayPosition(this.rows(), targetYear, targetMonth, targetDay);
      if (position) grid.focusCell?.(position.rowIndex, position.colIndex);
      return;
    }

    this.yearSignal.set(targetYear);
    this.monthSignal.set(targetMonth);
    this.rerender({ day: targetDay });
  }

  private installMousedownPairDetection(grid: CalendarGridElement): void {
    grid.addEventListener('mousedown', this.onMousedown, true);
  }

  private readonly onMousedown: EventListener = (event): void => {
    if (!(event instanceof MouseEvent) || event.button !== 0) return;
    const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>('.cell[data-col]');
    if (!cell) {
      this.lastMousedownCell = null;
      return;
    }

    const now = event.timeStamp;
    if (this.lastMousedownCell === cell && now - this.lastMousedownTime < DBLCLICK_MS) {
      this.lastMousedownCell = null;
      this.lastMousedownTime = 0;
      const day = this.resolveDayFromCell(cell);
      if (day) this.eventDialog.open(day);
      return;
    }

    this.lastMousedownCell = cell;
    this.lastMousedownTime = now;
  };

  private resolveDayFromCell(cell: HTMLElement): CalendarDay | null {
    const colIndexAttr = cell.getAttribute('data-col');
    if (colIndexAttr === null) return null;
    const colIndex = Number(colIndexAttr);
    if (colIndex <= 0) return null;

    const rowEl = cell.closest<HTMLElement>('.data-grid-row');
    if (!rowEl) return null;
    const ariaRowIndex = Number(rowEl.getAttribute('aria-rowindex'));
    if (!Number.isFinite(ariaRowIndex)) return null;

    const field = WEEKDAY_FIELDS[colIndex - 1];
    if (!field) return null;
    return this.rows()[ariaRowIndex - 2]?.[field] ?? null;
  }

  private installResizeObserver(grid: CalendarGridElement): void {
    this.heightObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const height = entry.contentRect.height;
      if (height === this.lastViewportHeight) return;
      this.lastViewportHeight = height;
      this.applyRowHeight(grid);
    });
  }

  private applyRowHeight(grid: CalendarGridElement): void {
    const weekCount = Math.max(this.rows().length, 1);
    if (this.lastViewportHeight <= 0) return;
    const next = Math.floor(this.lastViewportHeight / weekCount);
    if (next > 0 && next !== this.rowHeight()) {
      grid.style.setProperty('--tbw-row-height', `${next}px`);
      this.rowHeight.set(next);
    }
  }
}

function buildYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const options: number[] = [];
  for (let year = currentYear - YEAR_RANGE; year <= currentYear + YEAR_RANGE; year++) {
    options.push(year);
  }
  return options;
}

function renderWeekdayHeader(field: WeekdayField): HTMLElement {
  const root = document.createElement('span');
  root.className = 'cal-wday';
  for (const [variant, label] of [
    ['full', WEEKDAY_HEADERS_FULL[field]],
    ['short', WEEKDAY_HEADERS[field]],
    ['mini', WEEKDAY_HEADERS_MINI[field]],
  ] as const) {
    const span = document.createElement('span');
    span.className = `cal-wday__${variant}`;
    span.textContent = label;
    root.appendChild(span);
  }
  return root;
}

function makeRows(
  year: number,
  month: number,
  userEvents: ReadonlyMap<string, CalendarEvent[]>,
): CalendarWeek[] {
  const generated = generateEvents(year, month);
  const byDate = new Map(generated.byDate);
  for (const [key, events] of userEvents) {
    const existing = byDate.get(key);
    const merged = existing ? [...existing, ...events] : [...events];
    merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
    byDate.set(key, merged);
  }
  return buildWeeks(year, month, byDate);
}

function findDayPosition(
  rows: readonly CalendarWeek[],
  year: number,
  month: number,
  dayOfMonth: number,
): { rowIndex: number; colIndex: number } | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    for (let dayIndex = 0; dayIndex < WEEKDAY_FIELDS.length; dayIndex++) {
      const day = rows[rowIndex][WEEKDAY_FIELDS[dayIndex]];
      if (
        day.inMonth &&
        day.date.getFullYear() === year &&
        day.date.getMonth() === month &&
        day.date.getDate() === dayOfMonth
      ) {
        return { rowIndex, colIndex: dayIndex + 1 };
      }
    }
  }
  return null;
}
