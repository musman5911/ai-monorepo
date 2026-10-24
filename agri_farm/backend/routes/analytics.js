// Compact, farm-scoped analytics for Agri dashboard/report views.
// Lists and editor forms continue using their paged endpoints. This route sends
// aggregates plus bounded recent rows, and deliberately excludes photo blobs.
import express from 'express';
import { Crop, Finance, Task } from '../db.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';
import { mufIsFullRole } from '../muf-farms.mjs';
import { todayStr } from '../utils/date.js';

const router = express.Router();

const monthOf = (value) => (
  typeof value === 'string' && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : ''
);
const amountOf = (row) => {
  const value = Number(row?.amount);
  return Number.isFinite(value) ? value : 0;
};
const shiftMonth = (key, amount) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 7);
};
const emptyMoney = () => ({ income: 0, expense: 0, net: 0 });
const percentChange = (current, previous) => (
  previous ? Math.round(((current - previous) / Math.abs(previous)) * 100) : null
);
const containsName = (text, name) => {
  const haystack = String(text || '').toLowerCase();
  const needle = String(name || '').trim().toLowerCase();
  if (needle.length < 2) return false;
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return false;
    const before = index > 0 ? haystack[index - 1] : ' ';
    const after = haystack[index + needle.length] || ' ';
    if (/[^a-z0-9]/.test(before) && /[^a-z0-9]/.test(after)) return true;
    from = index + 1;
  }
  return false;
};
const asId = (row) => ({ ...row, _id: String(row._id) });

