/**
 * Shared Data Generation Module for Employee Management Demo
 *
 * This module is shared across all framework implementations
 * (Vanilla, React, Angular, Vue) of the Employee Management demo.
 */

import type { Employee, PerformanceReview, Project } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEPARTMENTS = [
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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

// =============================================================================
// GENERATOR FUNCTIONS
// =============================================================================

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

/**
 * Generates an array of realistic employee data.
 *
 * @param count - The number of employees to generate
 * @returns An array of Employee objects with randomized but realistic data
 */
export function generateEmployees(count: number): Employee[] {
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
