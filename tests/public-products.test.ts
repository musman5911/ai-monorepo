import { describe, expect, it } from 'vitest';
import { mufNormalizeProductInput, mufPrivateProduct, mufPublicProductQuery, mufPublicProducts } from '../dairy_farm/backend/muf-products.mjs';
describe('MU Farms public products',()=>{
 it('queries only published products',()=>expect(mufPublicProductQuery()).toEqual({published:true}));
 it('filters drafts and allowlists public fields',()=>{
  const farms=[{_id:'a',name:'Farm A'},{_id:'b',name:'Farm B'}];
  const rows=[{_id:'p1',farmId:'a',name:'Milk',kind:'milk',unit:'litre',price:180,quantity:9,published:true,cost:80,buyer:'private',password:'private'},{_id:'p2',farmId:'b',name:'Eggs',kind:'egg',unit:'dozen',price:400,quantity:3,published:false}];
  const out=mufPublicProducts(rows,farms);expect(out).toHaveLength(1);expect(out[0]).toMatchObject({id:'p1',farmName:'Farm A',name:'Milk'});
  for(const key of ['farmId','cost','buyer','password','published'])expect(out[0]).not.toHaveProperty(key);
 });
 it('publishes Farm B records only after the flag is true',()=>{
  const p={_id:'p2',farmId:'b',name:'Eggs',kind:'egg',unit:'dozen',price:400,quantity:2,published:false};
  expect(mufPublicProducts([p],[{_id:'b',name:'Farm B'}])).toEqual([]);
  expect(mufPublicProducts([{...p,published:true}],[{_id:'b',name:'Farm B'}])[0]).toMatchObject({farmName:'Farm B'});
 });
 it('defaults new products to draft and validates fields',()=>{
  const input={name:'Corn',kind:'produce',unit:'kg',price:'25',quantity:'100',farmId:'forged',cost:5};
  expect(mufNormalizeProductInput(input,['produce']).fields).toEqual({name:'Corn',kind:'produce',unit:'kg',price:25,quantity:100,photoUrl:'',published:false});
  expect(mufNormalizeProductInput({...input,price:-1},['produce']).ok).toBe(false);
  expect(mufNormalizeProductInput({...input,kind:'milk'},['produce']).ok).toBe(false);
  expect(mufNormalizeProductInput({published:'true'},['produce'],{partial:true}).ok).toBe(false);
 });
 it('allowlists authenticated product response fields',()=>{
  const p=mufPrivateProduct({_id:'p1',farmId:'a',name:'Milk',kind:'milk',unit:'litre',price:150,quantity:5,published:true,cost:20,buyer:'secret'});
  expect(p).toMatchObject({_id:'p1',farmId:'a'});expect(p).not.toHaveProperty('cost');expect(p).not.toHaveProperty('buyer');
 });
});
