import { CurrencyPipe } from '@angular/common';
import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { generateEmployees, type Employee, type GridElement } from '@demo/shared';
import { shadowDomStyles } from '@demo/shared/styles';
import {
  CellCommitEvent,
  Grid,
  GridDetailView,
  GridFormArray,
  GridResponsiveCard,
  GridToolPanel,
  TbwEditor,
  TbwRenderer,
} from '@toolbox-web/grid-angular';
import { ExportPlugin, type ColumnMoveDetail } from '@toolbox-web/grid/all';

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
    GridFormArray,
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
   * Form containing the grid rows as a FormArray of FormGroups.
   * Each row is a FormGroup with individual FormControls for each field.
   * This enables Reactive Forms integration with field-level validation.
   */
  form = this.fb.group({
    rows: this.fb.array<ReturnType<typeof this.createEmployeeFormGroup>>([]),
  });

  /** Convenience getter for the rows FormArray */
  get rowsFormArray() {
    return this.form.controls.rows;
  }

  /**
   * Sync the computed rows signal to the FormArray.
   * When rowCount changes, we regenerate employees and update the FormArray.
   */
  private syncRowsToFormArray = effect(() => {
    const rows = this.rows();
    const formArray = this.rowsFormArray;
    formArray.clear({ emitEvent: false });
    rows.forEach((row) => {
      formArray.push(this.createEmployeeFormGroup(row), { emitEvent: false });
    });
    // Emit a single valueChanges after all rows are added
    formArray.updateValueAndValidity();
  });

  /**
   * Create a FormGroup for an Employee row with individual controls per field.
   * Non-editable fields (id, email, team, etc.) are marked as disabled.
   */
  private createEmployeeFormGroup(employee: Employee) {
    return this.fb.group({
      // Non-editable fields (disabled)
      id: this.fb.control({ value: employee.id, disabled: true }),
      email: this.fb.control({ value: employee.email, disabled: true }),
      team: this.fb.control({ value: employee.team, disabled: true }),
      manager: this.fb.control({ value: employee.manager, disabled: true }),
      location: this.fb.control({ value: employee.location, disabled: true }),
      timezone: this.fb.control({ value: employee.timezone, disabled: true }),
      skills: this.fb.control({ value: employee.skills, disabled: true }),
      completedProjects: this.fb.control({ value: employee.completedProjects, disabled: true }),
      activeProjects: this.fb.control({ value: employee.activeProjects, disabled: true }),
      performanceReviews: this.fb.control({ value: employee.performanceReviews, disabled: true }),
      lastPromotion: this.fb.control({ value: employee.lastPromotion, disabled: true }),
      isTopPerformer: this.fb.control({ value: employee.isTopPerformer, disabled: true }),

      // Editable fields
      firstName: this.fb.control(employee.firstName, { nonNullable: true }),
      lastName: this.fb.control(employee.lastName, { nonNullable: true }),
      department: this.fb.control(employee.department, { nonNullable: true }),
      title: this.fb.control(employee.title, { nonNullable: true }),
      level: this.fb.control(employee.level, { nonNullable: true }),
      salary: this.fb.control(employee.salary, { nonNullable: true }),
      bonus: this.fb.control(employee.bonus, { nonNullable: true }),
      status: this.fb.control(employee.status, { nonNullable: true }),
      hireDate: this.fb.control(employee.hireDate, { nonNullable: true }),
      rating: this.fb.control(employee.rating, { nonNullable: true }),
    });
  }

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

  // Grid reference for accessing plugins - properly typed!
  gridRef = viewChild<ElementRef<GridElement<Employee>>>('grid');

  exportCsv(): void {
    const grid = this.gridRef()?.nativeElement;
    if (!grid) return;
    const exportPlugin = grid.getPlugin(ExportPlugin);
    exportPlugin?.exportCsv({ fileName: 'employees' });
  }

  exportExcel(): void {
    const grid = this.gridRef()?.nativeElement;
    if (!grid) return;
    const exportPlugin = grid.getPlugin(ExportPlugin);
    exportPlugin?.exportExcel({ fileName: 'employees' });
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
      const grid = this.gridRef()?.nativeElement;
      const headerCell = grid?.querySelector(
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
