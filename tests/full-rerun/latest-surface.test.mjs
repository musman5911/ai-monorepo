import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApp,login} from '../acceptance/_harness.mjs';
for(const [app,kind] of [['dairy','milk'],['agri','produce'],['flock','egg']]){
 test(`NEW-SHOP-${app}: public projection, publication toggle, farm isolation and worker write denial`,{timeout:90000},async()=>{
  const {base,stop}=await startApp(app);
  try{
   const owner=await login(base,'admin','admin'+String(123),app);
   const worker=await login(base,'worker','worker'+String(123),app);
   const call=async(route,{method='GET',token=owner,farm,body}={})=>{
    const r=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(farm?{'X-Farm-Id':farm}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await r.text();let data;try{data=JSON.parse(text)}catch{};console.log(JSON.stringify({app,route,method,status:r.status}));return {status:r.status,data,headers:r.headers};
   };
   const farms=[];
   for(const label of ['A','B']){const r=await call('/farms',{method:'POST',body:{name:`Rerun shop ${label}`}});assert.equal(r.status,201,'setup create farm');farms.push(String(r.data.farm?._id||r.data.farm?.id||r.data._id||r.data.id));}
   assert.ok(farms.every(x=>x&&x!=='undefined'),'setup farm ids');
   const draft=await call('/products',{method:'POST',farm:farms[0],body:{name:'Rerun draft',kind,unit:'unit',price:0.1,quantity:3,published:false,cost:98765,buyer:'PRIVATE'}});
   assert.equal(draft.status,201,'setup draft');const id=draft.data.product._id;
   let pub=await call('/products/public',{token:null});assert.equal(pub.status,200);assert.ok(!pub.data.products.some(x=>x.id===id));
   const publish=await call(`/products/${id}`,{method:'PUT',farm:farms[0],body:{published:true}});assert.equal(publish.status,200);
   pub=await call('/products/public',{token:null});const row=pub.data.products.find(x=>x.id===id);assert.ok(row);assert.equal(row.price,0.1);assert.equal(row.quantity,3);assert.equal(row.farmName,'Rerun shop A');
   for(const key of ['farmId','cost','buyer','password','published'])assert.ok(!(key in row),`private field ${key}`);
   assert.match(pub.headers.get('cache-control'),/no-store/);
   const wrong=await call(`/products/${id}`,{method:'PUT',farm:farms[1],body:{price:999}});assert.equal(wrong.status,404);
   const denied=await call('/products',{method:'POST',token:worker,body:{name:'Worker product',kind,unit:'unit',price:1,quantity:1}});assert.equal(denied.status,403);
   const unpublish=await call(`/products/${id}`,{method:'PUT',farm:farms[0],body:{published:false}});assert.equal(unpublish.status,200);
   pub=await call('/products/public',{token:null});assert.ok(!pub.data.products.some(x=>x.id===id));
  }finally{stop();}
 });
}
