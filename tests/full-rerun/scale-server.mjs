// Test-only IPC fixture injector. No app files are edited; local memory only.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=process.env.RERUN_BACKEND_DIR;
await import(pathToFileURL(path.join(dir,'server.js')));
process.on('message',async message=>{
 try {
  const db=await import(pathToFileURL(path.join(dir,'db.js')));
  const Model=db[message.model];
  if(!Model || process.env.MEMORY_MODE!=='1') throw Error('fixture model unavailable / not memory mode');
  const before=process.memoryUsage().rss;
  const start=performance.now();
  const records=[];
  for(let i=0;i<message.count;i++) {
   const date=new Date(Date.UTC(2023,0,1+(i%1096))).toISOString().slice(0,10);
   records.push(message.model==='Milk'
    ? {_id:`scale-m-${i}`,farmId:message.farmId,cowId:message.cowId,buyerId:message.buyerId,date,morning:0.1,evening:0.2,calfMilk:0}
    : {_id:`scale-f-${i}`,farmId:message.farmId,date,type:i%2?'expense':'income',amount:0.01,category:'scale',description:'independent penny fixture'});
  }
  await Model.insertMany(records);
  process.send({ok:true,count:records.length,insertMs:performance.now()-start,rssBefore:before,rssAfter:process.memoryUsage().rss});
 } catch(e) {process.send({ok:false,error:e.stack});}
});
