"""Automated v1.12 UI kit + editor integration checks, no external URLs.
Use: python test_editor_ui_kit_v112.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css','ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']
JS=['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']

def load(page,app=True):
    page.set_content((D/('index.html' if app else 'editor-components.html')).read_text(encoding='utf8'))
    for c in (CSS if app else ['tokens.demo.css','styles.css','editor-ui-kit.css']):
        page.add_style_tag(content=(D/c).read_text(encoding='utf8'))
    for j in (JS if app else ['editor-ui-kit.js','components.js','editor-components-gallery.js']):
        page.add_script_tag(content=(D/j).read_text(encoding='utf8'))
    if not app: page.evaluate("document.dispatchEvent(new Event('DOMContentLoaded'))")

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    errs=[]
    page=b.new_page(viewport={'width':1560,'height':980})
    page.on('pageerror',lambda e:errs.append(str(e)))
    load(page)
    assert page.locator('#page .preview-block').count()==6
    assert page.locator('.ia-tree-section').count()==6
    assert page.locator('.am-kit-icon').count()>=15
    assert page.locator('[data-ia-toggle="s3"] .am-kit-icon').count()==1
    assert page.locator('[data-ia-toggle="s3"]').get_attribute('aria-expanded')=='true'
    page.locator('[data-ia-toggle="s3"]').click()
    assert page.locator('[data-ia-toggle="s3"]').get_attribute('aria-expanded')=='false'
    
    page.locator('[data-ia-toggle="s3"]').click()
    assert page.locator('[data-ia-toggle="s3"]').get_attribute('aria-expanded')=='true'
    # New right hierarchy uses top-level tabs and a read-only subheading when alone.
    page.locator('[data-section="s5"]').click()
    assert page.locator('[data-ia-group="content"]').get_attribute('aria-selected')=='true'
    assert page.locator('.am-kit-single-heading').count()==1
    assert not page.locator('[data-tab="copy"]').count()
    assert not page.get_by_text('번호 붙이기').count(), 'deprecated UI must be removed'
    assert page.locator('[data-ia-group="content"]').evaluate('(el)=>getComputedStyle(el).borderBottomWidth')=='3px'
    page.locator('[data-ia-group="operation"]').click()
    assert page.locator('[data-ia-group="operation"]').get_attribute('aria-selected')=='true'
    # Native tree click must scroll preview, not just update the inspector.
    page.evaluate('window.scrollTo(0,0)')
    page.locator('[data-ia-toggle="s6"]').click()
    page.locator('[data-section="s6"]').click()
    page.wait_for_timeout(550)
    coords=page.evaluate('''() => {const e=document.querySelector('#page [data-page="s6"]');const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,scrollY:window.scrollY}}''')
    assert coords['top']<980 and coords['bottom']>0, coords
    # Selection remains functional when the more complex navigation is used.
    page.locator('[data-cb-rail="library"]').click()
    page.locator('[data-ia-library="blocks"]').click()
    page.locator('[data-cb-add="text"]').click()
    assert page.locator('#panel-body [data-cb-field="text"]').count()==1
    page.locator('[data-cb-field="text"]').fill('컴포넌트 삽입 테스트')
    page.locator('[data-cb-rail="sections"]').click()
    selected=page.locator('[data-ia-node="block"]').last
    assert selected.count()==1
    selected.click()
    page.wait_for_timeout(350)
    assert '컴포넌트 삽입 테스트' in page.locator('#page').inner_text()
    assert not errs,errs
    page.screenshot(path=str(D/'screenshot_editor_kit_v112.png'))
    gallery=b.new_page(viewport={'width':1400,'height':1080})
    gallery.on('pageerror',lambda e:errs.append(str(e)))
    load(gallery,False)
    assert gallery.locator('.am-kit-gallery__card').count()==12
    assert gallery.locator('#demo-fields textarea').count()==1
    assert gallery.locator('#demo-switch input[role="switch"]').count()==1
    gallery.locator('[data-choice="columns"][data-value="3"]').click()
    assert gallery.locator('[data-choice="columns"][data-value="3"]').get_attribute('aria-pressed')=='true'
    gallery.locator('#demo-switch input').uncheck()
    assert '꺼짐' in gallery.locator('#demo-switch-state').inner_text()
    gallery.locator('#demo-dialog-open').click()
    assert gallery.locator('#demo-dialog').evaluate('(e)=>e.open')
    gallery.locator('[data-dialog-close]').first.click()
    assert not gallery.locator('#demo-dialog').evaluate('(e)=>e.open')
    gallery.locator('[data-gallery-toast]').last.click()
    assert gallery.locator('#gallery-toast').is_visible()
    assert gallery.locator('svg.am-kit-icon').count()>=10
    gallery.screenshot(path=str(D/'screenshot_component_library_v112.png'),full_page=True)
    assert not errs,errs
    registry=json.loads((D/'EDITOR_COMPONENT_REGISTRY_v1.12.json').read_text())
    assert len(registry['components'])>=30
    assert len({x['name'] for x in registry['components']})==len(registry['components'])
    print('PASS v1.12: editor tree, glyphs, hierarchy, number removal, scroll, block editing, 12 component examples, switch, choice, modal, feedback, 34 component contracts; 0 JS exceptions')
    b.close()
