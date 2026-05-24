<script setup lang="ts">
import type { DataGridElement, GridConfig } from '@toolbox-web/grid';
import {
  TbwGrid as DataGrid,
  TbwGridColumn as GridColumn,
  TbwGridHeaderContent,
  TbwGridToolbarContent,
} from '@toolbox-web/grid-vue';
import '@toolbox-web/grid-vue/features/pinned-rows';
import '@demo/shared/calendar/demo-styles.css';
import {
  buildWeeks,
  generateEvents,
  isoKey,
  WEEKDAY_FIELDS,
  WEEKDAY_HEADERS,
  WEEKDAY_HEADERS_FULL,
  WEEKDAY_HEADERS_MINI,
  type CalendarDay,
  type CalendarEvent,
  type CalendarWeek,
  type WeekdayField,
} from '@demo/shared/calendar';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import DayCell from './components/DayCell.vue';
import EventDialog from './components/EventDialog.vue';
import HeaderNav from './components/HeaderNav.vue';
import Legend from './components/Legend.vue';
import ToolbarNav from './components/ToolbarNav.vue';
import { DEFAULT_ROW_HEIGHT_PX, useDynamicRowHeight } from './composables/useDynamicRowHeight';
import { useDoubleClick } from './composables/useDoubleClick';
import { useGridCallbackRoot } from './composables/useGridCallbackRoot';
import {
  findDayPosition,
  shiftCalendarMonth,
  useKeyboardNav,
  type CalendarViewState,
} from './composables/useKeyboardNav';

interface GridComponentExpose {
  gridElement: DataGridElement<CalendarWeek> | null;
  ready: () => Promise<void>;
}

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
const YEAR_RANGE = 5;

const today = new Date();
const state = reactive<CalendarViewState>({ year: today.getFullYear(), month: today.getMonth() });
const userEvents = reactive(new Map<string, CalendarEvent[]>()) as Map<string, CalendarEvent[]>;
const dialogDay = ref<CalendarDay | null>(null);
const gridComponent = ref<GridComponentExpose | null>(null);
const cleanups: (() => void)[] = [];
let rowHeightController: { apply: () => void; cleanup: () => void } | null = null;

const years = computed(() => {
  const currentYear = new Date().getFullYear();
  const out: number[] = [];
  for (let y = currentYear - YEAR_RANGE; y <= currentYear + YEAR_RANGE; y++) out.push(y);
  return out;
});

const rows = computed(() => makeRows(state, userEvents));

// Header/toolbar content is now rendered declaratively via
// <TbwGridHeaderContent> / <TbwGridToolbarContent> in the template.
const headerProps = computed(() => ({
  state,
  years: years.value,
  monthNames: MONTH_NAMES,
  onYearChange: (year: number) => {
    state.year = year;
    rerender();
  },
}));

const toolbarProps = {
  onPrev: () => shiftMonth(-1),
  onToday: goToday,
  onNext: () => shiftMonth(1),
};

const legendRoot = useGridCallbackRoot(Legend, () => ({}));
// Cache the legend element so the pinned-rows plugin can short-circuit DOM
// mutation across grid renders (fresh element each call = unmount loop).
let legendElement: HTMLElement | null = null;

const gridConfig = shallowRef({
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
            if (!legendElement) legendElement = legendRoot.mountElement('cal-legend-root');
            return legendElement;
          },
        },
      ],
    },
  },
} as GridConfig<CalendarWeek>);

function makeRows(viewState: CalendarViewState, addedEvents: ReadonlyMap<string, CalendarEvent[]>): CalendarWeek[] {
  const generated = generateEvents(viewState.year, viewState.month);
  const byDate = new Map(generated.byDate);
  for (const [key, events] of addedEvents) {
    const merged = [...(byDate.get(key) ?? []), ...events];
    merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
    byDate.set(key, merged);
  }
  return buildWeeks(viewState.year, viewState.month, byDate);
}

function getGrid(): DataGridElement<CalendarWeek> | null {
  return gridComponent.value?.gridElement ?? null;
}

function patchGridConfig(patch: Partial<GridConfig<CalendarWeek>>): void {
  gridConfig.value = { ...gridConfig.value, ...patch } as GridConfig<CalendarWeek>;
}

function setState(next: CalendarViewState): void {
  state.year = next.year;
  state.month = next.month;
}

