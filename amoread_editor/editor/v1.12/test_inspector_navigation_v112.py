"""AMOREAD v1.12: canvas/outline -> exact inspector row navigation and horizontal alignment."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css',
 'layout-integrity.css','custom-section.css','image-layout-v110.css',
 'ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']
JS=['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,
      executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,
      args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1480,'height':850})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((ROOT/'index.html').read_text('utf8'))
    for name in CSS: page.add_style_tag(content=(ROOT/name).read_text('utf8'))
    for name in JS: page.add_script_tag(content=(ROOT/name).read_text('utf8'))
    page.locator('#page [data-page="s2"]').click()
    page.locator('[data-ia-group="layout"]').click()
    page.locator('#panel-body [data-action="add:items"]').click()
    assert page.locator('#page [data-page="s2"] .am-flow-info-item').count()>=3

    # A click on the second benefit selects exactly its second inspector card,
    # changes the subgroup only if required, scrolls the right panel, and focuses
    # that card's title rather than the first card or the entire section.
    page.locator('#page [data-page="s2"] .am-flow-info-item').nth(1).click()
    row=page.locator('#panel-body [data-inspector-repeat="items:1"]')
    assert row.count()==1 and 'am-inspector-target' in row.get_attribute('class')
    assert page.locator('#panel-body .am-inspector-target').count()==1
    assert page.locator('#panel-body [data-bind="items.1.label"]').evaluate('el=>el===document.activeElement')
    assert page.locator('[data-ia-group="layout"][aria-selected="true"]').count()==1
    inside=row.evaluate("""el=>{
       const box=document.getElementById('panel-body').getBoundingClientRect();
       const r=el.getBoundingClientRect();
       return r.top>=box.top-2&&r.top<box.bottom;
    }""")
    assert inside,'selected benefit should be revealed within right-panel scroll'

    # Sequential selection updates the target, not just the sticky selection bar.
    page.locator('#page [data-page="s2"] .am-flow-info-item').nth(2).click()
    assert page.locator('#panel-body [data-inspector-repeat="items:2"].am-inspector-target').count()==1
    assert page.locator('#panel-body [data-bind="items.2.label"]').evaluate('el=>el===document.activeElement')
    assert page.locator('#panel-body [data-inspector-repeat="items:1"].am-inspector-target').count()==0

    # Outline selection has the same inspector reveal behavior.
    page.locator('#section-list [data-ia-node="item"][data-ia-section="s2"][data-ia-index="0"]').click()
    assert page.locator('#panel-body [data-inspector-repeat="items:0"].am-inspector-target').count()==1

    # Section alignment is visually centered and right-aligned including headings,
    # benefit-card text, and floating CTA instead of only text-align on a nested span.
    page.locator('#page [data-page="s2"]').click()
    page.locator('[data-ia-group="layout"]').click()
    page.locator('[data-choice="align"][data-value="center"]').click()
    section='#page [data-page="s2"]'
    assert page.locator(section+' > h3').evaluate('el=>getComputedStyle(el).textAlign')=='center'
    assert page.locator(section+' .am-flow-info-item > div:last-child').first.evaluate(
     'el=>getComputedStyle(el).justifyItems')=='center'
    assert page.locator(section+' > h3').evaluate("""el=>{
      const r=el.getBoundingClientRect(),section=el.parentElement.getBoundingClientRect(),
      s=getComputedStyle(el);return Math.abs((r.left+parseFloat(s.paddingLeft)+
      (r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight))/2)-
      (section.left+section.width/2))<2;
    }"""),'visible heading center must coincide with section center'
    page.locator('[data-choice="align"][data-value="right"]').click()
    assert page.locator(section+' > h3').evaluate('el=>getComputedStyle(el).textAlign')=='right'
    assert page.locator(section+' .am-flow-info-item > div:last-child').first.evaluate(
     'el=>getComputedStyle(el).justifyItems')=='end'

    # Selecting a product card or an inner product attribute opens the appropriate
    # per-product details panel; clicking different cards never stays on card one.
    first='#page [data-page="s3"] .mock-products .mock-product[data-card-product="D001"]'
    second='#page [data-page="s3"] .mock-products .mock-product[data-card-product="D002"]'
    assert page.locator(first).count() and page.locator(second).count()
    page.locator(second).click()
    assert page.locator('#panel-body details.cb-card-elements-advanced[open]').count()==1
    assert page.locator('#panel-body .am-inspector-target').count()==1
    page.locator(first+' .mock-el--name').click()
    assert page.locator('#panel-body [data-native-visible="D001:name"]').count()==1
    assert page.locator('#panel-body [data-native-visible="D001:name"]').evaluate(
      'el=>el===document.activeElement')
    assert page.locator('#panel-body details.cb-card-elements-advanced[open]').count()==1

    # Basic text block selection should reveal its specific field without forcing
    # the user's entire document to scroll to the first group.
    page.locator('#page [data-page="s4"]').click()
    page.locator('[data-cb-rail="library"]').click()
    page.locator('[data-ia-library="blocks"]').click()
    page.locator('[data-cb-add="text"]').click()
    block=page.locator('#page [data-page="s4"] .cb-node--text').first
    block.click()
    assert page.locator('#panel-body [data-cb-field="text"]').count()==1
    assert page.locator('#panel-body [data-cb-field="text"]').evaluate(
       'el=>el===document.activeElement')

    # Text+CTA's distinct alignment must be reflected on the rendered component.
    page.evaluate("""() => {
     const el=document.querySelector('#page');
     el.insertAdjacentHTML('beforeend',
       '<section class="preview-block am-align-left"><div class="am-flow-info-text align-left"><strong>내용</strong></div></section>');
    }""")
    assert page.locator('#page .am-flow-info-text.align-left').evaluate(
      'el=>getComputedStyle(el).justifyItems')=='start'
    page.locator('#page .am-flow-info-text.align-left').evaluate("el=>el.className='am-flow-info-text align-center'")
    assert page.locator('#page .am-flow-info-text.align-center').evaluate(
      'el=>getComputedStyle(el).justifyItems')=='center'
    assert not errors,errors
    browser.close()
print('PASS v1.12 inspector navigation: exact benefit row, right panel scroll, outline, product attribute focus, section and text alignment')
