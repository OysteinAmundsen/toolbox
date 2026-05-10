import { useEffect, useRef, useState } from 'react';

/**
 * DateEditor - Native HTML5 date input editor
 * Matches Angular: app-date-editor
 */
interface DateEditorProps {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function DateEditor({ value, onCommit, onCancel }: DateEditorProps) {
  const [currentValue, setCurrentValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input after mount
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCurrentValue(newValue);
    onCommit(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCommit(currentValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="date"
      className="date-editor"
      value={currentValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}
