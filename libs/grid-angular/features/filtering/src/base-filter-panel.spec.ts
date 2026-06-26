/**
 * Tests for the BaseFilterPanel abstract class.
 *
 * These tests verify the class structure and the applyAndClose/clearAndClose
 * helper methods without requiring Angular TestBed.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { BaseFilterPanel } from './base-filter-panel.js';

describe('BaseFilterPanel', () => {
  it('should be importable and defined', () => {
    expect(BaseFilterPanel).toBeDefined();
  });

  it('should be a class that can be extended', () => {
    expect(typeof BaseFilterPanel).toBe('function');
    expect(typeof BaseFilterPanel.prototype.applyAndClose).toBe('function');
    expect(typeof BaseFilterPanel.prototype.clearAndClose).toBe('function');
  });

  describe('applyAndClose', () => {
    it('should call applyFilter then closePanel', () => {
      const closePanel = vi.fn();
      const applyFilter = vi.fn();

      // Create a minimal mock instance
      const instance = Object.create(BaseFilterPanel.prototype) as BaseFilterPanel & {
        applyFilter: () => void;
      };
      instance.applyFilter = applyFilter;
      // Mock params() to return an object with closePanel
      (instance as any).params = () => ({ closePanel });

      instance.applyAndClose();

      expect(applyFilter).toHaveBeenCalledOnce();
      expect(closePanel).toHaveBeenCalledOnce();

      // Verify order: applyFilter first, then closePanel
      const applyOrder = applyFilter.mock.invocationCallOrder[0];
      const closeOrder = closePanel.mock.invocationCallOrder[0];
      expect(applyOrder).toBeLessThan(closeOrder);
    });
  });

  describe('clearAndClose', () => {
    it('should call clearFilter then closePanel', () => {
      const closePanel = vi.fn();
      const clearFilter = vi.fn();

      const instance = Object.create(BaseFilterPanel.prototype) as BaseFilterPanel;
      (instance as any).params = () => ({ closePanel, clearFilter });

      instance.clearAndClose();

      expect(clearFilter).toHaveBeenCalledOnce();
      expect(closePanel).toHaveBeenCalledOnce();

      // Verify order: clearFilter first, then closePanel
      const clearOrder = clearFilter.mock.invocationCallOrder[0];
      const closeOrder = closePanel.mock.invocationCallOrder[0];
      expect(clearOrder).toBeLessThan(closeOrder);
    });
  });
});
