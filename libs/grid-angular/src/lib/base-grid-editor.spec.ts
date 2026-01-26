/**
 * Tests for the BaseGridEditor abstract class.
 *
 * Note: Full testing of Angular signal-based inputs/outputs requires TestBed.
 * These tests verify the class is exported and importable.
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
});
