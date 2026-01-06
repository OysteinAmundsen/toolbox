import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../public';

// Import grid + all plugins
import '../../index';
import { ClipboardPlugin } from '../plugins/clipboard/ClipboardPlugin';
import { ColumnVirtualizationPlugin } from '../plugins/column-virtualization/ColumnVirtualizationPlugin';
import { ContextMenuPlugin } from '../plugins/context-menu/ContextMenuPlugin';
import { ExportPlugin } from '../plugins/export/ExportPlugin';
import { FilteringPlugin } from '../plugins/filtering/FilteringPlugin';
import { GroupingColumnsPlugin } from '../plugins/grouping-columns/GroupingColumnsPlugin';
import { GroupingRowsPlugin } from '../plugins/grouping-rows/GroupingRowsPlugin';
import { MasterDetailPlugin } from '../plugins/master-detail/MasterDetailPlugin';
import { MultiSortPlugin } from '../plugins/multi-sort/MultiSortPlugin';
import { PinnedColumnsPlugin } from '../plugins/pinned-columns/PinnedColumnsPlugin';
import { PinnedRowsPlugin } from '../plugins/pinned-rows/PinnedRowsPlugin';
import { ReorderPlugin } from '../plugins/reorder/ReorderPlugin';
import { SelectionPlugin } from '../plugins/selection/SelectionPlugin';
import { UndoRedoPlugin } from '../plugins/undo-redo/UndoRedoPlugin';
import { VisibilityPlugin } from '../plugins/visibility/VisibilityPlugin';

const meta: Meta = {
  title: 'Grid/All Features',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    rowCount: {
      control: { type: 'range', min: 50, max: 1000, step: 50 },
      description: 'Number of data rows',
      table: { category: 'Data' },
    },
    enableSelection: {
      control: 'boolean',
      description: 'Enable cell/row selection',
      table: { category: 'Features' },
    },
    enableFiltering: {
      control: 'boolean',
      description: 'Enable column filtering',
      table: { category: 'Features' },
    },
    enableSorting: {
      control: 'boolean',
      description: 'Enable multi-column sorting',
      table: { category: 'Features' },
    },
    enableEditing: {
      control: 'boolean',
      description: 'Enable inline editing',
      table: { category: 'Features' },
    },
    enableMasterDetail: {
      control: 'boolean',
      description: 'Enable expandable detail rows',
      table: { category: 'Features' },
    },
    enableRowGrouping: {
      control: 'boolean',
      description: 'Enable row grouping by department',
      table: { category: 'Features' },
    },
  },
  args: {
    rowCount: 200,
    enableSelection: true,
    enableFiltering: true,
    enableSorting: true,
    enableEditing: true,
    enableMasterDetail: true,
    enableRowGrouping: false,
  },
};
export default meta;

// =============================================================================
// REAL-WORLD DATA MODEL: Enterprise Employee Management System
// =============================================================================

interface Project {
  id: string;
  name: string;
  role: string;
  hoursLogged: number;
  status: 'active' | 'completed' | 'on-hold';
}

interface PerformanceReview {
  year: number;
  quarter: string;
  score: number;
  notes: string;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  team: string;
  title: string;
  level: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Principal' | 'Director';
  salary: number;
  bonus: number;
  status: 'Active' | 'On Leave' | 'Remote' | 'Contract' | 'Terminated';
  hireDate: string;
  lastPromotion: string | null;
  manager: string | null;
  location: string;
  timezone: string;
  skills: string[];
  rating: number;
  completedProjects: number;
  activeProjects: Project[];
  performanceReviews: PerformanceReview[];
  isTopPerformer: boolean;
}

interface AllFeaturesArgs {
  rowCount: number;
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
  enableRowGrouping: boolean;
}
type Story = StoryObj<AllFeaturesArgs>;

// =============================================================================
// REALISTIC DATA GENERATORS
// =============================================================================

