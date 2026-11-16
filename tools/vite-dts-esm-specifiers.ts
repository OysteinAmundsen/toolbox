import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import remapping, { type RawSourceMap } from '@jridgewell/remapping';
import MagicString from 'magic-string';
import ts from 'typescript';

/**
 * `vite-plugin-dts` `afterBuild` hook that makes emitted declarations valid ES
 * module declarations (#659).
 *
 * The libraries compile under `moduleResolution: "bundler"`, so `tsc` emits
 * extensionless relative specifiers (`'./public'`, `'./lib/core/plugin'`). The
 * published packages are `"type": "module"`, so consumers on `node16`/`nodenext`
 * treat every `.d.ts` as ESM and require explicit extensions — unresolved
 * `export *` drops symbols, named re-exports widen to `any`, and
 * `declare module '../core/types'` augmentations are silently lost.
 *
 * Every relative specifier in import/export declarations, `import('...')` types
 * and `declare module '…'` augmentations is rewritten to `./x.js` or
 * `./x/index.js`, whichever matches an emitted `.d.ts`. Both forms also resolve
 * under `bundler`. Throws when a relative specifier cannot be mapped, so a
 * broken declaration can never ship.
 */
export function rewriteDtsSpecifiers(emittedFiles: Map<string, string>): void {
  const known = new Set([...emittedFiles.keys()].map((f) => posix.normalize(f.replace(/\\/g, '/'))));
  const exists = (file: string) => known.has(file) || existsSync(file);
  const unresolved: string[] = [];

  for (const [rawPath, content] of emittedFiles) {
    if (!rawPath.endsWith('.d.ts')) continue;
    const filePath = posix.normalize(rawPath.replace(/\\/g, '/'));
    const mapPath = `${rawPath}.map`;
    const originalMap = emittedFiles.get(mapPath) ?? (existsSync(mapPath) ? readFileSync(mapPath, 'utf-8') : undefined);
    const rewritten = rewriteSpecifiersInDts(
      filePath,
      content,
      exists,
      (spec) => unresolved.push(`${filePath}: '${spec}'`),
      originalMap !== undefined,
    );
    if (rewritten.content !== content) {
      writeFileSync(rawPath, rewritten.content, 'utf-8');
      emittedFiles.set(rawPath, rewritten.content);

      if (originalMap !== undefined) {
        if (rewritten.sourceMap === undefined) {
          throw new Error(`[dts-esm-specifiers] Missing rewrite source map for '${filePath}'`);
        }
        const declarationMap: RawSourceMap = JSON.parse(originalMap);
        const composedMap = remapping([rewritten.sourceMap, declarationMap], () => null).toString();
        writeFileSync(mapPath, composedMap, 'utf-8');
        emittedFiles.set(mapPath, composedMap);
      }
    }
  }

  if (unresolved.length) {
    throw new Error(
      `[dts-esm-specifiers] ${unresolved.length} relative specifier(s) do not map to an emitted declaration:\n  ` +
        unresolved.join('\n  '),
    );
  }
}

/** Rewrite declaration specifiers and optionally produce a map back to the original declaration. */
export function rewriteSpecifiersInDts(
  filePath: string,
  content: string,
  exists: (file: string) => boolean,
  onUnresolved: (specifier: string) => void,
  generateSourceMap = false,
): { content: string; sourceMap?: string } {
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const out = new MagicString(content);
  const dir = posix.dirname(filePath);

  const fix = (literal: ts.StringLiteralLike) => {
    const spec = literal.text;
    if (!spec.startsWith('./') && !spec.startsWith('../')) return;
    if (/\.(?:[mc]?js|json)$/.test(spec)) return;
    const target = posix.join(dir, spec);
    let replacement: string | undefined;
    if (exists(`${target}.d.ts`)) replacement = `${spec}.js`;
    else if (exists(`${target}/index.d.ts`)) replacement = `${spec.replace(/\/$/, '')}/index.js`;
    if (!replacement) return onUnresolved(spec);
    // Keep the original quote character; the literal's text range excludes it.
    out.overwrite(literal.getStart(source) + 1, literal.getEnd() - 1, replacement);
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      fix(node.moduleSpecifier);
    } else if (ts.isModuleDeclaration(node) && ts.isStringLiteralLike(node.name)) {
      fix(node.name);
    } else if (ts.isImportTypeNode(node)) {
      if (ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
        fix(node.argument.literal);
      }

      // Vue's SFC declaration generator passes GlobalComponents/GlobalDirectives
      // into constrained ComponentOptionsBase type parameters. Those interfaces
      // intentionally lack index signatures, so preserve their named members
      // while satisfying Vue's Record constraints for strict consumer checks.
      if (
        node.typeArguments &&
        node.qualifier &&
        ts.isIdentifier(node.qualifier) &&
        node.qualifier.text === 'ComponentOptionsBase' &&
        node.typeArguments.length > 14
      ) {
        const [components, directives] = [node.typeArguments[13], node.typeArguments[14]];
        if (isVueType(components, 'GlobalComponents')) {
          out.overwrite(
            components.getStart(source),
            components.getEnd(),
            "Record<string, import('vue').Component> & import('vue').GlobalComponents",
          );
        }
        if (isVueType(directives, 'GlobalDirectives')) {
          out.overwrite(
            directives.getStart(source),
            directives.getEnd(),
            "Record<string, import('vue').Directive> & import('vue').GlobalDirectives",
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (!out.hasChanged()) return { content };

  return {
    content: out.toString(),
    ...(generateSourceMap && {
      sourceMap: out
        .generateMap({
          file: posix.basename(filePath),
          source: posix.basename(filePath),
          hires: true,
          includeContent: false,
        })
        .toString(),
    }),
  };
}

function isVueType(node: ts.TypeNode, name: string): node is ts.ImportTypeNode {
  return (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteralLike(node.argument.literal) &&
    node.argument.literal.text === 'vue' &&
    node.qualifier !== undefined &&
    ts.isIdentifier(node.qualifier) &&
    node.qualifier.text === name
  );
}
