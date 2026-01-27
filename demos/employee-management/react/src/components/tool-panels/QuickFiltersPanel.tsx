import { DEPARTMENTS } from '@demo/shared';
import type { ToolPanelContext } from '@toolbox-web/grid-react';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
import { useCallback, useState } from 'react';

interface QuickFiltersPanelProps {
  grid: ToolPanelContext['grid'];
}

const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'];
const STATUSES = ['Active', 'Remote', 'On Leave', 'Contract', 'Terminated'];

export function QuickFiltersPanel({ grid }: QuickFiltersPanelProps) {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [topPerformersOnly, setTopPerformersOnly] = useState(false);

  const toggleLevel = useCallback((level: string) => {
    setSelectedLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
  }, []);

  const toggleStatus = useCallback((status: string) => {
    setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  }, []);

  const applyFilters = useCallback(() => {
    const gridEl = grid as unknown as { getPlugin?: (type: unknown) => FilteringPlugin | undefined };
    const filterPlugin = gridEl.getPlugin?.(FilteringPlugin);
    if (!filterPlugin) {
      console.warn('FilteringPlugin not found');
      return;
    }

    // Clear existing filters first
    filterPlugin.clearFilter('department');
    filterPlugin.clearFilter('level');
    filterPlugin.clearFilter('status');
    filterPlugin.clearFilter('rating');
    filterPlugin.clearFilter('isTopPerformer');

    // Apply new filters
    if (selectedDepartment) {
      filterPlugin.setFilter('department', { type: 'equals', value: selectedDepartment });
    }
    if (selectedLevels.length > 0) {
      filterPlugin.setFilter('level', { type: 'includes', value: selectedLevels });
    }
    if (selectedStatuses.length > 0) {
      filterPlugin.setFilter('status', { type: 'includes', value: selectedStatuses });
    }
    if (minRating > 0) {
      filterPlugin.setFilter('rating', { type: 'greaterThanOrEqual', value: minRating });
    }
    if (topPerformersOnly) {
      filterPlugin.setFilter('isTopPerformer', { type: 'equals', value: true });
    }
  }, [grid, selectedDepartment, selectedLevels, selectedStatuses, minRating, topPerformersOnly]);

  const clearFilters = useCallback(() => {
    setSelectedDepartment('');
    setSelectedLevels([]);
    setSelectedStatuses([]);
    setMinRating(0);
    setTopPerformersOnly(false);

    const gridEl = grid as unknown as { getPlugin?: (type: unknown) => FilteringPlugin | undefined };
    const filterPlugin = gridEl.getPlugin?.(FilteringPlugin);
    if (filterPlugin) {
      filterPlugin.clearAllFilters();
    }
  }, [grid]);

  return (
    <div className="tool-panel-content">
      <div className="filter-section">
        <label className="filter-label">Department</label>
        <select
          className="filter-select"
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-section">
        <label className="filter-label">Level</label>
        <div className="filter-pills">
          {LEVELS.map((level) => (
            <label key={level} className={`filter-pill ${selectedLevels.includes(level) ? 'filter-pill--active' : ''}`}>
              <input type="checkbox" checked={selectedLevels.includes(level)} onChange={() => toggleLevel(level)} />
              <span>{level}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Status</label>
        <div className="filter-pills">
          {STATUSES.map((status) => (
            <label
              key={status}
              className={`filter-pill ${selectedStatuses.includes(status) ? 'filter-pill--active' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedStatuses.includes(status)}
                onChange={() => toggleStatus(status)}
              />
              <span>{status}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Rating</label>
        <div className="filter-range">
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value))}
          />
          <span className="filter-range__value">≥ {minRating}</span>
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-checkbox">
          <input type="checkbox" checked={topPerformersOnly} onChange={(e) => setTopPerformersOnly(e.target.checked)} />
          <span>⭐ Top Performers Only</span>
        </label>
      </div>

      <div className="filter-actions">
        <button className="btn-primary" onClick={applyFilters}>
          Apply Filters
        </button>
        <button className="btn-secondary" onClick={clearFilters}>
          Clear
        </button>
      </div>
    </div>
  );
}
