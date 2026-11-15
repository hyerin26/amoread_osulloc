"""CSS/render contract for layout variants shared by the 22-section editor catalog.
Checks rendered properties (not just saved strings) using fictional data.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css',
 'layout-integrity.css','custom-section.css','image-layout-v110.css',
 'ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']
JS=['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1460,'height':820})
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content((D/'index.html').read_text('utf8'))
 for name in CSS:page.add_style_tag(content=(D/name).read_text('utf8'))
 for name in JS:page.add_script_tag(content=(D/name).read_text('utf8'))
 def paint(layout,config=None,items=None):
  page.evaluate("""({layout,config,items})=>{
   const s={layout,config:config||{},items:items||[],ev:{ui:{}},name:'테스트 구좌',role:''};
   const markup=window.AMFlow.infoPreview(s);
   document.querySelector('#page').innerHTML='<section class="preview-block">'+markup+'</section>';
  }""",{'layout':layout,'config':config or {},'items':items or []})
 def tracks(selector):
  return page.locator(selector).evaluate('el=>getComputedStyle(el).gridTemplateColumns.split(/\\s+/).map(parseFloat)')
 # Split ratio is visible in both image-left and image-right modes.
 paint('split',{'imagePosition':'right','ratio':'visual','imageHint':'분할 비주얼'})
 parts=tracks('.am-flow-info-split')
 assert len(parts)==2 and parts[1]>parts[0]*1.7,parts
 assert page.locator('.am-flow-info-split.right').count()==1
 paint('split',{'imagePosition':'left','ratio':'copy'})
 parts=tracks('.am-flow-info-split')
 assert parts[1]>parts[0]*1.7,parts
 # Alternate images are truly reordered for service/detail, not story only.
 items=[{'label':'첫 번째','text':'설명'},{'label':'두 번째','text':'설명'}]
 paint('service',{'imagePosition':'alternate','columns':'1'},items)
 assert page.locator('.am-flow-img-ghost').count()==2
 orders=page.locator('.am-flow-img-ghost').evaluate_all('els=>els.map(el=>getComputedStyle(el).order)')
 assert orders[0]!=orders[1],orders
 # Accordion density changes actual padding and spacing.
 config={'presentation':'accordion','density':'compact'}
 paint('notice',config,items)
 compact=page.locator('.am-ed-accordion summary').first.evaluate('el=>getComputedStyle(el).paddingTop')
 config['density']='spacious'
 paint('notice',config,items)
 spacious=page.locator('.am-ed-accordion summary').first.evaluate('el=>getComputedStyle(el).paddingTop')
 assert float(compact.replace('px',''))<float(spacious.replace('px','')),(compact,spacious)
 # Compact text-CTA uses a different text size, not just a saved flag.
 paint('text-cta',{'emphasis':'compact'})
 small=page.locator('.am-flow-info-text strong').evaluate('el=>getComputedStyle(el).fontSize')
 paint('text-cta',{'emphasis':'lead'})
 large=page.locator('.am-flow-info-text strong').evaluate('el=>getComputedStyle(el).fontSize')
 assert float(small.replace('px',''))<float(large.replace('px','')),(small,large)
 # Inserted card compact density must affect inset, keeping image ratio unchanged.
 page.evaluate("""() => {
 document.querySelector('#page').innerHTML='<section class="preview-block"><div class="mock-product cb-product-card cb-compact"><div class="mock-product-media" style="--am-product-aspect:3 / 4"><div class="mock-product-image">이미지</div></div><strong class="mock-card-name">작은 카드</strong></div><div class="mock-product cb-product-card"><div class="mock-product-media" style="--am-product-aspect:3 / 4"><div class="mock-product-image">이미지</div></div><strong class="mock-card-name">기본 카드</strong></div></section>';
 }""")
 compact_inset=page.locator('.cb-product-card.cb-compact').evaluate('el=>getComputedStyle(el).paddingLeft')
 regular_inset=page.locator('.cb-product-card:not(.cb-compact)').evaluate('el=>getComputedStyle(el).paddingLeft')
 assert float(compact_inset.replace('px',''))<float(regular_inset.replace('px','')),(compact_inset,regular_inset)
 ratio=page.locator('.cb-product-card.cb-compact .mock-product-image').evaluate(
  'el=>{const r=el.getBoundingClientRect();return r.width/r.height}')
 assert abs(ratio-.75)<.06,ratio
 assert not errors,errors
 browser.close()
print('PASS v1.12 settings matrix: split, alternate media, accordion density, text density, compact product ratio')
