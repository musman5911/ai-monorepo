import { describe, it, expect } from 'vitest';
import { pctAmount, ZAKAT_DEFAULT_PCT } from '../dairy_farm/client/src/muf-zakat';

describe('muf-zakat helpers', () => {
  describe('ZAKAT_DEFAULT_PCT', () => {
    it('is 2.5 (standard Islamic zakat rate)', () => {
      expect(ZAKAT_DEFAULT_PCT).toBe(2.5);
    });
  });

  describe('pctAmount', () => {
    it('calculates 2.5% of profit correctly', () => {
      expect(pctAmount(100000, 2.5)).toBe(2500);
    });

    it('returns 0 for zero profit', () => {
      expect(pctAmount(0, 2.5)).toBe(0);
    });

    it('returns 0 for negative profit (loss)', () => {
      expect(pctAmount(-50000, 2.5)).toBe(0);
    });

    it('handles custom percentage', () => {
      expect(pctAmount(1000, 10)).toBe(100);
    });
  });
});
