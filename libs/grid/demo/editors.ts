/**
 * Custom Cell Editors for the Employee Management Demo
 *
 * This file contains reusable custom editor functions for the grid component.
 * Each editor demonstrates different interaction patterns and uses CSS classes
 * defined in employee-management.css for styling.
 */

import type { ColumnEditorContext } from '../src/public';
import type { Employee } from './types';

/**
 * Interactive 5-star rating editor.
 *
 * An interactive star picker that lets users click to set ratings from 1-5.
 * Supports keyboard navigation with arrow keys and commits on Enter.
 *
 * @example
 * ```ts
 * {
 *   field: 'rating',
 *   header: 'Rating',
 *   editor: starRatingEditor,
 * }
 * ```
 *
 * CSS classes used:
 * - `.star-rating-editor` - Container element
 * - `.star-rating-editor__star` - Individual star element
 * - `.star-rating-editor__star--filled` - Filled star (★)
 * - `.star-rating-editor__star--empty` - Empty star (☆)
 * - `.star-rating-editor__label` - Numeric value display
 */
export const starRatingEditor = (ctx: ColumnEditorContext<Employee, number>): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'star-rating-editor';
  container.setAttribute('tabindex', '0');

  let currentValue = ctx.value ?? 3;

  const renderStars = () => {
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      const filled = i <= Math.round(currentValue);
      star.textContent = filled ? '★' : '☆';
      star.className = `star-rating-editor__star ${filled ? 'star-rating-editor__star--filled' : 'star-rating-editor__star--empty'}`;
      star.dataset.value = String(i);

      star.addEventListener('click', (e) => {
        e.stopPropagation();
        currentValue = i;
        renderStars(); // Update visual immediately
        ctx.commit(i);
      });
      container.appendChild(star);
    }
    // Show numeric value
    const label = document.createElement('span');
    label.textContent = ` ${currentValue.toFixed(1)}`;
    label.className = 'star-rating-editor__label';
    container.appendChild(label);
  };

  // Keyboard support: left/right arrows, Enter to commit
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && currentValue > 1) {
      currentValue = Math.max(1, currentValue - 0.5);
      renderStars();
    } else if (e.key === 'ArrowRight' && currentValue < 5) {
      currentValue = Math.min(5, currentValue + 0.5);
      renderStars();
    } else if (e.key === 'Enter') {
      ctx.commit(currentValue);
    } else if (e.key === 'Escape') {
      ctx.cancel();
    }
  });

  renderStars();
  setTimeout(() => container.focus(), 0);
  return container;
};

/**
 * Bonus slider editor with percentage display.
 *
 * A range slider that calculates bonus based on the employee's salary.
 * Shows the bonus amount and percentage of salary with color coding.
 *
 * @example
 * ```ts
 * {
 *   field: 'bonus',
 *   header: 'Bonus',
 *   editor: bonusSliderEditor,
 * }
 * ```
 *
 * CSS classes used:
 * - `.bonus-slider-editor` - Container element
 * - `.bonus-slider-editor__slider` - Range input element
 * - `.bonus-slider-editor__display` - Value display container
 * - `.bonus-slider-editor__value--high` - High bonus (≥15%)
 * - `.bonus-slider-editor__value--medium` - Medium bonus (≥10%)
 * - `.bonus-slider-editor__value--low` - Low bonus (<10%)
 * - `.bonus-slider-editor__percent` - Percentage text
 */
