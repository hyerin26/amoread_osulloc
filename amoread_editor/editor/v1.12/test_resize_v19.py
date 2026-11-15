"""v1.9 browser test: freeform frame height and block content flow."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1500,'height':960})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((D/'index.html').read_text(encoding='utf-8'))
 page.evaluate("() => {const m=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}})}")
 for f in ['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css']: page.add_style_tag(content=(D/f).read_text(encoding='utf-8'))
 for f in ['catalog.js','components.js','flows.js','composable.js','app.js']: page.add_script_tag(content=(D/f).read_text(encoding='utf-8'))
 assert page.locator('#page .preview-block').count()==6
 page.locator('#addSection').click();page.locator('[data-picker-id="custom"]').click();page.locator('#pickerApply').click()
 assert page.locator('#page .preview-block').count()==7
 s=page.locator('#page .preview-block.active');h=s.locator('[data-custom-resize]')
 assert h.count()==1
 h.scroll_into_view_if_needed()
 box=h.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 before=s.locator('.am-custom-frame').bounding_box()['height']
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+220,steps=6);page.mouse.up()
 after=s.locator('.am-custom-frame').bounding_box()['height'];assert after>before+150,(before,after)
 page.locator('[data-tab="items"]').click()
 val=int(page.locator('#customHeightInput').input_value());assert val>=360,val
 page.locator('#undo').click();assert page.locator('#customHeightInput').input_value()==''
 page.locator('#redo').click();assert int(page.locator('#customHeightInput').input_value())==val
 page.locator('#customHeightInput').fill('520');page.locator('#customHeightInput').press('Tab')
 assert s.locator('.am-custom-frame').bounding_box()['height']>=520
 page.locator('[data-cb-rail="library"]').click();page.locator('[data-cb-add="productCard"]').click()
 assert s.locator('.am-custom-frame .cb-node--productCard').count()==1
 assert not errors,errors
 print('PASS v1.9: drag, Undo/Redo, exact px entry, embedded card, 7 sections, no JS errors')
 b.close()
