/**
 * Tiny path-based router for the vanilla demo shell.
 *
 * Each route is a folder under `src/demos/<name>/` that exports a `mount(host)`
 * function. Navigation matches `location.pathname` against registered names
 * (e.g. `/employee-management`); `/` (and any unknown path) renders the demo
 * index listing every registered route.
 */

import { renderDemoIndex } from './demo-index';

export type RouteMount = (host: HTMLElement) => () => void;

export interface RouteDefinition {
  /** Path segment, e.g. 'employee-management'. Used as `/<name>`. */
  name: string;
  /** Human-readable title shown on the demo index page. */
  label: string;
  /** Optional one-liner shown beneath the title on the index page. */
  description?: string;
  /** Lazy import of the route module so unused routes never bundle. */
  load: () => Promise<{ mount: RouteMount }>;
}

export interface RouterOptions {
  host: HTMLElement;
  routes: RouteDefinition[];
}

export function startRouter({ host, routes }: RouterOptions): void {
  if (routes.length === 0) {
    throw new Error('startRouter: at least one route is required');
  }

  let teardown: (() => void) | null = null;

  const matchRoute = (): RouteDefinition | null => {
    const segment = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!segment) return null;
    return routes.find((r) => r.name === segment) ?? null;
  };

  const navigate = async () => {
    teardown?.();
    teardown = null;
    host.innerHTML = '';

    const route = matchRoute();
    if (!route) {
      teardown = renderDemoIndex(host, routes);
      return;
    }
    const mod = await route.load();
    teardown = mod.mount(host);
  };

  window.addEventListener('popstate', () => {
    void navigate();
  });

  void navigate();
}
