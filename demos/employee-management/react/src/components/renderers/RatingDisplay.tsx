/**
 * RatingDisplay - Color-coded rating display
 * Matches Angular: app-rating-display
 */
interface RatingDisplayProps {
  value: number;
}

export function RatingDisplay({ value }: RatingDisplayProps) {
  const displayValue = (value ?? 0).toFixed(1);
  const level = value >= 4.5 ? 'high' : value >= 3.5 ? 'medium' : 'low';
  const levelClass = `rating-display--${level}`;

  return <span className={`rating-display ${levelClass}`}>{displayValue} ★</span>;
}
