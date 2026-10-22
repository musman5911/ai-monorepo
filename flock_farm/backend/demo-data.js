// ---------------------------------------------------------------------------
// DEMO DATA for MEMORY MODE ONLY (MEMORY_MODE=1, no MONGODB_URI set).
//
// Seeds the in-memory database with a full YEAR of realistic poultry-farm
// data covering every module: birds, vaccinations, feed, eggs, expenses,
// customers & sales, incubation, batches (with feed/mortality/expense/sale
// logs), daily checklist, diary — plus admin and worker login accounts.
//
// This NEVER runs against a real MongoDB. Data lives in RAM and is rebuilt
// fresh on every restart.
//
//   Logins:  admin / admin123     worker / worker123
// ---------------------------------------------------------------------------

function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return dateStr(d); }
function rnd(min, max) { return Math.round(min + Math.random() * (max - min)); }
function rnd1(min, max) { return Math.round((min + Math.random() * (max - min)) * 10) / 10; }

// Demo photos (memory mode only): stable hot-links from Unsplash (free
// license) — no image files stored in the repo.
const U = (id) => `https://images.unsplash.com/${id}?w=800&q=70&fm=jpg`;
const BIRD_IMG = {
  roosterDesi: U('photo-1583510383754-35fc1d1eb598'),   // red rooster
  roosterAseel: U('photo-1628820584329-3c2d5dbfca17'),  // gamefowl rooster
  roosterRhode: U('photo-1672620003939-f82a45cb5adc'),  // brown-and-white rooster
  henDesi: U('photo-1698494496967-d5754b2d9d26'),       // brown hen in a field
  henGolden: U('photo-1724882390234-5dc439d18dad'),     // hen with red comb
  henLayer: U('photo-1598016717029-026340d417d4'),      // white layer
  chick: U('photo-1546272989-40c92939c6c2'),            // young chicks
};
const ADMIN_AVATAR = U('photo-1673538064388-21d1aaaf6594'); // farmer in a field
const WORKER_AVATAR = U('photo-1696371268939-5c5710319bde'); // farm worker with a bucket

