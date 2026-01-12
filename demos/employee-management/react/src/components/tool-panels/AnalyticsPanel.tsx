import type { Employee } from '@demo/shared';
import type { ToolPanelContext } from '@toolbox-web/grid-react';
import { useEffect, useMemo, useState } from 'react';

interface AnalyticsPanelProps {
  grid: ToolPanelContext['grid'];
}

interface DepartmentData {
  name: string;
  count: number;
  percentage: number;
}

export function AnalyticsPanel({ grid }: AnalyticsPanelProps) {
  const [rows, setRows] = useState<Employee[]>([]);

  useEffect(() => {
    // Get rows from grid
    const gridEl = grid as { rows?: Employee[] };
    if (gridEl.rows) {
      setRows([...gridEl.rows]);
    }

    // Listen for data changes
    const handleDataChange = () => {
      const gridElement = grid as { rows?: Employee[] };
      if (gridElement.rows) {
        setRows([...gridElement.rows]);
      }
    };

    grid.addEventListener('data-change', handleDataChange);
    grid.addEventListener('filter-change', handleDataChange);

    return () => {
      grid.removeEventListener('data-change', handleDataChange);
      grid.removeEventListener('filter-change', handleDataChange);
    };
  }, [grid]);

  // Computed values matching Angular/Vanilla
  const totalSalary = useMemo(() => rows.reduce((sum, r) => sum + (r.salary || 0), 0), [rows]);
  const avgSalary = useMemo(() => (rows.length > 0 ? totalSalary / rows.length : 0), [totalSalary, rows.length]);
  const avgRating = useMemo(() => {
    if (rows.length === 0) return 0;
    return rows.reduce((sum, r) => sum + (r.rating || 0), 0) / rows.length;
  }, [rows]);
  const topPerformers = useMemo(() => rows.filter((r) => r.isTopPerformer).length, [rows]);

  const departmentCounts = useMemo((): DepartmentData[] => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.department] = (counts[r.department] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: rows.length > 0 ? (count / rows.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const topDepartments = useMemo(() => departmentCounts.slice(0, 6), [departmentCounts]);
  const largestDept = useMemo(() => departmentCounts[0] || null, [departmentCounts]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="analytics-content">
      <div className="stat-cards">
        <div className="stat-card stat-card--payroll">
          <div className="stat-card__label">Total Payroll</div>
          <div className="stat-card__value">{formatCurrency(totalSalary)}</div>
        </div>
        <div className="stat-card stat-card--salary">
          <div className="stat-card__label">Avg Salary</div>
          <div className="stat-card__value">{formatCurrency(avgSalary)}</div>
        </div>
        <div className="stat-card stat-card--rating">
          <div className="stat-card__label">Avg Rating</div>
          <div className="stat-card__value">{avgRating.toFixed(1)} ★</div>
        </div>
        <div className="stat-card stat-card--performers">
          <div className="stat-card__label">Top Performers</div>
          <div className="stat-card__value">{topPerformers}</div>
        </div>
      </div>

      <div className="dept-distribution">
        <h4 className="dept-distribution__title">Department Distribution</h4>
        <div className="dept-bars">
          {topDepartments.map((dept) => (
            <div key={dept.name} className="dept-bar">
              <span className="dept-bar__name" title={dept.name}>
                {dept.name}
              </span>
              <div className="dept-bar__track">
                <div className="dept-bar__fill" style={{ width: `${dept.percentage}%` }} />
              </div>
              <span className="dept-bar__count">{dept.count}</span>
            </div>
          ))}
        </div>
      </div>

      {largestDept && (
        <div className="largest-dept">
          <div className="largest-dept__label">Largest Department</div>
          <div className="largest-dept__value">
            {largestDept.name}
            <span className="largest-dept__count">({largestDept.count} employees)</span>
          </div>
        </div>
      )}
    </div>
  );
}
