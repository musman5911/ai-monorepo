/**
 * DEMO DATA for MEMORY MODE ONLY (MEMORY_MODE=1, no MONGO_URI set).
 *
 * Seeds the in-memory database with a full YEAR of realistic dairy-farm
 * data covering every module: cows/bulls/calves, daily morning+evening milk,
 * all expense types, health & vaccinations (incl. due/overdue reminders for
 * the header bell), buyers, milk-rate history, animal sales, daily
 * checklist + diary — plus admin and worker login accounts.
 *
 * This NEVER runs against a real MongoDB. Data lives in RAM and is rebuilt
 * fresh on every restart.
 *
 *   Logins:  admin / admin123     worker / worker123
 */
import bcrypt from 'bcryptjs';

// Demo photos (memory mode only): stable hot-links from Unsplash (free
// license) — no image files stored in the repo. If a link is ever taken
// down, the card simply falls back to the emoji.
const U = (id) => `https://images.unsplash.com/${id}?w=800&q=70&fm=jpg`;
const COW_IMG = {
  sahiwal: U('photo-1673229266917-89abfa3ebc58'),      // red-brown zebu with horns
  holstein: U('photo-1567513068697-fca8c2af4528'),     // black-and-white dairy cows
  redsindhi: U('photo-1598715685267-0f45367d8071'),    // brown cow in a grass field
  cholistani: U('photo-1708965799324-41fb097e3f4d'),   // cow on a dirt road
  jersey: U('photo-1658010225107-97c9bec88fd3'),       // cow with ear tag
  calf: U('photo-1527153857715-3908f2bae5e8'),         // young brown calf
  bull: U('photo-1763095818819-e2eb01e69ce8'),         // zebu cattle outdoors
};
const ADMIN_AVATAR = U('photo-1673538064388-21d1aaaf6594'); // farmer in a field
const WORKER_AVATAR = U('photo-1696371268939-5c5710319bde'); // farm worker with a bucket

function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return dateStr(d); }
function rnd(min, max) { return Math.round((min + Math.random() * (max - min)) * 10) / 10; }

