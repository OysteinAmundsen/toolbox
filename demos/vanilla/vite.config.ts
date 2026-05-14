import { resolve } from 'path';
import { defineConfig } from 'vite';
import { bookingLogsApiPlugin } from '../shared/booking-logs/vite-plugin';
import { getResolveAliases } from '../shared/resolve-aliases';

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: getResolveAliases(__dirname),
  },
  plugins: [bookingLogsApiPlugin()],
  server: {
    port: 4000,
    open: false,
  },
  build: {
    outDir: resolve(__dirname, '../../dist/demos/vanilla'),
    emptyOutDir: true,
  },
});
