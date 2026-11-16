import pathlib,subprocess,os,json,time,signal,zipfile,hashlib
ROOT=pathlib.Path('/home/user/ai-monorepo');APP=ROOT/'.phase19-test';OUT=ROOT/'results/phase19-6e55726';REV='6e55726de41a3c7f6a70424aaaf5f94c69b2a881'
env={**os.environ,'DISABLE_INTERNAL_SCHEDULER':'1','TELEGRAM_BOT_TOKEN':'','SMTP_HOST':'','DAILY_SUMMARY_EMAILS':'','MONGO_URI':'','MONGODB_URI':''}
# Reuse the previously corrected test fixtures, never application fixes.
zpath=ROOT/'evidence/evidence-full-rerun-2ddf5bc.zip'
if zpath.exists():
 with zipfile.ZipFile(zpath) as z:
  for f in ['tests/acceptance/_harness.mjs','tests/acceptance/photos.test.mjs']:
   (APP/f).write_bytes(z.read(f))
 (OUT/'harness-note.txt').write_text(REV+'\nReused corrected readiness and multipart Flock photo fixtures from the prior evidence pack. Assertions unchanged.\n')
jobs=[]
for d in ['.','dairy_farm/backend','agri_farm/backend','flock_farm/backend','dairy_farm/client','agri_farm/frontend','flock_farm/client']:
 jobs.append(('install-'+d.replace('/','-'),['npm','ci','--no-audit','--no-fund'],APP/d,300))
jobs.append(('upstream-tests',['npm','test','--','--maxWorkers=2'],APP,600))
for d in ['dairy_farm/client','agri_farm/frontend','flock_farm/client']:
 jobs.append(('build-'+d.split('/')[0],['npm','run','build'],APP/d,300))
scripts=json.loads((APP/'package.json').read_text())['scripts']
for name in scripts:
 if name.startswith('check-') and name!='check-secrets':jobs.append((name,['npm','run',name],APP,300))
# Isolated index makes Git-dependent secret check inspect exactly the tested revision without changing the user index.
idx=OUT/'source.index';genv={**env,'GIT_DIR':str(ROOT/'.git'),'GIT_INDEX_FILE':str(idx),'GIT_WORK_TREE':str(APP)}
subprocess.run(['git','read-tree',REV],cwd=ROOT,env=genv,check=True)
jobs.append(('check-secrets',['npm','run','check-secrets'],APP,120))
files=sorted(str(p.relative_to(APP)) for folder in ['acceptance','acceptance-business'] for p in (APP/'tests'/folder).glob('*.test.mjs'))
jobs.append(('historical-acceptance',['node','--test','--test-concurrency=1',*files],APP,600))
statuses=[]
for name,args,cwd,timeout in jobs:
 print('START',name,flush=True);start=time.time()
 with (OUT/(name+'.txt')).open('w') as f:
  f.write(REV+'\nCOMMAND '+json.dumps(args)+'\nCWD '+str(cwd)+'\n');f.flush()
  p=subprocess.Popen(args,cwd=cwd,env=genv if name=='check-secrets' else env,stdout=f,stderr=f,start_new_session=True)
  timed=False
  try:code=p.wait(timeout=timeout)
  except subprocess.TimeoutExpired:timed=True;os.killpg(p.pid,signal.SIGKILL);code=p.wait()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  f.write(f'\nEXIT={code} TIMEOUT={timed}\n')
 statuses.append({'name':name,'exit':code,'timeout':timed,'seconds':round(time.time()-start,2)})
 (OUT/'status.json').write_text(json.dumps({'revision':REV,'jobs':statuses},indent=2)+'\n');print('END',name,code,flush=True)
# Compare application files to exact Git objects after all checks.
changed=[];total=0
for line in subprocess.check_output(['git','ls-tree','-r',REV],cwd=ROOT,text=True).splitlines():
 meta,name=line.split('\t',1);total+=1;p=APP/name
 if not p.is_file():changed.append(name);continue
 b=p.read_bytes();h=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 if h!=meta.split()[2]:changed.append(name)
(OUT/'source-integrity.json').write_text(json.dumps({'revision':REV,'tracked_files':total,'changed':changed},indent=2)+'\n')
print('FINISHED; source changes:',changed,flush=True)
