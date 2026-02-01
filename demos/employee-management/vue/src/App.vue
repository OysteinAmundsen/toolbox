<script setup lang="ts">
/**
 * Employee Management Demo - Vue 3 Implementation
 *
 * This demo showcases @toolbox-web/grid-vue best practices:
 * - Feature imports for tree-shakeable plugin loading (side-effect imports)
 * - Feature props for declarative plugin configuration
 * - Event handling via @event-name syntax
 * - VueGridConfig for inline Vue renderers/editors
 * - TbwGridDetailPanel for declarative master-detail panels
 * - TbwGridToolPanel for custom sidebar panels
 * - TbwGridToolButtons for toolbar actions
 * - TbwGridResponsiveCard for responsive card layouts
 * - useGrid() composable for programmatic access
 * - TypeScript generics for row type safety
 *
 * The grid matches visual design and functionality across all framework demos.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE IMPORTS - Register features you want to use (tree-shakeable)
// Each import adds ~50 bytes + the plugin itself to your bundle.
// Only import what you need - unused features are not bundled.
// ═══════════════════════════════════════════════════════════════════════════════
import '@toolbox-web/grid-vue/features/clipboard';
import '@toolbox-web/grid-vue/features/column-virtualization';
import '@toolbox-web/grid-vue/features/context-menu';
import '@toolbox-web/grid-vue/features/editing';
import '@toolbox-web/grid-vue/features/export';
import '@toolbox-web/grid-vue/features/filtering';
import '@toolbox-web/grid-vue/features/grouping-columns';
import '@toolbox-web/grid-vue/features/master-detail';
import '@toolbox-web/grid-vue/features/multi-sort';
import '@toolbox-web/grid-vue/features/pinned-columns';
import '@toolbox-web/grid-vue/features/pinned-rows';
import '@toolbox-web/grid-vue/features/reorder';
import '@toolbox-web/grid-vue/features/responsive';
import '@toolbox-web/grid-vue/features/selection';
import '@toolbox-web/grid-vue/features/undo-redo';
import '@toolbox-web/grid-vue/features/visibility';

import {
  TbwGrid,
  TbwGridDetailPanel,
  TbwGridResponsiveCard,
  TbwGridToolButtons,
  TbwGridToolPanel,
  useGrid,
} from '@toolbox-web/grid-vue';
import type { ColumnMoveDetail } from '@toolbox-web/grid/plugins/reorder';
import { computed, h, markRaw, ref } from 'vue';

// Import shared data, types, and styles
import { generateEmployees, type Employee } from '@demo/shared';
import '@demo/shared/demo-styles.css';

// Grid configuration (columns, groups, pinned rows, responsive)
import { COLUMN_GROUPS, createGridConfig, PINNED_ROWS_CONFIG, RESPONSIVE_CONFIG } from './grid-config';

// Vue-specific renderers and editors
import StatusBadge from './components/renderers/StatusBadge.vue';
import RatingDisplay from './components/renderers/RatingDisplay.vue';
import TopPerformerStar from './components/renderers/TopPerformerStar.vue';
import DetailPanel from './components/renderers/DetailPanel.vue';
import ResponsiveEmployeeCard from './components/renderers/ResponsiveEmployeeCard.vue';
import StarRatingEditor from './components/editors/StarRatingEditor.vue';
import BonusSliderEditor from './components/editors/BonusSliderEditor.vue';
import StatusSelectEditor from './components/editors/StatusSelectEditor.vue';
import DateEditor from './components/editors/DateEditor.vue';
import QuickFiltersPanel from './components/tool-panels/QuickFiltersPanel.vue';
import AnalyticsPanel from './components/tool-panels/AnalyticsPanel.vue';

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════
const rowCount = ref(200);
const employees = ref<Employee[]>(generateEmployees(rowCount.value));

// Demo options - toggle features dynamically
const enableSelection = ref(true);
const enableFiltering = ref(true);
const enableSorting = ref(true);
const enableEditing = ref(true);
const enableMasterDetail = ref(true);

// useGrid() composable for programmatic access
const { gridElement } = useGrid<Employee>();

// Export helper - access ExportPlugin directly
const exportToCsv = (filename = 'employees.csv') => {
  const grid = gridElement.value as any;
  grid?.getPluginByName?.('export')?.exportCsv?.({ fileName: filename.replace('.csv', '') });
};

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
const handleRowCountChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const newCount = parseInt(target.value, 10);
  rowCount.value = newCount;
  employees.value = generateEmployees(newCount);
};

/**
 * Column group contiguity constraint.
 * Prevents moving columns outside their group.
 */
