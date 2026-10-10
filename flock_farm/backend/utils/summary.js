// Builds a daily summary (plain-text + HTML) from raw farm data arrays.
// Server-side, pure JS (no TS imports).

// Farm-local "today" comes from the shared muf-date twin (same file in all
// three backends — Pakistan +5).
import { mufToday } from '../muf-date.mjs';

const todayStr = mufToday;

function fmtRs(n) {
  return `Rs ${Math.round(Number(n) || 0).toLocaleString()}`;
}

function parseDateOnlyUtcMs(date) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

function diffDateOnlyDays(from, to) {
  return Math.floor((parseDateOnlyUtcMs(to) - parseDateOnlyUtcMs(from)) / 86400000);
}

function recordEggIncome(e, settings) {
  const price = (e && e.pricePerEgg != null) ? e.pricePerEgg : settings.defaultPricePerEgg;
  return (e?.sold || 0) * price;
}

export function buildDailySummary({ birds, expenses, feed, eggs, vaccinations, customerSales, settings }, date = todayStr()) {
  const activeBirds = birds.filter(b => b.status === 'Active' || b.status === 'Sick');
  const males = activeBirds.filter(b => b.gender === 'Male').length;
  const females = activeBirds.filter(b => b.gender === 'Female').length;
  const sick = birds.filter(b => b.status === 'Sick').length;
  const deadToday = birds.filter(b => b.status === 'Dead' && b.dateDied === date).length;

  // --- Eggs ---
  const todayEggs = eggs.filter(e => e.date === date);
  const eggsCollected = todayEggs.reduce((s, e) => s + (e.totalEggsCollected || 0), 0);
  const eggsSold = todayEggs.reduce((s, e) => s + (e.sold || 0), 0);
  const eggsHomeUse = todayEggs.reduce((s, e) => s + (e.homeUse || 0), 0);
  const eggsBroken = todayEggs.reduce((s, e) => s + (e.brokenWasted || 0), 0);
  const eggsUnallocated = eggsCollected - eggsSold - eggsHomeUse - eggsBroken;
  const eggIncome = todayEggs.reduce((s, e) => s + recordEggIncome(e, settings), 0);

  // --- Bird sales today ---
  const birdSalesToday = birds.filter(b => b.status === 'Sold' && b.saleDate === date);
  const birdSaleIncomeToday = birdSalesToday.reduce((s, b) => s + (b.salePrice || 0), 0);

  // --- Customer (credit) sales today ---
  const todayCustomerSales = (customerSales || []).filter(cs => cs.date === date);
  const custEggIncomeToday = todayCustomerSales.reduce((s, cs) => s + (cs.eggsQty || 0) * (cs.pricePerEgg || 0), 0);
  const custPaymentsToday = todayCustomerSales.reduce((s, cs) => s + (cs.amountPaid || 0), 0);
  const custEggsToday = todayCustomerSales.reduce((s, cs) => s + (cs.eggsQty || 0), 0);

  // --- Expenses ---
  const expensesToday = expenses.filter(e => e.date === date).reduce((s, e) => s + (e.amount || 0), 0);
  const todayFeed = feed.filter(f => f.date === date);
  const feedKgToday = todayFeed.reduce((s, f) => s + (f.quantityKg || 0), 0);
  const feedCostToday = todayFeed.reduce((s, f) => s + (f.quantityKg || 0) * (f.rateRsPerKg || 0), 0);
  const vaxToday = (vaccinations || []).filter(v => v.date === date);
  const vaxCostToday = vaxToday.reduce((s, v) => s + (v.cost || 0), 0);
  const totalExpensesToday = expensesToday + feedCostToday + vaxCostToday;

  // Bird purchases today are capex — include in total spend for the day
  const birdsBoughtToday = birds.filter(b => b.dateBought === date);
  const birdPurchaseToday = birdsBoughtToday.reduce((s, b) => s + (b.price || 0), 0);
  const totalSpendToday = totalExpensesToday + birdPurchaseToday;
  const totalIncomeToday = eggIncome + birdSaleIncomeToday + custEggIncomeToday;
  const netToday = totalIncomeToday - totalSpendToday;

  // --- Alerts ---
  const intervalDays = settings.vaccinationIntervalDays || 30;
  const overdueVaccinations = activeBirds.filter(b => {
    if (!b.lastVaccinationDate) return true;
    return diffDateOnlyDays(b.lastVaccinationDate, date) > intervalDays;
  }).length;

  // --- Text summary ---
  const lines = [];
  lines.push(`🐔 Usman Flock Farm — Daily Summary`);
  lines.push(`📅 ${date}`);
  lines.push('');
  lines.push('━ FLOCK ━');
  lines.push(`Total active: ${activeBirds.length} (${males} ♂ / ${females} ♀)`);
  if (sick > 0) lines.push(`🤒 Sick: ${sick}`);
  if (deadToday > 0) lines.push(`✝ Deaths today: ${deadToday}`);
  lines.push('');
  lines.push('━ EGGS ━');
  lines.push(`Collected: ${eggsCollected}  Sold: ${eggsSold}  Home: ${eggsHomeUse}  Broken: ${eggsBroken}`);
  lines.push(`Unallocated: ${eggsUnallocated >= 0 ? '+' : ''}${eggsUnallocated}`);
  if (eggIncome > 0) lines.push(`💰 Egg income: ${fmtRs(eggIncome)}`);
  if (custEggIncomeToday > 0) lines.push(`🧾 Credit egg sales: ${custEggsToday} eggs · ${fmtRs(custEggIncomeToday)}`);
  if (custPaymentsToday > 0) lines.push(`💵 Customer payments received: ${fmtRs(custPaymentsToday)}`);
  lines.push('');
  lines.push('━ FEED ━');
  lines.push(`Purchased today: ${feedKgToday.toFixed(1)} kg${feedCostToday > 0 ? ` · Cost: ${fmtRs(feedCostToday)}` : ''}`);
  lines.push('');
  lines.push('━ MONEY ━');
  if (birdSaleIncomeToday > 0) lines.push(`Bird sales: ${fmtRs(birdSaleIncomeToday)}`);
  if (birdPurchaseToday > 0) lines.push(`Bird purchases: ${fmtRs(birdPurchaseToday)}`);
  if (vaxCostToday > 0) lines.push(`Vaccination cost: ${fmtRs(vaxCostToday)}`);
  lines.push(`Operating expenses (other+feed+vax): ${fmtRs(totalExpensesToday)}`);
  lines.push(`Total spend today: ${fmtRs(totalSpendToday)}`);
  lines.push(`Total income today: ${fmtRs(totalIncomeToday)}`);
  lines.push(`Net today: ${netToday >= 0 ? '✅' : '🔴'} ${fmtRs(netToday)}`);
  lines.push('');
  if (sick > 0 || overdueVaccinations > 0) {
    lines.push('━ ⚠ ALERTS ━');
    if (sick > 0) lines.push(`🤒 ${sick} bird${sick > 1 ? 's' : ''} marked sick`);
    if (overdueVaccinations > 0) lines.push(`💉 ${overdueVaccinations} bird${overdueVaccinations > 1 ? 's' : ''} due for vaccination`);
    lines.push('');
  }
  lines.push('— Sent from Usman Flock Farm');
  const text = lines.join('\n');

  const html = buildHtml({
    date, activeBirds: activeBirds.length, males, females, sick, deadToday,
    eggsCollected, eggsSold, eggsHomeUse, eggsBroken, eggsUnallocated,
    eggIncome, custEggIncomeToday, custPaymentsToday, custEggsToday,
    birdSaleIncomeToday, birdPurchaseToday, vaxCostToday,
    feedKgToday, feedCostToday,
    opExps: totalExpensesToday, totalSpend: totalSpendToday, totalIncome: totalIncomeToday,
    netToday, overdueVaccinations, fmtRs,
  });

  return {
    date, text, html,
    stats: {
      totalBirds: birds.length,
      activeBirds: activeBirds.length,
      males, females, sick, deadToday,
      eggsCollected, eggsSold, eggsHomeUse, eggsBroken, eggsUnallocated,
      eggIncome, custEggIncomeToday, custPaymentsToday,
      feedKgToday, feedCostToday, vaxCostToday,
      expensesToday, totalExpensesToday,
      birdSaleIncomeToday, birdPurchaseToday,
      totalIncomeToday, totalSpendToday, netToday,
      overdueVaccinations,
    }
  };
}

