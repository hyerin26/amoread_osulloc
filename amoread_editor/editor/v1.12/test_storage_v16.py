"""Browser reload-equivalent storage regression without network access.

The tool environment blocks real http/file navigation. This test mounts the actual
app twice in independent pages with the same localStorage snapshot, verifying that
section/block data survives serialization and startup restoration. It does not
claim to validate browser origin storage permissions.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

D=Path(__file__).resolve().parent
CSS=('tokens.demo.css','styles.css','composable.css','editor-spacing.css')
JS=('catalog.js','components.js','flows.js','composable.js','app.js')

STORAGE_SHIM='''(snapshot) => {
 const values = new Map(Object.entries(snapshot));
 const storage = {
  getItem: (key) => values.has(String(key)) ? values.get(String(key)) : null,
  setItem: (key, value) => { values.set(String(key), String(value)); },
  removeItem: (key) => { values.delete(String(key)); },
  clear: () => values.clear(),
  key: (i) => [...values.keys()][i] ?? null,
  get length() { return values.size; }
 };
 Object.defineProperty(window, 'localStorage', {configurable: true, value: storage});
 Object.defineProperty(window, '__testSnapshot', {configurable: true, value: () => Object.fromEntries(values)});
}'''

def mount(page, snapshot=None):
 page.set_content((D/'index.html').read_text(encoding='utf-8'))
 page.evaluate(STORAGE_SHIM, snapshot or {})
 for file in CSS: page.add_style_tag(content=(D/file).read_text(encoding='utf-8'))
 for file in JS: page.add_script_tag(content=(D/file).read_text(encoding='utf-8'))

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 errors=[]
 first=b.new_page(viewport={'width':1480,'height':980})
 first.on('pageerror',lambda e:errors.append(str(e)))
 mount(first)
 assert first.locator('#page .preview-block').count()==6
 first.locator('#page [data-page="s4"]').click()
 first.locator('[data-cb-rail="library"]').click()
 first.locator('[data-cb-add="productCard"]').click()
 first.locator('[data-cb-field="productId"]').select_option('D003')
 assert '휴대용 티 보틀' in first.locator('#page [data-page="s4"]').inner_text()
 first.locator('[data-cb-field="card.def.label"]').fill('새 추천')
 # Focusing out ensures the same commit/autosave path used by the editor UI.
 first.locator('#page [data-page="s4"]').click()
 snapshot=first.evaluate('window.__testSnapshot()')
 assert 'amoread-lab-v09' in snapshot, 'saved record missing'
 assert 'D003' in snapshot['amoread-lab-v09']
 first.close()

 second=b.new_page(viewport={'width':1480,'height':980})
 second.on('pageerror',lambda e:errors.append(str(e)))
 mount(second,snapshot)
 assert second.locator('#page .preview-block').count()==6, 'lost original sections'
 assert second.locator('#page [data-page="s4"] .cb-node--productCard').count()==1, 'block not restored'
 assert '휴대용 티 보틀' in second.locator('#page [data-page="s4"]').inner_text(), 'product binding not restored'
 second.locator('#page [data-page="s4"] .cb-node--productCard').click()
 assert second.locator('[data-cb-field="productId"]').input_value()=='D003'
 assert second.locator('[data-cb-field="card.def.label"]').input_value()=='새 추천'
 assert not errors, errors
 print('PASS: serialized block and product properties restored in a fresh browser page; 6 original sections retained')
 b.close()
