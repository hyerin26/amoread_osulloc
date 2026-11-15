"""AMOREAD v1.12 regression entrypoint.
Run from any working directory: python run_regression_v112.py
The three obsolete DOM-specific v1.6.2/v1.10 tests are functionally superseded
by test_v112_integration.py, which tests the same behavior in the new IA.
"""
from pathlib import Path
import subprocess,sys,os
D=Path(__file__).resolve().parent
# Keep native and historical feature checks; adapter changes only selectors, not app code.
NATIVE=['test_editor_kit_v112.py','test_editor_ui_kit_v112.py','test_v112_integration.py','test_v112_resize.py','test_block_quality_v112.py','test_settings_audit_v112.py','test_settings_matrix_v112.py','test_inspector_navigation_v112.py','test_linked_controls_v112.py','test_composition_interactions_v112.py']
HISTORIC=['test_v12.py','test_v15.py','test_v16.py','test_v17.py','test_v18.py','test_layout_v171.py','test_elements_v18.py','test_layout_conflicts_v1101.py','test_ia_v111.py']
FAILED=[]
for name in NATIVE+HISTORIC:
    cmd=([sys.executable,str(D/name)] if name in NATIVE else [sys.executable,str(D/'legacy_bridge_v112.py'),str(D/name)])
    print('\nTEST:',name,flush=True)
    try:
        r=subprocess.run(cmd,cwd=D,capture_output=True,text=True,timeout=90)
    except subprocess.TimeoutExpired:
        FAILED.append((name,'timeout > 45 seconds'));print('FAIL: timeout',flush=True);continue
    if r.returncode:
        FAILED.append((name,(r.stderr or r.stdout)[-1300:]));print('FAIL:',(r.stderr or r.stdout)[-600:],flush=True)
    else:
        print((r.stdout or '').strip().splitlines()[-1] if r.stdout.strip() else 'PASS',flush=True)
print('\nRESULT',len(NATIVE)+len(HISTORIC)-len(FAILED),'/',len(NATIVE)+len(HISTORIC),'passed',flush=True)
if FAILED:
    for name,reason in FAILED:print(name,reason,flush=True)
    sys.exit(1)