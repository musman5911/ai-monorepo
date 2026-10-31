import pathlib,subprocess,os,signal,time,json
root=pathlib.Path('/home/user/full-rerun'); rev='2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0'; bin='/home/user/rerun-extra-tools/node_modules/.bin/'
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',rev],cwd='/home/user/ai-monorepo',text=True).splitlines()
src=[f for f in tracked if f.endswith(('.js','.mjs','.ts','.tsx')) and f.startswith(('dairy_farm/','agri_farm/','flock_farm/','shared/'))]
backend=[f for f in src if '/backend/' in f]
jobs=[('eslint-security',[bin+'eslint','--config','tests/full-rerun/eslint.config.mjs','--format','json','--output-file','results/full-rerun/eslint.json',*backend],180),('knip',[bin+'knip','--no-progress'],180)]
for app in ['dairy_farm/backend','agri_farm/backend','flock_farm/backend']:
 jobs += [('madge-'+app.split('/')[0],[bin+'madge','--circular',app],90),('depcheck-'+app.split('/')[0],[bin+'depcheck',app],90)]
env={**os.environ,'PATH':'/home/user/rerun-tools/bin:'+os.environ['PATH'],'SEMGREP_SEND_METRICS':'off','SEMGREP_ENABLE_VERSION_CHECK':'0'}
jobs += [('semgrep-bounded',['semgrep','scan','--metrics=off','--disable-version-check','--jobs','2','--timeout','2','--timeout-threshold','1','--config','tests/round3/semgrep-custom.yaml','--config','tests/verification/semgrep-rules.yml','--json','--output','results/full-rerun/semgrep-bounded.json',*src],180),('detect-secrets-source',['detect-secrets','scan','--all-files',*src],120)]
statuses=[]
for name,args,timeout in jobs:
 print('START',name,flush=True)
 with (root/f'results/full-rerun/extra-{name}.txt').open('w') as f:
  f.write(rev+'\nCOMMAND '+json.dumps(args)+'\n');f.flush();p=subprocess.Popen(args,cwd=root,env=env,stdout=f,stderr=f,start_new_session=True)
  timed=False
  try:code=p.wait(timeout=timeout)
  except subprocess.TimeoutExpired:timed=True;os.killpg(p.pid,signal.SIGKILL);code=p.wait()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  f.write(f'\nEXIT={code} TIMEOUT={timed}\n')
 statuses.append({'name':name,'exit':code,'timeout':timed});(root/'results/full-rerun/extra-status.json').write_text(json.dumps(statuses,indent=2)+'\n');print('END',name,code,flush=True)
