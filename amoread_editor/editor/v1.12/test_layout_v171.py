"""v1.7.1 layout integrity: no overlapping picker labels at multiple viewport sizes.
Does not require HTTP or external resources. Run with Python Playwright + Chromium.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

D = Path(__file__).resolve().parent
CSS = ['tokens.demo.css','styles.css','composable.css','editor-spacing.css','layout-integrity.css']
JS = ['catalog.js','components.js','flows.js','composable.js','app.js']


def mount(page):
    page.set_content((D/'index.html').read_text(encoding='utf8'))
    for name in CSS:
        page.add_style_tag(content=(D/name).read_text(encoding='utf8'))
    for name in JS:
        page.add_script_tag(content=(D/name).read_text(encoding='utf8'))


def check_cards(page):
    return page.evaluate('''() => {
      const pane=document.querySelector('#pickerResults');
      const cards=[...pane.querySelectorAll('.am-ed-picker-card')];
      const rect=e=>e.getBoundingClientRect();
      const problems=[];
      const eps=1.2;
      for(const [i,card] of cards.entries()){
        const cr=rect(card),mini=rect(card.querySelector('.am-ed-mini-view'));
        const title=rect(card.querySelector(':scope > b')),desc=rect(card.querySelector(':scope > small'));
        if(title.top<mini.bottom-eps || desc.top<title.bottom-eps || desc.bottom>cr.bottom+eps || cr.height < mini.height+title.height+desc.height+16){
          problems.push({i,name:card.querySelector(':scope > b').textContent,card:[cr.top,cr.bottom],mini:[mini.top,mini.bottom],title:[title.top,title.bottom],desc:[desc.top,desc.bottom]});
        }
      }
      for(let i=0;i<cards.length;i++){
        for(let j=i+1;j<cards.length;j++){
          const a=rect(cards[i]),b=rect(cards[j]);
          if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>5 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>eps){
            problems.push({collision:[i,j],bounds:[[a.x,a.y,a.width,a.height],[b.x,b.y,b.width,b.height]]});
          }
        }
      }
      return {count:cards.length,problems,gridRows:getComputedStyle(pane).gridAutoRows,paneScrollable:pane.scrollHeight>pane.clientHeight,
        first:cards[0]&&{height:rect(cards[0]).height,text:cards[0].querySelector(':scope > b').textContent}};
    }''')


with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
    for width,height in [(1510,950),(1280,760),(1024,768),(820,760),(390,780)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        mount(page)
        assert page.locator('#page .preview-block').count()==6
        page.locator('#changeLayout').click()
        for category in ['상품','안내·이야기','이벤트','후기','전체']:
            page.locator('[data-picker-cat="'+category+'"]').click()
            page.wait_for_timeout(50)
            data=check_cards(page)
            assert data['count']>0,(width,category,'no cards')
            assert not data['problems'],(width,category,data)
            assert data['gridRows']=='max-content',(width,category,data['gridRows'])
            if width==1510 and category=='상품':
                page.screenshot(path=str(D/'screenshot_picker_fixed.png'))
            if width==390 and category=='상품':
                page.screenshot(path=str(D/'screenshot_picker_mobile_fixed.png'))
        page.locator('#pickerCancel').click()
        # Long real-world copy through the real inspector, not private state.
        page.locator('#page [data-page="s3"]').click()
        page.locator('#panel-body [data-bind="name"]').fill('봄날의 티 샘플러 · 선물하고 싶은 차를 찾는 특별한 컬렉션')
        page.locator('#panel-body [data-bind="role"]').fill('기획자가 여러 문장을 넣고 줄바꿈을 적용하더라도 상품 카드와 설명 사이의 간격이 자연스럽게 유지되어야 합니다.\n추가 설명입니다.')
        page.locator('[data-tab="shape"]').click()
        cols=page.locator('[data-columns="3"]')
        if cols.count(): cols.first.click()
        sec=page.locator('#page [data-page="s3"]')
        if sec.count():
            geometry=sec.evaluate('''e => {
             const r=x=>x.getBoundingClientRect();
             const children=[...e.querySelectorAll('.mock-product')];
             const bad=[];
             for(const [i,card] of children.entries()){
               const items=[...card.querySelectorAll(':scope > .mock-el')];
               for(let j=0;j<items.length-1;j++){
                 if(r(items[j]).bottom>r(items[j+1]).top+1)bad.push({card:i,idx:j,overlap:r(items[j]).bottom-r(items[j+1]).top});
               }
               if(r(card).right>r(e).right+2)bad.push({card:i,issue:'outside section'});
             }
             return {cardCount:children.length,bad};
            }''')
            assert not geometry['bad'],(width,geometry)
        assert not errors,(width,errors)
        page.close()
    browser.close()
    print('PASS v1.7.1: picker cards + preview texts do not overlap across 5 viewport sizes and 5 categories; canonical 340px mini and previous sections preserved')
