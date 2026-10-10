import { describe, it, expect } from 'vitest';
import { mufCompact, mufNiceMax, mufSmoothPath } from '../dairy_farm/client/src/muf-charts';

describe('muf-charts helpers', () => {
  describe('mufCompact', () => {
    it('formats numbers under 1000 as integers', () => {
      expect(mufCompact(42)).toBe('42');
      expect(mufCompact(999)).toBe('999');
    });

    it('formats thousands with k suffix', () => {
      expect(mufCompact(1500)).toBe('1.5k');
      expect(mufCompact(24000)).toBe('24k');
    });

    it('formats millions with M suffix', () => {
      expect(mufCompact(2_400_000)).toBe('2.4M');
      expect(mufCompact(10_000_000)).toBe('10M');
    });

    it('handles negative numbers', () => {
      expect(mufCompact(-1500)).toBe('-1.5k');
    });
  });

  describe('mufNiceMax', () => {
    it('rounds up to nice ceiling', () => {
      expect(mufNiceMax(85)).toBe(100);
      expect(mufNiceMax(450)).toBe(500);
      expect(mufNiceMax(1200)).toBe(2000);
    });

    it('returns 1 for zero or negative', () => {
      expect(mufNiceMax(0)).toBe(1);
      expect(mufNiceMax(-5)).toBe(1);
    });
  });

  describe('mufSmoothPath', () => {
    it('returns empty string for empty array', () => {
      expect(mufSmoothPath([])).toBe('');
    });

    it('returns single move for one point', () => {
      expect(mufSmoothPath([{ x: 10, y: 20 }])).toBe('M 10 20');
    });

    it('returns path with curves for multiple points', () => {
      const path = mufSmoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
      expect(path).toContain('M');
      expect(path).toContain('C');
    });
  });
});
