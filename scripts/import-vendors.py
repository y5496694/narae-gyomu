"""Freeze four user-owned GitHub source snapshots, without local runtime data."""
import hashlib,json,subprocess,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROJECTS=['narae_browser','narae_hangul','CBE_CLI','narae_gyomoo_portal']
TMP=Path('D:/Codex/tmp');TMP.mkdir(parents=True,exist_ok=True)
lock={'schema':1,'sources':[]}
for name in PROJECTS:
    repo=ROOT.parent/name
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo).decode().strip()
    remote=subprocess.check_output(['git','remote','get-url','origin'],cwd=repo).decode().strip()
    target=ROOT/'packages'/name
    if target.exists():raise SystemExit(f'Existing snapshot preserved: {target}')
    target.mkdir(parents=True)
    with tempfile.TemporaryDirectory(dir=TMP) as temp:
        archive=Path(temp)/'source.zip'
        subprocess.run(['git','archive','--format=zip','--output',str(archive),commit],cwd=repo,check=True)
        with zipfile.ZipFile(archive) as source:
            for item in source.infolist():
                dest=(target/item.filename).resolve()
                if not dest.is_relative_to(target.resolve()):raise ValueError(item.filename)
            source.extractall(target)
    files={p.relative_to(target).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(target.rglob('*')) if p.is_file()}
    lock['sources'].append({'name':name,'repository':remote.removesuffix('.git'),'commit':commit,'files':files})
    print(name,commit,len(files),flush=True)
(ROOT/'sources.lock.json').write_bytes((json.dumps(lock,ensure_ascii=False,indent=2)+'\n').encode())
