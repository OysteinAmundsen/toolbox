/**
 * Server Side Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 */
export { ServerSidePlugin } from './ServerSidePlugin';
export type { ServerSideConfig, ServerSideDataSource, GetRowsParams, GetRowsResult } from './types';
