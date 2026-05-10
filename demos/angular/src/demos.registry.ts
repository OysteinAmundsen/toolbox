/**
 * Demo registry — single source of truth for both the routing table and
 * the demo index page. Add a new entry here when introducing a new demo.
 */

import type { Type } from '@angular/core';

export interface DemoEntry {
  path: string;
  label: string;
  description?: string;
  /** Lazy component loader compatible with `Route.loadComponent`. */
  loadComponent: () => Promise<Type<unknown>>;
}

export const DEMOS: DemoEntry[] = [
  {
    path: 'employee-management',
    label: 'Employee Management',
    description:
      'Full-featured grid with sorting, filtering, editing, master-detail and responsive card layout.',
    loadComponent: () =>
      import('./demos/employee-management/employee-management.component').then(
        (m) => m.EmployeeManagementComponent,
      ),
  },
];
