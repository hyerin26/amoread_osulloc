"""AMOREAD v1.12 card disclosures and left/right reorder by real browser input."""
from pathlib import Path
from playwright.sync_api import sync_playwright

D=Path(__file__).resolve().parent
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
 page.set_content((D/'index.html').read_text('utf8'))
 for name in CSS: page.add_style_tag(content=(D/name).read_text('utf8'))
 for name in JS: page.add_script_tag(content=(D/name).read_text('utf8'))

 # (1) Default product inspector is compact: one row per element, zero forms.
 page.locator('#page [data-page="s4"]').click()
 page.locator('[data-cb-rail="library"]').click()
 page.locator('[data-ia-library="blocks"]').click()
 page.locator('[data-cb-add="productCard"]').click()
 card=page.locator('#page [data-page="s4"] .cb-node--productCard').first
 card.click(position={'x':3,'y':3})  # Select the card shell, not its inner image property.
 panel='#panel-body'
 details=page.locator(panel+' details.cb-card-elements-advanced')
 assert details.count()==1 and details.evaluate('el=>el.open')
 assert page.locator(panel+' [data-cb-row]').count()==16
 assert page.locator(panel+' [data-cb-field="card.def.label"]').count()==0
 assert page.locator(panel+' [data-cb-field="card.def.copy"]').count()==0
 assert page.locator(panel+' [data-cb-field="imageRatio"]').count()==0
 assert page.locator(panel+' [data-cb-expand="label"]').count()==0
 assert page.locator(panel+' [data-cb-expand="name"]').count()==0

 # (2) Editing an enabled element reveals only its associated controls.
 page.locator(panel+' [data-cb-expand="img"]').click()
 assert page.locator(panel+' [data-cb-field="imageRatio"]').count()==1
 assert page.locator(panel+' [data-cb-field="card.def.copy"]').count()==0
 assert page.locator(panel+' [data-cb-sort-list]').evaluate(
   'el=>getComputedStyle(el).overflowY')=='auto'

 # (3) Enable label; its settings only appear after explicit expand.
 page.locator(panel+' [data-cb-visible="label"]').check()
 assert page.locator(panel+' [data-cb-field="card.def.label"]').count()==0
 page.locator(panel+' [data-cb-expand="label"]').click()
 assert page.locator(panel+' [data-cb-field="card.def.label"]').count()==1
 assert page.locator(panel+' [data-cb-field="card.def.labelPosition"]').count()==1
 assert page.locator(panel+' [data-cb-row="label"]').get_attribute('draggable')=='false'
 assert page.locator(panel+' [data-cb-field="imageRatio"]').count()==0
 page.locator(panel+' [data-cb-field="card.def.label"]').fill('새 라벨')
 assert '새 라벨' in card.inner_text()
 # Linked properties are conditional on image actually being enabled.
 page.locator(panel+' [data-cb-visible="img"]').uncheck()
 assert page.locator(panel+' [data-cb-field="card.def.labelPosition"]').count()==0
 assert page.locator(panel+' [data-cb-row="label"]').get_attribute('draggable')=='true'
 assert page.locator(panel+' [data-cb-field="card.def.label"]').input_value()=='새 라벨'
 page.locator(panel+' [data-cb-visible="img"]').check()
 assert page.locator(panel+' [data-cb-field="card.def.labelPosition"]').count()==1

 # (4) Card element reorder via HTML5 drag and undo.
 def row_order():
  return page.locator(panel+' [data-cb-row]').evaluate_all(
   'els=>els.map(el=>el.dataset.cbRow)')
 # The 16-row list is its own scroll box (overflowY asserted above). Playwright's drag_to scrolls that box
 # between mousedown and move, so the pointer lands on another row. Unclip it to test the reorder logic itself.
 page.locator(panel+' [data-cb-sort-list]').evaluate("el=>{el.style.maxHeight='none';el.style.overflow='visible'}")
 initial=row_order()
 assert initial.index('name')<initial.index('sale')
 page.locator(panel+' [data-cb-row="name"]').drag_to(
    page.locator(panel+' [data-cb-row="sale"]'))
 reordered=row_order()
 assert reordered.index('name')>reordered.index('sale'),reordered
 assert page.locator('#page [data-page="s4"] .mock-el--sale').first.evaluate(
  "el=>el.compareDocumentPosition(el.closest('.mock-product').querySelector('.mock-el--name')) & Node.DOCUMENT_POSITION_FOLLOWING")==4
 page.locator('#undo').click()
 # Undo should restore the data (not merely reorder HTML nodes).
 card=page.locator('#page [data-page="s4"] .cb-node--productCard').first
 assert card.count()==1
 card.click()
 assert row_order().index('name')<row_order().index('sale')

 # (5) Left native benefit order: same-section drag, visual order, undo.
 page.locator('[data-cb-rail="sections"]').click()
 page.locator('#page [data-page="s2"]').click()
 nodes=page.locator('#section-list [data-ia-sort="item"][data-ia-section="s2"]')
 assert nodes.count()>=2
 original=page.locator('#page [data-page="s2"] .am-flow-info-item strong').all_inner_texts()
 nodes.nth(0).drag_to(nodes.nth(1))
 after=page.locator('#page [data-page="s2"] .am-flow-info-item strong').all_inner_texts()
 assert after[:2]==original[:2][::-1],(original,after)
 page.locator('#undo').click()
 restored=page.locator('#page [data-page="s2"] .am-flow-info-item strong').all_inner_texts()
 assert restored==original,(restored,original)

 # (6) Native product order uses IDs and shared product data, not labels.
 page.locator('#page [data-page="s3"]').click()
 before=page.locator('#page [data-page="s3"] .mock-product[data-card-product]').evaluate_all(
  'els=>els.map(el=>el.dataset.cardProduct)')
 products=page.locator('#section-list [data-ia-sort="native-product"][data-ia-section="s3"]')
 assert products.count()>=2
 products.nth(0).drag_to(products.nth(1))
 moved=page.locator('#page [data-page="s3"] .mock-product[data-card-product]').evaluate_all(
  'els=>els.map(el=>el.dataset.cardProduct)')
 assert moved[:2]==before[:2][::-1],(before,moved)
 page.locator('#undo').click()
 reset=page.locator('#page [data-page="s3"] .mock-product[data-card-product]').evaluate_all(
  'els=>els.map(el=>el.dataset.cardProduct)')
 assert reset==before

 # (7) Display benefit content from editable fields only; never invent
 # customer-facing decorative text such as hard-coded "BENEFIT".
 page.locator('#page [data-page="s4"]').click()
 page.locator('[data-cb-rail="library"]').click()
 page.locator('[data-ia-library="blocks"]').click()
 page.locator('[data-cb-add="benefit"]').click()
 benefit=page.locator('#page [data-page="s4"] .cb-node--benefit').first
 assert benefit.count()==1
 assert '>BENEFIT<' not in benefit.inner_html()
 assert not errors,errors
 browser.close()
print('PASS v1.12: compact card disclosures, linked fields, DnD item/product order and undo, no fixed benefit badge')
