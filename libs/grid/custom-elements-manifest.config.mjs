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

export default {
  globs: ['src/lib/core/grid.ts'],
  exclude: ['**/*.spec.ts', '**/*.stories.ts', '**/internal/**'],
  outdir: '../../dist/libs/grid',
  litelement: false,
  plugins: [
    // Use lit plugin for better JSDoc parsing
    ...litPlugin(),
    filterPrivatePlugin(),
  ],
};
