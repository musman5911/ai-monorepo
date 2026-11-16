import pathlib,subprocess,os,json
R=pathlib.Path('/home/user/ai-monorepo');A=R/'.cache/chat-rerun/source';O=R/'results/chat-rerun-beac788';rev='beac7883922f44eca3b7b43f91fce53e994638a5'
from datetime import datetime,timezone,timedelta
yesterday=(datetime.now(timezone.utc)+timedelta(hours=5)-timedelta(days=1)).strftime('%Y-%m-%d')
jobs=[('cookies-isolated',['node_modules/.bin/vitest','run','--maxWorkers=1','--testTimeout=30000','tests/api-deep/timing-reset-auto-deep.test.ts','-t','session cookie'],{}),('business-seed-date-retry',['node','--test','tests/full-rerun/business-probes.test.mjs'],{'MUF_SEED_TODAY':yesterday})]
for n,args,extra in jobs:
 with (O/(n+'.txt')).open('w') as f:
  f.write(rev+'\nCOMMAND '+json.dumps(args)+'\nEXTRA_ENV '+json.dumps(extra)+'\nOriginal business setup assumed seed rate older than yesterday. Retry uses documented seed-date environment, no application edits.\n');f.flush()
  p=subprocess.run(args,cwd=A,env={**os.environ,'MONGO_URI':'','MONGODB_URI':'','TELEGRAM_BOT_TOKEN':'','DISABLE_INTERNAL_SCHEDULER':'1',**extra},stdout=f,stderr=f,timeout=180);f.write('\nEXIT='+str(p.returncode)+'\n')
