#!/usr/bin/env node
// Phase 11: Agri finance archive integration check. Uses disposable memory mode only.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MUF_AGRI_ARCHIVE_PORT || 5188);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'agri_farm/backend'), env: { ...process.env, MEMORY_MODE: '1', PORT: String(port), JWT_SECRET: 'agri-archive-check-secret', NODE_ENV: 'test', MONGO_URI: '', MONGODB_URI: '' }, stdio: ['ignore','pipe','pipe'] });
let logs = '', failures = 0;
child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
const check = (v, label) => { console.log(`  ${v ? '✓' : '✗'} ${label}`); if (!v) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(method, url, { token, farm, body } = {}) {
 const headers = { 'content-type':'application/json' }; if (token) headers.authorization = `Bearer ${token}`; if (farm) headers['x-farm-id'] = farm;
 const res = await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await res.text(); let json; try { json=JSON.parse(raw); } catch { json=raw; }
 return {status:res.status,json,headers:res.headers};
}
async function main() {
 let ready=false;
 for(let i=0;i<60;i++){ if(child.exitCode!==null) throw new Error(`server exited:\n${logs}`); try {const r=await fetch(base+'/api/health'); if(r.status<500){ready=true;break;}} catch {} await sleep(500); }
 if(!ready) throw new Error(`server not ready:\n${logs}`);
 const login=await call('POST','/api/login',{body:{username:'admin',password:'admin123'}});
 const token=login.json?.access_token;
 check(login.status===200&&!!token,'Agri memory-mode owner login'); if(!token) throw new Error(JSON.stringify(login.json));
 const farms=await call('GET','/api/farms',{token}); const defaultFarm=(farms.json?.farms||[])[0];
 check(!!defaultFarm?.id,'Agri default farm exists'); if(!defaultFarm?.id) throw new Error(JSON.stringify(farms.json));
 const createdA=await call('POST','/api/farms',{token,body:{name:'Agri Archive Check Farm A',location:'test'}});
 const farmA=createdA.json?.farm||createdA.json; const aId=farmA?.id||farmA?._id;
 const createdB=await call('POST','/api/farms',{token,body:{name:'Agri Archive Check Farm B',location:'test'}});
 const farmB=createdB.json?.farm||createdB.json; const bId=farmB?.id||farmB?._id;
 check([200,201].includes(createdA.status)&&!!aId&&[200,201].includes(createdB.status)&&!!bId,'two isolated Agri archive test farms created');
 if(!aId||!bId) throw new Error(JSON.stringify({createdA:createdA.json,createdB:createdB.json}));
 farmA.id=aId; farmB.id=bId;
 async function finance(farm, amount, category) {
  const result=await call('POST','/api/finance',{token,farm,body:{date:'2010-01-02',type:'expense',amount,category,notes:'archive integration fixture'}});
  if(result.status!==201) throw new Error('finance fixture failed: '+JSON.stringify(result.json));
  const list=await call('GET','/api/finance?limit=500',{token,farm});
  return (Array.isArray(list.json)?list.json:[]).find(row=>row.category===category);
 }
 const a=await finance(farmA.id,111,'Archive Check A');
 const b=await finance(bId,222,'Archive Check B');
 check(!!a?._id&&!!b?._id,'Agri finance fixtures created in two farms');
 const summaryBefore=await call('GET','/api/analytics/summary',{token,farm:farmA.id});
 const totalBefore=summaryBefore.json?.financeSummary?.totals;
 check(summaryBefore.status===200&&totalBefore?.expense>=111&&totalBefore?.entries>=1,'Agri analytics totals include active finance record');
 const made=await call('POST','/api/archive/jobs',{token,body:{farmId:farmA.id,collection:'finance',retentionYears:1}});
 const job=made.json?.job; check(made.status===201&&job?.sourceCount>=1,'Agri finance snapshot created'); if(!job?.id) throw new Error(JSON.stringify(made.json));
 const early=await call('POST',`/api/archive/jobs/${job.id}/execute`,{token,body:{farmId:farmA.id,confirmFarmName:farmA.name,confirmJobId:job.id}});
 check(early.status===409,'Agri archive refuses removal before export');
 const exported=await call('GET',`/api/archive/jobs/${job.id}/export?farmId=${encodeURIComponent(farmA.id)}`,{token});
 check(exported.status===200&&exported.json?.records?.some(row=>row._id===a._id),'Agri export preserves original finance row');
 await sleep(100);
 const done=await call('POST',`/api/archive/jobs/${job.id}/execute`,{token,body:{farmId:farmA.id,confirmFarmName:farmA.name,confirmJobId:job.id}});
 check(done.status===200&&done.json?.state==='archived','Agri archive executes after export and confirmation');
 const listA=await call('GET','/api/finance?limit=500',{token,farm:farmA.id});
 const listB=await call('GET','/api/finance?limit=500',{token,farm:bId});
 check(listA.status===200&&!listA.json.some(row=>row._id===a._id),'Agri archived finance row leaves active list');
 check(listB.status===200&&listB.json.some(row=>row._id===b._id),'Agri archive preserves other farm finance');
 const summaryAfter=await call('GET','/api/analytics/summary',{token,farm:farmA.id});
 const totalAfter=summaryAfter.json?.financeSummary?.totals;
 check(summaryAfter.status===200&&totalAfter?.expense===totalBefore.expense-111&&totalAfter?.entries===totalBefore.entries-1,'Agri analytics totals exclude archived finance');
 const restored=await call('POST',`/api/archive/jobs/${job.id}/restore`,{token,body:{farmId:farmA.id,confirmFarmName:farmA.name,confirmJobId:job.id}});
 check(restored.status===200&&restored.json?.state==='restored','Agri finance restoration succeeds');
 const summaryRestored=await call('GET','/api/analytics/summary',{token,farm:farmA.id});
 check(summaryRestored.json?.financeSummary?.totals?.expense===totalBefore.expense&&summaryRestored.json?.financeSummary?.totals?.entries===totalBefore.entries,'Agri finance totals return to original values after restore');
}
main().catch(e=>{failures++;console.error(e.stack||e);}).finally(()=>{child.kill('SIGTERM');setTimeout(()=>process.exit(failures?1:0),50);});
