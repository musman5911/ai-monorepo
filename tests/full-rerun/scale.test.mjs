import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import path from 'node:path';
import {once} from 'node:events';
import {login} from '../acceptance/_harness.mjs';
const root=process.cwd();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function fixture(app,port,fn){
 const dir=path.join(root,app==='agri'?'agri_farm/backend':'dairy_farm/backend');
 const p=fork('tests/full-rerun/scale-server.mjs',[],{cwd:root,env:{...process.env,RERUN_BACKEND_DIR:dir,PORT:String(port),MEMORY_MODE:'1',NODE_ENV:'test',MONGO_URI:'',MONGODB_URI:'',JWT_SECRET:'rerun'+'-local-fixture-secret-only',DISABLE_INTERNAL_SCHEDULER:'1',TELEGRAM_BOT_TOKEN:'',SMTP_HOST:'',DAILY_SUMMARY_EMAILS:''},stdio:['ignore','ignore','pipe','ipc']});
 let errors='';p.stderr.on('data',x=>errors+=x);
 const base=`http://127.0.0.1:${port}`;
 try {
  let ready=false;
  for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/farms'); if(r.status===401||r.ok){ready=true;break}}catch{} await delay(200)}
  assert.ok(ready,`setup readiness ${errors}`);
  const token=await login(base,'admin','admin'+String(123),app);
  const api=async(route,method='GET',body)=>{const start=performance.now(); const response=await fetch(base+'/api'+route,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}); const text=await response.text();let data;try{data=JSON.parse(text)}catch{}; console.log(JSON.stringify({app,route,method,status:response.status,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(text)})); assert.ok(response.ok,`setup/request ${route} ${response.status} ${text.slice(0,120)}`);return {response,data};};
  const farms=(await api('/farms')).data;const rows=Array.isArray(farms)?farms:farms.farms||farms.items;const farm=rows[0];assert.ok(farm,'setup farm');
  const seed=async spec=>{const response=once(p,'message');p.send({...spec,farmId:String(farm._id||farm.id)});const [m]=await response;console.log(JSON.stringify({app,fixture:m}));assert.ok(m.ok,m.error);};
  await fn({api,seed});
 }finally{p.kill('SIGKILL');await once(p,'exit').catch(()=>{});}
}
test('NEW-SCALE-1: 50k milk records over three years retain penny precision and untruncated summary', {timeout:120000},async()=>{
 await fixture('dairy',23101,async({api,seed})=>{
  const cow=(await api('/cows','POST',{name:'Scale fixture',breed:'Jersey',gender:'female',status:'active'})).data;
  const buyer=(await api('/buyers','POST',{name:'Scale buyer',defaultRate:100})).data;
  await seed({model:'Milk',count:50000,cowId:cow._id,buyerId:buyer._id});
  const {data}=await api(`/milk/summary?cowId=${cow._id}`);
  // Independent integer arithmetic: each row = 30 centilitres, Rs 30.
  console.log(JSON.stringify({expected:{count:50000,liters:15000,revenue:1500000},actual:data}));
  assert.equal(data.count,50000);assert.equal(data.saleableLiters,15000);assert.equal(data.revenue,1500000);
  const page=await api(`/milk?cowId=${cow._id}&page=1&limit=100`);assert.equal(page.response.headers.get('x-total-count'),'50000');assert.equal(page.data.length,100);
  const backup=(await api('/backup')).data;assert.equal(backup.milk.filter(x=>x.cowId===cow._id).length,50000);
 });
});
for (const mode of ['analytics','backup']) {
 test(mode==='analytics'?'NEW-SCALE-2: 100k finance records preserve analytics totals':'BL-5 NEW-SCALE-3: full backup retains all finance rows beyond 100000 total', {timeout:120000},async()=>{
  await fixture('agri',23102,async({api,seed})=>{
   const before=(await api('/analytics/summary')).data.financeSummary.totals;
   await seed({model:'Finance',count:100000});
   const after=(await api('/analytics/summary')).data.financeSummary.totals;
   console.log(JSON.stringify({before,after,expectedDelta:{entries:100000,income:500,expense:500,net:0}}));
   if(mode==='analytics') {
    assert.equal(after.entries-before.entries,100000);
    assert.ok(Math.abs((after.income-before.income)-500)<0.005);
    assert.ok(Math.abs((after.expense-before.expense)-500)<0.005);
    assert.ok(Math.abs(after.net-before.net)<0.005);
   } else {
    assert.equal(after.entries-before.entries,100000,'setup: inserted finance count');
    const backup=(await api('/backup')).data;const rows=backup.finance;
    assert.ok(Array.isArray(rows),'setup: backup finance rows');
    const actual=rows.filter(x=>String(x._id).startsWith('scale-f-')).length;
    console.log(JSON.stringify({backupTotal:rows.length,expectedTotal:before.entries+100000,expectedFixture:100000,actualFixture:actual}));
    assert.equal(actual,100000,'BL-5: backup silently truncated finance fixture rows');
   }
  });
 });
}