const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Customer Success',
  'HR',
  'Finance',
  'Legal',
  'Operations',
];

const TEAMS: Record<string, string[]> = {
  Engineering: ['Frontend', 'Backend', 'Platform', 'Mobile', 'DevOps', 'QA'],
  Product: ['Core Product', 'Growth', 'Platform', 'Analytics'],
  Design: ['Product Design', 'UX Research', 'Brand', 'Design Systems'],
  Marketing: ['Growth', 'Content', 'Events', 'Brand', 'Partnerships'],
  Sales: ['Enterprise', 'SMB', 'Inbound', 'Partnerships'],
  'Customer Success': ['Onboarding', 'Support', 'Account Management'],
  HR: ['Recruiting', 'People Ops', 'L&D', 'Compensation'],
  Finance: ['Accounting', 'FP&A', 'Tax', 'Treasury'],
  Legal: ['Corporate', 'Commercial', 'IP', 'Compliance'],
  Operations: ['IT', 'Facilities', 'Security', 'Procurement'],
};

const TITLES: Record<string, string[]> = {
  Engineering: [
    'Software Engineer',
    'Senior Software Engineer',
    'Staff Engineer',
    'Principal Engineer',
    'Engineering Manager',
  ],
  Product: ['Product Manager', 'Senior PM', 'Director of Product', 'VP Product'],
  Design: ['Product Designer', 'Senior Designer', 'Design Lead', 'Head of Design'],
  Marketing: ['Marketing Manager', 'Senior Marketing Manager', 'Director of Marketing', 'CMO'],
  Sales: ['Account Executive', 'Senior AE', 'Sales Manager', 'VP Sales'],
  'Customer Success': ['CSM', 'Senior CSM', 'CS Manager', 'VP Customer Success'],
  HR: ['HR Coordinator', 'HR Manager', 'Senior HRBP', 'VP People'],
  Finance: ['Financial Analyst', 'Senior Analyst', 'Controller', 'CFO'],
  Legal: ['Counsel', 'Senior Counsel', 'General Counsel'],
  Operations: ['Operations Analyst', 'Operations Manager', 'VP Operations'],
};

const LOCATIONS = [
  { city: 'San Francisco', timezone: 'America/Los_Angeles' },
  { city: 'New York', timezone: 'America/New_York' },
  { city: 'Austin', timezone: 'America/Chicago' },
  { city: 'Seattle', timezone: 'America/Los_Angeles' },
  { city: 'Boston', timezone: 'America/New_York' },
  { city: 'London', timezone: 'Europe/London' },
  { city: 'Berlin', timezone: 'Europe/Berlin' },
  { city: 'Singapore', timezone: 'Asia/Singapore' },
  { city: 'Sydney', timezone: 'Australia/Sydney' },
  { city: 'Remote', timezone: 'UTC' },
];

const FIRST_NAMES = [
  'James',
  'Mary',
  'John',
  'Patricia',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Elizabeth',
  'David',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
  'Christopher',
  'Nancy',
  'Daniel',
  'Lisa',
  'Matthew',
  'Betty',
  'Anthony',
  'Margaret',
  'Mark',
  'Sandra',
  'Wei',
  'Priya',
  'Hiroshi',
  'Fatima',
  'Carlos',
  'Yuki',
  'Amir',
  'Olga',
  'Raj',
  'Chen',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Chen',
  'Patel',
  'Tanaka',
  'Kim',
  'Singh',
  'Kumar',
  'Mueller',
  'Ivanov',
  'Sato',
  'Wang',
];

const SKILLS = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'Go',
  'Rust',
  'React',
  'Vue',
  'Angular',
  'Node.js',
  'AWS',
  'GCP',
  'Azure',
  'Kubernetes',
  'Docker',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'REST APIs',
  'Microservices',
  'Machine Learning',
  'Data Analysis',
  'Agile',
  'Scrum',
  'Product Strategy',
  'User Research',
  'Figma',
  'Sketch',
];

