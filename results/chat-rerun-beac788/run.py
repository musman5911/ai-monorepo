import pathlib,subprocess,os,signal,time,json,sys
ROOT=pathlib.Path('/home/user/ai-monorepo');BASE=ROOT/'.cache/chat-rerun';APP=BASE/'source';OUT=ROOT/'results/chat-rerun-beac788';REV='beac7883922f44eca3b7b43f91fce53e994638a5';group=sys.argv[1]
env={**os.environ,'PATH':str(BASE/'python-tools/bin')+':'+str(BASE/'node-tools/node_modules/.bin')+':'+os.environ['PATH'],'TELEGRAM_BOT_TOKEN':'','SMTP_HOST':'','DAILY_SUMMARY_EMAILS':'','MONGO_URI':'','MONGODB_URI':'','DISABLE_INTERNAL_SCHEDULER':'1','SEMGREP_SEND_METRICS':'off','SEMGREP_ENABLE_VERSION_CHECK':'0','SCHEMATHESIS_TELEMETRY':'false','PYTHONUNBUFFERED':'1'}
sel=json.loads((OUT/'selection.json').read_text());vitest=['node_modules/.bin/vitest','run','--maxWorkers=1','--testTimeout=30000'];jobs=[]
def job(name,args,timeout=300):jobs.append((name,args,timeout))
if group=='core':
 job('upstream',vitest+['--reporter=json','--outputFile='+str(OUT/'upstream.json'),*sel['upstream']],600)
 for d in ['dairy_farm/client','agri_farm/frontend','flock_farm/client']:job('build-'+d.split('/')[0],['npm','--prefix',d,'run','build'])
 for k in json.loads((APP/'package.json').read_text())['scripts']:
  if k.startswith('check-'):job(k,['npm','run',k])
 for d in ['agri_farm/frontend','flock_farm/client']:job('lint-'+d.split('/')[0],['npm','--prefix',d,'run','lint'])
 files=sorted(str(p.relative_to(APP)) for folder in ['acceptance','acceptance-business'] for p in (APP/'tests'/folder).glob('*.test.mjs'))
 job('acceptance-business',['node','--test','--test-concurrency=1',*files],600)
 job('new-manager',['node','--test','tests/chat-rerun-beac788/manager-boundary.test.mjs'],180)
 job('scale',['node','--test','--test-concurrency=1','tests/full-rerun/scale.test.mjs'],180)
 job('shop-and-business-probes',['node','--test','tests/full-rerun/latest-surface.test.mjs','tests/full-rerun/business-probes.test.mjs'],180)
elif group=='legacy':job('all-historical',vitest+['--reporter=json','--outputFile='+str(OUT/'legacy.json'),*sel['historical']],1200)
elif group=='schema':
 job('regenerate-full-specs',['node','tests/round3/build-full-specs.mjs'])
 job('full-nine-roles',['node','tests/round3/run-schemathesis-full.mjs'],1500)
 job('seed-specs-and-original-agri-load',['node','tests/full-rerun/seed-schema-load.mjs'],600)
elif group=='mutation':
 for f in ['stryker.config.json','stryker-farms.config.json']:job(f,['node_modules/.bin/stryker','run','tests/full-rerun/'+f],600)
elif group=='probes':
 for n in ['phase1-dynamic','phase1b-prod-proxy-cards','phase1c-protocol-chaos-load','phase1d-followups','phase3-flock-cards-reverse','final-p1-rerun','fastcheck-commands']:job(n,['node','tests/round3/'+n+'.mjs'],360)
 for script in ['tests/round3/idor-authz-matrix.mjs','tests/verification/authz-matrix.mjs']:
  for app in ['dairy','agri','flock']:job(pathlib.Path(script).stem+'-'+app,['node',script,app],300)
 job('hypothesis',['python','tests/round3/hypothesis_agri.py'])
 job('contested-curl',['bash','tests/verification/contested-probes.sh'])
 job('load-nine',['bash','tests/verification/run-load.sh'],480)
 job('bruno',['node','tests/full-rerun/bruno-smoke.mjs'])
elif group=='static':
 tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',REV],cwd=ROOT,text=True).splitlines();src=[f for f in tracked if f.endswith(('.js','.mjs','.ts','.tsx')) and f.startswith(('dairy_farm/','agri_farm/','flock_farm/','shared/'))];back=[f for f in src if '/backend/' in f]
 job('eslint',['eslint','--config','tests/full-rerun/eslint.config.mjs','--format','json','--output-file',str(OUT/'eslint.json'),*back],180);job('knip',['knip','--no-progress'],120)
 for d in ['dairy_farm/backend','agri_farm/backend','flock_farm/backend']:
  job('madge-'+d.split('/')[0],['madge','--circular',d],90);job('depcheck-'+d.split('/')[0],['depcheck',d],90)
 job('semgrep',['semgrep','scan','--metrics=off','--disable-version-check','--jobs','2','--timeout','2','--timeout-threshold','1','--config','tests/round3/semgrep-custom.yaml','--config','tests/verification/semgrep-rules.yml','--json','--output',str(OUT/'semgrep.json'),*src],240)
 job('detect-secrets',['detect-secrets','scan','--all-files','--no-verify',*src],120)
 job('njsscan',['njsscan','--json','-o',str(OUT/'njsscan.json'),*back],240)
else:raise Exception(group)
status=[]
for name,args,limit in jobs:
 print('START',group,name,flush=True);start=time.time();timed=False
 e=env.copy()
 if name=='check-secrets':e.update(GIT_DIR=str(ROOT/'.git'),GIT_INDEX_FILE=str(OUT/'source.index'),GIT_WORK_TREE=str(APP))
 with (OUT/(group+'-'+name+'.txt')).open('w') as f:
  f.write(REV+'\nCOMMAND '+json.dumps(args)+'\nCWD '+str(APP)+'\nEnvironment: direct localhost/test-memory unless script explicitly labels production/proxy; no real service tokens.\n');f.flush();p=subprocess.Popen(args,cwd=APP,env=e,stdout=f,stderr=f,start_new_session=True)
  try:code=p.wait(timeout=limit)
  except subprocess.TimeoutExpired:timed=True;os.killpg(p.pid,signal.SIGKILL);code=p.wait()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  f.write(f'\nEXIT={code} TIMEOUT={timed} SECONDS={time.time()-start:.2f}\n')
 status.append({'name':name,'args':args,'exit':code,'timeout':timed,'seconds':round(time.time()-start,2)});(OUT/(group+'-status.json')).write_text(json.dumps({'revision':REV,'jobs':status},indent=2)+'\n');print('END',group,name,code,flush=True)
