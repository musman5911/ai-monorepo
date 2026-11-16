import pathlib,subprocess,os,json
r=pathlib.Path('/home/user/ai-monorepo');a=r/'.cache/chat-rerun/latest';o=r/'results/chat-rerun-beac788'
for n in ['final-p1-rerun','phase1b-prod-proxy-cards']:
 with (o/('latest-'+n+'.txt')).open('w') as f:
  f.write('d09ac50e9444b35311197914d562788025fe1d17\nCOMMAND node tests/round3/'+n+'.mjs\nLatest-tip narrow follow-up; docs-only upstream movement, not a comprehensive latest-tip rerun. Historical P1 labels are not endorsed production severities.\n');f.flush()
  p=subprocess.run(['node','tests/round3/'+n+'.mjs'],cwd=a,stdout=f,stderr=f,env={**os.environ,'TELEGRAM_BOT_TOKEN':'','MONGO_URI':'','MONGODB_URI':'','DISABLE_INTERNAL_SCHEDULER':'1'},timeout=240);f.write('\nEXIT='+str(p.returncode)+'\n')