const PROJECT_NAMES = [
  'Project Phoenix',
  'Platform Modernization',
  'Customer Portal v2',
  'Mobile App Launch',
  'Data Pipeline Rebuild',
  'Performance Optimization',
  'Security Audit',
  'API Gateway',
  'Search Infrastructure',
  'Analytics Dashboard',
  'Billing System Upgrade',
  'SSO Integration',
  'Compliance Framework',
  'Cloud Migration',
  'Developer Experience',
];

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateProjects(): Project[] {
  const count = Math.floor(Math.random() * 4) + 1;
  return Array.from({ length: count }, () => ({
    id: 'PRJ-' + Math.floor(Math.random() * 10000),
    name: randomElement(PROJECT_NAMES),
    role: randomElement(['Lead', 'Contributor', 'Reviewer', 'Advisor']),
    hoursLogged: Math.floor(Math.random() * 500) + 50,
    status: randomElement(['active', 'completed', 'on-hold'] as const),
  }));
}

function generatePerformanceReviews(): PerformanceReview[] {
  const reviews: PerformanceReview[] = [];
  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 2; year <= currentYear; year++) {
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
      if (year === currentYear && quarter === 'Q4') continue;
      reviews.push({
        year,
        quarter,
        score: Math.round((3 + Math.random() * 2) * 10) / 10,
        notes: randomElement([
          'Exceeded expectations',
          'Met all objectives',
          'Strong performer',
          'Needs improvement in communication',
          'Great team player',
          'Shows leadership potential',
          'Consistent delivery',
          'Innovative problem solver',
        ]),
      });
    }
  }
  return reviews.slice(-6);
}

function generateEmployees(count: number): Employee[] {
  const employees: Employee[] = [];
  const levels: Employee['level'][] = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'];
  const statuses: Employee['status'][] = ['Active', 'On Leave', 'Remote', 'Contract', 'Terminated'];

  const managers: string[] = [];
  for (let i = 0; i < Math.floor(count / 10); i++) {
    managers.push(randomElement(FIRST_NAMES) + ' ' + randomElement(LAST_NAMES));
  }

  for (let i = 0; i < count; i++) {
    const department = randomElement(DEPARTMENTS);
    const teams = TEAMS[department] || ['General'];
    const titles = TITLES[department] || ['Specialist'];
    const location = randomElement(LOCATIONS);
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const level = levels[Math.min(Math.floor(Math.random() * 6), 5)];
    const hireDate = randomDate(new Date('2018-01-01'), new Date('2025-06-01'));
    const rating = Math.round((3 + Math.random() * 2) * 10) / 10;

    const baseSalaries: Record<Employee['level'], number> = {
      Junior: 60000,
      Mid: 85000,
      Senior: 120000,
      Lead: 150000,
      Principal: 180000,
      Director: 220000,
    };
    const salary = baseSalaries[level] + Math.floor(Math.random() * 30000) - 15000;

    employees.push({
      id: 1001 + i,
      firstName,
      lastName,
      email: firstName.toLowerCase() + '.' + lastName.toLowerCase() + '@company.com',
      department,
      team: randomElement(teams),
      title: randomElement(titles),
      level,
      salary,
      bonus: Math.round(salary * (0.05 + Math.random() * 0.15)),
      status: Math.random() > 0.1 ? (Math.random() > 0.3 ? 'Active' : 'Remote') : randomElement(statuses),
      hireDate,
      lastPromotion: Math.random() > 0.4 ? randomDate(new Date(hireDate), new Date()) : null,
      manager: Math.random() > 0.1 ? randomElement(managers) : null,
      location: location.city,
      timezone: location.timezone,
      skills: randomElements(SKILLS, 3, 8),
      rating,
      completedProjects: Math.floor(Math.random() * 20),
      activeProjects: generateProjects(),
      performanceReviews: generatePerformanceReviews(),
      isTopPerformer: rating >= 4.5,
    });
  }

  return employees;
}