function row(label, val, color = '') {
  return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;font-size:13px;${color}">${val}</td></tr>`;
}

function buildHtml(d) {
  // Inner content only — the muf email shell (shared header/footer) is added
  // by sendSummaryEmail in mailer.js.
  return `
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${row('🐔 Active birds', `${d.activeBirds} <span style="color:#0ea5e9">(${d.males}♂ · ${d.females}♀)</span>`)}
      ${d.sick > 0 ? row('🤒 Sick', d.sick, 'color:#dc2626') : ''}
      ${d.deadToday > 0 ? row('✝ Deaths today', d.deadToday, 'color:#dc2626') : ''}
      ${row('🥚 Collected', d.eggsCollected)}
      ${row('Sold / Home / Broken', `${d.eggsSold} / ${d.eggsHomeUse} / ${d.eggsBroken}`)}
      ${row('Unallocated', `${d.eggsUnallocated >= 0 ? '+' : ''}${d.eggsUnallocated}`, d.eggsUnallocated >= 0 ? 'color:#059669' : 'color:#dc2626')}
      ${d.eggIncome > 0 ? row('💰 Egg income', d.fmtRs(d.eggIncome), 'color:#059669') : ''}
      ${d.custEggIncomeToday > 0 ? row('🧾 Credit sales', `${d.custEggsToday} eggs · ${d.fmtRs(d.custEggIncomeToday)}`, 'color:#059669') : ''}
      ${d.custPaymentsToday > 0 ? row('💵 Customer payments', d.fmtRs(d.custPaymentsToday), 'color:#059669') : ''}
      ${d.birdSaleIncomeToday > 0 ? row('🐦 Bird sales', d.fmtRs(d.birdSaleIncomeToday), 'color:#059669') : ''}
      ${row('🌾 Feed purchased', `${d.feedKgToday.toFixed(1)} kg${d.feedCostToday > 0 ? ' · ' + d.fmtRs(d.feedCostToday) : ''}`)}
      ${d.vaxCostToday > 0 ? row('💉 Vaccinations', d.fmtRs(d.vaxCostToday)) : ''}
      ${d.birdPurchaseToday > 0 ? row('🐣 Bird purchases', d.fmtRs(d.birdPurchaseToday)) : ''}
      ${row('Operating expenses', d.fmtRs(d.opExps))}
      ${row('Total spend today', d.fmtRs(d.totalSpend))}
      ${row('Total income today', d.fmtRs(d.totalIncome), 'color:#059669')}
      ${row('Net today', `${d.netToday >= 0 ? '✅' : '🔴'} ${d.fmtRs(d.netToday)}`, d.netToday >= 0 ? 'color:#059669' : 'color:#dc2626')}
    </table>
    ${(d.sick > 0 || d.overdueVaccinations > 0) ? `
    <div style="margin-top:16px;padding:12px 16px;background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;color:#92400e;font-size:13px;">
      <strong>⚠ Alerts</strong>
      <ul style="margin:6px 0 0 18px;padding:0;">
        ${d.sick > 0 ? `<li>🤒 ${d.sick} bird${d.sick > 1 ? 's' : ''} marked sick</li>` : ''}
        ${d.overdueVaccinations > 0 ? `<li>💉 ${d.overdueVaccinations} bird${d.overdueVaccinations > 1 ? 's' : ''} due for vaccination</li>` : ''}
      </ul>
    </div>` : ''}`;
}
