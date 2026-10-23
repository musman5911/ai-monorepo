import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM helper without type declarations
import { calculateBatchSummary, validateBatchEggLog } from '../flock_farm/backend/batch-math.mjs';

describe('batch egg log validation', () => {
  it('accepts a valid daily production record', () => {
    expect(validateBatchEggLog({
      date: '2026-10-23', collected: 100, sold: 60, home_use: 10,
      broken_wasted: 5, price_per_egg: 20,
    })).toBeNull();
  });

  it('rejects counts that exceed collected eggs', () => {
    expect(validateBatchEggLog({
      date: '2026-10-23', collected: 10, sold: 8, home_use: 2, broken_wasted: 1,
    })).toMatch(/cannot exceed collected eggs/);
  });

  it('rejects negative values and missing dates', () => {
    expect(validateBatchEggLog({ collected: 5 })).toBe('date is required');
    expect(validateBatchEggLog({
      date: '2026-10-23', collected: 5, sold: -1,
    })).toMatch(/0 or greater/);
  });
});

describe('batch financial summary', () => {
  it('includes egg income in revenue and vaccination cost in expenses', () => {
    const summary = calculateBatchSummary({
      batch: { intake_count: 10, cost_per_bird: 100 },
      feedLogs: [{ quantity_kg: 2, rate_rs_per_kg: 50 }],
      expenseLogs: [{ amount: 30 }],
      vaccinationLogs: [{ cost: 20 }],
      eggLogs: [{ collected: 20, sold: 10, price_per_egg: 5 }],
      salesLogs: [{ count: 2, amount: 400 }],
      mortalityLogs: [{ count: 1 }],
    });
    expect(summary).toMatchObject({
      intake_cost: 1000,
      total_feed_cost: 100,
      total_vaccination_cost: 20,
      total_expense_cost: 50,
      total_eggs_collected: 20,
      total_eggs_sold: 10,
      total_eggs_available: 10,
      total_egg_income: 50,
      total_revenue: 450,
      total_cost: 1150,
      live_count: 7,
      profit_loss: -700,
    });
  });

  it('deducts sales, home use and waste from available eggs', () => {
    const summary = calculateBatchSummary({
      batch: { intake_count: 10, cost_per_bird: 100 },
      eggLogs: [
        { collected: 100, sold: 20, home_use: 5, broken_wasted: 3 },
        { collected: 40, sold: 10, home_use: 2, broken_wasted: 1 },
      ],
    });
    expect(summary.total_eggs_available).toBe(99);
  });

  it('returns null for a missing batch', () => {
    expect(calculateBatchSummary({ batch: null })).toBeNull();
  });
});
