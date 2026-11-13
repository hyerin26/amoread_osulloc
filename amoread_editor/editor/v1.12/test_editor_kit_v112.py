"""Live editor UX and Green UI Chrome style regression (no HTTP/CDN access)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css','ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']
JS=['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']
def mount(page):
 page.set_content((D/'index.html').read_text(encoding='utf8'))
 for f in CSS:page.add_style_tag(content=(D/f).read_text(encoding='utf8'))
 for f in JS:page.add_script_tag(content=(D/f).read_text(encoding='utf8'))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1550,'height':800},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 mount(page)
 assert page.locator('#page .preview-block').count()==6
 assert page.locator('.cb-rail svg.am-kit-icon').count()==3
 assert page.locator('.ia-tree-toggle svg.am-kit-icon').count()==6
 assert page.locator('[data-bind="num"]').count()==0,'numbering control should be retired'
 assert page.locator('#page [data-page="s3"] h3').inner_text()=='선물 취향별 추천'
 assert page.locator('.ia-groups.am-kit-primary-nav').count()==1
 assert page.locator('.ia-subtabs.am-kit-subnav').count()==1, 'product content has multiple child tabs'
 # Deep down document then left click on different section auto-centers.
 page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
 page.wait_for_timeout(200)
 top_before=page.evaluate("document.querySelector('#page [data-page=s1]').getBoundingClientRect().top")
 page.locator('[data-section="s1"]').click()
 page.wait_for_timeout(850)
 top_after=page.evaluate("document.querySelector('#page [data-page=s1]').getBoundingClientRect().top")
 assert abs(top_after)<abs(top_before),('left section click did not reveal',top_before,top_after)
 assert page.locator('.ia-subtabs.am-kit-subheading').count()==1,'hero content has one child tab'
 assert page.locator('[data-tab="copy"]').count()==0,'do not render duplicated child navigation'
 assert page.locator('.am-kit-single-heading').inner_text()=='문구 편집'
 # Click child of product section. Auto scroll must focus actual card or section.
 page.locator('[data-ia-toggle="s3"]').click() if page.locator('[data-ia-toggle="s3"]').get_attribute('aria-expanded')=='false' else None
 page.locator('#section-list [data-ia-node="native-product"]').first.click()
 page.wait_for_timeout(800)
 assert page.locator('[data-tab="products"]').get_attribute('aria-selected')=='true'
 card_top=page.evaluate("document.querySelector('#page [data-page=s3] .mock-product').getBoundingClientRect().top")
 assert -400<card_top<1000,card_top
 # Toggle style: correct control type and functionality
 page.locator('[data-ia-group="content"]').click()
 assert page.locator('#panel-body .am-ed-toggle input').count()>0
 toggle=page.locator('#panel-body .am-ed-toggle input').first
 before=toggle.is_checked();toggle.check() if not before else toggle.uncheck()
 assert page.locator('#panel-body .am-ed-toggle input').first.is_checked()!=before
 # Multi child names have distinct secondary nav.
 page.locator('[data-ia-group="handoff"]').click()
 assert page.locator('.ia-subtabs.am-kit-subnav').count()==1
 assert page.locator('.am-kit-subnav-label').inner_text()=='세부 항목'
 assert page.locator('[data-tab="notes"]').count()==1
 # Left tree remains expandable via explicit chevron icon.
 caret=page.locator('[data-ia-toggle="s3"]');initial=caret.get_attribute('aria-expanded');caret.click();assert caret.get_attribute('aria-expanded')!=initial
 page.screenshot(path=str(D/'screenshot_editor_kit_v112.png'),full_page=False)
 # Screen-reader icon button naming preserved.
 assert page.locator('.outline-entry-actions button:not([aria-label])').count()==0
 assert not errors,errors
 print('PASS v1.12: primary/sub hierarchy, icon registry, left preview auto-navigation, toggle, numbering retirement, editor functionality')
 browser.close()
