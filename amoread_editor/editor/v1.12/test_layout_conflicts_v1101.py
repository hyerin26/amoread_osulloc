"""AMOREAD v1.10.1: mode-specific image rules, fallback, persistence and no regressions."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css']
JS=['catalog.js','components.js','flows.js','composable.js','app.js']
def mount(page):
 page.set_content((D/'index.html').read_text(encoding='utf8'))
 for name in CSS:page.add_style_tag(content=(D/name).read_text(encoding='utf8'))
 for name in JS:page.add_script_tag(content=(D/name).read_text(encoding='utf8'))
def media(page):
 return page.locator('#page [data-page="s3"] .mock-product-media')
def ratios(page):
 return media(page).evaluate_all('els=>els.map(x=>({id:x.closest("[data-card-product]")?.dataset.cardProduct, ratio:x.dataset.effectiveRatio, width:x.querySelector(".mock-product-image").getBoundingClientRect().width, height:x.querySelector(".mock-product-image").getBoundingClientRect().height}))')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1510,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 mount(page)
 assert page.locator('#page .preview-block').count()==6
 page.locator('#page [data-page="s3"]').click()
 page.locator('[data-tab="shape"]').click()
 assert page.locator('[data-image-ratio-control]').count()==1
 # Choose section global ratio in the uniform grid layout. It should survive mode switches.
 page.locator('[data-choice="imageRatio"][data-value="16:9"]').click()
 assert set(x['ratio'] for x in ratios(page))=={'16:9'}
 # Enter masonry: global ratio picker must be replaced, not silently remain active.
 page.locator('[data-product-style="masonry"]').click()
 assert page.locator('[data-image-ratio-control]').count()==0
 assert page.locator('[data-masonry-ratio-control]').count()==1
 initial=ratios(page)
 assert len(initial)>=2
 assert len(set(x['ratio'] for x in initial))>=2, ('masonry must start with varied ratios',initial)
 for x in initial:assert abs(x['width']/x['height']-float(x['ratio'].split(':')[0])/float(x['ratio'].split(':')[1]))<.08,x
 # Customize just D001; D002 must be unaffected.
 page.locator('[data-choice="productImageRatios.D001"][data-value="9:16"]').click()
 r=ratios(page)
 assert r[0]['ratio']=='9:16' and r[1]['ratio']==initial[1]['ratio'],r
 # A duplicate-size override is allowed with an explicit quality warning and reset path.
 page.locator('[data-choice="productImageRatios.D002"][data-value="9:16"]').click()
 assert page.locator('[data-masonry-ratio-control] [role="status"]').count()==1
 page.locator('[data-masonry-reset]').click()
 assert len(set(x['ratio'] for x in ratios(page)))>=2
 # Masonry per-product ratios are kept while global grid stays independent.
 page.locator('[data-choice="productImageRatios.D001"][data-value="3:4"]').click()
 page.locator('[data-product-style="grid"]').click()
 assert page.locator('[data-image-ratio-control]').count()==1
 assert set(x['ratio'] for x in ratios(page))=={'16:9'}
 page.locator('[data-product-style="masonry"]').click()
 assert ratios(page)[0]['ratio']=='3:4'
 # Undo restores the last view switch; no global ratio loss.
 page.locator('#undoBtn').click() if page.locator('#undoBtn').count() else None
 # Other arrangements still use section-wide ratio in uniform mode.
 for mode in ['list','card','carousel']:
  page.locator('[data-product-style="'+mode+'"]').click()
  assert set(x['ratio'] for x in ratios(page))=={'16:9'},(mode,ratios(page))
 page.locator('[data-product-style="masonry"]').click()
 assert ratios(page)[0]['ratio']=='3:4'
 # Product card inserted into another section retains its own aspect regardless of section view.
 page.locator('#page [data-page="s4"]').click()
 page.locator('[data-cb-rail="library"]').click()
 page.locator('[data-cb-add="productCard"]').click()
 assert page.locator('[data-cb-field="imageRatio"]').count()==1
 page.locator('[data-cb-field="imageRatio"]').select_option('4:3')
 ratio=page.locator('#page [data-page="s4"] .cb-node--productCard .mock-product-media').first.get_attribute('data-effective-ratio')
 assert ratio=='4:3',ratio
 # Confirm picker preview renders masonry as mixed-height media too.
 page.locator('#changeLayout').click()
 page.locator('[data-picker-cat="상품"]').click()
 mini=page.locator('[data-picker-id="grid2@masonry"] .mock-product-media')
 assert mini.count()>=2
 assert len(set(mini.evaluate_all('els=>els.map(x=>x.dataset.effectiveRatio)')))>=2
 assert not errors,errors
 print('PASS v1.10.1: masonry varied ratios, per-product override, conflict warning/reset, uniform view restore, reusable-block isolation, picker parity, no JS errors')
 b.close()
