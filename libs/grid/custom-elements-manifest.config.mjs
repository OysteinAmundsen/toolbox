import { litPlugin } from '@custom-elements-manifest/analyzer/src/features/framework-plugins/lit/lit.js';

// Plugin to filter out private/internal members and set readme
function filterPrivatePlugin() {
  return {
    name: 'filter-private',
    moduleLinkPhase({ moduleDoc }) {
      // Filter class members
      moduleDoc.declarations?.forEach((declaration) => {
        if (declaration.members) {
          declaration.members = declaration.members.filter((member) => {
            // Filter out ES private fields (#), underscore-prefixed, explicitly private, or @internal
            if (member.name?.startsWith('#')) return false;
            if (member.name?.startsWith('_')) return false;
            if (member.privacy === 'private') return false;
            if (member.description?.includes('@internal')) return false;
            return true;
          });
        }
      });

      // Filter out stray variable declarations (only keep classes)
      if (moduleDoc.declarations) {
        moduleDoc.declarations = moduleDoc.declarations.filter(
          (decl) => decl.kind === 'class' || decl.kind === 'function',
        );
      }
    },
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.readme = 'README.md';
    },
  };
}

/**
 * Plugin to strip circular TypeScript AST node references that the analyzer
 * occasionally leaks into the manifest (e.g. `Promise<T | undefined>` on a
 * generic class). Without this, JSON.stringify crashes with
 * "Converting circular structure to JSON".
 */
function sanitizeCircularRefsPlugin() {
  return {
    name: 'sanitize-circular-refs',
    packageLinkPhase({ customElementsManifest }) {
      const seen = new WeakSet();

      function walk(obj) {
        if (obj == null || typeof obj !== 'object') return obj;
        if (seen.has(obj)) return undefined; // break circular ref
        seen.add(obj);

        // TS AST nodes leak as objects with `kind` (number) + `parent` back-ref
        if (typeof obj.kind === 'number' && obj.parent && typeof obj.getText === 'function') {
          return undefined;
        }

        if (Array.isArray(obj)) {
          for (let i = obj.length - 1; i >= 0; i--) {
            const cleaned = walk(obj[i]);
            if (cleaned === undefined) obj.splice(i, 1);
            else obj[i] = cleaned;
          }
        } else {
          for (const key of Object.keys(obj)) {
            const cleaned = walk(obj[key]);
            if (cleaned === undefined) delete obj[key];
            else obj[key] = cleaned;
          }
        }
        return obj;
      }

      walk(customElementsManifest);
    },
  };
}

export default {
  globs: ['src/lib/core/grid.ts'],
  exclude: ['**/*.spec.ts', '**/*.stories.ts', '**/internal/**'],
  outdir: '../../dist/libs/grid',
  litelement: false,
  plugins: [
    // Use lit plugin for better JSDoc parsing
    ...litPlugin(),
    filterPrivatePlugin(),
    sanitizeCircularRefsPlugin(),
  ],
};
