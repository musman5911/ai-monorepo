import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const revision='2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0';
const root='/home/user/full-rerun';
const inv=JSON.parse(readFileSync(`${root}/results/full-rerun/inventory.json`));
const files=inv.files.filter(x=>x.provenance==='latest-upstream' && x.path.endsWith('.test.ts')).map(x=>x.path);
const jobs=[
 {name:'upstream-vitest',cwd:root,cmd:'node_modules/.bin/vitest',args:['run','--maxWorkers=2',...files]},
 ...['dairy_farm/client','agri_farm/frontend','flock_farm/client'].map(d=>({name:`build-${d.split('/')[0]}`,cwd:`${root}/${d}`,cmd:'npm',args:['run','build']})),
 {name:'business-acceptance',cwd:root,cmd:'node',args:['--test','--test-concurrency=1',...inv.files.filter(x=>x.path.startsWith('tests/acceptance-business/')&&x.path.endsWith('.test.mjs')).map(x=>x.path)]},
];
const status=[];
for(const j of jobs){
 const log=`${root}/results/full-rerun/${j.name}.txt`;
 writeFileSync(log,`${revision}\nCOMMAND ${j.cmd} ${j.args.join(' ')}\nCWD ${j.cwd}\n`);
 console.log(`START ${j.name}`);
 const fd=openSync(log,'a');
 const r=spawnSync(j.cmd,j.args,{cwd:j.cwd,env:{...process.env,TELEGRAM_BOT_TOKEN:'',SMTP_HOST:'',DISABLE_INTERNAL_SCHEDULER:'1'},stdio:['ignore',fd,fd],timeout:900000});
 closeSync(fd);
 status.push({name:j.name,exit:r.status,signal:r.signal,error:r.error?.message,log});
 writeFileSync(`${root}/results/full-rerun/first-wave-status.json`,JSON.stringify({revision,status},null,2));
 console.log(`END ${j.name} exit=${r.status} ${r.error?.message||''}`);
}
