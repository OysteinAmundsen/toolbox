/**
 * Server Side Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Server-Side
 */
export { ServerSidePlugin } from './ServerSidePlugin';
export type { GetRowsParams, GetRowsResult, ServerSideConfig, ServerSideDataSource } from './types';
