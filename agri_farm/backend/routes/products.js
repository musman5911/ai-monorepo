import express from 'express';
import { Product, Farm } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { createMufProductHandlers } from '../muf-products.mjs';
const router=express.Router();
const h=createMufProductHandlers({Product,Farm,kinds:['produce']});
router.get('/public',h.publicList); router.get('/',protect,h.list);
router.post('/',protect,requireAdmin,h.create); router.put('/:id',protect,requireAdmin,h.update); router.delete('/:id',protect,requireAdmin,h.remove);
export default router;
