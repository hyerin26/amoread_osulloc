/* AMOREAD v1.4 additive block system. Existing section/card/quiz data untouched. */
window.AMBlocks = (() => {
'use strict';
const TYPES=[
 ['productCard','상품 카드','상품명·정가·할인율 등 16개 요소'],
 ['text','텍스트','제목·본문·강조 문구'],
 ['image','이미지 자리','디자이너용 이미지 요청'],
 ['cta','CTA 버튼','형태와 연결 대상'],
 ['review','후기 카드','후기 데이터 참조'],
 ['benefit','혜택','할인·증정·적용 조건'],
 ['notice','유의사항','운영 안내'],
 ['group','요소 그룹','묶음·정렬·간격'],
 ['productGrid','상품 카드 묶음','2~4열 카드 자동 구성 · 개별 상품 편집']
];
const deep=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=> 'cb_'+Math.random().toString(36).slice(2,11);
function ensure(s){if(!s.editorBlocks||!s.editorBlocks.slots)s.editorBlocks={schemaVersion:1,slots:{}};return s.editorBlocks}
function slot(s,k){const all=ensure(s).slots;return all[k]||(all[k]=[])}
function find(s,id){for(const [key,items] of Object.entries(ensure(s).slots)){const walk=list=>{for(const item of list){if(item.id===id)return {item,list,slot:key};const n=walk(item.children||[]);if(n)return n}return null};const found=walk(items);if(found)return found}return null}
function create(type,s){if(!TYPES.some(x=>x[0]===type))return null;
const initial={
 productCard:{productId:s.productIds?.[0]||'',imageRatio:'1:1',card:deep(s.card||{order:[],on:{},def:{}}),appeals:deep(s.appeals||{}),compact:false},
 text:{text:'새 문구를 입력해주세요.',role:'body',align:'left'},
 image:{label:'상품·브랜드 연출 이미지 요청',ratio:'4:3'},
 cta:{text:'상품 보기',style:'outline',targetType:'none',target:''},
 review:{reviewId:'',showProduct:true,showRating:true},
 benefit:{title:'기획 혜택',value:'혜택 내용을 입력해주세요',condition:''},
 notice:{text:'유의사항을 입력해주세요'},
 group:{direction:'column',columns:2,gap:'normal',padding:'normal',align:'stretch'},
 productGrid:{direction:'grid',columns:2,gap:'compact',padding:'compact',align:'stretch'}
};
 const children=type==='productGrid'?[create('productCard',s),create('productCard',s)]:[];
 if(type==='productGrid'&&children[1])children[1].props.productId=s.productIds?.[1]||children[0].props.productId;
 return {id:uid(),type,props:initial[type],children}}
function insert(s,slotKey,type,parentId){const parent=parentId?find(s,parentId)?.item:null;if(parentId&&!['group','productGrid'].includes(parent?.type))return null;const items=parent?parent.children:slot(s,slotKey);if(items.length>=30)return null;const n=create(type,s);if(n)items.push(n);return n}
function remove(s,id){const f=find(s,id);if(!f)return false;f.list.splice(f.list.indexOf(f.item),1);return true}
function reorderBlock(s,sourceId,targetId,after=false){
 const from=find(s,sourceId),to=find(s,targetId);
 if(!from||!to||from.list!==to.list||from.item===to.item)return false;
 const list=from.list,oldIndex=list.indexOf(from.item);
 list.splice(oldIndex,1);
 const newIndex=list.indexOf(to.item)+(after?1:0);
 list.splice(newIndex,0,from.item);
 return oldIndex!==newIndex;
}
function move(s,id,d){const f=find(s,id);if(!f)return false;const i=f.list.indexOf(f.item),j=i+d;if(j<0||j>=f.list.length)return false;[f.list[i],f.list[j]]=[f.list[j],f.list[i]];return true}
function duplicate(s,id){const f=find(s,id);if(!f)return null;const cp=deep(f.item);const regen=x=>{x.id=uid();(x.children||[]).forEach(regen)};regen(cp);f.list.splice(f.list.indexOf(f.item)+1,0,cp);return cp}
// Reuse existing blocks: wrap the selected block and its next sibling in a grid
// without cloning or losing instance configuration. Undo is handled by the editor.
function wrapNext(s,id){const f=find(s,id);if(!f)return null;const i=f.list.indexOf(f.item);if(i<0||i+1>=f.list.length)return null;const second=f.list[i+1];const n=create('group',s);n.props.direction='grid';n.props.columns=2;n.children=[f.item,second];f.list.splice(i,2,n);return n}
function unwrap(s,id){const f=find(s,id);if(!f||!['group','productGrid'].includes(f.item.type))return false;const i=f.list.indexOf(f.item);f.list.splice(i,1,...f.item.children);return true}

function slotKey(s,view){if(s.layout!=='ev-quiz')return 'section:after';const q=s.ev?.ui?.quiz;const m=/^r:(\d+)$/.exec(view||'');const i=m?Number(m[1]):0;return 'result:'+(q?.results?.[i]?.id||q?.results?.[0]?.id||'unassigned')+':main'}
function visibleSlots(s){if(s.layout!=='ev-quiz')return ['section:after'];return (s.ev?.ui?.quiz?.results||[]).map(r=>'result:'+r.id+':main')}
function renderNode(n,s,ctx,staticView=false){const p=n.props||{};let content='';
 if(n.type==='productCard'){
  const product=ctx.products.find(x=>x.id===p.productId);
  if(product){const other={...s,imageRatio:p.imageRatio||'1:1',card:p.card||s.card,appeals:p.appeals||s.appeals};content='<div class="mock-product cb-product-card '+(p.compact?'cb-compact':'')+'">'+ctx.renderProductCardElements(other,product)+'</div>'}
  else content='<div class="cb-placeholder">상품을 연결해주세요</div>';
 }else if(n.type==='text')content='<div class="cb-text cb-role-'+esc(p.role)+'" style="text-align:'+(['left','center','right'].includes(p.align)?p.align:'left')+'">'+esc(p.text)+'</div>';
 else if(n.type==='image')content='<div class="cb-image" style="aspect-ratio:'+esc(['4:3','1:1','16:9','3:4','9:16'].includes(p.ratio)?p.ratio.replace(':','/'):'4/3')+'" aria-label="이미지 자리"><span>▧</span><b>'+esc(p.label)+'</b><small>'+esc(p.ratio)+'</small></div>';
 else if(n.type==='cta')content='<div class="cb-cta-wrap cb-cta-align-'+esc(p.align||'center')+'"><span class="cb-action cb-style-'+esc(['filled','outline','text','wide'].includes(p.style)?p.style:'outline')+'">'+esc(p.text)+'</span></div>';
 else if(n.type==='review'){const r=ctx.reviews.find(x=>x.id===p.reviewId);const product=ctx.products.find(x=>x.id===r?.productId);content=r?'<div class="cb-review">'+(p.showProduct?'<strong>'+esc(product?.name||r.productId)+'</strong>':'')+(p.showRating?'<span>★ '+esc(r.rating||'')+'</span>':'')+'<p>'+esc(r.text||'')+'</p></div>':'<div class="cb-placeholder">후기를 연결해주세요</div>'}
 else if(n.type==='benefit')content='<div class="cb-benefit"><strong>'+esc(p.title)+'</strong><b>'+esc(p.value)+'</b>'+(String(p.condition||'').trim()?'<p>'+esc(p.condition)+'</p>':'')+'</div>';
 else if(n.type==='notice')content='<div class="cb-notice"><span aria-hidden="true">※</span><p>'+esc(p.text)+'</p></div>';
 else if(n.type==='group'||n.type==='productGrid'){
  const direction=['column','row','grid'].includes(p.direction)?p.direction:'column';
  const gap=['compact','normal','relaxed'].includes(p.gap)?p.gap:'normal';
  const padding=['compact','normal','relaxed'].includes(p.padding)?p.padding:(n.type==='productGrid'?'compact':'normal');
  const align=['stretch','start','center'].includes(p.align)?p.align:'stretch';
  content='<div class="cb-group cb-direction-'+direction+' cb-cols-'+esc([2,3,4].includes(Number(p.columns))?p.columns:2)+' cb-gap-'+gap+' cb-pad-'+padding+' cb-align-'+align+'">'+(n.children||[]).map(child=>renderNode(child,s,ctx,staticView)).join('')+'</div>';
 }
 return '<div class="cb-node cb-node--'+esc(n.type)+(staticView?' cb-static':'')+'" '+(staticView?'':'tabindex="0" role="button" data-cb-node="'+esc(n.id)+'"')+'>'+content+'</div>';
}
function renderSlot(s,k,ctx,opts={}){const items=slot(s,k);const show=items.length||opts.showEmpty;if(!show)return '';return '<div class="cb-dropzone" data-cb-slot="'+esc(k)+'">'+items.map(n=>renderNode(n,s,ctx,opts.staticView)).join('')+(opts.showEmpty?'<div class="cb-drop-spot" aria-hidden="true"></div>':'')+'</div>'}
function catalogHTML(){return '<div class="cb-library-heading"><b>삽입할 요소</b><p>선택한 구좌에 재사용 블록을 추가합니다. 드래그하거나 클릭하세요.</p></div><div class="cb-library-grid">'+TYPES.map(([id,label,desc])=>'<button type="button" draggable="true" data-cb-add="'+id+'" class="cb-library-card"><span class="cb-library-symbol">'+({productCard:'▦',text:'T',image:'▧',cta:'↗',review:'★',benefit:'%',notice:'!',group:'⊞',productGrid:'▦'}[id])+'</span><span><b>'+label+'</b><small>'+desc+'</small></span></button>').join('')+'</div>'}
function field(key,label,value,textarea=false){return '<div class="am-ed-field"><label class="am-ed-label">'+label+'</label>'+(textarea?'<textarea class="am-ed-input" data-cb-field="'+esc(key)+'" rows="3">'+esc(value)+'</textarea>':'<input class="am-ed-input" data-cb-field="'+esc(key)+'" value="'+esc(value)+'">')+'</div>'}
function select(key,label,value,opts){return '<div class="am-ed-field"><label class="am-ed-label">'+label+'</label><select class="am-ed-input" data-cb-field="'+esc(key)+'">'+opts.map(([k,text])=>'<option value="'+esc(k)+'" '+(String(k)===String(value)?'selected':'')+'>'+esc(text)+'</option>').join('')+'</select></div>'}
// Properties live inside their corresponding enabled element, not in a second
// indiscriminate 16-field form. Auto-sourced elements have no fake editable fields.
function cardElementSettings(p,key){
 const v=p.card?.def||{},chosen=p.productId||'';
 if(key==='img')return select('imageRatio','상품 이미지 비율',p.imageRatio||'1:1',[['1:1','1:1 · 정사각형'],['4:3','4:3 · 가로'],['3:4','3:4 · 세로'],['16:9','16:9 · 와이드'],['9:16','9:16 · 긴 세로']]);
 if(key==='label')return (p.card?.on?.img?select('card.def.labelPosition','모서리 라벨 위치',v.labelPosition||'top-left',[['top-left','좌측 상단'],['top-right','우측 상단'],['bottom-left','좌측 하단'],['bottom-right','우측 하단']]):'<p class="am-ed-note">이미지 표시가 꺼져 있어 라벨이 카드 본문에 나타납니다. 이미지 표시를 켜면 모서리 위치를 설정할 수 있습니다.</p>')+field('card.def.label','라벨 문구',v.label||'');
 if(key==='pill')return select('card.def.pill','알약 표시 방식',v.pill||'직접 쓰기',[['직접 쓰기','직접 쓰기'],['오늘만','오늘만'],['남은 기간','남은 기간 (운영 연동 필요)'],['가격 오름 예고','가격 오름 예고']])+(v.pill==='직접 쓰기'||!v.pill?field('card.def.pillText','직접 입력할 문구',v.pillText||''):'<p class="am-ed-note">선택한 알약 유형의 문구가 표시됩니다. 실제 잔여 기간·가격 변동은 운영 데이터 연결이 필요합니다.</p>');
 if(key==='appeal')return chosen?field('appeals.'+chosen,'선택 상품 소구문구',p.appeals?.[chosen]||'',true):'<p class="am-ed-note">상단에서 연결 상품을 먼저 선택하세요.</p>';
 if(key==='tag')return field('card.def.tag','이름 앞 태그',v.tag||'');
 if(key==='copy')return field('card.def.copy','카드 문구',v.copy||'',true);
 if(key==='btn')return field('card.def.btn','버튼 문구',v.btn||'');
 return '';
}
const CARD_INPUT_KEYS=['img','label','pill','appeal','tag','copy','btn'];
function inspector(s,id,ctx){const found=find(s,id),n=found?.item;if(!n)return '';const p=n.props;let h='<div class="cb-inspector-header"><strong>'+({productCard:'상품 카드',text:'텍스트',image:'이미지',cta:'CTA 버튼',review:'후기',benefit:'혜택',notice:'유의사항',group:'그룹',productGrid:'상품 카드 묶음'}[n.type])+' · 개별 인스턴스</strong><button class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-cb-action="back">구좌 편집으로</button></div><div class="cb-inspector-actions">'+[['up','위로'],['down','아래로'],['clone','복제'],['delete','삭제'],...(['group','productGrid'].includes(n.type)?[['ungroup','묶음 해제']]:[['wrap-next','다음 요소와 2열로 묶기']])].map(([op,l])=>'<button class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-cb-action="'+op+'">'+l+'</button>').join('')+'</div>';
 if(n.type==='productCard'){
  h+=select('productId','연결 상품',p.productId,[['','상품 미정'],...ctx.products.map(x=>[x.id,x.name])]);
  h+=select('compact','상품 카드 밀도',String(!!p.compact),[['false','기본 크기'],['true','작은 카드 / 여러 열에 적합']]);
  const order=p.card?.order||[],on=p.card?.on||{},active=ctx.activeCardField||null;
  const enabled=order.filter(key=>on[key]&&key!=='ai').length;
  h+='<section class="am-ed-group cb-card-elements-group"><div class="am-ed-group__title"><h3>상품 카드 표시 요소</h3><span class="am-ed-tag">'+enabled+'/'+order.length+'개 사용</span></div><p class="am-ed-group__description">체크해 표시할 요소를 선택하세요. 설정은 해당 요소의 ‘편집’을 눌렀을 때만 열립니다. ⠿ 손잡이로 드래그하거나 ↑↓ 버튼으로 순서를 바꿀 수 있습니다.</p><div class="cb-card-elements-list" data-cb-sort-list="1" role="list" aria-label="상품 카드 요소 표시와 순서 변경">'+order.map((key,i)=>{
    const title=esc(ctx.elements[key]?.[0]||key),enabled=!!on[key]&&key!=='ai',editable=CARD_INPUT_KEYS.includes(key),opened=editable&&enabled&&active===key;
    // A corner label is painted inside its image, not as a sortable standalone
    // DOM element. Do not offer a reorder action with no visible result.
    const locked=key==='ai'||(key==='label'&&!!on.img);
    const neighborLocked=k=>k==='ai'||(k==='label'&&!!on.img);
    const upDisabled=locked||i===0||neighborLocked(order[i-1]);
    const downDisabled=locked||i===order.length-1||neighborLocked(order[i+1]);
    return '<div class="cb-el-row'+(enabled?' cb-el-row--enabled':' cb-el-row--off')+(opened?' cb-el-row--expanded':'')+'" data-cb-row="'+esc(key)+'" draggable="'+(!locked)+'" role="listitem"><div class="cb-el-row-main"><span class="cb-el-grip" aria-hidden="true" title="'+(locked?(key==='label'?'모서리 라벨은 이미지 안에서 위치를 설정합니다.':'운영 연동 후 편집할 수 있습니다.'):'끌어서 순서 변경')+'">'+(locked?'·':'⠿')+'</span><label><input type="checkbox" data-cb-visible="'+esc(key)+'" '+(enabled?'checked':'')+' '+(key==='ai'?'disabled':'')+'><span>'+title+'</span></label>'+(editable&&enabled?'<button type="button" class="cb-el-edit" data-cb-expand="'+esc(key)+'" aria-expanded="'+opened+'" aria-label="'+title+' 속성 '+(opened?'접기':'편집')+'">'+(opened?'접기':'편집')+' <span aria-hidden="true">'+(opened?'⌃':'⌄')+'</span></button>':key==='ai'?'<span class="cb-el-status">연결 예정</span>':!editable&&enabled?'<span class="cb-el-status">자동 연결</span>':'')+'<div class="cb-el-row-actions"><button type="button" data-cb-order="'+esc(key)+':-1" aria-label="'+title+' 위로 이동" '+(upDisabled?'disabled':'')+'>↑</button><button type="button" data-cb-order="'+esc(key)+':1" aria-label="'+title+' 아래로 이동" '+(downDisabled?'disabled':'')+'>↓</button></div></div>'+(opened?'<div class="cb-el-inline-fields" data-cb-settings="'+esc(key)+'">'+cardElementSettings(p,key)+'</div>':'')+'</div>';
   }).join('')+'</div></section>';
 }else if(n.type==='text')h+=field('text','문구',p.text,true)+select('role','문구 종류',p.role,[['body','본문'],['heading','강조 제목'],['caption','캡션']])+select('align','정렬',p.align,[['left','왼쪽'],['center','중앙'],['right','오른쪽']]);
 else if(n.type==='cta')h+=field('text','버튼 문구',p.text)+`<div class="cb-style-preview"><span class="cb-action cb-style-${esc(p.style||'outline')}">${esc(p.text||'버튼 미리보기')}</span></div>`+select('align','버튼 정렬',p.align||'center',[['left','왼쪽'],['center','가운데'],['right','오른쪽']])+select('style','버튼 모양',p.style,[['filled','강조형'],['outline','테두리형'],['text','텍스트형'],['wide','전체 너비형']])+select('targetType','목적지 유형',p.targetType,[['none','미지정'],['url','URL'],['product','상품'],['section','구좌']])+field('target','연결 대상 (선택)',p.target);
 else if(n.type==='image')h+=field('label','이미지 요청',p.label,true)+select('ratio','이미지 비율',p.ratio,[['4:3','4:3 · 가로'],['1:1','1:1 · 정사각형'],['16:9','16:9 · 와이드'],['3:4','3:4 · 세로'],['9:16','9:16 · 긴 세로']]);
 else if(n.type==='review')h+=select('reviewId','후기 선택',p.reviewId,[['','후기 미정'],...ctx.reviews.map(r=>[r.id,r.text.slice(0,24)])])+select('showProduct','상품명 표시',String(p.showProduct),[['true','표시'],['false','숨김']])+select('showRating','별점 표시',String(p.showRating),[['true','표시'],['false','숨김']]);
 else if(n.type==='benefit')h+=field('title','혜택 제목',p.title)+field('value','혜택 내용',p.value)+field('condition','적용 조건',p.condition,true);
 else if(n.type==='notice')h+=field('text','유의사항',p.text,true);
 else if(n.type==='group'||n.type==='productGrid'){
  h+=select('direction','그룹 배치',p.direction,[['column','세로 한 줄'],['grid','다열 그리드'],['row','가로 2열']]);
  if(p.direction==='grid')h+=select('columns','한 줄에 배치할 열 수',String(p.columns||2),[['2','2열'],['3','3열'],['4','4열']]);
  h+=select('gap','블록 사이 간격',p.gap||'normal',[['compact','좁게 · 8px'],['normal','기본 · 12px'],['relaxed','넉넉하게 · 20px']]);
  h+=select('padding','그룹 내부 여백',p.padding||(n.type==='productGrid'?'compact':'normal'),[['compact','좁게 · 8px'],['normal','기본 · 12px'],['relaxed','넉넉하게 · 20px']]);
  h+=select('align','블록 정렬',p.align||'stretch',[['stretch','크기 맞춰 정렬'],['start','상단 정렬'],['center','중앙 정렬']]);
  h+='<p class="am-ed-note">좁은 모바일 구좌에서는 선택한 열 수보다 실제 표시 열 수를 줄여 카드의 가독성을 지킵니다. 변경해도 개별 블록의 문구·상품·설정은 그대로 남습니다.</p>';
  h+='<div class="cb-inspector-header"><strong>그룹 안의 요소 '+(n.children||[]).length+'개</strong><button class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-cb-action="add-child">＋ 상품 카드 추가</button></div>';
  h+='<p class="am-ed-note">묶음을 선택한 상태에서 왼쪽 요소 라이브러리를 누르면 묶음 안에 추가할 수 있어요. 그룹 내부 요소는 가운데 화면에서 개별 선택할 수 있습니다.</p>';
 }
 return h;
}
function setField(s,id,path,value){const found=find(s,id);if(!found)return false;const parts=path.split('.');let v=found.item.props;for(let i=0;i<parts.length-1;i++){if(v[parts[i]]===undefined||v[parts[i]]===null)return false;v=v[parts[i]]}v[parts.at(-1)]=value;return true}
function reorderCard(s,id,source,target,after=false){const n=find(s,id)?.item;if(n?.type!=='productCard')return false;
 const imageVisible=!!n.props.card.on?.img,locked=k=>k==='ai'||(imageVisible&&k==='label');
 if(locked(source)||locked(target))return false;
 const arr=n.props.card.order,from=arr.indexOf(source),at=arr.indexOf(target);
 if(from<0||at<0||source===target)return false;
 const [moved]=arr.splice(from,1);let to=arr.indexOf(target)+(after?1:0);arr.splice(to,0,moved);return to!==from;
}
function changeCardOrder(s,id,key,d){const n=find(s,id)?.item;if(n?.type!=='productCard')return false;const list=n.props.card.order,i=list.indexOf(key),j=i+d;if(i<0||j<0||j>=list.length)return false;
 const imageVisible=!!n.props.card.on?.img,locked=k=>k==='ai'||(imageVisible&&k==='label');
 if(locked(key)||locked(list[j]))return false;[list[i],list[j]]=[list[j],list[i]];return true}
function issues(s,ctx){const problems=[];for(const [k,list] of Object.entries(ensure(s).slots)){const check=n=>{if(n.type==='productCard'&&!ctx.products.some(p=>p.id===n.props.productId))problems.push(k+': 상품 선택 필요');if(n.type==='cta'&&n.props.targetType!=='none'&&!n.props.target)problems.push(k+': CTA 목적지 미입력');(n.children||[]).forEach(check)};list.forEach(check)}return problems}
return {TYPES,ensure,slot,find,create,insert,remove,move,duplicate,wrapNext,unwrap,slotKey,visibleSlots,renderSlot,catalogHTML,inspector,setField,changeCardOrder,reorderCard,reorderBlock,issues};
})();
