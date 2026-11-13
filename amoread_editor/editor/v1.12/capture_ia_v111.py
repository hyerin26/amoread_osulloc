from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1550,'height':1000})
 page.set_content((D/'index.html').read_text())
 for f in ['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css','custom-section.css','image-layout-v110.css','ia-v111.css']:
  page.add_style_tag(content=(D/f).read_text())
 for f in ['catalog.js','components.js','flows.js','composable.js','app.js']:
  page.add_script_tag(content=(D/f).read_text())
 page.locator('[data-ia-group="layout"]').click()
 page.screenshot(path=str(D/'screenshot_ia_overview_v111.png'),full_page=False)
 page.locator('[data-cb-rail="library"]').click()
 page.screenshot(path=str(D/'screenshot_ia_add_v111.png'),full_page=False)
 page.locator('[data-cb-rail="data"]').click()
 page.screenshot(path=str(D/'screenshot_ia_data_v111.png'),full_page=False)
 b.close()