const handleColumnMove = (event: CustomEvent<ColumnMoveDetail>) => {
  const { field, columnOrder } = event.detail;

  // Find which group this field belongs to
  const sourceGroup = COLUMN_GROUPS.find((g) => g.children.includes(field));
  if (!sourceGroup) return;

  // Get the indices of all columns in the source group
  const groupColumnIndices = sourceGroup.children
    .map((f) => columnOrder.indexOf(f))
    .filter((i) => i !== -1)
    .sort((a, b) => a - b);

  if (groupColumnIndices.length <= 1) return;

  // Check if the group columns are contiguous
  const minIndex = groupColumnIndices[0];
  const maxIndex = groupColumnIndices[groupColumnIndices.length - 1];
  const isContiguous = groupColumnIndices.length === maxIndex - minIndex + 1;

  if (!isContiguous) {
    console.log(`[Column Move Cancelled] Cannot move "${field}" outside its group "${sourceGroup.id}"`);
    event.preventDefault();

    // Flash error animation
    const grid = gridElement.value;
    const headerCell = grid?.querySelector(`.header-row .cell[data-field="${field}"]`) as HTMLElement;
    if (headerCell) {
      headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
      headerCell.animate(
        [{ backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' }, { backgroundColor: 'transparent' }],
        { duration: 400, easing: 'ease-out' },
      );
    }
  }
};

const handleRowsChange = (event: CustomEvent<{ rows: Employee[] }>) => {
  employees.value = event.detail.rows;
};

const handleExportExcel = () => {
  const grid = gridElement.value as any;
  grid?.getPluginByName?.('export')?.exportExcel?.({ fileName: 'employees' });
};

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERERS & EDITORS - Define outside computed to avoid recreating on each render
// ═══════════════════════════════════════════════════════════════════════════════

// Stable renderer functions that won't cause infinite loops
const renderers = {
  status: (value: string) => h(StatusBadge, { value }),
  rating: (value: number) => h(RatingDisplay, { value }),
  topPerformer: (value: boolean) => h(TopPerformerStar, { value }),
};

// Stable editor functions
const editors = {
  bonus: (value: number, salary: number, commit: (v: number) => void, cancel: () => void) =>
    h(BonusSliderEditor, { value, onCommit: commit, onCancel: cancel }),
  status: (value: string, commit: (v: string) => void, cancel: () => void) =>
    h(StatusSelectEditor, { value, onCommit: commit, onCancel: cancel }),
  date: (value: string, commit: (v: string) => void, cancel: () => void) =>
    h(DateEditor, { value, onCommit: commit, onCancel: cancel }),
  rating: (value: number, commit: (v: number) => void, cancel: () => void) =>
    h(StarRatingEditor, { value, onCommit: commit, onCancel: cancel }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// GRID CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

// Use markRaw to prevent Vue from deeply tracking the config object.
// This avoids infinite reactivity loops when the grid's internal state changes.
const gridConfig = computed(() =>
  markRaw(
    createGridConfig({
      enableSorting: enableSorting.value,
      enableEditing: enableEditing.value,
      renderers,
      editors,
    }),
  ),
);

// Computed feature prop values
const selectionConfig = computed(() => (enableSelection.value ? 'range' : undefined));
const multiSortConfig = computed(() => (enableSorting.value ? 'multi' : undefined));
const filteringConfig = computed(() => (enableFiltering.value ? { debounceMs: 200 } : undefined));
const editingConfig = computed(() => (enableEditing.value ? 'dblclick' : undefined));
const undoRedoConfig = computed(() => (enableEditing.value ? { maxHistorySize: 100 } : undefined));
const masterDetailConfig = computed(() =>
  enableMasterDetail.value ? { showExpandColumn: true, animation: 'slide' as const } : undefined,
);
</script>

<template>
  <div id="app">
    <div class="demo-container">
      <!-- Demo Controls Header -->
      <header class="demo-header">
        <div class="demo-controls">
          <label>
            <span class="row-count-display">
              Rows: <strong>{{ rowCount }}</strong>
            </span>
            <input type="range" min="50" max="1000" step="50" :value="rowCount" @input="handleRowCountChange" />
          </label>
          <label> <input type="checkbox" v-model="enableSelection" /> Selection </label>
          <label> <input type="checkbox" v-model="enableFiltering" /> Filtering </label>
          <label> <input type="checkbox" v-model="enableSorting" /> Sorting </label>
          <label> <input type="checkbox" v-model="enableEditing" /> Editing </label>
          <label> <input type="checkbox" v-model="enableMasterDetail" /> Master-Detail </label>
        </div>
      </header>

      <!-- Grid -->
      <div class="grid-wrapper">
        <TbwGrid
          :rows="employees"
          :gridConfig="gridConfig"
          class="demo-grid"
          :selection="selectionConfig"
          :multiSort="multiSortConfig"
          :filtering="filteringConfig"
          :editing="editingConfig"
          :undoRedo="undoRedoConfig"
          clipboard
          contextMenu
          reorder
          visibility
          pinnedColumns
          groupingColumns
          columnVirtualization
          export
          :responsive="RESPONSIVE_CONFIG"
          :masterDetail="masterDetailConfig"
          :pinnedRows="PINNED_ROWS_CONFIG"
          @rows-change="handleRowsChange"
          @column-move="handleColumnMove"
        >
          <!-- Toolbar buttons -->
          <TbwGridToolButtons>
            <button
              class="tbw-toolbar-btn"
              title="Export CSV"
              aria-label="Export CSV"
              @click="exportToCsv('employees.csv')"
            >
              📄
            </button>
            <button class="tbw-toolbar-btn" title="Export Excel" aria-label="Export Excel" @click="handleExportExcel">
              📊
            </button>
          </TbwGridToolButtons>

          <!-- Custom tool panels -->
          <TbwGridToolPanel id="quick-filters" label="Quick Filters" icon="🔍">
            <template #default="{ grid }">
              <QuickFiltersPanel @filter-change="(filters) => console.log('Filters:', filters)" />
            </template>
          </TbwGridToolPanel>

          <TbwGridToolPanel id="analytics" label="Analytics" icon="📈">
            <template #default="{ grid }">
              <AnalyticsPanel :rows="employees" />
            </template>
          </TbwGridToolPanel>

          <!-- Master-detail panel -->
          <TbwGridDetailPanel v-if="enableMasterDetail">
            <template #default="{ row }">
              <DetailPanel :row="row" />
            </template>
          </TbwGridDetailPanel>

          <!-- Responsive card for mobile/narrow layouts -->
          <TbwGridResponsiveCard>
            <template #default="{ row }">
              <ResponsiveEmployeeCard :row="row" />
            </template>
          </TbwGridResponsiveCard>
        </TbwGrid>
      </div>
    </div>
  </div>
</template>
