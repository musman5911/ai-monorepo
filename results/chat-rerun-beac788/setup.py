import pathlib,subprocess,os,time,json,signal,sys,zipfile
ROOT=pathlib.Path('/home/user/ai-monorepo');BASE=ROOT/'.cache/chat-rerun';APP=BASE/'source';OUT=ROOT/'results/chat-rerun-beac788';REV='beac7883922f44eca3b7b43f91fce53e994638a5'
mode=sys.argv[1];env={**os.environ,'TELEGRAM_BOT_TOKEN':'','SMTP_HOST':'','DAILY_SUMMARY_EMAILS':'','MONGO_URI':'','MONGODB_URI':'','DISABLE_INTERNAL_SCHEDULER':'1'}
if mode=='app':
 jobs=[('install-'+d.replace('/','-'),['npm','ci','--no-audit','--no-fund'],APP/d) for d in ['.','dairy_farm/backend','agri_farm/backend','flock_farm/backend','dairy_farm/client','agri_farm/frontend','flock_farm/client']]
 jobs += [('root-test-tools',['npm','install','--no-save','--package-lock=false','--no-audit','--no-fund','fast-check','autocannon','@stryker-mutator/core','@stryker-mutator/vitest-runner','@babel/parser','@babel/traverse'],APP)]
else:
 (BASE/'node-tools').mkdir(exist_ok=True);(BASE/'node-tools/package.json').write_text('{"private":true}')
 jobs=[('extra-node-tools',['npm','install','--no-audit','--no-fund','@usebruno/cli','eslint','eslint-plugin-security','eslint-plugin-no-unsanitized','knip','madge','depcheck'],BASE/'node-tools'),('python-venv',['python3','-m','venv',str(BASE/'python-tools')],ROOT),('python-tools',[str(BASE/'python-tools/bin/pip'),'install','schemathesis','hypothesis','requests','pyjwt','semgrep','locust','detect-secrets','njsscan'],ROOT)]
status=[]
for name,args,cwd in jobs:
 print('START',name,flush=True);f=(OUT/(name+'.txt')).open('w');f.write(REV+'\nCOMMAND '+json.dumps(args)+'\n');f.flush();p=subprocess.Popen(args,cwd=cwd,env=env,stdout=f,stderr=f,start_new_session=True)
 try:code=p.wait(timeout=600)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);code=p.wait()
 f.write(f'\nEXIT={code}\n');f.close();status.append({'name':name,'exit':code});(OUT/('setup-'+mode+'.json')).write_text(json.dumps(status,indent=2)+'\n');print('END',name,code,flush=True)
 if code:sys.exit(code)
if mode=='app':
 (APP/'tools-round3').mkdir(exist_ok=True);(APP/'tools-round3/node_modules').symlink_to(APP/'node_modules',target_is_directory=True)
