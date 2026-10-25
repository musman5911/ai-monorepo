/**
 * Demo data for MEMORY MODE ONLY.
 *
 * Automatically invoked from db.js when the database is running in
 * in-memory mode (MEMORY_MODE=1, no MONGO_URI) and no users exist yet.
 *
 * It NEVER runs against a real MongoDB / production Replit deployment.
 * It seeds a full YEAR of realistic crop-farm data covering every module:
 * crops (completed + growing + harvesting + planted), finance ledger
 * (income + every expense category), inventory, tasks, liabilities,
 * irrigation, spray logs, laborers and attendance — plus admin and worker
 * login accounts.
 *
 * Login credentials created by the seed:
 *   Admin:  username "admin"  / password "admin123"
 *   Worker: username "worker" / password "worker123"
 *
 * Same file name and role as dairy_farm/backend/demo-data.js and
 * flock_farm/backend/demo-data.js.
 */
import bcrypt from 'bcryptjs';
// Demo photos (memory mode only): stable hot-links from Unsplash (free
// license) — no image files stored in the repo.
const U = (id) => `https://images.unsplash.com/${id}?w=800&q=70&fm=jpg`;
const CROP_IMG = {
  corn: U('photo-1551810080-3eb3be72d3f4'),      // corn field
  wheat: U('photo-1529511582893-2d7e684dd128'),   // wheat field
  rice: U('photo-1561504935-4e7d4516a2d1'),       // rice paddy
  bajra: U('photo-1783042909392-0b8d8683e0a2'),   // millet (bajra) plants
  mattar: U('photo-1568584952324-45e972c25fb4'),  // pea plants
};
const ADMIN_AVATAR = U('photo-1673538064388-21d1aaaf6594'); // farmer in a field
const WORKER_AVATAR = U('photo-1696371268939-5c5710319bde'); // farm worker with a bucket

