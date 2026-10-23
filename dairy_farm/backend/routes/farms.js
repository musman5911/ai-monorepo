import express from 'express';
import { Farm, User, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES } from '../db.js';
import { protect, ownerOnly } from '../middleware/auth.js';
import { mufCreateFarmsRouter } from '../muf-farms.mjs';

// /api/farms: list (everyone, own farms), create/rename/archive/restore/delete (owner only).
export default mufCreateFarmsRouter({
  express, Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES, protect, ownerOnly,
});
