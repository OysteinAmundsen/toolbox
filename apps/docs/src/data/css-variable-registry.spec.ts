import { describe, expect, it } from 'vitest';
import { ALL_VARIABLE_NAMES, CSS_VARIABLES } from './css-variable-registry.js';

describe('CSS Variable Registry', () => {
  it('ALL_VARIABLE_NAMES matches flattened CSS_VARIABLES', () => {
    const expected = Object.values(CSS_VARIABLES).flatMap((vars) => vars.map((v) => v.name));
    expect(ALL_VARIABLE_NAMES).toEqual(expected);
  });

  it('has no duplicate variable names', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const name of ALL_VARIABLE_NAMES) {
      if (seen.has(name)) dupes.push(name);
      seen.add(name);
    }
    expect(dupes).toEqual([]);
  });

  it('every variable name starts with --tbw-', () => {
    for (const name of ALL_VARIABLE_NAMES) {
      expect(name).toMatch(/^--tbw-/);
    }
  });

  it('every variable has a non-empty description', () => {
    const missing: string[] = [];
    for (const vars of Object.values(CSS_VARIABLES)) {
      for (const v of vars) {
        if (!v.description.trim()) missing.push(v.name);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every variable has a valid type', () => {
    const validTypes = new Set(['color', 'size', 'font', 'number', 'select', 'padding']);
    const invalid: string[] = [];
    for (const vars of Object.values(CSS_VARIABLES)) {
      for (const v of vars) {
        if (!validTypes.has(v.type)) invalid.push(`${v.name} (${v.type})`);
      }
    }
    expect(invalid).toEqual([]);
  });

  it('select-type variables have options array', () => {
    const missing: string[] = [];
    for (const vars of Object.values(CSS_VARIABLES)) {
      for (const v of vars) {
        if (v.type === 'select' && (!v.options || v.options.length === 0)) {
          missing.push(v.name);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('contains at least 200 variables (sanity check)', () => {
    expect(ALL_VARIABLE_NAMES.length).toBeGreaterThanOrEqual(200);
  });

  it('has core categories', () => {
    const categories = Object.keys(CSS_VARIABLES);
    expect(categories).toContain('Core Colors');
    expect(categories).toContain('Header');
    expect(categories).toContain('Borders');
    expect(categories).toContain('Typography');
    expect(categories).toContain('Animation');
  });

  it('has plugin categories', () => {
    const categories = Object.keys(CSS_VARIABLES);
    expect(categories).toContain('Editing (Plugin)');
    expect(categories).toContain('Selection (Plugin)');
    expect(categories).toContain('Context Menu (Plugin)');
    expect(categories).toContain('Filtering (Plugin)');
    expect(categories).toContain('Pivot (Plugin)');
  });
});
