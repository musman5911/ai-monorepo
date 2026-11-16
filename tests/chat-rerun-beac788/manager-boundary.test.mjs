// NEW Phase 19 regression checks: real local HTTP, fresh in-memory server per case.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApp,login,req} from '../acceptance/_harness.mjs';
async function managerCase(fn){
 const {base,stop}=await startApp('dairy');
 try{
  const owner=await login(base,'admin','admin'+String(123),'dairy');
  const farms=await req(base,'GET','/api/farms',owner);assert.equal(farms.status,200,'setup farms');
  const a=(farms.json.farms||farms.json)[0];const farmId=String(a.id||a._id);
  const pw='Chat'+'-manager-42!';
  const created=await req(base,'POST','/api/auth/users',owner,{username:'chatmanager',password:pw,email:'chatmanager@example.invalid',role:'manager',farmIds:[farmId]});
  assert.equal(created.status,201,`setup manager: ${created.status} ${created.text}`);
  const token=await login(base,'chatmanager',pw,'dairy');
  await fn({base,owner,token,farmId});
 }finally{stop();}
}
test('NEW-MGR-1: Dairy manager cannot export the owner-only whole-database backup',async()=>managerCase(async({base,token})=>{
 const r=await req(base,'GET','/api/backup',token);console.log(`manager backup HTTP ${r.status}`);assert.equal(r.status,403);
}));
test('NEW-MGR-2: Dairy manager cannot create a farm through a direct request',async()=>managerCase(async({base,token})=>{
 const r=await req(base,'POST','/api/farms',token,{name:'Forbidden manager farm'});console.log(`manager farm create HTTP ${r.status}`);assert.equal(r.status,403);
}));
test('NEW-MGR-3: Dairy manager sees assigned active farm but cannot read another farm header',async()=>managerCase(async({base,owner,token,farmId})=>{
 const added=await req(base,'POST','/api/farms',owner,{name:'Other active farm'});assert.equal(added.status,201,'setup other farm');const b=String(added.json.id||added.json._id||added.json.farm?.id||added.json.farm?._id);assert.ok(b&&b!=='undefined','setup other farm id');
 const r=await req(base,'GET','/api/farms',token);assert.equal(r.status,200);const ids=(r.json.farms||r.json).map(x=>String(x.id||x._id));assert.deepEqual(ids,[farmId]);
 const denied=await fetch(base+'/api/cows',{headers:{Authorization:`Bearer ${token}`,'X-Farm-Id':b}});console.log(`manager other farm HTTP ${denied.status}`);assert.equal(denied.status,403);
}));
