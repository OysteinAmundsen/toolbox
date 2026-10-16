import { readFileSync } from 'node:fs';
import MagicString from 'magic-string';
import ts from 'typescript';
import type { Plugin } from 'vite';

/**
 * Vite plugin for secondary entries (per-plugin ESM + UMD) that decides, per
 * imported SYMBOL, whether core code is shared or inlined:
 *
 * - A core symbol that is part of the public API (a value export of
 *   `publicEntry`) is imported from `publicId` (`@toolbox-web/grid`; the
 *   `TbwGrid` global in UMD). One runtime instance, shared state, no duplicate
 *   bytes in the plugin bundle.
 * - Everything else (stateless internal helpers) is inlined into the bundle.
 * - Literal-only constant objects (`GridClasses`, …) stay inlined: terser folds
 *   their property reads into string literals, which is smaller and faster.
 *
 * At `generateBundle` it fails the build when
 * 1. a core module with module-level mutable state (top-level `let`, or a
 *    `const` holding an empty `new Map/Set/WeakMap/WeakSet()`) survived
 *    tree-shaking inside the bundle while core also contains it — that state
 *    would exist twice at runtime (two plugin bundles: {@link assertSingleStateCopy});
 * 2. the bundle imports a name from `publicId` that the built core entry does
 *    not export (UMD: a missing `TbwGrid.<name>` → runtime `TypeError`);
 * 3. the bundle has an external import outside `allowedExternals`.
 */
export interface CoreImportsOptions {
  /** Entry whose value exports form the shared public surface (`src/index.ts`). */
  publicEntry: string;
  /** Module id the public surface is imported from. */
  publicId: string;
  /** Root of the library sources; only modules under it are rewritten. */
  srcRoot: string;
  /** Root of core sources; stateful-module checks apply under it. */
  coreRoot: string;
  /** tsconfig used to resolve the public entry's re-exports. */
  tsconfig: string;
  /** Built core entry (ESM); its exports and sourcemap are the real runtime surface. */
  coreBundle: string;
  /** Bundles built together; a stateful module may live in at most one of them. */
  group: string;
  /** Externals a bundle may import besides `publicId`. */
  allowedExternals?: (id: string) => boolean;
}

const norm = (p: string) => {
  const s = p.split('?')[0].replace(/\\/g, '/');
  return process.platform === 'win32' ? s.toLowerCase() : s;
};

/** Escape every RegExp metacharacter (including `\`) so `s` matches literally. */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// #region Public API index

/** `<file>#<exportName>` of any core module → name on the public entry. */
type PublicIndex = Map<string, string>;
const indexCache = new Map<string, PublicIndex>();

function unwrap(n: ts.Expression): ts.Expression {
  while (
    ts.isAsExpression(n) ||
    ts.isSatisfiesExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    ts.isTypeAssertionExpression(n)
  ) {
    n = n.expression;
  }
  if (
    ts.isCallExpression(n) &&
    n.arguments.length === 1 &&
    ts.isPropertyAccessExpression(n.expression) &&
    n.expression.getText() === 'Object.freeze'
  ) {
    return unwrap(n.arguments[0]);
  }
  return n;
}

function isLiteralOnly(expr: ts.Expression): boolean {
  const n = unwrap(expr);
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return true;
  if (
    n.kind === ts.SyntaxKind.TrueKeyword ||
    n.kind === ts.SyntaxKind.FalseKeyword ||
    n.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand)) return true;
  if (ts.isArrayLiteralExpression(n)) return n.elements.every(isLiteralOnly);
  if (ts.isObjectLiteralExpression(n)) {
    return n.properties.every((p) => ts.isPropertyAssignment(p) && isLiteralOnly(p.initializer));
  }
  return false;
}

/** Literal-only `const` objects/primitives: inlined, because terser folds their reads. */
function isFoldableConstant(sym: ts.Symbol): boolean {
  const decl = sym.valueDeclaration;
  if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer) return false;
  const list = decl.parent;
  if (!ts.isVariableDeclarationList(list) || !(list.flags & ts.NodeFlags.Const)) return false;
  return isLiteralOnly(decl.initializer);
}

