<script setup lang="ts">
/**
 * Employee Management Demo - Vue 3 Implementation
 *
 * This demo showcases @toolbox-web/grid-vue best practices:
 * - Feature imports for tree-shakeable plugin loading (side-effect imports)
 * - Feature props for declarative plugin configuration
 * - Event handling via @event-name syntax
 * - GridConfig for inline Vue renderers/editors
 * - TbwGridDetailPanel for declarative master-detail panels
 * - TbwGridToolPanel for custom sidebar panels
 * - TbwGridToolButtons for toolbar actions
 * - TbwGridResponsiveCard for responsive card layouts
 * - useGrid() composable for programmatic access
 * - TypeScript generics for row type safety
 *
 * The grid matches visual design and functionality across all framework demos.
 *
 * NOTE: Feature side-effect imports (`@toolbox-web/grid-vue/features/*`) live
 * next to the configuration in `./grid-config.ts`, since that's where the
 * matching `gridConfig.features` keys are declared.
 */

import {
  TbwGrid,
  TbwGridDetailPanel,
  TbwGridResponsiveCard,
  TbwGridToolButtons,
  TbwGridToolPanel,
  useGrid,
} from '@toolbox-web/grid-vue';
import { useGridExport } from '@toolbox-web/grid-vue/features/export';
import { computed, h, markRaw, ref } from 'vue';

// Import shared data, types, and styles
import { generateEmployees, type Employee } from '@demo/shared/employee-management';
import '@demo/shared/employee-management/demo-styles.css';

// Grid configuration (columns, groups, pinned rows, responsive, features)
import { createGridConfig } from './grid-config';

// Vue-specific renderers and editors
import BonusSliderEditor from './components/editors/BonusSliderEditor.vue';
import DateEditor from './components/editors/DateEditor.vue';
import StarRatingEditor from './components/editors/StarRatingEditor.vue';
import StatusSelectEditor from './components/editors/StatusSelectEditor.vue';
import DetailPanel from './components/renderers/DetailPanel.vue';
import RatingDisplay from './components/renderers/RatingDisplay.vue';
import ResponsiveEmployeeCard from './components/renderers/ResponsiveEmployeeCard.vue';
import StatusBadge from './components/renderers/StatusBadge.vue';
import TopPerformerStar from './components/renderers/TopPerformerStar.vue';
import AnalyticsPanel from './components/tool-panels/AnalyticsPanel.vue';
import QuickFiltersPanel from './components/tool-panels/QuickFiltersPanel.vue';

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

// useGridExport() for clean export API
const { exportToCsv, exportToExcel } = useGridExport<Employee>();

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
const handleRowCountChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const newCount = parseInt(target.value, 10);
  rowCount.value = newCount;
  employees.value = generateEmployees(newCount);
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
      enableSelection: enableSelection.value,
      enableFiltering: enableFiltering.value,
      enableSorting: enableSorting.value,
      enableEditing: enableEditing.value,
      enableMasterDetail: enableMasterDetail.value,
      renderers,
      editors,
    }),
  ),
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
        <TbwGrid :rows="employees" :gridConfig="gridConfig" class="demo-grid">
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
            <button
              class="tbw-toolbar-btn"
              title="Export Excel"
              aria-label="Export Excel"
              @click="exportToExcel('employees.xlsx')"
            >
              📊
            </button>
          </TbwGridToolButtons>

          <!-- Custom tool panels -->
          <TbwGridToolPanel id="quick-filters" title="Quick Filters" icon="🔍">
            <template #default="{ grid }">
              <QuickFiltersPanel @filter-change="(filters) => console.log('Filters:', filters)" />
            </template>
          </TbwGridToolPanel>

          <TbwGridToolPanel id="analytics" title="Analytics" icon="📈">
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
