// Reconstructed reruns of Round 4 one-off Dairy probes whose scripts were not archived.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApp,login,req} from '../acceptance/_harness.mjs';
async function dairy(fn){const {base,stop}=await startApp('dairy');try{const tok=await login(base,'admin','admin'+String(123),'dairy');const api=async(method,path,body)=>{const r=await req(base,method,'/api'+path,tok,body);console.log(JSON.stringify({method,path,status:r.status}));assert.ok(r.status>=200&&r.status<300,`setup/request ${path}: ${r.status} ${r.text.slice(0,120)}`);return r;};await fn(api);}finally{stop();}}
test('RERUN-RATE: historical milk uses old rate and exact PKT change-day uses new rate',async()=>dairy(async api=>{
 const old=(await api('GET','/rates/1')).json;
 const today=new Date(Date.now()+18000000).toISOString().slice(0,10),yesterday=new Date(Date.now()+18000000-86400000).toISOString().slice(0,10);
 assert.ok(!old.date||old.date<=yesterday,'setup old rate precedes fixture');
 const cow=(await api('POST','/cows',{name:'Rate boundary rerun',breed:'Jersey',gender:'female',status:'active'})).json;
 await api('POST','/milk',{cowId:cow._id,date:yesterday,morning:10,evening:0,calfMilk:0});await api('PUT','/rates/1',{value:200});await api('POST','/milk',{cowId:cow._id,date:today,morning:10,evening:0,calfMilk:0});
 const actual=(await api('GET',`/milk/summary?cowId=${cow._id}`)).json;console.log(JSON.stringify({expectedRevenue:10*old.value+2000,actual}));assert.equal(actual.revenue,10*old.value+2000);
}));
test('RERUN-CARD: buyer default rate, payment, and card totals agree (1200/1000/200)',async()=>dairy(async api=>{
 const cow=(await api('POST','/cows',{name:'Card cow',breed:'Jersey',gender:'female',status:'active'})).json;
 const buyer=(await api('POST','/buyers',{name:'Card fixture',defaultRate:100})).json;
 const date=new Date(Date.now()+18000000).toISOString().slice(0,10);
 await api('POST','/milk',{cowId:cow._id,buyerId:buyer._id,date,morning:10,evening:5,calfMilk:3});await api('POST',`/buyers/${buyer._id}/payments`,{date,amount:1000});
 const sum=(await api('GET',`/milk/summary?cowId=${cow._id}`)).json;assert.equal(sum.revenue,1200);
 const card=(await api('GET',`/cards/buyer/${buyer._id}`)).text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 console.log('CARD TEXT',card);assert.match(card,/1,200/);assert.match(card,/1,000/);assert.match(card,/\b200\b/);
}));
test('RERUN-HEALTH: linked expense survives edit once and disappears at zero/delete, including bulk',async()=>dairy(async api=>{
 const cow=(await api('POST','/cows',{name:'Health rerun',breed:'Jersey',gender:'female',status:'active'})).json;
 const date='2026-09-03';const payload={cowId:cow._id,date,type:'treatment',description:'Health linkage',cost:700};
 const health=(await api('POST','/health',payload)).json;
 const linked=async(id)=>(await api('GET','/expenses?limit=1000')).json.filter(x=>x._healthId===id);
 assert.equal((await linked(health._id))[0].amount,700);
 await api('PUT',`/health/${health._id}`,{cost:900});let rows=await linked(health._id);assert.equal(rows.length,1);assert.equal(rows[0].amount,900);
 await api('PUT',`/health/${health._id}`,{cost:0});assert.equal((await linked(health._id)).length,0);
 await api('PUT',`/health/${health._id}`,{cost:800});await api('DELETE',`/health/${health._id}`);assert.equal((await linked(health._id)).length,0);
 await api('POST','/health/bulk',{entries:[{...payload,description:'Bulk linkage'}]});const all=(await api('GET',`/health?cowId=${cow._id}`)).json;const bulk=all.find(x=>x.description==='Bulk linkage');assert.ok(bulk,'setup bulk health');rows=await linked(bulk._id);assert.equal(rows.length,1);assert.equal(rows[0].amount,700);
}));
