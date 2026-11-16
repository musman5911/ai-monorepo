import pathlib,json,subprocess,hashlib
ROOT=pathlib.Path('/home/user/ai-monorepo');BASE=ROOT/'.cache/chat-rerun';APP=BASE/'source';OUT=ROOT/'results/chat-rerun-beac788';REV='beac7883922f44eca3b7b43f91fce53e994638a5'
changes=[]
for p in list((APP/'tests/round3').glob('*.mjs'))+list((APP/'tests/round3').glob('*.py'))+list((APP/'tests/full-rerun').glob('*.mjs')):
 old=p.read_text();s=old.replace('2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0',REV).replace('/home/user/full-rerun',str(APP)).replace('/home/user/rerun-tools',str(BASE/'python-tools')).replace('/home/user/rerun-extra-tools',str(BASE/'node-tools'))
 if s!=old:p.write_text(s);changes.append({'path':str(p.relative_to(APP)),'reason':'Relocate isolated test/tool paths and recorded revision; no application changes','before':hashlib.sha256(old.encode()).hexdigest()})
# Pure report configuration output stays inside this isolated source's results directory.
for d in ['results/full-rerun','results/round3','results/load']:(APP/d).mkdir(parents=True,exist_ok=True)
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',REV],cwd=ROOT,text=True).splitlines();owned=[f for f in tracked if f.startswith('tests/') and f.endswith('.test.ts')];legacy=[str(p.relative_to(APP)) for p in (APP/'tests').rglob('*.test.ts') if str(p.relative_to(APP)) not in tracked]
(OUT/'selection.json').write_text(json.dumps({'revision':REV,'upstream':owned,'historical':sorted(legacy)},indent=2)+'\n');(OUT/'adaptations.json').write_text(json.dumps(changes,indent=2)+'\n')
# Existing Git metadata, isolated index, exact tested tree: safe for git-ls-files source guard.
env=__import__('os').environ.copy();env.update(GIT_DIR=str(ROOT/'.git'),GIT_INDEX_FILE=str(OUT/'source.index'),GIT_WORK_TREE=str(APP));subprocess.run(['git','read-tree',REV],env=env,cwd=ROOT,check=True)
print('Selected upstream:',len(owned),'historical:',len(legacy),'test files')
