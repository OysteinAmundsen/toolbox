import { useEffect, useRef, useState } from 'react';

/**
 * StarRatingEditor - Interactive 5-star rating editor with keyboard support
 * Matches Angular: app-star-rating-editor
 */
interface StarRatingEditorProps {
  value: number;
  onCommit: (value: number) => void;
  onCancel: () => void;
}

export function StarRatingEditor({ value, onCommit, onCancel }: StarRatingEditorProps) {
  const [currentValue, setCurrentValue] = useState(value ?? 3);
  const containerRef = useRef<HTMLDivElement>(null);
  const stars = [1, 2, 3, 4, 5];

  useEffect(() => {
    // Focus the container after mount
    setTimeout(() => containerRef.current?.focus(), 0);
  }, []);

  const handleStarClick = (star: number) => {
    setCurrentValue(star);
    onCommit(star);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentValue > 1) {
      setCurrentValue((v) => Math.max(1, v - 0.5));
    } else if (e.key === 'ArrowRight' && currentValue < 5) {
      setCurrentValue((v) => Math.min(5, v + 0.5));
    } else if (e.key === 'Enter') {
      onCommit(currentValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div ref={containerRef} className="star-rating-editor" tabIndex={0} onKeyDown={handleKeyDown}>
      {stars.map((star) => (
        <span
          key={star}
          className={`star-rating-editor__star ${
            star <= currentValue ? 'star-rating-editor__star--filled' : 'star-rating-editor__star--empty'
          }`}
          onClick={() => handleStarClick(star)}
        >
          {star <= Math.round(currentValue) ? '★' : '☆'}
        </span>
      ))}
      <span className="star-rating-editor__label">{currentValue.toFixed(1)}</span>
    </div>
  );
}