function buildPublicIndex(publicEntry: string, tsconfig: string): PublicIndex {
  const config = ts.readConfigFile(tsconfig, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, tsconfig.replace(/[\\/][^\\/]+$/, ''));
  const program = ts.createProgram([publicEntry], { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const resolveAlias = (s: ts.Symbol) => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s);
  const originKey = (s: ts.Symbol) => {
    const decl = s.valueDeclaration ?? s.declarations?.[0];
    return decl ? `${norm(decl.getSourceFile().fileName)}:${decl.pos}` : undefined;
  };

  const entry = program.getSourceFile(publicEntry);
  const entrySym = entry && checker.getSymbolAtLocation(entry);
  if (!entrySym) throw new Error(`[core-imports] cannot read exports of ${publicEntry}`);

  const publicByOrigin = new Map<string, string>();
  for (const exp of checker.getExportsOfModule(entrySym)) {
    const target = resolveAlias(exp);
    if (!(target.flags & ts.SymbolFlags.Value) || isFoldableConstant(target)) continue;
    const key = originKey(target);
    if (key) publicByOrigin.set(key, exp.name);
  }

  const index: PublicIndex = new Map();
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    const modSym = checker.getSymbolAtLocation(sf);
    if (!modSym) continue;
    for (const exp of checker.getExportsOfModule(modSym)) {
      const key = originKey(resolveAlias(exp));
      const publicName = key && publicByOrigin.get(key);
      if (publicName) index.set(`${norm(sf.fileName)}#${exp.name}`, publicName);
    }
  }
  return index;
}

function getPublicIndex(publicEntry: string, tsconfig: string): PublicIndex {
  let index = indexCache.get(publicEntry);
  if (!index) {
    index = buildPublicIndex(publicEntry, tsconfig);
    indexCache.set(publicEntry, index);
  }
  return index;
}

// #endregion

// #region Bundle checks

const statefulCache = new Map<string, string[]>();

/** Top-level declarations that hold mutable module state. */
function statefulDeclarations(file: string): string[] {
  let names = statefulCache.get(file);
  if (names) return names;
  names = [];
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const isConst = !!(stmt.declarationList.flags & ts.NodeFlags.Const);
    for (const d of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      const init = d.initializer && unwrap(d.initializer);
      const emptyCollection =
        !!init &&
        ts.isNewExpression(init) &&
        ts.isIdentifier(init.expression) &&
        /^(Map|Set|WeakMap|WeakSet)$/.test(init.expression.text) &&
        !init.arguments?.length;
      if (!isConst || emptyCollection) names.push(d.name.text);
    }
  }
  statefulCache.set(file, names);
  return names;
}

function readCoreExports(coreBundle: string): Set<string> | undefined {
  let code: string;
  try {
    code = readFileSync(coreBundle, 'utf8');
  } catch {
    return undefined;
  }
  const names = new Set<string>();
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop();
      if (name) names.add(name);
    }
  }
  return names;
}

/** Source modules (normalized, relative to srcRoot) bundled into core, from its sourcemap. */
function readCoreModules(coreBundle: string, srcRoot: string): Set<string> | undefined {
  try {
    const { sources } = JSON.parse(readFileSync(`${coreBundle}.map`, 'utf8')) as { sources: string[] };
    const marker = srcRoot.slice(srcRoot.lastIndexOf('/libs/') + 1);
    const modules = new Set<string>();
    for (const s of sources) {
      const n = norm(s);
      const at = n.indexOf(marker);
      if (at >= 0) modules.add(n.slice(at + marker.length));
    }
    return modules;
  } catch {
    return undefined;
  }
}

/** group → stateful core module (relative) → bundles that carry its state. */
const liveState = new Map<string, Map<string, string[]>>();

/**
 * Call after every bundle of `group` is built. Fails when one stateful core
 * module's state survived in two or more of them.
 */
export function assertSingleStateCopy(group: string): void {
  const duplicated = [...(liveState.get(group) ?? [])].filter(([, bundles]) => bundles.length > 1);
  liveState.delete(group);
  if (duplicated.length) {
    throw new Error(
      `[core-imports] module state exists more than once at runtime:\n  ` +
        duplicated.map(([mod, bundles]) => `${mod} in ${bundles.join(', ')}`).join('\n  ') +
        '\n  Export the stateful API from the public entry so every bundle shares core’s instance.',
    );
  }
}

// #endregion

