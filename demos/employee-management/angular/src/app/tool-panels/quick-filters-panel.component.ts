import { Component, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DEPARTMENTS } from '@demo/shared';
import { DataGridElement as GridElement } from '@toolbox-web/grid';
import { FilteringPlugin } from '@toolbox-web/grid/all';

/**
 * Quick Filters tool panel component.
 * Provides department, level, status, and rating filters.
 */
@Component({
  selector: 'app-quick-filters-panel',
  imports: [FormsModule],
  template: `
    <div class="tool-panel-content">
      <div class="filter-section">
        <label class="filter-label">Department</label>
        <select class="filter-select" [(ngModel)]="selectedDepartment">
          <option value="">All Departments</option>
          @for (dept of departments; track dept) {
            <option [value]="dept">{{ dept }}</option>
          }
        </select>
      </div>

      <div class="filter-section">
        <label class="filter-label">Level</label>
        <div class="filter-pills">
          @for (level of levels; track level) {
            <label class="filter-pill" [class.filter-pill--active]="selectedLevels.includes(level)">
              <input
                type="checkbox"
                [checked]="selectedLevels.includes(level)"
                (change)="toggleLevel(level)"
              />
              <span>{{ level }}</span>
            </label>
          }
        </div>
      </div>

      <div class="filter-section">
        <label class="filter-label">Status</label>
        <div class="filter-pills">
          @for (status of statuses; track status) {
            <label
              class="filter-pill"
              [class.filter-pill--active]="selectedStatuses.includes(status)"
            >
              <input
                type="checkbox"
                [checked]="selectedStatuses.includes(status)"
                (change)="toggleStatus(status)"
              />
              <span>{{ status }}</span>
            </label>
          }
        </div>
      </div>

      <div class="filter-section">
        <label class="filter-label">Rating</label>
        <div class="filter-range">
          <input type="range" [(ngModel)]="minRating" min="0" max="5" step="0.5" />
          <span class="filter-range__value">≥ {{ minRating }}</span>
        </div>
      </div>

      <div class="filter-section">
        <label class="filter-checkbox">
          <input type="checkbox" [(ngModel)]="topPerformersOnly" />
          <span>⭐ Top Performers Only</span>
        </label>
      </div>

      <div class="filter-actions">
        <button class="btn-primary" (click)="applyFilters()">Apply Filters</button>
        <button class="btn-secondary" (click)="clearFilters()">Clear</button>
      </div>
    </div>
  `,
})
export class QuickFiltersPanelComponent implements OnInit {
  /** The grid element to apply filters to */
  grid = input.required<HTMLElement>();

  readonly departments = DEPARTMENTS;
  readonly levels = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'];
  readonly statuses = ['Active', 'Remote', 'On Leave', 'Contract', 'Terminated'];

  selectedDepartment = '';
  selectedLevels: string[] = [];
  selectedStatuses: string[] = [];
  minRating = 0;
  topPerformersOnly = false;

  ngOnInit(): void {
    // Initialize from current filter state if available
  }

  toggleLevel(level: string): void {
    const index = this.selectedLevels.indexOf(level);
    if (index >= 0) {
      this.selectedLevels.splice(index, 1);
    } else {
      this.selectedLevels.push(level);
    }
  }

  toggleStatus(status: string): void {
    const index = this.selectedStatuses.indexOf(status);
    if (index >= 0) {
      this.selectedStatuses.splice(index, 1);
    } else {
      this.selectedStatuses.push(status);
    }
  }

  applyFilters(): void {
    const gridEl = this.grid() as unknown as GridElement;
    const plugin = gridEl?.getPlugin?.(FilteringPlugin);
    if (!plugin) return;

    plugin.clearAllFilters?.();

    if (this.selectedDepartment) {
      plugin.setFilter?.('department', {
        type: 'text',
        operator: 'equals',
        value: this.selectedDepartment,
      });
    }

    if (this.selectedLevels.length > 0) {
      plugin.setFilter?.('level', { type: 'set', operator: 'in', value: this.selectedLevels });
    }

    if (this.selectedStatuses.length > 0) {
      plugin.setFilter?.('status', { type: 'set', operator: 'in', value: this.selectedStatuses });
    }

    if (this.minRating > 0) {
      plugin.setFilter?.('rating', {
        type: 'number',
        operator: 'greaterThanOrEqual',
        value: this.minRating,
      });
    }

    if (this.topPerformersOnly) {
      plugin.setFilter?.('isTopPerformer', { type: 'boolean', operator: 'equals', value: true });
    }
  }

  clearFilters(): void {
    const gridEl = this.grid() as unknown as GridElement;
    const plugin = gridEl?.getPlugin?.(FilteringPlugin);
    plugin?.clearAllFilters?.();

    this.selectedDepartment = '';
    this.selectedLevels = [];
    this.selectedStatuses = [];
    this.minRating = 0;
    this.topPerformersOnly = false;
  }
}