async function seedDemoData({
  Farm, User, Field, Crop, Finance, Task, Inventory, Liability, Irrigation,
  CropPhoto, Spray, Laborer, Attendance, LaborAdvance,
  Supplier, SupplierPayment,
}) {
  console.log('🌱 [Demo] Seeding in-memory database with realistic demo farm data...');


  const farm1 = await Farm.create({
    name: 'Farm 1', location: 'Local demo farm', archived: false,
    createdAt: new Date('2020-01-01T00:00:00.000Z'), updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  });
  const farm2 = await Farm.create({
    name: 'Farm 2 - Access Test', location: 'Isolated role-testing farm', archived: false,
    createdAt: new Date('2020-01-02T00:00:00.000Z'), updatedAt: new Date('2020-01-02T00:00:00.000Z'),
  });

  // ---------------------------------------------------------------- USERS
  await User.insertMany([
    {
      username: 'admin',
      email: 'admin@agrifarm.com',
      role: 'admin',
      password: bcrypt.hashSync('admin123', 12),
      avatar_base64: ADMIN_AVATAR,
    },
    {
      username: 'worker',
      email: '',
      role: 'worker',
      password: bcrypt.hashSync('worker123', 12),
      avatar_base64: WORKER_AVATAR,
    },
    {
      username: 'manager', email: 'manager@agrifarm.test', role: 'manager',
      farmIds: [String(farm2._id)], password: bcrypt.hashSync('manager123', 12), avatar_base64: WORKER_AVATAR,
    },
    {
      username: 'worker2', email: 'worker2@agrifarm.test', role: 'worker',
      farmIds: [String(farm2._id)], password: bcrypt.hashSync('worker2123', 12), avatar_base64: WORKER_AVATAR,
    },
  ]);

  // ---------------------------------------------------------------- FIELDS
  const fieldSeeds = [
    { name: 'Sector 1A', acres: 1.5, notes: 'North boundary plots' },
    { name: 'Sector 2B', acres: 2.0, notes: 'Rice and water-intensive crops' },
    { name: 'Sector 3C', acres: 1.0, notes: 'Corn rotation plots' },
  ];
  const seededFields = await Field.insertMany(fieldSeeds.map((field) => ({ ...field, farmId: String(farm1._id) })));
  const fieldIdByName = new Map(seededFields.map((field) => [field.name, String(field._id)]));

  // ---------------------------------------------------------------- CROPS
  // Dates are anchored to "today" ~ Aug 2026 so date-driven progress bars
  // and the monthly comparison table show a realistic spread.
  const crops = [
    {
      name: 'Corn (Last Kharif)', variety: 'Pioneer-30T87', status: 'Completed', field: 'Sector 3C',
      plant_date: '2025-06-20', harvest_date: '2025-10-05',
      yield_kg: 5200.0, yield_unit: 'kg', area_kanal: 4.0,
      notes: "Last year's Kharif corn cycle — sold entirely at Fateh Jang mandi.",
      image_base64: '', seed_quantity: 18.0, seed_unit: 'kg',
      seed_cost_per_unit: 850.0, season: 'Kharif', crop_year: '2025',
    },
    {
      name: 'Wheat', variety: 'Galaxy-2013', status: 'Completed', field: 'Sector 1A',
      plant_date: '2025-11-15', harvest_date: '2026-04-20',
      yield_kg: 4800.0, yield_unit: 'kg', area_kanal: 6.0,
      notes: 'Strong Rabi season with good rainfall and minimal pest pressure.',
      image_base64: '', seed_quantity: 120.0, seed_unit: 'kg',
      seed_cost_per_unit: 200.0, season: 'Rabi', crop_year: '2025',
    },
    {
      name: 'Basmati Rice', variety: 'Super Basmati', status: 'Growing', field: 'Sector 2B',
      plant_date: '2026-06-15', harvest_date: '2026-11-10',
      yield_kg: 0.0, yield_unit: 'kg', area_kanal: 8.0,
      notes: 'Transplanted nursery; standing water levels maintained. Top-dressing due soon.',
      image_base64: '', seed_quantity: 40.0, seed_unit: 'kg',
      seed_cost_per_unit: 750.0, season: 'Kharif', crop_year: '2026',
    },
    {
      name: 'Corn', variety: 'Pioneer-30T87', status: 'Growing', field: 'Sector 3C',
      plant_date: '2026-07-01', harvest_date: '2026-10-15',
      yield_kg: 0.0, yield_unit: 'kg', area_kanal: 4.0,
      notes: 'Spring sown corn, knee-high stage. Watching for fall armyworm.',
      image_base64: '', seed_quantity: 20.0, seed_unit: 'kg',
      seed_cost_per_unit: 900.0, season: 'Kharif', crop_year: '2026',
    },
    {
      name: 'Bajra', variety: 'Local Pearl Millet', status: 'Harvesting', field: 'Sector 1A',
      plant_date: '2026-05-20', harvest_date: '2026-08-25',
      yield_kg: 18.0, yield_unit: 'maund', area_kanal: 3.0,
      notes: 'Currently being harvested and threshed. Yield looking above average.',
      image_base64: '', seed_quantity: 8.0, seed_unit: 'kg',
      seed_cost_per_unit: 350.0, season: 'Kharif', crop_year: '2026',
    },
    {
      name: 'Mattar', variety: 'Peas - Meteor', status: 'Planted', field: 'Sector 4D',
      plant_date: '2026-08-05', harvest_date: '2026-12-20',
      yield_kg: 0.0, yield_unit: 'kg', area_kanal: 2.0,
      notes: 'Early Rabi sowing just completed. Staking planned in 3 weeks.',
      image_base64: '', seed_quantity: 15.0, seed_unit: 'kg',
      seed_cost_per_unit: 400.0, season: 'Rabi', crop_year: '2026',
    },
  ];
  // Demo photos: a real picture per crop (same image for both corn cycles).
  const cropPhoto = ['corn', 'wheat', 'rice', 'corn', 'bajra', 'mattar'];
  crops.forEach((c, i) => { c.image_base64 = CROP_IMG[cropPhoto[i]] || ''; });
  const cropDocs = await Crop.insertMany(crops.map((crop) => ({
    ...crop,
    fieldId: fieldIdByName.get(String(crop.field || '')) || undefined,
  })));
  const [corn25Id, wheatId, riceId, cornId, bajraId, mattarId] = cropDocs.map((d) => String(d._id));

  // ------------------------------------------------------------- FINANCE
  const finance = [
    // --- Corn Kharif 2025 (completed a year ago): full income + cost stack ---
    { category: 'Corn Harvest Sale', amount: 468000.0, type: 'income',
      date: '2025-10-10', crop_id: corn25Id, buyer_name: 'Fateh Jang Mandi',
      quantity_sold: 5200.0, rate_per_unit: 90.0,
      notes: 'Sold 5200 kg corn at Rs.90/kg.' },
    { category: 'Seed', amount: 15300.0, type: 'expense',
      date: '2025-06-20', crop_id: corn25Id, seed_qty_kg: 18.0, seed_price_per_kg: 850.0,
      notes: 'Automatically logged sowing seed inputs: 18 kg at Rs. 850/unit' },
    { category: 'Fertilizer', amount: 38000.0, type: 'expense',
      date: '2025-07-08', crop_id: corn25Id, notes: 'DAP basal + urea top dressing.' },
    { category: 'Hal (Plough)', amount: 15000.0, type: 'expense',
      date: '2025-06-15', crop_id: corn25Id, notes: 'Seedbed preparation.' },
    { category: 'Pesticide Spray', amount: 9500.0, type: 'expense',
      date: '2025-08-02', crop_id: corn25Id, notes: 'Fall armyworm control spray.' },
    { category: 'Labor', amount: 42000.0, type: 'expense',
      date: '2025-10-03', crop_id: corn25Id, notes: 'Harvest + shelling labor.' },

    // --- Wheat (completed cycle): income + full cost stack ---
    { category: 'Wheat Harvest Sale', amount: 600000.0, type: 'income',
      date: '2026-04-25', crop_id: wheatId, buyer_name: 'Haripur Mandi Dealer',
      quantity_sold: 4800.0, rate_per_unit: 125.0,
      notes: 'Sold 4800 kg wheat to local mandi dealer at Rs.125/kg.' },
    { category: 'Seed', amount: 24000.0, type: 'expense',
      date: '2025-11-15', crop_id: wheatId, seed_qty_kg: 120.0, seed_price_per_kg: 200.0,
      notes: 'Automatically logged sowing seed inputs: 120 kg at Rs. 200/unit' },
    { category: 'Fertilizer', amount: 45000.0, type: 'expense',
      date: '2025-12-10', crop_id: wheatId,
      notes: '10 bags DAP + 8 bags Urea for wheat top-dressing.' },
    { category: 'Hal (Plough)', amount: 18000.0, type: 'expense',
      date: '2025-11-10', crop_id: wheatId, notes: '12 hours ploughing @ Rs.1500/hr.' },
    { category: 'Labor', amount: 60000.0, type: 'expense',
      date: '2026-04-22', crop_id: wheatId, notes: 'Harvest labor: 10 workers x 6 days x Rs.1000.' },
    { category: 'Cultivator', amount: 12000.0, type: 'expense',
      date: '2025-11-12', crop_id: wheatId, notes: '8 hours cultivator prep.' },

    // --- Basmati Rice (growing): costs incurred so far ---
    { category: 'Seed', amount: 30000.0, type: 'expense',
      date: '2026-06-15', crop_id: riceId, seed_qty_kg: 40.0, seed_price_per_kg: 750.0,
      notes: 'Automatically logged sowing seed inputs: 40 kg at Rs. 750/unit' },
    { category: 'Fertilizer', amount: 50000.0, type: 'expense',
      date: '2026-07-05', crop_id: riceId, notes: 'Basmati basal + first top-dress.' },
    { category: 'Labor', amount: 40000.0, type: 'expense',
      date: '2026-06-20', crop_id: riceId, notes: 'Transplanting nursery labor.' },
    { category: 'Hal (Plough)', amount: 20000.0, type: 'expense',
      date: '2026-06-10', crop_id: riceId, notes: 'Puddling operations for rice.' },

    // --- Corn (growing): early costs ---
    { category: 'Seed', amount: 18000.0, type: 'expense',
      date: '2026-07-01', crop_id: cornId, seed_qty_kg: 20.0, seed_price_per_kg: 900.0,
      notes: 'Automatically logged sowing seed inputs: 20 kg at Rs. 900/unit' },
    { category: 'Fertilizer', amount: 30000.0, type: 'expense',
      date: '2026-07-20', crop_id: cornId, notes: 'Corn basal DAP application.' },

    // --- Bajra (harvesting): costs + partial income ---
    { category: 'Seed', amount: 2800.0, type: 'expense',
      date: '2026-05-20', crop_id: bajraId, seed_qty_kg: 8.0, seed_price_per_kg: 350.0,
      notes: 'Automatically logged sowing seed inputs: 8 kg at Rs. 350/unit' },
    { category: 'Labor', amount: 12000.0, type: 'expense',
      date: '2026-08-18', crop_id: bajraId, notes: 'Threshing labor for bajra harvest.' },
    { category: 'Bajra Harvest Sale', amount: 90000.0, type: 'income',
      date: '2026-08-22', crop_id: bajraId, buyer_name: 'Wah Cantt Trader',
      quantity_sold: 18.0, rate_per_unit: 5000.0,
      notes: 'Partial sale: 18 maund bajra at Rs.5000/maund.' },

    // --- Mattar (just planted): seed cost ---
    { category: 'Seed', amount: 6000.0, type: 'expense',
      date: '2026-08-05', crop_id: mattarId, seed_qty_kg: 15.0, seed_price_per_kg: 400.0,
      notes: 'Automatically logged sowing seed inputs: 15 kg at Rs. 400/unit' },

    // --- Farm-wide operational ---
    { category: 'Diesel & Fuel', amount: 25000.0, type: 'expense',
      date: '2026-08-08', crop_id: null, notes: 'Tubewell + tractor diesel for the month.' },
    { category: 'Equipment Rental Income', amount: 8000.0, type: 'income',
      date: '2026-07-30', crop_id: null, buyer_name: 'Neighbour Farmer Ali',
      notes: 'Rented out tractor to neighbour for 2 days.' },
  ];

  // Monthly farm-wide running costs across the full year (diesel + repairs),
  // so the Monthly Summary shows a continuous 12-month history.
  const today = new Date();
  for (let back = 12; back >= 0; back--) {
    let y = today.getFullYear();
    let m = today.getMonth() + 1 - back; // 1..12
    while (m <= 0) { m += 12; y -= 1; }
    const ds = `${y}-${String(m).padStart(2, '0')}-08`;
    finance.push({
      category: 'Diesel & Fuel', amount: 18000.0 + (m * 700.0), type: 'expense',
      date: ds, crop_id: null,
      notes: 'Monthly tubewell + tractor diesel.',
    });
    if (m === 3 || m === 7 || m === 11) {
      finance.push({
        category: 'Machinery Repair', amount: 9000.0 + (m * 300.0), type: 'expense',
        date: `${y}-${String(m).padStart(2, '0')}-18`, crop_id: null,
        notes: 'Quarterly tractor / tubewell maintenance.',
      });
    }
  }

  // ------------------------------------------------- SUPPLIER KHATA
  // Two dealers the farm buys from on credit. Fertilizer/seed/spray
  // expenses get tagged with the dealer; monthly payments leave a
  // realistic balance still owed.
  const sup1 = (await Supplier.insertMany([{
    name: 'Taxila Zarai Markaz (Khad & Beej)', phone: '0300-4445566',
    address: 'GT Road, Taxila', notes: 'Fertilizer, seed and spray on credit',
  }]))[0];
  const sup2 = (await Supplier.insertMany([{
    name: 'Wah Diesel & Parts', phone: '0345-2223344',
    address: 'Main Bazaar, Wah Cantt', notes: 'Diesel + tractor parts',
  }]))[0];
  const sup1Id = String(sup1._id);
  const sup2Id = String(sup2._id);
  for (const f of finance) {
    if (f.type === 'expense' && ['Fertilizer', 'Seed', 'Pesticide Spray'].includes(f.category)) {
      f.supplier_id = sup1Id;
    } else if (f.type === 'expense' && f.category === 'Machinery Repair') {
      f.supplier_id = sup2Id;
    }
  }
  const payments = [];
  for (const [supplierId, monthly] of [[sup1Id, 14000.0], [sup2Id, 2400.0]]) {
    for (let m = 11; m >= 0; m--) {
      const pd = new Date();
      let month = pd.getMonth() + 1 - m;
      let year = pd.getFullYear();
      while (month <= 0) { month += 12; year -= 1; }
      if (year === pd.getFullYear() && month === pd.getMonth() + 1 && pd.getDate() < 20) continue;
      const wobble = 0.8 + ((m * 37) % 35) / 100.0;
      payments.push({
        supplier_id: supplierId,
        date: `${year}-${String(month).padStart(2, '0')}-20`,
        amount: Math.round(monthly * wobble),
        note: 'Monthly payment (cash)',
      });
    }
  }
  if (payments.length) await SupplierPayment.insertMany(payments);

  await Finance.insertMany(finance);

  // ----------------------------------------------------------- INVENTORY
  const invDocs = await Inventory.insertMany([
    { name: 'DAP Fertilizer', category: 'fertilizer', current_stock: 3.0,
      unit: 'bags', low_stock_threshold: 5.0 },   // LOW -> triggers alert
    { name: 'Urea Fertilizer', category: 'fertilizer', current_stock: 25.0,
      unit: 'bags', low_stock_threshold: 5.0 },
    { name: 'Wheat Seed (Galaxy)', category: 'seed', current_stock: 80.0,
      unit: 'kg', low_stock_threshold: 20.0 },
    { name: 'Lambda Pesticide', category: 'pesticide', current_stock: 12.0,
      unit: 'liters', low_stock_threshold: 5.0 },
  ]);
  const dapId = String(invDocs[0]._id);
  const lambdaId = String(invDocs[3]._id);

  // ---------------------------------------------------------------- TASKS
  await Task.insertMany([
    { title: 'Irrigate Basmati Rice Sector 2B', status: 'Pending',
      due_date: '2026-08-12', assigned_to: 'worker', priority: 'High',
      notes: 'Maintain 2-3 inch standing water. Check tubewell valves.',
      image_base64: CROP_IMG.rice, labor_cost: 1500.0,
      inventory_item_id: null, inventory_qty_consumed: 0.0 },
    { title: 'Apply DAP Fertilizer to Corn Sector 3C', status: 'Pending',
      due_date: '2026-08-15', assigned_to: 'worker', priority: 'Medium',
      notes: '2 bags DAP via broadcast method before next irrigation.',
      image_base64: CROP_IMG.corn, labor_cost: 1200.0,
      inventory_item_id: dapId, inventory_qty_consumed: 2.0 },
    { title: 'Harvest & Thresh Bajra Sector 1A', status: 'Pending',
      due_date: '2026-08-25', assigned_to: 'worker', priority: 'High',
      notes: 'Coordinate thresher machine booking. Load mandi transport.',
      image_base64: CROP_IMG.bajra, labor_cost: 5000.0,
      inventory_item_id: null, inventory_qty_consumed: 0.0 },
    { title: 'Pest control inspection Mattar Sector 4D', status: 'Completed',
      due_date: '2026-08-08', assigned_to: 'worker', priority: 'Low',
      notes: 'Inspected seedlings, no aphid activity detected.',
      image_base64: CROP_IMG.mattar, labor_cost: 800.0,
      inventory_item_id: null, inventory_qty_consumed: 0.0 },
    { title: 'Post-harvest field cleanup Wheat Sector 1A', status: 'Completed',
      due_date: '2026-05-10', assigned_to: 'worker', priority: 'Medium',
      notes: 'Stubble cleared and field prepped for next cycle.',
      image_base64: CROP_IMG.wheat, labor_cost: 3000.0,
      inventory_item_id: null, inventory_qty_consumed: 0.0 },
  ]);

  // ---------------------------------------------------------- LIABILITIES
  await Liability.insertMany([
    { creditor: 'Sargodha Fertilizer Dealer', amount_owed: 85000.0,
      due_date: '2026-09-30', crop_id: riceId, status: 'Pending',
      notes: 'Outstanding DAP + Urea credit for basmati season. Settle after rice harvest sale.' },
    { creditor: 'Local Seed Supplier (Raza Traders)', amount_owed: 30000.0,
      due_date: '2026-05-01', crop_id: wheatId, status: 'Paid',
      notes: 'Wheat seed credit, settled after mandi sale.' },
  ]);

  // ----------------------------------------------------------- IRRIGATION
  await Irrigation.insertMany([
    {
      crop_id: riceId, date: '2026-08-09', hours: 5.0,
      tubewell: 'rented', hourly_rate: 800.0, amount: 4000.0,
      finance_id: null, notes: 'Rented tubewell for standing water.',
    },
    {
      crop_id: cornId, date: '2026-08-10', hours: 3.0,
      tubewell: 'own', hourly_rate: 0.0, amount: 0.0,
      finance_id: null, notes: 'Own solar tubewell — hours only',
    },
  ]);
  await Finance.insertMany([{
    category: 'Irrigation', amount: 4000.0, type: 'expense',
    date: '2026-08-09', crop_id: riceId,
    notes: 'Rented tubewell: 5h × Rs. 800/hr. Rented tubewell for standing water.',
    hourly_rate: 800.0, custom_qty: 5.0, custom_price: 800.0,
  }]);

  // Season-long irrigation history (own solar tubewell = Rs 0; a few rented).
  const extraIrrigation = [];
  for (const d of ['2026-06-25', '2026-07-05', '2026-07-15', '2026-07-25', '2026-08-02']) {
    extraIrrigation.push({ crop_id: riceId, date: d, hours: 4.0, tubewell: 'own',
      hourly_rate: 0.0, amount: 0.0, finance_id: null,
      notes: 'Own solar tubewell — standing water top-up.' });
  }
  for (const d of ['2026-06-28', '2026-07-12', '2026-07-26', '2026-08-08']) {
    extraIrrigation.push({ crop_id: cornId, date: d, hours: 3.0, tubewell: 'own',
      hourly_rate: 0.0, amount: 0.0, finance_id: null,
      notes: 'Own solar tubewell.' });
  }
  for (const d of ['2025-12-05', '2026-01-10', '2026-02-14', '2026-03-12']) {
    extraIrrigation.push({ crop_id: wheatId, date: d, hours: 6.0, tubewell: 'rented',
      hourly_rate: 700.0, amount: 4200.0, finance_id: null,
      notes: 'Rented tubewell — canal closure period.' });
    await Finance.insertMany([{
      category: 'Irrigation', amount: 4200.0, type: 'expense',
      date: d, crop_id: wheatId,
      notes: 'Rented tubewell: 6h × Rs. 700/hr (canal closure).',
      hourly_rate: 700.0, custom_qty: 6.0, custom_price: 700.0,
    }]);
  }
  await Irrigation.insertMany(extraIrrigation);

  // ---------------------------------------------------------------- SPRAY
  await Spray.insertMany([{
    crop_id: riceId, date: '2026-08-07', chemical: 'Lambda Pesticide',
    dose: '0.5 L / acre', notes: 'Preventive spray on tillers.',
    image_base64: CROP_IMG.rice, inventory_item_id: lambdaId,
    inventory_qty_consumed: 0.5, inventory_deducted: true,
  }]);
  await Inventory.updateOne({ _id: lambdaId }, { $inc: { current_stock: -0.5 } });

  // A year of additional spray logs so the module has history to show.
  await Spray.insertMany([
    { crop_id: corn25Id, date: '2025-07-20', chemical: 'Emamectin (armyworm)',
      dose: '200 ml / acre', notes: 'Fall armyworm knockdown on corn.',
      image_base64: CROP_IMG.corn, inventory_item_id: null, inventory_qty_consumed: 0.0, inventory_deducted: false },
    { crop_id: corn25Id, date: '2025-08-14', chemical: 'Emamectin (follow-up)',
      dose: '200 ml / acre', notes: 'Second armyworm pass after scouting.',
      image_base64: '', inventory_item_id: null, inventory_qty_consumed: 0.0, inventory_deducted: false },
    { crop_id: wheatId, date: '2026-01-18', chemical: 'Buctril Super (broadleaf)',
      dose: '500 ml / acre', notes: 'Weed control at tillering.',
      image_base64: '', inventory_item_id: null, inventory_qty_consumed: 0.0, inventory_deducted: false },
    { crop_id: wheatId, date: '2026-03-02', chemical: 'Tilt fungicide (rust)',
      dose: '250 ml / acre', notes: 'Yellow rust patches on flag leaf.',
      image_base64: '', inventory_item_id: null, inventory_qty_consumed: 0.0, inventory_deducted: false },
    { crop_id: riceId, date: '2026-07-15', chemical: 'Cartap (stem borer)',
      dose: '4 kg / acre', notes: 'Granules broadcast with standing water.',
      image_base64: '', inventory_item_id: null, inventory_qty_consumed: 0.0, inventory_deducted: false },
  ]);

  // ----------------------------------------------- LABORERS + ATTENDANCE
  const labDocs = await Laborer.insertMany([
    { name: 'Ali', daily_wage: 1200.0, notes: 'Sector 2 irrigator / transplant' },
    { name: 'Raza', daily_wage: 1000.0, notes: 'Harvest and weeding' },
  ]);
  const aliId = String(labDocs[0]._id);
  const razaId = String(labDocs[1]._id);

  // A full YEAR of attendance. Every past month is already POSTED to the
  // ledger as one monthly wage expense (same as the post-wages endpoint
  // produces); the current month stays unposted so the wage sheet has
  // live rows to show. Ali works 6 days/week, Raza 5; some half days.
  const wages = { [aliId]: ['Ali', 1200.0], [razaId]: ['Raza', 1000.0] };
  const now = new Date();
  const allRows = [];
  for (let back = 11; back >= 0; back--) {
    const mYear = (now.getMonth() + 1 - back) > 0 ? now.getFullYear() : now.getFullYear() - 1;
    const mMonth = ((now.getMonth() + 1 - back - 1) % 12 + 12) % 12 + 1;
    const isCurrent = mYear === now.getFullYear() && mMonth === now.getMonth() + 1;
    let daysInMonth;
    if (isCurrent) daysInMonth = now.getDate();
    else if (mMonth === 12) daysInMonth = 31;
    else daysInMonth = new Date(mYear, mMonth, 0).getDate();
    const monthKey = `${mYear}-${String(mMonth).padStart(2, '0')}`;
    const monthLines = [];
    let monthTotal = 0;
    let monthDays = 0;
    const monthRows = [];
    for (const [lid, [lname, lwage]] of Object.entries(wages)) {
      let units = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const dow = new Date(mYear, mMonth - 1, day).getDay(); // 0=Sun..6=Sat
        if (dow === 0) continue; // Sunday off for everyone
        if (lid === razaId && dow === 5) continue; // Raza also takes Friday off
        const half = day % 9 === 0;
        units += half ? 0.5 : 1.0;
        monthRows.push({
          laborer_id: lid, date: `${monthKey}-${String(day).padStart(2, '0')}`,
          day_type: half ? 'half' : 'full',
          day_units: half ? 0.5 : 1.0,
          crop_id: [6, 7, 8, 9].includes(mMonth) ? riceId : wheatId,
          field: lid === aliId ? 'Sector 2B' : 'Sector 3C',
          notes: '', posted: !isCurrent,
        });
      }
      if (!isCurrent && units > 0) {
        monthTotal += units * lwage;
        monthDays += units;
        const g = (n) => String(Math.round(n * 100) / 100);
        monthLines.push(`${lname} ${g(units)}d × Rs. ${g(lwage)}`);
      }
    }
    if (!isCurrent && monthTotal > 0) {
      const finDoc = (await Finance.insertMany([{
        category: 'Labor', amount: Math.round(monthTotal * 100) / 100, type: 'expense',
        date: `${monthKey}-28`, crop_id: null,
        notes: `Monthly labor wages ${monthKey}: ` + monthLines.join('; '),
        labor_workers: Number(Object.keys(wages).length), labor_days: monthDays,
        labor_wage_rate: monthDays ? Math.round((monthTotal / monthDays) * 100) / 100 : 0,
      }]))[0];
      for (const r of monthRows) r.finance_id = String(finDoc._id);
    }
    allRows.push(...monthRows);
  }
  await Attendance.insertMany(allRows);

  // Two open advances this month (settled automatically on wage posting).
  const cy = now.getFullYear();
  const cm = String(now.getMonth() + 1).padStart(2, '0');
  await LaborAdvance.insertMany([
    { laborer_id: aliId, date: `${cy}-${cm}-05`,
      amount: 6000.0, settled: false, notes: 'Eid advance' },
    { laborer_id: razaId, date: `${cy}-${cm}-10`,
      amount: 2500.0, settled: false, notes: 'Medical need' },
  ]);

  // Crop diary photos (small demo thumbnails).
  await CropPhoto.insertMany([
    { crop_id: riceId, image_base64: CROP_IMG.rice || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAIAAADbtmxLAAAAS0lEQVR42mNoP/d6UCGGUQeNOmjUQSPOQUrdSuhoPgaio5pRBw1BBw2o9ZhqRh00BB00GstGHTRaDo06aLQcGs32o+XQaLYf2Q4CAMoZMOpjO2v9AAAAAElFTkSuQmCC',
      uploaded_at: '2026-07-20', label: 'Standing water after transplant' },
    { crop_id: cornId, image_base64: CROP_IMG.corn || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAIAAADbtmxLAAAAQUlEQVR42u3OQQkAIBAAwYtieVsYwAxiCCNYQJ+CcAP73MdEn+urAggIKB1o1HKsXXr9AwEBAQEBAQEBAQEBJQNtjyXml2CPRRMAAAAASUVORK5CYII=',
      uploaded_at: '2026-08-01', label: 'Tasseling stage — Sector 3C' },
  ]);

  console.log('🌱 [Demo] Demo data seeded successfully.');
  console.log('🌱 [Demo] Login -> admin / admin123  (or)  worker / worker123');
}

export { seedDemoData };
