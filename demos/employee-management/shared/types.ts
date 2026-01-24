/**
 * Shared Data Models for Employee Management Demo
 *
 * These type definitions are shared across all framework implementations
 * (Vanilla, React, Angular, Vue) of the Employee Management demo.
 */

// Re-export grid element type for easier imports in demos
export type { TbwGrid as GridElement } from '@toolbox-web/grid';

/**
 * Represents a project that an employee is working on or has completed.
 */
export interface Project {
  id: string;
  name: string;
  role: string;
  hoursLogged: number;
  status: 'active' | 'completed' | 'on-hold';
}

/**
 * Represents a quarterly performance review for an employee.
 */
export interface PerformanceReview {
  year: number;
  quarter: string;
  score: number;
  notes: string;
}

/**
 * Represents an employee record in the HR management system.
 */
export interface Employee {
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

/**
 * Configuration options for the demo (used by story controls).
 */
export interface DemoConfig {
  rowCount: number;
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
  enableRowGrouping: boolean;
}
