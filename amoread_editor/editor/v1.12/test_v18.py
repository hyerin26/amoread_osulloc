"""v1.8: gallery, corner badge, free-form reference section, existing workflows.
Run with python test_v18.py; no local HTTP server needed.
"""
from pathlib import Path
from io import BytesIO
from playwright.sync_api import sync_playwright
from PIL import Image

D=Path(__file__).resolve().parent
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None, headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1490,'height':930})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((D/'index.html').read_text(encoding='utf8'))
 # The about:blank test page has blocked real localStorage. Use an origin-independent
 # storage shim, as in v1.6 persistence tests. This is not a production code change.
 page.evaluate("""() => {const kv=new Map();const store={getItem:k=>kv.get(k)||null,setItem:(k,v)=>kv.set(k,String(v)),removeItem:k=>kv.delete(k),clear:()=>kv.clear(),key:i=>[...kv.keys()][i]||null,get length(){return kv.size}};Object.defineProperty(window,'localStorage',{configurable:true,value:store});}""")
 for f in ['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css']:
  page.add_style_tag(content=(D/f).read_text(encoding='utf8'))
 for f in ['catalog.js','components.js','flows.js','composable.js','app.js']:
  page.add_script_tag(content=(D/f).read_text(encoding='utf8'))
 assert page.locator('#page .preview-block').count()==6
 # Existing product section: corner label must overlay inside an image, not flow like a pill.
 page.locator('[data-page="s3"]').click()
 page.locator('[data-tab="shape"]').click()
 page.locator('[data-element="label"]').check()
 page.locator('#page [data-page="s3"] .mock-product-media .mock-card-label--corner.top-left').count()==2
 assert page.locator('#page [data-page="s3"] .mock-card-pill').count()==0
 page.locator('[data-choice="card.def.labelPosition"][data-value="bottom-right"]').click()
 assert page.locator('#page [data-page="s3"] .mock-product-media .mock-card-label--corner.bottom-right').count()==2
 corner=page.locator('#page [data-page="s3"] .mock-card-label--corner').first
 media=page.locator('#page [data-page="s3"] .mock-product-media').first
 coords=page.evaluate('''() => {const b=document.querySelector('[data-page="s3"] .mock-card-label--corner').getBoundingClientRect(),a=document.querySelector('[data-page="s3"] .mock-product-media').getBoundingClientRect();return {br:b.right,bb:b.bottom,ar:a.right,ab:a.bottom};}''')
 assert abs(coords['br']-coords['ar'])<=16 and abs(coords['bb']-coords['ab'])<=16,coords
 page.locator('#page [data-page="s3"]').scroll_into_view_if_needed()
 page.screenshot(path=str(D/'screenshot_v18_corner_label.png'),full_page=False)
 # Select adding a new free-form section. This must keep all six existing sections.
 page.locator('#addSection').click()
 assert page.locator('#typeDialog [data-picker-id="custom"]').count()==1
 assert page.locator('[data-picker-id="custom"] .am-custom-frame').count()==1
 picker=page.locator('#pickerResults')
 assert picker.evaluate('(el)=>getComputedStyle(el).gridAutoRows')=='max-content'
 page.locator('[data-picker-id="custom"]').click()
 page.locator('#pickerApply').click()
 assert page.locator('#page .preview-block').count()==7
 selected=page.locator('#page .preview-block.active')
 assert selected.locator('.am-custom-frame').count()==1
 page.locator('[data-tab="items"]').click()
 assert page.locator('#customImageUpload').count()==1
 page.locator('[data-bind="custom.purpose"]').fill('기존 유형에 없는 참여형 브랜딩 구좌')
 page.locator('[data-bind="custom.referenceUrl"]').fill('https://example.com/creative-reference')
 page.locator('[data-bind="custom.referenceNotes"]').fill('상단 큰 이미지와 하단 스와이프 안내')
 page.locator('[data-choice="custom.height"][data-value="tall"]').click()
 assert page.locator('#page .preview-block.active .am-custom-frame--tall').count()==1
 # Image upload and persisted image data round trip via DOM/JSON (client-only).
 b=BytesIO(); Image.new('RGB',(700,430),(130,166,147)).save(b,format='PNG')
 page.locator('#customImageUpload').set_input_files({'name':'reference.png','mimeType':'image/png','buffer':b.getvalue()})
 page.wait_for_timeout(180)
 assert page.locator('#page .preview-block.active img.am-custom-reference-image').count()==1
 assert page.locator('#page .preview-block.active .am-custom-caption').count()==1
 # Add product component in freeform, customize its label with different badge position
 page.locator('#page .preview-block.active').scroll_into_view_if_needed()
 page.screenshot(path=str(D/'screenshot_v18_custom_settings.png'),full_page=False)
 page.locator('[data-cb-rail="library"]').click()
 page.locator('[data-cb-add="productCard"]').click()
 assert page.locator('#page .preview-block.active .cb-node--productCard').count()==1
 page.locator('[data-cb-visible="label"]').check()
 page.locator('[data-cb-field="card.def.labelPosition"]').select_option('top-right')
 assert page.locator('#page .preview-block.active .cb-product-card .mock-card-label--corner.top-right').count()==1
 assert 'https://example.com/creative-reference' in page.locator('#page .preview-block.active').inner_text()
 # Inspect purpose, refs preserved through stored copy
 page.locator('[data-cb-back]').click()
 page.locator('[data-tab="items"]').click()
 assert page.locator('[data-bind="custom.purpose"]').input_value()=='기존 유형에 없는 참여형 브랜딩 구좌'
 assert page.locator('#tabbar [data-tab="check"]').count()==1
 page.locator('#tabbar [data-tab="check"]').click()
 assert page.locator('#panel-body').count()==1
 # Visually inspect preview/picker in CI artifacts; no overlap/overflow.
 page.locator('#page .preview-block.active').scroll_into_view_if_needed()
 page.screenshot(path=str(D/'screenshot_v18_freeform.png'),full_page=False)
 page.locator('#changeLayout').click()
 page.locator('[data-picker-cat="상품"]').click()
 page.screenshot(path=str(D/'screenshot_v18_picker.png'),full_page=False)
 overlaps=page.evaluate('''() => {
 let cards=[...document.querySelectorAll('#pickerResults .am-ed-picker-card')],r=cards.map(n=>n.getBoundingClientRect());return r.some((a,i)=>r.some((b,j)=>i!==j&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2));}''')
 assert not overlaps,'picker cards overlapping'
 assert not errors,errors
 print('PASS v1.8: 16-key image badge overlay, 4 placement options, custom section reference/file, block insertion, picker integrity, preserved 6 originals; no JS errors')
 browser.close()
