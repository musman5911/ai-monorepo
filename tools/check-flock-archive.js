#!/usr/bin/env node
// Phase 11: Flock batch-feed archive integration check. Uses disposable memory mode only.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MUF_FLOCK_ARCHIVE_PORT || 5189);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'flock_farm/backend'), env: { ...process.env, MEMORY_MODE: '1', PORT: String(port), JWT_SECRET: 'flock-archive-check-secret', NODE_ENV: 'development', MONGO_URI: '', MONGODB_URI: '' }, stdio: ['ignore','pipe','pipe'] });
let logs='', failures=0; child.stdout.on('data',d=>{logs+=d}); child.stderr.on('data',d=>{logs+=d});
const check=(v,label)=>{console.log(`  ${v?'✓':'✗'} ${label}`);if(!v)failures++}; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(method,url,{token,farm,body}={}){const headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;if(farm)headers['x-farm-id']=farm;const res=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const raw=await res.text();let json;try{json=JSON.parse(raw)}catch{json=raw}return{status:res.status,json,headers:res.headers}}
async function main(){
 let ready=false;for(let i=0;i<60;i++){if(child.exitCode!==null)throw new Error(`server exited:\n${logs}`);try{const r=await fetch(base+'/api/health');if(r.status<500){ready=true;break}}catch{}await sleep(500)}if(!ready)throw new Error(`server not ready:\n${logs}`);
 const login=await call('POST','/api/auth/login',{body:{username:'admin',password:'admin123'}}),token=login.json?.token;
 check(login.status===200&&!!token,'Flock memory-mode owner login');if(!token)throw new Error(JSON.stringify(login.json));
 const farms=await call('GET','/api/farms',{token});const farmA=farms.json?.farms?.[0];check(!!farmA?.id,'Flock default farm exists');if(!farmA?.id)throw new Error(JSON.stringify(farms.json));
 const created=await call('POST','/api/farms',{token,body:{name:'Flock Archive Check Farm B',location:'test'}}),farmB=created.json;check(created.status===201&&!!farmB?.id,'Flock second farm created');if(!farmB?.id)throw new Error(JSON.stringify(created.json));
 async function makeLog(farm,tag,quantity,rate){const batch=await call('POST','/api/batches',{token,farm: farm.id,body:{name:'Archive '+tag,type:'Broiler',start_date:'2009-01-01',intake_count:10,cost_per_bird:5}});if(batch.status!==201)throw new Error('batch fixture failed '+JSON.stringify(batch.json));const id=batch.json.batch.batch_id;const log=await call('POST',`/api/batches/${id}/feed-logs`,{token,farm:farm.id,body:{date:'2010-01-02',feed_type:'Archive '+tag,quantity_kg:quantity,rate_rs_per_kg:rate}});if(log.status!==201)throw new Error('feed fixture failed '+JSON.stringify(log.json));return{batchId:id,log:log.json.log};}
 const a=await makeLog(farmA,'A',4,7),b=await makeLog(farmB,'B',3,9);check(!!a.log?._id&&!!b.log?._id,'Flock feed-log fixtures created in two farms');
 const detailBefore=await call('GET',`/api/batches/${a.batchId}`,{token,farm:farmA.id});const totalBefore=detailBefore.json?.batch?.summary?.total_feed_cost;
 check(detailBefore.status===200&&detailBefore.json.feed_logs?.some(row=>row._id===a.log._id)&&totalBefore===28,'Flock active batch detail and feed-cost total include old log');
 const made=await call('POST','/api/archive/jobs',{token,body:{farmId:farmA.id,collection:'batchFeedLogs',retentionYears:1}}),job=made.json?.job;
 check(made.status===201&&job?.sourceCount>=1,'Flock feed-log snapshot created');if(!job?.id)throw new Error(JSON.stringify(made.json));
 const exported=await call('GET',`/api/archive/jobs/${job.id}/export?farmId=${encodeURIComponent(farmA.id)}`,{token});check(exported.status===200&&exported.json?.records?.some(row=>row._id===a.log._id),'Flock export preserves feed-log record');await sleep(100);
 const done=await call('POST',`/api/archive/jobs/${job.id}/execute`,{token,body:{farmId:farmA.id,confirmFarmName:farmA.name,confirmJobId:job.id}});
 check(done.status===200&&done.json?.state==='archived','Flock feed-log archive executes after export and confirmation');
 const detailAfter=await call('GET',`/api/batches/${a.batchId}`,{token,farm:farmA.id});const foreignDetail=await call('GET',`/api/batches/${b.batchId}`,{token,farm:farmB.id});
 check(detailAfter.status===200&&!detailAfter.json.feed_logs.some(row=>row._id===a.log._id),'Flock archived feed log leaves active batch list');
 check(detailAfter.json.batch.summary.total_feed_cost===0,'Flock batch feed-cost total excludes archived log');
 check(foreignDetail.status===200&&foreignDetail.json.feed_logs.some(row=>row._id===b.log._id)&&foreignDetail.json.batch.summary.total_feed_cost===27,'Flock archive preserves other farm list and totals');
 const restored=await call('POST',`/api/archive/jobs/${job.id}/restore`,{token,body:{farmId:farmA.id,confirmFarmName:farmA.name,confirmJobId:job.id}});
 check(restored.status===200&&restored.json?.state==='restored','Flock feed-log restoration succeeds');
 const detailRestored=await call('GET',`/api/batches/${a.batchId}`,{token,farm:farmA.id});
 check(detailRestored.json?.feed_logs?.some(row=>row._id===a.log._id)&&detailRestored.json?.batch?.summary?.total_feed_cost===28,'Flock list and feed-cost total return after restore');
}
main().catch(e=>{failures++;console.error(e.stack||e)}).finally(()=>{child.kill('SIGTERM');setTimeout(()=>process.exit(failures?1:0),50)});
