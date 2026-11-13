"""AMOREAD v1.12 customer-preview settings and direct-canvas editing contracts.
Uses only fictional product data. Run: python test_settings_audit_v112.py
"""
from pathlib import Path
import copy, json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css',
 'layout-integrity.css','custom-section.css','image-layout-v110.css',
 'ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']
JS=['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']
STORAGE="""(snapshot) => {const values=new Map(Object.entries(snapshot));
Object.defineProperty(window,'localStorage',{configurable:true,value:{
 getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),
 removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),
 key:i=>[...values.keys()][i]??null,get length(){return values.size;}
}});
window.__amSnapshot=()=>Object.fromEntries(values);
}"""

def mount(page,snapshot=None):
 page.set_content((ROOT/'index.html').read_text('utf8'))
 page.evaluate(STORAGE,snapshot or {})
 for name in CSS:page.add_style_tag(content=(ROOT/name).read_text('utf8'))
 for name in JS:page.add_script_tag(content=(ROOT/name).read_text('utf8'))

def tracks(page,selector):
 return page.locator(selector).first.evaluate("""el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length""")

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1510,'height':900})
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 mount(page)
 assert page.locator('#page .preview-block').count()==6
 # 1. Benefits: columns, item type, spacing, canvas deletion, and undo.
 page.locator('#page [data-page="s2"]').click()
 page.locator('[data-ia-group="layout"]').click()
 page.locator('[data-column-path="config.columns"][data-columns="3"]').click()
 assert tracks(page,'#page [data-page="s2"] .am-flow-info-list')==3,'benefit 3 columns must be visible'
 page.locator('[data-bind="items.0.kind"]').select_option('gift')
 assert page.locator('#page [data-page="s2"] .kind-gift').count()==1,'benefit kind must render'
 page.locator('[data-choice="gap"][data-value="relaxed"]').click()
 gap=page.locator('#page [data-page="s2"] .am-flow-info-list').evaluate('el=>getComputedStyle(el).gap')
 assert gap=='16px',('item gap must update',gap)
 original=page.locator('#page [data-page="s2"] .am-flow-info-item').count()
 page.locator('#page [data-page="s2"] .am-flow-info-item').first.click()
 assert page.locator('#page .am-canvas-toolbar [data-canvas-action="delete"]').count()==1
 page.locator('#page .am-canvas-toolbar [data-canvas-action="delete"]').click()
 assert page.locator('#page [data-page="s2"] .am-flow-info-item').count()==original-1
 page.locator('#undo').click()
 assert page.locator('#page [data-page="s2"] .am-flow-info-item').count()==original
 assert tracks(page,'#page [data-page="s2"] .am-flow-info-list')==3
 # 2. Native product: explicit four columns and independent attribute visibility.
 page.locator('#page [data-page="s3"]').click()
 page.locator('[data-ia-group="layout"]').click()
 page.locator('[data-column-path="layoutColumns.grid2"][data-columns="4"]').click()
 assert tracks(page,'#page [data-page="s3"] .mock-products')==4
 name_a='#page [data-page="s3"] .mock-product[data-card-product="D001"] .mock-el--name'
 name_b='#page [data-page="s3"] .mock-product[data-card-product="D002"] .mock-el--name'
 assert page.locator(name_a).count()==1 and page.locator(name_b).count()==1
 page.locator(name_a).click()
 assert '상품명' in page.locator('#page .am-canvas-toolbar').inner_text()
 page.keyboard.press('Delete')
 assert page.locator(name_a).count()==0,'selected card attribute should disappear only here'
 assert page.locator(name_b).count()==1,'other product must keep the same attribute'
 assert page.locator('details.cb-card-elements-advanced').count()>=1,'per-card controls should allow restoration'
 page.locator('details.cb-card-elements-advanced').first.locator('summary').click()
 page.locator('[data-native-visible="D001:name"]').check()
 assert page.locator(name_a).count()==1
 # 3. Hero: positional variant and independently retained image ratio.
 page.locator('#page [data-page="s1"]').click()
 page.locator('[data-ia-group="layout"]').click()
 assert page.locator('[data-bind="config.imagePosition"]').count()==1
 page.locator('[data-bind="config.imagePosition"]').select_option('side')
 assert page.locator('#page [data-page="s1"] .am-flow-info-hero.position-side').count()==1
 page.locator('[data-bind="config.height"]').select_option('small')
 assert page.locator('#page [data-page="s1"] .am-flow-info-hero.height-small').count()==1
 page.locator('[data-ia-group="layout"]').click()
 page.locator('[data-choice="imageRatio"][data-value="9:16"]').click()
 ratio=page.locator('#page [data-page="s1"] .am-flow-img-ghost').first.evaluate(
    'el=>{const r=el.getBoundingClientRect();return r.width/r.height}')
 assert abs(ratio-9/16)<.08,ratio
 # 4. Inserted block: deletion and undo without touching the parent section.
 page.locator('#page [data-page="s4"]').click()
 page.locator('[data-cb-rail="library"]').click()
 page.locator('[data-ia-library="blocks"]').click()
 page.locator('[data-cb-add="text"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node--text').count()==1
 page.locator('#page [data-page="s4"] .cb-node--text').click()
 page.locator('#page .am-canvas-toolbar [data-canvas-action="delete"]').click()
 assert page.locator('#page [data-page="s4"] .cb-node--text').count()==0
 page.locator('#undo').click()
 assert page.locator('#page [data-page="s4"] .cb-node--text').count()==1
 # 5. Deal banner: previously invisible product controls now affect its preview.
 snapshot=page.evaluate('JSON.parse(localStorage.getItem("amoread-lab-v09"))')
 assert snapshot and snapshot.get('sections')
 deal=copy.deepcopy(next(s for s in snapshot['sections'] if s['id']=='s3'))
 deal.update({'id':'s_audit_deal','layout':'deal-banner','name':'테스트 특가','ctaOn':True,'cta':'상품 확인'})
 deal.pop('config',None)
 snapshot['sections'].append(deal)
 snapshot['current']='s_audit_deal'
 snapshot['tab']='copy'
 second=browser.new_page(viewport={'width':1510,'height':900})
 second.on('pageerror',lambda error:errors.append(str(error)))
 mount(second,{'amoread-lab-v09':json.dumps(snapshot,ensure_ascii=False)})
 assert second.locator('#page [data-page="s_audit_deal"] .mock-products .mock-product').count()>=1
 second.locator('[data-ia-group="operation"]').click()
 assert second.locator('[data-bind="config.previewState"]').count()==1
 second.locator('[data-bind="config.previewState"]').select_option('expired')
 assert second.locator('#page [data-page="s_audit_deal"] > .mock-cta').count()==0
 second.locator('[data-bind="config.after"]').select_option('show-result')
 assert '행사 결과 확인' in second.locator('#page [data-page="s_audit_deal"] > .mock-cta').inner_text()
 assert not errors,errors
 browser.close()
print('PASS v1.12 full settings audit: benefit columns/kind/gap, canvas delete and undo, per-card override, hero settings, deal banner CTA')
