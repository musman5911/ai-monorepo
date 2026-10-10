import { describe, it, expect } from 'vitest';
import { pctChange, trendArrow, sameMonthLastYearKey, lastMonthKey, thisMonthKey } from '../dairy_farm/client/src/muf-compare';

describe('muf-compare helpers', () => {
  describe('pctChange', () => {
    it('returns positive percentage when current > previous', () => {
      expect(pctChange(150, 100)).toBe(50);
    });

    it('returns negative percentage when current < previous', () => {
      expect(pctChange(80, 100)).toBe(-20);
    });

    it('returns null when previous is 0 (no baseline)', () => {
      expect(pctChange(100, 0)).toBeNull();
    });

    it('returns 0 when values are equal', () => {
      expect(pctChange(100, 100)).toBe(0);
    });

    it('uses absolute value of previous in denominator', () => {
      // pctChange(150, -100) = round(((150-(-100)) / abs(-100)) * 100) = round(250) = 250
      expect(pctChange(150, -100)).toBe(250);
    });
  });

  describe('trendArrow', () => {
    it('returns ▲ with percentage for positive change', () => {
      expect(trendArrow(10)).toBe('▲ 10%');
    });

    it('returns ▼ with percentage for negative change', () => {
      expect(trendArrow(-5)).toBe('▼ 5%');
    });

    it('returns — for null (no data)', () => {
      expect(trendArrow(null)).toBe('—');
    });

    it('returns ● 0% for zero change', () => {
      expect(trendArrow(0)).toBe('● 0%');
    });
  });

  describe('sameMonthLastYearKey', () => {
    it('returns a YYYY-MM string format', () => {
      const result = sameMonthLastYearKey();
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });

    it('returns a year that is 1 less than current year', () => {
      const currentYear = Number(thisMonthKey().slice(0, 4));
      const lastYear = Number(sameMonthLastYearKey().slice(0, 4));
      expect(currentYear - lastYear).toBe(1);
    });
  });

  describe('lastMonthKey', () => {
    it('returns a YYYY-MM string format', () => {
      expect(lastMonthKey()).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
