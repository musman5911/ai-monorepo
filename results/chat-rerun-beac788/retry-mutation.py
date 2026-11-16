import os,subprocess,pathlib,time
r=pathlib.Path('/home/user/ai-monorepo');out=r/'results/chat-rerun-beac788/mutation-farms-retry.txt'
args=['node_modules/.bin/stryker','run','tests/full-rerun/stryker-farms-retry.config.json']
with out.open('w') as f:
 f.write('beac7883922f44eca3b7b43f91fce53e994638a5\nRetry: exclude volatile Hypothesis cache and mutation sandboxes from test-only Stryker configuration. No application edit.\nCOMMAND '+repr(args)+'\n');f.flush()
 p=subprocess.run(args,cwd=r/'.cache/chat-rerun/source',stdout=f,stderr=f,timeout=600);f.write('\nEXIT='+str(p.returncode)+'\n')
