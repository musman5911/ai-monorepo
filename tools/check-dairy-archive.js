#!/usr/bin/env node
// Phase 11: disposable in-memory Dairy archive integration check. No real DB.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cwd = path.join(root, 'dairy_farm/backend'), port = Number(process.env.MUF_ARCHIVE_CHECK_PORT || 5187);
const base = `http://127.0.0.1:${port}`, child = spawn(process.execPath, ['server.js'], { cwd, env: { ...process.env, MEMORY_MODE: '1', PORT: String(port), JWT_SECRET: 'dairy-archive-check-secret', NODE_ENV: 'development', MONGO_URI: '', MONGODB_URI: '' }, stdio: ['ignore','pipe','pipe'] });
let logs = '', failures = 0;
child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
const check = (v, label) => { console.log(`  ${v ? '✓' : '✗'} ${label}`); if (!v) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(method, url, { token, farm, body } = {}) {
  const headers = { 'content-type':'application/json' }; if (token) headers.authorization = `Bearer ${token}`; if (farm) headers['x-farm-id'] = farm;
  const res = await fetch(base+url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await res.text(); let json; try { json = JSON.parse(raw); } catch { json = raw; } return { status:res.status, json };
}
async function ready() {
  for(let i=0;i<60;i++){ if(child.exitCode!==null) throw new Error(`server exited:\n${logs}`); try { const r=await fetch(base+'/api/auth/check'); if(r.status<500)return; } catch {} await sleep(500); }
  throw new Error(`server not ready:\n${logs}`);
}
async function main(){
  await ready();
  const login=await call('POST','/api/auth/login',{body:{username:'admin',password:'admin123'}}), token=login.json?.token;
  check(login.status===200 && !!token,'memory-mode owner login'); if(!token)throw Error('owner login failed');
  const list=await call('GET','/api/farms',{token}), a=list.json?.farms?.[0]; check(!!a?.id,'default farm exists'); if(!a?.id)throw Error('default farm missing');
  const madeFarm=await call('POST','/api/farms',{token,body:{name:'Archive Check Farm B',location:'test'}}), b=madeFarm.json;
  check(madeFarm.status===201 && !!b?.id,'second farm created'); if(!b?.id)throw Error('second farm missing');
  async function milk(farm,tag){ const cowId='archive-check-'+tag; const c=await call('POST','/api/cows',{token,farm,body:{_id:cowId,name:'Archive '+tag,breed:'Sahiwal',status:'active'}}); if(![200,201].includes(c.status))throw Error('cow create failed '+JSON.stringify(c.json)); const m=await call('POST','/api/milk',{token,farm,body:{cowId,date:'2010-01-02',morning:3,evening:4,calfMilk:1}}); if(![200,201].includes(m.status))throw Error('milk create failed '+JSON.stringify(m.json)); return m.json; }
  const ma=await milk(a.id,'A'), mb=await milk(b.id,'B');
  const made=await call('POST','/api/archive/jobs',{token,body:{farmId:a.id,collection:'milk',retentionYears:1}}), job=made.json?.job;
  check(made.status===201 && job?.state==='snapshot_ready','old milk snapshot created for selected farm'); if(!job?.id)throw Error('archive create failed '+JSON.stringify(made.json));
  const archiveRows=await call('GET',`/api/archive/jobs/${job.id}/records?farmId=${encodeURIComponent(a.id)}`,{token});
  check(archiveRows.status===200&&archiveRows.json?.records?.length===1&&archiveRows.json.records[0]._id===ma._id,'snapshot records can be read before removal');
  const foreignRead=await call('GET',`/api/archive/jobs/${job.id}/records?farmId=${encodeURIComponent(b.id)}`,{token});
  check(foreignRead.status===404,'another farm cannot read this archive job');
  const invalidRetention=await call('POST','/api/archive/jobs',{token,body:{farmId:a.id,collection:'milk',retentionYears:0}});
  check(invalidRetention.status===400,'rejects missing/invalid retention period');
  const early=await call('POST',`/api/archive/jobs/${job.id}/execute`,{token,body:{farmId:a.id,confirmFarmName:a.name,confirmJobId:job.id}});
  check(early.status===409,'refuses delete before export');
  const exp=await call('GET',`/api/archive/jobs/${job.id}/export?farmId=${encodeURIComponent(a.id)}`,{token});
  check(exp.status===200 && exp.json?.records?.length===1,'download returns durable snapshot'); await sleep(200);
  const wrong=await call('POST',`/api/archive/jobs/${job.id}/execute`,{token,body:{farmId:a.id,confirmFarmName:'wrong',confirmJobId:job.id}});
  check(wrong.status===400,'rejects wrong typed confirmation');
  const done=await call('POST',`/api/archive/jobs/${job.id}/execute`,{token,body:{farmId:a.id,confirmFarmName:a.name,confirmJobId:job.id}});
  check(done.status===200 && done.json?.state==='archived','archives after export and confirmation');
  const aa=await call('GET','/api/milk?from=2010-01-01&to=2010-12-31',{token,farm:a.id}), bb=await call('GET','/api/milk?from=2010-01-01&to=2010-12-31',{token,farm:b.id});
  check(Array.isArray(aa.json)&&!aa.json.some(r=>r._id===ma._id),'archived row leaves active list');
  check(Array.isArray(bb.json)&&bb.json.some(r=>r._id===mb._id),'Archive farm A does not remove farm B records');
  const restored=await call('POST',`/api/archive/jobs/${job.id}/restore`,{token,body:{farmId:a.id,confirmFarmName:a.name,confirmJobId:job.id}});
  check(restored.status===200 && restored.json?.state==='restored','restore succeeds');
  const after=await call('GET','/api/milk?from=2010-01-01&to=2010-12-31',{token,farm:a.id}), row=Array.isArray(after.json)?after.json.find(r=>r._id===ma._id):null;
  check(!!row&&row.morning===ma.morning&&row.evening===ma.evening&&row.cowId===ma.cowId&&row.date===ma.date,'restores the original milk record unchanged');
  const expense=await call('POST','/api/expenses',{token,farm:a.id,body:{date:'2010-01-03',type:'feed',amount:22,note:'archive check'}});
  check([200,201].includes(expense.status),'expense fixture created');
  const ej=await call('POST','/api/archive/jobs',{token,body:{farmId:a.id,collection:'expenses',retentionYears:1}});
  check(ej.status===201&&ej.json?.job?.sourceCount===1,'expenses use the same archive snapshot path');
}
main().catch(e=>{failures++;console.error(e.stack||e);}).finally(()=>{child.kill('SIGTERM');setTimeout(()=>process.exit(failures?1:0),50);});
