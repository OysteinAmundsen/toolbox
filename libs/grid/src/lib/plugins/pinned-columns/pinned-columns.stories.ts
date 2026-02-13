import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { PinnedColumnsPlugin } from './PinnedColumnsPlugin';
import type { PinnedPosition } from './types';

// Import grid component
import '../../../index';

// #region Data Generation
const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
const LAST_NAMES = ['Johnson', 'Smith', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Legal', 'Support', 'Design'];
const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'Dallas'];
const COUNTRIES = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Australia', 'Japan', 'Brazil'];

function generateRows(count: number) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    rows.push({
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      phone: `+1-555-${String(i).padStart(4, '0')}`,
      address: `${100 + i} ${['Main', 'Oak', 'Pine', 'Elm', 'Maple'][i % 5]} St`,
      city: CITIES[i % CITIES.length],
      country: COUNTRIES[i % COUNTRIES.length],
      actions: '...',
    });
  }
  return rows;
}

const sampleData = generateRows(1000);
// #endregion

// #region Pin Position Helper
type PinOption = 'none' | 'left' | 'right';

function toPinned(value: PinOption): PinnedPosition | undefined {
  return value === 'none' ? undefined : value;
}

const pinControl = {
  control: { type: 'select' as const },
  options: ['none', 'left', 'right'],
  table: { category: 'Column Pinning', type: { summary: "'none' | 'left' | 'right'" } },
};
// #endregion

// #region Meta
interface PinnedColumnsArgs {
  pinId: PinOption;
  pinName: PinOption;
  pinEmail: PinOption;
  pinDepartment: PinOption;
  pinPhone: PinOption;
  pinAddress: PinOption;
  pinCity: PinOption;
  pinCountry: PinOption;
  pinActions: PinOption;
}

const meta: Meta<PinnedColumnsArgs> = {
  title: 'Grid/Plugins/Pinned Columns',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    pinId: { ...pinControl, name: 'ID', description: 'Pin position for the ID column' },
    pinName: { ...pinControl, name: 'Name', description: 'Pin position for the Name column' },
    pinEmail: { ...pinControl, name: 'Email', description: 'Pin position for the Email column' },
    pinDepartment: { ...pinControl, name: 'Department', description: 'Pin position for the Department column' },
    pinPhone: { ...pinControl, name: 'Phone', description: 'Pin position for the Phone column' },
    pinAddress: { ...pinControl, name: 'Address', description: 'Pin position for the Address column' },
    pinCity: { ...pinControl, name: 'City', description: 'Pin position for the City column' },
    pinCountry: { ...pinControl, name: 'Country', description: 'Pin position for the Country column' },
    pinActions: { ...pinControl, name: 'Actions', description: 'Pin position for the Actions column' },
  },
  args: {
    pinId: 'left',
    pinName: 'left',
    pinEmail: 'none',
    pinDepartment: 'none',
    pinPhone: 'none',
    pinAddress: 'none',
    pinCity: 'none',
    pinCountry: 'none',
    pinActions: 'right',
  },
};
export default meta;

type Story = StoryObj<PinnedColumnsArgs>;
// #endregion

/**
 * Pin columns to the left or right side of the grid. Use the controls below
 * to change which columns are pinned and scroll horizontally to see them
 * stay fixed in place. 1 000 rows are generated to also test vertical
 * virtualization interaction with sticky positioning.
 */
export const Default: Story = {
  render: (args) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '500px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 60, pinned: toPinned(args.pinId) },
        { field: 'name', header: 'Name', width: 150, pinned: toPinned(args.pinName) },
        { field: 'email', header: 'Email', width: 220, pinned: toPinned(args.pinEmail) },
        { field: 'department', header: 'Department', width: 150, pinned: toPinned(args.pinDepartment) },
        { field: 'phone', header: 'Phone', width: 150, pinned: toPinned(args.pinPhone) },
        { field: 'address', header: 'Address', width: 250, pinned: toPinned(args.pinAddress) },
        { field: 'city', header: 'City', width: 120, pinned: toPinned(args.pinCity) },
        { field: 'country', header: 'Country', width: 120, pinned: toPinned(args.pinCountry) },
        { field: 'actions', header: 'Actions', width: 100, pinned: toPinned(args.pinActions) },
      ],
      fitMode: 'fixed',
      plugins: [new PinnedColumnsPlugin()],
    };

    grid.rows = sampleData;

    return grid;
  },
};
