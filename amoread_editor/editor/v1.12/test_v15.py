"""v1.5 browser regression, executable with Playwright; fake data only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
E=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1520,'height':1050},accept_downloads=True)
 page.on('pageerror',lambda e:E.append(str(e)))
 page.set_content((D/'index.html').read_text())
 for f in ['tokens.demo.css','styles.css','composable.css','editor-spacing.css']:page.add_style_tag(content=(D/f).read_text())
 for f in ['catalog.js','components.js','flows.js','composable.js','app.js']:page.add_script_tag(content=(D/f).read_text())
 assert page.locator('#page .preview-block').count()==6,'6 original sections'
 assert page.locator('[data-tab="check"]').count()==1,'quality panel'
 assert page.locator('.cb-rail button').count()==2,'new left rail'
 # Keep original review variants and type picker
 page.locator('#changeLayout').click(); assert page.locator('[data-picker-id]').count()>=24, 'Legacy picker choices must remain; additional variants are allowed'
 page.locator('[data-picker-cat="후기"]').click();assert page.locator('[data-picker-id]').count()==4
 page.locator('#pickerCancel').click()
 # Original product card 16 elements still available
 page.locator('#page [data-page="s3"]').click()
 page.locator('[data-tab="shape"]').click()
 assert page.locator('[data-element]').count()==16
 page.locator('[data-element="label"]').check()
 assert page.locator('#page .preview-block.active [data-card-element="label"]').count()>0
 # Original CTA and multiline text
 page.locator('#page [data-page="s4"]').click()
 page.locator('[data-bind="name"]').fill('첫째 줄\n둘째 줄')
 assert '첫째 줄\n둘째 줄' in page.locator('#page .preview-block.active h3').inner_text()
 page.locator('[data-check="ctaOn"]').check()
 assert page.locator('#page .preview-block.active .mock-cta').count()==1
 # Switch rail to elements, add a product card to a section that is not a product grid
 page.locator('[data-cb-rail="library"]').click()
 assert page.locator('#section-list').is_hidden()
 assert page.locator('#component-library').is_visible()
 page.locator('[data-cb-add="productCard"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node').count()==1,'block appears in service section'
 assert page.locator('input[data-cb-visible]').count()==16
 assert page.locator('[data-cb-field="productId"]').count()==1
 page.locator('select[data-cb-field="productId"]').select_option('D005')
 assert '선물용 티 세트' in page.locator('#page [data-page="s4"]').inner_text()
 page.locator('[data-cb-visible="label"]').check()
 assert page.locator('#page [data-page="s4"] .mock-el--label').count()==1
 page.locator('[data-cb-field="card.def.label"]').fill('BEST PICK')
 assert 'BEST PICK' in page.locator('#page [data-page="s4"] .mock-el--label').inner_text()
 # Add text, use Enter and confirm live wireframe preserves the newline
 page.locator('[data-cb-add="text"]').click()
 page.locator('[data-cb-field="text"]').fill('브랜드 이야기\n상품 추천 이유')
 assert '브랜드 이야기\n상품 추천 이유' in page.locator('#page [data-page="s4"] .cb-text').inner_text()
 # Block selection via center and isolation; switching back restores original tabs
 page.locator('#page [data-page="s4"] .cb-node').first.click()
 assert page.locator('[data-cb-field="productId"]').count()==1
 page.locator('[data-cb-action="clone"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node').count()==3
 page.locator('[data-cb-action="delete"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node').count()==2
 page.locator('[data-cb-rail="sections"]').click()
 assert page.locator('#section-list').is_visible()
 page.locator('#page [data-page="s3"]').click()
 assert page.locator('[data-tab="shape"]').count()==1,'original detailed tabs remain'
 # Quiz: create new event, original question/result editor remains
 page.locator('#page [data-page="s5"]').click();page.locator('#changeLayout').click()
 page.locator('[data-picker-id="ev-quiz"]').click();page.locator('#pickerApply').click()
 page.locator('[data-tab="event"]').click()
 assert page.locator('[data-flow="editQuestion:0"]').count()==1
 page.locator('[data-flow="addQuestion"]').click()
 assert page.locator('[data-flow^="editQuestion:"]').count()==2
 page.locator('[data-flow="addResult"]').click()
 assert page.locator('[data-flow^="editResult:"]').count()==3
 # Quiz result A, add card within result, B isolated
 page.locator('[data-flow-view="r:0"]').click()
 page.locator('[data-cb-rail="library"]').click()
 assert page.locator('#page [data-page="s5"] [data-cb-slot^="result:"]').count()==1
 page.locator('[data-cb-add="productCard"]').click()
 assert page.locator('#page [data-page="s5"] .cb-node').count()==1
 page.locator('[data-cb-field="productId"]').select_option('D001')
 # Return to original event tab; verify result B is separate
 page.locator('[data-cb-back]').click()
 page.locator('[data-flow-view="r:1"]').click()
 assert page.locator('#page [data-page="s5"] .cb-node').count()==0
 page.locator('[data-cb-add="cta"]').click()
 assert page.locator('#page [data-page="s5"] .cb-node').count()==1
 page.locator('[data-cb-field="text"]').fill('취향에 맞는 차 보기')
 assert '취향에 맞는 차 보기' in page.locator('#page [data-page="s5"] .cb-node').inner_text()
 page.locator('[data-cb-back]').click()
 page.locator('[data-flow-view="r:0"]').click()
 assert page.locator('#page [data-page="s5"] .cb-product-card').count()==1
 # Existing event view still editable and handoff exported
 with page.expect_download() as d: page.locator('#exportHandoff').click()
 handoff=d.value.path().read_text(encoding='utf-8') if hasattr(d.value.path(),'read_text') else Path(d.value.path()).read_text(encoding='utf-8')
 assert '취향에 맞는 차 보기' in handoff and '선물용 티 세트' in handoff
 with page.expect_download() as d:page.locator('#exportDemo').click()
 import json
 value=json.loads(Path(d.value.path()).read_text(encoding='utf-8'))
 assert any(s.get('editorBlocks') for s in value['sections']),'blocks JSON exported'
 # Undo/redo after adding block
 assert page.locator('#undo').count()==1
 page.screenshot(path=str(D/'screenshot_v15.png'),full_page=True)
 assert not E,'JS errors: '+str(E)
 b.close()
 print('PASS v1.5: original tabs, legacy section choices and new variants, CTA, multiline, 16 cards, rail, blocks, quiz result slots, handoff and JSON, no JS errors')
