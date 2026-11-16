import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import MagicString from 'magic-string';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Test the shared build helper through its grid consumer.
import { rewriteDtsSpecifiers } from '../../../tools/vite-dts-esm-specifiers';

describe('rewriteDtsSpecifiers', () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'dts-source-map-'));
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('composes rewritten declaration mappings with the original declaration map', () => {
    const declarationPath = join(tempDirectory, 'index.d.ts');
    const typesPath = join(tempDirectory, 'types.d.ts');
    const declaration = "export { Foo } from './types'; export type Bar = string;\n";
    const originalMap = new MagicString(declaration).generateMap({
      file: basename(declarationPath),
      source: 'source.ts',
      hires: true,
      includeContent: false,
    });
    const mapPath = `${declarationPath}.map`;
    const emittedFiles = new Map([
      [declarationPath, declaration],
      [mapPath, originalMap.toString()],
      [typesPath, 'export type Foo = string;\n'],
    ]);

    rewriteDtsSpecifiers(emittedFiles);

    const rewrittenDeclaration = emittedFiles.get(declarationPath);
    const rewrittenMap = emittedFiles.get(mapPath);
    if (!rewrittenDeclaration || !rewrittenMap) {
      throw new Error('Expected rewritten declaration and source map');
    }

    const mapOnDisk = readFileSync(mapPath, 'utf8');
    const mappedPosition = originalPositionFor(new TraceMap(JSON.parse(mapOnDisk)), {
      line: 1,
      column: rewrittenDeclaration.indexOf('Bar'),
    });

    expect(rewrittenDeclaration).toContain("'./types.js'");
    expect(rewrittenMap).toBe(mapOnDisk);
    expect(mappedPosition).toMatchObject({
      source: 'source.ts',
      line: 1,
      column: declaration.indexOf('Bar'),
    });
  });
});
