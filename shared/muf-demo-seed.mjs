const APP_NAMES = ["dairy", "agri", "flock"];
const BASIC_FARMS = [["Farm 1", "Local demo farm"], ["Farm 2 - Access Test", "Isolated role-testing farm"]];
const RICH_FARMS = {
  dairy: [["Hattar Dairy Unit", "Hattar Industrial Estate, Haripur"], ["Khanpur Milk Farm", "Khanpur, Haripur"], ["Taxila Cattle Unit", "Taxila, Rawalpindi"], ["Archived Tarnol Unit", "Tarnol, Islamabad"], ["Empty Trial Unit", "Wah Cantt, Rawalpindi"]],
  agri: [["Hattar Crop Estate", "Hattar, Haripur"], ["Bhoi Gar Fields", "Bhoi Gar, Haripur"], ["Taxila Orchard Fields", "Taxila, Rawalpindi"], ["Archived Fateh Jang Fields", "Fateh Jang, Attock"], ["Empty Trial Fields", "Wah Cantt, Rawalpindi"]],
  flock: [["Hattar Poultry Unit", "Hattar, Haripur"], ["Haripur Layer Farm", "Haripur, Pakistan"], ["Taxila Broiler Unit", "Taxila, Rawalpindi"], ["Archived Attock Flock", "Attock, Pakistan"], ["Empty Trial Flock", "Wah Cantt, Rawalpindi"]]
};

export function getSeedToday() {
  const supplied = String(process.env.MUF_SEED_TODAY || "").trim();
  if (!supplied) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(supplied)) throw new Error("MUF_SEED_TODAY must use YYYY-MM-DD.");
  const parsed = new Date(supplied + "T12:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== supplied) throw new Error("MUF_SEED_TODAY is not a real calendar date.");
  return supplied;
}

export function dateFromSeed(daysAgo = 0, today = getSeedToday()) {
  const date = new Date(today + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() - Number(daysAgo || 0));
  return date.toISOString().slice(0, 10);
}

export function seededRandom(label = "muf-demo") {
  let state = 2166136261;
  for (const char of String(label)) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); }
  return function random() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDemoProfile() {
  const selected = String(process.env.MUF_DEMO_PROFILE || "").trim().toLowerCase();
  if (selected && selected !== "basic" && selected !== "rich") throw new Error("MUF_DEMO_PROFILE must be either basic or rich.");
  if (selected) return selected;
  return "basic"; // Switched to rich only in the final coordinated seed/docs commit.
}

export function getFarmDefinitions(app, profile = getDemoProfile()) {
  if (!APP_NAMES.includes(app)) throw new Error("Unknown MUF demo app: " + app);
  const source = profile === "rich" ? RICH_FARMS[app] : BASIC_FARMS;
  return source.map(([name, location], index) => ({
    name, location, archived: profile === "rich" && index === 3,
    createdAt: new Date(Date.UTC(2020, 0, index + 1))
  }));
}

