"""Audit each existing product-card visual element and order/visibility in section + block."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css']
JS=['catalog.js','components.js','flows.js','composable.js','app.js']

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1480,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((D/'index.html').read_text(encoding='utf-8'))
 for x in CSS:page.add_style_tag(content=(D/x).read_text(encoding='utf8'))
 for x in JS:page.add_script_tag(content=(D/x).read_text(encoding='utf8'))
 page.locator('[data-page="s3"]').click();page.locator('[data-tab="shape"]').click()
 all_keys=['img','label','pill','appeal','tag','name','list','first','pct','pname','sale','rating','review','ai','copy','btn']
 assert page.locator('[data-element]').count()==16
 for k in all_keys:
  ctrl=page.locator(f'[data-element="{k}"]')
  if k=='ai':
   assert ctrl.is_disabled(), 'AI without a backend must not appear available'
   continue
  ctrl.check()
  sec=page.locator('[data-page="s3"] .mock-product').first
  if k=='img': assert sec.locator('.mock-product-media .mock-product-image').count()==1
  elif k=='label': assert sec.locator('.mock-el--label').count()==1
  else: assert sec.locator('.mock-el--'+k).count()==1,(k,sec.inner_text())
  ctrl.uncheck()
  sec=page.locator('[data-page="s3"] .mock-product').first
  assert sec.locator('.mock-el--'+k).count()==0,k
 # Re-enable image/label and test anchored placement when image gets reordered below the name.
 page.locator('[data-element="img"]').check();page.locator('[data-element="label"]').check()
 page.locator('[data-element="name"]').check()
 # reorder name above img (image initially index zero); image position must now follow card.order
 page.locator('[data-action="element:5:-1"]').click()
 # JS underlying key order preserves old serialized keys: label controls stay anchored; no visual no-op
 assert page.locator('[data-action="element:1:-1"]').is_disabled()
 page.locator('[data-choice="card.def.labelPosition"][data-value="top-left"]').click()
 assert page.locator('#page [data-page="s3"] .mock-card-label--corner.top-left').count()==2
 page.locator('[data-element="img"]').uncheck()
 assert page.locator('#page [data-page="s3"] .mock-product-media').count()==0
 assert page.locator('#page [data-page="s3"] .mock-label-without-image').count()==2
 # None of these visible components are an empty dead toggle; dependent label has explicit fallback.
 assert not errors,errors
 print('PASS v1.8 product audit: 15/15 live element keys incl. anchored label + fallback; AI summary correctly disabled; no errors')
 browser.close()
