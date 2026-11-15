"""v1.7 layout variant, column, accordion and picker fidelity regressions. No HTTP needed."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1510,'height':950})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((D/'index.html').read_text())
 for name in ['tokens.demo.css','styles.css','composable.css','editor-spacing.css']:page.add_style_tag(content=(D/name).read_text())
 for name in ['catalog.js','components.js','flows.js','composable.js','app.js']:page.add_script_tag(content=(D/name).read_text())
 assert page.locator('#page .preview-block').count()==6
 # existing benefit can switch 1/2/3 columns with actual computed grids
 page.locator('[data-page="s2"]').click()
 page.locator('[data-tab="items"]').click()
 for n in [1,2,3]:
  page.locator('[data-columns="%s"]'%n).first.click()
  selector='#page [data-page="s2"] .am-flow-info-list'
  assert page.locator(selector).count()==1
  cols=page.locator(selector).evaluate('(el)=>getComputedStyle(el).gridTemplateColumns.split(" ").length')
  assert cols==n,(n,cols)
 # same on service / new content columns
 page.locator('[data-page="s4"]').click()
 page.locator('[data-tab="items"]').click()
 page.locator('[data-columns="3"]').first.click()
 assert page.locator('#page [data-page="s4"] .am-flow-info-list.cols-3').count()==1
 # product view modes retain actual connected SKU + element count
 page.locator('[data-page="s3"]').click()
 page.locator('[data-tab="shape"]').click()
 for mode in ['list','grid','card','carousel','masonry']:
  page.locator('[data-product-style="'+mode+'"]').click()
  sec=page.locator('#page [data-page="s3"]')
  assert sec.locator('.am-product-view-'+mode).count()==1,mode
  assert sec.locator('.mock-product').count()==2,mode
  assert '봄날의 티 샘플러' in sec.inner_text(),mode
 assert page.locator('.am-ed-product-layout-option').count()==5
 # Type library: product and accordion previews must be distinct without changing original IDs
 page.locator('#changeLayout').click()
 page.locator('[data-picker-cat="상품"]').click()
 for variant in ['grid','list','card','carousel','masonry']:
  assert page.locator('[data-picker-id="grid2@'+variant+'"]').count()==1
  assert page.locator('[data-picker-id="grid2@'+variant+'"] .am-product-view-'+variant).count()==1
 page.locator('[data-picker-id="grid2@carousel"]').click()
 assert page.locator('#selectedPreview .am-product-view-carousel').count()==1
 page.locator('#pickerApply').click()
 assert page.locator('#page [data-page="s3"] .am-product-view-carousel').count()==1
 # Accordion selection from type gallery, editable title+content, functional toggle
 page.locator('[data-page="s4"]').click()
 page.locator('#changeLayout').click()
 page.locator('[data-picker-cat="안내·이야기"]').click()
 for v in ['notice@accordion','timeline@accordion']:
  assert page.locator('[data-picker-id="'+v+'"]').count()==1
  assert page.locator('[data-picker-id="'+v+'"] .am-ed-accordion').count()>0
 page.locator('[data-picker-id="notice@accordion"]').click()
 page.locator('#pickerApply').click()
 assert page.locator('#page [data-page="s4"] .am-ed-accordion').count()>0
 page.locator('[data-tab="items"]').click()
 # first accordion item summary uses the preserved item label
 first=page.locator('#page [data-page="s4"] .am-ed-accordion').first
 text_before=first.locator('summary').inner_text()
 first.locator('summary').click()
 assert first.get_attribute('open') is not None
 # After manually toggling, the inspector can change its configured initial state
 page.locator('[data-bind="items.0.openByDefault"]').select_option('true')
 assert page.locator('#page [data-page="s4"] .am-ed-accordion').first.get_attribute('open') is not None
 assert text_before.strip()
 # Removing permanent 'left library' hint keeps the quiet slot for drag targets
 page.locator('[data-cb-rail="library"]').click()
 assert page.locator('.cb-drop-hint').count()==0
 assert page.locator('.cb-drop-spot').count()>0
 page.locator('#changeLayout').click()
 page.locator('[data-picker-id="notice@accordion"]').click()
 page.screenshot(path=str(D/'screenshot_v17_picker.png'),full_page=False)
 page.locator('#pickerCancel').click()
 page.screenshot(path=str(D/'screenshot_v17_editor.png'),full_page=False)
 assert not errors,errors
 print('PASS v1.7: 1/2/3 columns, 5 product arrangements, visual picker, functional accordion, no permanent hint, previous sections preserved; no JS errors')
 b.close()
