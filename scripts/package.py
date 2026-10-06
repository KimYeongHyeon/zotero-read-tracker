"""Build a dependency-free XPI with an explicit runtime-file allowlist."""
from pathlib import Path
import json,sys,zipfile
root=Path(__file__).resolve().parent.parent
output=Path(sys.argv[1]) if len(sys.argv)>1 else root/'dist'/'ZoteroResearchActivity.xpi'
output.parent.mkdir(parents=True,exist_ok=True)
files=['manifest.json','bootstrap.js','readTracker.js','heatmapBuilder.js','activityModel.js','activityRuntime.js','activity.html','activity.css','activityView.js','LICENSE']
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
 for name in files:archive.write(root/name,name)
with zipfile.ZipFile(output) as archive:
 assert archive.testzip() is None
 assert set(archive.namelist())==set(files)
 manifest=json.loads(archive.read('manifest.json'))
 assert manifest['applications']['zotero']['id']=='research-activity@kimyeonghyeon'
print(output.resolve())
