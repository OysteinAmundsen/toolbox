import type { Routes } from '@angular/router';
import { DemoIndexComponent } from './demo-index.component';
import { DEMOS } from './demos.registry';

/**
 * Demo routing table. To add a new demo, append to `DEMOS` in
 * `demos.registry.ts` — both this routing table and the demo index page
 * (`/`) read from the same source.
 *
 * `/` renders the demo index listing every registered route; unknown paths
 * also render the index. Existing health checks (e.g.
 * `wait-on http://localhost:4200`) keep working — `/` returns 200.
 */
export const routes: Routes = [
  { path: '', component: DemoIndexComponent, pathMatch: 'full' },
  ...DEMOS.map((demo) => ({
    path: demo.path,
    loadComponent: demo.loadComponent,
  })),
  { path: '**', component: DemoIndexComponent },
];
