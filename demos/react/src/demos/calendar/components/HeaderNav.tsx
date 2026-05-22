const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const YEAR_RANGE = 5;

export interface HeaderNavProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
}

export function HeaderNav({ year, month, onYearChange }: HeaderNavProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_value, index) => currentYear - YEAR_RANGE + index);

  return (
    <div className="cal-header">
      <span className="cal-header__title">{MONTH_NAMES[month]}</span>
      <select className="cal-header__year" aria-label="Year" value={year} onChange={(event) => onYearChange(Number(event.target.value))}>
        {years.map((optionYear) => (
          <option key={optionYear} value={optionYear}>
            {optionYear}
          </option>
        ))}
      </select>
    </div>
  );
}
