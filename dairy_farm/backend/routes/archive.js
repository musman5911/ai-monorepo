import express from 'express';
import mongoose from 'mongoose';
import { createYearlyArchiveRouter } from '../../../shared/muf-yearly-archive.mjs';
import { ArchiveJob, ArchiveRecord, Farm, Milk, Expense } from '../db.js';
import { protectUnscoped, ownerOnly } from '../middleware/auth.js';
import { mufRunUnscoped, mufScopeModels } from '../muf-farms.mjs';

export default createYearlyArchiveRouter({
  express, mongoose,
  Farm,
  sources: { milk: Milk, expenses: Expense },
  ownerUnscoped: [protectUnscoped, ownerOnly, (_req, _res, next) => mufRunUnscoped(() => next())],
  runUnscoped: mufRunUnscoped,
  scopeModels: mufScopeModels,
  ArchiveJob,
  ArchiveRecord,
});
