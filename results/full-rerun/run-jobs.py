import os,sys,json,time,subprocess,signal,pathlib
ROOT=pathlib.Path('/home/user/full-rerun'); REV='2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0'; group=sys.argv[1]
env=dict(os.environ); env.update({'DISABLE_INTERNAL_SCHEDULER':'1','TELEGRAM_BOT_TOKEN':'','SMTP_HOST':'','DAILY_SUMMARY_EMAILS':'','PYTHONUNBUFFERED':'1','PATH':'/home/user/rerun-tools/bin:'+env['PATH']})
if group=='checks':
 scripts=json.loads((ROOT/'package.json').read_text())['scripts']; jobs=[(k,['npm','run',k],240) for k in scripts if k.startswith('check-')]
 jobs += [('lint-agri',['npm','--prefix','agri_farm/frontend','run','lint'],180),('lint-flock',['npm','--prefix','flock_farm/client','run','lint'],180)]
elif group=='acceptance':
 jobs=[(p.stem,['node','--test',str(p.relative_to(ROOT))],420) for p in sorted((ROOT/'tests/acceptance').glob('*.test.mjs'))]
elif group=='historical':
 inv=json.loads((ROOT/'results/full-rerun/inventory.json').read_text())
 files=[f['path'] for f in inv['files'] if f['provenance']=='historical-recovered' and f['path'].endswith('.test.ts')]
 jobs=[('legacy-vitest',['node_modules/.bin/vitest','run','--maxWorkers=2',*files],1200)]
elif group=='round3':
 names=['phase1-dynamic','phase1b-prod-proxy-cards','phase1c-protocol-chaos-load','phase1d-followups','phase3-flock-cards-reverse','final-p1-rerun','fastcheck-commands','build-full-specs']
 jobs=[(n,['node',f'tests/round3/{n}.mjs'],360) for n in names]
 jobs += [('idor-'+a,['node','tests/round3/idor-authz-matrix.mjs',a],300) for a in ['dairy','agri','flock']]
 jobs += [('hypothesis-agri',['python','tests/round3/hypothesis_agri.py'],240)]
elif group=='verification':
 jobs=[('authz-'+a,['node','tests/verification/authz-matrix.mjs',a],300) for a in ['dairy','agri','flock']]
 jobs += [('contested',['bash','tests/verification/contested-probes.sh'],240),('load-locust',['bash','tests/verification/run-load.sh'],480)]
else: raise Exception(group)
statuses=[]
for name,args,limit in jobs:
 path=ROOT/f'results/full-rerun/{group}-{name}.txt'
 print('START',group,name,flush=True); t=time.time()
 with path.open('w') as log:
  log.write(REV+'\nCOMMAND '+json.dumps(args)+'\nCWD '+str(ROOT)+'\nENV: external tokens blank, internal scheduler disabled; per-test settings also apply.\n'); log.flush()
  p=subprocess.Popen(args,cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
  timeout=False
  try: code=p.wait(timeout=limit)
  except subprocess.TimeoutExpired:
   timeout=True; os.killpg(p.pid,signal.SIGKILL); code=p.wait()
  # Reap any orphan backend children from a failed legacy setup.
  try: os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError: pass
  log.write(f'\nRUNNER EXIT={code} TIMEOUT={timeout} SECONDS={time.time()-t:.2f}\n')
 statuses.append({'name':name,'args':args,'exit':code,'timeout':timeout,'seconds':round(time.time()-t,2),'log':str(path.relative_to(ROOT))})
 (ROOT/f'results/full-rerun/{group}-status.json').write_text(json.dumps({'revision':REV,'jobs':statuses},indent=2)+'\n')
 print('END',group,name,'exit',code,'timeout',timeout,flush=True)
