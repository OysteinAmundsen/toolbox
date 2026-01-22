/**
 * View Renderers for the Vanilla Employee Management Demo
 *
 * View renderers customize how cell values are displayed in read mode.
 */

import type { Employee } from '@demo/shared';

/**
 * Renders a status badge with color-coded styling.
 */
export const statusViewRenderer = ({ value }: { value: string }): string => {
  const statusClass = value.toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-badge status-badge--${statusClass}">${value}</span>`;
};

/**
 * Renders a star indicator for top performer status.
 */
export const topPerformerRenderer = ({ value }: { value: boolean }): string => {
  return value
    ? '<span class="top-performer-star top-performer-star--active">★</span>'
    : '<span class="top-performer-star top-performer-star--inactive">☆</span>';
};

/**
 * Renders a rating value with color coding based on score.
 */
export const ratingRenderer = ({ value }: { value: number }): string => {
  const level = value >= 4.5 ? 'high' : value >= 3.5 ? 'medium' : 'low';
  return `<span class="rating-display rating-display--${level}">${value.toFixed(1)} ★</span>`;
};

/**
 * Creates a detail panel element for master-detail view.
 * Shows employee's active projects, performance reviews, and skills.
 */
export const createDetailRenderer = (employee: Employee): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'detail-panel';

  const projectsHtml = employee.activeProjects
    .map(
      (p) =>
        `<tr class="detail-table__row">` +
        `<td class="detail-table__cell">${p.id}</td>` +
        `<td class="detail-table__cell">${p.name}</td>` +
        `<td class="detail-table__cell">${p.role}</td>` +
        `<td class="detail-table__cell">${p.hoursLogged}h</td>` +
        `<td class="detail-table__cell">` +
        `<span class="project-status project-status--${p.status}">${p.status}</span>` +
        `</td></tr>`,
    )
    .join('');

  const reviewsHtml = employee.performanceReviews
    .slice(-4)
    .map((r) => {
      const scoreLevel = r.score >= 4 ? 'high' : r.score >= 3 ? 'medium' : 'low';
      return (
        `<div class="review-card">` +
        `<div class="review-card__period">${r.quarter} ${r.year}</div>` +
        `<div class="review-card__score review-card__score--${scoreLevel}">${r.score.toFixed(1)}</div>` +
        `<div class="review-card__notes">${r.notes}</div>` +
        `</div>`
      );
    })
    .join('');

  const skillsHtml = employee.skills.map((s) => `<span class="skill-tag">${s}</span>`).join('');

  container.innerHTML =
    `<div class="detail-grid">` +
    `<div class="detail-section">` +
    `<h4 class="detail-section__title">Active Projects</h4>` +
    `<table class="detail-table">` +
    `<thead><tr class="detail-table__header">` +
    `<th class="detail-table__header-cell">ID</th>` +
    `<th class="detail-table__header-cell">Project</th>` +
    `<th class="detail-table__header-cell">Role</th>` +
    `<th class="detail-table__header-cell">Hours</th>` +
    `<th class="detail-table__header-cell">Status</th>` +
    `</tr></thead>` +
    `<tbody>${projectsHtml}</tbody>` +
    `</table>` +
    `</div>` +
    `<div class="detail-section">` +
    `<h4 class="detail-section__title">Performance Reviews</h4>` +
    `<div class="reviews-grid">${reviewsHtml}</div>` +
    `<div class="skills-container">` +
    `<h4 class="detail-section__title">Skills</h4>` +
    `${skillsHtml}` +
    `</div>` +
    `</div>` +
    `</div>`;

  return container;
};

/**
 * Creates a responsive card element for mobile/narrow layouts.
 * Shows compact employee info with avatar placeholder, status badge, and key metrics.
 */
export const createResponsiveCardRenderer = (employee: Employee): HTMLElement => {
  const card = document.createElement('div');
  card.className = 'responsive-employee-card';

  // Get initials for avatar placeholder
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`;

  // Determine department color
  const deptColors: Record<string, string> = {
    Engineering: '#3b82f6',
    Marketing: '#ec4899',
    Sales: '#f59e0b',
    HR: '#10b981',
    Finance: '#6366f1',
    Legal: '#8b5cf6',
    Operations: '#14b8a6',
    'Customer Support': '#f97316',
  };
  const deptColor = deptColors[employee.department] ?? '#6b7280';

  // Format salary
  const salary = employee.salary.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  // Status class
  const statusClass = employee.status.toLowerCase().replace(/\s+/g, '-');

  card.innerHTML =
    `<div class="responsive-employee-card__avatar" style="background-color: ${deptColor}">` +
    `${initials}` +
    `</div>` +
    `<div class="responsive-employee-card__content">` +
    `<div class="responsive-employee-card__header">` +
    `<span class="responsive-employee-card__name">${employee.firstName} ${employee.lastName}</span>` +
    `<span class="status-badge status-badge--${statusClass}">${employee.status}</span>` +
    `</div>` +
    `<div class="responsive-employee-card__title">${employee.title}</div>` +
    `<div class="responsive-employee-card__meta">` +
    `<span class="responsive-employee-card__dept" style="color: ${deptColor}">${employee.department}</span>` +
    `<span class="responsive-employee-card__separator">•</span>` +
    `<span class="responsive-employee-card__salary">${salary}</span>` +
    `<span class="responsive-employee-card__separator">•</span>` +
    `<span class="responsive-employee-card__rating">${employee.rating.toFixed(1)} ★</span>` +
    `${employee.isTopPerformer ? '<span class="responsive-employee-card__top-performer">⭐</span>' : ''}` +
    `</div>` +
    `</div>`;

  return card;
};
