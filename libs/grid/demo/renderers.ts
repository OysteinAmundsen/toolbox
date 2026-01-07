/**
 * View Renderers for the Employee Management Demo
 *
 * This file contains view renderer functions used to customize how cell values
 * are displayed in the grid. These renderers return HTML strings or elements
 * with CSS classes for styling.
 */

import type { Employee } from './types';

/**
 * Renders a status badge with appropriate styling based on the employee status.
 *
 * Uses CSS classes:
 * - `status-badge` - Base badge styling
 * - `status-badge--{status}` - Status-specific colors (active, remote, on-leave, contract, terminated)
 *
 * @param context - The cell context containing the status value
 * @returns HTML string for the status badge
 *
 * @example
 * ```ts
 * { field: 'status', viewRenderer: statusViewRenderer }
 * ```
 */
export const statusViewRenderer = ({ value }: { value: string }): string => {
  const statusClass = value.toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-badge status-badge--${statusClass}">${value}</span>`;
};

/**
 * Renders a star indicator for top performer status.
 *
 * Uses CSS classes:
 * - `top-performer-star` - Base star styling
 * - `top-performer-star--active` - Filled star for top performers
 * - `top-performer-star--inactive` - Empty star for non-top performers
 *
 * @param context - The cell context containing the boolean value
 * @returns HTML string for the star indicator
 *
 * @example
 * ```ts
 * { field: 'isTopPerformer', viewRenderer: topPerformerRenderer }
 * ```
 */
export const topPerformerRenderer = ({ value }: { value: boolean }): string => {
  return value
    ? '<span class="top-performer-star top-performer-star--active">★</span>'
    : '<span class="top-performer-star top-performer-star--inactive">☆</span>';
};

/**
 * Renders a rating value with color coding based on the score.
 *
 * Uses CSS classes:
 * - `rating-display` - Base rating styling
 * - `rating-display--high` - Green color for ratings >= 4.5
 * - `rating-display--medium` - Yellow/amber color for ratings >= 3.5
 * - `rating-display--low` - Red color for ratings < 3.5
 *
 * @param context - The cell context containing the numeric rating value
 * @returns HTML string for the rating display
 *
 * @example
 * ```ts
 * { field: 'rating', viewRenderer: ratingRenderer }
 * ```
 */
export const ratingRenderer = ({ value }: { value: number }): string => {
  const level = value >= 4.5 ? 'high' : value >= 3.5 ? 'medium' : 'low';
  return `<span class="rating-display rating-display--${level}">${value.toFixed(1)} ★</span>`;
};

/**
 * Creates a detail panel element for the master-detail view.
 *
 * Displays employee's active projects, performance reviews, and skills
 * in an expandable detail row.
 *
 * Uses CSS classes:
 * - `detail-panel` - Main container for the detail view
 * - `detail-section` - Section wrapper (projects, reviews, skills)
 * - `detail-section__title` - Section heading
 * - `detail-table` - Table for projects
 * - `detail-table__header` - Table header row
 * - `detail-table__header-cell` - Table header cell
 * - `detail-table__row` - Table body row
 * - `detail-table__cell` - Table body cell
 * - `project-status` - Project status badge base
 * - `project-status--active` - Active project status
 * - `project-status--completed` - Completed project status
 * - `project-status--on-hold` - On-hold project status
 * - `review-grid` - Grid container for review cards
 * - `review-card` - Individual review card
 * - `review-card__period` - Quarter/year heading
 * - `review-card__score` - Score value
 * - `review-card__score--high` - High score (>= 4)
 * - `review-card__score--medium` - Medium score (>= 3)
 * - `review-card__score--low` - Low score (< 3)
 * - `review-card__notes` - Review notes text
 * - `skills-container` - Container for skill tags
 * - `skill-tag` - Individual skill tag
 *
 * @param employee - The employee record to render details for
 * @returns HTMLElement containing the detail panel
 *
 * @example
 * ```ts
 * new MasterDetailPlugin({
 *   detailRenderer: (row) => createDetailRenderer(row as Employee)
 * })
 * ```
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
    `<div class="detail-panel__content">` +
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
    `<div class="review-grid">${reviewsHtml}</div>` +
    `<div class="skills-container">` +
    `<h4 class="detail-section__title">Skills</h4>` +
    `<div class="skills-container__tags">${skillsHtml}</div>` +
    `</div>` +
    `</div>` +
    `</div>`;

  return container;
};
