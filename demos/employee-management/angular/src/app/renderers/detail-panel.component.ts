import { Component, computed, input } from '@angular/core';
import type { Employee } from '@demo/shared';

@Component({
  selector: 'app-detail-panel',
  template: `
    <div class="detail-panel">
      <div class="detail-grid">
        <div class="detail-section">
          <h4 class="detail-section__title">Active Projects</h4>
          <table class="detail-table">
            <thead>
              <tr class="detail-table__header">
                <th class="detail-table__header-cell">ID</th>
                <th class="detail-table__header-cell">Project</th>
                <th class="detail-table__header-cell">Role</th>
                <th class="detail-table__header-cell">Hours</th>
                <th class="detail-table__header-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (project of employee().activeProjects; track project.id) {
                <tr class="detail-table__row">
                  <td class="detail-table__cell">{{ project.id }}</td>
                  <td class="detail-table__cell">{{ project.name }}</td>
                  <td class="detail-table__cell">{{ project.role }}</td>
                  <td class="detail-table__cell">{{ project.hoursLogged }}h</td>
                  <td class="detail-table__cell">
                    <span class="project-status" [class]="'project-status--' + project.status">
                      {{ project.status }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="detail-section">
          <h4 class="detail-section__title">Performance Reviews</h4>
          <div class="reviews-grid">
            @for (review of recentReviews(); track review.quarter + review.year) {
              <div class="review-card">
                <div class="review-card__period">{{ review.quarter }} {{ review.year }}</div>
                <div class="review-card__score" [class]="getScoreClass(review.score)">
                  {{ review.score.toFixed(1) }}
                </div>
                <div class="review-card__notes">{{ review.notes }}</div>
              </div>
            }
          </div>
          <div class="skills-container">
            <h4 class="detail-section__title">Skills</h4>
            @for (skill of employee().skills; track skill) {
              <span class="skill-tag">{{ skill }}</span>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class DetailPanelComponent {
  employee = input.required<Employee>();

  recentReviews = computed(() => this.employee().performanceReviews.slice(-4));

  getScoreClass(score: number): string {
    const level = score >= 4 ? 'high' : score >= 3 ? 'medium' : 'low';
    return `review-card__score--${level}`;
  }
}
