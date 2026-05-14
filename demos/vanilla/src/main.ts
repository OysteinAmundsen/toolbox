/**
 * Vanilla demo shell — bootstrap entry.
 *
 * Registers every route, then hands off to the router which mounts the
 * route matching `location.pathname`. Add new demos by creating
 * `src/demos/<name>/index.ts` with a `mount(host)` export and listing it here.
 */

import { startRouter } from './shell/router';

// Shared demo styles — loaded eagerly so the demo index page (`/`) renders
// against the same background/typography tokens as the route pages. Per-demo
// route modules also import this, but importing here ensures `/` looks right
// before any route module loads.
import '@demo/shared/demo-index.css';
import '@demo/shared/employee-management/demo-styles.css';

const host = document.getElementById('app');
if (!host) {
  throw new Error('Vanilla demo shell: missing #app host element');
}

startRouter({
  host,
  routes: [
    {
      name: 'employee-management',
      label: 'Employee Management',
      description: 'Full-featured grid with sorting, filtering, editing, master-detail and responsive card layout.',
      load: () => import('./demos/employee-management'),
    },
    {
      name: 'booking-logs',
      label: 'Booking API Logs',
      description: 'Server-side infinite scroll over a deterministic 10-million-row log dataset, with filters and a side detail panel.',
      load: () => import('./demos/booking-logs'),
    },
  ],
});
