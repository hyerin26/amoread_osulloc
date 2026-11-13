"""Composable preview quality: child hierarchy, token rhythm, responsive columns.
Uses fictional content and checks only the v1.12 editor preview, not live commerce.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

D=Path(__file__).resolve().parent
CSS=['tokens.demo.css','styles.css','composable.css','editor-spacing.css',
     'layout-integrity.css','custom-section.css','image-layout-v110.css',
     'ia-v111.css','editor-ui-kit.css','block-quality.css','canvas-selection.css']

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1480,'height':860})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<div class="phone" style="width:340px"><div id="page"></div></div>')
    for name in CSS:page.add_style_tag(content=(D/name).read_text('utf-8'))
    page.add_script_tag(content=(D/'composable.js').read_text('utf-8'))
    page.evaluate("""() => {
      const s={productIds:[],editorBlocks:{schemaVersion:1,slots:{}}};
      const group=AMBlocks.create('group',s);
      group.props.direction='grid';group.props.columns=4;
      group.props.gap='compact';group.props.padding='normal';group.props.align='start';
      group.children=[
        Object.assign(AMBlocks.create('text',s),{props:{text:'길이가 다른 메시지 1\\n한 줄 더',role:'heading',align:'left'}}),
        AMBlocks.create('benefit',s),AMBlocks.create('notice',s),AMBlocks.create('cta',s)
      ];
      group.children[1].props.condition='';
      group.children[2].props.text='배송 시 유의사항은 반드시 확인해주세요.';
      s.editorBlocks.slots['section:after']=[group];
      window.__qualitySection=s;
      window.__qualityGroup=group;
      window.__paintQuality=()=>{document.querySelector('#page').innerHTML='<section class="preview-block">'+
        AMBlocks.renderSlot(s,'section:after',{products:[],reviews:[],renderProductCardElements:()=>''},{showEmpty:false})+'</section>'};
      window.__paintQuality();
    }""")
    columns=lambda:page.locator('.cb-group').evaluate('el => getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length')
    gap=lambda:page.locator('.cb-group').evaluate('el => getComputedStyle(el).gap')
    inset=lambda:page.locator('.cb-group').evaluate('el => getComputedStyle(el).paddingTop')
    assert columns()==4,('standard 340px frame must honor four requested columns',columns())
    assert gap()=='8px',gap()
    assert inset()=='12px',inset()
    assert page.locator('.cb-benefit p').count()==0,'empty condition must not reserve an extra row'
    assert page.locator('.cb-notice > p').count()==1
    assert page.locator('.cb-role-heading').inner_text().startswith('길이가 다른 메시지')
    assert page.locator('.cb-group .cb-node').count()==4
    page.evaluate("document.querySelector('.phone').style.width='230px'")
    assert columns()==1,('very narrow inner group should stack without overflow',columns())
    page.evaluate("""() => {
      const g=window.__qualityGroup;g.props.direction='column';g.props.gap='relaxed';
      g.props.padding='compact';g.props.align='center';window.__paintQuality();
    }""")
    assert columns()==1
    assert gap()=='20px',gap()
    assert inset()=='8px',inset()
    assert page.locator('.cb-group .cb-node').count()==4,'variant switching must preserve children'
    assert page.evaluate("window.__qualityGroup.props.columns")==4,'stored choice must persist when auto-folded'
    assert page.locator('.cb-group').evaluate('el=>getComputedStyle(el).alignItems')=='center'
    inspector=page.evaluate("""() => AMBlocks.inspector(window.__qualitySection,
       window.__qualityGroup.id,{products:[],reviews:[],elements:{}})""")
    assert 'data-cb-field="padding"' in inspector
    assert 'data-cb-field="align"' in inspector
    assert 'data-cb-field="columns"' not in inspector,'column control should be hidden for column direction'
    # Native info/product layouts also respond to the 340px page frame.
    page.evaluate("""() => {
      const target=document.querySelector('#page');
      const items=Array.from({length:3},(_,i)=>'<div class="am-flow-info-item"><div><strong>안내 '+i+'</strong><small>조건과 설명</small></div></div>').join('');
      target.innerHTML='<section class="preview-block"><div class="am-flow-info-list cols-3">'+items+
        '</div><div class="am-flow-info-split right ratio-visual"><div class="am-flow-img-ghost">이미지</div><div class="am-flow-split-copy">설명</div></div>'+
        '<div class="mock-products am-cols-4 am-product-view-grid"><div class="mock-product">A</div><div class="mock-product">B</div><div class="mock-product">C</div><div class="mock-product">D</div></div></section>';
      document.querySelector('.phone').style.width='340px';
    }""")
    info_cols=page.locator('.am-flow-info-list').evaluate('el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length')
    prod_cols=page.locator('.mock-products').evaluate('el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length')
    assert info_cols==3,('native three-column layout must remain three at 340px',info_cols)
    assert prod_cols==4,('four native product cards should honor requested columns at 340px',prod_cols)
    split_tracks=page.locator('.am-flow-info-split').evaluate('el=>getComputedStyle(el).gridTemplateColumns.split(/\\s+/).map(parseFloat)')
    assert len(split_tracks)==2 and split_tracks[1]>split_tracks[0]*1.8,split_tracks
    page.evaluate("document.querySelector('.phone').style.width='250px'")
    assert page.locator('.am-flow-info-list').evaluate('el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length')==1
    assert page.locator('.am-flow-info-split').evaluate('el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length')==1
    for position in ('left','right'):
        for ratio in ('half','visual','copy'):
            page.locator('.am-flow-info-split').evaluate('(el, name)=>el.className=name',
              f'am-flow-info-split {position} ratio-{ratio}')
            actual=page.locator('.am-flow-info-split').evaluate(
              'el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length')
            assert actual==1,(position,ratio,actual)
    assert 'ratio-' in (D/'flows.js').read_text('utf-8')
    assert not errors,errors
    browser.close()
print('PASS v1.12 block quality: semantic spacing, responsive columns, preserved content, inspector controls')
