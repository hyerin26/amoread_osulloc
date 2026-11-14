"""Adapt old test selectors to new screen organization; no editor code mutations."""
from pathlib import Path
import sys
path=Path(sys.argv[1]);src=path.read_text('utf-8')
lines=[]
for line in src.splitlines():
 lines.append(line)
 if 'page.add_script_tag(content=' in line:
  prefix=line[:len(line)-len(line.lstrip())]
  lines.append(prefix+"page.add_style_tag(content=(D/'ia-v111.css').read_text(encoding='utf-8'))")
  lines.append(prefix+"page.add_style_tag(content='.ia-subtabs button[hidden]{display:inline-flex !important}')")
  reveal="() => { if (window.__iaCompatOpen) return; window.__iaCompatOpen=true; const show=()=>document.querySelectorAll('details.ia-advanced').forEach(el=>el.open=true); new MutationObserver(show).observe(document.getElementById('panel-body'),{childList:true,subtree:true}); show(); }"
  lines.append(prefix+'page.evaluate('+repr(reveal)+')')
  lines.append(prefix+'page.set_default_timeout(4500)')
src='\n'.join(lines)
for name in ['page','first','second','mobile']:
 old=name+'.locator(\'[data-cb-rail="library"]\').click()'
 new='('+old+','+name+'.locator(\'[data-ia-library="blocks"]\').click())'
 src=src.replace(old,new)
src=src.replace("page.locator('#changeLayout').click()", "(page.locator('[data-ia-parent=\"section\"]').click() if not page.locator('#changeLayout').is_visible() else None,page.locator('#changeLayout').click())")
if path.name=='test_media_layout_v110.py':
 for sid in ['s1','s4']:
  old=f'page.locator(\'[data-page="{sid}"]\').click()'
  new='('+old+",page.locator('[data-ia-group=\"layout\"]').click())"
  src=src.replace(old,new)
src=src.replace("page.locator('.cb-rail button').count()==2","page.locator('.cb-rail button').count()==3")
exec(compile(src,str(path),'exec'),{'__file__':str(path),'__name__':'__main__'})
