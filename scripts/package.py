"""Build a dependency-free XPI with an explicit runtime-file allowlist."""
from pathlib import Path
import hashlib,json,sys,zipfile
root=Path(__file__).resolve().parent.parent
output=Path(sys.argv[1]) if len(sys.argv)>1 else root/'dist'/'ZoteroResearchActivity.xpi'
output.parent.mkdir(parents=True,exist_ok=True)
files=['manifest.json','bootstrap.js','readTracker.js','heatmapBuilder.js','activityModel.js','activityRuntime.js','activity.html','activity.css','activityView.js','LICENSE']
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
 for name in files:
  data=(root/name).read_bytes()
  if name=='activity.html':
   html=data.decode()
   for asset in ['activity.css','activityView.js']:
    digest=hashlib.sha256((root/asset).read_bytes()).hexdigest()[:12]
    html=html.replace('"'+asset+'"','"'+asset+'?v='+digest+'"')
   data=html.encode()
  info=zipfile.ZipInfo(name,(2026,1,1,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED
  archive.writestr(info,data)
with zipfile.ZipFile(output) as archive:
 assert archive.testzip() is None
 assert set(archive.namelist())==set(files)
 html=archive.read('activity.html').decode()
 for asset in ['activity.css','activityView.js']:
  digest=hashlib.sha256(archive.read(asset)).hexdigest()[:12]
  assert asset+'?v='+digest in html, 'Missing asset cache key: '+asset
 manifest=json.loads(archive.read('manifest.json'))
 assert manifest['applications']['zotero']['id']=='research-activity@kimyeonghyeon'
print(output.resolve())
