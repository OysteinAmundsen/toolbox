/**
 * Custom Cell Editors for the Vanilla Employee Management Demo
 *
 * Each editor demonstrates different interaction patterns for inline editing.
 */

import type { Employee } from '@demo/shared';
import type { ColumnEditorContext } from '@toolbox-web/grid';

/**
 * Interactive 5-star rating editor with keyboard support.
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
        renderStars();
        ctx.commit(i);
      });
      container.appendChild(star);
    }
    const label = document.createElement('span');
    label.textContent = ` ${currentValue.toFixed(1)}`;
    label.className = 'star-rating-editor__label';
    container.appendChild(label);
  };

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
  // Note: Don't auto-focus here - the grid handles focus via beginBulkEdit/inlineEnterEdit
  // Auto-focusing here would cause all editors to fight for focus, with the last one winning
  return container;
};

/**
 * Bonus slider editor with percentage display.
 */
export const bonusSliderEditor = (ctx: ColumnEditorContext<Employee, number>): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'bonus-slider-editor';

  const salary = ctx.row.salary || 100000;
  const minBonus = Math.round(salary * 0.02);
  const maxBonus = Math.round(salary * 0.25);
  let currentValue = ctx.value ?? Math.round(salary * 0.1);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(minBonus);
  slider.max = String(maxBonus);
  slider.value = String(currentValue);
  slider.className = 'bonus-slider-editor__slider';

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

  slider.addEventListener('change', () => ctx.commit(currentValue));
  slider.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ctx.commit(currentValue);
    else if (e.key === 'Escape') ctx.cancel();
  });

  container.appendChild(slider);
  container.appendChild(display);
  // Note: Don't auto-focus here - the grid handles focus via beginBulkEdit/inlineEnterEdit
  return container;
};

/**
 * Status selection editor with colored badges.
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

  const select = document.createElement('select');
  select.className = 'status-select-editor__select';

  Object.entries(statusConfig).forEach(([status, config]) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = `${config.icon} ${status}`;
    option.selected = status === ctx.value;
    select.appendChild(option);
  });

  container.appendChild(select);

  select.addEventListener('change', () => ctx.commit(select.value));
  select.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      ctx.cancel();
    }
  });

  // Note: Don't auto-focus here - the grid handles focus via beginBulkEdit/inlineEnterEdit
  return container;
};

/**
 * Native HTML5 date input editor.
 */
export const dateEditor = (ctx: ColumnEditorContext<Employee, string>): HTMLElement => {
  const input = document.createElement('input');
  input.type = 'date';
  input.value = ctx.value || '';
  input.className = 'date-editor';

  input.addEventListener('change', () => ctx.commit(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ctx.commit(input.value);
    else if (e.key === 'Escape') ctx.cancel();
  });

  // Note: Don't auto-focus here - the grid handles focus via beginBulkEdit/inlineEnterEdit
  return input;
};
