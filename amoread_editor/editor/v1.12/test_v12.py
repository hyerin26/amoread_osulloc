"""AMOREAD v1.2 browser regression: local fabricated data only, no external services."""
from pathlib import Path
from playwright.sync_api import sync_playwright
D=Path(__file__).resolve().parent
E=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1520,'height':1050},accept_downloads=True)
 page.on('pageerror',lambda e:E.append(str(e)))
 page.set_content((D/'index.html').read_text())
 for f in ['tokens.demo.css','styles.css','composable.css','editor-spacing.css']:page.add_style_tag(content=(D/f).read_text())
 for f in ['catalog.js','components.js','flows.js','composable.js','app.js']:page.add_script_tag(content=(D/f).read_text())
 assert page.locator('#page .preview-block').count()==6
 assert page.locator('[data-tab="check"]').count()==1
 # Old section picker / review subtypes preserved
 page.locator('#changeLayout').click()
 assert page.locator('[data-picker-id]').count()>=24, 'Legacy picker choices must remain; additional variants are allowed'
 page.locator('[data-picker-cat="후기"]').click()
 assert page.locator('[data-picker-id]').count()==4
 page.locator('#pickerCancel').click()
 # Quiz workflow: convert existing event (s5) and edit multi question
 page.locator('#page [data-page="s5"]').click()
 page.locator('#changeLayout').click()
 page.locator('[data-picker-id="ev-quiz"]').click()
 page.locator('#pickerApply').click()
 page.locator('[data-tab="event"]').click()
 assert page.locator('[data-flow="editQuestion:0"]').count()==1
 assert page.locator('[data-bind="ev.ui.quiz.questions.0.text"]').count()==1
 page.locator('[data-bind="ev.ui.quiz.questions.0.text"]').fill('어떤 향을 좋아하나요?')
 assert '어떤 향을 좋아하나요?' in page.locator('#page .preview-block.active .mock-event').inner_text()
 page.locator('[data-flow="addQuestion"]').click()
 assert page.locator('[data-flow^="editQuestion:"]').count()==2
 page.locator('[data-bind="ev.ui.quiz.questions.1.text"]').fill('어떻게 차를 즐기나요?')
 page.locator('[data-flow="addAnswer:1"]').click()
 assert page.locator('[data-bind^="ev.ui.quiz.questions.1.options."][data-bind$=".text"]').count()==3
 page.locator('[data-bind="ev.ui.quiz.questions.1.options.2.text"]').fill('따뜻하게 마셔요')
 page.locator('[data-flow="addResult"]').click()
 assert page.locator('[data-flow^="editResult:"]').count()==3
 page.locator('[data-bind="ev.ui.quiz.results.2.title"]').fill('차분한 오후')
 page.locator('[data-flow="editQuestion:1"]').click()
 q3=page.locator('[data-bind="ev.ui.quiz.questions.1.options.2.resultId"]')
 new_result=q3.locator("option").last.get_attribute("value")
 q3.select_option(new_result)
 page.locator('[data-flow-view="r:2"]').click()
 assert '차분한 오후' in page.locator('#page .preview-block.active .mock-event').inner_text()
 page.screenshot(path=str(D/'screenshot_quiz_results.png'),full_page=True)
 # editing question count and result link validation
 page.locator('[data-tab="check"]').click()
 assert page.locator('.am-flow-issues').count()==1
 page.locator('[data-tab="event"]').click()
 page.locator('[data-flow="simStart"]').click()
 assert page.locator('#page .preview-block.active [data-flow-preview]').count()>=2
 page.locator('#page .preview-block.active [data-flow-preview]').first.click()
 assert '어떻게 차를 즐기나요?' in page.locator('#page .preview-block.active .mock-event').inner_text()
 page.locator('#page .preview-block.active [data-flow-preview]').last.click()
 assert 'RESULT' in page.locator('#page .preview-block.active .mock-event').inner_text()
 page.locator('[data-flow="simReset"]').click()
 page.locator('[data-choice="ev.ui.quiz.mode"][data-value="score"]').click()
 assert page.locator('[data-bind$=".score"]').count()>=2
 page.locator('[data-flow-view="q:0"]').click()
 # check result still rendered
 assert page.locator('#page .mock-event--quiz').count()>=1
 # Other event stages; all are distinct wireframes, and fields available
 for type_id,field,view,expected in [
  ('ev-share','ev.ui.shareUrl','after','공유해주셔서 감사합니다'),
  ('ev-ugc','ev.ui.successTitle','pending','제출이 접수되었습니다'),
  ('ev-stamp','ev.ui.policy','reward','보상'),
  ('ev-draw','ev.ui.loseLabel','lose','다음 기회'),
  ('ev-coupon','ev.ui.expireDate','issued','쿠폰 발급 완료')]:
  page.locator('#changeLayout').click()
  page.locator(f'[data-picker-id="{type_id}"]').click()
  page.locator('#pickerApply').click()
  page.locator('[data-tab="event"]').click()
  assert page.locator(f'[data-bind="{field}"]').count()==1,(type_id,field)
  page.locator(f'[data-flow-view="{view}"]').click()
  assert expected in page.locator('#page .preview-block.active .mock-event').inner_text(),(type_id,view)
 # v1.1 review variants; preserve center click and tab
 page.locator('#page [data-page="s6"]').click()
 page.locator('[data-tab="review"]').click()
 page.locator('[data-review-layout="feature-left"]').click()
 assert page.locator('#page .preview-block.active .mock-review-shell.feature-left').count()==1
 # v0.9 CTA multiline, items, card elements
 page.locator('#page [data-page="s4"]').click()
 page.locator('[data-tab="copy"]').click()
 page.locator('[data-bind="name"]').fill('첫 줄\n두 번째 줄')
 assert '첫 줄\n두 번째 줄' in page.locator('#page .preview-block.active h3').inner_text()
 page.locator('[data-check="ctaOn"]').check()
 assert page.locator('#page .preview-block.active .mock-cta').count()==1
 page.locator('[data-tab="items"]').click()
 assert page.locator('[data-column-path="config.columns"]').count()==3
 page.locator('[data-column-path="config.columns"][data-columns="3"]').click()
 assert page.locator('#page .preview-block.active .am-flow-info-list.cols-3').count()==1
 page.locator('#page [data-page="s3"]').click();page.locator('[data-tab="shape"]').click()
 assert page.locator('[data-element]').count()==16
 page.locator('[data-element="label"]').check()
 assert page.locator('#page .preview-block.active [data-card-element="label"]').count()>0
 # Output actions remain
 with page.expect_download() as download:
  page.locator('#exportHandoff').click()
 assert download.value.suggested_filename.endswith('.html')
 with page.expect_download() as download2:page.locator('#exportDemo').click()
 assert download2.value.suggested_filename.endswith('.json')
 page.screenshot(path=str(D/'screenshot_overview_v12.png'),full_page=True)
 assert not E,E
 b.close()
 print('PASS v1.2: 21 layouts + additive variants, multi-step quiz & results, simulation, five event workflows, old review/CTA/card, source validation, downloads, no JS errors')