export function coreImports(options: CoreImportsOptions): Plugin {
  const srcRoot = norm(options.srcRoot);
  const coreRoot = norm(options.coreRoot);
  const imported = new Set<string>();

  return {
    name: 'core-imports',
    enforce: 'pre',

    resolveId(source) {
      return source === options.publicId ? { id: options.publicId, external: true } : null;
    },

    async transform(code, id) {
      const file = norm(id);
      if (!file.startsWith(srcRoot) || !/\.ts$/.test(file) || !/from\s*['"]\./.test(code)) return null;
      const index = getPublicIndex(options.publicEntry, options.tsconfig);
      const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const s = new MagicString(code);

      for (const stmt of sf.statements) {
        if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
        const clause = stmt.importClause;
        const bindings = clause?.namedBindings;
        if (!clause || clause.isTypeOnly || !bindings || !ts.isNamedImports(bindings)) continue;
        const spec = stmt.moduleSpecifier.text;
        if (!spec.startsWith('.')) continue;
        const resolved = await this.resolve(spec, id, { skipSelf: true });
        if (!resolved || resolved.external) continue;
        const target = norm(resolved.id);

        const shared: string[] = [];
        const kept: string[] = [];
        for (const el of bindings.elements) {
          const publicName = el.isTypeOnly ? undefined : index.get(`${target}#${(el.propertyName ?? el.name).text}`);
          if (publicName) {
            shared.push(publicName === el.name.text ? publicName : `${publicName} as ${el.name.text}`);
            imported.add(publicName);
          } else {
            kept.push(el.getText());
          }
        }
        if (!shared.length) continue;

        let replacement = `import { ${shared.join(', ')} } from '${options.publicId}';`;
        const defaultName = clause.name?.text;
        if (defaultName || kept.length) {
          const parts = [defaultName, kept.length ? `{ ${kept.join(', ')} }` : undefined].filter(Boolean);
          replacement += ` import ${parts.join(', ')} from '${spec}';`;
        }
        s.overwrite(stmt.getStart(sf), stmt.getEnd(), replacement);
      }

      if (!s.hasChanged()) return null;
      return { code: s.toString(), map: s.generateMap({ hires: 'boundary', source: id }) };
    },

    generateBundle(_, bundle) {
      const problems: string[] = [];
      const coreExports = readCoreExports(options.coreBundle);
      const coreModules = readCoreModules(options.coreBundle, srcRoot);
      if (!coreModules)
        this.warn(`[core-imports] ${options.coreBundle}.map not found — state checks are plugin-vs-plugin only`);
      let group = liveState.get(options.group);
      if (!group) liveState.set(options.group, (group = new Map()));

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const name = chunk.facadeModuleId ? norm(chunk.facadeModuleId).slice(srcRoot.length) : chunk.fileName;

        for (const [id, mod] of Object.entries(chunk.modules)) {
          const file = norm(id);
          if (!file.startsWith(coreRoot) || !mod.code) continue;
          const live = statefulDeclarations(id.split('?')[0]).filter((n) =>
            new RegExp(`\\b(?:let|const|var)\\s+${escapeRegExp(n)}(?:\\$\\d+)?\\b`).test(mod.code as string),
          );
          if (!live.length) continue;
          const rel = file.slice(srcRoot.length);
          if (coreModules?.has(rel)) {
            problems.push(
              `${name}: inlines module state from ${rel} (${live.join(', ')}), which core also holds. ` +
                'Export the stateful API from the public entry so the bundle shares core’s instance.',
            );
          } else {
            group.set(rel, [...(group.get(rel) ?? []), name]);
          }
        }

        for (const ext of chunk.imports) {
          if (ext !== options.publicId && !options.allowedExternals?.(ext)) {
            problems.push(`${name}: unexpected external import "${ext}"`);
          }
        }
      }

      if (coreExports) {
        const missing = [...imported].filter((n) => !coreExports.has(n));
        if (missing.length) {
          problems.push(`imports ${missing.join(', ')} from ${options.publicId}, which the built core does not export`);
        }
      } else {
        this.warn(`[core-imports] ${options.coreBundle} not found — skipped the public-binding check`);
      }

      if (problems.length) this.error(`[core-imports]\n  ${problems.join('\n  ')}`);
    },
  };
}
