"""Current-v1.12 navigation regression for the free-form frame (supersedes old DOM-only test)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css','ia-v111.css','editor-ui-kit.css']
JS=['editor-ui-kit.js','catalog.js','components.js','flows.js','composable.js','app.js']
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1480,'height':900})
    errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.set_content((D/'index.html').read_text('utf8'))
    for f in CSS:pg.add_style_tag(content=(D/f).read_text('utf8'))
    for f in JS:pg.add_script_tag(content=(D/f).read_text('utf8'))
    assert pg.locator('#page .preview-block').count()==6
    pg.locator('#addSection').click();pg.locator('[data-picker-id="custom"]').click();pg.locator('#pickerApply').click()
    assert pg.locator('#page .preview-block').count()==7
    sec=pg.locator('#page .preview-block.active')
    assert sec.locator('[data-custom-resize]').count()==1
    # The new inspector keeps freeform sizing in the Layout group; navigation is explicit.
    if pg.locator('[data-ia-group="layout"]').count():pg.locator('[data-ia-group="layout"]').click()
    control=pg.locator('#customHeightInput')
    assert control.count()==1,'freeform height field missing from Layout settings'
    control.fill('580');control.press('Tab')
    sec=pg.locator('#page .preview-block.active')
    assert sec.locator('.am-custom-frame').bounding_box()['height']>=578
    assert control.input_value()=='580'
    # Drag changes the size (after existing manual height), and the inspector tracks it.
    grip=sec.locator('[data-custom-resize]');grip.scroll_into_view_if_needed();box=grip.bounding_box()
    pg.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);pg.mouse.down()
    pg.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2+100,steps=6);pg.mouse.up()
    if pg.locator('[data-ia-group="layout"]').count() and pg.locator('[data-ia-group="layout"]').get_attribute('aria-selected')!='true':pg.locator('[data-ia-group="layout"]').click()
    value=int(pg.locator('#customHeightInput').input_value())
    assert value>580,value
    # Undo may restore the old selected tab. Go through the public hierarchy.
    pg.locator('#undo').click()
    if pg.locator('[data-ia-group="layout"]').count():pg.locator('[data-ia-group="layout"]').click()
    assert int(pg.locator('#customHeightInput').input_value())==580
    pg.locator('#redo').click()
    if pg.locator('[data-ia-group="layout"]').count():pg.locator('[data-ia-group="layout"]').click()
    assert int(pg.locator('#customHeightInput').input_value())==value
    assert not errors,errors
    print('PASS v1.12 freeform: custom section, layout inspector, height input, pointer resize, undo/redo, no JS errors')
    b.close()