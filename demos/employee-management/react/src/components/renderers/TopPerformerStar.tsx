/**
 * TopPerformerStar - Star indicator for top performers
 * Matches Angular: app-top-performer
 */
interface TopPerformerStarProps {
  value: boolean;
}

export function TopPerformerStar({ value }: TopPerformerStarProps) {
  const className = `top-performer-star ${value ? 'top-performer-star--active' : 'top-performer-star--inactive'}`;

  return <span className={className}>{value ? '★' : '☆'}</span>;
}
