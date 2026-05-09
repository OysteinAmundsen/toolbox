// Feature imports for the directives wired in this component's `imports` array
// (events the demo subscribes to). All other feature side-effect imports live
// next to the matching `gridConfig.features` keys in `./grid-config.ts`.
import '@toolbox-web/grid-angular/features/editing';
import '@toolbox-web/grid-angular/features/filtering';
// Master-detail and responsive must be side-effect-imported in the component
// so their `<tbw-grid-detail>` / `<tbw-grid-responsive-card>` template elements
// get wired into the corresponding plugin's renderer in ngAfterContentInit.
import '@toolbox-web/grid-angular/features/master-detail';
import '@toolbox-web/grid-angular/features/responsive';

import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { generateEmployees, type Employee } from '@demo/shared/employee-management';
import { shadowDomStyles } from '@demo/shared/employee-management/styles';
import {
  CellCommitEvent,
  Grid,
  GridResponsiveCard,
  GridToolPanel,
  injectGrid,
  TbwGridColumn,
  TbwGridHeader,
  TbwGridToolButtons,
  TbwRenderer,
} from '@toolbox-web/grid-angular';
import {
  GridEditingDirective,
  GridLazyForm,
  TbwEditor,
} from '@toolbox-web/grid-angular/features/editing';
import { injectGridExport } from '@toolbox-web/grid-angular/features/export';
import { GridFilteringDirective } from '@toolbox-web/grid-angular/features/filtering';
import { GridDetailView } from '@toolbox-web/grid-angular/features/master-detail';
import { createGridConfig } from './grid-config';

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
  selector: 'app-employee-management',
  imports: [
    CurrencyPipe,
    FormsModule,
    ReactiveFormsModule,
    Grid,
    GridDetailView,
    GridFilteringDirective,
    GridEditingDirective,
    GridLazyForm,
    GridResponsiveCard,
    GridToolPanel,
    TbwGridColumn,
    TbwGridHeader,
    TbwGridToolButtons,
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
  templateUrl: './employee-management.component.html',
})
export class EmployeeManagementComponent {
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
   * Filter-change handler wired via `(filterChange)` on <tbw-grid>. Owned by
   * `GridFilteringDirective` from `@toolbox-web/grid-angular/features/filtering`,
   * which is added to this component's `imports` above. Without that import
   * Angular's compiler would error with `Can't bind to 'filterChange'...`.
   */
  onFilterChange(event: unknown): void {
    console.log('[Grid] filter-change', event);
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