// =============================================================================
// MASTER-DETAIL RENDERER
// =============================================================================

function createDetailRenderer(employee: Employee): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText =
    'padding: 16px 24px; background: var(--tbw-grid-row-alt-bg, #f8f9fa); border-top: 1px solid var(--tbw-grid-border-color, #dee2e6);';

  const projectsHtml = employee.activeProjects
    .map(
      (p) =>
        '<tr>' +
        '<td style="padding: 6px 12px; border-bottom: 1px solid #eee;">' +
        p.id +
        '</td>' +
        '<td style="padding: 6px 12px; border-bottom: 1px solid #eee;">' +
        p.name +
        '</td>' +
        '<td style="padding: 6px 12px; border-bottom: 1px solid #eee;">' +
        p.role +
        '</td>' +
        '<td style="padding: 6px 12px; border-bottom: 1px solid #eee;">' +
        p.hoursLogged +
        'h</td>' +
        '<td style="padding: 6px 12px; border-bottom: 1px solid #eee;">' +
        '<span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; background: ' +
        (p.status === 'active' ? '#d4edda' : p.status === 'completed' ? '#cce5ff' : '#fff3cd') +
        '; color: ' +
        (p.status === 'active' ? '#155724' : p.status === 'completed' ? '#004085' : '#856404') +
        ';">' +
        p.status +
        '</span></td></tr>',
    )
    .join('');

  const reviewsHtml = employee.performanceReviews
    .slice(-4)
    .map(
      (r) =>
        '<div style="padding: 8px 12px; background: white; border-radius: 6px; border: 1px solid #eee;">' +
        '<div style="font-weight: 600; font-size: 12px; color: #666;">' +
        r.quarter +
        ' ' +
        r.year +
        '</div>' +
        '<div style="font-size: 18px; font-weight: 700; color: ' +
        (r.score >= 4 ? '#28a745' : r.score >= 3 ? '#ffc107' : '#dc3545') +
        ';">' +
        r.score.toFixed(1) +
        '</div>' +
        '<div style="font-size: 11px; color: #888; margin-top: 4px;">' +
        r.notes +
        '</div></div>',
    )
    .join('');

  const skillsHtml = employee.skills
    .map(
      (s) =>
        '<span style="padding: 4px 10px; background: #e7f3ff; color: #0066cc; border-radius: 14px; font-size: 12px;">' +
        s +
        '</span>',
    )
    .join('');

  container.innerHTML =
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">' +
    '<div>' +
    '<h4 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">Active Projects</h4>' +
    '<table style="width: 100%; border-collapse: collapse; font-size: 13px; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">' +
    '<thead><tr style="background: #f1f3f4;">' +
    '<th style="padding: 8px 12px; text-align: left; font-weight: 600;">ID</th>' +
    '<th style="padding: 8px 12px; text-align: left; font-weight: 600;">Project</th>' +
    '<th style="padding: 8px 12px; text-align: left; font-weight: 600;">Role</th>' +
    '<th style="padding: 8px 12px; text-align: left; font-weight: 600;">Hours</th>' +
    '<th style="padding: 8px 12px; text-align: left; font-weight: 600;">Status</th>' +
    '</tr></thead><tbody>' +
    projectsHtml +
    '</tbody></table>' +
    '</div>' +
    '<div>' +
    '<h4 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">Performance Reviews</h4>' +
    '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">' +
    reviewsHtml +
    '</div>' +
    '<div style="margin-top: 16px;">' +
    '<h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">Skills</h4>' +
    '<div style="display: flex; flex-wrap: wrap; gap: 6px;">' +
    skillsHtml +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>';

  return container;
}

// =============================================================================
// STORY DEFINITION
// =============================================================================

