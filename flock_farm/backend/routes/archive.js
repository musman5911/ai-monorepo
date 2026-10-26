import express from 'express';
import mongoose from 'mongoose';
import { createYearlyArchiveRouter } from '../../../shared/muf-yearly-archive.mjs';
import Farm from '../models/Farm.js';
import BatchFeedLog from '../models/BatchFeedLog.js';
import BatchMortalityLog from '../models/BatchMortalityLog.js';
import BatchExpenseLog from '../models/BatchExpenseLog.js';
import BatchSaleLog from '../models/BatchSaleLog.js';
import BatchWeightLog from '../models/BatchWeightLog.js';
import BatchEggLog from '../models/BatchEggLog.js';
import BatchVaccinationLog from '../models/BatchVaccinationLog.js';
import { authRequiredUnscoped, requireRole } from '../middleware/auth.js';
import { mufRunUnscoped, mufScopeModels } from '../muf-farms.mjs';

const ownerUnscoped = [authRequiredUnscoped, requireRole('owner'), (_req, _res, next) => mufRunUnscoped(() => next())];
export default createYearlyArchiveRouter({
  express, mongoose,
  Farm,
  sources: {
    batchFeedLogs: BatchFeedLog,
    batchMortalityLogs: BatchMortalityLog,
    batchExpenseLogs: BatchExpenseLog,
    batchSaleLogs: BatchSaleLog,
    batchWeightLogs: BatchWeightLog,
    batchEggLogs: BatchEggLog,
    batchVaccinationLogs: BatchVaccinationLog,
  },
  ownerUnscoped, runUnscoped: mufRunUnscoped, scopeModels: mufScopeModels,
});
