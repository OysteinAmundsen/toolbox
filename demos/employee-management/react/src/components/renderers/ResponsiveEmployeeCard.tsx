import type { Employee } from '@demo/shared';
import { StatusBadge } from './StatusBadge';

/**
 * Department color map for avatar backgrounds.
 */
const DEPT_COLORS: Record<string, string> = {
  Engineering: '#3b82f6',
  Marketing: '#ec4899',
  Sales: '#f59e0b',
  HR: '#10b981',
  Finance: '#6366f1',
  Legal: '#8b5cf6',
  Operations: '#14b8a6',
  'Customer Support': '#f97316',
};

interface ResponsiveEmployeeCardProps {
  employee: Employee;
}

/**
 * Responsive card layout for employee data.
 * Displayed when the grid is in responsive (mobile/narrow) mode.
 */
export function ResponsiveEmployeeCard({ employee }: ResponsiveEmployeeCardProps) {
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`;
  const deptColor = DEPT_COLORS[employee.department] ?? '#6b7280';

  const salary = employee.salary.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="responsive-employee-card">
      <div className="responsive-employee-card__avatar" style={{ backgroundColor: deptColor }}>
        {initials}
      </div>
      <div className="responsive-employee-card__content">
        <div className="responsive-employee-card__header">
          <span className="responsive-employee-card__name">
            {employee.firstName} {employee.lastName}
          </span>
          <StatusBadge value={employee.status} />
        </div>
        <div className="responsive-employee-card__title">{employee.title}</div>
        <div className="responsive-employee-card__meta">
          <span className="responsive-employee-card__dept" style={{ color: deptColor }}>
            {employee.department}
          </span>
          <span className="responsive-employee-card__separator">•</span>
          <span className="responsive-employee-card__salary">{salary}</span>
          <span className="responsive-employee-card__separator">•</span>
          <span className="responsive-employee-card__rating">{employee.rating.toFixed(1)} ★</span>
          {employee.isTopPerformer && <span className="responsive-employee-card__top-performer">⭐</span>}
        </div>
      </div>
    </div>
  );
}
