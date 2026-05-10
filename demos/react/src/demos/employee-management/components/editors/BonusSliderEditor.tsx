import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * BonusSliderEditor - Slider-based bonus editor with percentage display
 * Matches Angular: app-bonus-slider-editor
 */
interface BonusSliderEditorProps {
  value: number;
  salary: number;
  onCommit: (value: number) => void;
  onCancel: () => void;
}

export function BonusSliderEditor({ value, salary, onCommit, onCancel }: BonusSliderEditorProps) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const minBonus = useMemo(() => Math.round(salary * 0.02), [salary]);
  const maxBonus = useMemo(() => Math.round(salary * 0.25), [salary]);
  const [currentValue, setCurrentValue] = useState(value ?? Math.round(salary * 0.1));

  useEffect(() => {
    // Focus the slider after mount
    setTimeout(() => sliderRef.current?.focus(), 0);
  }, []);

  const percent = ((currentValue / salary) * 100).toFixed(1);

  const getColorClass = (): string => {
    const pct = parseFloat(percent);
    if (pct >= 15) return 'bonus-slider-editor__value--high';
    if (pct >= 10) return 'bonus-slider-editor__value--medium';
    return 'bonus-slider-editor__value--low';
  };

  const formatCurrency = (val: number): string => {
    return `$${val.toLocaleString()}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(parseInt(e.target.value, 10));
  };

  const handleCommit = () => {
    onCommit(currentValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCommit(currentValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="bonus-slider-editor">
      <input
        ref={sliderRef}
        type="range"
        className="bonus-slider-editor__slider"
        min={minBonus}
        max={maxBonus}
        value={currentValue}
        onChange={handleChange}
        onMouseUp={handleCommit}
        onKeyDown={handleKeyDown}
      />
      <span className="bonus-slider-editor__display">
        <strong className={getColorClass()}>{formatCurrency(currentValue)}</strong>
        <small className="bonus-slider-editor__percent">({percent}%)</small>
      </span>
    </div>
  );
}