/**
 * ## Enterprise Employee Management Grid
 *
 * This comprehensive demo simulates a **real-world enterprise employee management system**
 * with all major grid features enabled. It demonstrates how @toolbox-web/grid handles
 * complex business requirements in production scenarios.
 *
 * ### Features Demonstrated
 *
 * #### Data & Display
 * - **200+ employees** with realistic data (names, departments, salaries, projects)
 * - **Column groups** organizing related fields ("Employee Info", "Compensation", "Status")
 * - **Pinned columns** (ID on left)
 * - **Column virtualization** for efficient rendering of many columns
 * - **Custom formatters** for currency, dates, and status badges
 *
 * #### Interaction
 * - **Selection**: Click cells, Shift+Click for range, Ctrl+Click for multi-select
 * - **Multi-column sorting**: Click headers; Shift+Click for secondary sort
 * - **Filtering**: Click filter icon in headers for column-specific filtering
 * - **Column reorder**: Drag headers to rearrange columns
 * - **Context menu**: Right-click for copy, export, hide column options
 *
 * #### Editing
 * - **Inline editing**: Double-click any editable cell (Name, Salary, Status, etc.)
 * - **Undo/Redo**: Ctrl+Z / Ctrl+Y to revert or replay changes
 * - **Clipboard**: Ctrl+C to copy selection, Ctrl+V to paste
 *
 * #### Master-Detail
 * - **Expandable rows**: Click the arrow to expand and see employee projects and reviews
 * - **Rich detail views**: Nested tables, performance scores, skill tags
 *
 * #### Row Grouping (Toggle via control)
 * - **Group by department**: Collapsible groups with aggregated totals
 * - **Aggregations**: Sum of salaries, average ratings per group
 *
 * #### Data Export
 * - **Export to CSV/JSON**: Via context menu or Export plugin API
 * - **Status bar**: Shows row count, filtered count, and salary totals
 *
 * ### Try These Actions
 *
 * 1. **Filter by department**: Click the filter icon on "Dept" column
 * 2. **Multi-sort**: Click "Salary" then Shift+Click "Rating"
 * 3. **Expand a row**: Click the arrow icon to see projects and reviews
 * 4. **Edit inline**: Double-click a name or salary cell
 * 5. **Undo changes**: Press Ctrl+Z after editing
 * 6. **Export data**: Right-click -> Export -> CSV
 * 7. **Toggle grouping**: Enable "Row Grouping" in controls above
 */