export async function seedDemoData() {
  const { default: User } = await import('./models/User.js');
  const { default: DataStore } = await import('./models/DataStore.js');
  const { default: Batch } = await import('./models/Batch.js');
  const { default: BatchFeedLog } = await import('./models/BatchFeedLog.js');
  const { default: BatchWeightLog } = await import('./models/BatchWeightLog.js');
  const { default: BatchMortalityLog } = await import('./models/BatchMortalityLog.js');
  const { default: BatchExpenseLog } = await import('./models/BatchExpenseLog.js');
  const { default: BatchSaleLog } = await import('./models/BatchSaleLog.js');

  // ------------------------------------------------------------------ USERS
  await User.create({
    username: 'admin',
    passwordHash: await User.hashPassword('admin123'),
    role: 'admin',
    displayName: 'Malik Usman',
    active: true,
    avatarBase64: ADMIN_AVATAR,
  });
  await User.create({
    username: 'worker',
    passwordHash: await User.hashPassword('worker123'),
    role: 'worker',
    displayName: 'Farm Worker',
    active: true,
    avatarBase64: WORKER_AVATAR,
  });

  // --------------------------------------------------------------- SETTINGS
  const settings = {
    defaultPricePerEgg: 25,
    vaccinationIntervalDays: 30,
    feedLowStockDays: 14,
    feedConsumptionKgPerDay: 2,
  };

  // ------------------------------------------------------------------ BIRDS
  // Mix of statuses: active roosters/hens, one sick, sold, dead, and one
  // hatched on-farm from an incubation batch.
  const birds = [
    { id: 1,  name: 'Kalu',        gender: 'Male',   breed: 'Desi',         dateBought: daysAgo(360), price: 1500, status: 'Active', ageBoughtDays: 120, dateOfBirth: daysAgo(480), lastVaccinationDate: daysAgo(12) },
    { id: 2,  name: 'Raja Kukar',  gender: 'Male',   breed: 'Aseel',        dateBought: daysAgo(330), price: 2200, status: 'Active', ageBoughtDays: 90,  dateOfBirth: daysAgo(420), lastVaccinationDate: daysAgo(8) },
    { id: 3,  name: 'Sultan',      gender: 'Male',   breed: 'Rhode Island', dateBought: daysAgo(200), price: 2000, status: 'Active', ageBoughtDays: 60,  dateOfBirth: daysAgo(260), lastVaccinationDate: daysAgo(25) },
    { id: 4,  name: 'Lali',        gender: 'Female', breed: 'Desi',         dateBought: daysAgo(360), price: 1200, status: 'Active', ageBoughtDays: 100, dateOfBirth: daysAgo(460), lastVaccinationDate: daysAgo(10) },
    { id: 5,  name: 'Chandni',     gender: 'Female', breed: 'Golden',       dateBought: daysAgo(340), price: 1300, status: 'Active', ageBoughtDays: 110, dateOfBirth: daysAgo(450), lastVaccinationDate: daysAgo(15) },
    { id: 6,  name: 'Moti',        gender: 'Female', breed: 'Misri',        dateBought: daysAgo(320), price: 1100, status: 'Active', ageBoughtDays: 95,  dateOfBirth: daysAgo(415), lastVaccinationDate: daysAgo(20) },
    { id: 7,  name: 'Heera',       gender: 'Female', breed: 'Layer',        dateBought: daysAgo(300), price: 1250, status: 'Active', ageBoughtDays: 80,  dateOfBirth: daysAgo(380), lastVaccinationDate: daysAgo(5) },
    { id: 8,  name: 'Reshma',      gender: 'Female', breed: 'Fayoumi',      dateBought: daysAgo(280), price: 1150, status: 'Active', ageBoughtDays: 85,  dateOfBirth: daysAgo(365), lastVaccinationDate: daysAgo(18) },
    { id: 9,  name: 'Soni',        gender: 'Female', breed: 'Golden',       dateBought: daysAgo(250), price: 1350, status: 'Sick',   ageBoughtDays: 75,  dateOfBirth: daysAgo(325), lastVaccinationDate: daysAgo(40) },
    { id: 10, name: 'Badshah',     gender: 'Male',   breed: 'Aseel',        dateBought: daysAgo(365), price: 2500, status: 'Sold',   ageBoughtDays: 150, dateOfBirth: daysAgo(515), salePrice: 4200, saleDate: daysAgo(90), lastVaccinationDate: daysAgo(120) },
    { id: 11, name: 'Kali',        gender: 'Female', breed: 'Desi',         dateBought: daysAgo(310), price: 1000, status: 'Sold',   ageBoughtDays: 90,  dateOfBirth: daysAgo(400), salePrice: 1800, saleDate: daysAgo(45), lastVaccinationDate: daysAgo(80) },
    { id: 12, name: 'Bholi',       gender: 'Female', breed: 'Misri',        dateBought: daysAgo(290), price: 1050, status: 'Dead',   ageBoughtDays: 88,  dateOfBirth: daysAgo(378), dateDied: daysAgo(150), deathReason: 'Disease', deathDetail: 'Newcastle suspected — isolated too late', lastVaccinationDate: daysAgo(190) },
    { id: 13, name: 'Chirya',      gender: 'Female', breed: 'Desi',         dateBought: daysAgo(120), price: 0,    status: 'Active', ageBoughtDays: 0,   dateOfBirth: daysAgo(120), sourceIncubationId: 1, lastVaccinationDate: daysAgo(22) },
    { id: 14, name: 'Sheru',       gender: 'Male',   breed: 'Desi',         dateBought: daysAgo(120), price: 0,    status: 'Active', ageBoughtDays: 0,   dateOfBirth: daysAgo(120), sourceIncubationId: 1, lastVaccinationDate: daysAgo(22) },
  ];

  // Demo photos: every bird gets a hot-linked picture (see BIRD_IMG).
  // (missing link = emoji fallback, same as the grid's no-photo state).
  const birdPhoto = {
    1: BIRD_IMG.roosterDesi, 2: BIRD_IMG.roosterAseel, 3: BIRD_IMG.roosterRhode, 10: BIRD_IMG.roosterAseel,
    4: BIRD_IMG.henDesi, 8: BIRD_IMG.henDesi, 11: BIRD_IMG.henDesi, 12: BIRD_IMG.henDesi,
    5: BIRD_IMG.henGolden, 6: BIRD_IMG.henGolden, 9: BIRD_IMG.henGolden,
    7: BIRD_IMG.henLayer,
    13: BIRD_IMG.chick, 14: BIRD_IMG.chick,
  };
  for (const b of birds) b.image = birdPhoto[b.id] || '';

  // ----------------------------------------------------------- VACCINATIONS
  // Roughly monthly shots per active bird across the year.
  const vaccinations = [];
  let vid = 1;
  const vaccineNames = ['Newcastle (ND)', 'Gumboro (IBD)', 'Fowl Pox', 'Infectious Bronchitis', 'Deworming dose'];
  for (const b of birds) {
    if (b.status === 'Dead' && !b.dateDied) continue;
    const boughtDaysAgo = Math.min(360, Math.round((Date.now() - new Date(b.dateBought).getTime()) / 86400000));
    for (let d = boughtDaysAgo - 10; d > 5; d -= rnd(28, 36)) {
      // stop vaccinating after sale/death
      if (b.saleDate && daysAgo(d) > b.saleDate) continue;
      if (b.dateDied && daysAgo(d) > b.dateDied) continue;
      vaccinations.push({
        id: vid++,
        birdId: b.id,
        date: daysAgo(d),
        vaccineName: vaccineNames[vid % vaccineNames.length],
        dose: '0.5 ml',
        cost: rnd(30, 80),
        notes: '',
      });
    }
  }

  // ------------------------------------------------------------------- FEED
  // Weekly feed purchases across 12 months, rotating types.
  const feed = [];
  let fid = 1;
  const feedTypes = [
    { feedType: 'Khal & Choker', kg: [20, 40], rate: [90, 120] },
    { feedType: 'Corn',          kg: [15, 30], rate: [70, 95] },
    { feedType: 'Wheat',         kg: [15, 30], rate: [95, 115] },
    { feedType: 'Grains',        kg: [10, 25], rate: [80, 100] },
    { feedType: 'Supplements',   kg: [2, 5],   rate: [300, 450] },
  ];
  for (let d = 364; d >= 0; d -= 7) {
    const t = feedTypes[Math.floor(d / 7) % feedTypes.length];
    feed.push({
      id: fid++,
      date: daysAgo(d),
      feedType: t.feedType,
      quantityKg: rnd(t.kg[0], t.kg[1]),
      rateRsPerKg: rnd(t.rate[0], t.rate[1]),
      notes: '',
      supplierId: 1, // supplier khata: bulk feed on credit from Malik Feed Store
    });
  }
  // occasional medicine purchases through the feed ledger
  for (const d of [300, 210, 150, 95, 40]) {
    feed.push({ id: fid++, date: daysAgo(d), feedType: 'Medicine', quantityKg: 1, rateRsPerKg: rnd(400, 900), notes: 'Vitamins / antibiotics from vet store', supplierId: 2 });
  }

  // -------------------------------------------------------------- CUSTOMERS
  const customers = [
    { id: 1, name: 'Khan General Store', phone: '0301-1234567', notes: 'Daily egg pickup — pays weekly' },
    { id: 2, name: 'Chacha Rafiq',       phone: '0333-5551234', notes: 'Neighbour — buys desi eggs' },
    { id: 3, name: 'Madina Karyana',     phone: '0312-9876543', notes: 'Bulk buyer, negotiated Rs.24/egg' },
  ];

  // ------------------------------------------------------- EGGS (12 months)
  // Daily egg production with seasonal variation (hens lay less in summer
  // heat & moulting season), matching ~7-8 laying hens.
  const eggs = [];
  for (let d = 364; d >= 0; d--) {
    const date = daysAgo(d);
    const month = Number(date.slice(5, 7));
    const seasonal = (month >= 6 && month <= 8) ? -2 : (month >= 11 || month <= 2) ? 1 : 0;
    const collected = Math.max(0, rnd(4, 8) + seasonal);
    if (collected === 0) continue;
    const broken = Math.random() < 0.15 ? 1 : 0;
    const homeUse = Math.random() < 0.5 ? rnd(1, 2) : 0;
    const sold = Math.max(0, collected - broken - homeUse);
    eggs.push({
      date,
      totalEggsCollected: collected,
      sold,
      homeUse,
      brokenWasted: broken,
      pricePerEgg: 25,
      customerId: sold > 0 ? (d % 3) + 1 : undefined,
    });
  }

  // -------------------------------------------------- CUSTOMER SALES LEDGER
  // Weekly consolidated egg sales per customer with partial payments so the
  // ledger shows balances.
  const customerSales = [];
  let csid = 1;
  for (let d = 360; d >= 2; d -= 7) {
    const customerId = (Math.floor(d / 7) % 3) + 1;
    const qty = rnd(18, 40);
    const price = customerId === 3 ? 24 : 25;
    const amount = qty * price;
    customerSales.push({
      id: csid++,
      customerId,
      date: daysAgo(d),
      eggsQty: qty,
      pricePerEgg: price,
      amountPaid: Math.random() < 0.85 ? amount : Math.round(amount * 0.6),
      notes: '',
    });
  }

  // --------------------------------------------------------- OTHER EXPENSES
  const expenses = [];
  let eid = 1;
  const expenseSeeds = [
    [350, 'Medicine',  'Newcastle vaccine bulk pack'],
    [330, 'Repair',    'Coop wire mesh repair'],
    [300, 'Utility',   'Water pipe + drinkers'],
    [270, 'Medicine',  'Deworming syrup'],
    [240, 'Other',     'New feeders (2)'],
    [210, 'Repair',    'Roof sheet replacement before monsoon'],
    [180, 'Utility',   'Electricity share for brooder lamps'],
    [150, 'Medicine',  'Antibiotic course for sick hens'],
    [120, 'Other',     'Rice husk bedding'],
    [90,  'Repair',    'Door hinge + lock repair'],
    [60,  'Utility',   'Water tank cleaning'],
    [30,  'Medicine',  'Vitamins + calcium supplement'],
    [10,  'Other',     'Egg trays (bulk)'],
  ];
  for (const [d, category, detail] of expenseSeeds) {
    expenses.push({ id: eid++, date: daysAgo(d), detail, category, amount: rnd(300, 2500), notes: '', ...(category === 'Medicine' ? { supplierId: 2 } : {}) });
  }

  // ------------------------------------------------------------- FIELD LABOR
  // Part-time helpers (named wage workers, NOT app logins). A full year of
  // attendance: past months are POSTED to the ledger as one labor expense
  // each; the current month stays unposted for the wage sheet.
  const laborersBucket = [
    { id: 'lw-demo-1', name: 'Shakeel', dailyWage: 300, notes: 'Morning feeding + cleaning' },
    { id: 'lw-demo-2', name: 'Irfan',   dailyWage: 200, notes: 'Egg collection helper (evenings)' },
  ];
  const laborAttendanceBucket = [];
  {
    const nowD = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const thisMonthKey = `${nowD.getFullYear()}-${pad2(nowD.getMonth() + 1)}`;
    for (let back = 11; back >= 0; back--) {
      const mDate = new Date(nowD.getFullYear(), nowD.getMonth() - back, 1);
      const mKey = `${mDate.getFullYear()}-${pad2(mDate.getMonth() + 1)}`;
      const isCurrent = mKey === thisMonthKey;
      const daysInMonth = isCurrent ? nowD.getDate() : new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
      const lines = [];
      let monthTotal = 0;
      for (const lw of laborersBucket) {
        let units = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const dow = new Date(mDate.getFullYear(), mDate.getMonth(), day).getDay();
          // Shakeel ~3 days/week, Irfan ~2 days/week — small part-time crew.
          if (lw.id === 'lw-demo-1' && ![1, 3, 6].includes(dow)) continue;
          if (lw.id === 'lw-demo-2' && ![2, 5].includes(dow)) continue;
          const half = lw.id === 'lw-demo-2' && day % 3 === 0;
          units += half ? 0.5 : 1;
          laborAttendanceBucket.push({
            id: `la-${lw.id}-${mKey}-${pad2(day)}`,
            workerId: lw.id,
            date: `${mKey}-${pad2(day)}`,
            dayType: half ? 'half' : 'full',
            posted: !isCurrent,
            notes: '',
          });
        }
        if (!isCurrent && units > 0) {
          monthTotal += units * lw.dailyWage;
          lines.push(`${lw.name} ${units}d × Rs. ${lw.dailyWage}`);
        }
      }
      if (!isCurrent && monthTotal > 0) {
        expenses.push({
          id: eid++,
          date: `${mKey}-28`,
          detail: `Labor wages ${mKey}`,
          category: 'Other',
          amount: Math.round(monthTotal * 100) / 100,
          notes: `Monthly labor wages ${mKey}: ${lines.join('; ')}`,
        });
      }
    }
  }

  // -------------------------------------------------------------- INCUBATION
  const incubation = [
    {
      id: 1,
      startDate: daysAgo(145),
      eggsSet: 24,
      hatchDate: daysAgo(124),
      hatched: 15,
      brokenEggs: 1,
      spoiledEggs: 2,
      infertileEggs: 4,
      deadInShellEggs: 2,
      flockTransferDate: daysAgo(120),
      flockTransferCount: 2,
      notes: 'Good hatch rate. 2 best chicks (Chirya, Sheru) moved to flock register, rest sold as day-olds.',
    },
    {
      id: 2,
      startDate: daysAgo(70),
      eggsSet: 18,
      hatchDate: daysAgo(49),
      hatched: 11,
      brokenEggs: 0,
      spoiledEggs: 1,
      infertileEggs: 4,
      deadInShellEggs: 2,
      notes: 'Chicks sold at 1 week old to Chacha Rafiq.',
    },
    {
      id: 3,
      startDate: daysAgo(12),
      eggsSet: 30,
      hatched: 0,
      notes: 'Currently running — candling planned on day 10.',
    },
  ];

  // ---------------------------------------------------------- DAILY RECORDS
  const checklistTaskIds = ['collect_eggs', 'feed_birds', 'check_water', 'clean_coop', 'health_check', 'lock_coop'];
  const checklist = [];
  for (let d = 20; d >= 0; d--) {
    checklist.push({
      date: daysAgo(d),
      completed: checklistTaskIds.filter(() => Math.random() > 0.1),
    });
  }

  const diaryNotes = [
    [9, 'Heavy rain — kept birds inside, extra bedding added.'],
    [8, 'Soni still sneezing. Started antibiotic course, isolated her from the flock.'],
    [7, 'Khan Store increased weekly order to 40 eggs.'],
    [6, 'Cleaned water tank, all drinkers refilled.'],
    [5, 'New incubation batch set — 30 eggs from Lali and Chandni.'],
    [4, 'Feed stock getting low, ordered Khal & Choker from mandi.'],
    [3, 'Vaccinated Heera and Raja Kukar (ND booster).'],
    [2, 'Egg production up this week — cooler weather helping.'],
    [1, 'Chacha Rafiq paid his pending balance in full.'],
    [0, 'Routine day. All checklist tasks done, birds healthy.'],
  ];
  const diary = diaryNotes.map(([d, note]) => ({ date: daysAgo(d), note }));

  // -------------------------------------------------------- DATASTORE WRITE
  // ------------------------------------------------------ SUPPLIER KHATA
  // Purchases above are tagged with supplierId; monthly payments leave a
  // realistic balance the farm still owes each dealer.
  const suppliers = [
    { id: 1, name: 'Malik Feed & Wanda Store', phone: '0300-1112233', notes: 'Weekly bulk feed on credit' },
    { id: 2, name: 'Wah Vet & Medicine Centre', phone: '0345-7778899', notes: 'Vaccines + dawai' },
  ];
  const supplierPayments = [];
  let spid = 1;
  for (const [supplierId, monthlyAmount] of [[1, 7500], [2, 550]]) {
    for (let m = 11; m >= 0; m--) {
      const pd = new Date();
      pd.setMonth(pd.getMonth() - m);
      pd.setDate(18);
      if (pd > new Date()) continue;
      const wobble = 0.8 + ((spid * 31) % 35) / 100;
      supplierPayments.push({
        id: spid++,
        supplierId,
        date: pd.toISOString().slice(0, 10),
        amount: Math.round(monthlyAmount * wobble),
        note: 'Monthly payment (cash)',
      });
    }
  }

  const buckets = {
    settings,
    birds,
    vaccinations,
    feed,
    eggs,
    customers,
    customerSales,
    expenses,
    incubation,
    checklist,
    diary,
    suppliers,
    supplierPayments,
    laborers: laborersBucket,
    laborAttendance: laborAttendanceBucket,
    laborAdvances: [
      { id: 'lv-demo-1', workerId: 'lw-demo-1', date: daysAgo(6), amount: 1500, settled: false, notes: 'School fees advance' },
    ],
  };
  for (const [key, value] of Object.entries(buckets)) {
    await DataStore.create({ key, value, version: 1 });
  }

  // ---------------------------------------------------------------- BATCHES
  // One CLOSED broiler cycle (fully sold) + one ACTIVE layer batch, each with
  // feed / mortality / expense / sale logs so every batch screen has data.
  const b1 = await Batch.create({
    batch_id: 'batch-demo-1',
    name: 'Broiler Cycle — Spring',
    type: 'Broiler',
    start_date: daysAgo(160),
    expected_end_date: daysAgo(115),
    intake_count: 100,
    source: 'Big Bird hatchery',
    cost_per_bird: 95,
    status: 'Closed',
  });
  b1.image_path = BIRD_IMG.chick; b1.gallery = [BIRD_IMG.chick];
  const b1Feed = [];
  for (let d = 158; d >= 118; d -= 4) {
    b1Feed.push({ batch_id: 'batch-demo-1', date: daysAgo(d), feed_type: 'Broiler starter/finisher', quantity_kg: rnd(25, 45), rate_rs_per_kg: rnd(145, 165), notes: '' });
  }
  await BatchFeedLog.insertMany(b1Feed);
  await BatchMortalityLog.insertMany([
    { batch_id: 'batch-demo-1', date: daysAgo(150), count: 3, reason: 'Weak chicks (first week)', notes: '' },
    { batch_id: 'batch-demo-1', date: daysAgo(135), count: 2, reason: 'Heat stress', notes: 'Improved ventilation after this' },
    { batch_id: 'batch-demo-1', date: daysAgo(122), count: 1, reason: 'Unknown', notes: '' },
  ]);
  await BatchExpenseLog.insertMany([
    { batch_id: 'batch-demo-1', date: daysAgo(159), category: 'Medicine', detail: 'Starter vaccines + glucose', amount: 3500, notes: '' },
    { batch_id: 'batch-demo-1', date: daysAgo(140), category: 'Misc',      detail: 'Brooder electricity', amount: 2800, notes: '' },
    { batch_id: 'batch-demo-1', date: daysAgo(120), category: 'Misc',      detail: 'Catching + transport labour', amount: 4000, notes: '' },
  ]);
  await BatchSaleLog.insertMany([
    { batch_id: 'batch-demo-1', date: daysAgo(118), count: 50, amount: 47500, buyer: 'City Chicken Shop', notes: 'avg 1.9kg @ Rs.500/kg' },
    { batch_id: 'batch-demo-1', date: daysAgo(116), count: 44, amount: 44000, buyer: 'Wah Cantt poultry mandi', notes: '' },
  ]);
  // Weekly average-weight checks across the broiler cycle (growth curve).
  await BatchWeightLog.insertMany([
    { batch_id: 'batch-demo-1', date: daysAgo(153), avg_weight_g: 180,  sample_size: 10, notes: 'Week 1' },
    { batch_id: 'batch-demo-1', date: daysAgo(146), avg_weight_g: 430,  sample_size: 10, notes: 'Week 2' },
    { batch_id: 'batch-demo-1', date: daysAgo(139), avg_weight_g: 780,  sample_size: 10, notes: 'Week 3' },
    { batch_id: 'batch-demo-1', date: daysAgo(132), avg_weight_g: 1150, sample_size: 8,  notes: 'Week 4' },
    { batch_id: 'batch-demo-1', date: daysAgo(125), avg_weight_g: 1520, sample_size: 8,  notes: 'Week 5' },
    { batch_id: 'batch-demo-1', date: daysAgo(119), avg_weight_g: 1900, sample_size: 8,  notes: 'Pre-sale check' },
  ]);

  const b2 = await Batch.create({
    batch_id: 'batch-demo-2',
    name: 'Golden Layers 2.0',
    type: 'Layer',
    start_date: daysAgo(75),
    expected_end_date: null,
    intake_count: 60,
    source: 'Sadiq chicks dealer',
    cost_per_bird: 120,
    status: 'Active',
  });
  b2.image_path = BIRD_IMG.henLayer; b2.gallery = [BIRD_IMG.henLayer];
  const b2Feed = [];
  for (let d = 74; d >= 1; d -= 5) {
    b2Feed.push({ batch_id: 'batch-demo-2', date: daysAgo(d), feed_type: 'Layer mash', quantity_kg: rnd(15, 25), rate_rs_per_kg: rnd(110, 130), notes: '' });
  }
  await BatchFeedLog.insertMany(b2Feed);
  await BatchMortalityLog.insertMany([
    { batch_id: 'batch-demo-2', date: daysAgo(60), count: 2, reason: 'Weak chicks', notes: '' },
    { batch_id: 'batch-demo-2', date: daysAgo(20), count: 1, reason: 'Predator (cat)', notes: 'Fixed the mesh gap' },
  ]);
  await BatchExpenseLog.insertMany([
    { batch_id: 'batch-demo-2', date: daysAgo(70), category: 'Medicine', detail: 'ND + IBD vaccine schedule', amount: 2600, notes: '' },
    { batch_id: 'batch-demo-2', date: daysAgo(30), category: 'Misc',      detail: 'Extra perches + nest boxes', amount: 3200, notes: '' },
  ]);
  // Fortnightly average-weight checks for the growing layer flock.
  await BatchWeightLog.insertMany([
    { batch_id: 'batch-demo-2', date: daysAgo(70), avg_weight_g: 95,   sample_size: 12, notes: 'Day-old +5' },
    { batch_id: 'batch-demo-2', date: daysAgo(56), avg_weight_g: 320,  sample_size: 12, notes: '' },
    { batch_id: 'batch-demo-2', date: daysAgo(42), avg_weight_g: 620,  sample_size: 10, notes: '' },
    { batch_id: 'batch-demo-2', date: daysAgo(28), avg_weight_g: 950,  sample_size: 10, notes: '' },
    { batch_id: 'batch-demo-2', date: daysAgo(14), avg_weight_g: 1220, sample_size: 10, notes: '' },
    { batch_id: 'batch-demo-2', date: daysAgo(3),  avg_weight_g: 1400, sample_size: 10, notes: 'On track for point-of-lay' },
  ]);

  console.log('🌱 Demo data seeded (1 year): birds, feed, eggs, sales, batches, health, diary.');
  console.log('🌱 Logins → admin / admin123   |   worker / worker123');
}
