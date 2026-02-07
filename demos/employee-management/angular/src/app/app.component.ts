// Feature imports - enable feature inputs on <tbw-grid>
// These are side-effect imports that register the inputs
import '@toolbox-web/grid-angular/features/clipboard';
import '@toolbox-web/grid-angular/features/column-virtualization';
import '@toolbox-web/grid-angular/features/context-menu';
import '@toolbox-web/grid-angular/features/export';
import '@toolbox-web/grid-angular/features/pinned-columns';
import '@toolbox-web/grid-angular/features/reorder';
import '@toolbox-web/grid-angular/features/visibility';
// Dynamic features (toggled via checkboxes) use plugin-based pattern in grid-config.ts:
// selection, filtering, sorting, editing, master-detail, undo-redo, pinned-rows
// Also in plugins: groupingColumns (columnGroups config), responsive (<tbw-grid-responsive-card>)

import { CurrencyPipe } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { generateEmployees, type Employee } from '@demo/shared';
import { shadowDomStyles } from '@demo/shared/styles';
import {
  CellCommitEvent,
  Grid,
  GridDetailView,
  GridLazyForm,
  GridResponsiveCard,
  GridToolPanel,
  injectGrid,
  TbwEditor,
  TbwRenderer,
} from '@toolbox-web/grid-angular';
import { injectGridExport } from '@toolbox-web/grid-angular/features/export';
import type { ColumnMoveDetail } from '@toolbox-web/grid/all';

import { COLUMN_GROUPS, createGridConfig } from './grid-config';

// Import components so they're available in templates
// Note: RatingDisplayComponent and StarRatingEditorComponent are configured via gridConfig,
// not imported here (they use component-class column config instead of templates)
import { BonusSliderEditorComponent } from './editors/bonus-slider-editor.component';
import { DateEditorComponent } from './editors/date-editor.component';
import { StatusSelectEditorComponent } from './editors/status-select-editor.component';
import { DetailPanelComponent } from './renderers/detail-panel.component';
import { StatusBadgeComponent } from './renderers/status-badge.component';
import { TopPerformerComponent } from './renderers/top-performer.component';
import { AnalyticsPanelComponent, QuickFiltersPanelComponent } from './tool-panels';

