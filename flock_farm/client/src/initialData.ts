import { Bird, OtherExpense, FeedRecord, EggProduction, GlobalSettings, VaccinationRecord, Customer, CustomerSale, IncubationRecord } from './types';

export const INITIAL_SETTINGS: GlobalSettings = {
  defaultPricePerEgg: 25,
  vaccinationIntervalDays: 30,
  feedLowStockDays: 14,
  feedConsumptionKgPerDay: 2,
};

export const INITIAL_BIRDS: Bird[] = [
  {
    id: 1,
    name: "Kalu",
    gender: "Male",
    dateBought: "2026-01-10",
    price: 1500,
    status: "Active",
    ageBoughtDays: 120,
    lastVaccinationDate: "2026-07-01",
    dateOfBirth: "2025-09-12",
    breed: "Desi",
  },
  {
    id: 2,
    name: "Raja Kukar",
    gender: "Male",
    dateBought: "2026-03-15",
    price: 1800,
    status: "Active",
    ageBoughtDays: 90,
    lastVaccinationDate: "2026-07-10",
    dateOfBirth: "2025-12-15",
  },
  {
    id: 3,
    name: "Sultan",
    gender: "Male",
    dateBought: "2026-05-01",
    price: 2000,
    status: "Active",
    ageBoughtDays: 60,
    lastVaccinationDate: "2026-07-05",
    dateOfBirth: "2026-03-02",
  },
  {
    id: 4,
    name: "Lali",
    gender: "Female",
    dateBought: "2026-01-12",
    price: 1200,
    status: "Active",
    ageBoughtDays: 120,
    lastVaccinationDate: "2026-07-02",
    dateOfBirth: "2025-09-14",
    breed: "Layer",
  },
  {
    id: 5,
    name: "Champa",
    gender: "Female",
    dateBought: "2026-02-18",
    price: 1100,
    status: "Active",
    ageBoughtDays: 100,
    lastVaccinationDate: "2026-07-05",
    dateOfBirth: "2025-11-10",
  },
  {
    id: 6,
    name: "Gori",
    gender: "Female",
    dateBought: "2026-04-20",
    price: 1300,
    status: "Active",
    ageBoughtDays: 80,
    lastVaccinationDate: "2026-06-10",
    dateOfBirth: "2026-01-30",
  },
  {
    id: 7,
    name: "Nomi",
    gender: "Female",
    dateBought: "2026-05-10",
    price: 1250,
    status: "Active",
    ageBoughtDays: 75,
    lastVaccinationDate: "2026-06-18",
    dateOfBirth: "2026-02-24",
  },
  {
    id: 8,
    name: "Parveen",
    gender: "Female",
    dateBought: "2026-05-15",
    price: 1400,
    status: "Active",
    ageBoughtDays: 70,
    lastVaccinationDate: undefined,
    dateOfBirth: "2026-03-06",
  },
  {
    id: 9,
    name: "Sunehri",
    gender: "Female",
    dateBought: "2026-02-01",
    price: 1200,
    status: "Dead",
    ageBoughtDays: 110,
    dateDied: "2026-06-20",
    deathReason: "Disease",
    deathDetail: "Gala kharab tha, sardi lag gyi thi",
    dateOfBirth: "2025-10-15",
  },
  {
    id: 10,
    name: "Moti",
    gender: "Female",
    dateBought: "2026-02-15",
    price: 1150,
    status: "Dead",
    ageBoughtDays: 95,
    dateDied: "2026-05-12",
    deathReason: "Predator",
    deathDetail: "Billi le gyi thi raat ko",
    dateOfBirth: "2025-11-12",
  }
];

export const INITIAL_EXPENSES: OtherExpense[] = [
  {
    id: 1,
    date: "2026-05-10",
    detail: "Jali Darwazy ka liya",
    category: "Repair",
    amount: 3500,
    notes: "Front door mesh repair and reinforcement",
  },
  {
    id: 2,
    date: "2026-06-05",
    detail: "Disinfectant Spray & Cleaning Supplies",
    category: "Other",
    amount: 1500,
    notes: "Monthly coop hygiene maintenance",
  },
  {
    id: 3,
    date: "2026-07-01",
    detail: "Antibiotics & Multi-vitamins",
    category: "Medicine",
    amount: 2400,
    notes: "General seasonal bird health supplements",
  }
];

export const INITIAL_FEED_RECORDS: FeedRecord[] = [
  {
    id: 1,
    date: "2026-05-02",
    feedType: "Khal & Choker",
    quantityKg: 50,
    rateRsPerKg: 120,
    notes: "Purchased high-protein starter feed bag",
  },
  {
    id: 2,
    date: "2026-06-01",
    feedType: "Corn",
    quantityKg: 60,
    rateRsPerKg: 95,
    notes: "Crushed organic corn feed batch",
  },
  {
    id: 3,
    date: "2026-07-02",
    feedType: "Wheat",
    quantityKg: 40,
    rateRsPerKg: 110,
    notes: "Whole wheat grain supply",
  }
];

export const INITIAL_EGG_PRODUCTION: EggProduction[] = [
  {
    date: "2026-07-10",
    totalEggsCollected: 12,
    sold: 10,
    homeUse: 2,
    brokenWasted: 0,
  },
  {
    date: "2026-07-11",
    totalEggsCollected: 14,
    sold: 12,
    homeUse: 1,
    brokenWasted: 1,
  },
  {
    date: "2026-07-12",
    totalEggsCollected: 11,
    sold: 8,
    homeUse: 2,
    brokenWasted: 1,
  },
  {
    date: "2026-07-13",
    totalEggsCollected: 15,
    sold: 13,
    homeUse: 1,
    brokenWasted: 1,
  },
  {
    date: "2026-07-14",
    totalEggsCollected: 13,
    sold: 11,
    homeUse: 2,
    brokenWasted: 0,
  },
  {
    date: "2026-07-15",
    totalEggsCollected: 10,
    sold: 8,
    homeUse: 1,
    brokenWasted: 1,
  }
];

export const INITIAL_VACCINATIONS: VaccinationRecord[] = [
  { id: 1, birdId: 1, date: '2026-07-01', vaccineName: 'ND + IB', dose: '0.5ml', cost: 50 },
  { id: 2, birdId: 4, date: '2026-07-02', vaccineName: 'ND + IB', dose: '0.5ml', cost: 50 },
  { id: 3, birdId: 6, date: '2026-06-10', vaccineName: 'Fowl Pox', dose: '1 drop', cost: 30, notes: 'Wing web' },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 1, name: 'Ahmed Bhai', phone: '03001234567', notes: 'Daily buyer' },
  { id: 2, name: 'Neighbour Aunty', phone: '03009876543' },
];

export const INITIAL_CUSTOMER_SALES: CustomerSale[] = [
  { id: 1, customerId: 1, date: '2026-07-14', eggsQty: 10, pricePerEgg: 25, amountPaid: 250 },
  { id: 2, customerId: 2, date: '2026-07-15', eggsQty: 6, pricePerEgg: 25, amountPaid: 100, notes: 'Rs 50 pending' },
];

export const INITIAL_INCUBATION: IncubationRecord[] = [
  {
    id: 1,
    startDate: '2026-06-01',
    eggsSet: 24,
    hatchDate: '2026-06-22',
    hatched: 18,
    brokenEggs: 1,
    spoiledEggs: 2,
    infertileEggs: 2,
    deadInShellEggs: 1,
    notes: 'Good hatch rate overall; a few eggs spoiled before hatch.',
  },
];
