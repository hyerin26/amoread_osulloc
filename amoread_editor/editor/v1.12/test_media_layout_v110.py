"""AMOREAD v1.10 media layout regressions; no HTTP required."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css']
JS=['catalog.js','components.js','flows.js','composable.js','app.js']
def box(page,sel):
 return page.locator(sel).first.evaluate('(el)=>{let x=el.getBoundingClientRect();return {x:x.x,y:x.y,w:x.width,h:x.height}}')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 pg=b.new_page(viewport={'width':1500,'height':960});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content((D/'index.html').read_text())
 for c in CSS:pg.add_style_tag(content=(D/c).read_text())
 for j in JS:pg.add_script_tag(content=(D/j).read_text())
 assert pg.locator('#page .preview-block').count()==6
 pg.locator('[data-page="s3"]').click();pg.locator('[data-tab="shape"]').click()
 img='#page [data-page="s3"] .mock-product-media .mock-product-image'
 z=box(pg,img);assert abs(z['w']/z['h']-1)<.04
 pg.locator('[data-element="label"]').check()
 for corner in ['top-left','top-right','bottom-left','bottom-right']:
  pg.locator('[data-choice="card.def.labelPosition"][data-value="'+corner+'"]').click()
  frame=box(pg,'#page [data-page="s3"] .mock-product-media');badge=box(pg,'#page [data-page="s3"] .mock-card-label--corner')
  dx=badge['x']-frame['x'] if corner.endswith('left') else frame['x']+frame['w']-badge['x']-badge['w']
  dy=badge['y']-frame['y'] if corner.startswith('top') else frame['y']+frame['h']-badge['y']-badge['h']
  assert abs(dx)<1.2 and abs(dy)<1.2,(corner,dx,dy)
 for ratio,expected in [('3:4',.75),('16:9',16/9),('1:1',1)]:
  pg.locator('[data-choice="imageRatio"][data-value="'+ratio+'"]').click()
  z=box(pg,img);assert abs(z['w']/z['h']-expected)<.06,(ratio,z)
 pg.locator('[data-tab="products"]').click()
 for pid in ['D003','D004']:pg.locator('[data-product="'+pid+'"]').check()
 pg.locator('[data-tab="shape"]').click()
 for view in ['grid','masonry']:
  pg.locator('[data-product-style="'+view+'"]').click()
  for cols in [1,2,3,4]:
   pg.locator('[data-column-path="layoutColumns.grid2"][data-columns="'+str(cols)+'"]').click()
   x=pg.locator('#page [data-page="s3"] .mock-products')
   count=x.evaluate('(el)=>getComputedStyle(el).gridTemplateColumns.split(" ").length') if view=='grid' else x.evaluate('(el)=>getComputedStyle(el).columnCount')
   assert int(count)==cols,(view,cols,count)
 for view in ['list','card']:
  pg.locator('[data-product-style="'+view+'"]').click()
  assert not pg.locator('[data-column-path]').count()
 pg.locator('[data-product-style="grid"]').click()
 assert pg.locator('[data-column-path="layoutColumns.grid2"][data-columns="4"]').get_attribute('aria-pressed')=='true'
 pg.locator('[data-product-style="carousel"]').click()
 assert pg.locator('.am-ed-column-section h3').inner_text()=='한 화면에 보이는 카드 수'
 for count in [1,2,3,4]:
  pg.locator('[data-column-path="layoutColumns.grid2"][data-columns="'+str(count)+'"]').click()
  val=pg.locator('#page [data-page="s3"] .mock-products').evaluate('(el)=>el.querySelector(".mock-product").getBoundingClientRect().width/el.getBoundingClientRect().width')
  assert abs(val-1/count)<.12,(count,val)
 pg.locator('[data-page="s1"]').click();pg.locator('[data-choice="imageRatio"][data-value="9:16"]').click()
 z=box(pg,'#page [data-page="s1"] .am-flow-img-ghost')
 assert abs(z['w']/z['h']-9/16)<.04,z
 assert not errors,errors
 print('PASS v1.10: anchored responsive labels, 1:1 product default, image ratio, view-aware 1–4 columns, carousel count, legacy section retention')
 b.close()
