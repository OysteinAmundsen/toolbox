import { Component, computed, input } from '@angular/core';
import { type Employee } from '@demo/shared';

/**
 * Analytics tool panel component.
 * Shows statistics about the employee data.
 */
@Component({
  selector: 'app-analytics-panel',
  template: `
    <div class="analytics-content">
      <div class="stat-cards">
        <div class="stat-card stat-card--payroll">
          <div class="stat-card__label">Total Payroll</div>
          <div class="stat-card__value">{{ formatCurrency(totalSalary()) }}</div>
        </div>
        <div class="stat-card stat-card--salary">
          <div class="stat-card__label">Avg Salary</div>
          <div class="stat-card__value">{{ formatCurrency(avgSalary()) }}</div>
        </div>
        <div class="stat-card stat-card--rating">
          <div class="stat-card__label">Avg Rating</div>
          <div class="stat-card__value">{{ avgRating().toFixed(1) }} ★</div>
        </div>
        <div class="stat-card stat-card--performers">
          <div class="stat-card__label">Top Performers</div>
          <div class="stat-card__value">{{ topPerformers() }}</div>
        </div>
      </div>

      <div class="dept-distribution">
        <h4 class="dept-distribution__title">Department Distribution</h4>
        <div class="dept-bars">
          @for (dept of topDepartments(); track dept.name) {
            <div class="dept-bar">
              <span class="dept-bar__name" [title]="dept.name">{{ dept.name }}</span>
              <div class="dept-bar__track">
                <div class="dept-bar__fill" [style.width.%]="dept.percentage"></div>
              </div>
              <span class="dept-bar__count">{{ dept.count }}</span>
            </div>
          }
        </div>
      </div>

      @if (largestDept(); as dept) {
        <div class="largest-dept">
          <div class="largest-dept__label">Largest Department</div>
          <div class="largest-dept__value">
            {{ dept.name }}
            <span class="largest-dept__count">({{ dept.count }} employees)</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class AnalyticsPanelComponent {
  /** The grid element to get data from */
  grid = input.required<HTMLElement>();

  /** Rows passed directly (for reactivity) */
  rows = input<Employee[]>([]);

  // Computed values
  totalSalary = computed(() => {
    const data = this.rows();
    return data.reduce((sum, r) => sum + r.salary, 0);
  });

  avgSalary = computed(() => {
    const data = this.rows();
    if (data.length === 0) return 0;
    return this.totalSalary() / data.length;
  });

  avgRating = computed(() => {
    const data = this.rows();
    if (data.length === 0) return 0;
    return data.reduce((sum, r) => sum + r.rating, 0) / data.length;
  });

  topPerformers = computed(() => {
    const data = this.rows();
    return data.filter((r) => r.isTopPerformer).length;
  });

  departmentCounts = computed(() => {
    const data = this.rows();
    const counts: Record<string, number> = {};
    data.forEach((r) => {
      counts[r.department] = (counts[r.department] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: data.length > 0 ? (count / data.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  });

  topDepartments = computed(() => this.departmentCounts().slice(0, 6));

  largestDept = computed(() => this.departmentCounts()[0] || null);

  formatCurrency(value: number): string {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }
}
