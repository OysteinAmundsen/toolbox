import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { DemoIndex } from './DemoIndex';

/**
 * Demo route registry. Add a new entry here when introducing a new demo:
 *   {
 *     path: 'my-demo',
 *     label: 'My Demo',
 *     description: 'Short tagline shown on the index page.',
 *     component: lazy(() => import('../demos/my-demo')),
 *   }
 *
 * Routes are lazy-loaded so unused demos never end up in the initial bundle.
 * `/` renders the demo index listing every registered route; unknown paths
 * also fall back to the index. Existing health checks (e.g.
 * `wait-on http://localhost:4300`) keep working — `/` returns 200.
 */
const routes = [
  {
    path: 'employee-management',
    label: 'Employee Management',
    description: 'Full-featured grid with sorting, filtering, editing, master-detail and responsive card layout.',
    component: lazy(() =>
      import('../demos/employee-management/EmployeeManagement').then((m) => ({ default: m.EmployeeManagement })),
    ),
  },
] as const;

export function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<DemoIndex entries={routes} />} />
        {routes.map(({ path, component: Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
        <Route path="*" element={<DemoIndex entries={routes} />} />
      </Routes>
    </Suspense>
  );
}
