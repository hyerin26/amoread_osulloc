"""Run original v1.2-v1.10.1 regression scenarios through v1.11 UI navigation adapter."""
from pathlib import Path
import subprocess,sys
D=Path(__file__).resolve().parent
names=['test_v12.py','test_v15.py','test_v16.py','test_v17.py','test_v18.py','test_layout_v171.py','test_elements_v18.py','test_resize_v19.py','test_media_layout_v110.py','test_layout_conflicts_v1101.py','test_storage_v16.py']
failures=[]
for name in (sys.argv[1:] or names):
 try:r=subprocess.run([sys.executable,str(D/'legacy_bridge_v111.py'),str(D/name)],capture_output=True,text=True,timeout=55)
 except subprocess.TimeoutExpired:failures.append(name);print('TIMEOUT',name,flush=True);continue
 print(('PASS' if r.returncode==0 else 'FAIL'),name,flush=True)
 if r.returncode:failures.append(name);print((r.stdout+'\n'+r.stderr)[-2100:],flush=True)
if failures:sys.exit(1)
