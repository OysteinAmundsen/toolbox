import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { generateEmployees } from '@demo/shared';
import { shadowDomStyles } from '@demo/shared/styles';
import { DataGridElement as GridElement } from '@toolbox-web/grid';
import {
  CellCommitEvent,
  Grid,
  GridDetailView,
  GridToolPanel,
  TbwEditor,
  TbwRenderer,
} from '@toolbox-web/grid-angular';
import { ExportPlugin } from '@toolbox-web/grid/all';

import { createGridConfig } from './grid-config';

// Import components so they're available in templates
import { BonusSliderEditorComponent } from './editors/bonus-slider-editor.component';
import { DateEditorComponent } from './editors/date-editor.component';
import { StarRatingEditorComponent } from './editors/star-rating-editor.component';
import { StatusSelectEditorComponent } from './editors/status-select-editor.component';
import { DetailPanelComponent } from './renderers/detail-panel.component';
import { RatingDisplayComponent } from './renderers/rating-display.component';
import { StatusBadgeComponent } from './renderers/status-badge.component';
import { TopPerformerComponent } from './renderers/top-performer.component';
import { AnalyticsPanelComponent, QuickFiltersPanelComponent } from './tool-panels';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    Grid,
    GridDetailView,
    GridToolPanel,
    TbwRenderer,
    TbwEditor,
    // Renderer components
    StatusBadgeComponent,
    RatingDisplayComponent,
    TopPerformerComponent,
    DetailPanelComponent,
    // Editor components
    StatusSelectEditorComponent,
    BonusSliderEditorComponent,
    StarRatingEditorComponent,
    DateEditorComponent,
    // Tool panel components
    QuickFiltersPanelComponent,
    AnalyticsPanelComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
})
export class AppComponent {
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

  // Grid reference for accessing plugins
  gridRef = viewChild<ElementRef<GridElement>>('grid');

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
}
