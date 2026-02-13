/**
 * Tests for the BaseGridEditor abstract class.
 *
 * Note: Full testing of Angular signal-based inputs/outputs requires TestBed.
 * These tests verify the class structure and the getErrorMessage logic.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { BaseGridEditor } from './base-grid-editor.js';

describe('BaseGridEditor', () => {
  it('should be importable and defined', () => {
    expect(BaseGridEditor).toBeDefined();
  });

  it('should be a class that can be extended', () => {
    // Verify the prototype chain is correct
    expect(typeof BaseGridEditor).toBe('function');
    expect(BaseGridEditor.prototype.commitValue).toBeDefined();
    expect(BaseGridEditor.prototype.cancelEdit).toBeDefined();
  });

  it('should have protected getErrorMessage method', () => {
    // The method exists on the prototype
    expect(typeof BaseGridEditor.prototype['getErrorMessage']).toBe('function');
  });

  describe('getErrorMessage', () => {
    // Access the method via prototype since we can't instantiate the abstract class
    const getErrorMessage = BaseGridEditor.prototype['getErrorMessage'] as (key: string, value?: unknown) => string;

    it('should return correct message for "required"', () => {
      expect(getErrorMessage('required')).toBe('This field is required');
    });

    it('should return correct message for "minlength" with error value', () => {
      const result = getErrorMessage('minlength', { requiredLength: 5 });
      expect(result).toBe('Minimum length is 5');
    });

    it('should return correct message for "minlength" without error value', () => {
      const result = getErrorMessage('minlength');
      expect(result).toBe('Minimum length is unknown');
    });

    it('should return correct message for "maxlength" with error value', () => {
      const result = getErrorMessage('maxlength', { requiredLength: 100 });
      expect(result).toBe('Maximum length is 100');
    });

    it('should return correct message for "min" with error value', () => {
      const result = getErrorMessage('min', { min: 0 });
      expect(result).toBe('Minimum value is 0');
    });

    it('should return correct message for "max" with error value', () => {
      const result = getErrorMessage('max', { max: 999 });
      expect(result).toBe('Maximum value is 999');
    });

    it('should return correct message for "email"', () => {
      expect(getErrorMessage('email')).toBe('Invalid email address');
    });

    it('should return correct message for "pattern"', () => {
      expect(getErrorMessage('pattern')).toBe('Invalid format');
    });

    it('should return fallback message for unknown error keys', () => {
      expect(getErrorMessage('customValidator')).toBe('Invalid value (customValidator)');
    });
  });
});
