"""Sticky left rail / sidebar scroll regression; no HTTP required."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
CSS=('tokens.demo.css','styles.css','composable.css','editor-spacing.css')
JS=('catalog.js','components.js','flows.js','composable.js','app.js')

def mount(page):
 page.set_content((D/'index.html').read_text(encoding='utf8'))
 for file in CSS: page.add_style_tag(content=(D/file).read_text(encoding='utf8'))
 for file in JS: page.add_script_tag(content=(D/file).read_text(encoding='utf8'))

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 errors=[]
 page=browser.new_page(viewport={'width':1440,'height':740})
 page.on('pageerror', lambda e:errors.append(str(e)))
 mount(page)
 assert page.locator('#section-list .outline-entry').count()>=6
 dims=page.evaluate('''() => ({max:document.documentElement.scrollHeight-innerHeight, rail:getComputedStyle(document.querySelector('.cb-rail')).position, sidebar:getComputedStyle(document.querySelector('.outline')).position})''')
 assert dims['rail']=='sticky' and dims['sidebar']=='sticky',dims
 assert dims['max']>200,('Page not long enough for sticky test',dims)
 page.evaluate('window.scrollTo(0,Math.min(1000,document.documentElement.scrollHeight))')
 page.wait_for_timeout(120)
 after=page.evaluate('''() => ({rail:document.querySelector('.cb-rail').getBoundingClientRect().top, sidebar:document.querySelector('.outline').getBoundingClientRect().top, scrollY:scrollY, sideHeight:document.querySelector('.outline').getBoundingClientRect().height})''')
 assert after['scrollY']>150,after
 assert abs(after['rail'])<=2 and abs(after['sidebar'])<=2,after
 assert abs(after['sideHeight']-740)<=2,after
 # Make sidebar list longer without changing application state to verify independent scrolling.
 page.evaluate('''() => {const list=document.querySelector('#section-list'); for(let i=0;i<16;i++)list.appendChild(list.lastElementChild.cloneNode(true));}''')
 scroll=page.evaluate('''() => {const list=document.querySelector('#section-list'); const rootBefore=window.scrollY;list.scrollTop=180;return {listTop:list.scrollTop,windowY:window.scrollY,rootBefore,overflow:getComputedStyle(list).overflowY}}''')
 assert scroll['overflow']=='auto' and scroll['listTop']>0 and scroll['windowY']==scroll['rootBefore'],scroll
 # Elements panel should stay reachable with the rail sticky too.
 page.locator('[data-cb-rail="library"]').click()
 assert page.locator('[data-cb-add="productCard"]').count()==1
 assert abs(page.locator('.cb-rail').bounding_box()['y'])<=2
 page.screenshot(path=str(D/'screenshot_sticky_desktop.png'),full_page=False)
 # Narrow responsive mode keeps only the compact mode switch bar pinned.
 mobile=browser.new_page(viewport={'width':390,'height':640})
 mobile.on('pageerror',lambda e:errors.append(str(e)))
 mount(mobile)
 mobile.evaluate('window.scrollTo(0,700)')
 mobile.wait_for_timeout(100)
 slim=mobile.evaluate('''() => ({mode:getComputedStyle(document.querySelector('.cb-rail')).position,y:document.querySelector('.cb-rail').getBoundingClientRect().y,outline:getComputedStyle(document.querySelector('.outline')).position,width:document.documentElement.scrollWidth,viewport:window.innerWidth})''')
 assert slim['mode']=='sticky' and abs(slim['y'])<=2 and slim['outline']!='sticky',slim
 assert slim['width']<=slim['viewport']+3,slim
 mobile.screenshot(path=str(D/'screenshot_sticky_mobile.png'),full_page=False)
 assert not errors,errors
 print('PASS v1.6.2: left rail and outline remain visible, left list scroll is independent, tabs and mobile switch remain reachable; no JS errors')
 browser.close()
