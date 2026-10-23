export function validateBatchEggLog(record = {}) {
  const date = String(record.date || '').trim();
  const collected = Number(record.collected);
  const sold = Number(record.sold || 0);
  const home_use = Number(record.home_use || 0);
  const broken_wasted = Number(record.broken_wasted || 0);
  const price_per_egg = Number(record.price_per_egg || 0);

  if (!date) return 'date is required';
  const values = [collected, sold, home_use, broken_wasted, price_per_egg];
  if (!values.every(Number.isFinite) || values.some((value) => value < 0)) {
    return 'Egg counts and price must be 0 or greater';
  }
  if (sold + home_use + broken_wasted > collected) {
    return 'Sold, home-use and broken eggs cannot exceed collected eggs';
  }
  return null;
}

export function calculateBatchSummary({
  batch,
  feedLogs = [],
  mortalityLogs = [],
  expenseLogs = [],
  salesLogs = [],
  eggLogs = [],
  vaccinationLogs = [],
}) {
  if (!batch) return null;

  const intake_cost = (batch.intake_count || 0) * (batch.cost_per_bird || 0);
  const total_feed_cost = feedLogs.reduce((sum, log) => sum + (log.quantity_kg || 0) * (log.rate_rs_per_kg || 0), 0);
  const logged_expense_cost = expenseLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const total_vaccination_cost = vaccinationLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const total_expense_cost = logged_expense_cost + total_vaccination_cost;
  const total_eggs_collected = eggLogs.reduce((sum, log) => sum + (log.collected || 0), 0);
  const total_eggs_sold = eggLogs.reduce((sum, log) => sum + (log.sold || 0), 0);
  const total_egg_income = eggLogs.reduce((sum, log) => sum + (log.sold || 0) * (log.price_per_egg || 0), 0);
  const total_mortality_count = mortalityLogs.reduce((sum, log) => sum + (log.count || 0), 0);
  const total_sold_count = salesLogs.reduce((sum, log) => sum + (log.count || 0), 0);
  const total_revenue = salesLogs.reduce((sum, log) => sum + (log.amount || 0), 0) + total_egg_income;
  const total_cost = intake_cost + total_feed_cost + total_expense_cost;
  const live_count = Math.max(0, (batch.intake_count || 0) - total_mortality_count - total_sold_count);
  const profit_loss = total_revenue - total_cost;
  const mortality_pct = batch.intake_count > 0 ? (total_mortality_count / batch.intake_count) * 100 : 0;
  const cost_per_bird = live_count > 0
    ? total_cost / live_count
    : batch.intake_count > 0
      ? total_cost / batch.intake_count
      : 0;

  return {
    intake_cost,
    total_feed_cost,
    total_expense_cost,
    total_vaccination_cost,
    total_eggs_collected,
    total_eggs_sold,
    total_egg_income,
    total_mortality_count,
    total_sold_count,
    total_revenue,
    total_cost,
    live_count,
    profit_loss,
    mortality_pct,
    cost_per_bird,
  };
}
