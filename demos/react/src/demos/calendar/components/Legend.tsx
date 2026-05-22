import { CATEGORIES, type CategoryId } from '@demo/shared/calendar';

export function Legend() {
  return (
    <div className="cal-legend">
      {CATEGORIES.map((category: { id: CategoryId; label: string }) => (
        <span key={category.id} className="cal-legend__item">
          <span className="cal-legend__swatch" style={{ background: `var(--cal-cat-${category.id})` }} />
          <span>{category.label}</span>
        </span>
      ))}
    </div>
  );
}
