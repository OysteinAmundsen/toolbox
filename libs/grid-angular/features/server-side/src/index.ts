/**
 * Server-side feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `serverSide` input on Grid directive.
 *
 * The grid's `ServerSideDataSource.getRows()` accepts either a `Promise` or an
 * RxJS-style `Observable` (any `Subscribable`) directly — Angular `HttpClient`
 * results work without any wrapper. Superseded requests are cancelled by the
 * grid via `unsubscribe()`, which is what causes `HttpClient` to abort the
 * underlying XHR.
 *
 * @example
 * ```typescript
 * import { Component, inject } from '@angular/core';
 * import { HttpClient } from '@angular/common/http';
 * import { map } from 'rxjs/operators';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/server-side';
 * import type { ServerSideDataSource } from '@toolbox-web/grid/plugins/server-side';
 *
 * @Component({
 *   imports: [Grid],
 *   template: `<tbw-grid [serverSide]="{ dataSource }" />`,
 * })
 * class MyGrid {
 *   private http = inject(HttpClient);
 *   dataSource: ServerSideDataSource = {
 *     getRows: (params) =>
 *       this.http.get<{ items: unknown[]; total: number }>('/api/data', {
 *         params: { offset: params.startNode, limit: params.endNode - params.startNode },
 *       }).pipe(map((d) => ({ rows: d.items, totalNodeCount: d.total }))),
 *   };
 * }
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/server-side';
export { GridServerSideDirective } from './grid-server-side.directive';
export type { _Augmentation as _ServerSideAugmentation } from '@toolbox-web/grid/features/server-side';
