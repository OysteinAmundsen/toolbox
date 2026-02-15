/**
 * Tests for the BaseGridEditorCVA abstract class.
 *
 * These tests verify the class structure and CVA methods
 * without requiring Angular TestBed.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { BaseGridEditorCVA } from './base-grid-editor-cva.js';

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

    it('should not call commitValue when value is null', () => {
      const instance = Object.create(BaseGridEditorCVA.prototype);

      const cvaValues: unknown[] = [];
      instance.cvaValue = { set: (v: unknown) => cvaValues.push(v) };
      instance['_onChange'] = vi.fn();
      instance['_onTouched'] = vi.fn();

      const commitValue = vi.fn();
      instance.commitValue = commitValue;

      instance['commitBoth'](null);

      // CVA should still be updated
      expect(cvaValues).toEqual([null]);
      expect(instance['_onChange']).toHaveBeenCalledWith(null);

      // Grid commitValue should NOT be called for null
      expect(commitValue).not.toHaveBeenCalled();
    });
  });
});
