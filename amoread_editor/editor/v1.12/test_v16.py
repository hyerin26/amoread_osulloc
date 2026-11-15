"""Targeted functional and geometry tests for v1.6; no HTTP required."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1536,'height':900},accept_downloads=True)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((D/'index.html').read_text())
 for name in ['tokens.demo.css','styles.css','composable.css','editor-spacing.css']:page.add_style_tag(content=(D/name).read_text())
 for name in ['catalog.js','components.js','flows.js','composable.js','app.js']:page.add_script_tag(content=(D/name).read_text())
 assert page.locator('#page .preview-block').count()==6
 page.locator('[data-page="s4"]').click()
 page.locator('[data-cb-rail="library"]').click()
 assert page.locator('[data-cb-add="productGrid"]').count()==1
 page.locator('[data-cb-add="productGrid"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node--productGrid').count()==1
 assert page.locator('#page [data-page="s4"] .cb-node--productCard').count()==2
 group=page.locator('#page [data-page="s4"] .cb-group')
 assert page.locator('[data-cb-field="columns"]').count()==1
 for cols in [2,3,4]:
  page.locator('[data-cb-field="columns"]').select_option(str(cols))
  val=group.evaluate('(el)=>getComputedStyle(el).gridTemplateColumns.split(" ").length')
  assert val==cols, (cols,val)
 assert page.locator('[data-cb-action="add-child"]').count()==1
 page.locator('[data-cb-action="add-child"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node--productCard').count()==3
 # Set product individually in the nested card without changing sibling data
 page.locator('#page [data-page="s4"] .cb-node--productCard').first.click()
 page.locator('[data-cb-field="productId"]').select_option('D005')
 assert '선물용 티 세트' in page.locator('#page [data-page="s4"] .cb-node--productCard').first.inner_text()
 # Add image into section, update dimensions via ratio selection
 page.locator('[data-cb-add="image"]').click()
 image=page.locator('#page [data-page="s4"] .cb-image').last
 page.locator('[data-cb-field="ratio"]').select_option('16:9')
 dimensions=lambda: image.bounding_box()
 wide=dimensions(); assert wide['width']>wide['height']*1.5,wide
 page.locator('[data-cb-field="ratio"]').select_option('9:16')
 tall=dimensions(); assert tall['height']>tall['width']*1.5,(wide,tall)
 # New CTA should respect its style (not inherited mock-cta styles)
 page.locator('[data-cb-add="cta"]').click()
 page.locator('[data-cb-field="text"]').fill('선물 기획전 확인')
 page.locator('[data-cb-field="style"]').select_option('filled')
 assert page.locator('#page [data-page="s4"] .cb-cta-wrap .cb-style-filled').count()==1
 button=page.locator('#page [data-page="s4"] .cb-cta-wrap .cb-style-filled')
 assert button.evaluate('(el)=>getComputedStyle(el).display') in ['flex','inline-flex']
 page.locator('[data-cb-field="style"]').select_option('wide')
 assert button.count()==0
 wide_cta=page.locator('#page [data-page="s4"] .cb-cta-wrap .cb-style-wide')
 assert wide_cta.count()==1
 # Existing blocks can be grouped into a new 2-column layout then ungrouped.
 page.locator('[data-cb-add="text"]').click()
 page.locator('[data-cb-add="text"]').click()
 text_blocks=page.locator('#page [data-page="s4"] .cb-node--text')
 assert text_blocks.count()==2
 text_blocks.first.click()
 page.locator('[data-cb-action="wrap-next"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node--group').count()==1
 assert page.locator('#page [data-page="s4"] .cb-node--group .cb-node--text').count()==2
 page.locator('[data-cb-action="ungroup"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node--group').count()==0
 assert page.locator('#page [data-page="s4"] .cb-node--text').count()==2
 # Verify picker bottom-most item visible on scroll without overlapping fixed footer
 if page.locator('[data-cb-back]').count():page.locator('[data-cb-back]').click()
 page.locator('#changeLayout').click()
 page.locator('[data-picker-cat="이벤트"]').click()
 assert page.locator('#pickerResults [data-picker-id]').count()==6
 page.evaluate('document.querySelector("#pickerResults").scrollTop=10000')
 page.wait_for_timeout(200)
 positions=page.evaluate('''() => {const area=document.querySelector('#pickerResults').getBoundingClientRect(),last=document.querySelector('#pickerResults [data-picker-id]:last-child').getBoundingClientRect(),foot=document.querySelector('.am-ed-picker-foot').getBoundingClientRect(); return {area:{bottom:area.bottom,top:area.top},last:{bottom:last.bottom,top:last.top},foot:{top:foot.top},scrollTop:document.querySelector('#pickerResults').scrollTop}}''')
 assert positions['last']['bottom']<=positions['area']['bottom']+2,positions
 assert positions['area']['bottom']<=positions['foot']['top']+2,positions
 page.screenshot(path=str(D/'screenshot_v16_picker.png'),full_page=True)
 page.locator('#pickerCancel').click()
 page.screenshot(path=str(D/'screenshot_v16_editor.png'),full_page=True)
 assert not errors, errors
 print('PASS v1.6: product grid 2/3/4 cols, nested editable cards, image ratios, CTA variants and picker scroll; no JS errors')
 b.close()
