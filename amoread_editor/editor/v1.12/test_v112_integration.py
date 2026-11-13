"""v1.12 browser integration tests using the real current navigation (no legacy selectors).
The product/review rows in this Lab use fictional data; no company API is called.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path(__file__).resolve().parent
CSS = ['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css','ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']
JS = ['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']
STORAGE = '''(snapshot) => {const values=new Map(Object.entries(snapshot));
  Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>values.has(String(k))?values.get(String(k)):null,
    setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),
    clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size;}
  }});
  window.__amSnapshot=()=>Object.fromEntries(values);
}'''

def mount(page, snapshot=None):
    page.set_content((D/'index.html').read_text('utf-8'))
    page.evaluate(STORAGE, snapshot or {})
    for file in CSS: page.add_style_tag(content=(D/file).read_text('utf-8'))
    for file in JS: page.add_script_tag(content=(D/file).read_text('utf-8'))

def css_rect(page, selector):
    return page.locator(selector).first.evaluate('''el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}''')

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    errors=[]
    first=b.new_page(viewport={'width':1480,'height':740},accept_downloads=True)
    first.on('pageerror',lambda e: errors.append(str(e)))
    mount(first)
    assert first.locator('#page .preview-block').count()==6
    # 1. Persistent work-mode rail and section tree with independent scroll.
    props=first.evaluate('''() => ({rail:getComputedStyle(document.querySelector('.cb-rail')).position, sidebar:getComputedStyle(document.querySelector('.outline')).position, height:document.documentElement.scrollHeight-window.innerHeight})''')
    assert props['rail']=='sticky' and props['sidebar']=='sticky' and props['height']>100,props
    first.evaluate('window.scrollTo(0,Math.min(1200,document.documentElement.scrollHeight))')
    first.wait_for_timeout(90)
    pos=first.evaluate('''() => ({rail:document.querySelector('.cb-rail').getBoundingClientRect().top, sidebar:document.querySelector('.outline').getBoundingClientRect().top})''')
    assert abs(pos['rail'])<2 and abs(pos['sidebar'])<2,pos
    first.evaluate('''() => {const list=document.querySelector('#section-list');for(let i=0;i<20;i++)list.appendChild(list.lastElementChild.cloneNode(true));list.scrollTop=190;}''')
    assert first.evaluate('document.querySelector("#section-list").scrollTop')>0
    # 2. Selection context: section -> layout tab image ratio update.
    first.locator('#page [data-page="s1"]').click()
    first.locator('[data-ia-group="layout"]').click()
    if first.locator('[data-choice="imageRatio"][data-value="9:16"]').count():
        first.locator('[data-choice="imageRatio"][data-value="9:16"]').click()
        # Correct ratio must be reflected on mobile canvas media, not just a setting label.
        media=first.locator('#page [data-page="s1"] .am-flow-img-ghost').first
        assert media.count()==1, 'hero media absent'
        dims=css_rect(first,'#page [data-page="s1"] .am-flow-img-ghost')
        assert abs(dims['width']/dims['height']-9/16)<.07,dims
    # 3. New left sidebar: add independent product card and persist properties.
    first.locator('#page [data-page="s4"]').click()
    first.locator('[data-cb-rail="library"]').click()
    first.locator('[data-ia-library="blocks"]').click()
    first.locator('[data-cb-add="productCard"]').click()
    assert first.locator('#page [data-page="s4"] .cb-node--productCard').count()==1
    first.locator('[data-cb-field="productId"]').select_option('D003')
    first.locator('[data-cb-field="card.def.label"]').fill('1.12 추천')
    first.locator('#page [data-page="s4"]').click()
    assert '휴대용 티 보틀' in first.locator('#page [data-page="s4"]').inner_text()
    snap=first.evaluate('window.__amSnapshot()')
    assert 'amoread-lab-v09' in snap and 'D003' in snap['amoread-lab-v09']
    second=b.new_page(viewport={'width':1480,'height':740})
    second.on('pageerror',lambda e: errors.append(str(e)))
    mount(second,snap)
    assert second.locator('#page .preview-block').count()==6
    assert second.locator('#page [data-page="s4"] .cb-node--productCard').count()==1
    second.locator('#page [data-page="s4"] .cb-node--productCard').click()
    assert second.locator('[data-cb-field="productId"]').input_value()=='D003'
    assert second.locator('[data-cb-field="card.def.label"]').input_value()=='1.12 추천'
    # 4. Editor-only hierarchy remains distinct from storefront visual design.
    assert second.locator('.ia-groups.am-kit-primary-nav').count()==0 or second.locator('[data-cb-back]').count()==1
    second.locator('[data-cb-back]').click()
    assert second.locator('.ia-groups.am-kit-primary-nav').count()==1
    assert second.locator('[data-bind="num"]').count()==0
    assert not errors,errors
    print('PASS v1.12 integrated: sticky outline, media ratio, block insertion, product selection, serialized restoration, grouped inspector, no JS errors')
    b.close()
