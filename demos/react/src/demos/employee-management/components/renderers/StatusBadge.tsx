/**
 * StatusBadge - Color-coded status badge renderer
 * Matches Angular: app-status-badge
 */
interface StatusBadgeProps {
  value: string;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const badgeClass = value ? `status-badge--${value.toLowerCase().replace(/\s+/g, '-')}` : '';

  return <span className={`status-badge ${badgeClass}`}>{value}</span>;
}
