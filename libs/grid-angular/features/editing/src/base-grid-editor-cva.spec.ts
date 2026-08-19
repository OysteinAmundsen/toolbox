/**
 * Tests for the BaseGridEditorCVA abstract class.
 *
 * These tests verify the class structure and CVA methods
 * without requiring Angular TestBed.
 *
 * @vitest-environment happy-dom
 */
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { BaseGridEditorCVA, resolveEditorDisplayValue } from './base-grid-editor-cva.js';

describe('BaseGridEditorCVA', () => {
  it('should be importable and defined', () => {
    expect(BaseGridEditorCVA).toBeDefined();
  });

  it('should be a class that can be extended', () => {
    expect(typeof BaseGridEditorCVA).toBe('function');
    expect(typeof BaseGridEditorCVA.prototype.writeValue).toBe('function');
    expect(typeof BaseGridEditorCVA.prototype.registerOnChange).toBe('function');
    expect(typeof BaseGridEditorCVA.prototype.registerOnTouched).toBe('function');
    expect(typeof BaseGridEditorCVA.prototype.setDisabledState).toBe('function');
  });

  it('should extend BaseGridEditor', () => {
    // Verify the prototype chain — commitValue and cancelEdit come from BaseGridEditor
    expect(typeof BaseGridEditorCVA.prototype.commitValue).toBe('function');
    expect(typeof BaseGridEditorCVA.prototype.cancelEdit).toBe('function');
  });

  describe('writeValue', () => {
    it('should be callable as a standalone method', () => {
      // Verify the method exists and can be invoked
      const instance = Object.create(BaseGridEditorCVA.prototype);
      // We need to manually create the cvaValue signal mock
      const values: unknown[] = [];
      instance.cvaValue = { set: (v: unknown) => values.push(v) };
      instance['_committed'] = signal(null);

      instance.writeValue('hello');
      expect(values).toEqual(['hello']);

      instance.writeValue(null);
      expect(values).toEqual(['hello', null]);
    });
  });

  describe('registerOnChange', () => {
    it('should register the callback function', () => {
      const instance = Object.create(BaseGridEditorCVA.prototype);
      const fn = vi.fn();
      instance.registerOnChange(fn);
      // The _onChange private field should now be set
      expect(instance['_onChange']).toBe(fn);
    });
  });

  describe('registerOnTouched', () => {
    it('should register the callback function', () => {
      const instance = Object.create(BaseGridEditorCVA.prototype);
      const fn = vi.fn();
      instance.registerOnTouched(fn);
      expect(instance['_onTouched']).toBe(fn);
    });
  });

  describe('setDisabledState', () => {
    it('should update the disabledState signal', () => {
      const instance = Object.create(BaseGridEditorCVA.prototype);
      const values: boolean[] = [];
      instance.disabledState = { set: (v: boolean) => values.push(v) };

      instance.setDisabledState(true);
      expect(values).toEqual([true]);

      instance.setDisabledState(false);
      expect(values).toEqual([true, false]);
    });
  });

  describe('commitBoth', () => {
    it('should call onChange, onTouched, and commitValue', () => {
      const instance = Object.create(BaseGridEditorCVA.prototype);

      // Mock CVA state
      const cvaValues: unknown[] = [];
      instance.cvaValue = { set: (v: unknown) => cvaValues.push(v) };
      instance['_committed'] = signal(null);

      const onChange = vi.fn();
      const onTouched = vi.fn();
      instance['_onChange'] = onChange;
      instance['_onTouched'] = onTouched;

      // Mock commitValue from BaseGridEditor
      const commitValue = vi.fn();
      instance.commitValue = commitValue;

      // Call commitBoth
      instance['commitBoth']('new-value');

      // Verify CVA was updated
      expect(cvaValues).toEqual(['new-value']);
      expect(onChange).toHaveBeenCalledWith('new-value');
      expect(onTouched).toHaveBeenCalledOnce();

      // Verify grid commitValue was called
      expect(commitValue).toHaveBeenCalledWith('new-value');
    });

    it('should call commitValue when value is null (nullable columns)', () => {
      const instance = Object.create(BaseGridEditorCVA.prototype);

      const cvaValues: unknown[] = [];
      instance.cvaValue = { set: (v: unknown) => cvaValues.push(v) };
      instance['_committed'] = signal(null);
      instance['_onChange'] = vi.fn();
      instance['_onTouched'] = vi.fn();

      const commitValue = vi.fn();
      instance.commitValue = commitValue;

      instance['commitBoth'](null);

      // CVA should still be updated
      expect(cvaValues).toEqual([null]);
      expect(instance['_onChange']).toHaveBeenCalledWith(null);

      // Grid commitValue IS called for null (nullable column support)
      expect(commitValue).toHaveBeenCalledWith(null);
    });
  });

  describe('displayValue resolution', () => {
    it('should prefer the grid value over the form value', () => {
      expect(resolveEditorDisplayValue(null, 'grid', 'form')).toBe('grid');
    });

    it('should fall back to the form value when there is no grid value', () => {
      expect(resolveEditorDisplayValue(null, undefined, 'form')).toBe('form');
    });

    /**
     * The grid never pushes a cell's own committed value back to the editor
     * that produced it (EditingPlugin skips `source: 'user'`), so in row edit
     * mode — where editors stay mounted after a commit — the `value` input goes
     * stale. What this editor committed must win until something external
     * overwrites it.
     */
    it('should prefer the committed value over a stale grid value', () => {
      expect(resolveEditorDisplayValue({ value: 'committed' }, 'stale', null)).toBe('committed');
    });

    it('should honour a committed null over a stale grid value', () => {
      expect(resolveEditorDisplayValue({ value: null }, 'stale', null)).toBeNull();
    });
  });

  describe('committed value lifecycle', () => {
    const makeInstance = () => {
      const instance = Object.create(BaseGridEditorCVA.prototype);
      instance['_committed'] = signal<{ value: unknown } | null>(null);
      instance.cvaValue = signal<unknown>(null);
      instance.commitValue = vi.fn();
      instance['_onChange'] = vi.fn();
      instance['_onTouched'] = vi.fn();
      return instance;
    };

    it('should record the value passed to commitBoth', () => {
      const instance = makeInstance();

      instance['commitBoth']('committed');

      expect(instance['_committed']()).toEqual({ value: 'committed' });
    });

    it('should record a committed null distinguishably', () => {
      const instance = makeInstance();

      instance['commitBoth'](null);

      expect(instance['_committed']()).toEqual({ value: null });
    });

    it('should discard the committed value when an external value arrives', () => {
      const instance = makeInstance();
      instance['commitBoth']('committed');

      instance.onExternalValueChange('from-grid');

      expect(instance['_committed']()).toBeNull();
    });

    it('should discard the committed value when the form control writes', () => {
      const instance = makeInstance();
      instance['commitBoth']('committed');

      instance.writeValue('from-form');

      expect(instance['_committed']()).toBeNull();
      expect(instance.cvaValue()).toBe('from-form');
    });
  });
});