function rerender(focusTarget?: { day: number } | { position: { rowIndex: number; colIndex: number } }): void {
  rowHeightController?.apply();
  const grid = getGrid();
  if (!grid || !focusTarget) return;

  let target: { rowIndex: number; colIndex: number } | null = null;
  if ('day' in focusTarget) {
    target = findDayPosition(rows.value, state.year, state.month, focusTarget.day);
  } else {
    target = {
      rowIndex: Math.min(focusTarget.position.rowIndex, Math.max(rows.value.length - 1, 0)),
      colIndex: focusTarget.position.colIndex,
    };
  }

  if (target) {
    const focusTargetPosition = target;
    queueMicrotask(() => grid.focusCell?.(focusTargetPosition.rowIndex, focusTargetPosition.colIndex));
  }
}

function shiftMonth(delta: number): void {
  setState(shiftCalendarMonth(state, delta));
  rerender();
}

function goToday(): void {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  rerender({ day: now.getDate() });
}

function openDialog(day: CalendarDay): void {
  dialogDay.value = day;
}

function closeDialog(): void {
  dialogDay.value = null;
}

function addEvent(event: CalendarEvent, day: CalendarDay): void {
  const key = isoKey(day.date);
  const merged = [...(userEvents.get(key) ?? []), event];
  merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
  userEvents.set(key, merged);
  closeDialog();

  const focused = getGrid()?.focusedCell;
  rerender(
    focused ? { position: { rowIndex: focused.rowIndex, colIndex: focused.colIndex } } : { day: day.date.getDate() },
  );
}

onMounted(async () => {
  await nextTick();
  const grid = getGrid();
  if (!grid) return;
  await grid.ready?.();
  // Header / toolbar registration is handled declaratively by the
  // <TbwGridHeaderContent> and <TbwGridToolbarContent> wrappers below.
  grid.refreshShellHeader?.();
  // Vue's slot-mounted <TbwGridColumn> children don't trigger the grid's
  // column-template recompute on first mount; nudge it so layout uses the
  // configured column widths instead of collapsing to one column.
  grid.refreshColumns?.();
  grid.updateTemplate?.();

  cleanups.push(
    useKeyboardNav({
      grid,
      getRows: () => rows.value,
      getState: () => ({ year: state.year, month: state.month }),
      setState,
      rerender,
      openDialog,
    }),
    useDoubleClick(grid, openDialog),
  );

  rowHeightController = useDynamicRowHeight({ grid, getRows: () => rows.value, patchGridConfig });
  cleanups.push(rowHeightController.cleanup);
});

watch(
  () => rows.value.length,
  () => {
    void nextTick(() => rowHeightController?.apply());
  },
);

onBeforeUnmount(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  legendRoot.cleanupAll();
});
</script>

<template>
  <div class="demo-container">
    <div class="calendar-demo">
      <DataGrid ref="gridComponent" :rows="rows" :grid-config="gridConfig" class="calendar-demo__grid">
        <TbwGridHeaderContent id="calendar-nav" :order="0">
          <HeaderNav v-bind="headerProps" />
        </TbwGridHeaderContent>
        <TbwGridToolbarContent id="calendar-nav-buttons" :order="0">
          <ToolbarNav v-bind="toolbarProps" />
        </TbwGridToolbarContent>
        <GridColumn field="weekNumber" header="W" :width="44" :sortable="false" :resizable="false" />
        <GridColumn
          v-for="field in WEEKDAY_FIELDS"
          :key="field"
          :field="field"
          :header="WEEKDAY_HEADERS_FULL[field]"
          :min-width="60"
          :sortable="false"
          :resizable="false"
        >
          <template #headerLabel>
            <span class="cal-wday">
              <span class="cal-wday__full">{{ WEEKDAY_HEADERS_FULL[field] }}</span>
              <span class="cal-wday__short">{{ WEEKDAY_HEADERS[field] }}</span>
              <span class="cal-wday__mini">{{ WEEKDAY_HEADERS_MINI[field] }}</span>
            </span>
          </template>
          <template #cell="{ value }">
            <DayCell :day="value" />
          </template>
        </GridColumn>
      </DataGrid>
      <EventDialog :day="dialogDay" @submit="addEvent" @close="closeDialog" />
    </div>
  </div>
</template>
