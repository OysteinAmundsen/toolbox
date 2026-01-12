import { useEffect, useRef, useState } from 'react';

/**
 * StatusSelectEditor - Dropdown status editor with icons
 * Matches Angular: app-status-select-editor
 */
interface StatusSelectEditorProps {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

interface StatusConfig {
  bg: string;
  text: string;
  icon: string;
}

const STATUS_OPTIONS: string[] = ['Active', 'Remote', 'On Leave', 'Contract', 'Terminated'];
const STATUS_CONFIG: Record<string, StatusConfig> = {
  Active: { bg: '#d4edda', text: '#155724', icon: '✓' },
  Remote: { bg: '#cce5ff', text: '#004085', icon: '🏠' },
  'On Leave': { bg: '#fff3cd', text: '#856404', icon: '🌴' },
  Contract: { bg: '#e2e3e5', text: '#383d41', icon: '📄' },
  Terminated: { bg: '#f8d7da', text: '#721c24', icon: '✗' },
};

export function StatusSelectEditor({ value, onCommit, onCancel }: StatusSelectEditorProps) {
  const [currentValue, setCurrentValue] = useState(value || 'Active');
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    // Focus the select after mount
    setTimeout(() => selectRef.current?.focus(), 0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setCurrentValue(newValue);
    onCommit(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="status-select-editor">
      <select
        ref={selectRef}
        className="status-select-editor__select"
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {STATUS_CONFIG[status].icon} {status}
          </option>
        ))}
      </select>
    </div>
  );
}
