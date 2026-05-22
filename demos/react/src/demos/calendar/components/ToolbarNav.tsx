export interface ToolbarNavProps {
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
}

export function ToolbarNav({ onPrevious, onToday, onNext }: ToolbarNavProps) {
  return (
    <div className="cal-toolbar-nav">
      <button type="button" className="cal-header__btn" aria-label="Previous month" title="Previous month" onClick={onPrevious}>
        ‹
      </button>
      <button type="button" className="cal-header__btn" aria-label="Jump to current month" title="Jump to current month" onClick={onToday}>
        Today
      </button>
      <button type="button" className="cal-header__btn" aria-label="Next month" title="Next month" onClick={onNext}>
        ›
      </button>
    </div>
  );
}
