'use strict';
const LIMIT=200;
function photoUrl(value){const s=String(value==null?'':value).trim();if(!s)return '';try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export const mufPublicProductQuery=()=>({published:true});
export function mufPublicProducts(rows,farms=[]){
 const names=new Map((Array.isArray(farms)?farms:[]).map(f=>[String((f&&(f._id||f.id))||''),String((f&&f.name)||'Farm')]));
 return (Array.isArray(rows)?rows:[]).filter(p=>p&&p.published===true).map(p=>({
  id:String(p._id||p.id||''),farmName:names.get(String(p.farmId||''))||'Farm',name:String(p.name||''),kind:String(p.kind||''),unit:String(p.unit||''),
  price:Number.isFinite(Number(p.price))?Number(p.price):0,quantity:Number.isFinite(Number(p.quantity))?Number(p.quantity):0,photoUrl:photoUrl(p.photoUrl),updatedAt:p.updatedAt||null
 }));
}
export function mufPrivateProduct(p){if(!p)return null;return {
 _id:String(p._id||p.id||''),farmId:String(p.farmId||''),name:String(p.name||''),kind:String(p.kind||''),unit:String(p.unit||''),
 price:Number.isFinite(Number(p.price))?Number(p.price):0,quantity:Number.isFinite(Number(p.quantity))?Number(p.quantity):0,
 photoUrl:photoUrl(p.photoUrl),published:p.published===true,createdAt:p.createdAt||null,updatedAt:p.updatedAt||null
};}
export function mufNormalizeProductInput(input,kinds,options={}){
 const partial=options.partial===true;
 if(!input||typeof input!=='object'||Array.isArray(input))return{ok:false,error:'A product object is required.'};
 const fields={},has=k=>Object.prototype.hasOwnProperty.call(input,k),allowed=Array.isArray(kinds)?kinds:[];
 if(!partial||has('name')){const v=String(input.name==null?'':input.name).trim();if(!v||v.length>120)return{ok:false,error:'Name is required (120 characters max).'};fields.name=v;}
 if(!partial||has('kind')){const v=String(input.kind==null?'':input.kind).trim();if(!allowed.includes(v))return{ok:false,error:'Choose a supported product type.'};fields.kind=v;}
 if(!partial||has('unit')){const v=String(input.unit==null?'':input.unit).trim();if(!v||v.length>32)return{ok:false,error:'Unit is required (32 characters max).'};fields.unit=v;}
 for(const key of ['price','quantity'])if(!partial||has(key)){if(input[key]===''||input[key]==null)return{ok:false,error:'Price and quantity must be non-negative numbers.'};const n=Number(input[key]);if(!Number.isFinite(n)||n<0||n>1000000000)return{ok:false,error:'Price and quantity are out of range.'};fields[key]=n;}
 if(!partial||has('photoUrl')){const v=String(input.photoUrl==null?'':input.photoUrl).trim();if(v.length>500||(v&&!photoUrl(v)))return{ok:false,error:'Photo URL must be HTTPS and 500 characters max.'};fields.photoUrl=v;}
 if(has('published')){if(typeof input.published!=='boolean')return{ok:false,error:'Published must be a boolean.'};fields.published=input.published;}else if(!partial)fields.published=false;
 return{ok:true,fields};
}
export function createMufProductHandlers({Product,Farm,kinds}){
 async function publicList(_req,res){try{
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, private');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Referrer-Policy','no-referrer');
  const rows=await Product.find(mufPublicProductQuery()).sort({updatedAt:-1}).limit(LIMIT).lean();
  const ids=Array.from(new Set((rows||[]).map(p=>String(p.farmId||'')).filter(Boolean)));
  const farms=ids.length?await Farm.find({_id:{$in:ids}}).select('_id name').lean():[];
  res.json({products:mufPublicProducts(rows,farms)});
 }catch{res.status(500).json({error:'Could not load published products.'});}}
 async function list(_req,res){try{const rows=await Product.find({}).sort({updatedAt:-1}).limit(LIMIT).lean();res.json({products:(rows||[]).map(mufPrivateProduct)});}catch{res.status(500).json({error:'Could not load products for this farm.'});}}
 async function create(req,res){const p=mufNormalizeProductInput(req.body,kinds);if(!p.ok)return res.status(400).json({error:p.error});try{const product=await Product.create(p.fields);return res.status(201).json({product:mufPrivateProduct(product)});}catch{return res.status(400).json({error:'Could not save product. Check its values.'});}}
 async function update(req,res){const p=mufNormalizeProductInput(req.body,kinds,{partial:true});if(!p.ok)return res.status(400).json({error:p.error});if(!Object.keys(p.fields).length)return res.status(400).json({error:'No supported fields supplied.'});try{const product=await Product.findOneAndUpdate({_id:req.params.id},{$set:p.fields},{new:true,runValidators:true});if(!product)return res.status(404).json({error:'Product not found in selected farm.'});return res.json({product:mufPrivateProduct(product)});}catch{return res.status(400).json({error:'Could not update product. Check its values.'});}}
 async function remove(req,res){try{const p=await Product.findOneAndDelete({_id:req.params.id});if(!p)return res.status(404).json({error:'Product not found in selected farm.'});return res.json({ok:true});}catch{return res.status(500).json({error:'Could not delete product.'});}}
 return{publicList,list,create,update,remove};
}
