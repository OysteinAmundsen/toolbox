#!/usr/bin/env bun
/**
 * Reads `tools/since-map.json` and inserts `@since X.Y.Z` JSDoc tags on
 * the corresponding declarations in source. Idempotent: skips symbols
 * that already have a `@since` tag.
 *
 * For each entry:
 *   - Resolve the AST node whose name matches `localName` in the file.
 *   - Walk up to the nearest "documentable" container (the export
 *     declaration, function, class, interface, type alias, enum, const)
 *     and look for an attached JSDoc.
 *   - If a JSDoc exists, splice ` * @since X.Y.Z\n` immediately before the
 *     closing `*\/`.
 *   - If no JSDoc exists, prepend `\/** @since X.Y.Z *\/\n` on the line
 *     above (matching the indentation of the declaration).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ts from 'typescript';

const repoRoot = resolve(import.meta.dirname, '..');
const mapPath = resolve(import.meta.dirname, 'since-map.json');

interface SinceEntry {
  version: string;
  file: string;
  sha: string;
}
type SinceMap = Record<string, Record<string, SinceEntry>>;

const map: SinceMap = JSON.parse(readFileSync(mapPath, 'utf-8'));

// Group entries by file so we only parse and write each file once.
interface FileEdit {
  file: string;
  /** map of localName → version (one entry per declaration we want to tag) */
  symbols: Map<string, string>;
}
const byFile = new Map<string, FileEdit>();

for (const lib of Object.keys(map)) {
  for (const exportName of Object.keys(map[lib])) {
    const { version, file } = map[lib][exportName];
    const abs = resolve(repoRoot, file);
    let edit = byFile.get(abs);
    if (!edit) {
      edit = { file: abs, symbols: new Map() };
      byFile.set(abs, edit);
    }
    // The exported name is the resolver's best guess at the local name —
    // if a symbol was renamed in the export, this might miss; in that
    // case the AST scan below will simply not find it and skip.
    if (!edit.symbols.has(exportName)) edit.symbols.set(exportName, version);
  }
}

let applied = 0;
let alreadyTagged = 0;
let notFound = 0;

for (const { file, symbols } of byFile.values()) {
  const original = readFileSync(file, 'utf-8');
  const sf = ts.createSourceFile(file, original, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  /**
   * Resolve a top-level documentable node for `name`. We look at the
   * source file's direct statements only — top-level exports.
   */
  function findDeclaration(name: string): ts.Node | null {
    for (const stmt of sf.statements) {
      // export function / class / interface / type / enum / const Foo
      if (
        (ts.isFunctionDeclaration(stmt) ||
          ts.isClassDeclaration(stmt) ||
          ts.isInterfaceDeclaration(stmt) ||
          ts.isTypeAliasDeclaration(stmt) ||
          ts.isEnumDeclaration(stmt)) &&
        stmt.name?.text === name
      ) {
        return stmt;
      }
      // export const Foo = ... / export const Foo, Bar
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === name) {
            // For multi-declaration statements we attach to the variable
            // statement; otherwise still the statement.
            return stmt;
          }
        }
      }
    }
    return null;
  }

  interface Insertion {
    pos: number;
    text: string;
  }
  const insertions: Insertion[] = [];

  for (const [name, version] of symbols) {
    const node = findDeclaration(name);
    if (!node) {
      notFound++;
      continue;
    }
    const jsDocs = (node as unknown as { jsDoc?: ts.JSDoc[] }).jsDoc;
    const lastJsDoc = jsDocs?.[jsDocs.length - 1];

    if (lastJsDoc) {
      const text = lastJsDoc.getText(sf);
      if (/@since\b/.test(text)) {
        alreadyTagged++;
        continue;
      }
      // Insert ` * @since X.Y.Z\n ` before the trailing `*\/`. Find the
      // position of the comment's last `*\/`.
      const end = lastJsDoc.end; // points at char after `*\/`
      // Indent based on the comment's start column.
      const startLineCol = sf.getLineAndCharacterOfPosition(
        lastJsDoc.pos === lastJsDoc.getStart(sf) ? lastJsDoc.pos : lastJsDoc.getStart(sf),
      );
      const indent = ' '.repeat(startLineCol.character);
      insertions.push({ pos: end - 2, text: `* @since ${version}\n${indent} ` });
      applied++;
    } else {
      // No JSDoc — insert a one-liner immediately before the node's
      // start line, preserving indentation.
      const start = node.getStart(sf);
      const { character } = sf.getLineAndCharacterOfPosition(start);
      const indent = ' '.repeat(character);
      // Insert at the column position of the node's first character on
      // its own line, prefixed with the correct indent.
      const lineStart = start - character;
      insertions.push({
        pos: lineStart,
        text: `${indent}/** @since ${version} */\n`,
      });
      applied++;
    }
  }

  if (insertions.length === 0) continue;
  // Apply insertions back-to-front so earlier offsets remain valid.
  insertions.sort((a, b) => b.pos - a.pos);
  let updated = original;
  for (const ins of insertions) {
    updated = updated.slice(0, ins.pos) + ins.text + updated.slice(ins.pos);
  }
  writeFileSync(file, updated, 'utf-8');
}

console.log(`Applied @since to ${applied} declarations`);
console.log(`Skipped (already tagged): ${alreadyTagged}`);
console.log(`Skipped (declaration not found): ${notFound}`);
