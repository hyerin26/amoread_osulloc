"""Editor-wide linked setting contracts: accordion image position, defaults and inspector focus."""
from pathlib import Path
from playwright.sync_api import sync_playwright

D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css',
 'layout-integrity.css','custom-section.css','image-layout-v110.css',
 'ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']
JS=['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1480,'height':840})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((D/'index.html').read_text('utf8'))
 for name in CSS:page.add_style_tag(content=(D/name).read_text('utf8'))
 for name in JS:page.add_script_tag(content=(D/name).read_text('utf8'))

 # Service: all four image positions and none remain valid in accordion mode.
 def paint(pos,presentation='accordion',layout='service'):
  page.evaluate("""({position,presentation,layout})=>{
   const s={layout,name:'안내',items:[{label:'하나',text:'설명 1',imageHint:'이미지 A',openByDefault:true},
    {label:'둘',text:'설명 2',imageHint:'이미지 B',openByDefault:true}],config:{
     imagePosition:position,presentation,columns:'3',density:'comfortable',
     footnote:'상품별 적용 조건 확인'}};
   AMFlow.ensure(s);
   document.querySelector('#page').innerHTML='<section class="preview-block">'+AMFlow.infoPreview(s)+'</section>';
  }""",{'position':pos,'presentation':presentation,'layout':layout})
 def check_visual(position,expected):
  paint(position)
  assert page.locator('.am-ed-accordion').count()==2
  assert page.locator('.am-ed-accordion[open] .am-accordion-visual').count()==2
  assert page.locator('.am-accordion-img-ghost').count()==expected
 for pos in ('none','top','left','right','alternate'):
  check_visual(pos,0 if pos=='none' else 2)
  if pos!='none':
   assert '이미지 A' in page.locator('.am-accordion-img-ghost').first.inner_text()
   assert page.locator('.am-accordion-visual').first.get_attribute('class').find('image-'+('left' if pos=='alternate' else pos))>=0
   if pos=='alternate':
    assert 'image-right' in page.locator('.am-accordion-visual').nth(1).get_attribute('class')
  if pos in ('left','right','alternate'):
   rows=page.locator('.am-accordion-visual').first.evaluate(
    'el=>getComputedStyle(el).gridTemplateColumns.split(/\\s+/).map(parseFloat)')
   assert len(rows)==2 and all(n>30 for n in rows),(pos,rows)
   if pos=='right':
    assert page.locator('.am-accordion-img-ghost').first.evaluate('el=>getComputedStyle(el).order')=='2'

 # Non-image notice and timeline shouldn't produce unexplained images.
 for layout in ('notice','timeline'):
  paint('left','accordion',layout)
  assert page.locator('.am-accordion-img-ghost').count()==0

 # At ultra-small width, side-by-side image and copy should stack.
 page.evaluate("""() => {
  document.querySelector('#page').innerHTML='<div class="preview-block" style="width:220px;container-type:inline-size"><div class="am-ed-accordion-list"><details class="am-ed-accordion" open><summary>안내</summary><div class="am-ed-accordion-content"><div class="am-accordion-visual image-right"><div class="am-flow-img-ghost am-accordion-img-ghost">IMAGE</div><div class="am-accordion-copy">설명</div></div></div></details></div></div>';
 }""")
 cols=page.locator('.am-accordion-visual').evaluate(
    'el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length')
 assert cols==1,('220px accordion should not force split columns',cols)

 # Static layout checks replaced #page with minimal CSS fixtures. Open a
 # fresh editor page before exercising controls; otherwise all [data-page]
 # targets are absent and the test fails even when the application is correct.
 page.close()
 page=browser.new_page(viewport={'width':1480,'height':840})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((D/'index.html').read_text('utf8'))
 for name in CSS:page.add_style_tag(content=(D/name).read_text('utf8'))
 for name in JS:page.add_script_tag(content=(D/name).read_text('utf8'))

 # In the actual editor, changing one setting immediately changes the linked
 # control set, preserves the inactive 3-column value, and can be restored.
 page.locator('#page [data-page="s4"]').click()
 page.locator('[data-ia-group="layout"]').click()
 position=page.locator('[data-bind="config.imagePosition"]')
 position.select_option('top')
 page.locator('[data-column-path="config.columns"][data-columns="3"]').click()
 page.locator('[data-bind="config.presentation"]').select_option('accordion')
 assert page.locator('#panel-body [data-column-path="config.columns"]').count()==0,'Accordion does not use columns'
 assert '펼친' in page.locator('#panel-body').inner_text()
 accordion='#page [data-page="s4"] .am-ed-accordion-list > .am-ed-accordion'
 assert page.locator(accordion).count()==2
 # Click summary to expand and select the corresponding item without wiping state.
 page.locator(accordion+' > summary').nth(1).click()
 assert page.locator(accordion).nth(1).evaluate('el=>el.open')==True
 assert page.locator(accordion+' .am-accordion-img-ghost').count()==2
 assert page.locator('#panel-body [data-inspector-repeat="items:1"].am-inspector-target').count()==1
 assert page.locator('#panel-body [data-bind="items.1.label"]').evaluate('el=>el===document.activeElement')
 # Update image request on the second item and ensure it is visible in its expanded panel.
 page.locator('[data-bind="items.1.imageHint"]').fill('손잡이 리본 연출')
 assert page.locator(accordion).nth(1).evaluate('el=>el.open'),'Typing should not collapse an open item'
 assert '손잡이 리본 연출' in page.locator(accordion+' .am-accordion-img-ghost').nth(1).inner_text()
 page.locator('[data-bind="items.1.openByDefault"]').select_option('false')
 assert page.locator(accordion).nth(1).evaluate('el=>el.open')==False,'False must mean closed, never truthy string'
 page.locator('[data-bind="items.1.openByDefault"]').select_option('true')
 assert page.locator(accordion).nth(1).evaluate('el=>el.open')==True,'True must expand selected item'

 # Switching back preserves column settings and item data.
 page.locator('[data-bind="config.presentation"]').select_option('plain')
 assert page.locator('#panel-body [data-column-path="config.columns"][data-columns="3"][aria-pressed="true"]').count()==1
 assert page.locator('#page [data-page="s4"] .am-flow-info-list.cols-3').count()==1
 page.locator('[data-bind="config.presentation"]').select_option('accordion')
 assert page.locator('#page [data-page="s4"] .am-accordion-img-ghost').count()==2

 # None disables image slots (not just CSS), and the per-item hints remain
 # in the form so it can be restored without losing authored data.
 page.locator('[data-bind="config.imagePosition"]').select_option('none')
 assert page.locator('#page [data-page="s4"] .am-accordion-img-ghost').count()==0
 assert page.locator('[data-bind="items.1.imageHint"]').input_value()=='손잡이 리본 연출'
 page.locator('[data-bind="config.imagePosition"]').select_option('right')
 assert page.locator('#page [data-page="s4"] .am-accordion-img-ghost').count()==2

 assert not errors,errors
 browser.close()
print('PASS v1.12 linked controls: accordion images, alternate sides, preview focus, hidden column persistence and small screens')