export const AllFeatures: Story = {
  parameters: {
    docs: {
      source: {
        code: '// See full source code in libs/grid/src/lib/core/all.stories.ts',
        language: 'typescript',
      },
    },
  },
  render: (args: AllFeaturesArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 600px; display: block;';

    // Status badge view renderer
    const statusViewRenderer = ({ value }: { value: string }) => {
      const colors: Record<string, { bg: string; text: string }> = {
        Active: { bg: '#d4edda', text: '#155724' },
        Remote: { bg: '#cce5ff', text: '#004085' },
        'On Leave': { bg: '#fff3cd', text: '#856404' },
        Contract: { bg: '#e2e3e5', text: '#383d41' },
        Terminated: { bg: '#f8d7da', text: '#721c24' },
      };
      const style = colors[value] || { bg: '#eee', text: '#333' };
      return (
        '<span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ' +
        style.bg +
        '; color: ' +
        style.text +
        ';">' +
        value +
        '</span>'
      );
    };

    // Boolean star renderer for top performer
    const topPerformerRenderer = ({ value }: { value: boolean }) => {
      return value
        ? '<span style="color: #ffc107; font-size: 16px;">★</span>'
        : '<span style="color: #ddd; font-size: 16px;">☆</span>';
    };

    // Rating renderer with color coding
    const ratingRenderer = ({ value }: { value: number }) => {
      const color = value >= 4.5 ? '#28a745' : value >= 3.5 ? '#ffc107' : '#dc3545';
      return '<span style="color: ' + color + '; font-weight: 600;">' + value.toFixed(1) + ' ★</span>';
    };

    grid.gridConfig = {
      columnGroups: [
        { id: 'employee', header: 'Employee Info', children: ['id', 'firstName', 'lastName', 'email'] },
        { id: 'organization', header: 'Organization', children: ['department', 'team', 'title', 'level'] },
        { id: 'compensation', header: 'Compensation', children: ['salary', 'bonus'] },
        {
          id: 'status',
          header: 'Status & Performance',
          children: ['status', 'hireDate', 'rating', 'isTopPerformer', 'location'],
        },
      ],
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 70, sortable: true },
        {
          field: 'firstName',
          header: 'First Name',
          minWidth: 100,
          editable: args.enableEditing,
          sortable: true,
          resizable: true,
        },
        {
          field: 'lastName',
          header: 'Last Name',
          minWidth: 100,
          editable: args.enableEditing,
          sortable: true,
          resizable: true,
        },
        { field: 'email', header: 'Email', minWidth: 200, resizable: true },
        {
          field: 'department',
          header: 'Dept',
          width: 120,
          sortable: true,
          editable: args.enableEditing,
          type: 'select',
          options: DEPARTMENTS.map((d) => ({ label: d, value: d })),
        },
        { field: 'team', header: 'Team', width: 110, sortable: true },
        { field: 'title', header: 'Title', minWidth: 160, editable: args.enableEditing, resizable: true },
        {
          field: 'level',
          header: 'Level',
          width: 90,
          sortable: true,
          editable: args.enableEditing,
          type: 'select',
          options: [
            { label: 'Junior', value: 'Junior' },
            { label: 'Mid', value: 'Mid' },
            { label: 'Senior', value: 'Senior' },
            { label: 'Lead', value: 'Lead' },
            { label: 'Principal', value: 'Principal' },
            { label: 'Director', value: 'Director' },
          ],
        },
        {
          field: 'salary',
          header: 'Salary',
          type: 'number',
          width: 110,
          editable: args.enableEditing,
          sortable: true,
          resizable: true,
          format: (v: number) =>
            v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        },
        {
          field: 'bonus',
          header: 'Bonus',
          type: 'number',
          width: 100,
          sortable: true,
          format: (v: number) =>
            v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        },
        {
          field: 'status',
          header: 'Status',
          width: 100,
          sortable: true,
          editable: args.enableEditing,
          type: 'select',
          options: [
            { label: 'Active', value: 'Active' },
            { label: 'Remote', value: 'Remote' },
            { label: 'On Leave', value: 'On Leave' },
            { label: 'Contract', value: 'Contract' },
            { label: 'Terminated', value: 'Terminated' },
          ],
          viewRenderer: statusViewRenderer,
        },
        { field: 'hireDate', header: 'Hire Date', type: 'date', width: 110, sortable: true },
        { field: 'rating', header: 'Rating', type: 'number', width: 85, sortable: true, viewRenderer: ratingRenderer },
        { field: 'isTopPerformer', header: '⭐', type: 'boolean', width: 50, viewRenderer: topPerformerRenderer },
        { field: 'location', header: 'Location', width: 110, sortable: true },
      ],
      editOn: 'dblclick',
      plugins: [
        // Selection & Interaction
        ...(args.enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
        ...(args.enableSorting ? [new MultiSortPlugin()] : []),
        ...(args.enableFiltering ? [new FilteringPlugin({ debounceMs: 200 })] : []),
        new ClipboardPlugin(),
        new ContextMenuPlugin(),
        new ReorderPlugin(),

        // Layout & Display
        new GroupingColumnsPlugin(),
        new PinnedColumnsPlugin(),
        new ColumnVirtualizationPlugin(),
        new VisibilityPlugin(),

        // Row Grouping (optional)
        ...(args.enableRowGrouping
          ? [
              new GroupingRowsPlugin({
                groupOn: (row: Employee) => row.department,
                defaultExpanded: true,
                showRowCount: true,
                aggregators: { salary: 'sum', rating: 'avg' },
              }),
            ]
          : []),

        // Master-Detail (optional, conflicts with row grouping visually)
        ...(!args.enableRowGrouping && args.enableMasterDetail
          ? [
              new MasterDetailPlugin({
                detailRenderer: (row: Employee) => createDetailRenderer(row),
                showExpandColumn: true,
                animation: 'slide',
              }),
            ]
          : []),

        // Editing
        ...(args.enableEditing ? [new UndoRedoPlugin({ maxHistorySize: 100 })] : []),

        // Export
        new ExportPlugin(),

        // Status Bar
        new PinnedRowsPlugin({
          position: 'bottom',
          showRowCount: true,
          showFilteredCount: true,
          aggregationRows: [
            {
              id: 'totals',
              position: 'bottom',
              cells: {
                id: 'Summary:',
                salary: (rows: unknown[]) => {
                  const sum = (rows as Employee[]).reduce((acc, r) => acc + (r.salary || 0), 0);
                  return sum.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
                },
                bonus: (rows: unknown[]) => {
                  const sum = (rows as Employee[]).reduce((acc, r) => acc + (r.bonus || 0), 0);
                  return sum.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
                },
                rating: (rows: unknown[]) => {
                  const vals = (rows as Employee[]).map((r) => r.rating).filter(Boolean);
                  return vals.length ? 'Avg: ' + (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '';
                },
              },
            },
          ],
        }),
      ],
    };

    grid.rows = generateEmployees(args.rowCount);

    return grid;
  },
};

