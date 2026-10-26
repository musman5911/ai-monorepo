import express from 'express';
import mongoose from 'mongoose';
import { createYearlyArchiveRouter } from '../../../shared/muf-yearly-archive.mjs';
import { Farm, Finance, ArchiveJob, ArchiveRecord } from '../db.js';
import { protectUnscoped, ownerOnly } from '../middleware/auth.js';
import { mufRunUnscoped, mufScopeModels } from '../muf-farms.mjs';

export default createYearlyArchiveRouter({
  express, mongoose,
  Farm, ArchiveJob, ArchiveRecord,
  sources: { finance: Finance },
  ownerUnscoped: [protectUnscoped, ownerOnly, (_req, _res, next) => mufRunUnscoped(() => next())],
  runUnscoped: mufRunUnscoped,
  scopeModels: mufScopeModels,
});
