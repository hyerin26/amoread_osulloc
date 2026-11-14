"""Compatibility adapter for historical UI tests after v1.12 tab/menu reorganization.
Tests target preserved functionality through the new navigational location, not the old button DOM.
No editor source is changed by this adapter.
"""
from pathlib import Path
import sys,re
source_path=Path(sys.argv[1]);src=source_path.read_text('utf8')
# Include all v1.12 layout layers. Old tests used an earlier stylesheet list.
src=re.sub(r'(?m)^CSS\s*=\s*(\[[^\n]+\]|\([^\n]+\))$',
  "CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css','ia-v111.css','editor-ui-kit.css']",src)
# Inject the independent icon + scroll module before app.js (historic harnesses lack it).
src=src.replace("['catalog.js','components.js','flows.js','composable.js','app.js']","['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']")
src=src.replace("JS=['catalog.js'","JS=['editor-ui-kit.js','catalog.js'")
# Historic selectors refer to leaf tabs. v1.12 shows a single leaf as a subheading and routes through the group tab.
new_group={'check':'check','copy':'content','shape':'layout','items':'layout','review':'layout','event':'operation','refs':'handoff','notes':'handoff','media':'layout'}
for k,g in new_group.items():src=src.replace(f'[data-tab="{k}"]',f'[data-ia-group="{g}"]')
src=src.replace("page.locator('.cb-rail button').count()==2","page.locator('.cb-rail button').count()==3")
src=src.replace('page.locator(\'[data-cb-rail="library"]\').click()', "(page.locator('[data-cb-rail=\"library\"]').click(),page.locator('[data-ia-library=\"blocks\"]').click())")
# The new Add rail first opens a section/block choice; switch to block catalog for every test-page variable.
src=re.sub(r"(?<![\w])(\w+)\.locator\(\s*['\"]\[data-cb-rail=\"library\"\]['\"]\s*\)\.click\(\)",
   lambda m: "("+m.group(1)+".locator('[data-cb-rail=\"library\"]').click(),"+m.group(1)+".locator('[data-ia-library=\"blocks\"]').click())",src)
# Some tests select the block or result, which hides direct section type change.
src=src.replace("page.locator('[data-tab=\"products\"]').click()", "(page.locator('[data-ia-group=\"content\"]').click(),page.locator('[data-tab=\"products\"]').click())")
src=src.replace("page.locator('#changeLayout').click()", "(page.locator('[data-ia-parent=\"section\"]').click() if not page.locator('#changeLayout').is_visible() else None,page.locator('#changeLayout').click())")
# Older deep-card tests expect all detailed attributes visible; the new accordion defaults closed.
lines=[]
for line in src.splitlines():
 lines.append(line)
 if 'page.add_script_tag(content=' in line:
  indent=line[:len(line)-len(line.lstrip())]
  lines.append(indent+'page.evaluate("() => {const host=document.getElementById(\'panel-body\');if(!host||window.__legacyExpand)return;window.__legacyExpand=true;const expand=()=>host.querySelectorAll(\'details.ia-advanced\').forEach(e=>e.open=true);new MutationObserver(expand).observe(host,{childList:true,subtree:true});expand();}")')
  lines.append(indent+'page.set_default_timeout(3500)')
src='\n'.join(lines)
exec(compile(src,str(source_path),'exec'),{'__file__':str(source_path),'__name__':'__main__'})
