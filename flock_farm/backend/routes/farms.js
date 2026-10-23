import express from 'express';
import { Farm, User, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { mufCreateFarmsRouter } from '../muf-farms.mjs';

export default mufCreateFarmsRouter({
  express,
  Farm,
  User,
  models: MUF_FARM_MODELS,
  names: MUF_FARM_SCOPED_NAMES,
  protect: authRequired,
  ownerOnly: (req, res, next) => requireRole('owner')(req, res, next),
});
