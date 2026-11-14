"""v1.11 IA acceptance and key legacy flows, browser with no network dependency."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css','ia-v111.css']
JS=['catalog.js','components.js','flows.js','composable.js','app.js']
def mount(page):
 page.set_content((D/'index.html').read_text(encoding='utf8'))
 for f in CSS:page.add_style_tag(content=(D/f).read_text(encoding='utf8'))
 for f in JS:page.add_script_tag(content=(D/f).read_text(encoding='utf8'))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1550,'height':1030},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 mount(page)
 assert page.locator('#page .preview-block').count()==6
 assert page.locator('.ia-tree-section').count()==6
 assert page.locator('[data-cb-rail]').count()==3
 assert page.locator('#ia-breadcrumb').inner_text().find('선물 취향별 추천')>=0
 assert page.locator('[data-ia-group="content"]').count()==1
 assert page.locator('[data-ia-group="layout"]').count()==1
 assert page.locator('[data-ia-toggle="s3"]').get_attribute('aria-expanded')=='true'
 assert page.locator('.ia-tree-children [data-ia-node="native-product"]').count()>=2
 # Native product selection should target product panel without deleting section settings.
 page.locator('[data-ia-node="native-product"]').first.click()
 assert page.locator('[data-tab="products"]').get_attribute('aria-selected')=='true'
 assert '구좌' in page.locator('#ia-edit-scope').inner_text()
 # Existing shape editor remains accessible via grouped navigation.
 page.locator('[data-ia-group="layout"]').click()
 assert page.locator('[data-tab="shape"]').is_visible()
 page.locator('[data-tab="shape"]').click()
 assert page.locator('[data-product-style="masonry"]').count()==1
 page.locator('[data-product-style="masonry"]').click()
 assert page.locator('.am-product-view-masonry').count()>=1
 # Insert block by left Add > Element; then select it via the tree.
 page.locator('[data-cb-rail="library"]').click()
 assert page.locator('[data-ia-library="sections"]').count()==1
 page.locator('[data-ia-library="blocks"]').click()
 page.locator('[data-cb-add="text"]').click()
 assert page.locator('#panel-body [data-cb-field="text"]').count()==1
 page.locator('[data-cb-field="text"]').fill('새로 삽입한 블록')
 page.locator('[data-cb-rail="sections"]').click()
 assert page.locator('[data-ia-node="block"]').count()>=1
 page.locator('[data-ia-node="block"]').last.click()
 assert '선택한 요소' in page.locator('#ia-edit-scope').inner_text()
 assert page.locator('#panel-body [data-cb-field="text"]').input_value()=='새로 삽입한 블록'
 # Data library has demo sources and binds to selected product card.
 page.locator('[data-cb-rail="data"]').click()
 assert page.locator('[data-ia-data-mode]').count()==3
 page.locator('[data-cb-rail="library"]').click()
 page.locator('[data-ia-library="blocks"]').click()
 page.locator('[data-cb-add="productCard"]').click()
 page.locator('[data-cb-rail="data"]').click()
 page.locator('[data-ia-bind-product="D003"]').click()
 assert page.locator('[data-cb-field="productId"]').input_value()=='D003'
 # Quiz stage nodes reflect the same result selection used by original flow editor.
 page.locator('[data-cb-rail="sections"]').click()
 page.locator('[data-ia-toggle="s5"]').click()
 page.locator('[data-section="s5"]').click()
 page.locator('#changeLayout').click()
 page.locator('[data-picker-id="ev-quiz"]').click()
 page.locator('#pickerApply').click()
 if page.locator('[data-ia-toggle="s5"]').get_attribute('aria-expanded')=='false':page.locator('[data-ia-toggle="s5"]').click()
 assert page.locator('[data-ia-node="quiz-result"]').count()>=2
 page.locator('[data-ia-node="quiz-result"]').last.click()
 assert page.locator('[data-tab="event"]').get_attribute('aria-selected')=='true'
 assert page.locator('#page [data-page="s5"] .mock-ev-badge').count()>=1
 # Validate hub links to section inspector. Can be empty without errors.
 page.locator('#iaCheckAll').click()
 assert page.locator('#ia-qa-dialog').evaluate('(e)=>e.open')
 if page.locator('[data-ia-issue-section]').count():page.locator('[data-ia-issue-section]').first.click();assert page.locator('[data-tab="check"]').get_attribute('aria-selected')=='true'
 else:page.locator('#iaQaClose').click()
 assert not errors,errors
 page.screenshot(path=str(D/'screenshot_ia_v111.png'),full_page=False)
 print('PASS v1.11: left 3 modes, nested structure, contextual inspector, product binding, quiz results, grouped settings, validation hub; no JS errors')
 browser.close()
