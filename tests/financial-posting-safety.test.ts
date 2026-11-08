import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFinancialTransaction as runAgri } from '../agri_farm/backend/utils/financial-transaction.mjs';
import { runFinancialTransaction as runDairy } from '../dairy_farm/backend/utils/financial-transaction.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe.each([['Agri', runAgri], ['Dairy', runDairy]])('%s financial transaction adapter', (_name, run) => {
  it('serializes overlapping memory-mode operations', async () => {
    const model = { _store: [{ value: 0 }] };
    const increment = () => run({
      mongoose: null, memoryMode: true, models: [model],
      work: async () => {
        const current = model._store[0].value;
        await new Promise((resolve) => setTimeout(resolve, 8));
        model._store[0].value = current + 1;
      },
    });
    await Promise.all([increment(), increment()]);
    expect(model._store[0].value).toBe(2);
  });

  it('rolls back every supplied memory store when a write fails', async () => {
    const first = { _store: [{ value: 'before' }] };
    const second = { _store: [{ value: 10 }] };
    await expect(run({
      mongoose: null, memoryMode: true, models: [first, second],
      work: async () => {
        first._store[0].value = 'changed';
        second._store[0].value = 99;
        throw new Error('simulated ledger failure');
      },
    })).rejects.toThrow('simulated ledger failure');
    expect(first._store).toEqual([{ value: 'before' }]);
    expect(second._store).toEqual([{ value: 10 }]);
  });

  it('uses a MongoDB session transaction outside memory mode', async () => {
    const calls = [];
    const session = {
      async withTransaction(callback) { calls.push('begin'); await callback(); calls.push('commit'); },
      async endSession() { calls.push('end'); },
    };
    const result = await run({
      mongoose: { async startSession() { calls.push('start'); return session; } },
      memoryMode: false, models: [],
      work: async (received) => { expect(received).toBe(session); calls.push('work'); return 'committed'; },
    });
    expect(result).toBe('committed');
    expect(calls).toEqual(['start', 'begin', 'work', 'commit', 'end']);
  });
});

describe('financial route transaction contracts', () => {
  const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8');

  it('settles Agri liabilities and creates the finance expense inside one transaction', () => {
    const source = read('agri_farm/backend/routes/liabilities.js');
    const handler = source.split("router.put('/liabilities/:itemId/pay'")[1]?.split("router.delete('/liabilities/:itemId'")[0] || '';
    expect(handler).toContain('withFinancialTransaction([Liability, Crop, Finance]');
    expect(handler).toContain("status: { $ne: 'Paid' }");
    expect(handler).toContain('Finance.insertMany');
  });

  it('posts Agri and Dairy wages with conditional attendance claims', () => {
    const agri = read('agri_farm/backend/routes/labor.js').split("router.post('/labor/post-wages'")[1] || '';
    expect(agri).toContain('withFinancialTransaction');
    expect(agri).toContain('posted: { $ne: true }');
    expect(agri).toContain('Finance.insertMany');

    const dairy = read('dairy_farm/backend/routes/labor.js').split("router.post('/post-wages'")[1] || '';
    expect(dairy).toContain('withFinancialTransaction');
    expect(dairy).toContain('posted: { $ne: true }');
    expect(dairy).toContain('Expense.insertMany');
  });

  it('completes Agri tasks together with wage, stock, and attendance side effects', () => {
    const source = read('agri_farm/backend/routes/tasks.js');
    const handler = source.split("router.patch('/tasks/:taskId'")[1]?.split("router.delete('/tasks/:taskId'")[0] || '';
    expect(handler).toContain('withFinancialTransaction');
    expect(handler).toContain("status: { $ne: 'Completed' }");
    expect(handler).toContain('Finance.insertMany');
    expect(handler).toContain('current_stock: { $gte: qtyConsumed }');
  });
});