/**
 * ## Row Grouping Demo
 *
 * This variant demonstrates **row grouping** with the same enterprise data.
 * Employees are grouped by department with aggregate calculations.
 *
 * - Expand/collapse groups by clicking the group header
 * - Shows employee count per department
 * - Aggregates salary sum and average rating per group
 */
export const GroupedByDepartment: Story = {
  args: {
    rowCount: 150,
    enableSelection: true,
    enableFiltering: true,
    enableSorting: true,
    enableEditing: true,
    enableMasterDetail: false,
    enableRowGrouping: true,
  },
  render: (args: AllFeaturesArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 600px; display: block;';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 70, sortable: true },
        { field: 'firstName', header: 'First Name', minWidth: 100, sortable: true },
        { field: 'lastName', header: 'Last Name', minWidth: 100, sortable: true },
        { field: 'department', header: 'Dept', width: 120, sortable: true },
        { field: 'team', header: 'Team', width: 110, sortable: true },
        { field: 'title', header: 'Title', minWidth: 160 },
        { field: 'level', header: 'Level', width: 90, sortable: true },
        {
          field: 'salary',
          header: 'Salary',
          type: 'number',
          width: 110,
          sortable: true,
          format: (v: number) =>
            v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        },
        { field: 'rating', header: 'Rating', type: 'number', width: 80, sortable: true },
        { field: 'location', header: 'Location', width: 110, sortable: true },
      ],
      plugins: [
        ...(args.enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
        ...(args.enableSorting ? [new MultiSortPlugin()] : []),
        ...(args.enableFiltering ? [new FilteringPlugin({ debounceMs: 200 })] : []),
        new ClipboardPlugin(),
        new ContextMenuPlugin(),
        new PinnedColumnsPlugin(),
        new VisibilityPlugin(),
        new ExportPlugin(),
        new GroupingRowsPlugin({
          groupOn: (row: Employee) => row.department,
          defaultExpanded: true,
          showRowCount: true,
          indentWidth: 24,
          aggregators: { salary: 'sum', rating: 'avg' },
        }),
        new PinnedRowsPlugin({
          position: 'bottom',
          showRowCount: true,
          showFilteredCount: true,
        }),
      ],
    };

    grid.rows = generateEmployees(args.rowCount);

    return grid;
  },
};
