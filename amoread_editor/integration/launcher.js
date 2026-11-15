/* Mount in an existing editor. Leaves every legacy editor route/DOM intact.
 * window.AMOREAD_INTEGRATION may define mountSelector, greenUI.tokenMap,
 * greenUI.tokens, greenUI.selectors and hostAdapter.
 */
(function(){
'use strict';
if(window.AMOREAD_NEW_EDITOR_LAUNCHER)return;
const script=document.currentScript;
if(!script?.src)return;
const config=window.AMOREAD_INTEGRATION||{};
const editorURL=new URL(config.editorURL||'../editor/v1.12/index.html',script.src);
if(editorURL.origin!==location.origin||editorURL.pathname===location.pathname)return;
const standaloneURL=new URL(editorURL);
standaloneURL.searchParams.delete('amoread_embed');
editorURL.searchParams.set('amoread_embed','1');
const keys=['--font','--bg','--surface','--sunken','--hover','--ink','--ink2','--mute','--line','--line-sub','--line-strong','--accent','--accent-ink','--accent-soft','--price','--ok','--ok-soft','--warn','--err','--shade','--scrim','--fs-cap','--fs-sm','--fs-body','--fs-h2','--fs-h1','--lh-body','--s1','--s2','--s3','--s4','--s5','--s6','--r','--r2','--control-md'];
const green=config.greenUI||{},root=getComputedStyle(document.documentElement),hostTokens={};
for(const key of keys){
  const source=green.tokenMap?.[key]||key;
  const value=String(green.tokens?.[key]||root.getPropertyValue(source)||'').trim();
  if(value)hostTokens[key]=value;
}
const props=['backgroundColor','color','borderColor','borderRadius','fontFamily','fontSize','height','paddingTop'];
function grab(selector){
 if(!selector)return {};
 let el;try{el=document.querySelector(selector)}catch(_){return {}}
 if(!el)return {};
 const st=getComputedStyle(el),result={};
 for(const p of props)result[p]=st[p];
 return result;
}
const selectors=green.selectors||{};
const host={
 primary:grab(selectors.primaryButton),
 secondary:grab(selectors.secondaryButton),
 input:grab(selectors.input),
 heading:grab(selectors.heading),
 body:grab(selectors.body||'body')
};
function refreshHostStyles(){
 const currentRoot=getComputedStyle(document.documentElement);
 for(const key of keys){
  const source=green.tokenMap?.[key]||key;
  const value=String(green.tokens?.[key]||currentRoot.getPropertyValue(source)||'').trim();
  if(value)hostTokens[key]=value;else delete hostTokens[key];
 }
 host.primary=grab(selectors.primaryButton);
 host.secondary=grab(selectors.secondaryButton);
 host.input=grab(selectors.input);
 host.heading=grab(selectors.heading);
 host.body=grab(selectors.body||'body');
}
const provider=config.hostAdapter||window.AMOREAD_OSULLOC_API||null;
const css=document.createElement('style');
css.textContent=[
'.amx-start{border-radius:8px;padding:9px 14px;font:inherit;cursor:pointer;border:1px solid #007a46}',
'.amx-float{position:fixed;bottom:18px;right:18px;z-index:2147481000;background:var(--amx-host-accent,#007a46);color:var(--amx-host-accent-text,#fff);box-shadow:0 4px 20px #0003}',
'.amx-dialog{position:fixed;inset:0;background:#fff;color:#17231b;z-index:2147482000;display:flex;flex-direction:column;font:14px/1.5 system-ui,sans-serif}',
'.amx-dialog[hidden],.amx-compare[hidden]{display:none!important}',
'.amx-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #ddd}',
'.amx-head strong{margin-right:auto}',
'.amx-head button,.amx-compare button{padding:8px 12px;background:white;color:var(--amx-host-accent,#007a46);border:1px solid #b7c8ba;border-radius:8px;cursor:pointer}',
'.amx-status{padding:5px 12px;background:#f6f8f6;color:#3d5445;font-size:12px}',
'.amx-frame{border:0;flex:1;min-height:0;width:100%}',
'.amx-compare{position:absolute;top:94px;right:12px;bottom:12px;width:min(580px,calc(100vw - 24px));overflow:auto;padding:16px;border:1px solid #dae4dc;border-radius:12px;background:#fff;box-shadow:0 4px 28px #0004}',
'.amx-compare h2{font-size:18px;margin:0 0 8px}',
'.amx-row{padding:12px 0;border-top:1px solid #e5ebe6}',
'.amx-row-title{display:flex;align-items:center;justify-content:space-between;gap:8px}',
'.amx-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}',
'.amx-tile{border:1px solid #e0e6e1;border-radius:9px;padding:9px;min-width:0;overflow-wrap:anywhere}',
'.amx-tile small,.amx-tile code{display:block;font-size:11px}',
'.amx-tile code{margin-top:5px;white-space:normal;overflow-wrap:anywhere}',
'.amx-swatch{height:36px;border-radius:6px;border:1px solid #ccc;display:block;margin-top:6px}',
'.amx-badge{font-size:11px;border-radius:12px;padding:2px 6px;background:#f1f4f2}',
'.amx-badge[data-status=conflict]{color:#923b23;background:#fff0e9}',
'.amx-badge[data-status=match]{color:#007a46;background:#eef5ef}',
'.amx-note{color:#516254;font-size:12px}',
'.amx-dialog button:focus-visible,.amx-start:focus-visible{outline:3px solid #00a45a;outline-offset:3px}'
].join('\n');
document.head.appendChild(css);
css.style.setProperty('--amx-host-accent',hostTokens['--accent']||host.primary.backgroundColor||'#007a46');
css.style.setProperty('--amx-host-accent-text',hostTokens['--accent-ink']||host.primary.color||'#fff');
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function button(text,handler){const b=node('button','',text);b.type='button';b.addEventListener('click',handler);return b}
let dialog,frame,compare,status,compareButton,oldOverflow,focused,unsubscribe,saveTimeout,pending=null,busy=false;
function report(msg){if(status)status.textContent=msg}
function editor(){try{return frame.contentWindow.AMOREAD_EDITOR_API}catch(_){return null}}
async function writeDraft(){
 if(busy||pending===null||typeof provider?.saveDraft!=='function')return;
 const draft=pending;pending=null;busy=true;report('기획안 저장 중…');
 try{await provider.saveDraft(draft);report('기획안 저장 완료')}
 catch(err){if(pending===null)pending=draft;report('저장 실패: '+String(err?.message||err))}
 finally{busy=false}
}
function queueDraft(draft){
 if(typeof provider?.saveDraft!=='function')return;
 pending=draft;clearTimeout(saveTimeout);saveTimeout=setTimeout(writeDraft,700);
}
async function hydrate(){
 const api=editor();
 if(!api){report('새 편집기 연결 API를 찾지 못했어요. 같은 도메인에 배포되어 있는지 확인하세요.');return}
 try{
  const child=frame.contentDocument?.documentElement;
  if(child)for(const [key,value]of Object.entries(hostTokens))child.style.setProperty(key,value);
  if(provider?.listProducts||provider?.listReviews){
   const [products,reviews]=await Promise.all([
    typeof provider.listProducts==='function'?provider.listProducts():undefined,
    typeof provider.listReviews==='function'?provider.listReviews():undefined
   ]);
   api.setCatalog({products,reviews});
  }
  if(typeof provider?.getDraft==='function'){
   const draft=await provider.getDraft();
   if(draft)api.importSnapshot(draft);
  }
  if(unsubscribe)unsubscribe();
  unsubscribe=api.subscribe(queueDraft);
  report(provider?.saveDraft?'기존 편집기 보존 · 새 편집기 저장 연결됨':'기존 편집기 보존 · 서버 저장 미연결 (데모/내보내기만 가능)');
 }catch(err){report('연동 실패 · API 필드/권한 확인 필요: '+String(err?.message||err))}
}
function rows(){
 const child=frame?.contentDocument;
 if(!child)return [];
 const rs=getComputedStyle(child.documentElement);
 const st=sel=>{const e=child.querySelector(sel);return e?getComputedStyle(e):null};
 let primary=st('.mock-cta--filled');
 if(!primary){
   const probe=child.createElement('button');
   probe.className='mock-cta mock-cta--filled';
   probe.textContent='디자인 비교';
   child.body.appendChild(probe);
   const result=getComputedStyle(probe);
   primary={backgroundColor:result.backgroundColor,color:result.color};
   probe.remove();
 }
 const secondary=st('.topstatus .am-ed-button');
 const input=st('.am-ed-input'),h=st('.inspector-head h2'),body=st('body');
 return [
 ['브랜드 메인 색상',hostTokens['--accent'],rs.getPropertyValue('--accent'),'color'],
 ['패널 배경',hostTokens['--surface'],rs.getPropertyValue('--surface'),'color'],
 ['본문 색상',host.body.color,body?.color,'color'],
 ['주요 버튼 배경',host.primary.backgroundColor,primary?.backgroundColor,'color'],
 ['주요 버튼 글자',host.primary.color,primary?.color,'color'],
 ['보조 버튼 배경',host.secondary.backgroundColor,secondary?.backgroundColor,'color'],
 ['입력창 테두리',host.input.borderColor,input?.borderColor,'color'],
 ['입력창 모서리',host.input.borderRadius,input?.borderRadius,'text'],
 ['본문 글꼴',host.body.fontFamily,body?.fontFamily,'text'],
 ['본문 글자 크기',host.body.fontSize,body?.fontSize,'text'],
 ['제목 글꼴',host.heading.fontFamily,h?.fontFamily,'text'],
 ['기본 간격 토큰',hostTokens['--s2'],rs.getPropertyValue('--s2'),'text']
 ].map(([label,left,right,kind])=>({label,left:String(left||'').trim(),right:String(right||'').trim(),kind}));
}
function tile(title,value,kind){
 const t=node('div','amx-tile');t.appendChild(node('small','',title));
 if(kind==='color'&&value&&CSS.supports('color',value)){
  const swatch=node('span','amx-swatch');swatch.style.backgroundColor=value;t.appendChild(swatch);
 }
 t.appendChild(node('code','',value||'측정 불가 · 실제 앱 요소 선택자 지정 필요'));
 return t;
}
function showComparison(){
 compare.replaceChildren();
 compare.appendChild(node('h2','','실제 Green UI vs 신규 편집기'));
 compare.appendChild(node('p','amx-note','이 페이지에서 측정한 실제 계산 스타일을 비교합니다. 일치하지 않는 항목만 충돌로 표시하며, 값이 없는 항목은 확인이 필요합니다.'));
 let mismatches=0,unknown=0;
 for(const data of rows()){
  const normalized=v=>v.replace(/\s+/g,' ').toLowerCase();
  const state=!(data.left&&data.right)?'unknown':normalized(data.left)===normalized(data.right)?'match':'conflict';
  if(state==='conflict')mismatches++;if(state==='unknown')unknown++;
  const item=node('section','amx-row'),head=node('div','amx-row-title');
  head.appendChild(node('strong','',data.label));
  const badge=node('span','amx-badge',state==='match'?'일치':state==='conflict'?'충돌':'비교 불가');badge.dataset.status=state;
  head.appendChild(badge);item.appendChild(head);
  const pair=node('div','amx-pair');pair.appendChild(tile('현재 Green UI',data.left,data.kind));pair.appendChild(tile('새 편집기',data.right,data.kind));item.appendChild(pair);
  if(state==='conflict')item.appendChild(node('p','amx-note','Green UI 우선: 정확한 토큰/선택자를 매핑하거나 별도 CSS 우선순위를 확인해야 합니다.'));
  compare.appendChild(item);
 }
 const summary=node('p','amx-note','충돌 '+mismatches+'개 · 비교 불가 '+unknown+'개. 비교 불가를 일치로 판단하지 않습니다.');
 compare.insertBefore(summary,compare.children[2]||null);
 compare.hidden=false;
}
function close(){
 if(!dialog||dialog.hidden)return;
 if(pending!==null&&!window.confirm('저장되지 않은 변경이 남아 있어요. 닫을까요?'))return;
 if(pending!==null)void writeDraft();
 if(unsubscribe){unsubscribe();unsubscribe=null}
 clearTimeout(saveTimeout);dialog.hidden=true;document.body.style.overflow=oldOverflow;focused?.focus();
}
function open(){
 if(!dialog){
  dialog=node('div','amx-dialog');dialog.hidden=true;dialog.style.setProperty('--amx-host-accent',hostTokens['--accent']||host.primary.backgroundColor||'#007a46');dialog.style.setProperty('--amx-host-accent-text',hostTokens['--accent-ink']||host.primary.color||'#fff');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','AMOREAD 신규 구좌편집기');
  const head=node('div','amx-head');head.appendChild(node('strong','','오설록 신규 구좌편집기'));
  head.appendChild(button('← 기존 구좌편집기로 돌아가기',close));
  compareButton=button('Green UI 충돌 비교',()=>{if(compare.hidden)showComparison();else compare.hidden=true;});
  head.appendChild(compareButton);
  head.appendChild(button('독립 데모 새 탭',()=>window.open(standaloneURL.href,'_blank','noopener,noreferrer')));
  status=node('div','amx-status','새 편집기 준비 중…');status.setAttribute('role','status');
  frame=node('iframe','amx-frame');frame.title='AMOREAD 신규 구좌편집기';
  compare=node('aside','amx-compare');compare.hidden=true;
  dialog.append(head,status,frame,compare);document.body.appendChild(dialog);
  frame.addEventListener('load',()=>void hydrate());
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();compare.hidden?close():compare.hidden=true}});
 }
 refreshHostStyles();
 if(dialog){
  dialog.style.setProperty('--amx-host-accent',hostTokens['--accent']||host.primary.backgroundColor||'#007a46');
  dialog.style.setProperty('--amx-host-accent-text',hostTokens['--accent-ink']||host.primary.color||'#fff');
 }
 start.style.setProperty('--amx-host-accent',hostTokens['--accent']||host.primary.backgroundColor||'#007a46');
 start.style.setProperty('--amx-host-accent-text',hostTokens['--accent-ink']||host.primary.color||'#fff');
 focused=document.activeElement;oldOverflow=document.body.style.overflow;
 document.body.style.overflow='hidden';dialog.hidden=false;
 compare.hidden=true;frame.src=editorURL.href;report('새 편집기를 불러오는 중…');
 dialog.querySelector('.amx-head button')?.focus();
}
const mount=config.mountSelector?document.querySelector(config.mountSelector):null;
const start=button(config.buttonLabel||'구좌편집기 · 신규',open);
start.id='amoread-open-new-editor';start.classList.add('amx-start');
if(mount)mount.appendChild(start);
else{start.classList.add('amx-float');document.body.appendChild(start)}
start.style.setProperty('--amx-host-accent',hostTokens['--accent']||host.primary.backgroundColor||'#007a46');
start.style.setProperty('--amx-host-accent-text',hostTokens['--accent-ink']||host.primary.color||'#fff');
window.AMOREAD_NEW_EDITOR_LAUNCHER=Object.freeze({open,close,getConflicts:rows,editorURL:standaloneURL.href});
})();