@Component({
  selector: 'app-root',
  imports: [
    CurrencyPipe,
    FormsModule,
    ReactiveFormsModule,
    Grid,
    GridDetailView,
    GridLazyForm,
    GridResponsiveCard,
    GridToolPanel,
    TbwRenderer,
    TbwEditor,
    // Renderer components (RatingDisplayComponent is configured in gridConfig instead)
    StatusBadgeComponent,
    TopPerformerComponent,
    DetailPanelComponent,
    // Editor components (StarRatingEditorComponent is configured in gridConfig instead)
    StatusSelectEditorComponent,
    BonusSliderEditorComponent,
    DateEditorComponent,
    // Tool panel components
    QuickFiltersPanelComponent,
    AnalyticsPanelComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private fb = inject(FormBuilder);

  rowCount = signal(200);
  enableSelection = signal(true);
  enableFiltering = signal(true);
  enableSorting = signal(true);
  enableEditing = signal(true);
  enableMasterDetail = signal(true);

  // Custom styles for shadow DOM (editors, renderers, detail panels)
  // The Grid directive automatically injects these into the grid's shadow DOM
  customStyles = shadowDomStyles;

  // Generate employee data - recomputed when rowCount changes
  rows = computed(() => generateEmployees(this.rowCount()));

  /**
   * Lazy form factory - creates a FormGroup only when a row enters edit mode.
   * This is ~20-100x more efficient than creating FormGroups for all rows upfront!
   *
   * For 200 rows with 22 fields, the old approach created 4,400 FormControls.
   * This approach creates ~10 FormControls (only for the row being edited).
   */
  createRowForm = (employee: Employee): FormGroup =>
    this.fb.group({
      // Only include EDITABLE fields - no need for disabled read-only fields
      firstName: [employee.firstName, Validators.required],
      lastName: [employee.lastName, Validators.required],
      department: [employee.department],
      title: [employee.title],
      level: [employee.level, [Validators.min(1), Validators.max(10)]],
      salary: [employee.salary, [Validators.required, Validators.min(0)]],
      bonus: [employee.bonus, [Validators.min(0), Validators.max(100)]],
      status: [employee.status],
      hireDate: [employee.hireDate],
      rating: [employee.rating, [Validators.min(0), Validators.max(5)]],
    });

  // Grid config - recomputed when feature flags change
  gridConfig = computed(() =>
    createGridConfig({
      enableSelection: this.enableSelection(),
      enableFiltering: this.enableFiltering(),
      enableSorting: this.enableSorting(),
      enableEditing: this.enableEditing(),
      enableMasterDetail: this.enableMasterDetail(),
    }),
  );

  // Typed grid access via injectGrid - cleaner than viewChild!
  grid = injectGrid<Employee>();

  // Feature-scoped hook for export functionality
  gridExport = injectGridExport();

  exportCsv(): void {
    this.gridExport.exportToCsv('employees.csv');
  }

  exportExcel(): void {
    this.gridExport.exportToExcel('employees.xlsx');
  }

  /**
   * Handle cell commit events at the grid level.
   * This demonstrates the event bubbling feature - instead of handling
   * commit in each editor template, we can handle it centrally here.
   */
  onCellCommit(event: CellCommitEvent): void {
    console.log(`[Grid] Cell committed: ${event.field} = ${event.value} (row ${event.rowIndex})`);
    // Example: could trigger auto-save, show notification, etc.
  }

  /**
   * Handle column-move events to enforce group constraints.
   * This demonstrates the cancelable event feature - prevents columns
   * from being moved outside their assigned column groups.
   */
  onColumnMove(event: Event): void {
    const customEvent = event as CustomEvent<ColumnMoveDetail>;
    const { field, columnOrder } = customEvent.detail;

    // Find which group this field belongs to
    const sourceGroup = COLUMN_GROUPS.find((g) => g.children.includes(field));
    if (!sourceGroup) return; // Not in a group, allow the move

    // Get the indices of all columns in the source group (in the new/proposed order)
    const groupColumnIndices = sourceGroup.children
      .map((f) => columnOrder.indexOf(f))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);

    if (groupColumnIndices.length <= 1) return;

    // Check if the group columns are contiguous (no gaps between them)
    const minIndex = groupColumnIndices[0];
    const maxIndex = groupColumnIndices[groupColumnIndices.length - 1];
    const isContiguous = groupColumnIndices.length === maxIndex - minIndex + 1;

    if (!isContiguous) {
      console.log(
        `[Column Move Cancelled] Cannot move "${field}" outside its group "${sourceGroup.id}"`,
      );
      event.preventDefault();

      // Flash the column header with error color to indicate cancellation
      const gridEl = this.grid.element();
      const headerCell = gridEl?.querySelector(
        `.header-row .cell[data-field="${field}"]`,
      ) as HTMLElement;
      if (headerCell) {
        headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
        headerCell.animate(
          [
            { backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' },
            { backgroundColor: 'transparent' },
          ],
          { duration: 400, easing: 'ease-out' },
        );
      }
    }
  }

  /**
   * Get department color for responsive card avatar.
   */
  getDepartmentColor(department: string): string {
    const colors: Record<string, string> = {
      Engineering: '#3b82f6',
      Marketing: '#ec4899',
      Sales: '#f59e0b',
      HR: '#10b981',
      Finance: '#6366f1',
      Legal: '#8b5cf6',
      Operations: '#14b8a6',
      'Customer Support': '#f97316',
    };
    return colors[department] ?? '#6b7280';
  }
}
