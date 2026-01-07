/**
 * Data Model for the Employee Management Demo
 *
 * This file contains all type definitions used by the Employee Management
 * Storybook demo, which showcases a realistic enterprise HR system with
 * employees, projects, performance reviews, and various grid features.
 */

/**
 * GridElement type for demos - uses any for flexibility when accessing
 * dynamic properties on the grid component.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GridElement = HTMLElement & { [key: string]: any };

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
 * Storybook args interface for the AllFeatures story.
 * Controls the configurable features of the Employee Management demo.
 */
export interface AllFeaturesArgs {
  rowCount: number;
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
  enableRowGrouping: boolean;
}
