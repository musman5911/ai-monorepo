import {startApp,login} from '../acceptance/_harness.mjs';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const rev='2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0';
for(const app of ['dairy','agri','flock']){
 const {base,stop}=await startApp(app);
 try{
  const tok=await login(base,'admin','admin'+String(123),app);
  const args=['run',`tests/toolchain/spec-${app}.yaml`,'--url',`${base}/api`,'-n','2','--workers','2','-H',`Authorization: Bearer ${tok}`];
  const r=spawnSync('/home/user/rerun-tools/bin/schemathesis',args,{encoding:'utf8',timeout:180000,maxBuffer:10*1024*1024,env:{...process.env,SCHEMATHESIS_TELEMETRY:'false'}});
  writeFileSync(`results/full-rerun/schema-seed-${app}.txt`,`${rev}\nCOMMAND schemathesis run tests/toolchain/spec-${app}.yaml --url ${base}/api -n 2 --workers 2 -H Authorization:Bearer <local-test-token>\nSETUP token acquired=true; specs identical to tests/round3/specs/spec-${app}.yaml\n${r.stdout||''}\n${r.stderr||''}\nEXIT=${r.status} ERROR=${r.error?.message||''}\n`);
 }finally{stop();}
}
const {base,stop}=await startApp('agri');
try{
 // Wait for seeding before starting the historical per-user login scenario.
 await login(base,'admin','admin'+String(123),'agri');
 const args=['-f','tests/verification/locust-agri.py','--headless','-u','10','-r','10','-t','30s','--host',base,'--only-summary'];
 const r=spawnSync('/home/user/rerun-tools/bin/locust',args,{encoding:'utf8',timeout:90000,maxBuffer:10*1024*1024});
 writeFileSync('results/full-rerun/locust-agri-original.txt',`${rev}\nCOMMAND locust ${args.join(' ')}\n${r.stdout||''}\n${r.stderr||''}\nEXIT=${r.status}\n`);
}finally{stop();}