async function seedDemoData(db) {
  const { Cow, BreedingEvent, Milk, Expense, Rate, RateHistory, Health, Buyer, BuyerPayment, Supplier, SupplierPayment, User, DailyLog, Sale, Laborer, LaborAttendance, Meta, Farm } = db;


  const farm1 = await Farm.create({
    name: 'Farm 1', location: 'Local demo farm', archived: false,
    createdAt: new Date('2020-01-01T00:00:00.000Z'), updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  });
  const farm2 = await Farm.create({
    name: 'Farm 2 - Access Test', location: 'Isolated role-testing farm', archived: false,
    createdAt: new Date('2020-01-02T00:00:00.000Z'), updatedAt: new Date('2020-01-02T00:00:00.000Z'),
  });

  // ────────────────────────────────────────── USERS
  await User.create({
    username: 'admin', password: await bcrypt.hash('admin123', 10),
    role: 'admin', displayName: 'Malik Usman', email: 'admin@example.com', active: true, avatarBase64: ADMIN_AVATAR,
  });
  await User.create({
    username: 'worker', password: await bcrypt.hash('worker123', 10),
    role: 'worker', displayName: 'Farm Worker', email: '', active: true, avatarBase64: WORKER_AVATAR,
  });
  await User.create({
    username: 'manager', password: await bcrypt.hash('manager123', 10), role: 'manager',
    farmIds: [String(farm2._id)], displayName: 'Farm 2 Manager', email: 'manager@dairyfarm.test', active: true, avatarBase64: WORKER_AVATAR,
  });
  await User.create({
    username: 'worker2', password: await bcrypt.hash('worker2123', 10), role: 'worker',
    farmIds: [String(farm2._id)], displayName: 'Farm 2 Worker', email: 'worker2@dairyfarm.test', active: true, avatarBase64: WORKER_AVATAR,
  });

  // ────────────────────────────────────────── COWS (herd with bulls + calves + sold)
  const cows = [
    { _id: 'cow1',  name: 'Laila',    breed: 'Sahiwal',           status: 'active',   birthDate: '2020-03-15', weight: 420, lactationNumber: 4, calvingDate: daysAgo(190), batch: 'Original Herd',  purchasePrice: 150000, calvingHistory: [{ date: daysAgo(190), calfId: 'cow13' }] },
    { _id: 'cow2',  name: 'Moti',     breed: 'Holstein Friesian', status: 'pregnant', birthDate: '2019-07-22', weight: 510, lactationNumber: 5, calvingDate: daysAgo(225), pregnancyDate: daysAgo(220), batch: 'Original Herd',  purchasePrice: 250000, calvingHistory: [{ date: daysAgo(225), calfId: 'cow14' }] },
    { _id: 'cow3',  name: 'Rani',     breed: 'Sahiwal',           status: 'active',   birthDate: '2021-11-01', weight: 390, lactationNumber: 3, calvingDate: daysAgo(150), batch: 'Original Herd',  purchasePrice: 140000 },
    { _id: 'cow4',  name: 'Sundar',   breed: 'Red Sindhi',        status: 'pregnant', birthDate: '2019-01-10', weight: 440, lactationNumber: 5, calvingDate: daysAgo(260), pregnancyDate: daysAgo(120), batch: 'Original Herd', purchasePrice: 160000 },
    { _id: 'cow5',  name: 'Chameli',  breed: 'Cholistani',        status: 'pregnant', birthDate: '2022-05-18', weight: 370, lactationNumber: 2, calvingDate: daysAgo(130), pregnancyDate: daysAgo(40), batch: 'Winter Batch',   purchasePrice: 130000 },
    { _id: 'cow6',  name: 'Guddi',    breed: 'Sahiwal',           status: 'dry',      birthDate: '2018-09-30', weight: 400, lactationNumber: 6, calvingDate: daysAgo(420), pregnancyDate: daysAgo(260), dryDate: daysAgo(75), batch: 'Original Herd', purchasePrice: 120000 },
    { _id: 'cow7',  name: 'Shehzadi', breed: 'Holstein Friesian', status: 'active',   birthDate: '2020-12-05', weight: 530, lactationNumber: 4, calvingDate: daysAgo(90),  batch: 'Winter Batch',   purchasePrice: 280000 },
    { _id: 'cow8',  name: 'Jasmine',  breed: 'Jersey',            status: 'active',   birthDate: '2021-08-14', weight: 350, lactationNumber: 3, calvingDate: daysAgo(80),  heatDate: daysAgo(3), batch: 'Spring Batch',   purchasePrice: 200000 },
    { _id: 'cow9',  name: 'Kiran',    breed: 'Red Sindhi',        status: 'active',   birthDate: '2022-02-28', weight: 380, lactationNumber: 2, calvingDate: daysAgo(165), batch: 'Original Herd',  purchasePrice: 145000 },
    { _id: 'cow10', name: 'Noor',     breed: 'Cholistani',        status: 'sold',     birthDate: '2017-04-20', weight: 360, lactationNumber: 7, batch: 'Original Herd',  purchasePrice: 100000 },
    { _id: 'cow11', name: 'Basanti',  breed: 'Sahiwal',           status: 'active',   birthDate: '2023-01-10', weight: 340, lactationNumber: 1, calvingDate: daysAgo(45),  batch: 'Spring Batch',   purchasePrice: 155000 },
    { _id: 'cow12', name: 'Sufi',     breed: 'Holstein Friesian', status: 'active',   birthDate: '2020-06-25', weight: 500, lactationNumber: 4, calvingDate: daysAgo(120), batch: 'Original Herd',  purchasePrice: 260000 },
    { _id: 'cow13', name: 'Chhoti',   breed: 'Sahiwal',           gender: 'female', status: 'calf', birthDate: daysAgo(190), weight: 65, lactationNumber: 0, motherId: 'cow1', isCalf: true, nursingUntil: daysAgo(115), batch: 'Born on Farm', purchasePrice: 0 },
    { _id: 'cow14', name: 'Golu',     breed: 'Holstein Friesian', gender: 'male',   status: 'calf', birthDate: daysAgo(225), weight: 80, lactationNumber: 0, motherId: 'cow2', isCalf: true, nursingUntil: daysAgo(150), batch: 'Born on Farm', purchasePrice: 0 },
    { _id: 'cow15', name: 'Shera',    breed: 'Sahiwal',           gender: 'male',   status: 'active', birthDate: '2023-06-15', weight: 580, lactationNumber: 0, batch: 'Winter Batch', purchasePrice: 200000 },
    { _id: 'cow16', name: 'Bahadur',  breed: 'Red Sindhi',        gender: 'male',   status: 'active', birthDate: '2024-01-20', weight: 520, lactationNumber: 0, batch: 'Spring Batch', purchasePrice: 180000 },
  ];
  // Demo photos: every animal gets a real picture matched to breed/status
  // (memory mode only — see COW_IMG above).
  const cowPhoto = {
    cow1: COW_IMG.sahiwal,  cow3: COW_IMG.sahiwal,  cow6: COW_IMG.sahiwal,  cow11: COW_IMG.sahiwal,
    cow2: COW_IMG.holstein, cow7: COW_IMG.holstein, cow12: COW_IMG.holstein,
    cow4: COW_IMG.redsindhi, cow9: COW_IMG.redsindhi,
    cow5: COW_IMG.cholistani, cow10: COW_IMG.cholistani,
    cow8: COW_IMG.jersey,
    cow13: COW_IMG.calf, cow14: COW_IMG.calf,
    cow15: COW_IMG.bull,  cow16: COW_IMG.bull,
  };
  for (const c of cows) c.image = cowPhoto[c._id] || '';

  // Weight history demo: monthly weights for a few animals (gradual growth).
  for (const [cid, startKg, gainPerMonth] of [['cow2', 470, 4], ['cow3', 350, 3.5], ['cow11', 300, 3], ['cow12', 480, 4.5]]) {
    const cw = cows.find(c => c._id === cid);
    if (!cw) continue;
    cw.weightHistory = [];
    for (let m = 11; m >= 0; m--) {
      const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(6);
      if (d > new Date()) continue;
      cw.weightHistory.push({
        id: `w-${cid}-${m}`,
        date: d.toISOString().slice(0, 10),
        weightKg: Math.round((startKg + (11 - m) * gainPerMonth) * 10) / 10,
        note: m === 11 ? 'First weighing' : '',
      });
    }
  }

  // Marketplace demo: two animals listed for sale with interested buyers.
  const forSale = cows.find(c => c._id === 'cow3');
  if (forSale) {
    forSale.expectedPrice = 320000;
    forSale.marketNotes = [
      { id: 'mn1', date: daysAgo(9), buyer: 'Haji Sharif (Taxila)', phone: '0300-1112223', offer: 290000, note: 'Wants to see her milking first' },
      { id: 'mn2', date: daysAgo(3), buyer: 'Cattle broker Nadeem', phone: '0345-8887766', offer: 305000, note: 'Will confirm after Eid' },
    ];
  }
  const forSale2 = cows.find(c => c._id === 'cow11');
  if (forSale2) {
    forSale2.expectedPrice = 180000;
    forSale2.marketNotes = [
      { id: 'mn3', date: daysAgo(5), buyer: 'Malik Riaz (Hassanabdal)', phone: '0333-4455667', offer: 165000, note: 'Low offer — asked to revisit' },
    ];
  }
  await Cow.insertMany(cows);
  if (BreedingEvent) {
    await BreedingEvent.insertMany([
      { _id: 'be-demo-heat-cow8', cowId: 'cow8', type: 'heat', date: daysAgo(3), technician: 'Demo technician', result: 'Heat observed', notes: 'Seeded demo event' },
      { _id: 'be-demo-service-cow2', cowId: 'cow2', type: 'service', date: daysAgo(220), sireSource: 'farm_bull', bullId: 'cow15', technician: 'Demo technician', result: 'Inseminated', notes: 'Seeded demo event' },
      { _id: 'be-demo-calving-cow1', cowId: 'cow1', type: 'calving', date: daysAgo(190), result: 'Normal calving', notes: 'Seeded demo event' },
      { _id: 'be-demo-pregnancy-cow4', cowId: 'cow4', type: 'pregnancy_check', date: daysAgo(100), result: 'Positive', notes: 'Seeded demo event' },
    ]);
  }

  // ────────────────────────────────────────── MILK (365 days, morning + evening)
  // Per-cow average yields; light seasonal dip in summer heat.
  const cowYield = {
    cow1: { m: 8, e: 5 },  cow2: { m: 14, e: 10 }, cow3: { m: 7, e: 4 },
    cow5: { m: 6, e: 4 },  cow7: { m: 12, e: 9 },  cow8: { m: 9, e: 6 },
    cow9: { m: 7, e: 5 },  cow11: { m: 5, e: 3 },  cow12: { m: 13, e: 10 },
  };
  // Which buyer takes each cow's milk (cow3 & cow5 sell loose / home use).
  const cowBuyer = {
    cow2: 'b1', cow7: 'b1', cow12: 'b1',
    cow1: 'b2', cow8: 'b2',
    cow9: 'b3', cow11: 'b3',
  };
  const milk = [];
  let mid = 1;
  for (let day = 364; day >= 0; day--) {
    const ds = daysAgo(day);
    const month = Number(ds.slice(5, 7));
    const heat = (month >= 6 && month <= 8) ? 0.9 : 1; // summer dip
    for (const [cowId, avg] of Object.entries(cowYield)) {
      if (Math.random() < 0.03) continue; // occasional missed entry
      milk.push({
        _id: `m${mid++}`, cowId, date: ds,
        morning: rnd(avg.m * 0.8, avg.m * 1.2) * heat,
        evening: rnd(avg.e * 0.8, avg.e * 1.2) * heat,
        ...(cowBuyer[cowId] ? { buyerId: cowBuyer[cowId] } : {}),
      });
    }
  }
  await Milk.insertMany(milk);

  // ────────────────────────────────────────── BUYERS
  await Buyer.insertMany([
    { _id: 'b1', name: 'Khan Dairy Shop',   phone: '0301-1234567', address: 'Main Bazaar, Wah Cantt', defaultRate: 140 },
    { _id: 'b2', name: 'Ali Baba Dairy',    phone: '0312-9876543', address: 'Lala Rukh Market',       defaultRate: 135 },
    { _id: 'b3', name: 'Chai Wala (Rashid)',phone: '0333-5551234', address: 'Aslam Market',           defaultRate: 130 },
  ]);

  // ────────────────────────────────────────── BUYER UDHAAR PAYMENTS (12 months)
  // Each buyer pays roughly twice a month — keeps a realistic running balance.
  const buyerPayments = [];
  let bpId = 1;
  for (const [buyerId, monthlyAmount] of [['b1', 255000], ['b2', 105000], ['b3', 72000]]) {
    for (let m = 11; m >= 0; m--) {
      for (const dayOfMonth of [12, 26]) {
        const d = new Date();
        d.setMonth(d.getMonth() - m);
        d.setDate(dayOfMonth);
        if (d > new Date()) continue;
        const wobble = 0.85 + ((bpId * 37) % 30) / 100;
        buyerPayments.push({
          _id: `bp${bpId++}`,
          buyerId,
          date: d.toISOString().slice(0, 10),
          amount: Math.round((monthlyAmount / 2) * wobble),
          note: dayOfMonth === 12 ? 'Mid-month payment' : 'Month-end payment',
        });
      }
    }
  }
  await BuyerPayment.insertMany(buyerPayments);

  // ────────────────────────────────────────── MILK RATE + 12-MONTH HISTORY
  await Rate.create({ _id: '1', value: 145, date: daysAgo(0) });
  const rateSteps = [[360, 110], [300, 115], [240, 120], [180, 125], [120, 130], [90, 135], [45, 140], [10, 145]];
  await RateHistory.insertMany(rateSteps.map(([d, v], i) => ({
    _id: `rh${i + 1}`, value: v, date: daysAgo(d),
    note: i === 0 ? 'Initial rate' : `Changed from ${rateSteps[i - 1][1]} to ${v}`,
  })));

  // ────────────────────────────────────────── EXPENSES (365 days, all types)
  const expenses = [];
  let eid = 1;
  // Opening bulk feed purchase — seeds the feed-stock register.
  expenses.push({ _id: `e${eid++}`, date: daysAgo(364), type: 'feed', amount: 36800, feedKg: 400, note: 'Opening bulk feed stock (wheat bran, cottonseed, silage)' });
  for (let day = 364; day >= 0; day--) {
    const ds = daysAgo(day);
    // weekly bulk feed purchase (kg tracked for the feed-stock card; herd eats ~52 kg/day)
    if (day % 7 === 0) {
      const kg = 364 + Math.round(rnd(-20, 25));
      expenses.push({ _id: `e${eid++}`, date: ds, type: 'feed', amount: Math.round(kg * rnd(88, 98)), feedKg: kg, supplierId: 'sup1', note: 'Weekly bulk feed (wheat bran, cottonseed, silage)' });
    }
    // utilities every 3rd day
    if (day % 3 === 0) expenses.push({ _id: `e${eid++}`, date: ds, type: 'misc', amount: rnd(500, 1200), note: 'Water tanker + electricity' });
    // weekly labor
    if (day % 7 === 0) expenses.push({ _id: `e${eid++}`, date: ds, type: 'labor', amount: 5000, note: 'Milkman weekly salary' });
  }
  // medicine — scattered through the year
  const medicine = [
    [5,   'cow3',  1800, 'Mastitis treatment — Rani'],
    [12,  'cow1',  950,  'Deworming tablet'],
    [20,  'cow7',  2500, 'Foot and mouth vaccine'],
    [35,  null,    3200, 'Bulk vitamins and supplements'],
    [80,  'cow12', 1400, 'Eye infection drops'],
    [140, 'cow2',  2100, 'Post-calving calcium drip'],
    [200, null,    2800, 'Seasonal deworming — whole herd'],
    [260, 'cow6',  1600, 'Dry-off antibiotic therapy'],
    [320, null,    3500, 'FMD vaccination round — whole herd'],
  ];
  for (const [d, cowId, amount, note] of medicine) {
    expenses.push({ _id: `e${eid++}`, date: daysAgo(d), type: 'medicine', ...(cowId ? { cowId } : {}), amount, supplierId: 'sup2', note });
  }
  // equipment — spread across the year
  const equipment = [
    [15, 8000, 'New milking machine bucket'], [40, 4500, 'Water trough repair'],
    [120, 15000, 'Chaff cutter blade replacement'], [210, 6500, 'Shed fans for summer'],
    [300, 12000, 'Milk chiller service + parts'],
  ];
  for (const [d, amount, note] of equipment) {
    expenses.push({ _id: `e${eid++}`, date: daysAgo(d), type: 'equipment', amount, note });
  }
  // purchasing expenses (auto-created when animals were bought)
  const purchases = [
    ['cow1', 180], ['cow2', 200], ['cow3', 150], ['cow4', 220], ['cow5', 100],
    ['cow6', 300], ['cow7', 120], ['cow8', 90], ['cow9', 140], ['cow10', 350],
    ['cow11', 60], ['cow12', 170], ['cow15', 90], ['cow16', 60],
  ];
  for (const [cowId, d] of purchases) {
    const cow = cows.find(c => c._id === cowId);
    expenses.push({ _id: `e${eid++}`, cowId, date: daysAgo(d), type: 'purchasing', amount: cow.purchasePrice, note: `Purchased ${cow.name} — ${cow.breed}`, _purchaseCowId: cowId });
  }
  await Expense.insertMany(expenses);

  // ────────────────────────────────────────── SUPPLIER KHATA (money going out)
  // Purchases above are tagged with supplierId; payments here leave a
  // realistic running balance the farm still owes each dealer.
  await Supplier.insertMany([
    { _id: 'sup1', name: 'Malik Feed & Wanda Store', phone: '0300-1112233', address: 'GT Road, Taxila', notes: 'Weekly bulk feed on credit' },
    { _id: 'sup2', name: 'Wah Vet & Medicine Centre', phone: '0345-7778899', address: 'Aslam Market, Wah Cantt', notes: 'Vaccines + dawai' },
  ]);
  const supplierPayments = [];
  let spId = 1;
  for (const [supplierId, monthlyAmount] of [['sup1', 118000], ['sup2', 1300]]) {
    for (let m = 11; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      d.setDate(15);
      if (d > new Date()) continue;
      const wobble = 0.8 + ((spId * 29) % 35) / 100;
      supplierPayments.push({
        _id: `sp${spId++}`, supplierId,
        date: d.toISOString().slice(0, 10),
        amount: Math.round(monthlyAmount * wobble),
        note: 'Monthly payment (cash)',
      });
    }
  }
  await SupplierPayment.insertMany(supplierPayments);

  // ────────────────────────────────────────── HEALTH (year of records + live reminders)
  await Health.insertMany([
    // upcoming / overdue (drive the header bell + dashboard banner)
    { _id: 'h1',  cowId: 'cow1',  date: daysAgo(45),  type: 'vaccination', description: 'FMD Vaccine (Foot & Mouth)',           nextDueDate: daysAgo(-15),  cost: 1200, vet: 'Dr. Aslam' },
    { _id: 'h2',  cowId: 'cow2',  date: daysAgo(30),  type: 'vaccination', description: 'Brucellosis Vaccine',                  nextDueDate: daysAgo(-60),  cost: 800,  vet: 'Dr. Aslam' },
    { _id: 'h3',  cowId: 'cow3',  date: daysAgo(5),   type: 'treatment',   description: 'Mastitis — left rear quarter',         medicine: 'Mastilex + Amoxicillin', nextDueDate: daysAgo(-2), cost: 1800, vet: 'Dr. Aslam' },
    { _id: 'h4',  cowId: 'cow1',  date: daysAgo(12),  type: 'deworming',   description: 'Quarterly deworming',                  nextDueDate: daysAgo(-78),  cost: 400 },
    { _id: 'h5',  cowId: 'cow5',  date: daysAgo(20),  type: 'vaccination', description: 'HS Vaccine (Haemorrhagic Septicemia)', nextDueDate: daysAgo(-10),  cost: 600,  vet: 'Dr. Aslam' },
    { _id: 'h6',  cowId: 'cow7',  date: daysAgo(3),   type: 'treatment',   description: 'Eye infection — left eye',             medicine: 'Tobrex eye drops', nextDueDate: daysAgo(-4), cost: 450, vet: 'Dr. Aslam' },
    // through-the-year history
    { _id: 'h7',  cowId: 'cow4',  date: daysAgo(10),  type: 'checkup',     description: 'Pregnancy check — 4 months confirmed', cost: 500,  vet: 'Dr. Nadeem' },
    { _id: 'h8',  cowId: 'cow9',  date: daysAgo(25),  type: 'deworming',   description: 'Deworming + mineral supplement',       cost: 350 },
    { _id: 'h9',  cowId: 'cow11', date: daysAgo(40),  type: 'checkup',     description: 'Post-calving health check',            cost: 300,  vet: 'Dr. Nadeem' },
    { _id: 'h10', cowId: 'cow2',  date: daysAgo(140), type: 'treatment',   description: 'Milk fever after calving — calcium drip', medicine: 'Calcium borogluconate IV', cost: 2100, vet: 'Dr. Aslam' },
    { _id: 'h11', cowId: 'cow6',  date: daysAgo(260), type: 'treatment',   description: 'Dry-off therapy — both rear quarters', medicine: 'Dry cow antibiotic tubes', cost: 1600, vet: 'Dr. Nadeem' },
    { _id: 'h12', cowId: 'cow8',  date: daysAgo(200), type: 'deworming',   description: 'Seasonal deworming',                   cost: 350 },
    { _id: 'h13', cowId: 'cow12', date: daysAgo(320), type: 'vaccination', description: 'FMD vaccination round',                cost: 1200, vet: 'Dr. Aslam' },
    { _id: 'h14', cowId: 'cow7',  date: daysAgo(330), type: 'vaccination', description: 'Annual Bovine TB test',                cost: 1500, vet: 'Dr. Aslam' },
    { _id: 'h15', cowId: 'cow13', date: daysAgo(160), type: 'checkup',     description: 'Calf growth check — healthy',          cost: 200,  vet: 'Dr. Nadeem' },
  ]);

  // ────────────────────────────────────────── ANIMAL SALES
  await Sale.insertMany([
    { _id: 's1', cowId: 'cow10', date: daysAgo(60), salePrice: 180000, buyer: 'Qasim Cattle Market', notes: 'Old cow, low production — sold at mandi' },
  ]);

  // ────────────────────────────────────────── DAILY LOGS (last 30 days)
  const checklist = [
    { id: 'morning-milking', text: 'Morning milking done' },
    { id: 'evening-milking', text: 'Evening milking done' },
    { id: 'feed-given',      text: 'Feed given' },
    { id: 'water-checked',   text: 'Water checked / refilled' },
    { id: 'health-check',    text: 'Checked for signs of illness' },
    { id: 'cleaning',        text: 'Shed cleaned' },
  ];
  const diaryNotes = [
    'Hot day — gave extra water. All cows eating well. Rani still on medication.',
    'Rainy morning — delayed milking by 30 mins.',
    'New silage batch delivered (12 bags). Quality looks good.',
    'Khan Dairy Shop wants to increase order by 5L/day next week.',
    'Dr. Aslam visited — routine vaccines given. Herd healthy.',
    'Electricity issue — ran generator for 2 hours.',
    'Cow4 pregnancy progressing well, calving in ~2 months.',
    'Milk slightly down — heat. Added electrolytes to water.',
    'Sold surplus milk to Ali Baba Dairy.',
    'Weekly labor salary paid. Bought new rope and halter.',
    'Basanti first milking after calving — good start!',
    'Adjusted feed ration — more cottonseed.',
    'Rani finished mastitis treatment — much better.',
    'Cleaned and refilled all water troughs.',
  ];
  const dailyLogs = [];
  for (let day = 0; day < 30; day++) {
    const ds = daysAgo(day);
    dailyLogs.push({
      _id: ds, date: ds,
      checklist: checklist.map(item => ({ ...item, done: Math.random() > 0.08 })),
      notes: diaryNotes[day % diaryNotes.length] || '',
    });
  }
  await DailyLog.insertMany(dailyLogs);

  // ────────────────────────────────────────── FIELD LABOR (attendance + wages)
  // Named wage workers (not app logins). A full year of attendance: every past
  // month is already POSTED to the expense ledger as one labor expense; the
  // current month stays unposted so the wage sheet has something to show.
  const laborers = [
    { _id: 'lw-demo-1', name: 'Akram',  dailyWage: 700, notes: 'Milking + feeding' },
    { _id: 'lw-demo-2', name: 'Bashir', dailyWage: 600, notes: 'Cleaning + general help' },
    { _id: 'lw-demo-3', name: 'Rafiq',  dailyWage: 500, notes: 'Part-time (evenings)' },
  ];
  await Laborer.insertMany(laborers);

  const attendanceRows = [];
  const laborExpenses = [];
  const nowD = new Date();
  const thisMonthKey = `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1)}`;
  for (let back = 11; back >= 0; back--) {
    const mDate = new Date(nowD.getFullYear(), nowD.getMonth() - back, 1);
    const mKey = `${mDate.getFullYear()}-${pad(mDate.getMonth() + 1)}`;
    const isCurrent = mKey === thisMonthKey;
    const daysInMonth = isCurrent ? nowD.getDate() : new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
    const expenseId = `e-wages-${mKey}-demo`;
    const lines = [];
    let monthTotal = 0;
    for (const lw of laborers) {
      let units = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        // Rafiq works ~half the days; the others get ~4 days off a month.
        const dow = new Date(mDate.getFullYear(), mDate.getMonth(), day).getDay();
        if (lw._id === 'lw-demo-3' && dow % 2 === 0) continue;
        if (lw._id !== 'lw-demo-3' && dow === 5) continue; // Friday off
        const half = day % 9 === 0;
        units += half ? 0.5 : 1;
        attendanceRows.push({
          _id: `la-${lw._id}-${mKey}-${pad(day)}`,
          workerId: lw._id,
          date: `${mKey}-${pad(day)}`,
          dayType: half ? 'half' : 'full',
          posted: !isCurrent,
          expenseId: isCurrent ? '' : expenseId,
          notes: '',
        });
      }
      if (!isCurrent && units > 0) {
        monthTotal += units * lw.dailyWage;
        lines.push(`${lw.name} ${units}d × Rs. ${lw.dailyWage}`);
      }
    }
    if (!isCurrent && monthTotal > 0) {
      laborExpenses.push({
        _id: expenseId,
        cowId: null,
        date: `${mKey}-28`,
        type: 'labor',
        amount: Math.round(monthTotal * 100) / 100,
        note: `Monthly labor wages ${mKey}: ${lines.join('; ')}`,
      });
    }
  }
  await LaborAttendance.insertMany(attendanceRows);
  // Two open wage advances this month (settled when the month is posted).
  await db.LaborAdvance.insertMany([
    { _id: 'lv-demo-1', workerId: 'lw-demo-1', date: daysAgo(9), amount: 5000, settled: false, notes: 'Eid advance' },
    { _id: 'lv-demo-2', workerId: 'lw-demo-3', date: daysAgo(4), amount: 2000, settled: false, notes: 'Medical need' },
  ]);
  await Expense.insertMany(laborExpenses);

  // Feed-stock settings: the herd's assumed daily feed use (kg) + warning days.
  await Meta.create({ key: 'feed_stock_settings', value: { dailyUseKg: 52, lowStockDays: 14 } });

  console.log(`🌱 Demo data seeded (1 year): ${cows.length} animals, ${milk.length} milk entries, ${expenses.length} expenses, health, buyers, rates, sales, diary.`);
  console.log('🌱 Logins → admin / admin123   |   worker / worker123');
}

export { seedDemoData };