export const bonusSliderEditor = (ctx: ColumnEditorContext<Employee, number>): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'bonus-slider-editor';

  const salary = ctx.row.salary || 100000;
  const minBonus = Math.round(salary * 0.02);
  const maxBonus = Math.round(salary * 0.25);
  let currentValue = ctx.value ?? Math.round(salary * 0.1);

  // Range slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(minBonus);
  slider.max = String(maxBonus);
  slider.value = String(currentValue);
  slider.className = 'bonus-slider-editor__slider';

  // Value display with percentage
  const display = document.createElement('span');
  const updateDisplay = () => {
    const percent = ((currentValue / salary) * 100).toFixed(1);
    const colorClass =
      parseFloat(percent) >= 15
        ? 'bonus-slider-editor__value--high'
        : parseFloat(percent) >= 10
          ? 'bonus-slider-editor__value--medium'
          : 'bonus-slider-editor__value--low';
    display.innerHTML = `<strong class="${colorClass}">$${currentValue.toLocaleString()}</strong> <small class="bonus-slider-editor__percent">(${percent}%)</small>`;
  };
  display.className = 'bonus-slider-editor__display';
  updateDisplay();

  slider.addEventListener('input', () => {
    currentValue = parseInt(slider.value, 10);
    updateDisplay();
  });

  slider.addEventListener('change', () => {
    ctx.commit(currentValue);
  });

  slider.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      ctx.commit(currentValue);
    } else if (e.key === 'Escape') {
      ctx.cancel();
    }
  });

  container.appendChild(slider);
  container.appendChild(display);

  setTimeout(() => slider.focus(), 0);
  return container;
};

/**
 * Status selection editor with colored badges.
 *
 * Uses the HTML customizable select API (appearance: base-select)
 * with rich styled options showing colored status badges.
 *
 * @example
 * ```ts
 * {
 *   field: 'status',
 *   header: 'Status',
 *   editor: statusSelectEditor,
 * }
 * ```
 *
 * CSS classes used:
 * - `.status-select-editor` - Container element
 * - `.status-select-editor__select` - Select element with base-select appearance
 * - `.status-select-editor__badge` - Status badge inside options
 */
export const statusSelectEditor = (ctx: ColumnEditorContext<Employee, string>): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'status-select-editor';

  const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
    Active: { bg: '#d4edda', text: '#155724', icon: '✓' },
    Remote: { bg: '#cce5ff', text: '#004085', icon: '🏠' },
    'On Leave': { bg: '#fff3cd', text: '#856404', icon: '🌴' },
    Contract: { bg: '#e2e3e5', text: '#383d41', icon: '📄' },
    Terminated: { bg: '#f8d7da', text: '#721c24', icon: '✗' },
  };

  // Create the customizable select
  const select = document.createElement('select');
  select.className = 'status-select-editor__select';

  // Add custom button with selectedcontent for rich display
  const button = document.createElement('button');
  button.type = 'button';
  const selectedContent = document.createElement('selectedcontent');
  button.appendChild(selectedContent);
  select.appendChild(button);

  // Add options with rich content
  Object.entries(statusConfig).forEach(([status, config]) => {
    const option = document.createElement('option');
    option.value = status;
    option.selected = status === ctx.value;

    // Create rich option content - dynamic colors per status
    const badge = document.createElement('span');
    badge.className = 'status-select-editor__badge';
    badge.style.background = config.bg;
    badge.style.color = config.text;
    badge.innerHTML = `<span aria-hidden="true">${config.icon}</span><span>${status}</span>`;
    option.appendChild(badge);
    select.appendChild(option);
  });

  container.appendChild(select);

  select.addEventListener('change', () => {
    ctx.commit(select.value);
  });

  select.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      ctx.cancel();
    }
  });

  setTimeout(() => select.focus(), 0);
  return container;
};

/**
 * Native HTML5 date input editor.
 *
 * Uses the browser's native date picker for proper date selection.
 * Commits on change or Enter key, cancels on Escape.
 *
 * @example
 * ```ts
 * {
 *   field: 'hireDate',
 *   header: 'Hire Date',
 *   editor: dateEditor,
 * }
 * ```
 *
 * CSS classes used:
 * - `.date-editor` - Date input element
 */
export const dateEditor = (ctx: ColumnEditorContext<Employee, string>): HTMLElement => {
  const input = document.createElement('input');
  input.type = 'date';
  input.value = ctx.value || '';
  input.className = 'date-editor';

  input.addEventListener('change', () => {
    ctx.commit(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      ctx.commit(input.value);
    } else if (e.key === 'Escape') {
      ctx.cancel();
    }
  });

  setTimeout(() => input.focus(), 0);
  return input;
};