function hash32(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function stableObjectId(value) {
  const a = hash32(value).toString(16).padStart(8, "0");
  const b = hash32("b:" + value).toString(16).padStart(8, "0");
  const c = hash32("c:" + value).toString(16).padStart(8, "0");
  return (a + b + c).slice(0, 24);
}

function buildAccounts(app, farmIds) {
  const f = farmIds.map(String);
  const accounts = [
    { username: "admin", password: "admin123", role: "admin", farmIds: [], displayName: "Demo Owner" },
    { username: "worker", password: "worker123", role: "worker", farmIds: [f[0]], displayName: "Farm One Worker" },
    { username: "manager", password: "manager123", role: "manager", farmIds: f.length > 2 ? [f[1], f[2]] : [f[1]], displayName: "Shared Farm Manager" },
    { username: "worker2", password: "worker2123", role: "worker", farmIds: f.length > 2 ? [f[1], f[2]] : [f[1]], displayName: "Shared Farm Worker" }
  ];
  if (f.length >= 5) accounts.push(
    { username: "manager2", password: "manager2123", role: "manager", farmIds: [f[2]], displayName: "Taxila Farm Manager" },
    { username: "manager3", password: "manager3123", role: "manager", farmIds: [f[3]], displayName: "Archived Farm Manager" },
    { username: "worker3", password: "worker3123", role: "worker", farmIds: [f[1]], displayName: "Haripur Farm Worker" },
    { username: "worker4", password: "worker4123", role: "worker", farmIds: [f[2]], displayName: "Taxila Farm Worker" },
    { username: "worker5", password: "worker5123", role: "worker", farmIds: [f[3]], displayName: "Archived Farm Worker" },
    { username: "worker6", password: "worker6123", role: "worker", farmIds: [f[1]], displayName: "Second Haripur Worker" }
  );
  return accounts.map((account) => ({ ...account, email: account.username + "@" + app + ".test", active: true, seedId: "seed-" + app + "-user-" + account.username }));
}

function buildProducts(app, farmIds, today) {
  const products = [];
  const categories = {
    dairy: [["Fresh Milk", "milk", "litre"], ["Yogurt", "dairy", "kg"]],
    agri: [["Wheat Grain", "crop", "kg"], ["Farm Compost", "input", "bag"]],
    flock: [["Desi Eggs", "eggs", "dozen"], ["Day-old Chicks", "birds", "bird"]]
  };
  const prices = [180, 240, 95, 320, 25, 450, 75, 520];
  const quantities = [70, 24, 180, 38, 95, 16, 55, 12];
  for (let farmIndex = 0; farmIndex < Math.min(4, farmIds.length); farmIndex += 1) {
    for (let itemIndex = 0; itemIndex < 2; itemIndex += 1) {
      const [name, kind, unit] = categories[app][itemIndex];
      products.push({
        seedId: "seed-" + app + "-product-f" + (farmIndex + 1) + "-" + (itemIndex + 1),
        farmId: String(farmIds[farmIndex]), name: name + " " + (farmIndex + 1), kind, unit,
        price: prices[farmIndex * 2 + itemIndex], quantity: quantities[farmIndex * 2 + itemIndex],
        photoUrl: "", published: (farmIndex + itemIndex) % 2 === 0,
        createdAt: new Date(dateFromSeed(12 + farmIndex, today) + "T08:00:00.000Z"),
        updatedAt: new Date(dateFromSeed(2 + itemIndex, today) + "T08:00:00.000Z")
      });
    }
  }
  return products;
}

function buildDairyCollections(farmIds, today) {
  const c = { Cow: [], BreedingEvent: [], Milk: [], Expense: [], Health: [], Buyer: [], BuyerPayment: [], Supplier: [], SupplierPayment: [], Laborer: [], LaborAttendance: [], LaborAdvance: [], Rate: [], RateHistory: [], Sale: [] };
  for (let farmNo = 2; farmNo <= 4; farmNo += 1) {
    const farmId = String(farmIds[farmNo - 1]);
    const p = "seed-dairy-f" + farmNo;
    const bull = p + "-bull-01";
    const mother = p + "-cow-01";
    const sold = p + "-cow-sold";
    const calf = p + "-calf-01";
    c.Cow.push({ _id: bull, seedId: bull, farmId, name: "Sher " + farmNo, breed: "Sahiwal", gender: "male", earTag: "D-" + farmNo + "-B-001", status: "active", birthDate: dateFromSeed(1100, today), weight: 570, lactationNumber: 0, batch: "Breeding Bulls", purchasePrice: 185000 });
    const activeCount = farmNo - 1;
    for (let n = 1; n <= activeCount; n += 1) {
      const cowId = n === 1 ? mother : p + "-cow-" + String(n).padStart(2, "0");
      c.Cow.push({ _id: cowId, seedId: cowId, farmId, name: (n === 1 ? "Noor " : "Rani ") + farmNo + (n === 1 ? "" : "-" + n), breed: n % 2 ? "Sahiwal" : "Holstein Friesian", gender: "female", earTag: "D-" + farmNo + "-C-" + String(n).padStart(3, "0"), status: "active", birthDate: dateFromSeed(800 + n * 70, today), weight: 390 + n * 22, lactationNumber: 2 + n, batch: "Lactating Group " + farmNo, calvingDate: dateFromSeed(125, today), purchasePrice: 145000 + n * 9000, fatherId: bull, fatherType: "farm", fatherName: "Sher " + farmNo });
      for (let day = 0; day < 60; day += 1) c.Milk.push({ _id: p + "-milk-" + n + "-" + (day + 1), seedId: p + "-milk-" + n + "-" + (day + 1), farmId, cowId, date: dateFromSeed(day, today), morning: 7 + ((day + n) % 4), evening: 5 + ((day + 2 * n) % 3), calfMilk: 0.5, fatPercent: 3.8, snfPercent: 8.5 });
    }
    c.Cow.push({ _id: sold, seedId: sold, farmId, name: "Gulabo " + farmNo, breed: "Red Sindhi", gender: "female", earTag: "D-" + farmNo + "-S-001", status: "sold", birthDate: dateFromSeed(1600, today), weight: 360, lactationNumber: 5, batch: "Sold Animals", purchasePrice: 95000, fatherId: bull, fatherType: "farm", fatherName: "Sher " + farmNo });
    c.Cow.push({ _id: calf, seedId: calf, farmId, name: "Chhoti " + farmNo, breed: "Sahiwal", gender: "female", earTag: "D-" + farmNo + "-K-001", status: "calf", birthDate: dateFromSeed(24, today), weight: 58, lactationNumber: 0, motherId: mother, fatherId: bull, fatherType: "farm", fatherName: "Sher " + farmNo, isCalf: true, batch: "Born on Farm" });
    const eventData = [
      { type: "heat", date: dateFromSeed(42, today), notes: "Observed standing heat." },
      { type: "service", date: dateFromSeed(40, today), sireSource: "farm_bull", bullId: bull, bullName: "Sher " + farmNo, notes: "Natural service by farm bull." },
      { type: "service", date: dateFromSeed(38, today), sireSource: "outside_straw", semenCode: "STRAW-" + farmNo + "-A", bullName: "Approved outside sire", technician: "Demo technician" },
      { type: "pregnancy_check", date: dateFromSeed(18, today), result: "positive", notes: "Routine demo pregnancy check." },
      { type: "calving", date: dateFromSeed(24, today), calves: [{ gender: "female", earTag: "D-" + farmNo + "-K-001", outcome: "live" }], generatedCalfIds: [calf], notes: "Live calf linked to dam and sire." }
    ];
    eventData.forEach((event, index) => c.BreedingEvent.push({ _id: p + "-event-" + (index + 1), seedId: p + "-event-" + (index + 1), farmId, cowId: mother, ...event }));
    c.BreedingEvent.push({ _id: p + "-sold-heat", seedId: p + "-sold-heat", farmId, cowId: sold, type: "heat", date: dateFromSeed(170, today), notes: "Historical event before sale." });
    c.BreedingEvent.push({ _id: p + "-sold-service", seedId: p + "-sold-service", farmId, cowId: sold, type: "service", date: dateFromSeed(165, today), sireSource: "outside_straw", semenCode: "SOLD-" + farmNo + "-STRAW", bullName: "Outside sire" });
    c.Sale.push({ _id: p + "-sale-01", seedId: p + "-sale-01", farmId, cowId: sold, date: dateFromSeed(35, today), salePrice: 175000 + farmNo * 5000, buyer: "Demo cattle buyer " + farmNo, notes: "Sold cow retains breeding history.", previousStatus: "active" });
    const buyer = p + "-buyer-01", supplier = p + "-supplier-01", laborer = p + "-laborer-01";
    c.Buyer.push({ _id: buyer, seedId: buyer, farmId, name: "Milk Buyer " + farmNo, phone: "0300-00000" + farmNo, address: "Local market", defaultRate: 180 });
    c.BuyerPayment.push({ _id: p + "-buyer-payment", seedId: p + "-buyer-payment", farmId, buyerId: buyer, date: dateFromSeed(4, today), amount: 12500, note: "Weekly milk account payment" });
    c.Supplier.push({ _id: supplier, seedId: supplier, farmId, name: "Feed Supplier " + farmNo, phone: "0311-00000" + farmNo, address: "Haripur supply market" });
    c.SupplierPayment.push({ _id: p + "-supplier-payment", seedId: p + "-supplier-payment", farmId, supplierId: supplier, date: dateFromSeed(3, today), amount: 4800, note: "Part payment against feed purchases" });
    c.Expense.push({ _id: p + "-expense-feed", seedId: p + "-expense-feed", farmId, cowId: null, date: dateFromSeed(8, today), type: "feed", amount: 14800, note: "Monthly fodder purchase", supplierId: supplier }, { _id: p + "-expense-vet", seedId: p + "-expense-vet", farmId, cowId: mother, date: dateFromSeed(16, today), type: "medicine", amount: 2200, note: "Routine veterinary supplies" }, { _id: p + "-expense-labor", seedId: p + "-expense-labor", farmId, cowId: null, date: dateFromSeed(1, today), type: "labor", amount: 6000, note: "Temporary milking support" });
    c.Health.push({ _id: p + "-health-01", seedId: p + "-health-01", farmId, cowId: mother, date: dateFromSeed(12, today), type: "vaccination", description: "FMD vaccination", medicine: "FMD vaccine", vet: "Dr Demo", nextDueDate: dateFromSeed(-78, today), cost: 900 });
    c.Laborer.push({ _id: laborer, seedId: laborer, farmId, name: "Milk Worker " + farmNo, dailyWage: 1200, notes: "Demo labor record" });
    c.LaborAttendance.push({ _id: p + "-attendance-01", seedId: p + "-attendance-01", farmId, workerId: laborer, date: dateFromSeed(1, today), dayType: "full", posted: false, expenseId: "" });
    c.LaborAdvance.push({ _id: p + "-advance-01", seedId: p + "-advance-01", farmId, workerId: laborer, date: dateFromSeed(6, today), amount: 1500, settled: false, notes: "Test wage advance" });
    c.Rate.push({ _id: p + "-rate-01", seedId: p + "-rate-01", farmId, value: 180, date: dateFromSeed(0, today) });
    c.RateHistory.push({ _id: p + "-rate-history-01", seedId: p + "-rate-history-01", farmId, value: 175, date: dateFromSeed(30, today), note: "Previous month rate" });
  }
  return c;
}

function buildAgriCollections(farmIds, today) {
  const c = { Field: [], Crop: [], Finance: [], Task: [], Inventory: [], Liability: [], Laborer: [], Attendance: [], Supplier: [], SupplierPayment: [] };
  for (let farmNo = 2; farmNo <= 4; farmNo += 1) {
    const farmId = String(farmIds[farmNo - 1]), p = "seed-agri-f" + farmNo;
    const fields = [];
    for (let n = 1; n <= farmNo; n += 1) {
      const id = stableObjectId(p + "-field-" + n);
      fields.push({ _id: id, seedId: p + "-field-" + n, farmId, name: "Field " + farmNo + "-" + n, acres: 1.5 + n * 0.75, notes: "Demo acreage for field/cycle testing" });
    }
    c.Field.push(...fields);
    const cycles = [{ season: "Rabi", name: "Wheat", variety: "Galaxy-2013", offset: 210 }, { season: "Kharif", name: "Maize", variety: "Pioneer-30T87", offset: 95 }, { season: "Rabi", name: "Peas", variety: "Meteor", offset: 35 }];
    const crops = [];
    const cycleCount = 2 + farmNo;
    for (let n = 0; n < cycleCount; n += 1) {
      const data = cycles[n % cycles.length], field = fields[n % fields.length], cropId = stableObjectId(p + "-crop-" + (n + 1));
      crops.push({ _id: cropId, seedId: p + "-crop-" + (n + 1), farmId, name: data.name, variety: data.variety, status: n === 0 ? "Completed" : "Growing", field: field.name, fieldId: String(field._id), cycleId: p + "-cycle-" + (n + 1), season: data.season, crop_year: String(Number(today.slice(0, 4)) - (n === 0 ? 1 : 0)), plant_date: dateFromSeed(data.offset, today), harvest_date: dateFromSeed(Math.max(1, data.offset - 75), today), area_kanal: Math.max(2, Math.round(field.acres * 8)), yield_kg: n === 0 ? 2400 + farmNo * 250 : 0, yield_unit: "kg", seed_quantity: 18 + n * 4, seed_unit: "kg", seed_cost_per_unit: 850, notes: data.season + " crop cycle linked to " + field.name });
    }
    c.Crop.push(...crops);
    crops.forEach((crop, n) => {
      c.Finance.push({ _id: stableObjectId(p + "-finance-" + n + "-input"), seedId: p + "-finance-" + n + "-input", farmId, category: "Seed and fertilizer", amount: 18500 + n * 3200, type: "expense", date: dateFromSeed(26 + n * 4, today), crop_id: String(crop._id), fieldId: crop.fieldId, notes: "Field and crop-cycle input cost" }, { _id: stableObjectId(p + "-finance-" + n + "-sale"), seedId: p + "-finance-" + n + "-sale", farmId, category: "Crop sale", amount: 54000 + n * 8000, type: "income", date: dateFromSeed(6 + n, today), crop_id: String(crop._id), fieldId: crop.fieldId, notes: "Linked demo crop-cycle sale" });
    });
    c.Task.push({ _id: stableObjectId(p + "-task-01"), seedId: p + "-task-01", farmId, title: "Irrigate demo field", description: "Check water rotation and field channels", status: "Pending", date: dateFromSeed(1, today), fieldId: String(fields[0]._id), crop_id: String(crops[0]._id) }, { _id: stableObjectId(p + "-task-02"), seedId: p + "-task-02", farmId, title: "Inspect crop health", description: "Scout for weeds and pests", status: "Completed", date: dateFromSeed(5, today), fieldId: String(fields[fields.length - 1]._id), crop_id: String(crops[crops.length - 1]._id) });
    c.Inventory.push({ _id: stableObjectId(p + "-inventory-01"), seedId: p + "-inventory-01", farmId, name: "DAP fertilizer", quantity: 16 + farmNo, unit: "bags", low_stock_threshold: 5, notes: "Demo fertilizer stock" }, { _id: stableObjectId(p + "-inventory-02"), seedId: p + "-inventory-02", farmId, name: "Wheat seed", quantity: 80 + farmNo * 10, unit: "kg", low_stock_threshold: 20, notes: "Demo seed stock" });
    c.Liability.push({ _id: stableObjectId(p + "-liability-01"), seedId: p + "-liability-01", farmId, name: "Fertilizer dealer credit", amount: 12500 + farmNo * 1000, date: dateFromSeed(8, today), dueDate: dateFromSeed(-22, today), status: "unpaid", notes: "Test-only supplier liability" });
    const laborerId = stableObjectId(p + "-laborer-01"), supplierId = stableObjectId(p + "-supplier-01");
    c.Laborer.push({ _id: laborerId, seedId: p + "-laborer-01", farmId, name: "Field Worker " + farmNo, daily_wage: 1100, notes: "Demo laborer" });
    c.Attendance.push({ _id: stableObjectId(p + "-attendance-01"), seedId: p + "-attendance-01", farmId, laborer_id: laborerId, date: dateFromSeed(1, today), day_type: "full", posted: false });
    c.Supplier.push({ _id: supplierId, seedId: p + "-supplier-01", farmId, name: "Agri Supplier " + farmNo, phone: "0302-00000" + farmNo, address: "Local agriculture market" });
    c.SupplierPayment.push({ _id: stableObjectId(p + "-supplier-payment-01"), seedId: p + "-supplier-payment-01", farmId, supplierId: String(supplierId), date: dateFromSeed(2, today), amount: 4500, note: "Part payment" });
  }
  return c;
}

function buildFlockCollections(farmIds, today) {
  const c = { Batch: [], BatchFeedLog: [], BatchMortalityLog: [], BatchExpenseLog: [], BatchSaleLog: [], BatchWeightLog: [], BatchEggLog: [], BatchVaccinationLog: [], DataStore: [] };
  for (let farmNo = 2; farmNo <= 4; farmNo += 1) {
    const farmId = String(farmIds[farmNo - 1]), p = "seed-flock-f" + farmNo, batchCount = farmNo - 1;
    const batches = [];
    for (let n = 1; n <= batchCount; n += 1) {
      const batchId = p + "-batch-" + n;
      const batch = { batch_id: batchId, farmId, seedId: batchId, name: (n === 1 ? "Broiler Batch " : "Layer Batch ") + farmNo + (n === 1 ? "" : "-" + n), type: n === 1 ? "Broiler" : "Layer", start_date: dateFromSeed(80 + n * 30, today), expected_end_date: dateFromSeed(10, today), intake_count: 80 + farmNo * 10, source: "Demo hatchery", cost_per_bird: 125 + n * 5, status: farmNo === 4 && n === batchCount ? "Closed" : "Active" };
      batches.push(batch); c.Batch.push(batch);
      c.BatchFeedLog.push({ seedId: batchId + "-feed", farmId, batch_id: batchId, date: dateFromSeed(5, today), feed_type: "Starter mash", quantity_kg: 22 + n * 4, rate_rs_per_kg: 118, notes: "Demo feed entry" });
      c.BatchMortalityLog.push({ seedId: batchId + "-mortality", farmId, batch_id: batchId, date: dateFromSeed(12, today), count: 1, reason: "Weak chick", notes: "Routine mortality log" });
      c.BatchExpenseLog.push({ seedId: batchId + "-expense", farmId, batch_id: batchId, date: dateFromSeed(9, today), category: "Medicine", detail: "Routine flock medicine", amount: 1850 + n * 200, notes: "" });
      c.BatchSaleLog.push({ seedId: batchId + "-sale", farmId, batch_id: batchId, date: dateFromSeed(4, today), count: 12, amount: 15600, buyer: "Poultry buyer " + farmNo, notes: "Partial batch sale" });
      c.BatchWeightLog.push({ seedId: batchId + "-weight", farmId, batch_id: batchId, date: dateFromSeed(3, today), avg_weight_g: 1450 + n * 80, sample_size: 12, notes: "Weekly sample" });
      c.BatchEggLog.push({ seedId: batchId + "-eggs", farmId, batch_id: batchId, date: dateFromSeed(1, today), collected: 38 + n * 6, sold: 30 + n * 4, home_use: 4, broken_wasted: 2, price_per_egg: 25, notes: "Layer collection" });
      c.BatchVaccinationLog.push({ seedId: batchId + "-vaccination", farmId, batch_id: batchId, date: dateFromSeed(7, today), vaccine_name: "Newcastle (ND)", dose: "0.5 ml", bird_count: 70, cost: 950, notes: "Vaccination schedule" });
    }
    const sourceBatch = batches[0];
    const birds = Array.from({ length: 8 + farmNo }, (_, index) => ({ id: "seed-" + farmNo + "-bird-" + (index + 1), name: "Home Bird " + farmNo + "-" + (index + 1), gender: index % 3 === 0 ? "Male" : "Female", breed: index % 2 ? "Desi" : "Golden", status: "Active", batchId: sourceBatch.batch_id }));
    const buckets = {
      birds, homeBirds: birds.slice(0, 8),
      customers: [{ id: "seed-" + farmNo + "-customer-1", name: "Egg Customer " + farmNo, phone: "0303-00000" + farmNo }],
      suppliers: [{ id: "seed-" + farmNo + "-supplier-1", name: "Feed Supplier " + farmNo }],
      incubations: [{ id: "seed-" + farmNo + "-incubation-1", sourceBatchId: sourceBatch.batch_id, eggsSet: 24, allocatedCount: 8, hatchedCount: 7, dateSet: dateFromSeed(21, today) }],
      feed: [{ id: "seed-" + farmNo + "-feed-1", date: dateFromSeed(5, today), feedType: "Layer mash", quantityKg: 22, rateRsPerKg: 118 }],
      mortality: [{ id: "seed-" + farmNo + "-mortality-1", date: dateFromSeed(12, today), count: 1, reason: "Weak chick" }],
      sales: [{ id: "seed-" + farmNo + "-sale-1", date: dateFromSeed(4, today), quantity: 12, amount: 15600, customerId: "seed-" + farmNo + "-customer-1" }],
      weight: [{ id: "seed-" + farmNo + "-weight-1", date: dateFromSeed(3, today), averageWeight: 1450 }],
      expenses: [{ id: "seed-" + farmNo + "-expense-1", date: dateFromSeed(9, today), category: "Medicine", amount: 1850 }],
      eggs: [{ id: "seed-" + farmNo + "-eggs-1", date: dateFromSeed(1, today), totalEggsCollected: 42, sold: 34, homeUse: 4, brokenWasted: 2 }],
      vaccinations: [{ id: "seed-" + farmNo + "-vaccination-1", date: dateFromSeed(7, today), vaccineName: "Newcastle (ND)", birdCount: 70, cost: 950 }]
    };
    for (const [key, value] of Object.entries(buckets)) c.DataStore.push({ seedId: p + "-bucket-" + key, farmId, key, value, version: 0 });
  }
  return c;
}

export function buildSeedPlan(app, farmIds, options = {}) {
  if (!APP_NAMES.includes(app)) throw new Error("Unknown MUF demo app: " + app);
  if (!Array.isArray(farmIds) || farmIds.length < 2) throw new Error("buildSeedPlan requires at least two farm IDs.");
  const today = options.today || getSeedToday();
  const rich = farmIds.length >= 5;
  const products = rich ? buildProducts(app, farmIds, today) : [];
  const collections = !rich ? {} : app === "dairy" ? buildDairyCollections(farmIds, today) : app === "agri" ? buildAgriCollections(farmIds, today) : buildFlockCollections(farmIds, today);
  return { app, today, rich, farms: getFarmDefinitions(app, rich ? "rich" : "basic"), accounts: buildAccounts(app, farmIds), products, collections };
}

export async function insertSeedCollections(plan, models) {
  if (!plan || !models) throw new Error("A seed plan and model registry are required.");
  if (!plan.rich) return;
  if (!models.Product) throw new Error("Product model is required for rich demo data.");
  if (plan.products.length) await models.Product.insertMany(plan.products);
  for (const [modelName, documents] of Object.entries(plan.collections)) {
    if (!documents.length) continue;
    if (!models[modelName]) throw new Error("Missing model " + modelName + " for " + plan.app + " rich demo seed.");
    await models[modelName].insertMany(documents);
  }
}

export function validateSeedTarget(uri, options = {}) {
  const nodeEnv = String(options.nodeEnv ?? process.env.NODE_ENV ?? "").toLowerCase();
  const allowRemote = String(options.allowRemote ?? process.env.MUF_SEED_ALLOW_REMOTE ?? "") === "1";
  if (nodeEnv === "production") throw new Error("Refusing to seed while NODE_ENV=production.");
  if (typeof uri !== "string" || !uri.trim()) throw new Error("MUF_SEED_URI (or MONGO_URI) is required.");
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error("The seed URI is not a valid MongoDB URL."); }
  if (parsed.protocol !== "mongodb:" && parsed.protocol !== "mongodb+srv:") throw new Error("Only mongodb:// and mongodb+srv:// URIs are supported.");
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, "").split("/")[0] || "");
  const host = parsed.hostname.toLowerCase();
  if (!/^muf_(phase19|test|demo|seed)_[a-z0-9_]+$/.test(dbName)) throw new Error("Database name must match ^muf_(phase19|test|demo|seed)_[a-z0-9_]+$.");
  if (/(prod|production|live)/i.test(dbName)) throw new Error("Production/live database names are forbidden.");
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!allowRemote && !local) throw new Error("Remote MongoDB hosts require MUF_SEED_ALLOW_REMOTE=1.");
  return { host, dbName, local };
}

export function parseSeedArgs(argv = []) {
  const result = { app: "", apply: false, reset: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--app") result.app = String(argv[++index] || "").toLowerCase();
    else if (value === "--apply") result.apply = true;
    else if (value === "--dry-run") result.apply = false;
    else if (value === "--reset") result.reset = true;
    else throw new Error("Unknown seed argument: " + value);
  }
  if (!APP_NAMES.includes(result.app)) throw new Error("Use --app dairy, --app agri, or --app flock.");
  if (result.reset && !result.apply) throw new Error("--reset is only allowed together with --apply.");
  return result;
}
