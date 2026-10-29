import express from 'express';
import { Product, Farm } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { createMufProductHandlers } from '../muf-products.mjs';
const router=express.Router();
const h=createMufProductHandlers({Product,Farm,kinds:['milk','animal']});
router.get('/public',h.publicList); router.get('/',protect,h.list);
router.post('/',protect,adminOnly,h.create); router.put('/:id',protect,adminOnly,h.update); router.delete('/:id',protect,adminOnly,h.remove);
export default router;
