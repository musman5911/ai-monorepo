import {spawn,spawnSync} from 'node:child_process';
import {login} from '../acceptance/_harness.mjs';
import path from 'node:path';
const procs=[];const tokens={};const configs=[['dairy',3000,'dairy_farm/backend'],['agri',8000,'agri_farm/backend'],['flock',3001,'flock_farm/backend']];
try{
 for(const [app,port,dir] of configs){
  const p=spawn('node',['server.js'],{cwd:path.resolve(dir),env:{...process.env,PORT:String(port),NODE_ENV:'test',MEMORY_MODE:'1',MONGO_URI:'',MONGODB_URI:'',JWT_SECRET:'bruno'+'-local-fixture-secret',DISABLE_INTERNAL_SCHEDULER:'1',TELEGRAM_BOT_TOKEN:'',DAILY_SUMMARY_EMAILS:'',SMTP_HOST:''},stdio:'ignore'});procs.push(p);tokens[app]=await login(`http://127.0.0.1:${port}`,'admin','admin'+String(123),app);
 }
 const r=spawnSync('/home/user/rerun-extra-tools/node_modules/.bin/bru',['run','--env-var',`dairy_token=${tokens.dairy}`,'--env-var',`flock_token=${tokens.flock}`,'--reporter-json',path.resolve('results/full-rerun/bruno.json')],{cwd:path.resolve('tests/toolchain/bruno/farm-apis'),encoding:'utf8',timeout:90000});
 console.log(r.stdout);console.log(r.stderr);console.log('BRUNO_EXIT',r.status);process.exitCode=r.status||0;
}finally{for(const p of procs)p.kill('SIGKILL');}
