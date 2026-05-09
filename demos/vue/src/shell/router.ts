import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DemoIndex from './DemoIndex.vue';

/**
 * Demo route registry. Add a new entry here when introducing a new demo:
 *   {
 *     path: '/my-demo',
 *     label: 'My Demo',
 *     description: 'Short tagline shown on the index page.',
 *     component: () => import('../demos/my-demo/MyDemo.vue'),
 *   }
 *
 * Each route is an `() => import(...)` so unused demos never end up in the
 * initial bundle. `/` renders the demo index listing every registered route;
 * unknown paths also render the index. Existing health checks (e.g.
 * `wait-on http://localhost:4100`) keep working — `/` returns 200.
 */
interface DemoRoute {
  path: string;
  label: string;
  description?: string;
  component: () => Promise<unknown>;
}

const demoRoutes: DemoRoute[] = [
  {
    path: '/employee-management',
    label: 'Employee Management',
    description: 'Full-featured grid with sorting, filtering, editing, master-detail and responsive card layout.',
    component: () => import('../demos/employee-management/EmployeeManagement.vue'),
  },
];

const indexEntries = demoRoutes.map((r) => ({
  path: r.path.replace(/^\//, ''),
  label: r.label,
  description: r.description,
}));

const routes: RouteRecordRaw[] = [
  { path: '/', component: DemoIndex, props: { entries: indexEntries } },
  ...demoRoutes.map(
    (r): RouteRecordRaw => ({
      path: r.path,
      component: r.component,
    }),
  ),
  { path: '/:pathMatch(.*)*', component: DemoIndex, props: { entries: indexEntries } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