router.get('/analytics/summary', protect, asyncHandler(async (req, res) => {
  const fullRole = mufIsFullRole(req.user.role);
  const today = todayStr();
  const currentMonthKey = today.slice(0, 7);
  const previousMonthKey = shiftMonth(currentMonthKey, -1);
  const lastYearMonthKey = shiftMonth(currentMonthKey, -12);

  // Use find/select/lean rather than raw aggregation: the shared MUF wrapper
  // applies the active farm scope to these reads. Never query the base
  // collections directly or mix records from the owner's other farms.
  const [crops, tasks, finance] = await Promise.all([
    Crop.find(fullRole ? {} : { status: { $ne: 'Completed' } })
      .select('_id name variety status area_kanal plant_date harvest_date field season crop_year yield_kg yield_unit createdAt')
      .lean(),
    Task.find({})
      .select('_id title status due_date completed_at date crop_id assigned_to priority notes laborer_ids laborer_names createdAt')
      .lean(),
    fullRole
      ? Finance.find({}).select('_id type amount date crop_id category notes buyer_name description').lean()
      : Promise.resolve(null),
  ]);

  const cropRows = crops.map(asId).map((crop) => ({
    ...crop,
    name: crop.name || '',
    variety: crop.variety || '',
    status: crop.status || '',
    plant_date: crop.plant_date || '',
    harvest_date: crop.harvest_date || '',
    field: crop.field || '',
    season: crop.season || '',
    crop_year: crop.crop_year == null ? '' : String(crop.crop_year),
    yield_unit: crop.yield_unit || 'kg',
  }));
  const cropById = new Map(cropRows.map((crop) => [crop._id, crop]));
  const cropMonthCounts = new Map();
  const cropStatuses = { Growing: 0, Planted: 0, Harvesting: 0, Completed: 0, Other: 0 };
  const fields = new Set();
  const seasons = new Set();
  const years = new Set();
  let areaKanal = 0;
  for (const crop of cropRows) {
    if (Object.prototype.hasOwnProperty.call(cropStatuses, crop.status)) cropStatuses[crop.status] += 1;
    else cropStatuses.Other += 1;
    const area = Number(crop.area_kanal);
    if (Number.isFinite(area)) areaKanal += area;
    if (crop.field) fields.add(String(crop.field));
    if (crop.season) seasons.add(String(crop.season));
    if (crop.crop_year) years.add(String(crop.crop_year));
    const month = monthOf(crop.plant_date);
    if (month) cropMonthCounts.set(month, (cropMonthCounts.get(month) || 0) + 1);
  }

  const taskStatuses = { Pending: 0, Completed: 0, Other: 0 };
  const taskByCrop = new Map();
  const taskByAssignee = new Map();
  let dueToday = 0;
  let completedToday = 0;
  let taskActivityToday = false;
  let pendingIrrigation = 0;
  for (const task of tasks) {
    if (Object.prototype.hasOwnProperty.call(taskStatuses, task.status)) taskStatuses[task.status] += 1;
    else taskStatuses.Other += 1;
    const activityDate = String(task.completed_at || task.date || '').slice(0, 10);
    if (activityDate === today) taskActivityToday = true;
    if (activityDate === today && task.status === 'Completed') completedToday += 1;
    if (task.status === 'Pending' && String(task.due_date || '').slice(0, 10) === today) dueToday += 1;
    const taskText = String(task.title || '') + ' ' + String(task.notes || '');
    if (task.status === 'Pending' && ['irrigation', 'irrigate', 'tubewell', 'tube-well', 'sprinkler', 'watering']
      .some((term) => taskText.toLowerCase().includes(term))) pendingIrrigation += 1;

    const assignee = String(task.assigned_to || '').trim();
    if (assignee) {
      const assigneeKey = assignee.toLowerCase();
      const assigned = taskByAssignee.get(assigneeKey) || {
        assignee, pending: 0, completed: 0, total: 0,
      };
      assigned.total += 1;
      if (task.status === 'Pending') assigned.pending += 1;
      if (task.status === 'Completed') assigned.completed += 1;
      taskByAssignee.set(assigneeKey, assigned);
    }

    const linkedCropIds = new Set();
    const explicitId = String(task.crop_id || '');
    if (explicitId && cropById.has(explicitId)) linkedCropIds.add(explicitId);
    else {
      for (const crop of cropRows) {
        if (containsName(task.title, crop.name) || containsName(task.notes, crop.name) ||
            containsName(task.title, crop.variety)) linkedCropIds.add(crop._id);
      }
    }
    for (const cropId of linkedCropIds) {
      const summary = taskByCrop.get(cropId) || { crop_id: cropId, pending: 0, completed: 0, total: 0 };
      summary.total += 1;
      if (task.status === 'Pending') summary.pending += 1;
      if (task.status === 'Completed') summary.completed += 1;
      taskByCrop.set(cropId, summary);
    }
  }
  const taskSort = (a, b) => String(b.due_date || b.completed_at || b.date || b.createdAt || '')
    .localeCompare(String(a.due_date || a.completed_at || a.date || a.createdAt || ''));
  const recentTasks = [...tasks].sort(taskSort).slice(0, 40).map(asId);
  const pendingTasks = tasks.filter((task) => task.status === 'Pending').sort(taskSort);
  const recentPendingTasks = pendingTasks.slice(0, 40).map(asId);
  const pendingTasksWithCrew = pendingTasks.filter((task) => Array.isArray(task.laborer_ids) && task.laborer_ids.length > 0);
  const taskSummary = {
    total: tasks.length,
    byStatus: taskStatuses,
    byCrop: [...taskByCrop.values()],
    byAssignee: [...taskByAssignee.values()],
    recentPending: recentPendingTasks,
    pendingWithCrewCount: pendingTasksWithCrew.length,
    recentPendingWithCrew: pendingTasksWithCrew.slice(0, 40).map(asId),
    dueToday,
    completedToday,
    pendingIrrigation,
    activityToday: taskActivityToday,
    recent: recentTasks,
  };

  let financeSummary = null;
  let financeActivityToday = false;
  if (fullRole) {
    const ledger = finance || [];
    const totals = emptyMoney();
    const monthTotals = new Map();
    const byCropTotals = new Map();
    const byCropMonths = new Map();
    const byCropCategories = new Map();
    const byCropIncomeCategories = new Map();
    const expenseCategories = new Map();
    const incomeCategories = new Map();
    const farmWideExpenseCategories = new Map();
    const farmWideIncomeCategories = new Map();
    let farmWideIncome = 0;
    let farmWideExpense = 0;
    let farmWideIncomeCount = 0;
    let farmWideExpenseCount = 0;
    let farmWideEntryCount = 0;

    for (const row of ledger) {
      const amount = amountOf(row);
      const isIncome = row.type === 'income';
      const isExpense = row.type === 'expense';
      if (isIncome) totals.income += amount;
      if (isExpense) totals.expense += amount;
      const date = String(row.date || '').slice(0, 10);
      if (date === today) financeActivityToday = true;

      const month = monthOf(row.date);
      if (month) {
        const monthly = monthTotals.get(month) || { income: 0, expense: 0, cropsCount: 0 };
        if (isIncome) monthly.income += amount;
        if (isExpense) monthly.expense += amount;
        monthTotals.set(month, monthly);
      }

      if (isExpense) {
        const category = String(row.category || 'Other');
        expenseCategories.set(category, (expenseCategories.get(category) || 0) + amount);
      }
      if (isIncome) {
        const buyer = String(row.buyer_name || '').trim() || String(row.category || 'General / Spot Sale');
        incomeCategories.set(buyer, (incomeCategories.get(buyer) || 0) + amount);
      }

      const cropId = String(row.crop_id || '');
      if (!cropId || !cropById.has(cropId)) {
        farmWideEntryCount += 1;
        if (isIncome) {
          farmWideIncome += amount;
          farmWideIncomeCount += 1;
          const buyer = String(row.buyer_name || '').trim() || String(row.category || 'General / Spot Sale');
          farmWideIncomeCategories.set(buyer, (farmWideIncomeCategories.get(buyer) || 0) + amount);
        }
        if (isExpense) {
          farmWideExpense += amount;
          farmWideExpenseCount += 1;
          const category = String(row.category || 'Other');
          farmWideExpenseCategories.set(category, (farmWideExpenseCategories.get(category) || 0) + amount);
        }
        continue;
      }

      const cropTotals = byCropTotals.get(cropId) || {
        income: 0, expense: 0, entryCount: 0, incomeCount: 0, expenseCount: 0,
      };
      cropTotals.entryCount += 1;
      if (isIncome) {
        cropTotals.income += amount;
        cropTotals.incomeCount += 1;
      }
      if (isExpense) {
        cropTotals.expense += amount;
        cropTotals.expenseCount += 1;
      }
      byCropTotals.set(cropId, cropTotals);

      if (month) {
        let cropMonths = byCropMonths.get(cropId);
        if (!cropMonths) {
          cropMonths = new Map();
          byCropMonths.set(cropId, cropMonths);
        }
        const monthly = cropMonths.get(month) || { income: 0, expense: 0, cropsCount: 0 };
        if (isIncome) monthly.income += amount;
        if (isExpense) monthly.expense += amount;
        cropMonths.set(month, monthly);
      }
      if (isIncome) {
        let categories = byCropIncomeCategories.get(cropId);
        if (!categories) {
          categories = new Map();
          byCropIncomeCategories.set(cropId, categories);
        }
        const buyer = String(row.buyer_name || '').trim() || String(row.category || 'General / Spot Sale');
        categories.set(buyer, (categories.get(buyer) || 0) + amount);
      }
      if (isExpense) {
        let categories = byCropCategories.get(cropId);
        if (!categories) {
          categories = new Map();
          byCropCategories.set(cropId, categories);
        }
        const category = String(row.category || 'Other');
        categories.set(category, (categories.get(category) || 0) + amount);
      }
    }

    totals.net = totals.income - totals.expense;
    const totalsForMonth = (key) => {
      const entry = monthTotals.get(key) || { income: 0, expense: 0 };
      return { key, income: entry.income, expense: entry.expense, net: entry.income - entry.expense };
    };
    const currentMonth = totalsForMonth(currentMonthKey);
    const previousMonth = totalsForMonth(previousMonthKey);
    const sameMonthLastYear = totalsForMonth(lastYearMonthKey);
    sameMonthLastYear.hasData = ledger.some((row) => String(row.date || '').startsWith(lastYearMonthKey));

    for (const [month, count] of cropMonthCounts) {
      const monthly = monthTotals.get(month) || { income: 0, expense: 0, cropsCount: 0 };
      monthly.cropsCount = count;
      monthTotals.set(month, monthly);
    }

    const monthlyRows = [...monthTotals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => [month, { income: value.income, expense: value.expense, cropsCount: value.cropsCount }]);

    const monthlyIncomeSeries = [...monthTotals.entries()]
      .filter(([, value]) => value.income !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({ label: month.slice(2), value: value.income }));

    const byCrop = cropRows.map((crop) => {
      const amounts = byCropTotals.get(crop._id) || {
        income: 0, expense: 0, entryCount: 0, incomeCount: 0, expenseCount: 0,
      };
      const months = byCropMonths.get(crop._id) || new Map();
      const plantMonth = monthOf(crop.plant_date);
      if (plantMonth) {
        const existing = months.get(plantMonth) || { income: 0, expense: 0, cropsCount: 0 };
        existing.cropsCount = 1;
        months.set(plantMonth, existing);
      }
      const monthlyRowsForCrop = [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => [month, value]);
      const categoryMap = byCropCategories.get(crop._id) || new Map();
      const categoryTotal = [...categoryMap.values()].reduce((sum, value) => sum + value, 0);
      const incomeMap = byCropIncomeCategories.get(crop._id) || new Map();
      return {
        crop_id: crop._id,
        name: crop.name || 'Crop',
        income: amounts.income,
        expense: amounts.expense,
        net: amounts.income - amounts.expense,
        entryCount: amounts.entryCount,
        incomeCount: amounts.incomeCount,
        expenseCount: amounts.expenseCount,
        monthlyRows: monthlyRowsForCrop,
        incomeBreakdown: [...incomeMap.entries()]
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount),
        expenseBreakdown: [...categoryMap.entries()]
          .map(([category, amount]) => ({
            category, amount,
            percentage: categoryTotal > 0 ? Math.round((amount / categoryTotal) * 100) : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
      };
    });
    const profitability = cropRows.map((crop) => {
      const amounts = byCropTotals.get(crop._id) || { income: 0, expense: 0 };
      const area = Number(crop.area_kanal) || 1;
      const netProfit = amounts.income - amounts.expense;
      return {
        ...crop,
        spent: amounts.expense,
        earned: amounts.income,
        netProfit,
        profitPerKanal: netProfit / area,
        area,
      };
    }).sort((a, b) => b.profitPerKanal - a.profitPerKanal);

    const categoryTotal = [...expenseCategories.values()].reduce((sum, value) => sum + value, 0);
    const expenseBreakdown = [...expenseCategories.entries()]
      .map(([category, amount]) => ({
        category, amount,
        percentage: categoryTotal > 0 ? Math.round((amount / categoryTotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
    const incomeBreakdown = [...incomeCategories.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const groups = [{
      id: 'farm-wide',
      name: 'General / Farm-Wide Operational',
      plot: 'General',
      entryCount: farmWideEntryCount,
      incomeCount: farmWideIncomeCount,
      expenseCount: farmWideExpenseCount,
      income: farmWideIncome,
      expense: farmWideExpense,
      net: farmWideIncome - farmWideExpense,
      incomeBreakdown: [...farmWideIncomeCategories.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      expenseBreakdown: [...farmWideExpenseCategories.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    }, ...byCrop.map((crop) => ({
      id: crop.crop_id,
      name: 'Crop: ' + crop.name,
      plot: cropRows.find((item) => item._id === crop.crop_id)?.field || 'Farm-wide',
      entryCount: crop.entryCount,
      incomeCount: crop.incomeCount,
      expenseCount: crop.expenseCount,
      income: crop.income,
      expense: crop.expense,
      net: crop.net,
      incomeBreakdown: crop.incomeBreakdown,
      expenseBreakdown: crop.expenseBreakdown.map((row) => ({ name: row.category, amount: row.amount })),
    }))];

    const recent = [...ledger]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) ||
        String(b._id).localeCompare(String(a._id)))
      .slice(0, 50)
      .map(asId);

    financeSummary = {
      totals: { entries: ledger.length, income: totals.income, expense: totals.expense, net: totals.net, farmWideIncome, farmWideExpense },
      currentMonth,
      previousMonth,
      sameMonthLastYear,
      comparison: {
        curInc: currentMonth.income,
        prevInc: previousMonth.income,
        curExp: currentMonth.expense,
        prevExp: previousMonth.expense,
        curNet: currentMonth.net,
        prevNet: previousMonth.net,
        netPct: percentChange(currentMonth.net, previousMonth.net),
        incPct: percentChange(currentMonth.income, previousMonth.income),
        lyInc: sameMonthLastYear.income,
        lyNet: sameMonthLastYear.net,
        hasLy: sameMonthLastYear.hasData,
        lyIncPct: percentChange(currentMonth.income, sameMonthLastYear.income),
        lyNetPct: percentChange(currentMonth.net, sameMonthLastYear.net),
      },
      monthlyIncomeSeries,
      monthlyRows,
      incomeBreakdown,
      expenseBreakdown,
      byCrop,
      profitability,
      groups: groups.filter((group) => group.id === 'farm-wide' || group.entryCount > 0),
      recent,
    };
  }

  return res.json({
    asOf: today,
    monthKey: currentMonthKey,
    activityToday: taskActivityToday || financeActivityToday,
    cropSummary: {
      total: cropRows.length,
      statusCounts: cropStatuses,
      areaKanal,
      fields: [...fields].sort(),
      seasons: [...seasons].sort(),
      years: [...years].sort(),
      monthlyCycles: [...cropMonthCounts.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      // No image_base64 is selected or returned. These are compact selector rows.
      options: cropRows.map((crop) => ({
        _id: crop._id,
        name: crop.name,
        variety: crop.variety,
        status: crop.status,
        area_kanal: crop.area_kanal,
        plant_date: crop.plant_date,
        harvest_date: crop.harvest_date,
        field: crop.field,
        season: crop.season,
        crop_year: crop.crop_year,
        yield_kg: crop.yield_kg,
        yield_unit: crop.yield_unit,
      })),
    },
    taskSummary,
    financeSummary,
  });
}));

export default router;
