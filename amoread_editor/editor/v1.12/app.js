(function(){
'use strict';
const UI=window.AMEditorUI,{escape:E,field:F,group:G,button:B,toggle:T,choices:Choices,repeat:Rep}=UI;
const $=id=>document.getElementById(id);
const FLOW=window.AMFlow;
const CATALOG = window.AM_CATALOG;
const LAYOUTS=Object.fromEntries(CATALOG.map(x=>[x.id,[x.name,x.category]]));
const ITEM_DEFAULTS={ benefit:[['기간 할인','일부 대상 상품 할인'],['선물 포장','조건 충족 시 제공']],service:[['선물 포장','해당 상품에 제공'],['쇼핑백','해당 상품에 한해 제공']],timeline:[['행사 시작','11월 13일'],['마감일','11월 20일']],notice:[['쿠폰 안내','중복 사용 여부 확인']],story:[['기획 배경','이야기를 소개합니다'],['차별점','선택의 이유를 안내합니다']],detail:[['핵심 특징','상품 설명을 입력하세요']]};
const LABEL_POSITIONS=[['top-left','좌측 상단'],['top-right','우측 상단'],['bottom-left','좌측 하단'],['bottom-right','우측 하단']];
const CTA_DEFAULTS={custom:'outline',hero:'filled','text-cta':'text',split:'outline',benefit:'filled',service:'outline',grid2:'outline',grid3:'outline',feat:'filled','deal-banner':'wide',review:'text',notice:'text',countdown:'wide','ev-quiz':'filled','ev-share':'outline','ev-ugc':'filled','ev-stamp':'filled','ev-draw':'filled','ev-coupon':'wide'};
const CTA_STYLES=[['filled','강조형'],['outline','테두리형'],['text','텍스트형'],['wide','전체 너비형']];
const REVIEW_LAYOUTS=[['cards','개별 후기 카드'],['feature-left','큰 상품 사진 + 후기'],['feature-top','상단 상품 사진 + 후기'],['text','상품명 + 후기']];
const PRODUCT_VIEWS=[['grid','그리드','균형 있게 한눈에'],['list','리스트','이미지 옆 상품 정보'],['card','와이드 카드','대표 상품을 크게'],['carousel','캐러셀','가로로 넘기는 추천'],['masonry','메이슨리','크기가 다른 이미지 카드']];
const PRODUCT_VIEW_NAMES=Object.fromEntries(PRODUCT_VIEWS.map(x=>[x[0],x[1]]));
// 탭(필터) 구좌를 쓸 수 있는 유형. s.ftabs=[{id,label,zone,productIds}] — 오른쪽 패널 탭(tabs()·tab)과는 다른 것 (plans/28)
const FTAB_LAYOUTS=['grid2','grid3','feat'];
// s.productIds = 지금 보는 탭(s.ftabCur)의 상품, 다른 탭 상품은 s.ftabs[].productIds에 보관 → 상품을 다루는 기존 코드가 그대로 탭 단위로 동작한다
const FTAB_MIN=2,FTAB_MAX=12;
const ftOn=s=>FTAB_LAYOUTS.includes(s.layout)&&Array.isArray(s.ftabs)&&s.ftabs.length>0;
const ftCur=s=>s.ftabs.find(t=>t.id===s.ftabCur)||s.ftabs[0];
let ftSeq=0;const ftNewId=()=>'ft'+Date.now().toString(36)+(ftSeq++).toString(36);
function ftStore(s){if(Array.isArray(s.ftabs)&&s.ftabs.length)ftCur(s).productIds=(s.productIds||[]).slice();}
function ftSwitch(s,id){if(!ftOn(s)||!s.ftabs.some(t=>t.id===id))return;ftStore(s);s.ftabCur=id;s.productIds=ftCur(s).productIds.slice();}
function ftSplit(s,labels=['탭 1','탭 2']){s.ftabs=labels.map((label,i)=>({id:ftNewId(),label,zone:'',productIds:i?[]:(s.productIds||[]).slice()}));s.ftabCur=s.ftabs[0].id;}
function ftAdd(s){if(!ftOn(s)||s.ftabs.length>=FTAB_MAX)return false;ftStore(s);const t={id:ftNewId(),label:'탭 '+(s.ftabs.length+1),zone:'',productIds:[]};s.ftabs.push(t);s.ftabCur=t.id;s.productIds=[];return true;}
// 지운 탭의 상품은 첫 탭으로 옮긴다 (지우지 않음). 옮긴 상품 수, 지울 수 없으면 null
function ftRemove(s,id){const i=ftOn(s)&&s.ftabs.length>FTAB_MIN?s.ftabs.findIndex(t=>t.id===id):-1;if(i<0)return null;ftStore(s);const gone=s.ftabs.splice(i,1)[0],first=s.ftabs[0],moved=gone.productIds.filter(p=>!first.productIds.includes(p));first.productIds.push(...moved);if(!s.ftabs.some(t=>t.id===s.ftabCur))s.ftabCur=first.id;s.productIds=ftCur(s).productIds.slice();return moved.length;}
function ftMove(s,id,d){const i=s.ftabs.findIndex(t=>t.id===id),j=i+d;if(i<0||j<0||j>=s.ftabs.length)return;[s.ftabs[i],s.ftabs[j]]=[s.ftabs[j],s.ftabs[i]];}
// 탭 없애기: 모든 탭 상품을 탭 순서대로 한 구좌에. ftabs=[]는 '없앴음' (저장 때 page.sections의 탭도 지움)
function ftDrop(s){if(!Array.isArray(s.ftabs)||!s.ftabs.length)return;ftStore(s);s.productIds=[...new Set(s.ftabs.flatMap(t=>t.productIds))];s.ftabs=[];delete s.ftabCur;}
// 구좌 추가 창 미리보기(카드 자체가 button)에서는 그림만: button 안 button은 HTML이 카드를 끊어 버린다
function ftPills(s){if(!ftOn(s))return '';const cur=ftCur(s);
 if(!sections.includes(s))return `<div class="am-ftabs" aria-hidden="true">${s.ftabs.map(t=>`<span class="am-ftab" aria-selected="${t===cur}">${E(t.label||'탭')}</span>`).join('')}</div>`;
 return `<div class="am-ftabs" role="tablist" aria-label="${E(s.name)} 탭">${s.ftabs.map(t=>`<button type="button" role="tab" class="am-ftab" data-ftab-pill="${E(s.id)}|${E(t.id)}" aria-selected="${t===cur}" tabindex="${t===cur?0:-1}">${E(t.label||'탭')}</button>`).join('')}</div>`;}
function ftIssues(s){if(!ftOn(s))return [];ftStore(s);const out=[],noZone=s.ftabs.filter(t=>!t.zone.trim()).length;
 s.ftabs.forEach((t,i)=>{if(!t.label.trim())out.push(`${i+1}번 탭 이름이 비어 있어요`);else if(!t.productIds.length)out.push(`'${t.label}' 탭에 상품이 없어요`);});
 if(noZone)out.push(`Zone(PROMO_WORK 카테고리명)이 빈 탭이 ${noZone}개 있어요`);return out;}
function productView(s){return PRODUCT_VIEW_NAMES[s.productView]?s.productView:'grid'}
function productViewPicker(s){if(!['grid2','grid3','feat'].includes(s.layout))return '';
 return `<section class="am-ed-group am-ed-product-style-section"><div class="am-ed-group__title"><h3>상품 배치 방식</h3><span class="am-ed-tag">${E(PRODUCT_VIEW_NAMES[productView(s)])}</span></div><p class="am-ed-group__description">상품과 카드 내용은 그대로 두고 진열 모양만 바꿔요.</p><div class="am-ed-product-layouts">${PRODUCT_VIEWS.map(([id,label,description])=>`<button type="button" class="am-ed-product-layout-option" data-product-style="${id}" aria-pressed="${productView(s)===id}"><span class="am-ed-layout-visual am-ed-layout-${id}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>${label}</b><small>${description}</small></button>`).join('')}</div></section>`;
}

// Visual column picker applies only where a multi-column layout improves the content.
// Do not force 3-column legal notices or the large-image/left-review variant.
const COLUMN_LIMITS={benefit:[1,2,3],service:[1,2,3],story:[1,2],detail:[1,2],timeline:[1,2,3],grid2:[1,2,3,4],grid3:[1,2,3,4],feat:[1,2,3,4]};
const PRODUCT_COLUMN_DEFAULTS={grid2:2,grid3:3,feat:2};
const IMAGE_RATIOS=[['1:1','정사각형 · 1:1'],['4:3','가로 · 4:3'],['3:4','세로 · 3:4'],['16:9','와이드 · 16:9'],['9:16','긴 세로 · 9:16']];
const IMAGE_LAYOUTS=new Set(['hero','split','service','story','detail','review','custom','ev-ugc','grid2','grid3','feat']);
// Masonry needs genuinely different media heights. Do not mutate the saved
// section-wide imageRatio when switching display modes.
const MASONRY_AUTO_RATIOS=['3:4','1:1','4:3','9:16','16:9'];
function masonryRatio(s,productId,index){
 const value=s.productImageRatios?.[productId];
 return IMAGE_RATIOS.some(([id])=>id===value)?value:MASONRY_AUTO_RATIOS[index%MASONRY_AUTO_RATIOS.length];
}
function masonryRatioPicker(s){
 const products=s.productIds.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
 const rows=products.map((p,i)=>{
  const chosen=s.productImageRatios?.[p.id]||'auto';
  const current=masonryRatio(s,p.id,i);
  return `<div class="am-ed-masonry-product"><div class="am-ed-masonry-product__head"><strong>${E(p.name)}</strong><span class="am-ed-tag">현재 ${E(current)}</span></div>${Choices('productImageRatios.'+p.id,[['auto','자동 · 높이 조합'],...IMAGE_RATIOS],chosen)}</div>`;
 }).join('');
 const ratios=products.map((p,i)=>masonryRatio(s,p.id,i));
 const warning=products.length===1?'상품이 1개여서 메이슨리의 높낮이 차이가 드러나지 않습니다.':products.length>1&&new Set(ratios).size===1?'현재 모든 이미지의 비율이 같아 메이슨리의 높낮이 차이가 사라집니다. 일부 상품을 자동 비율로 바꾸거나 그리드를 선택해 주세요.':'';
 return `<section class="am-ed-group am-ed-image-ratio am-ed-masonry-ratios" data-masonry-ratio-control="1"><div class="am-ed-group__title"><h3>상품별 이미지 비율</h3><span class="am-ed-tag">메이슨리 전용</span></div><p class="am-ed-group__description">메이슨리는 서로 다른 높이의 이미지가 특징입니다. 기본값은 상품마다 비율을 섞어서 보여주며, 필요한 상품만 개별 변경할 수 있습니다. 다른 상품 배치의 공통 이미지 비율은 보존됩니다.</p>${warning?`<div class="am-ed-note am-ed-note--warning" role="status">${E(warning)}</div>`:''}<button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-masonry-reset="1">모든 이미지 높이 자동 조합으로 복원</button>${rows||'<p class="am-ed-note">상품을 넣으면 비율을 고를 수 있어요.</p>'}</section>`;
}

function imageRatio(s){const allowed=IMAGE_RATIOS.some(([id])=>id===s.imageRatio);return allowed?s.imageRatio:(['grid2','grid3','feat'].includes(s.layout)?'1:1':'4:3');}
function imageRatioPicker(s){if(!IMAGE_LAYOUTS.has(s.layout))return '';
 if(['grid2','grid3','feat'].includes(s.layout)&&productView(s)==='masonry')return masonryRatioPicker(s);
 return `<section class="am-ed-group am-ed-image-ratio" data-image-ratio-control="1"><div class="am-ed-group__title"><h3>이미지 비율</h3><span class="am-ed-tag">${E(imageRatio(s))}</span></div><p class="am-ed-group__description">이 구좌의 이미지 자리 비율을 바꿉니다. 상품 카드에 삽입된 개별 이미지 비율은 블록 속성에서 설정할 수 있어요.</p>${Choices('imageRatio',IMAGE_RATIOS,imageRatio(s))}</section>`;
}
function imageRatioCss(s){return imageRatio(s).replace(':',' / ')}

function columnSettings(s){
 const layout=s.layout;
 if(['benefit','service','story','detail','timeline'].includes(layout)){
  if(layout==='service'&&s.config?.presentation==='accordion')return null; // Accordion is intrinsically one column; retain saved config.columns for plain mode.
  const fallback=['benefit','service'].includes(layout)?2:1;
  return {path:'config.columns',options:COLUMN_LIMITS[layout],selected:Number(s.config?.columns||fallback),description:'한 줄에 몇 개씩 놓을지 정해요.'};
 }
 if(['grid2','grid3','feat'].includes(layout)){
  const view=productView(s);
  if(view==='list'||view==='card')return null; // These are intentionally always one column. Keep old saved number.
  const carousel=view==='carousel';
  return {path:'layoutColumns.'+layout,options:carousel?[1,2,3,4]:COLUMN_LIMITS[layout],selected:Number(s.layoutColumns?.[layout]||PRODUCT_COLUMN_DEFAULTS[layout]),label:carousel?'한 화면에 보이는 카드 수':'화면 열 배치',unit:carousel?'장':'열',description:carousel?'한 화면에 보일 카드 수예요. 나머지는 옆으로 넘겨 봐요.':'한 줄에 보일 카드 수예요.'};
 }
 if(layout==='review'){
  if(s.rv?.layout==='feature-left')return null;
  return {path:'rv.columns',options:s.rv?.layout==='cards'?[1,2,3]:[1,2],selected:Number(s.rv?.columns||2),description:'한 줄에 보일 후기 수예요. 글이 길면 1열이 읽기 편해요.'};
 }
 return null;
}
function columnPicker(s){const c=columnSettings(s);if(!c)return '';
 return `<section class="am-ed-group am-ed-column-section"><div class="am-ed-group__title"><h3>${E(c.label||'화면 열 배치')}</h3><span class="am-ed-tag">${E(c.selected)}${E(c.unit||'열')} 선택됨</span></div><p class="am-ed-group__description">${E(c.description)}</p><div class="am-ed-column-picker" role="group" aria-label="${E(LAYOUTS[s.layout][0])} ${E(c.label||'열 수')}">${c.options.map(n=>`<button type="button" class="am-ed-column-option" data-column-path="${E(c.path)}" data-columns="${n}" aria-pressed="${c.selected===n}" aria-label="${n}${E(c.unit||'열')}로 배치"><span class="am-ed-column-thumb cols-${n}" aria-hidden="true">${Array.from({length:n},()=>'<i></i>').join('')}</span><strong>${n}${E(c.unit||'열')}</strong><small>${n===1?'크게 보기':n===2?'균형 있게':n===3?'한눈에 비교':'작게 촘촘히'}</small></button>`).join('')}</div></section>`;
}
const PRODUCT_FOR_REVIEW = id => PRODUCTS.find(p=>p.id===id);
// Picker options are presentation choices only: all review variants map to the
// canonical 'review' layoutId. The original 21 layout IDs are not changed.
const PICKER_OPTIONS=CATALOG.flatMap(x=>x.id==='review'
 ? REVIEW_LAYOUTS.map(([variant,label])=>({ ...x,id:`review@${variant}`,layout:'review',variant,name:label,description:'후기 모음 · '+label,keywords:x.keywords+' '+label }))
 : x.id==='grid2'
 ? [...PRODUCT_VIEWS.map(([variant,label,description])=>({...x,id:`grid2@${variant}`,layout:'grid2',variant,variantKind:'product',name:'상품 '+label,description,keywords:x.keywords+' '+label+' 진열'})),
    {...x,id:'grid2@tabs',layout:'grid2',variant:'tabs',variantKind:'tabs',name:'상품 탭 (가격대·취향별)',description:'탭을 눌러 가격대·취향별 상품을 바꿔 보는 구좌 · 탭 하나가 PROMO_WORK 칸 하나',keywords:x.keywords+' 탭 필터 가격대 취향 테마 카테고리 진열'}]
 : ['notice','timeline'].includes(x.id)
 ? [{...x,layout:x.id,variant:null},{...x,id:`${x.id}@accordion`,layout:x.id,variant:'accordion',variantKind:'accordion',name:x.id==='notice'?'약관·규정 아코디언':'배송·일정 아코디언',description:'접힌 제목과 펼침 내용을 각각 지정하는 안내',keywords:x.keywords+' 접기 펼치기'}]
 : [{...x,layout:x.id,variant:null}]);
const PICKER_OPTION=id=>PICKER_OPTIONS.find(x=>x.id===id);
const pickerIdFor=s=>s.layout==='review'?`review@${(s.rv&&s.rv.layout)||'cards'}`:s.layout==='grid2'?(ftOn(s)?'grid2@tabs':`grid2@${productView(s)}`):['notice','timeline'].includes(s.layout)&&s.config?.presentation==='accordion'?`${s.layout}@accordion`:s.layout;
const EVENT_UI_DEFAULTS={
 'ev-quiz':{question:'나에게 어울리는 차를 골라볼까요?',options:['꽃향이 느껴지는 산뜻한 차','고소하고 깊은 맛의 차','시원하게 즐기는 차']},
 'ev-share':{sharePrompt:'이벤트를 친구에게 알려주세요',shareChannels:'링크 복사, 메시지'},
 'ev-ugc':{entryMode:'both',entryPrompt:'나만의 티타임을 기록해주세요'},
 'ev-stamp':{totalDays:'7',currentDays:'2',stampCaption:'하루 한 번 참여하고 스탬프를 모아보세요'},
 'ev-draw':{wheelLabels:'혜택 A\n혜택 B\n혜택 C\n혜택 D',drawCaption:'참여 후 결과를 확인하세요'},
 'ev-coupon':{couponValue:'혜택 내용 입력',couponCondition:'발급 조건을 입력해주세요'}
};
function eventUI(s){
 const defaults=EVENT_UI_DEFAULTS[s.layout]||{};
 return {...defaults,...(s.ev?.ui||{})};
}
function ensureEventUI(s){
 if(s.layout.startsWith('ev-')){s.ev=s.ev||{};s.ev.ui={...eventUI(s)};}
 FLOW.ensure(s);
}


const ELEMENTS={img:['상품 이미지','자동'],label:['모서리 라벨','직접'],pill:['알약','자동·직접'],appeal:['소구문구','상품별'],tag:['이름 앞 태그','직접'],name:['상품명','자동'],list:['정가','자동'],first:['1단 가격','자동'],pct:['할인율','자동'],pname:['가격 이름','자동'],sale:['판매가','자동'],rating:['별점·리뷰 수','자동'],review:['고객 후기 한 줄','자동'],ai:['AI 후기 요약','연결 예정'],copy:['카드 문구','직접'],btn:['버튼','직접']};
const ORDER=Object.keys(ELEMENTS);
// 기존 원본의 16개 구성 요소를 그대로 유지합니다. 고정형 프리셋은 제공하지 않습니다.
// 아래 숫자·상품·평점·후기는 모든 요소를 미리보기로 확인하기 위한 가상 데이터입니다.
const PRODUCTS=[
 {id:'D001',name:'봄날의 티 샘플러',listPrice:28000,rate:.20,extraRate:.10,rating:4.8,reviews:121,quote:'부담스럽지 않은 향이라 자주 마셔요.',appeal:'처음 시작하는 티타임'},
 {id:'D002',name:'허브 티 컬렉션',listPrice:34000,rate:.15,extraRate:0,rating:4.6,reviews:84,quote:'향이 부드럽고 선물하기도 좋아요.',appeal:'향긋한 일상의 휴식'},
 {id:'D003',name:'휴대용 티 보틀',listPrice:24000,rate:.10,extraRate:0,rating:4.7,reviews:36,quote:'휴대하기 편해서 매일 사용해요.',appeal:'어디서나 가볍게'},
 {id:'D004',name:'말차 스타터 키트',listPrice:35000,rate:.10,extraRate:0,rating:4.9,reviews:75,quote:'말차를 처음 만들 때 편리합니다.',appeal:'집에서 즐기는 말차'},
 {id:'D005',name:'선물용 티 세트',listPrice:49000,rate:.12,extraRate:0,rating:4.8,reviews:203,quote:'포장이 정갈해 선물하기 좋았습니다.',appeal:'감사의 마음을 담아'},
 {id:'D006',name:'아이스 티 팩',listPrice:19000,rate:.18,extraRate:0,rating:4.7,reviews:56,quote:'차갑게 우려도 향이 진해요.',appeal:'시원한 티타임'}
];
const MONEY=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const priced=p=>{if(Number.isFinite(p.salePrice)&&Number.isFinite(p.firstPrice))return {first:p.firstPrice,sale:p.salePrice,pct:Math.round((1-p.salePrice/p.listPrice)*100)};const first=Math.round(p.listPrice*(1-p.rate));const sale=Math.round(first*(1-p.extraRate));return {first,sale,pct:Math.round((1-sale/p.listPrice)*100)}};
let REVIEWS=[
{id:'r1',productId:'D001',title:'아침에 즐기기 편한 차예요',text:'부담스럽지 않은 향이라서 자주 마시게 됩니다.',rating:5,source:'demo'},
{id:'r2',productId:'D005',title:'선물 포장이 마음에 들어요',text:'포장이 정갈하게 되어 있어 선물하기 좋았어요.',rating:5,source:'demo'},
{id:'r3',productId:'D001',title:'향이 정말 은은해요',text:'티 입문자인 저도 편안하게 즐길 수 있어요.',rating:4,source:'demo'},
{id:'r4',productId:'D002',title:'선물용으로 추천합니다',text:'부드러운 향과 티 구성이 마음에 들어요.',rating:5,source:'demo'},
{id:'r5',productId:'D004',title:'설명대로 만들기 쉬워요',text:'처음 말차를 만드는 데 도움이 됐습니다.',rating:5,source:'demo'},
{id:'r6',productId:'D006',title:'여름에 딱 좋아요',text:'시원하게 마시기 정말 좋아요.',rating:4,source:'demo'}
];
const seedReviews=JSON.stringify(REVIEWS);

// Host (app) mode: the host supplies real catalog data, so never seed fictional products/reviews/references.
function HOST_MODE(){return window.AMOREAD_EDITOR_OPTIONS?.persistence==='external';}
let CATALOG_NOTE=null; // host-provided source description shown instead of the demo source text
function makeSection(layout,id,name,subtitle){
 const t=window.AM_makeSection(layout,id),defs=ITEM_DEFAULTS[layout]||t.items.map(x=>[x.label,x.text]);
 return {id,layout,productView:'grid',imageRatio:['grid2','grid3','feat'].includes(layout)?'1:1':'4:3',name:name??t.title,role:subtitle??t.subtitle,lines:[],num:false,ctaOn:false,cta:'',ctaTo:'',ctaStyle:CTA_DEFAULTS[layout]||'outline',ctaStyleModified:false,ctaTargetType:'none',ctaTarget:'',scope:'',cat:'',align:'left',gap:'normal',items:defs.map(x=>({label:x[0],text:x[1]})),card:{order:ORDER.slice(),on:Object.fromEntries(ORDER.map(k=>[k,['img','name','list','pct','pname','sale'].includes(k)?1:0])),def:{labelPosition:'top-left',label:'BEST',pill:'직접 쓰기',pillText:'오늘만',tag:'추천',copy:'고객의 선택을 돕는 한 줄',btn:'담기'}},productIds:HOST_MODE()?[]:['D001','D002'],appeals:Object.fromEntries(PRODUCTS.map(p=>[p.id,p.appeal])),ev:{how:'',reward:'쿠폰',rewardText:'',pick:'추첨',count:'',when:'',login:true,notice:'',ui:{...(EVENT_UI_DEFAULTS[layout]||{})}},rv:{shape:'mix',layout:'cards',productId:'all',show:{img:true,name:true,price:false},selected:HOST_MODE()?[]:['r1','r2'],order:HOST_MODE()?[]:['r1','r2'],titles:HOST_MODE()?{}:{r1:'',r2:''},author:'hide'},refs:HOST_MODE()?[]:[{id:'ref1',name:'이전 자사몰 선물 기획전',from:'가상 레퍼런스',attached:false,note:''},{id:'ref2',name:'브랜드 포장 안내',from:'가상 레퍼런스',attached:false,note:''}],moods:[],notes:''};
}

function ensureCustom(s){
 if(s.layout!=='custom')return null;
 if(!s.custom||typeof s.custom!=='object')s.custom={};
 const d={mode:'sketch',height:'medium',heightPx:null,status:'idea',purpose:'',referenceUrl:'',referenceTitle:'',referenceNotes:'',interactionNotes:'',imageData:'',imageName:''};
 for(const [key,value] of Object.entries(d))if(s.custom[key]===undefined)s.custom[key]=value;
 return s.custom;
}
function safeReferenceUrl(raw){try{const u=new URL(String(raw||''));return ['https:','http:'].includes(u.protocol)?u.href:''}catch(_){return ''}}
function safeRefImage(raw){return /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(String(raw||''))?raw:''}
const CUSTOM_SIZE_MIN=160, CUSTOM_SIZE_MAX=1600, CUSTOM_SIZE_STEP=20;
const CUSTOM_PRESETS={auto:160,short:160,medium:210,tall:350};
const customManualHeight=c=>Number.isFinite(Number(c.heightPx))&&c.heightPx!==null&&c.heightPx!==''&&Number(c.heightPx)>=CUSTOM_SIZE_MIN?Math.min(CUSTOM_SIZE_MAX,Math.max(CUSTOM_SIZE_MIN,Math.round(Number(c.heightPx)/CUSTOM_SIZE_STEP)*CUSTOM_SIZE_STEP)):null;
const customPresetHeight=c=>CUSTOM_PRESETS[c.height]||CUSTOM_PRESETS.medium;
function customPreview(s){
 const c=ensureCustom(s),image=safeRefImage(c.imageData),url=safeReferenceUrl(c.referenceUrl);
 const customHeight=customManualHeight(c),visibleHeight=customHeight||customPresetHeight(c);
 const heightAttr=customHeight?` data-am-style="--am-custom-height:${customHeight}px"`:'';
 const showResize=!window.AM_CB_STATIC_EXPORT&&s.id===current;
 const embedded=AMBlocks.renderSlot(s,'section:after',blockContext(),{staticView:!!window.AM_CB_STATIC_EXPORT,showEmpty:cbRailMode==='library'&&showResize});
 const resize=showResize?`<button type="button" role="slider" class="am-custom-resize-handle" data-custom-resize="${E(s.id)}" aria-label="자유 기획 구좌 높이 조절, 위아래 화살표로 20픽셀 변경" aria-orientation="vertical" aria-valuemin="${CUSTOM_SIZE_MIN}" aria-valuemax="${CUSTOM_SIZE_MAX}" aria-valuenow="${visibleHeight}" aria-valuetext="${visibleHeight}픽셀" title="끌어서 프레임 높이 변경 · ↑↓ 20px, Shift+↑↓ 100px"><span class="am-custom-resize-lines" aria-hidden="true"></span><span class="am-custom-resize-readout" aria-hidden="true">${visibleHeight}px</span></button>`:'';
 const imageMarkup=image?`<img class="am-custom-reference-image" src="${E(image)}" alt="첨부한 레퍼런스 이미지">`:'';
 const empty=`<div class="am-custom-art-placeholder"><span>▧</span><strong>구좌 구성 미정 · 공간 확보</strong><small>좌측 ‘요소’에서 이미지·상품 카드·텍스트 등을 추가할 수 있어요.</small></div>`;
 return `<div class="am-custom-frame am-custom-frame--${E(c.height)}${showResize?' am-custom-frame--resizable':''}" data-custom-frame="${E(s.id)}"${heightAttr}>
 <div class="am-custom-meta"><span class="am-custom-chip subtle">${E({idea:'아이디어',review:'디자인 검토 필요',ready:'인계 준비'}[c.status]||'아이디어')}</span></div>
 ${c.purpose?`<p class="am-custom-intent"><b>기획 의도</b> ${E(c.purpose)}</p>`:''}
 ${c.mode==='blocks'?'':(c.mode==='reference'&&image?imageMarkup:empty)}
 ${c.mode==='reference'&&image?'<span class="am-custom-caption">참고 이미지 · 고객 노출 화면이 아닙니다</span>':''}
 ${c.referenceTitle?`<div class="am-custom-ref-title">레퍼런스 · ${E(c.referenceTitle)}</div>`:''}
 ${url?`<a class="am-custom-ref-link" href="${E(url)}" rel="noopener noreferrer" target="_blank" title="${E(url)}">↗ ${E(url.length>65?url.slice(0,62)+'…':url)}</a>`:''}
 ${c.referenceNotes?`<div class="am-custom-annotation"><b>참고할 부분</b><p>${E(c.referenceNotes)}</p></div>`:''}
 ${c.interactionNotes?`<div class="am-custom-annotation"><b>인터랙션 / 상태 메모</b><p>${E(c.interactionNotes)}</p></div>`:''}
 ${embedded}${resize}
 </div>`;
}
function customPanel(s){
 const c=ensureCustom(s);
 const field=(key,label,opts={})=>F('custom.'+key,label,c[key],opts);
 const currentImage=safeRefImage(c.imageData);
 return G('구좌 위치와 구성 단계','모양이 아직 정해지지 않은 구좌도 자리부터 잡아 둘 수 있어요. 참고 자료는 고객 화면과 따로 보여요.',
 `<div class="am-ed-field"><span class="am-ed-label">현재 작업 방식</span>${Choices('custom.mode',[['sketch','빈 구조 · 영역 확보'],['reference','레퍼런스 이미지 보기'],['blocks','블록 직접 구성']],c.mode)}</div>`+
 `<div class="am-ed-field"><span class="am-ed-label">프레임 높이 프리셋</span>${Choices('custom.height',[['auto','콘텐츠 맞춤'],['short','짧게'],['medium','기본'],['tall','길게']],c.height)}</div>`+
 `<div class="am-ed-field am-custom-height-field"><label class="am-ed-label" for="customHeightInput">프레임 최소 높이 (px)</label><div class="am-ed-inline"><input id="customHeightInput" class="am-ed-input" data-custom-height-input type="number" inputmode="numeric" min="${CUSTOM_SIZE_MIN}" max="${CUSTOM_SIZE_MAX}" step="${CUSTOM_SIZE_STEP}" placeholder="프리셋 · ${customPresetHeight(c)}px" value="${customManualHeight(c)??''}"><button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-custom-fit>자동 맞춤</button></div><small class="am-ed-field-meta">구좌 하단 손잡이를 드래그해도 변경할 수 있어요. ${CUSTOM_SIZE_MIN}~${CUSTOM_SIZE_MAX}px · 20px 단위. 콘텐츠가 높이보다 길면 잘리지 않고 자동으로 늘어납니다.</small></div>`+
 `<div class="am-ed-field"><span class="am-ed-label">작업 상태</span>${Choices('custom.status',[['idea','아이디어'],['review','검토 필요'],['ready','인계 준비']],c.status)}</div>`+
 field('purpose','이 구좌를 넣는 이유 · 고객에게 전달할 것',{max:400,area:true,rows:3,optional:true})
 )+G('레퍼런스 첨부','배치를 참고하는 이미지예요. 고객 화면에는 나가지 않아요.',
 field('referenceTitle','레퍼런스 이름',{max:120,optional:true})+
 field('referenceUrl','원본 URL (선택)',{max:500,optional:true,help:'https://로 시작하는 주소만 받아요. 주소만 저장하고 열어 보지는 않아요.'})+
 `<div class="am-ed-field"><label class="am-ed-label" for="customImageUpload">레퍼런스 이미지 첨부</label><input id="customImageUpload" class="am-ed-input" type="file" accept="image/png,image/jpeg,image/webp"><small class="am-ed-field-meta">이미지는 줄여서 이 기획안에 함께 저장해요. 다른 곳으로 보내지 않아요.</small></div>`+
 (currentImage?`<div class="am-custom-attach-preview"><img src="${E(currentImage)}" alt="첨부된 레퍼런스"><div><b>${E(c.imageName||'첨부 이미지')}</b><button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-custom-remove-image>이미지 제거</button></div></div>`:'<div class="am-ed-note">아직 첨부한 레퍼런스가 없어요. 링크나 이미지 하나만 있어도 돼요.</div>')+
 field('referenceNotes','참고할 배치 · 색감 · 요소',{max:800,area:true,rows:4,optional:true})
 )+G('디자이너에게 넘길 동작','원하는 움직임을 적으면 디자인 요청에 같이 들어가요.',
 field('interactionNotes','버튼·스크롤·스와이프·상태 변화 등',{max:800,area:true,rows:4,optional:true})+
 `<div class="am-ed-note">왼쪽 [＋ 요소]로 상품 카드·글·이미지·버튼·묶음을 더 넣을 수 있어요.</div>`);
}
function customQualityPanel(s){const c=ensureCustom(s);const warnings=[];
 if(!c.purpose.trim())warnings.push('구좌의 기획 의도가 비어 있습니다.');
 if(!c.referenceUrl.trim()&&!c.imageData&&!AMBlocks.slot(s,'section:after').length)warnings.push('레퍼런스 이미지·URL·구성 블록 중 하나를 추가하면 인계가 명확해집니다.');
 if(c.referenceUrl.trim()&&!safeReferenceUrl(c.referenceUrl))warnings.push('레퍼런스 주소는 https://로 시작해야 해요.');
 if(c.status==='ready'&&!c.interactionNotes.trim()&&!s.notes.trim())warnings.push('인계 준비 상태지만 디자이너 요청·상태 설명이 없습니다.');
 if(c.heightPx!=null&&customManualHeight(c)==null)warnings.push('지정한 프레임 높이가 허용 범위를 벗어납니다. 160~1600px로 설정하세요.');
 return G('자유 기획 검수','참고 자료가 고객 화면 요소로 잘못 들어가지 않았는지 확인해요.', warnings.length?warnings.map(w=>`<div class="am-ed-note am-ed-note--warning">${E(w)}</div>`).join(''):'<div class="am-ed-note">확인할 것이 없어요.</div>');
}
function defaults(){const a=[makeSection('hero','s1','봄을 전하는 차 한 잔','이번 시즌을 위한 선물 제안'),makeSection('benefit','s2','이번 프로모션 혜택','놓치지 말아야 할 혜택'),makeSection('grid2','s3','선물 취향별 추천','선물받는 분의 취향에 따라 골라보세요'),makeSection('service','s4','선물 포장 서비스','마음을 전하는 포장'),makeSection('ev-ugc','s5','티타임 사진 인증','댓글 또는 사진으로 참여하세요'),makeSection('review','s6','구매자가 먼저 전하는 이야기','선택에 도움이 되는 후기')];a[1].items=[{label:'시즌 할인',text:'일부 대상 상품 할인'},{label:'선물 포장',text:'조건 충족 시 제공'}];a[2].num=false;a[2].scope='선물 세트';a[2].cat='';a[2].lines=[{text:'취향별로 가볍게 둘러보세요'}];a[2].ctaOn=true;a[2].cta='상품 더 보기';a[2].ctaTo='선물 상품 목록';a[3].items=[{label:'선물 포장',text:'선물할 때 이용 가능한 옵션'},{label:'쇼핑백',text:'해당 제품에 한해 제공'}];a[4].ev={how:'티타임 사진 또는 댓글 등록',reward:'포인트',rewardText:'추첨 제공',pick:'추첨',count:'50',when:'행사 기간 내',login:true,notice:'자세한 조건 확인 필요'};return a}
let cbRailMode='sections',cbSelected=null,cbEditStart=null,canvasTarget=null,cbCardOpenField=null,cbCardOpenNode=null,cbCardDetailsOpen=false;
// IA v1.11: only navigation state; never modify stored section/block schemas.
let iaGroup='content',iaLibraryMode='blocks',iaDataMode='products',iaSelectedChild=null;
const iaTreeOpen=new Set(['s3']);
const IA_BLOCK_NAMES={productCard:'상품 카드',productGrid:'상품 카드 묶음',text:'텍스트',image:'이미지',cta:'CTA 버튼',review:'후기 카드',benefit:'혜택',notice:'유의사항',group:'요소 묶음'};
const IA_GROUPS={content:'내용',layout:'배치·표시',operation:'동작·조건',handoff:'참고·인계',check:'검수'};
const IA_TAB_GROUP={media:'layout',copy:'content',products:'content',shape:'layout',items:'layout',review:'layout',event:'operation',status:'operation',refs:'handoff',notes:'handoff',check:'check'};

let sections=defaults(),current='s3',tab='copy',pickerMode='change',pickerCategory='전체',pickerQuery='',pickerSelected='grid2';
const section=()=>sections.find(s=>s.id===current)||sections[0];
let undoStack=[], redoStack=[], inputSnapshot=null, snapshotTimer=null;
const clone=v=>JSON.parse(JSON.stringify(v));
// External host contract is intentionally transport-agnostic. The GitLab
// application supplies its own authenticated fetch/save implementation; this
// standalone editor never assumes private endpoints or credentials.
const hostSubscribers=new Set();
const externalPersistence=window.AMOREAD_EDITOR_OPTIONS?.persistence==='external';
function serialize(){return {sections,current,tab};} // 파일에서 가져온 후기 원문은 자동 저장하지 않음
function capture(){return JSON.stringify(serialize());}
function mark(before){if(!before)return;const after=capture();if(after!==before){undoStack.push(before);if(undoStack.length>60)undoStack.shift();redoStack=[];saveDemo();}}
function restore(json){const x=JSON.parse(json);sections=x.sections;current=x.current;tab=x.tab;renderAll();saveDemo();}
function undo(){if(!undoStack.length)return;redoStack.push(capture());restore(undoStack.pop());toast('실행 취소했어요')}
function redo(){if(!redoStack.length)return;undoStack.push(capture());restore(redoStack.pop());toast('다시 실행했어요')}
function saveDemo(){
 const snapshot=JSON.parse(capture());
 if(!externalPersistence){try{localStorage.setItem('amoread-lab-v09',JSON.stringify(snapshot))}catch(_){}}
 // Callback failures must never interrupt editing or the local undo stack.
 for(const callback of hostSubscribers){try{callback(snapshot)}catch(error){console.warn('AMOREAD host listener failed',error);}}
}
function loadDemo(){if(externalPersistence)return;try{let t=localStorage.getItem('amoread-lab-v09');if(!t)return;let x=JSON.parse(t);if(Array.isArray(x.sections)&&x.sections.every(s=>LAYOUTS[s.layout])){sections=x.sections;current=x.current;tab=x.tab;}}catch(_){}}

function tabs(s){if(s.layout==='custom')return [['copy','문구'],['items','자유 구성 · 레퍼런스'],['refs','레퍼런스'],['notes','디자인 요청']];const cat=LAYOUTS[s.layout][1];if(cat==='상품')return [['copy','문구'],['shape','카드 모양'],['products','상품'],['refs','레퍼런스'],['notes','디자인 요청']];if(cat==='이벤트')return [['copy','문구'],['event','운영 조건'],['refs','레퍼런스'],['notes','디자인 요청']];if(cat==='후기')return [['copy','문구'],['review','후기'],['refs','레퍼런스'],['notes','디자인 요청']];if(s.layout==='hero')return [['copy','문구'],['refs','레퍼런스'],['notes','디자인 요청']];return [['copy','문구'],['items','구성 요소'],['refs','레퍼런스'],['notes','디자인 요청']];}

function iaTreeBlock(node,sid,depth=0){
 const name=node.type==='productCard'?PRODUCTS.find(p=>p.id===node.props?.productId)?.name||'연결 상품 미선택':node.type==='text'?(node.props?.text||'텍스트').slice(0,22):IA_BLOCK_NAMES[node.type]||node.type;
 const selected=cbSelected===node.id&&current===sid;
 const line=`<button type="button" class="ia-tree-node ia-depth-${Math.min(depth,3)}" data-ia-node="block" data-ia-sort="block" draggable="true" data-ia-section="${E(sid)}" data-ia-id="${E(node.id)}" aria-current="${selected}"><span class="ia-sort-grip" aria-hidden="true">⠿</span><span aria-hidden="true">${node.type==='productCard'?'▦':node.type==='cta'?'↗':'◇'}</span><span>${E(name)}</span></button>`;
 return line+(node.children||[]).map(ch=>iaTreeBlock(ch,sid,depth+1)).join('');
}
function iaTreeChildren(s){
 let out='';const sid=E(s.id);
 if(['grid2','grid3','feat','deal-banner'].includes(s.layout))out+=(s.productIds||[]).map((id,i)=>`<button type="button" class="ia-tree-node ia-depth-1" data-ia-node="native-product" data-ia-sort="native-product" draggable="true" data-ia-section="${sid}" data-ia-index="${i}" aria-current="${current===s.id&&iaSelectedChild?.type==='native-product'&&iaSelectedChild?.index===i}"><span class="ia-sort-grip" aria-hidden="true">⠿</span>${AMEditorKit.icon('package')} <span>${E(PRODUCTS.find(p=>p.id===id)?.name||id)}</span></button>`).join('');
 if(['benefit','service','story','detail','timeline','notice'].includes(s.layout))out+=(s.items||[]).map((x,i)=>`<button type="button" class="ia-tree-node ia-depth-1" data-ia-node="item" data-ia-sort="item" draggable="true" data-ia-section="${sid}" data-ia-index="${i}" aria-current="${current===s.id&&iaSelectedChild?.type==='item'&&iaSelectedChild?.index===i}"><span class="ia-sort-grip" aria-hidden="true">⠿</span>${AMEditorKit.icon('layers')} <span>${E(x.label||`항목 ${i+1}`)}</span></button>`).join('');
 if(s.layout==='review')out+=(s.rv?.order||[]).map((rid,i)=>`<button type="button" class="ia-tree-node ia-depth-1" data-ia-node="review" data-ia-sort="review" draggable="true" data-ia-section="${sid}" data-ia-id="${E(rid)}" aria-current="${current===s.id&&iaSelectedChild?.type==='review'&&iaSelectedChild?.index===i}"><span class="ia-sort-grip" aria-hidden="true">⠿</span>${AMEditorKit.icon('star')} <span>후기 ${i+1}</span></button>`).join('');
 if(s.layout==='ev-quiz'){
  FLOW.ensure(s);const quiz=s.ev.ui.quiz;
  out+=`<button type="button" class="ia-tree-node ia-depth-1" data-ia-node="quiz-view" data-ia-section="${sid}" data-ia-id="intro">${AMEditorKit.icon('layers')} <span>시작 화면</span></button>`;
  out+=quiz.questions.map((q,i)=>`<button type="button" class="ia-tree-node ia-depth-1" data-ia-node="quiz-question" data-ia-sort="quiz-question" draggable="true" data-ia-section="${sid}" data-ia-index="${i}" data-ia-id="${E(q.id)}"><span class="ia-sort-grip" aria-hidden="true">⠿</span>${AMEditorKit.icon('circle-help')} <span>질문 ${i+1} · ${E(q.text.slice(0,16))}</span></button>`).join('');
  out+=quiz.results.map((r,i)=>`<button type="button" class="ia-tree-node ia-depth-1" data-ia-node="quiz-result" data-ia-sort="quiz-result" draggable="true" data-ia-section="${sid}" data-ia-index="${i}" data-ia-id="${E(r.id)}"><span class="ia-sort-grip" aria-hidden="true">⠿</span>${AMEditorKit.icon('check')} <span>결과 ${i+1} · ${E(r.title.slice(0,16))}</span></button>`).join('');
 }
 const eb=AMBlocks.ensure(s).slots||{};
 for(const [key,nodes] of Object.entries(eb)){
  if(!nodes?.length)continue;
  const quiz=s.layout==='ev-quiz',label=quiz?'결과 화면에 추가한 요소':'추가한 구성 요소';
  out+=`<div class="ia-tree-slot"><span class="ia-tree-slot-title">${label}</span>${nodes.map(n=>iaTreeBlock(n,s.id,1)).join('')}</div>`;
 }
 return out;
}
// 상품 구좌의 칸 수: 02 구좌 구성에서 정한 수(slotCount) → 없으면 진열 기본(2열 4칸·3열 6칸). 넣은 상품이 더 많으면 그 수
function productSlotTotal(s,cols){const c=cols||PRODUCT_COLUMN_DEFAULTS[s.layout]||2,def=s.layout==='feat'?Math.max(2,c):c*2;
 // 탭 구좌는 지금 보는 탭 기준 (칸 수는 구좌 전체 값이라 탭마다 나누지 않고 진열 기본 칸 수를 쓴다)
 if(ftOn(s))return Math.max(def,(s.productIds||[]).length);
 return Math.max(Number(s.slotCount)||def,(s.productIds||[]).length);}
function productSlotsLeft(s,n,cols){return Math.max(0,productSlotTotal(s,cols)-n);}
// 목록 줄의 채움 상태: 상품 구좌는 '상품 2/4', 후기 구좌는 '후기 n개' (빈 곳이 있으면 is-need → 주의 색)
function fillState(s){
 if(ftOn(s)){ftStore(s);const empty=s.ftabs.filter(t=>!t.productIds.length).length,n=new Set(s.ftabs.flatMap(t=>t.productIds)).size;return {text:`탭 ${s.ftabs.length}개 · 상품 ${n}개${empty?` · 빈 탭 ${empty}`:''}`,need:!!empty};}
 if(['grid2','grid3','feat'].includes(s.layout)){const n=(s.productIds||[]).length,t=productSlotTotal(s);return {text:`상품 ${n}/${t}`,need:n<t};}
 if(s.layout==='review'){const n=(s.rv?.selected||[]).length;return {text:n?`후기 ${n}개`:'후기 없음',need:!n};}
 return null;
}
function renderList(){ $('section-list').innerHTML=sections.map((s,i)=>{
 const expanded=true, children=iaTreeChildren(s);   // 2026-11-15: 접기 없이 늘 펼침 (plans/27 §9)
 return `<div class="ia-tree-section"><div class="outline-entry" draggable="true" data-drag-id="${E(s.id)}"><button type="button" class="ia-tree-toggle" data-ia-toggle="${E(s.id)}" aria-label="${E(s.name)} 구성 ${expanded?'접기':'펼치기'}" aria-expanded="${expanded}">${AMEditorKit.icon('chevron-right')}</button><button type="button" class="outline-item" data-section="${E(s.id)}" aria-current="${current===s.id&&!cbSelected}"><span>${String(i+1).padStart(2,'0')} · ${E(s.name)}</span><small>${E(LAYOUTS[s.layout][0])}${(f=>f?` · <em class="ia-fill${f.need?' is-need':''}">${E(f.text)}</em>`:'')(fillState(s))}</small></button><div class="outline-entry-actions"><button type="button" data-list-action="up:${E(s.id)}" aria-label="위로" ${i===0?'disabled':''}>${AMEditorKit.icon('arrow-up','am-kit-icon--sm')}</button><button type="button" data-list-action="down:${E(s.id)}" aria-label="아래로" ${i===sections.length-1?'disabled':''}>${AMEditorKit.icon('arrow-down','am-kit-icon--sm')}</button><button type="button" data-list-action="clone:${E(s.id)}" aria-label="복제">${AMEditorKit.icon('copy','am-kit-icon--sm')}</button><button type="button" data-list-action="delete:${E(s.id)}" aria-label="삭제" ${sections.length===1?'disabled':''}>${AMEditorKit.icon('trash','am-kit-icon--sm')}</button></div></div>${expanded?`<div class="ia-tree-children">${children||'<small class="ia-tree-empty">이 구좌에는 아직 별도 요소가 없어요.</small>'}</div>`:''}</div>`
 }).join('');}


// 카드 요소 16개 중 연결 예정인 AI 요약을 제외한 15개를 실제 미리보기에 출력합니다.
// card.order의 순서는 DOM 순서에 그대로 반영하고 card.on 토글은 표시 여부를 제어합니다.
function productElement(s,p,key){
 const v=s.card.def,price=priced(p),safe=E,wrap=(cls,html)=>`<div class="mock-el mock-el--${cls}" data-card-element="${cls}">${html}</div>`;
 switch(key){
  case 'img':return wrap(key,'<div class="mock-product-image" aria-label="상품 이미지 자리">이미지 자리</div>');
  case 'label':return wrap(key,`<span class="mock-card-label">${safe(v.label||'라벨 입력 필요')}</span>`);
  case 'pill':{
   const text=v.pill==='직접 쓰기'?(v.pillText||'알약 문구 입력 필요'):v.pill==='오늘만'?'오늘만':v.pill==='남은 기간'?'남은 기간: 연결 필요':v.pill==='가격 오름 예고'?'행사 후 가격 확인 필요':'알약 유형 선택 필요';
   return wrap(key,`<span class="mock-card-pill">${safe(text)}</span>`);
  }
  case 'appeal':return wrap(key,`<span class="mock-card-appeal">${safe(s.appeals[p.id]||'소구문구 입력 필요')}</span>`);
  case 'tag':return wrap(key,`<span class="mock-card-tag">[${safe(v.tag||'태그 입력 필요')}]</span>`);
  case 'name':return wrap(key,`<strong class="mock-card-name">${safe(p.name)}</strong>`);
  case 'list':return wrap(key,`<del>${MONEY(p.listPrice)}</del>`);
  case 'first':return wrap(key,p.extraRate>0?`<del>1단 ${MONEY(price.first)}</del>`:'<span class="mock-card-empty">2단 혜택 미적용</span>');
  case 'pct':return wrap(key,`<strong class="mock-card-discount">${price.pct}% 할인</strong>`);
  case 'pname':return wrap(key,`<span class="mock-card-price-label">${safe(p.priceLabel||(p.extraRate>0?'추가 혜택가':p.rate>0?'할인가':'판매가'))}</span>`);
  case 'sale':return wrap(key,`<strong class="mock-card-price">${MONEY(price.sale)}</strong>`);
  case 'rating':return wrap(key,p.reviews>0&&p.rating>0?`<span class="mock-card-rating">★ ${p.rating.toFixed(1)} · 후기 ${p.reviews}개</span>`:'<span class="mock-card-empty">후기 없음</span>');
  case 'review':return wrap(key,`<span class="mock-card-quote">“${safe(p.quote)}”</span>`);
  case 'copy':return wrap(key,`<span class="mock-card-copy">${safe(v.copy||'카드 문구 입력 필요')}</span>`);
  case 'btn':return wrap(key,`<span class="mock-card-action">${safe(v.btn||'버튼 문구 입력 필요')}</span>`);
  // AI는 사내 API 연결 전까지 토글을 비활성화합니다. 생성된 내용으로 오인시키지 않습니다.
  case 'ai':return '';
  default:return '';
 }
}
function renderProductCardElements(s,p,options={}){
 const order=s.card?.order||ORDER,on={...(s.card?.on||{}),...(options.nativeCard?s.cardElementOverrides?.[p.id]:null)},def=s.card?.def||{};
 const imgOn=!!on.img,labelOn=!!on.label;
 const place=['top-left','top-right','bottom-left','bottom-right'].includes(def.labelPosition)?def.labelPosition:'top-left';
 const effectiveRatio=productView(s)==='masonry'&&Number.isInteger(options.masonryIndex)?masonryRatio(s,p.id,options.masonryIndex):imageRatio(s);
 const media=()=>`<div class="mock-product-media" data-card-element="img" data-effective-ratio="${E(effectiveRatio)}" data-am-style="--am-product-aspect:${E(effectiveRatio.replace(':',' / '))}"><div class="mock-product-image" aria-label="상품 이미지 자리">이미지 자리</div>${labelOn?`<span class="mock-el mock-el--label mock-card-label mock-card-label--corner ${E(place)}" data-card-element="label">${E(def.label||'라벨 입력 필요')}</span>`:''}</div>`;
 const inline=()=>`<div class="mock-el mock-el--label mock-label-without-image" data-card-element="label">${E(def.label||'라벨 입력 필요')} <small>이미지를 켜면 모서리로 이동</small></div>`;
 let drawnImage=false;
 const html=order.map(k=>{
  if(k==='img'&&imgOn){drawnImage=true;return media()}
  if(k==='label'){return !imgOn&&labelOn?inline():''}
  return on[k]?productElement(s,p,k):'';
 }).join('');
 return imgOn&&!drawnImage?media()+html:html;
}
function ctaMarkup(s){
 if(['countdown','deal-banner'].includes(s.layout)&&s.config?.previewState==='expired'){
   const behavior=s.config.after||'hide-cta';
   if(behavior==='hide-cta')return '';
   if(behavior==='show-result')return '<span class="mock-cta mock-cta--outline mock-cta--result" role="img" aria-label="행사 종료 안내">행사 결과 확인</span>';
 }
 if(!s.ctaOn)return '';
 const caption=s.cta||'자세히 보기',typ=CTA_STYLES.some(v=>v[0]===s.ctaStyle)?s.ctaStyle:CTA_DEFAULTS[s.layout]||'outline';
 const target=[s.ctaTargetType,s.ctaTarget].filter(Boolean).join(': ');
 return `<span class="mock-cta mock-cta--${typ}" role="img" aria-label="CTA 버튼 미리보기" title="${E(target||s.ctaTo||'목적지 미지정')}">${E(caption)}</span>`;
}

// All six events use real wireframe structures, not one shared placeholder box.
// This is an editorial planning preview, not a running promotion/lottery/payment widget.
function eventPreview(s){
 const expanded=FLOW.eventPreview(s);if(expanded)return expanded;
 const kind=s.layout, e=s.ev||{}, ui=eventUI(s);
 const esc=v=>E(String(v??''));
 const content=(value,placeholder)=>esc(String(value||'').trim()||placeholder);
 const foot=`<div class="mock-ev-footer"><div class="mock-ev-meta">${e.when?`<span>◷ ${esc(e.when)}</span>`:'<span>기간 미정</span>'}${e.reward&&e.reward!=='없음'?`<span>${esc(e.reward)}${e.rewardText?' · '+esc(e.rewardText):''}</span>`:'<span>보상 미정</span>'}</div>${e.how?`<p>${esc(e.how)}</p>`:''}<small>기획용 화면 · 실제 참여 및 결과 처리 미연결</small></div>`;
 if(kind==='ev-quiz'){
   const choices=(Array.isArray(ui.options)?ui.options:[]).slice(0,6);
   const options=choices.map((opt,i)=>`<div class="mock-ev-answer"><span class="mock-ev-radio">${String.fromCharCode(65+i)}</span><span>${content(opt,'선택지 입력')}</span><span class="mock-ev-arrow">›</span></div>`).join('');
   return `<div class="mock-event mock-event--quiz"><div class="mock-ev-quiz-cover"><span class="mock-ev-eyebrow">TASTE FINDER · QUIZ</span><div class="mock-ev-quiz-symbol" aria-hidden="true">✦</div><strong>내 취향을 발견하는 질문</strong><small>고객이 답하기 쉬운 질문부터 시작해요</small></div><div class="mock-ev-content"><div class="mock-ev-step"><span>QUESTION 01</span><div class="mock-ev-progress"><i></i><i></i><i></i></div></div><h4>${content(ui.question,'질문을 입력해주세요')}</h4><div class="mock-ev-answers">${options||'<span>선택지를 입력해주세요</span>'}</div><div class="mock-ev-action">선택하고 다음으로 <span>→</span></div></div>${foot}</div>`;
 }
 if(kind==='ev-share'){
   const channels=(ui.shareChannels||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean).slice(0,5);
   return `<div class="mock-event mock-event--share"><div class="mock-ev-content"><div class="mock-ev-badge">SHARE & INVITE</div><div class="mock-ev-share-icon" aria-hidden="true">↗</div><h4>${content(ui.sharePrompt,'공유 문구를 입력해주세요')}</h4><p class="mock-ev-subcopy">소중한 사람에게 이번 프로모션을 소개해요.</p><div class="mock-ev-link"><span>osulloc.com / event / ...</span><b>복사</b></div><div class="mock-ev-channels">${channels.map(x=>`<span>${esc(x)}</span>`).join('')||'<span>채널 미지정</span>'}</div></div>${foot}</div>`;
 }
 if(kind==='ev-ugc'){
   const photo=ui.entryMode!=='comment',comment=ui.entryMode!=='photo';
   return `<div class="mock-event mock-event--ugc"><div class="mock-ev-content"><div class="mock-ev-badge">YOUR TEA MOMENT</div><h4>${content(ui.entryPrompt,'인증 안내 문구 입력')}</h4><p class="mock-ev-subcopy">사진이나 이야기로 나만의 순간을 남겨주세요.</p>${photo?`<div class="mock-ev-upload"><span class="mock-ev-upload-icon">▧</span><strong>사진 추가</strong><small>예시 이미지 영역 · 이미지 업로드는 사내 연결 예정</small></div>`:''}${comment?`<div class="mock-ev-comment"><span>나의 티타임은…</span><span>✎</span></div>`:''}<div class="mock-ev-action">인증하고 참여하기 <span>→</span></div></div>${foot}</div>`;
 }
 if(kind==='ev-stamp'){
   const total=[3,5,7].includes(Number(ui.totalDays))?Number(ui.totalDays):7;
   const current=Math.max(0,Math.min(total,Number(ui.currentDays)||0));
   return `<div class="mock-event mock-event--stamp"><div class="mock-ev-stamp-cover"><div class="mock-ev-badge">DAILY CHECK-IN</div><h4>${content(ui.stampCaption,'출석 안내 문구 입력')}</h4><div class="mock-ev-stamp-status"><strong>${current}<small> / ${total}일</small></strong><span>시안의 진행 상태 예시</span></div><div class="mock-ev-track"><i data-am-style="width:${current/total*100}%"></i></div></div><div class="mock-ev-content"><div class="mock-ev-days">${Array.from({length:total},(_,i)=>`<div class="mock-ev-day ${i<current?'complete':i===current?'today':''}"><b>${i<current?'✓':i===current?'●':String(i+1).padStart(2,'0')}</b><small>DAY ${i+1}</small></div>`).join('')}</div><div class="mock-ev-action">오늘 출석하기 <span>→</span></div></div>${foot}</div>`;
 }
 if(kind==='ev-draw'){
   const labels=(ui.wheelLabels||'').split(/\n/).map(x=>x.trim()).filter(Boolean).slice(0,4);
   return `<div class="mock-event mock-event--draw"><div class="mock-ev-draw-cover"><div class="mock-ev-badge">LUCKY DRAW</div><h4>${content(ui.drawCaption,'뽑기 안내 문구 입력')}</h4><div class="mock-ev-wheel-shell"><div class="mock-ev-pointer"></div><div class="mock-ev-wheel">${[0,1,2,3].map(i=>`<span class="mock-ev-wheel-label label-${i}">${esc(labels[i]||'혜택 '+String.fromCharCode(65+i))}</span>`).join('')}<div class="mock-ev-wheel-center">START</div></div></div><small>구성 연출용 예시 · 확률/당첨 결과는 표시하지 않음</small></div><div class="mock-ev-content"><div class="mock-ev-action">참여하고 결과 확인 <span>→</span></div></div>${foot}</div>`;
 }
 if(kind==='ev-coupon'){
   return `<div class="mock-event mock-event--coupon"><div class="mock-ev-content"><div class="mock-ev-badge">SPECIAL OFFER</div><div class="mock-ev-ticket"><div class="mock-ev-ticket-body"><span>OSULLOC · EVENT COUPON</span><strong>${content(ui.couponValue,'혜택 내용 입력')}</strong><p>${content(ui.couponCondition,'발급 조건 입력')}</p></div><div class="mock-ev-ticket-side">↓<small>받기</small></div></div><div class="mock-ev-action">쿠폰 받기 <span>→</span></div></div>${foot}</div>`;
 }
 return '<div class="mock-event">이벤트 유형을 확인해주세요.</div>';
}
function demoInner(s){
 const flowInner=FLOW.infoPreview(s);
 if(flowInner&&s.layout==='deal-banner'){
  const chosen=(s.productIds||[]).map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  const cards=chosen.map((p,i)=>`<div class="mock-product" data-card-product="${E(p.id)}">${renderProductCardElements(s,p,{masonryIndex:i,nativeCard:true})}</div>`).join('');
  return flowInner+(cards?`<div class="mock-products am-cols-2 am-product-view-grid am-deal-products">${cards}</div>`:'');
 }
 if(flowInner)return flowInner;
 const repeat=s.items.map(it=>`<div class="mock-item"><strong>${E(it.label)}</strong><small>${E(it.text)}</small></div>`).join('');
 if(['benefit','service','detail','story','timeline','notice'].includes(s.layout))return `<div class="mock-element-stack mock-element-stack--${s.layout}">${repeat||'<div class="mock-item">구성 요소를 추가해주세요.</div>'}</div>`;
 if(s.layout==='custom')return customPreview(s);



 if(s.layout==='countdown')return '<div class="mock-countdown">D – 03 : 11 : 58</div>';

 if(['grid2','grid3','feat'].includes(s.layout)){
  const chosen=s.productIds.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  const cols=[1,2,3,4].includes(Number(s.layoutColumns?.[s.layout]))?Number(s.layoutColumns[s.layout]):PRODUCT_COLUMN_DEFAULTS[s.layout];
  // 02 구좌 구성에서 정한 칸 수(slotCount)만큼 진열 모양이 보이게: 넣은 상품 카드 + 남은 빈 카드 자리 (예전 편집기처럼 '상품 0/4')
  const left=productSlotsLeft(s,chosen.length,cols),slot='<div class="mock-product mock-product--slot" aria-hidden="true"><span class="mock-slot-img"></span><i></i><i></i></div>';
  if(!chosen.length)return `${ftPills(s)}<div class="mock-products am-cols-${cols} mock-products--slots ${s.layout==='feat'?'mock-products--featured':''}" aria-label="상품 ${left}개 자리">${slot.repeat(left)}</div><p class="mock-slot-note">상품을 넣으면 이 자리에 카드가 들어가요</p>`;
  return `${ftPills(s)}<div class="mock-products am-cols-${cols} am-product-view-${productView(s)} ${s.layout==='feat'?'mock-products--featured':''}">${chosen.map((p,i)=>`<div class="mock-product" data-card-product="${E(p.id)}">${renderProductCardElements(s,p,{masonryIndex:i,nativeCard:true})}</div>`).join('')}${slot.repeat(left)}</div>`;
 }
 if(s.layout.startsWith('ev-'))return eventPreview(s);
 if(s.layout==='review')return reviewPreview(s);
 return '<div class="mock-item">내용을 채워주세요.</div>';
}
function reviewPreview(s){
 const rv=s.rv,all=rv.order.filter(id=>rv.selected.includes(id)).map(id=>REVIEWS.find(r=>r.id===id)).filter(Boolean);
 const filtered=rv.productId==='all'?all:all.filter(r=>r.productId===rv.productId);
 const products=Array.from(new Set(filtered.map(r=>r.productId))).map(PRODUCT_FOR_REVIEW).filter(Boolean);
 const featured=rv.productId!=='all'?PRODUCT_FOR_REVIEW(rv.productId):products[0];
 const layout=rv.layout||'cards';
 const feature=rv.show.img&&featured?`<div class="mock-review-feature"><b>상품 이미지</b><small>${E(featured.name)}</small></div>`:'';
 const card=r=>{const p=PRODUCT_FOR_REVIEW(r.productId);return `<div class="mock-review-card" data-native-review-id="${E(r.id)}">${rv.show.img&&layout==='cards'?'<div class="mock-review-inline-photo">상품 사진</div>':''}${rv.show.name?`<div class="mock-review-product">${E(p?.name||r.productId||'상품 미확정')}</div>`:''}<strong>${E(rv.titles[r.id]||r.title)}</strong>${Number(r.rating)>0?`<div class="stars">${'★'.repeat(Math.max(1,Math.min(5,Math.round(Number(r.rating)))))}</div>`:''}<p>${E(r.text)}</p>${rv.show.price&&p?`<small>가격 ${MONEY(priced(p).sale)}</small>`:''}</div>`};
 let ordered=filtered;
 if(rv.shape==='per')ordered=filtered.slice().sort((a,b)=>a.productId.localeCompare(b.productId));
 return `<div class="mock-review-shell ${E(layout)} am-cols-${[1,2,3].includes(Number(rv.columns))?Number(rv.columns):2} ${!rv.show.img?"no-image":""}">${['feature-left','feature-top'].includes(layout)?feature:''}<div class="mock-review-grid">${ordered.length?ordered.map(card).join(''):'<div class="mock-item">선택한 상품의 후기가 없습니다.</div>'}</div></div>`;
}
function preview(s){
 const active=s.id===current?' active':'';
 const title=(s.layout==='text-cta'?'':`<h3>${E(s.name)}</h3>`)+(s.layout==='text-cta'||s.layout==='split'?'':s.role?`<p>${E(s.role)}</p>`:'')+s.lines.map(x=>x.text?`<p class="preview-extra-line">${E(x.text)}</p>`:'').join('');
 return `<section class="preview-block${active} am-align-${E(s.align||'left')} am-gap-${E(s.gap||'normal')}" role="button" tabindex="0" aria-label="${E(s.name)} 구좌 편집" aria-pressed="${s.id===current}" data-page="${E(s.id)}" data-image-ratio="${E(imageRatio(s))}" data-am-style="--am-section-image-aspect:${E(imageRatioCss(s))}">${title}${demoInner(s)}${s.layout==='ev-quiz'||s.layout==='custom'?'':AMBlocks.renderSlot(s,'section:after',blockContext(),{staticView:!!window.AM_CB_STATIC_EXPORT,showEmpty:cbRailMode==='library'&&s.id===current&&!window.AM_CB_STATIC_EXPORT})}${ctaMarkup(s)}</section>`;
}

function renderPage(){
 const page=$('page');
 // Preserve manually expanded/collapsed accordion items during live typing;
 // this is UI-only state, independent of saved 'openByDefault' configuration.
 const expanded=[...page.querySelectorAll('[data-page] .am-ed-accordion[data-native-accordion-index]')].map(el=>({
  sid:el.closest('[data-page]')?.dataset.page,index:el.dataset.nativeAccordionIndex,open:el.open
 }));
 page.innerHTML=sections.map(preview).join('');
 expanded.forEach(({sid,index,open})=>{
  const el=page.querySelector('[data-page="'+CSS.escape(sid)+'"] .am-ed-accordion[data-native-accordion-index="'+CSS.escape(index)+'"]');
  if(el)el.open=open;
 });
 if(cbSelected)page.querySelector('[data-cb-node="'+CSS.escape(cbSelected)+'"]')?.classList.add('cb-selected');
 renderCanvasSelection();
}
function lineItems(s){return s.lines.map((l,i)=>Rep('lines',i,l.text||'추가 문구',`고객 노출 · ${i+1}번째 줄`,F('lines.'+i+'.text','추가 문구',l.text,{max:120,area:true,rows:2,help:'줄을 바꿔도 한 항목 안에 있어요. ↑↓로 순서를 바꿔요.'}),s.lines.length)).join('')+B('+ 추가 문구','data-action="add:lines"','am-ed-button--subtle am-ed-button--sm')}
function ctaChoices(s){return `<div class="am-ed-cta-shapes" role="group" aria-label="CTA 모양 선택">${CTA_STYLES.map(([v,n])=>`<button type="button" class="am-ed-cta-option" data-cta-style="${v}" aria-pressed="${s.ctaStyle===v}"><span class="shape-demo ${v}">${v==='text'?'자세히 보기 →':v==='wide'?'프로모션 확인':'자세히 보기'}</span><small>${n}${(CTA_DEFAULTS[s.layout]||'outline')===v?' · 권장':''}</small></button>`).join('')}</div>`;}
function ctaDestination(s){let target='';if(s.ctaTargetType==='section')target=`<div class="am-ed-field"><label for="ed-destination" class="am-ed-label">이동할 구좌</label><select id="ed-destination" class="am-ed-input" data-target="section"><option value="">이동할 구좌 선택</option>${sections.filter(x=>x.id!==s.id).map(x=>`<option value="${E(x.id)}" ${s.ctaTarget===x.id?'selected':''}>${E(x.name)}</option>`).join('')}</select></div>`;if(s.ctaTargetType==='product')target=`<div class="am-ed-field"><label for="ed-destination" class="am-ed-label">연결할 상품</label><select id="ed-destination" class="am-ed-input" data-target="product"><option value="">상품 선택</option>${PRODUCTS.map(x=>`<option value="${E(x.id)}" ${s.ctaTarget===x.id?'selected':''}>${E(x.name)} (${E(x.id)})</option>`).join('')}</select></div>`;if(s.ctaTargetType==='url')target=F('ctaTarget','목적지 URL',s.ctaTarget,{max:260,optional:true,help:'디자이너에게 넘길 주소예요. 미리보기에서 눌러도 이동하지 않아요.'});return `<div class="am-ed-destination"><div class="am-ed-label">눌렀을 때 갈 곳 · 선택</div>${Choices('ctaTargetType',[['none','미지정'],['section','다른 구좌'],['product','상품'],['url','링크 주소']],s.ctaTargetType)}${target}${F('ctaTo','갈 곳 메모',s.ctaTo,{max:60,optional:true,help:'예) 쿠폰함, 브랜드관 · 위에서 고르기 어려우면 여기에 적어요'})}</div>`;}
function copyPanel(s){const hero=s.layout==='hero';return G('고객에게 보이는 글','화면에 나오는 순서대로예요.',F('name',hero?'메인 카피':'제목',s.name,{max:60,area:true,rows:2,help:'줄을 바꾸면(Enter) 화면에서도 그대로 줄이 바뀌어요.'})+F('role','설명',s.role,{max:200,area:true,rows:2,optional:true,help:'제목 아래 한두 줄로 나와요.'})+`<div class="am-ed-field"><span class="am-ed-label">추가 문구</span>${lineItems(s)}</div>`)+G('버튼','고객이 눌러 다른 화면으로 가는 버튼(CTA)이에요.',T('ctaOn','이 구좌에 버튼 넣기',s.ctaOn,s.ctaOn?'켜면 미리보기에 버튼이 보여요.':'버튼 없이 둬요. 언제든 다시 켤 수 있어요.')+(s.ctaOn?F('cta','버튼 문구',s.cta,{max:30,help:'비워 두면 미리보기에는 기본 문구가 보여요.'})+`<div class="am-ed-field"><span class="am-ed-label">버튼 모양 · 미리보기로 선택</span>${ctaChoices(s)}</div>`+ctaDestination(s):''))+G('기획용 정보','고객 화면에는 나오지 않아요.',(hero?'':F('scope','담는 것',s.scope,{max:40,optional:true,help:'예: 선물 세트, 티백'}))+(LAYOUTS[s.layout][1]==='상품'?F('cat','할인 엑셀의 구좌(Zone) 이름',s.cat,{max:40,optional:true,help:'예) 2만원대 · 행사 엑셀에서 이 구좌 상품을 묶는 이름'}):''));}

function itemPanel(s){if(s.layout==='custom')return customPanel(s);const content=s.items.map((it,i)=>Rep('items',i,it.label||'새 항목',LAYOUTS[s.layout][0]+' 항목',F('items.'+i+'.label','항목 제목',it.label,{max:80})+F('items.'+i+'.text','설명 / 제공 조건',it.text,{max:180,area:true,rows:2})+FLOW.itemFields(s,i),s.items.length)).join('');return columnPicker(s)+G('구좌 구성 요소','항목을 더하거나 순서를 바꿔요. 미리보기에 바로 보여요.',content+B('+ 구성 요소 추가','data-action="add:items"','am-ed-button--subtle'))+G('배치와 간격','글 정렬과 항목 사이 간격이에요.',`<div class="am-ed-field"><span class="am-ed-label">정렬</span>${Choices('align',[['left','왼쪽'],['center','가운데'],['right','오른쪽']],s.align||'left')}</div><div class="am-ed-field"><span class="am-ed-label">항목 간격</span>${Choices('gap',[['compact','좁게'],['normal','기본'],['relaxed','넉넉하게']],s.gap||'normal')}</div>`)+FLOW.infoPanel(s)}
// Per-product visibility overrides keep native cards independent while the
// original shared 16-element schema remains the section's default.
function nativeSelectedProductId(s){
 const t=canvasTarget;
 if(t&&t.sectionId===s.id&&['native-product','native-card-attribute'].includes(t.kind)){
   return s.productIds?.[t.index]||null;
 }
 if(iaSelectedChild?.sectionId===s.id&&iaSelectedChild.type==='native-product'){
   return s.productIds?.[iaSelectedChild.index]||null;
 }
 return null;
}
function nativeCardVisibilityPanel(s){
 const pid=nativeSelectedProductId(s),product=PRODUCTS.find(p=>p.id===pid);
 if(!pid||!product)return '';
 const overrides=s.cardElementOverrides?.[pid]||{},on=s.card?.on||{};
 const rows=(s.card?.order||ORDER).filter(key=>key!=='ai').map(key=>{
   const active=overrides[key]!==undefined?!!overrides[key]:!!on[key];
   return `<label class="am-ed-toggle am-native-card-visibility"><input type="checkbox" data-native-visible="${E(pid)}:${E(key)}" ${active?'checked':''}><span><strong>${E(ELEMENTS[key]?.[0]||key)}</strong><small>${Object.prototype.hasOwnProperty.call(overrides,key)?'이 상품만 개별 설정':'구좌 공통 설정 적용'}</small></span></label>`;
 }).join('');
 return '<details class="ia-advanced cb-card-elements-advanced" '+(canvasTarget?.kind==='native-card-attribute'?'open':'')+'><summary><span class="cb-card-elements-summary__main"><strong>'+E(product.name)+' · 카드 속성</strong><small>15개 속성 · 개별 노출 설정</small></span><span class="cb-card-elements-summary__meta">상세 설정 <i class="cb-card-elements-summary__chevron" aria-hidden="true"></i></span></summary>'+G('이 상품만 표시할 속성',product.name+'에만 적용됩니다. 다른 상품 카드에는 영향을 주지 않습니다.',rows)+'</details>';
}
function shapePanel(s){
 const rows=s.card.order.map((k,i)=>{
  const [title,source]=ELEMENTS[k],disabled=k==='ai';
  const head=`<div class="am-ed-element-row ${s.card.on[k]?'':'off'}"><label><input type="checkbox" data-element="${E(k)}" ${s.card.on[k]?'checked':''} ${disabled?'disabled':''}><span class="name">${E(title)}</span></label><span class="am-ed-tag am-ed-tag--source">${E(disabled?'연결 예정':source)}</span>${UI.icon('↑','위로 이동','element:'+i+':-1',i===0||k==='label')}${UI.icon('↓','아래로 이동','element:'+i+':1',i===s.card.order.length-1||k==='label')}</div>`;
  let detail='';
  if(s.card.on[k]&&['label','tag','copy','btn'].includes(k))detail=`<div class="am-ed-element-detail">${F('card.def.'+k,'구좌 공통 '+title,s.card.def[k],{max:k==='copy'?60:30,area:k==='copy',rows:2,help:'상품 카드에 바로 반영됩니다.'})}</div>`;
  if(s.card.on[k]&&k==='label')detail+=`<div class="am-ed-element-detail"><span class="am-ed-label">모서리 라벨 위치</span>${Choices('card.def.labelPosition',LABEL_POSITIONS,s.card.def.labelPosition||'top-left')}<div class="am-ed-note">상품 사진 위에 얹는 배지예요. 사진을 끄면 위치를 고를 수 없어요.</div></div>`;
  if(s.card.on[k]&&k==='pill')detail=`<div class="am-ed-element-detail"><div class="am-ed-field"><span class="am-ed-label">알약 표현 유형</span>${Choices('card.def.pill',[['직접 쓰기','직접 입력'],['오늘만','오늘만'],['남은 기간','남은 기간'],['가격 오름 예고','가격 오름 예고']],s.card.def.pill)}</div>${s.card.def.pill==='직접 쓰기'?F('card.def.pillText','알약에 표시할 문구',s.card.def.pillText,{max:30,help:'고객에게 보이는 짧은 문구'}):`<div class="am-ed-note">${s.card.def.pill==='남은 기간'?'행사 종료일이 정해지면 남은 기간이 채워져요.':s.card.def.pill==='가격 오름 예고'?'행사 뒤 가격이 정해져야 쓸 수 있어요.':'행사 기간이 정해졌는지 확인해 주세요.'}</div>`}</div>`;
  if(s.card.on[k]&&k==='appeal')detail='<div class="am-ed-element-detail am-ed-note">소구문구는 상품마다 달라요. [내용]의 상품별 소구문구에서 적어 주세요.</div>';
  if(disabled)detail='<div class="am-ed-element-detail am-ed-note">AI 후기 요약은 아직 준비 중이에요.</div>';
  return head+detail;
 }).join('');
 return nativeCardVisibilityPanel(s)+productViewPicker(s)+columnPicker(s)+G('카드에 보일 것','카드에 무엇을 어떤 순서로 보일지 정해요. 이 구좌의 모든 상품 카드에 같이 적용돼요.',rows)+G('데이터 표시 기준',CATALOG_NOTE?'상품·가격·후기는 이 기획안의 상품·할인 값이에요.':'예시 화면이라 상품·가격·후기는 가상 데이터예요.',`<div class="am-ed-note">상품명·정가·할인가·할인율·별점·후기는 자동으로 채워져요. 가격을 바꾸려면 상품·할인 단계에서 고쳐 주세요.</div>`);
}
// 상품 고르기 (2026-11-16 스크롤 줄이기): 고른 상품을 맨 위, 8개가 넘으면 찾기 칸. 찾는 말은 다시 그려도 유지(PROD_Q)
let PROD_Q='',PROD_ALL=false,PROD_SEC=null,CARD_FOLD_OPEN=false;
const prodMatch=p=>{const q=PROD_Q.trim().toLowerCase();return !q||String(p.name).toLowerCase().includes(q)||String(p.id).includes(q);};
function productPanel(s){
 if(PROD_SEC!==s.id){PROD_SEC=s.id;PROD_ALL=false;PROD_Q='';}   // 다른 구좌로 옮기면 찾기·모두 보기는 처음부터
 const ordered=[...PRODUCTS].sort((a,b)=>(s.productIds.includes(b.id)?1:0)-(s.productIds.includes(a.id)?1:0));
 const finder=PRODUCTS.length>8?`<input type="search" class="am-ed-input en-prod-q" data-prod-q value="${E(PROD_Q)}" placeholder="상품 이름·SEQ로 찾기 (${PRODUCTS.length}개)" aria-label="상품 찾기" autocomplete="off">`:'';
 // 찾는 말이 없으면 고른 상품 + 앞 10개만 (나머지는 [상품 모두 보기]) → 73개를 늘 펼쳐 5,000px 넘게 내려가던 것을 줄임
 let extra=0;const show=p=>{if(s.productIds.includes(p.id))return true;if(PROD_Q.trim())return prodMatch(p);if(PROD_ALL)return true;return extra++<10;};
 const vis=new Map(ordered.map(p=>[p.id,show(p)])),rest=ordered.filter(p=>!vis.get(p.id)).length;
 const more=!PROD_Q.trim()&&rest?`<button type="button" class="am-ed-button am-ed-button--subtle en-prod-more" data-prod-all>상품 모두 보기 (${rest}개 더)</button>`:'';
 const content=finder+ordered.map(p=>`<label class="am-ed-product-row"${vis.get(p.id)?'':' hidden'} data-prod-name="${E(String(p.name).toLowerCase())} ${E(p.id)}"><div class="thumb">IMG</div><div class="txt"><b>${E(p.name)}</b><small>${E(p.id)} · ${E(p.priceNote||'최종가')} ${MONEY(priced(p).sale)}</small></div><input type="checkbox" data-product="${E(p.id)}" ${s.productIds.includes(p.id)?'checked':''}></label>`).join('')+more;
 const appeals=s.productIds.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean).map(p=>F('appeals.'+p.id,p.name+' · 상품별 소구문구',s.appeals[p.id]||'',{max:80,area:true,rows:2,help:'한 상품에 하나의 소구문구. 카드 요소를 켜면 미리보기에 반영됩니다.'})).join('');
 const where=ftOn(s)?` '${ftCur(s).label||'탭'}' 탭에 담겨요.`:' 이 구좌에 보여요.';
 return ftabPanel(s)+nativeCardVisibilityPanel(s)+G('상품 선택',(CATALOG_NOTE?'이 기획안에 담은 상품이에요. 체크하면':'예시 상품이에요. 체크하면')+where,content)+G('상품별 소구문구','상품마다 카드에 넣을 한 줄 문구예요. [배치·표시]에서 소구문구를 켜야 보여요.',appeals||'<div class="am-ed-note">상품을 먼저 넣어 주세요.</div>');
}
// 탭(필터) 구좌 묶음 (plans/28): 탭 이름·Zone은 data-bind(ftabs.i.label/zone)라 입력·실행 취소가 다른 칸과 같다
function ftabPanel(s){
 if(!FTAB_LAYOUTS.includes(s.layout))return '';
 const help='가격대·취향처럼 상품을 탭으로 나눠 보여 줘요. 탭 하나가 PROMO_WORK 칸(Zone) 하나예요.';
 if(!ftOn(s))return G('탭',help,B('탭으로 나누기','data-ftab-op="split"','am-ed-button--sm'));
 const cur=ftCur(s),n=s.ftabs.length;
 const ic=(sym,label,attr,off)=>`<button type="button" class="am-ed-icon-btn" ${attr} title="${E(label)}" aria-label="${E(label)}" ${off?'disabled':''}>${window.AMEditorKit?.icon(sym,'am-kit-icon--sm')||E(sym)}</button>`;
 const rows=s.ftabs.map((t,i)=>{const on=t===cur,name=t.label||'이름 없는 탭',id=`data-ftab-id="${E(t.id)}"`;
  return `<div class="am-ed-repeat am-ftab-row${on?' is-current':''}"><div class="am-ed-repeat__header"><span class="am-ed-tag">${i+1}</span><div class="am-ed-repeat__main"><strong>${E(name)}</strong><small>상품 ${(on?s.productIds:t.productIds).length}개${on?' · 지금 보는 탭':''}</small></div>
   ${on?'':B('보기',`data-ftab-op="view" ${id} aria-label="${E(name)} 탭 상품 보기"`,'am-ed-button--subtle am-ed-button--sm')}
   ${ic('arrow-up',name+' 탭 위로',`data-ftab-op="up" ${id}`,i===0)}${ic('arrow-down',name+' 탭 아래로',`data-ftab-op="down" ${id}`,i===n-1)}${ic('trash',n<=FTAB_MIN?'탭은 2개 이상이어야 해요':name+' 탭 지우기',`data-ftab-op="del" ${id}`,n<=FTAB_MIN)}</div>
   <div class="am-ed-repeat__body">${F(`ftabs.${i}.label`,'탭 이름',t.label,{max:40})}${F(`ftabs.${i}.zone`,'Zone (PROMO_WORK 카테고리명)',t.zone,{max:40,optional:true,help:'할인 행의 카테고리명과 같게 적어요'})}</div></div>`;}).join('');
 return G('탭',`${help} 고객은 첫 탭을 먼저 봐요.`,rows+`<div class="am-ftab-tools">${B('+ 탭 추가',`data-ftab-op="add" ${n>=FTAB_MAX?'disabled':''}`,'am-ed-button--sm')}${B('탭 없애기','data-ftab-op="drop"','am-ed-button--subtle am-ed-button--sm')}</div>`);
}
function eventPanel(s){
 const e=s.ev,ui=eventUI(s);
 let custom='';
 if(s.layout==='ev-quiz'){
  custom=FLOW.quizPanel(s);
 } else if(s.layout==='ev-share'){
  custom=F('ev.ui.sharePrompt','공유 유도 문구',ui.sharePrompt,{max:110,area:true,rows:2})+F('ev.ui.shareChannels','공유 채널 표시',ui.shareChannels,{max:140,help:'쉼표로 구분해 여러 채널을 표시합니다. 실제 공유 기능은 연결되지 않았습니다.'});
 } else if(s.layout==='ev-ugc'){
  custom=F('ev.ui.entryPrompt','참여 안내 문구',ui.entryPrompt,{max:110,area:true,rows:2})+`<div class="am-ed-field"><span class="am-ed-label">인증 입력 영역</span>${Choices('ev.ui.entryMode',[['both','사진+댓글'],['photo','사진만'],['comment','댓글만']],ui.entryMode)}</div>`;
 } else if(s.layout==='ev-stamp'){
  custom=F('ev.ui.stampCaption','출석 안내 문구',ui.stampCaption,{max:110,area:true,rows:2})+`<div class="am-ed-field"><span class="am-ed-label">스탬프 표시 칸 수</span>${Choices('ev.ui.totalDays',[['3','3칸'],['5','5칸'],['7','7칸']],ui.totalDays)}</div>`+F('ev.ui.currentDays','완료 칸 수 · 시안 예시',ui.currentDays,{max:2,help:'고객의 실제 출석 이력이 아닌 와이어프레임용 진행 상태입니다.'});
 } else if(s.layout==='ev-draw'){
  custom=F('ev.ui.drawCaption','룰렛 소개 문구',ui.drawCaption,{max:110,area:true,rows:2})+F('ev.ui.wheelLabels','룰렛 칸 표시 문구',ui.wheelLabels,{max:160,area:true,rows:4,help:'한 줄에 한 칸, 최대 4칸의 표시 문구만 사용합니다. 실제 확률·당첨 로직과 무관합니다.'});
 } else if(s.layout==='ev-coupon'){
  custom=F('ev.ui.couponValue','쿠폰 핵심 혜택',ui.couponValue,{max:70,help:'금액·할인율 등 확정된 문구만 기재하세요.'})+F('ev.ui.couponCondition','쿠폰 사용·발급 조건',ui.couponCondition,{max:130,area:true,rows:2});
 }
 if(s.layout!=='ev-quiz')custom += FLOW.otherPanel(s);
 return G('이벤트 화면 내용','적으면 미리보기에 바로 보여요.'+LAYOUTS[s.layout][0]+' 전용 항목입니다.',custom||'<div class="am-ed-note">더 적을 것이 없어요.</div>')
  +G('운영 조건','참여 방법·경품·기간처럼 이벤트마다 정해야 하는 것들이에요.',F('ev.how','참여 방법',e.how,{max:400,area:true,rows:2})+`<div class="am-ed-field"><div class="am-ed-label">보상 유형</div>${Choices('ev.reward',[['포인트','포인트'],['쿠폰','쿠폰'],['경품','경품'],['없음','없음']],e.reward)}</div>`+F('ev.rewardText','보상 내용',e.rewardText,{max:160,optional:true})+`<div class="am-ed-field"><div class="am-ed-label">당첨 방식</div>${Choices('ev.pick',[['선착순','선착순'],['추첨','추첨'],['참여자 전원','전원']],e.pick)}</div>`+F('ev.count','인원',e.count,{max:40,optional:true})+F('ev.when','기간·시간',e.when,{max:120})+T('ev.login','로그인 필요',e.login,'운영 조건 확인 후 확정')+F('ev.notice','유의사항',e.notice,{max:1000,area:true,rows:4,optional:true,help:'법무·운영 담당 검토 필요'}))
  +G('개발이 따로 필요한 것','여기 그린 이벤트 화면은 디자인 시안이에요.',`<div class="am-ed-note am-ed-note--warning">퀴즈 결과 계산·공유·사진 올리기·출석·추첨·쿠폰 발급은 실제 페이지에서 따로 개발해야 해요. 여기서는 화면만 미리 봐요.</div>`);
}
function reviewPanel(s){
 const rv=s.rv,filtered=rv.productId==='all'?REVIEWS:REVIEWS.filter(r=>r.productId===rv.productId),selected=rv.order.filter(id=>rv.selected.includes(id));
 const productSelect=`<div class="am-ed-field"><label class="am-ed-label" for="rv-product">후기를 가져올 상품</label><select class="am-ed-input" id="rv-product" data-review-product><option value="all" ${rv.productId==='all'?'selected':''}>모든 상품</option>${PRODUCTS.map(p=>`<option value="${E(p.id)}" ${rv.productId===p.id?'selected':''}>${E(p.name)} (${E(p.id)})</option>`).join('')}</select><div class="am-ed-field-meta"><span class="am-ed-support">상품 SEQ로 연결해요.${CATALOG_NOTE?'':' 예시 상품 목록이에요.'}</span></div></div>`;
 const layoutChoices=`<div class="am-ed-review-layouts">${REVIEW_LAYOUTS.map(([id,label])=>`<button type="button" class="am-ed-review-layout-option" data-review-layout="${id}" aria-pressed="${rv.layout===id}"><span class="review-layout-visual ${id==='cards'?'as-cards':id==='text'?'as-text':id==='feature-top'?'as-top':''}">${id==='text'?'<em></em><em></em><em></em>':id==='feature-top'?'<i></i><em></em>':'<i></i><em></em>'}</span><b>${label}</b></button>`).join('')}</div>`;
 const reviews=filtered.map(r=>{const pos=selected.indexOf(r.id);const selectedIndex=pos>=0;return `<div class="am-ed-review-row"><label class="am-ed-inline"><input type="checkbox" data-reviewpick="${E(r.id)}" ${selectedIndex?'checked':''}><span><strong>${E(r.title)}</strong><small>${E(PRODUCT_FOR_REVIEW(r.productId)?.name||r.productId)} · ${E(r.productId)} · ${E(r.sourceLabel||(r.source==='demo'?'가상 후기':'로컬 CSV'))}</small></span></label><p>${E(r.text)}</p>${selectedIndex?`<div class="am-ed-review-actions"><button type="button" data-review-step="${E(r.id)}:-1" ${pos===0?'disabled':''} aria-label="후기 위로">↑</button><button type="button" data-review-step="${E(r.id)}:1" ${pos===selected.length-1?'disabled':''} aria-label="후기 아래로">↓</button></div>${F('rv.titles.'+r.id,'별도 한 줄 제목',rv.titles[r.id]||'',{max:40,optional:true,help:'본문 원문은 수정하지 않습니다.'})}`:''}</div>`}).join('');
 return G('후기 불러오기','상품을 고르고, 그 상품 후기 중 보여 줄 것을 골라요.',productSelect+`<div class="am-ed-review-source"><strong>현재 소스: ${CATALOG_NOTE?E(CATALOG_NOTE):`가상 후기 ${REVIEWS.filter(r=>r.source==='demo').length}건 · 로컬 후기 ${REVIEWS.filter(r=>r.source==='csv').length}건`}</strong><span>${CATALOG_NOTE?'후기 전문이 아니라 상품별로 골라 둔 일부예요.':'예시 화면이에요. 불러온 CSV는 이 화면에서만 쓰고 저장하지 않아요.'}</span><label class="am-ed-label" for="reviewsCsv">후기 CSV 불러오기 (선택)</label><input class="am-ed-file-input" type="file" id="reviewsCsv" accept=".csv,text/csv"><small>CSV 첫 줄: seq, title, text, rating (UTF-8)</small></div>`)+G('후기 배치와 표시','후기를 어떤 모양으로 보여 줄지 정해요.',`<div class="am-ed-field"><span class="am-ed-label">후기 묶음</span>${Choices('rv.shape',[['per','상품별로 묶기'],['mix','선택 순서대로']],rv.shape)}</div><div class="am-ed-field"><span class="am-ed-label">배치 모양</span>${layoutChoices}</div>${['img','name','price'].map(k=>T('rv.show.'+k,{img:'상품 이미지',name:'상품명',price:'가격'}[k],rv.show[k])).join('')}${rv.layout==='text'?'<div class="am-ed-note">글만 보이는 배치라 상품 사진은 나오지 않아요. 다른 배치로 바꾸면 다시 나와요.</div>':''}`)+columnPicker(s)+G('후기 고르기·순서 변경',`이 상품 후기 ${filtered.length}건 · 고른 후기만 화면에 나와요.`,(reviews||'<div class="am-ed-note">고른 상품의 후기가 아직 없어요.</div>')+`<div class="am-ed-note">후기는 고객이 쓴 그대로 나와요. 페이지에 쓰기 전에 사용 승인을 확인해 주세요.</div>`);
}

// ── 레퍼런스 붙이기 (2026-11-16): 앱(host)이 setRefSource로 '이 구좌와 비슷한 사례·라이브러리' 목록을 준다.
// [참고·인계 › 레퍼런스]에는 붙인 것 + [레퍼런스 찾아 붙이기] → 자료 연결 › 레퍼런스에서 고르거나 링크로 붙인다.
// 저장: s.refs [{id,name,from,url,attached:true,note}] (앱이 page.sections[].v2.att로도 써서 04 미리보기·인계에 나온다)
let REF_SOURCE=null,REF_ON_PICK=null,REF_SHOWN=[];const REF_CACHE={};
function toggleRef(s,r,addOnly){
 s.refs=Array.isArray(s.refs)?s.refs:[];const i=s.refs.findIndex(x=>x.id===r.id||(addOnly&&r.url&&x.url===r.url));
 if(i>=0&&addOnly){toast('이미 붙인 레퍼런스예요');return;}
 if(i<0&&s.refs.length>=8){toast('레퍼런스는 구좌마다 8개까지 붙일 수 있어요');return;}
 const before=capture();
 if(i>=0){s.refs.splice(i,1);toast('참고에서 뺐어요');}
 else{s.refs.push({id:String(r.id).slice(0,80),name:String(r.name||'레퍼런스').slice(0,60),from:String(r.from||'').slice(0,80),url:/^https?:\/\//i.test(r.url||'')?String(r.url).slice(0,300):'',attached:true,note:''});toast('붙였어요. [참고·인계]에서 무엇을 참고할지 적을 수 있어요');}
 try{REF_ON_PICK&&REF_ON_PICK(r,i<0,s);}catch(_){}
 mark(before);renderAll();
}
function refsFinder(s){
 const key=s.id+'|'+s.layout;let c=REF_CACHE[key];
 if(c===undefined){REF_CACHE[key]=null;c=null;Promise.resolve().then(()=>REF_SOURCE(JSON.parse(JSON.stringify(s)))).then(list=>{REF_CACHE[key]=Array.isArray(list)?list:[];},()=>{REF_CACHE[key]='err';}).then(()=>{if(cbRailMode!=='data'||iaDataMode!=='refs'||section().id!==s.id)return;
  // 목록이 늦게 와서 다시 그릴 때 링크 칸에 적던 글과 커서가 지워지지 않게
  const keep=['refLinkUrl','refLinkName'].map(id=>[id,document.getElementById(id)?.value||'']),focus=document.activeElement?.id;
  renderIaDataLibrary();
  for(const [id,v] of keep){const el=document.getElementById(id);if(el)el.value=v;}
  if(focus)document.getElementById(focus)?.focus();});}
 const on=new Set((s.refs||[]).map(r=>r.id));REF_SHOWN=Array.isArray(c)?c:[];
 const groups=[];for(const [i,r] of REF_SHOWN.entries()){const g=r.group||'레퍼런스';let x=groups.find(y=>y[0]===g);if(!x)groups.push(x=[g,[]]);x[1].push([i,r]);}
 const list=c===null?'<p class="ia-data-wait" role="status">이 구좌와 비슷한 레퍼런스를 찾는 중이에요…</p>'
  :c==='err'?'<p class="ia-data-wait" role="status">레퍼런스 목록을 불러오지 못했어요. 아래에서 링크로 붙일 수 있어요.</p>'
  :groups.length?groups.map(([g,rs])=>`<h3 class="ia-data-group">${E(g)} <small>${rs.length}</small></h3><div class="ia-data-results">${rs.map(([i,r])=>`<div class="ia-ref-row"><button type="button" class="ia-data-item" data-ref-pick="${i}" aria-pressed="${on.has(r.id)}"><b>${E(r.name)}</b><small>${E([r.from,r.why].filter(Boolean).join(' · ').slice(0,90))}</small><span class="ia-data-act">${on.has(r.id)?'붙임 · 빼기':'붙이기'}</span></button>${/^\/v2\/library#/.test(r.lib||'')?`<a class="ia-ref-open" href="${E(r.lib)}" target="_blank" rel="noopener">라이브러리에서 보기 ↗</a>`:''}</div>`).join('')}</div>`).join('')
  :'<p class="ia-data-wait">고를 레퍼런스가 아직 없어요. 레퍼런스 라이브러리에 모으거나 아래에서 링크로 붙여요.</p>';
 return list+`<form class="ia-ref-link" data-ref-link novalidate><h3 class="ia-data-group">링크로 붙이기</h3><label class="am-ed-label" for="refLinkUrl">주소</label><input class="am-ed-input" id="refLinkUrl" name="url" type="url" inputmode="url" placeholder="https://" maxlength="300" autocomplete="off"><label class="am-ed-label" for="refLinkName">이름 · 선택</label><input class="am-ed-input" id="refLinkName" name="name" type="text" maxlength="60" placeholder="예) ○○ 봄 기획전 탭 모양" autocomplete="off"><button type="submit" class="am-ed-button am-ed-button--subtle">링크 붙이기</button><small>주소만 저장하고 열어 보지는 않아요.</small></form><a class="ia-ref-lib" href="/v2/library" target="_blank" rel="noopener">레퍼런스 라이브러리 새 탭으로 열기 ↗</a>`;
}
function refsPanel(s){
 if(REF_SOURCE){
  const att=s.refs||[];
  return G('붙인 레퍼런스',att.length?'무엇을 참고할지 적으면 디자인 요청과 04 미리보기에 같이 들어가요.':'비슷한 구좌 사례·레퍼런스 라이브러리·링크에서 골라 붙여요.',
   att.map((r,i)=>`<div class="am-ed-ref en-ref"><div class="am-ed-stack"><div class="en-ref-head"><div><strong>${E(r.name)}</strong><small>${E(r.from||'')}</small></div><button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-ref-remove="${i}" aria-label="${E(r.name)} 빼기">빼기</button></div><div class="en-ref-links">${r.url?`<a class="en-ref-url" href="${E(r.url)}" target="_blank" rel="noopener noreferrer">원본 열기 ↗</a>`:''}${String(r.id).startsWith('link-')?'':`<a class="en-ref-url" href="/v2/library#open=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">라이브러리에서 보기 ↗</a>`}</div>${F('refs.'+i+'.note','참고할 것',r.note,{max:120,optional:true,help:'예) 탭 모양과 가격 위치'})}</div></div>`).join('')
   +`<button type="button" class="am-ed-button am-ed-button--primary en-ref-find" data-ref-find>＋ 레퍼런스 찾아 붙이기</button>`)
   +G('느낌 레퍼런스','이 구좌에서 무엇을 참고할지 골라요 (여러 개).',`<div class="am-ed-choice">${['색감','구도','소품','글씨체','카피 톤'].map(p=>`<button type="button" data-mood="${E(p)}" aria-pressed="${s.moods.includes(p)}">${E(p)}</button>`).join('')}</div>`);
 }
 return G('구좌 레퍼런스','참고할 레퍼런스를 붙이고 메모를 남겨요.',s.refs.map((r,i)=>`<div class="am-ed-ref"><div class="thumb">REF</div><div class="am-ed-stack"><div><strong>${E(r.name)}</strong><small>${E(r.from)}</small></div>${T('refs.'+i+'.attached','참고로 붙이기',r.attached)}${r.attached?F('refs.'+i+'.note','참고할 것',r.note,{max:120,optional:true,help:'구도, 레이아웃, 이미지 톤 등'}):''}</div></div>`).join(''))+G('느낌 레퍼런스','무엇을 참고할지 골라요 (여러 개).',`<div class="am-ed-choice">${['색감','구도','소품','글씨체','카피 톤'].map(p=>`<button type="button" data-mood="${E(p)}" aria-pressed="${s.moods.includes(p)}">${E(p)}</button>`).join('')}</div>`)}
function notesPanel(s){return G('디자이너에게 부탁할 것','적은 내용은 인계용 HTML과 04 미리보기의 디자인 요청에 들어가요.',F('notes','디자인 요청',s.notes,{max:2000,area:true,rows:6,optional:true,help:'예) 첫 카드는 돗자리 위 연출 컷이면 좋겠어요'}))+G('참고 레퍼런스','붙인 레퍼런스별 요청을 기획안에 함께 표시합니다.',s.refs.filter(r=>r.attached).length?s.refs.filter(r=>r.attached).map(r=>`<div class="am-ed-callout"><strong>${E(r.name)}</strong><span class="am-ed-dim">${E(r.note||'참고할 사항 미입력')}</span></div>`).join(''):`<div class="am-ed-note">아직 붙인 레퍼런스가 없어요. 레퍼런스 탭에서 선택할 수 있어요.</div>`)}
const panelRender={copy:copyPanel,items:itemPanel,shape:shapePanel,products:productPanel,event:eventPanel,review:reviewPanel,refs:refsPanel,notes:notesPanel,check:(s)=>(s.layout==='custom'?customQualityPanel(s):FLOW.qualityPanel(s))+(AMBlocks.issues(s,blockContext()).length?'<div class="am-ed-group"><h3>추가 블록 누락 검수</h3>'+AMBlocks.issues(s,blockContext()).map(v=>'<p class="am-ed-note">'+E(v)+'</p>').join('')+'</div>':'')};
const tabsBase=tabs;
tabs=function(s){
 let base=tabsBase(s);
 if(s.layout==='countdown')base=base.filter(([key])=>key!=='items');
 if(['countdown','deal-banner'].includes(s.layout))base.splice(1,0,['status','종료 상태']);
 if(IMAGE_LAYOUTS.has(s.layout)&&!base.some(([k])=>['shape','items','review'].includes(k)))base.splice(1,0,['media','이미지 비율']);
 return [...base,['check','검수']];
};
panelRender.media=(s)=>'<div class="am-ed-note">고른 비율이 미리보기에 바로 보여요.</div>'+(s.layout==='hero'?FLOW.infoPanel(s):'');
panelRender.status=(s)=>FLOW.infoPanel(s);
function iaPathMarkup(s, block){
 const index=sections.indexOf(s)+1;
 let parts=`<button type="button" data-ia-parent="page">페이지</button><span>›</span><button type="button" data-ia-parent="section">${index.toString().padStart(2,'0')} ${E(s.name)}</button>`;
 let scope='현재 구좌 전체의 기본 설정을 편집합니다.';
 if(block){parts+=`<span>›</span><b>${E(IA_BLOCK_NAMES[block.type]||block.type)}</b>`;scope='선택한 요소 1개에만 적용됩니다. 구좌 전체 설정과 구분하세요.';}
 else if(iaSelectedChild&&iaSelectedChild.sectionId===s.id){parts+=`<span>›</span><b>${E(iaSelectedChild.label)}</b>`;scope='이 항목이 포함된 구좌의 편집 항목을 표시합니다.';}
 $('ia-breadcrumb').innerHTML=parts;$('ia-edit-scope').textContent=scope;
 $('changeLayout').hidden=!!block;
}
function iaGroupedTabs(s,ts){
 const groupFor=key=>IA_TAB_GROUP[key]||'content';
 const available=[...new Set(ts.map(([key])=>groupFor(key)))];
 if(!available.includes(iaGroup))iaGroup=groupFor(tab);
 if(!available.includes(iaGroup))iaGroup=available[0];
 const groupTabs=available.map(key=>`<button type="button" class="ia-group-btn" role="tab" data-ia-group="${key}" aria-selected="${iaGroup===key}" aria-pressed="${iaGroup===key}" tabindex="${iaGroup===key?'0':'-1'}">${IA_GROUPS[key]}</button>`).join('');
 const children=ts.filter(([key])=>iaGroup===groupFor(key));
 const sub=children.length===1
  ? `<div class="ia-subtabs am-kit-subheading"><span class="am-kit-single-heading">${AMEditorKit.icon('file-text','am-kit-icon--sm')}${E(children[0][1])} 편집</span></div>`
  : `<div class="ia-subtabs am-kit-subnav" role="tablist" aria-label="세부 편집 항목"><span class="am-kit-subnav-label">세부 항목</span>${children.map(([key,label])=>`<button type="button" role="tab" data-tab="${E(key)}" class="ia-subtab" aria-selected="${key===tab}" tabindex="${key===tab?'0':'-1'}">${E(label)}</button>`).join('')}</div>`;
 return `<div class="ia-groups am-kit-primary-nav" role="tablist" aria-label="편집 영역">${groupTabs}</div>${sub}`;
}
function renderPanel(){
 const s=section();ensureEventUI(s);
 const found=cbSelected?AMBlocks.find(s,cbSelected):null;
 if(cbSelected&&!found)cbSelected=null;
 const node=found?.item||null;
 $('insTitle').textContent=node?(IA_BLOCK_NAMES[node.type]||'요소 편집'):s.name;
 $('layoutLabel').textContent=LAYOUTS[s.layout][0]+(!node&&s.layout==='review'?' · '+(REVIEW_LAYOUTS.find(v=>v[0]===s.rv.layout)?.[1]||'개별 후기 카드'):'');
 $('position').textContent=`· ${sections.indexOf(s)+1}/${sections.length}`;
 iaPathMarkup(s,node);
 if(node){
  $('tabbar').innerHTML='<div class="ia-block-context"><strong>선택한 요소의 설정</strong><button type="button" data-cb-back="1">← 구좌 전체 편집</button></div>';
  $('panel-body').innerHTML=AMBlocks.inspector(s,cbSelected,blockContext())+AMBlocks.issues(s,blockContext()).map(t=>`<div class="am-ed-note">${E(t)}</div>`).join('');
  const detailed=[...$('panel-body').querySelectorAll('.am-ed-group')].find(el=>el.querySelector('h3')?.textContent.includes('상품 카드 표시 요소'));
  if(detailed){
    const wrapper=document.createElement('details');wrapper.className='ia-advanced cb-card-elements-advanced';
    const sum=document.createElement('summary');
    sum.innerHTML='<span class="cb-card-elements-summary__main"><strong>상품 카드 표시 요소</strong><small>16개 요소 · 선택한 요소의 속성만 펼쳐 편집</small></span><span class="cb-card-elements-summary__meta">편집 설정 <i class="cb-card-elements-summary__chevron" aria-hidden="true"></i></span>';
    detailed.querySelector('.am-ed-group__title')?.remove();
    detailed.replaceWith(wrapper);wrapper.append(sum,detailed);wrapper.open=cbCardDetailsOpen;
   }
  return;
 }
 const ts=tabs(s);if(!ts.some(([k])=>k===tab))tab='copy';
 iaGroup=IA_TAB_GROUP[tab]||'content';
 $('tabbar').innerHTML=iaGroupedTabs(s,ts);
 $('panel-body').innerHTML=(iaGroup==='layout'?imageRatioPicker(s):'')+panelRender[tab](s);
 // 꼭 채워야 하는 자료(상품 구좌의 상품, 후기 구좌의 후기)가 비었으면 [내용] 맨 위에 알리고 바로 고르러 가게 한다
 // '카드에 보일 것'(16개 요소, 약 1,300px)은 접어 두고 켠 개수만 한 줄로 (2026-11-16 스크롤 줄이기). 펼친 상태는 다시 그려도 유지
 const cardG=[...$('panel-body').querySelectorAll(':scope > .am-ed-group')].find(g=>g.querySelector('h3')?.textContent.startsWith('카드에 보일 것'));
 if(cardG&&s.card){
  const on=ORDER.filter(k=>s.card.on[k]).length,d=document.createElement('details');d.className='en-fold';d.open=CARD_FOLD_OPEN;
  d.innerHTML=`<summary><strong>카드에 보일 것</strong><small>${on}개 켬 · ${ORDER.length}개 중</small></summary>`;
  cardG.querySelector('.am-ed-group__title')?.remove();cardG.replaceWith(d);d.append(cardG);
  d.addEventListener('toggle',()=>{CARD_FOLD_OPEN=d.open;});
 }
 const need=fillState(s),needTab=s.layout==='review'?'review':'products';
 if(need&&need.need&&iaGroup==='content'&&tab!==needTab)$('panel-body').insertAdjacentHTML('afterbegin',`<div class="en-need" role="status"><div><strong>${E(need.text)}</strong><small>${s.layout==='review'?'보여 줄 후기를 아직 고르지 않았어요.':'이 구좌에 넣을 상품을 골라 주세요. 빈 자리는 미리보기에 점선으로 보여요.'}</small></div><button type="button" class="am-ed-button am-ed-button--primary" data-need-tab="${needTab}">${s.layout==='review'?'후기 고르기':'상품 고르기'}</button></div>`);
  if(canvasTarget&&canvasTarget.sectionId===s.id&&!['block','block-attribute'].includes(canvasTarget.kind)){
   const label=canvasTargetLabel(canvasTarget);
   $('panel-body').insertAdjacentHTML('afterbegin','<div class="am-canvas-native-actions"><span><strong>선택: '+E(label)+'</strong><small>가운데 미리보기에서 선택됨 · 해당 요소만 변경</small></span><button type="button" data-canvas-panel-delete="1" aria-label="선택한 '+E(label)+' 삭제">'+AMEditorKit.icon('trash','am-kit-icon--sm')+' 삭제</button></div>');
  }
}

function renderAll(){renderList();renderPage();renderPanel();renderCbRail();const count=iaIssueList().length;$('iaIssueCount').textContent=count?'· '+count:'· 0'}
function setPath(s,key,val){const parts=key.split('.');let o=s;for(let i=0;i<parts.length-1;i++){if(o[parts[i]]===undefined)return;o=o[parts[i]];}o[parts.at(-1)]=val;}
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,2500)}
function setCurrent(id){if(!sections.some(s=>s.id===id))return;current=id;cbSelected=null;canvasTarget=null;iaSelectedChild=null;tab='copy';iaGroup='content';iaTreeOpen.add(id);renderAll();}
function updateAll(){renderAll();saveDemo()}

function blockContext(){return {products:PRODUCTS,reviews:REVIEWS,elements:ELEMENTS,productElement,renderProductCardElements,activeCardField:cbCardOpenNode===cbSelected?cbCardOpenField:null};}
window.AM_BLOCK_CONTEXT=blockContext;
window.AM_CB_IS_LIB=()=>cbRailMode==='library';
window.AM_CB_CURRENT=()=>current;
function currentBlockSlot(s=section()){
 if(s.layout==='ev-quiz')return AMBlocks.slotKey(s,FLOW.getView(s));
 return 'section:after';
}
function canInsertHere(s=section()){
 return s.layout!=='ev-quiz'||/^r:\d+$/.test(FLOW.getView(s));
}
function renderIaDataLibrary(){
 const s=section();const prod=iaDataMode==='products',review=iaDataMode==='reviews',ref=iaDataMode==='refs';
 const modes=[['products','상품'],['reviews','후기'],['refs','레퍼런스']];
 let body='<div class="ia-data-note">고른 구좌나 요소에 연결할 자료예요. 새 상품 카드는 [요소 추가]에서 넣어요. '+(CATALOG_NOTE?'현재 목록은 이 기획안의 앱 데이터예요.':'현재 목록은 예시 상품이에요.')+'</div>';
 if(prod)body+='<div class="ia-data-results">'+PRODUCTS.map(p=>`<button type="button" class="ia-data-item" data-ia-bind-product="${E(p.id)}"><b>${E(p.name)}</b><small>${E(p.id)} · 선택한 요소/구좌에 연결</small></button>`).join('')+'</div>';
 else if(review)body+='<div class="ia-data-results">'+REVIEWS.slice(0,60).map(r=>`<button type="button" class="ia-data-item" data-ia-bind-review="${E(r.id)}"><b>★ ${E(String(r.rating||'·'))} · ${E(r.productId||'상품 미정')}</b><small>${E(String(r.text||'후기 내용').slice(0,56))}</small></button>`).join('')+'</div>';
 else if(ref&&REF_SOURCE)body=`<div class="ia-data-note">‘${E(s.name)}’에 붙일 레퍼런스예요. 붙이면 디자인 요청과 04 미리보기에 같이 들어가요.</div>`+refsFinder(s);
 else if(ref)body+='<div class="ia-data-results">'+(s.refs||[]).map((r,i)=>`<button type="button" class="ia-data-item" data-ia-bind-ref="${i}"><b>${E(r.name)}</b><small>${E(r.from||'참고자료')} · 이 구좌에 첨부</small></button>`).join('')+'</div>';
 $('data-library').innerHTML=`<div class="ia-library-choose">${modes.map(([k,l])=>`<button type="button" data-ia-data-mode="${k}" aria-pressed="${iaDataMode===k}">${l}</button>`).join('')}</div>`+body;
}
function renderCbRail(){
 document.querySelectorAll('[data-cb-rail]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cbRail===cbRailMode)));
 const adding=cbRailMode==='library',usingData=cbRailMode==='data';
 $('section-list').hidden=cbRailMode!=='sections';$('addSection').hidden=cbRailMode!=='sections';
 $('component-library').hidden=!adding;$('data-library').hidden=!usingData;
 $('cb-outline-title').innerHTML=adding?'추가 <small>구좌·요소 라이브러리</small>':usingData?'자료 <small>원본 연결</small>':'구성 <small>페이지 구조</small>';
 $('cb-outline-desc').textContent=adding?'새 구좌를 만들거나 선택한 구좌에 요소를 추가합니다.':usingData?'상품·후기·레퍼런스를 찾아 현재 편집 대상에 연결합니다.':'페이지의 구좌와 내부 요소를 펼쳐서 선택하세요.';
 if(adding){
  const quiz=section().layout==='ev-quiz',can=canInsertHere();
  const switcher=`<div class="ia-library-choose"><button type="button" data-ia-library="sections" aria-pressed="${iaLibraryMode==='sections'}">구좌 추가</button><button type="button" data-ia-library="blocks" aria-pressed="${iaLibraryMode==='blocks'}">요소 추가</button></div>`;
  if(iaLibraryMode==='sections')$('component-library').innerHTML=switcher+`<div class="ia-library-intro">서로 다른 와이어프레임을 확인하면서 구좌를 고를 수 있어요.</div><button type="button" class="am-ed-button am-ed-button--primary ia-open-catalog" data-ia-picker="1">＋ 구좌 유형 라이브러리 열기</button><div class="ia-library-categories">${['상품','안내·이야기','이벤트','후기'].map(k=>`<button type="button" data-ia-picker-cat="${E(k)}">${E(k)} 구좌 보기 ↗</button>`).join('')}</div>`;
  else $('component-library').innerHTML=switcher+(quiz?`<div class="cb-block-note">${can?'선택한 퀴즈 결과에 요소를 넣습니다.':'먼저 퀴즈 결과 화면을 선택하세요.'}</div>`:'')+(can?AMBlocks.catalogHTML():`<button type="button" class="am-ed-button am-ed-button--primary" data-cb-show-result="1">첫 번째 결과 화면 보기</button>`);
 }
 if(usingData)renderIaDataLibrary();
}

// A canvas selection reveals its *own* editor field in the existing inspector.
// Never scroll the whole page: the right panel is an independent scroll region.
function revealInspectorForTarget(t,{focus=true}={}){
 if(!t||t.sectionId!==current)return false;
 const panel=$('panel-body'),s=section();
 let row=null,control=null,detail=null;
 const lookup=sel=>panel.querySelector(sel);
 if(t.kind==='native-item'){
  row=lookup('[data-inspector-repeat="items:'+t.index+'"]');
  control=row?.querySelector('[data-bind="items.'+t.index+'.label"]');
 }else if(['native-product','native-card-attribute'].includes(t.kind)){
  const pid=s.productIds?.[t.index];
  detail=lookup('details.cb-card-elements-advanced');
  if(detail){detail.open=true;
   const key=t.kind==='native-card-attribute'?t.key:null;
   control=key?detail.querySelector('[data-native-visible="'+CSS.escape(pid+':'+key)+'"]'):detail.querySelector('[data-native-visible]');
   row=control?.closest('label')||detail;
  }else if(pid){
   control=lookup('[data-product="'+CSS.escape(pid)+'"]');
   row=control?.closest('.am-ed-product-row');
  }
 }else if(t.kind==='native-review'){
  control=lookup('[data-bind="rv.titles.'+CSS.escape(t.reviewId)+'"]')||
          lookup('[data-reviewpick="'+CSS.escape(t.reviewId)+'"]');
  row=control?.closest('.am-ed-review-row');
 }else if(t.kind==='block-attribute'){
  detail=lookup('details.cb-card-elements-advanced');
  if(detail){detail.open=true;control=detail.querySelector('[data-cb-settings="'+CSS.escape(t.key)+'"] [data-cb-field]')||detail.querySelector('[data-cb-expand="'+CSS.escape(t.key)+'"]')||detail.querySelector('[data-cb-visible="'+CSS.escape(t.key)+'"]');row=detail.querySelector('[data-cb-row="'+CSS.escape(t.key)+'"]')||detail;}
 }else if(t.kind==='block'){
  const node=AMBlocks.find(s,t.nodeId)?.item;
  const field=({productCard:'productId',text:'text',image:'label',cta:'text',review:'reviewId',benefit:'title',notice:'text',group:'direction',productGrid:'direction'})[node?.type]||'text';
  control=lookup('[data-cb-field="'+CSS.escape(field)+'"]');
  row=control?.closest('.am-ed-field')||lookup('.cb-inspector-header');
 }else{
  const field=t.kind==='role'?'role':t.kind==='line'?'lines.'+t.index+'.text':t.kind==='cta'?'cta':null;
  if(field){control=lookup('[data-bind="'+CSS.escape(field)+'"]');row=control?.closest('.am-ed-field');}
  if(t.kind==='cta'&&!row){control=lookup('[data-check="ctaOn"]');row=control?.closest('.am-ed-toggle');}
 }
 if(!row)return false;
 // The 16-element product list has its own scroll container. Showing a field
 // near the bottom must move that container, not only the surrounding inspector.
 const cardList=row.closest('[data-cb-sort-list]');
 if(cardList){
  const delta=row.getBoundingClientRect().top-cardList.getBoundingClientRect().top;
  cardList.scrollTop=Math.max(0,cardList.scrollTop+delta-12);
 }
 panel.querySelectorAll('.am-inspector-target').forEach(el=>{el.classList.remove('am-inspector-target');el.removeAttribute('aria-current');});
 row.classList.add('am-inspector-target');row.setAttribute('aria-current','true');
 // Reposition within the scrollable inspector, independent from center preview.
 // A smaller phone/editor uses the document's scroll instead.
 if(panel.scrollHeight>panel.clientHeight+4&&getComputedStyle(panel).overflowY!=='visible'){
  const delta=row.getBoundingClientRect().top-panel.getBoundingClientRect().top;
  panel.scrollTop=Math.max(0,panel.scrollTop+delta-16);
 }else if(getComputedStyle(panel).overflowY==='visible'){
  row.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 }
 if(focus&&control&&!control.disabled)control.focus({preventScroll:true});
 return true;
}
function selectBlock(nodeId,sid,elementKey=null){if(sid&&sid!==current)current=sid;const found=AMBlocks.find(section(),nodeId);if(!found)return;cbSelected=nodeId;cbCardOpenNode=nodeId;cbCardOpenField=elementKey||null;cbCardDetailsOpen=found.item.type==='productCard';canvasTarget={kind:elementKey?'block-attribute':'block',sectionId:current,nodeId,key:elementKey};iaSelectedChild=null;iaTreeOpen.add(current);renderAll();revealInspectorForTarget(canvasTarget);}
// Selection is intentionally ephemeral; deletion mutates existing section/element
// data through the same undo/redo pipeline as the inspector. Nothing is stored here.
function selectCanvasNative(target,{preservePreview=false}={}){
 if(!target||!sections.some(s=>s.id===target.sectionId))return;
 current=target.sectionId;cbSelected=null;canvasTarget=target;
 const labels={item:'구성 항목',product:'상품 카드',review:'후기 카드',attribute:'카드 속성',cta:'CTA',role:'소개 문구',line:'추가 문구'};
 const type=target.kind==='native-item'?'item':['native-product','native-card-attribute'].includes(target.kind)?'native-product':target.kind==='native-review'?'review':null;
 iaSelectedChild=type?{sectionId:current,type,index:target.index??0,label:labels[type==='native-product'?'product':type]||'구성 항목'}:null;
 tab=target.kind==='native-item'?'items':target.kind==='native-product'?'products':target.kind==='native-review'?'review':target.kind==='native-card-attribute'?'shape':'copy';
 iaGroup=IA_TAB_GROUP[tab]||'content';iaTreeOpen.add(current);
 if(preservePreview){
  renderList();renderPanel();renderCbRail();
  $('page').querySelectorAll('.am-canvas-selected').forEach(el=>el.classList.remove('am-canvas-selected'));
  renderCanvasSelection();
  requestAnimationFrame(()=>renderCanvasSelection());
 }else renderAll();
 revealInspectorForTarget(target);
}
function canvasTargetElement(target){
 if(!target)return null;
 const sec=$('page').querySelector('[data-page="'+CSS.escape(target.sectionId)+'"]');
 if(!sec)return null;
 const nativeProduct=()=>[...sec.querySelectorAll('.mock-products > .mock-product[data-card-product]')][target.index];
 if(target.kind==='block'||target.kind==='block-attribute'){
  const node=sec.querySelector('[data-cb-node="'+CSS.escape(target.nodeId)+'"]');
  return target.kind==='block'?node:node?.querySelector('[data-card-element="'+CSS.escape(target.key)+'"]');
 }
 if(target.kind==='native-product')return nativeProduct();
 if(target.kind==='native-card-attribute')return nativeProduct()?.querySelector('[data-card-element="'+CSS.escape(target.key)+'"]');
 if(target.kind==='native-item')return [...sec.querySelectorAll('.am-flow-info-list > .am-flow-info-item,.mock-element-stack > .mock-item,.am-ed-accordion-list > .am-ed-accordion')][target.index];
 if(target.kind==='native-review')return sec.querySelector('[data-native-review-id="'+CSS.escape(target.reviewId)+'"]');
 if(target.kind==='cta')return sec.querySelector(':scope > .mock-cta');
 if(target.kind==='role')return sec.querySelector(':scope > p:not(.preview-extra-line)');
 if(target.kind==='line')return [...sec.querySelectorAll(':scope > .preview-extra-line')][target.index];
 return null;
}
function canvasTargetLabel(target){
 const labels={block:'구성 블록', 'block-attribute':ELEMENTS[target.key]?.[0]||'카드 속성',
  'native-card-attribute':ELEMENTS[target.key]?.[0]||'카드 속성',
  'native-product':'상품 카드','native-item':'구성 항목','native-review':'후기 카드',
  cta:'CTA 버튼',role:'소개 문구',line:'추가 문구'};
 return labels[target.kind]||'선택 요소';
}
function renderCanvasSelection(){
 $('page').querySelector('.am-canvas-toolbar')?.remove();
 if(!canvasTarget||window.AM_CB_STATIC_EXPORT)return;
 const target=canvasTargetElement(canvasTarget);
 if(!target){canvasTarget=null;return;}
 target.classList.add('am-canvas-selected');
 target.setAttribute('tabindex','0');
 const page=$('page'),bar=document.createElement('div'),label=canvasTargetLabel(canvasTarget);
 const canDuplicate=['block','native-item','line'].includes(canvasTarget.kind);
 bar.className='am-canvas-toolbar';
 bar.setAttribute('role','toolbar');bar.setAttribute('aria-label',label+' 빠른 편집');
 bar.innerHTML='<span class="am-canvas-toolbar__label">'+E(label)+'</span>'+
  '<button type="button" data-canvas-action="edit" aria-label="'+E(label)+' 설정 열기">설정</button>'+
  (canDuplicate?'<button type="button" data-canvas-action="duplicate" aria-label="'+E(label)+' 복제">'+AMEditorKit.icon('copy','am-kit-icon--sm')+'</button>':'')+
  '<button type="button" class="am-canvas-toolbar__delete" data-canvas-action="delete" aria-label="'+E(label)+' 삭제" title="삭제 · Delete / Backspace">'+AMEditorKit.icon('trash','am-kit-icon--sm')+'<span>삭제</span></button>';
 page.append(bar);
 const pr=page.getBoundingClientRect(),tr=target.getBoundingClientRect();
 const y=tr.top-pr.top,above=y-bar.offsetHeight-7;
 const top=above>=4?above:tr.bottom-pr.top+7;
 const left=Math.min(Math.max(6,tr.left-pr.left+tr.width/2-bar.offsetWidth/2),Math.max(6,page.clientWidth-bar.offsetWidth-6));
 bar.style.top=Math.max(4,top)+'px';bar.style.left=left+'px';
}
function editCanvasTarget(){
 if(!canvasTarget)return;
 if(revealInspectorForTarget(canvasTarget))return;
 const panel=$('panel-body'),target=canvasTarget,s=section();
 const focus=el=>{if(!el)return false;el.scrollIntoView({block:'nearest',inline:'nearest'});el.focus({preventScroll:true});return true;};
 if(target.kind==='native-card-attribute'||target.kind==='native-product'){
  const detail=panel.querySelector('details.cb-card-elements-advanced');
  if(detail){detail.open=true;const id=s.productIds?.[target.index],name=id&&target.key?('[data-native-visible="'+CSS.escape(id+':'+target.key)+'"]'):'[data-native-visible]';if(focus(detail.querySelector(name)))return;}
 }
 if(target.kind==='block-attribute'){
  const detail=panel.querySelector('details.cb-card-elements-advanced');
  if(detail){detail.open=true;if(focus(detail.querySelector('[data-cb-visible="'+CSS.escape(target.key)+'"]')))return;}
 }
 if(target.kind==='native-review'){
  if(focus(panel.querySelector('[data-reviewpick="'+CSS.escape(target.reviewId)+'"]')))return;
 }
 const field=target.kind==='native-item'?'items.'+target.index+'.label':
   target.kind==='line'?'lines.'+target.index+'.text':
   target.kind==='role'?'role':
   target.kind==='cta'?'cta':null;
 if(field&&focus(panel.querySelector('[data-bind="'+CSS.escape(field)+'"]')))return;
 const blockFields={text:'text',image:'label',cta:'text',benefit:'title',notice:'text',review:'reviewId',productCard:'productId',group:'direction',productGrid:'direction'};
 if(['block','block-attribute'].includes(target.kind)){
  const type=AMBlocks.find(s,target.nodeId)?.item?.type;
  if(type&&focus(panel.querySelector('[data-cb-field="'+CSS.escape(blockFields[type]||'text')+'"]')))return;
 }
 focus(panel.querySelector('.am-ed-field input,.am-ed-field textarea,.am-ed-field select,.cb-el-row input'));
}
function removeCanvasTarget(){
 const t=canvasTarget;if(!t)return false;
 const s=sections.find(x=>x.id===t.sectionId);if(!s)return false;
 const before=capture();let changed=false;
 if(t.kind==='block')changed=AMBlocks.remove(s,t.nodeId);
 else if(t.kind==='block-attribute'){
  const n=AMBlocks.find(s,t.nodeId)?.item;
  if(n?.type==='productCard'&&n.props.card?.on?.[t.key]){n.props.card.on[t.key]=0;changed=true;}
 }
 else if(t.kind==='native-card-attribute'){
  if(s.card?.on?.[t.key]!==undefined){const id=s.productIds?.[t.index];if(id){s.cardElementOverrides=s.cardElementOverrides||{};s.cardElementOverrides[id]={...(s.cardElementOverrides[id]||{}),[t.key]:0};changed=true;}}
 }
 else if(t.kind==='native-product'&&Array.isArray(s.productIds)&&t.index>=0&&t.index<s.productIds.length){s.productIds.splice(t.index,1);changed=true;}
 else if(t.kind==='native-item'&&Array.isArray(s.items)&&t.index>=0&&t.index<s.items.length){s.items.splice(t.index,1);changed=true;}
 else if(t.kind==='native-review'&&s.rv?.selected?.includes(t.reviewId)){
  s.rv.selected=s.rv.selected.filter(id=>id!==t.reviewId);s.rv.order=s.rv.order.filter(id=>id!==t.reviewId);changed=true;
 }
 else if(t.kind==='cta'&&s.ctaOn){s.ctaOn=false;changed=true;}
 else if(t.kind==='role'&&s.role){s.role='';changed=true;}
 else if(t.kind==='line'&&Array.isArray(s.lines)&&t.index>=0&&t.index<s.lines.length){s.lines.splice(t.index,1);changed=true;}
 if(!changed)return false;
 canvasTarget=null;
 if(t.kind==='native-card-attribute'){
  cbSelected=null;
  iaSelectedChild={sectionId:s.id,type:'native-product',index:t.index,label:'상품 카드'};
 }else if(t.kind==='block-attribute'){
  cbSelected=t.nodeId;iaSelectedChild=null;
 }else{cbSelected=null;iaSelectedChild=null;}
 mark(before);renderAll();
 toast('선택한 '+canvasTargetLabel(t)+'를 삭제했어요. 상단 실행 취소로 복원할 수 있어요.');return true;
}
function duplicateCanvasTarget(){
 const t=canvasTarget;if(!t)return false;
 const s=sections.find(x=>x.id===t.sectionId);if(!s)return false;
 const before=capture();let changed=false;
 if(t.kind==='block'){
  const cp=AMBlocks.duplicate(s,t.nodeId);
  if(cp){cbSelected=cp.id;canvasTarget={kind:'block',sectionId:s.id,nodeId:cp.id};changed=true;}
 } else if(t.kind==='native-item'&&s.items?.[t.index]){
  s.items.splice(t.index+1,0,clone(s.items[t.index]));canvasTarget={...t,index:t.index+1};changed=true;
 } else if(t.kind==='line'&&s.lines?.[t.index]){
  s.lines.splice(t.index+1,0,clone(s.lines[t.index]));canvasTarget={...t,index:t.index+1};changed=true;
 }
 if(!changed)return false;mark(before);renderAll();toast('선택 요소를 복제했어요.');return true;
}

function addBlock(type,slotKey,parentId=null){
 if(!canInsertHere()){toast('퀴즈의 결과 화면을 먼저 선택해주세요.');return;}
 const before=capture(),s=section(),key=slotKey||currentBlockSlot(s),created=AMBlocks.insert(s,key,type,parentId);
 if(!created){toast('그룹 또는 삽입 위치를 확인해주세요.');return;}
 cbSelected=created.id;canvasTarget={kind:'block',sectionId:s.id,nodeId:created.id};mark(before);renderAll();toast('선택한 구좌에 '+(AMBlocks.TYPES.find(t=>t[0]===type)?.[1]||type)+' 블록을 추가했어요.');
}
function cbOperation(op){const before=capture(),s=section();let node=null;
 if(op==='delete'){AMBlocks.remove(s,cbSelected);cbSelected=null;canvasTarget=null;}
 else if(op==='clone'){node=AMBlocks.duplicate(s,cbSelected);if(node){cbSelected=node.id;canvasTarget={kind:'block',sectionId:s.id,nodeId:node.id};}}
 else if(op==='add-child'){node=AMBlocks.insert(s,currentBlockSlot(s),'productCard',cbSelected);if(node){cbSelected=node.id;canvasTarget={kind:'block',sectionId:s.id,nodeId:node.id};}}
 else if(op==='wrap-next'){node=AMBlocks.wrapNext(s,cbSelected);if(node){cbSelected=node.id;canvasTarget={kind:'block',sectionId:s.id,nodeId:node.id};}else toast('다음 요소가 있어야 묶을 수 있어요.');}
 else if(op==='ungroup'){AMBlocks.unwrap(s,cbSelected);cbSelected=null;canvasTarget=null;}
 else if(op==='up'||op==='down')AMBlocks.move(s,cbSelected,op==='up'?-1:1);
 mark(before);renderAll();
}
// Left-side IA navigation: selection alters view state, never original data schema.
$('section-list').addEventListener('click',e=>{
 const toggle=e.target.closest('[data-ia-toggle]');if(toggle){e.preventDefault();const id=toggle.dataset.iaToggle;iaTreeOpen.has(id)?iaTreeOpen.delete(id):iaTreeOpen.add(id);renderList();return;}
 const node=e.target.closest('[data-ia-node]');if(!node)return;
 e.preventDefault();const s=sections.find(x=>x.id===node.dataset.iaSection);if(!s)return;
 current=s.id;iaTreeOpen.add(current);cbSelected=null;canvasTarget=null;
 const type=node.dataset.iaNode,i=Number(node.dataset.iaIndex||0);
 iaSelectedChild={sectionId:s.id,type,label:node.textContent.trim(),index:i};
 if(type==='block'){selectBlock(node.dataset.iaId,s.id);AMEditorKit.revealInPreview({sectionId:s.id,blockId:node.dataset.iaId});return;}
 if(type==='quiz-view'){FLOW.setView(s,'intro');tab='event';}
 else if(type==='quiz-question'){FLOW.action(s,'editQuestion:'+i);tab='event';}
 else if(type==='quiz-result'){FLOW.action(s,'editResult:'+i);tab='event';}
 else if(type==='item'){tab='items';}
 else if(type==='native-product'){tab='products';}
 else if(type==='review'){tab='review';}
 iaGroup=IA_TAB_GROUP[tab]||'content';renderAll();
 AMEditorKit.revealInPreview({sectionId:s.id,childType:type,index:i});
 const inspectorTarget=type==='item'?{kind:'native-item',sectionId:s.id,index:i}:
  type==='native-product'?{kind:'native-product',sectionId:s.id,index:i}:
  type==='review'?{kind:'native-review',sectionId:s.id,reviewId:node.dataset.iaId}:null;
 if(inspectorTarget)revealInspectorForTarget(inspectorTarget);
},true);
$('component-library').addEventListener('click',e=>{
 const choose=e.target.closest('[data-ia-library]');if(choose){iaLibraryMode=choose.dataset.iaLibrary;renderCbRail();return;}
 const pick=e.target.closest('[data-ia-picker],[data-ia-picker-cat]');if(pick){openPicker('add');const cat=pick.dataset.iaPickerCat;if(cat){pickerCategory=cat;renderPicker();}return;}
});
$('data-library').addEventListener('click',e=>{
 const mode=e.target.closest('[data-ia-data-mode]');if(mode){iaDataMode=mode.dataset.iaDataMode;renderIaDataLibrary();return;}
 const s=section();const pid=e.target.closest('[data-ia-bind-product]')?.dataset.iaBindProduct;
 const rid=e.target.closest('[data-ia-bind-review]')?.dataset.iaBindReview;
 const ref=e.target.closest('[data-ia-bind-ref]')?.dataset.iaBindRef;
 if(pid){const before=capture(),blk=cbSelected?AMBlocks.find(s,cbSelected)?.item:null;
  if(blk?.type==='productCard')AMBlocks.setField(s,cbSelected,'productId',pid);
  else if(['grid2','grid3','feat','deal-banner'].includes(s.layout)){if(iaSelectedChild?.type==='native-product'&&iaSelectedChild.sectionId===s.id&&s.productIds[iaSelectedChild.index]!=null)s.productIds[iaSelectedChild.index]=pid;else if(!s.productIds.includes(pid))s.productIds.push(pid);tab='products';cbSelected=null;}
  else {toast('연결할 상품 카드 또는 상품 구좌를 먼저 선택하세요.');return;}
  mark(before);renderAll();toast('상품 연결을 업데이트했어요.');return;}
 if(rid){const before=capture(),blk=cbSelected?AMBlocks.find(s,cbSelected)?.item:null;
  if(blk?.type==='review')AMBlocks.setField(s,cbSelected,'reviewId',rid);
  else if(s.layout==='review'){s.rv.selected=s.rv.selected||[];s.rv.order=s.rv.order||[];if(!s.rv.selected.includes(rid)){s.rv.selected.push(rid);s.rv.order.push(rid);}tab='review';}
  else {toast('연결할 후기 요소 또는 후기 구좌를 선택하세요.');return;}
  mark(before);renderAll();toast('후기 연결을 업데이트했어요.');return;}
 if(ref!==undefined){const n=Number(ref);if(!s.refs?.[n])return;const before=capture();s.refs[n].attached=true;tab='refs';mark(before);renderAll();toast('레퍼런스를 이 구좌에 첨부했어요.');}
});
// Roving focus for two independent tab levels: keyboard users can change them with arrows.
$('tabbar').addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 const currentButton=e.target.closest('[data-ia-group],.ia-subtab[data-tab]');
 if(!currentButton)return;
 const selector=currentButton.hasAttribute('data-ia-group')?'[data-ia-group]':'.ia-subtab[data-tab]';
 const candidates=Array.from($('tabbar').querySelectorAll(selector)).filter(el=>!el.hidden);
 const i=candidates.indexOf(currentButton);if(i<0)return;
 e.preventDefault();
 const j=e.key==='Home'?0:e.key==='End'?candidates.length-1:(i+(e.key==='ArrowRight'?1:-1)+candidates.length)%candidates.length;
 const next=candidates[j],attr=selector==='[data-ia-group]'?'data-ia-group':'data-tab',value=next.getAttribute(attr);
 next.click();
 requestAnimationFrame(()=>$('tabbar').querySelector('['+attr+'="'+CSS.escape(value)+'"]')?.focus());
});
$('tabbar').addEventListener('click',e=>{
 const b=e.target.closest('[data-ia-group]');if(!b)return;
 const grp=b.dataset.iaGroup,ts=tabs(section()).filter(([key])=>IA_TAB_GROUP[key]===grp);
 if(!ts.length)return;iaGroup=grp;tab=ts[0][0];renderPanel();
});
$('ia-breadcrumb').addEventListener('click',e=>{const b=e.target.closest('[data-ia-parent]');if(!b)return;
 if(b.dataset.iaParent==='page'){cbRailMode='sections';cbSelected=null;iaSelectedChild=null;renderAll();}
 else {cbSelected=null;iaSelectedChild=null;tab='copy';iaGroup='content';renderAll();}
});
function iaIssueList(){const entries=[];for(const s of sections){FLOW.ensure(s);for(const text of ftIssues(s))entries.push({id:s.id,name:s.name,level:'warn',text});for(const issue of FLOW.issues(s))if(issue.level!=='info')entries.push({id:s.id,name:s.name,level:issue.level,text:issue.text});for(const text of AMBlocks.issues(s,blockContext()))entries.push({id:s.id,name:s.name,level:'warn',text});}return entries;}
$('iaCheckAll').addEventListener('click',()=>{const list=iaIssueList();$('ia-qa-items').innerHTML=list.length?list.map((x,i)=>`<button type="button" class="ia-qa-item" data-ia-issue-section="${E(x.id)}"><span>${E(x.name)} · ${x.level==='error'?'오류':'확인 필요'}</span><b>${E(x.text)}</b></button>`).join(''):'<div class="am-ed-note">빠진 입력이나 연결 오류가 없어요.</div>';$('ia-qa-dialog').showModal();});
$('iaQaClose').addEventListener('click',()=>$('ia-qa-dialog').close());
$('ia-qa-items').addEventListener('click',e=>{const b=e.target.closest('[data-ia-issue-section]');if(!b)return;$('ia-qa-dialog').close();setCurrent(b.dataset.iaIssueSection);tab='check';iaGroup='check';renderPanel();});
$('component-library').addEventListener('click',e=>{const result=e.target.closest('[data-cb-show-result]');if(result){const s=section();FLOW.setView(s,'r:0');tab='event';renderAll();return}const b=e.target.closest('[data-cb-add]');if(b){const parent=['group','productGrid'].includes(AMBlocks.find(section(),cbSelected)?.item?.type)?cbSelected:null;addBlock(b.dataset.cbAdd,null,parent);}});
$('component-library').addEventListener('dragstart',e=>{const b=e.target.closest('[data-cb-add]');if(!b)return;e.dataTransfer.setData('application/x-amoread-block',b.dataset.cbAdd);e.dataTransfer.effectAllowed='copy';});
document.querySelector('.cb-rail').addEventListener('click',e=>{const b=e.target.closest('[data-cb-rail]');if(!b)return;cbRailMode=b.dataset.cbRail;renderCbRail();renderPage();});
$('page').addEventListener('dragover',e=>{const z=e.target.closest('[data-cb-slot]');if(!z)return;e.preventDefault();z.classList.add('cb-drag-over');});
$('page').addEventListener('dragleave',e=>{e.target.closest('[data-cb-slot]')?.classList.remove('cb-drag-over')});
$('page').addEventListener('drop',e=>{const z=e.target.closest('[data-cb-slot]');if(!z)return;e.preventDefault();z.classList.remove('cb-drag-over');const kind=e.dataTransfer.getData('application/x-amoread-block');if(!kind)return;const sec=z.closest('[data-page]');if(!sec)return;current=sec.dataset.page;cbSelected=null;const parent=z.closest('[data-cb-node]');const parentId=['group','productGrid'].includes(AMBlocks.find(section(),parent?.dataset.cbNode)?.item?.type)?parent?.dataset.cbNode:null;addBlock(kind,z.dataset.cbSlot,parentId);});
$('tabbar').addEventListener('click',e=>{if(e.target.closest('[data-cb-back]')){cbSelected=null;canvasTarget=null;renderPage();renderPanel();}});
$('panel-body').addEventListener('click',e=>{const del=e.target.closest('[data-canvas-panel-delete]');if(!del)return;e.preventDefault();removeCanvasTarget();},true);
// Inline card property disclosures are ephemeral UI state, not a new
// product schema. Enabling an element never opens every property's form.
$('panel-body').addEventListener('toggle',e=>{
 if(e.target.matches('details.cb-card-elements-advanced'))cbCardDetailsOpen=e.target.open;
},true);
$('panel-body').addEventListener('click',e=>{
 const b=e.target.closest('[data-cb-expand]');if(!b||!cbSelected)return;
 const key=b.dataset.cbExpand,node=AMBlocks.find(section(),cbSelected)?.item;
 if(node?.type!=='productCard'||!node.props.card.on[key])return;
 const top=$('panel-body').scrollTop;
 cbCardOpenNode=cbSelected;cbCardOpenField=cbCardOpenField===key?null:key;cbCardDetailsOpen=true;
 renderPanel();$('panel-body').scrollTop=top;
 const row=$('panel-body').querySelector('[data-cb-row="'+CSS.escape(key)+'"]');
 if(row){const focus=row.querySelector('[data-cb-field]')||row.querySelector('[data-cb-expand]');focus?.focus({preventScroll:true});}
});
let cbCardDragKey=null;
function clearCardDrag(){
 $('panel-body').querySelectorAll('[data-cb-row]').forEach(row=>{
  row.classList.remove('cb-el-row--dragging');row.removeAttribute('data-cb-drop');
 });cbCardDragKey=null;
}
$('panel-body').addEventListener('dragstart',e=>{
 const row=e.target.closest('[data-cb-row]');
 if(!row||!cbSelected||e.target.closest('input,button,textarea,select'))return;
 cbCardDragKey=row.dataset.cbRow;row.classList.add('cb-el-row--dragging');
 e.dataTransfer.effectAllowed='move';
 e.dataTransfer.setData('text/plain','amoread-card-element:'+cbCardDragKey);
});
$('panel-body').addEventListener('dragover',e=>{
 if(!cbCardDragKey)return;
 const row=e.target.closest('[data-cb-row]'),list=e.target.closest('[data-cb-sort-list]');
 if(!list)return;
 // Keep the item list independently scrollable while dragging toward its edges.
 const rect=list.getBoundingClientRect();
 if(e.clientY<rect.top+34)list.scrollTop-=16;
 else if(e.clientY>rect.bottom-34)list.scrollTop+=16;
 $('panel-body').querySelectorAll('[data-cb-row]').forEach(el=>el.removeAttribute('data-cb-drop'));
 if(!row||row.dataset.cbRow===cbCardDragKey)return;
 e.preventDefault();e.dataTransfer.dropEffect='move';
 const bounds=row.getBoundingClientRect(),middle=bounds.top+bounds.height/2;
 const sourceIndex=AMBlocks.find(section(),cbSelected)?.item?.props?.card?.order?.indexOf(cbCardDragKey)??-1;
 const targetIndex=AMBlocks.find(section(),cbSelected)?.item?.props?.card?.order?.indexOf(row.dataset.cbRow)??-1;
 const side=Math.abs(e.clientY-middle)<4?(sourceIndex<targetIndex?'after':'before'):e.clientY<middle?'before':'after';
 row.dataset.cbDrop=side;
});
$('panel-body').addEventListener('drop',e=>{
 if(!cbCardDragKey)return;
 const row=e.target.closest('[data-cb-row]'),list=e.target.closest('[data-cb-sort-list]');
 if(!row||!list||row.dataset.cbRow===cbCardDragKey){clearCardDrag();return;}
 e.preventDefault();e.stopPropagation();
 const source=cbCardDragKey,target=row.dataset.cbRow,after=row.dataset.cbDrop==='after';
 const top=list.scrollTop,before=capture();
 const moved=AMBlocks.reorderCard(section(),cbSelected,source,target,after);
 clearCardDrag();
 if(!moved)return;
 cbCardDetailsOpen=true;mark(before);renderPage();renderPanel();renderList();
 const fresh=$('panel-body').querySelector('[data-cb-sort-list]');
 if(fresh)fresh.scrollTop=top;
 const focus=$('panel-body').querySelector('[data-cb-row="'+CSS.escape(source)+'"]');
 focus?.classList.add('cb-el-row--just-moved');
});
$('panel-body').addEventListener('dragend',clearCardDrag);

$('panel-body').addEventListener('click',e=>{const b=e.target.closest('[data-cb-action],[data-cb-order]');if(!b||!cbSelected)return;
 if(b.dataset.cbAction==='back'){cbSelected=null;canvasTarget=null;renderPage();renderPanel();return}
 if(b.dataset.cbAction){cbOperation(b.dataset.cbAction);return}
 if(b.dataset.cbOrder){const [key,d]=b.dataset.cbOrder.split(':'),before=capture(),top=$('panel-body').scrollTop;AMBlocks.changeCardOrder(section(),cbSelected,key,Number(d));cbCardDetailsOpen=true;mark(before);renderPage();renderPanel();renderList();$('panel-body').scrollTop=top;}
});
$('panel-body').addEventListener('change',e=>{const el=e.target;if(!cbSelected)return;
 if(el.dataset.cbVisible!==undefined){const before=capture(),node=AMBlocks.find(section(),cbSelected)?.item;if(!node?.props?.card?.on||el.dataset.cbVisible==='ai')return;node.props.card.on[el.dataset.cbVisible]=el.checked?1:0;if(!el.checked&&cbCardOpenField===el.dataset.cbVisible)cbCardOpenField=null;cbCardDetailsOpen=true;const top=$('panel-body').scrollTop,listScroll=$('panel-body').querySelector('[data-cb-sort-list]')?.scrollTop||0;mark(before);renderPage();renderPanel();renderList();$('panel-body').scrollTop=top;const list=$('panel-body').querySelector('[data-cb-sort-list]');if(list)list.scrollTop=listScroll;return}
 if(el.dataset.cbField!==undefined&&el.tagName==='SELECT'){const before=capture();AMBlocks.setField(section(),cbSelected,el.dataset.cbField,el.value==='true'?true:el.value==='false'?false:['columns'].includes(el.dataset.cbField)?Number(el.value):el.value);mark(before);renderAll()}
});
$('panel-body').addEventListener('focusin',e=>{if(cbSelected&&e.target.matches('input[data-cb-field],textarea[data-cb-field]'))cbEditStart=capture()});
$('panel-body').addEventListener('input',e=>{const el=e.target;if(!cbSelected||!el.matches('input[data-cb-field],textarea[data-cb-field]'))return;AMBlocks.setField(section(),cbSelected,el.dataset.cbField,el.value);renderPage();saveDemo()});
$('panel-body').addEventListener('focusout',e=>{if(cbSelected&&e.target.matches('input[data-cb-field],textarea[data-cb-field]')&&cbEditStart){mark(cbEditStart);cbEditStart=null;}});

$('section-list').addEventListener('click',e=>{const x=e.target.closest('[data-list-action]');if(x){let [action,id]=x.dataset.listAction.split(':'),i=sections.findIndex(s=>s.id===id);if(i<0)return;const before=capture();if(action==='up'&&i>0)[sections[i-1],sections[i]]=[sections[i],sections[i-1]];else if(action==='down'&&i<sections.length-1)[sections[i+1],sections[i]]=[sections[i],sections[i+1]];else if(action==='clone'){const t=clone(sections[i]);t.id='s_'+Date.now().toString(36);t.name+=' (복제)';sections.splice(i+1,0,t);current=t.id}else if(action==='delete'&&sections.length>1){sections.splice(i,1);if(current===id)current=sections[Math.min(i,sections.length-1)].id;}mark(before);updateAll();return;}const b=e.target.closest('[data-section]');if(b){setCurrent(b.dataset.section);AMEditorKit.revealInPreview({sectionId:b.dataset.section});}});
$('page').addEventListener('click',e=>{
 const pill=e.target.closest('[data-ftab-pill]');
 if(pill){e.preventDefault();e.stopPropagation();const [sid,tid]=pill.dataset.ftabPill.split('|'),sx=sections.find(z=>z.id===sid);if(!sx)return;
  ftSwitch(sx,tid);if(current!==sid)setCurrent(sid);else renderAll();saveDemo();
  $('page').querySelector(`[data-ftab-pill="${CSS.escape(pill.dataset.ftabPill)}"]`)?.focus();return;}
 const action=e.target.closest('[data-canvas-action]');
 if(action){e.preventDefault();e.stopPropagation();const op=action.dataset.canvasAction;if(op==='delete')removeCanvasTarget();else if(op==='duplicate')duplicateCanvasTarget();else if(op==='edit')editCanvasTarget();return;}
 const referenceLink=e.target.closest('.am-custom-ref-link');
 if(referenceLink){e.preventDefault();const el=referenceLink.closest('[data-page]');if(el)setCurrent(el.dataset.page);return;}
 const x=e.target.closest('[data-flow-preview]');
 if(x){const b=x.closest('[data-page]'),target=sections.find(z=>z.id===b?.dataset.page);
  if(target&&FLOW.answer(target,x.dataset.flowPreview)){current=target.id;canvasTarget=null;renderPage();renderPanel();}return;}
 const sec=e.target.closest('[data-page]');if(!sec)return;
 const sid=sec.dataset.page;
 const accordion=e.target.closest('.am-ed-accordion-list > .am-ed-accordion[data-native-accordion-index]');
 if(accordion){
  selectCanvasNative({kind:'native-item',sectionId:sid,index:Number(accordion.dataset.nativeAccordionIndex)},{preservePreview:true});
  return;
 }
 const cb=e.target.closest('[data-cb-node]');
 if(cb){const attr=e.target.closest('[data-card-element]');
  const kind=AMBlocks.find(sections.find(s=>s.id===sid),cb.dataset.cbNode)?.item?.type;
  selectBlock(cb.dataset.cbNode,sid,kind==='productCard'&&attr?attr.dataset.cardElement:null);return;}
 const prod=e.target.closest('.mock-products > .mock-product[data-card-product]');
 if(prod){const products=[...sec.querySelectorAll('.mock-products > .mock-product[data-card-product]')],index=products.indexOf(prod);
  if(index>=0){const attr=e.target.closest('[data-card-element]');
   selectCanvasNative({kind:attr?'native-card-attribute':'native-product',sectionId:sid,index,key:attr?.dataset.cardElement});return;}}
 const item=e.target.closest('.am-flow-info-list > .am-flow-info-item,.mock-element-stack > .mock-item');
 if(item){const items=[...sec.querySelectorAll('.am-flow-info-list > .am-flow-info-item,.mock-element-stack > .mock-item')],index=items.indexOf(item);
  if(index>=0){selectCanvasNative({kind:'native-item',sectionId:sid,index});return;}}
 const review=e.target.closest('.mock-review-card[data-native-review-id]');
 if(review){selectCanvasNative({kind:'native-review',sectionId:sid,reviewId:review.dataset.nativeReviewId});return;}
 const cta=e.target.closest('.mock-cta');
 if(cta&&cta.parentElement===sec){selectCanvasNative({kind:'cta',sectionId:sid});return;}
 const line=e.target.closest('.preview-extra-line');
 if(line&&line.parentElement===sec){const index=[...sec.querySelectorAll(':scope > .preview-extra-line')].indexOf(line);
  if(index>=0){selectCanvasNative({kind:'line',sectionId:sid,index});return;}}
 const role=e.target.closest('p:not(.preview-extra-line)');
 if(role&&role.parentElement===sec){selectCanvasNative({kind:'role',sectionId:sid});return;}
 setCurrent(sid);
});
$('page').addEventListener('keydown',e=>{const pill=e.target.closest?.('[data-ftab-pill]');if(pill&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();const all=[...pill.parentElement.querySelectorAll('[data-ftab-pill]')],i=all.indexOf(pill),next=all[(i+(e.key==='ArrowRight'?1:all.length-1))%all.length];next.click();}});
$('page').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-cb-node]')){e.preventDefault();selectBlock(e.target.dataset.cbNode,e.target.closest('[data-page]')?.dataset.page);return;}if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-page]')){e.preventDefault();setCurrent(e.target.dataset.page)}});
// Left outline: reorder siblings within the same semantic list and section.
// Do not allow cross-section drops or moving a child outside its block group.
let draggingChild=null;
const outlineSortTarget=el=>el?.closest('.ia-tree-node[data-ia-sort]');
const outlineSortInfo=el=>el?{sid:el.dataset.iaSection,type:el.dataset.iaSort,
 index:Number(el.dataset.iaIndex??-1),id:el.dataset.iaId||''}:null;
function outlineSortList(s,t){
 if(t.type==='native-product')return s.productIds;
 if(t.type==='item')return s.items;
 if(t.type==='review')return s.rv?.order;
 if(t.type==='quiz-question')return s.ev?.ui?.quiz?.questions;
 if(t.type==='quiz-result')return s.ev?.ui?.quiz?.results;
 return null;
}
function outlineSortIndex(s,t){
 if(t.type==='block')return AMBlocks.find(s,t.id)?.list.indexOf(AMBlocks.find(s,t.id)?.item)??-1;
 const list=outlineSortList(s,t);
 if(!Array.isArray(list))return -1;
 if(t.type==='review')return list.indexOf(t.id);
 if(t.type==='quiz-question'||t.type==='quiz-result')return list.findIndex(x=>x.id===t.id);
 return Number.isInteger(t.index)?t.index:-1;
}
function outlineCanSort(source,target){
 if(!source||!target||source.sid!==target.sid||source.type!==target.type)return false;
 const s=sections.find(x=>x.id===source.sid);if(!s)return false;
 if(source.type==='block'){
  const a=AMBlocks.find(s,source.id),b=AMBlocks.find(s,target.id);
  return !!(a&&b&&a.list===b.list&&a.item!==b.item);
 }
 const list=outlineSortList(s,source);
 return Array.isArray(list)&&outlineSortIndex(s,source)>=0&&outlineSortIndex(s,target)>=0&&outlineSortIndex(s,source)!==outlineSortIndex(s,target);
}
function outlineApplySort(source,target,after=false){
 if(!outlineCanSort(source,target))return false;
 const s=sections.find(x=>x.id===source.sid),before=capture();
 const from=outlineSortIndex(s,source),to=outlineSortIndex(s,target);
 let changed=false;
 if(source.type==='block')changed=AMBlocks.reorderBlock(s,source.id,target.id,after);
 else{
  const list=outlineSortList(s,source),dest=to+(after?1:0)-(from<to?1:0);
  if(dest!==from){const [moved]=list.splice(from,1);list.splice(dest,0,moved);changed=true;}
 }
 if(!changed)return false;
 mark(before);
 current=s.id;iaTreeOpen.add(s.id);
 const newIndex=source.type==='block'?-1:outlineSortIndex(s,{...source,index:
   (source.type==='native-product'||source.type==='item')?
   to+(after?1:0)-(from<to?1:0):source.index});
 const targetNow=source.type==='block'?{kind:'block',sectionId:s.id,nodeId:source.id}:
 source.type==='item'?{kind:'native-item',sectionId:s.id,index:newIndex}:
 source.type==='native-product'?{kind:'native-product',sectionId:s.id,index:newIndex}:
 source.type==='review'?{kind:'native-review',sectionId:s.id,reviewId:source.id}:null;
 if(source.type==='block'){
  cbSelected=source.id;canvasTarget=targetNow;iaSelectedChild=null;
 }else{
  cbSelected=null;canvasTarget=targetNow;
  iaSelectedChild={sectionId:s.id,type:source.type,index:newIndex,label:'이동한 구성 요소'};
  if(source.type==='item')tab='items';
  else if(source.type==='native-product')tab='products';
  else if(source.type==='review')tab='review';
  else if(source.type.startsWith('quiz-')){tab='event';FLOW.action(s,(source.type==='quiz-question'?'editQuestion:':'editResult:')+newIndex);}
  iaGroup=IA_TAB_GROUP[tab]||'content';
 }
 renderAll();
 if(targetNow)revealInspectorForTarget(targetNow,{focus:false});
 toast('구성 요소 순서를 변경했어요. 실행 취소로 되돌릴 수 있어요.');
 return true;
}
function clearOutlineDrag(){
 $('section-list').querySelectorAll('.ia-tree-node[data-ia-sort]').forEach(el=>{
  el.classList.remove('ia-tree-node--dragging');el.removeAttribute('data-ia-drop');
 });
 draggingChild=null;
}
$('section-list').addEventListener('dragstart',e=>{
 const node=outlineSortTarget(e.target);
 if(!node||e.target.closest('input,textarea,select'))return;
 draggingChild=outlineSortInfo(node);
 node.classList.add('ia-tree-node--dragging');
 e.dataTransfer.effectAllowed='move';
 e.dataTransfer.setData('text/plain','amoread-outline:'+draggingChild.type+':'+draggingChild.sid);
});
$('section-list').addEventListener('dragover',e=>{
 if(!draggingChild)return;
 const scroller=$('section-list'),box=scroller.getBoundingClientRect();
 if(e.clientY<box.top+36)scroller.scrollTop-=16;
 else if(e.clientY>box.bottom-36)scroller.scrollTop+=16;
 scroller.querySelectorAll('[data-ia-drop]').forEach(el=>el.removeAttribute('data-ia-drop'));
 const node=outlineSortTarget(e.target),target=outlineSortInfo(node);
 if(!outlineCanSort(draggingChild,target))return;
 e.preventDefault();e.dataTransfer.dropEffect='move';
 const bounds=node.getBoundingClientRect(),middle=bounds.top+bounds.height/2;
 const sourceSection=sections.find(x=>x.id===draggingChild.sid);
 const forward=outlineSortIndex(sourceSection,draggingChild)<outlineSortIndex(sourceSection,target);
 node.dataset.iaDrop=Math.abs(e.clientY-middle)<4?(forward?'after':'before'):e.clientY<middle?'before':'after';
});
$('section-list').addEventListener('drop',e=>{
 if(!draggingChild)return;
 const node=outlineSortTarget(e.target),target=outlineSortInfo(node),source=draggingChild;
 const after=node?.dataset.iaDrop==='after';
 if(outlineCanSort(source,target)){e.preventDefault();e.stopPropagation();clearOutlineDrag();outlineApplySort(source,target,after);}
 else clearOutlineDrag();
});
$('section-list').addEventListener('dragend',clearOutlineDrag);
$('section-list').addEventListener('keydown',e=>{
 if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;
 const node=outlineSortTarget(e.target);if(!node)return;
 const source=outlineSortInfo(node),s=sections.find(x=>x.id===source.sid);if(!s)return;
 const list=outlineSortList(s,source),from=outlineSortIndex(s,source);
 let target=null;
 if(source.type==='block'){
  const info=AMBlocks.find(s,source.id),adj=info?.list[from+(e.key==='ArrowUp'?-1:1)];
  if(adj)target={...source,id:adj.id};
 }else if(Array.isArray(list)){
  const next=from+(e.key==='ArrowUp'?-1:1);
  if(next>=0&&next<list.length){
   target={...source,index:next};
   if(source.type==='review')target.id=list[next];
   if(source.type==='quiz-question'||source.type==='quiz-result')target.id=list[next].id;
  }
 }
 if(!target||!outlineCanSort(source,target))return;
 e.preventDefault();
 const ok=outlineApplySort(source,target,e.key==='ArrowDown');
 if(ok){
  const sel=source.type==='block'?
   '[data-ia-sort="block"][data-ia-id="'+CSS.escape(source.id)+'"]':
   source.type==='review'||source.type.startsWith('quiz-')?
   '[data-ia-sort="'+CSS.escape(source.type)+'"][data-ia-id="'+CSS.escape(source.id)+'"]':
   '[data-ia-sort="'+CSS.escape(source.type)+'"][data-ia-index="'+(from+(e.key==='ArrowUp'?-1:1))+'"]';
  $('section-list').querySelector(sel)?.focus({preventScroll:true});
 }
});

let dragging=null;
$('section-list').addEventListener('dragstart',e=>{const row=e.target.closest('[data-drag-id]');if(!row)return;dragging=row.dataset.dragId;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragging)});
$('section-list').addEventListener('dragover',e=>{const row=e.target.closest('[data-drag-id]');if(!row||!dragging)return;e.preventDefault();e.dataTransfer.dropEffect='move';});
$('section-list').addEventListener('drop',e=>{const row=e.target.closest('[data-drag-id]');if(!row||!dragging)return;e.preventDefault();const before=capture(),i=sections.findIndex(s=>s.id===dragging),j=sections.findIndex(s=>s.id===row.dataset.dragId);if(i>=0&&j>=0&&i!==j){const [obj]=sections.splice(i,1);sections.splice(j,0,obj);mark(before);renderAll();}dragging=null});
$('section-list').addEventListener('dragend',()=>{dragging=null});
$('section-list').addEventListener('keydown',e=>{if(!e.altKey||!(e.key==='ArrowUp'||e.key==='ArrowDown'))return;const row=e.target.closest('[data-section]');if(!row)return;e.preventDefault();const i=sections.findIndex(s=>s.id===row.dataset.section),j=i+(e.key==='ArrowUp'?-1:1);if(i<0||j<0||j>=sections.length)return;const before=capture();[sections[i],sections[j]]=[sections[j],sections[i]];mark(before);renderAll();$('section-list').querySelector('[data-section="'+CSS.escape(row.dataset.section)+'"]')?.focus()});
$('tabbar').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){cbSelected=null;tab=b.dataset.tab;iaGroup=IA_TAB_GROUP[tab]||'content';renderPanel()}});
$('panel-body').addEventListener('focusin',e=>{if(e.target.dataset.bind){inputSnapshot=capture();}});
$('panel-body').addEventListener('focusout',e=>{if(e.target.dataset.bind&&inputSnapshot){mark(inputSnapshot);inputSnapshot=null}});
$('panel-body').addEventListener('input',e=>{
 const t=e.target;if(!t.dataset.bind)return;
 const key=t.dataset.bind;
 const accordionDefault=/^items\.\d+\.openByDefault$/.test(key);
 setPath(section(),key,accordionDefault?t.value==='true':t.value);
 const c=$('panel-body').querySelector('[data-counter-for="'+CSS.escape(key)+'"]');
 if(c){const max=t.getAttribute('maxlength')||'';c.textContent=t.value.length+'/'+max;}
 renderList();renderPage();
 if(accordionDefault){
  const i=Number(key.split('.')[1]);
  const detail=$('page').querySelector('[data-page="'+CSS.escape(section().id)+'"] .am-ed-accordion[data-native-accordion-index="'+i+'"]');
  if(detail)detail.open=t.value==='true';
 }
 $('insTitle').textContent=section().name;saveDemo();
});
$('panel-body').addEventListener('change',e=>{const t=e.target,s=section(),before=capture();
 if(t.dataset.bind&&t.tagName==='SELECT'&&['config.imagePosition','config.presentation','config.previewState'].includes(t.dataset.bind)){
   // The value was already stored by the input handler. Refresh the linked
   // controls immediately without moving the independent panel's scroll.
   const panel=$('panel-body'),top=panel.scrollTop,key=t.dataset.bind;
   renderPanel();panel.scrollTop=top;
   panel.querySelector('[data-bind="'+CSS.escape(key)+'"]')?.focus({preventScroll:true});
   return;
 }
 if(t.dataset.nativeVisible){
   const [pid,key]=t.dataset.nativeVisible.split(':');
   if(!s.productIds.includes(pid)||!(key in ELEMENTS)||key==='ai')return;
   s.cardElementOverrides=s.cardElementOverrides||{};
   s.cardElementOverrides[pid]={...(s.cardElementOverrides[pid]||{}),[key]:t.checked?1:0};
   mark(before);renderPage();renderPanel();return;
 }
 if(t.dataset.target){s.ctaTarget=t.value;}
 else if(t.dataset.reviewProduct!==undefined){s.rv.productId=t.value;}
 else if(t.dataset.check){setPath(s,t.dataset.check,t.checked);}
 else if(t.dataset.element){s.card.on[t.dataset.element]=t.checked?1:0;}
 else if(t.dataset.product){if(t.checked&&!s.productIds.includes(t.dataset.product))s.productIds.push(t.dataset.product);else if(!t.checked)s.productIds=s.productIds.filter(id=>id!==t.dataset.product);}
 else if(t.dataset.reviewpick){const id=t.dataset.reviewpick;if(t.checked&&!s.rv.selected.includes(id)){s.rv.selected.push(id);s.rv.order.push(id);}else if(!t.checked){s.rv.selected=s.rv.selected.filter(x=>x!==id);s.rv.order=s.rv.order.filter(x=>x!==id);}}
 else return;
 mark(before);renderList();renderList();renderPanel();renderPage();saveDemo();});
$('panel-body').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const s=section(),before=capture();
 if(t.dataset.ftabOp){const op=t.dataset.ftabOp,id=t.dataset.ftabId;let msg='';
  if(op==='split'){ftSplit(s);msg='탭 2개로 나눴어요. 지금 상품은 첫 탭에 있어요';}
  else if(op==='add'){if(!ftAdd(s))return;msg='탭을 추가했어요. 이 탭에 담을 상품을 골라 주세요';}
  else if(op==='view')ftSwitch(s,id);
  else if(op==='up'||op==='down')ftMove(s,id,op==='up'?-1:1);
  else if(op==='del'){const moved=ftRemove(s,id);if(moved===null){toast('탭은 2개 이상이어야 해요. 탭을 쓰지 않으려면 [탭 없애기]를 눌러 주세요');return;}msg=moved?`탭을 지웠어요. 그 탭에만 있던 상품 ${moved}개는 첫 탭으로 옮겼어요`:'탭을 지웠어요';}
  else if(op==='drop'){ftDrop(s);msg='탭을 없앴어요. 모든 탭의 상품을 이 구좌에 모았어요';}
  if(op!=='view')mark(before);renderList();renderPanel();renderPage();saveDemo();if(msg)toast(msg);
  if(op==='view'||op==='up'||op==='down')$('panel-body').querySelector(`[data-ftab-id="${CSS.escape(id)}"][data-ftab-op="${op==='view'?'up':op}"]`)?.focus();
  return;}
 if(t.dataset.productStyle){if(!PRODUCT_VIEW_NAMES[t.dataset.productStyle])return;s.productView=t.dataset.productStyle;mark(before);renderList();renderList();renderPanel();renderPage();saveDemo();return;}
 if(t.dataset.masonryReset){if(productView(s)!=='masonry')return;s.productImageRatios={};mark(before);renderList();renderList();renderPanel();renderPage();saveDemo();return;}
 if(t.dataset.columnPath){
  const path=t.dataset.columnPath,selected=Number(t.dataset.columns),allowed=columnSettings(s);
  if(!allowed||path!==allowed.path||!allowed.options.includes(selected))return;
  if(path.startsWith('layoutColumns.')){s.layoutColumns=s.layoutColumns||{};s.layoutColumns[s.layout]=selected;}
  else setPath(s,path,String(selected));
  mark(before);renderList();renderList();renderPanel();renderPage();saveDemo();return;
 }
 if(t.dataset.flowView){FLOW.setView(s,t.dataset.flowView);renderPanel();renderPage();return;}
 if(t.dataset.flow){if(FLOW.action(s,t.dataset.flow)){mark(before);renderList();renderList();renderPanel();renderPage();saveDemo();}else toast('마지막 항목이거나 결과와 연결되어 있어 삭제할 수 없어요.');return;}

 if(t.dataset.evopt){const [operation,raw]=t.dataset.evopt.split(':'),items=s.ev?.ui?.options;if(!Array.isArray(items))return;const i=Number(raw);if(operation==='add'&&items.length<6)items.push('새 선택지');if(operation==='remove'&&items.length>2)items.splice(i,1);if(operation==='up'&&i>0)[items[i],items[i-1]]=[items[i-1],items[i]];if(operation==='down'&&i<items.length-1)[items[i],items[i+1]]=[items[i+1],items[i]];mark(before);renderList();renderPanel();renderPage();return;}
if(t.dataset.choice){
  if(t.dataset.choice.startsWith('productImageRatios.')){
    // Older saved sections have no per-product image-ratio map. Create it lazily
    // and only allow overrides on currently selected products in masonry mode.
    const pid=t.dataset.choice.slice('productImageRatios.'.length);
    if(productView(s)!=='masonry'||!s.productIds.includes(pid))return;
    s.productImageRatios=s.productImageRatios||{};
    if(t.dataset.value==='auto')delete s.productImageRatios[pid];
    else if(IMAGE_RATIOS.some(([id])=>id===t.dataset.value))s.productImageRatios[pid]=t.dataset.value;
    else return;
  }else setPath(s,t.dataset.choice,t.dataset.value);
  if(t.dataset.choice==='custom.height')ensureCustom(s).heightPx=null;
  if(t.dataset.choice==='ctaTargetType')s.ctaTarget='';
 }
 else if(t.dataset.ctaStyle){s.ctaStyle=t.dataset.ctaStyle;s.ctaStyleModified=true;}
 else if(t.dataset.reviewLayout){s.rv.layout=t.dataset.reviewLayout;}
 else if(t.dataset.reviewStep){const [id,delta]=t.dataset.reviewStep.split(':'),i=s.rv.order.indexOf(id),j=i+Number(delta);if(i>=0&&j>=0&&j<s.rv.order.length)[s.rv.order[i],s.rv.order[j]]=[s.rv.order[j],s.rv.order[i]];}
 else if(t.dataset.mood){const k=t.dataset.mood;if(s.moods.includes(k))s.moods=s.moods.filter(x=>x!==k);else s.moods.push(k);}
 else if(t.dataset.action){const [action,key,index,step]=t.dataset.action.split(':');if(action==='add'){const a=s[key];if(Array.isArray(a))a.push(key==='lines'?{text:''}:{label:'새 항목',text:''});}else if(action==='delete'){const a=s[key];if(Array.isArray(a)&&a.length>Number(index))a.splice(Number(index),1);}else if(action==='move'){const a=s[key],i=Number(index),j=i+Number(step);if(Array.isArray(a)&&j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];}else if(action==='element'){const i=Number(key),j=i+Number(index),a=s.card.order;if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];}}
 else return;
 mark(before);renderList();renderList();renderPanel();renderPage();saveDemo();});
function parseCsv(text){const out=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(v=>v.trim()))out.push(row);row=[];}else field+=c;}row.push(field);if(row.some(v=>v.trim()))out.push(row);return out}
$('panel-body').addEventListener('change',async e=>{
 const el=e.target;if(el.id!=='customImageUpload'||!el.files?.length)return;
 const s=section(),c=ensureCustom(s);if(!c)return;
 const file=el.files[0],type=file.type;
 if(!['image/png','image/jpeg','image/webp'].includes(type)||file.size>5_000_000){toast('PNG/JPG/WebP 이미지 5MB 이하만 첨부할 수 있어요.');return;}
 try{
  const img=await createImageBitmap(file),canvas=document.createElement('canvas');
  const scale=Math.min(1,1000/Math.max(img.width,img.height));
  canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close?.();
  let output=canvas.toDataURL('image/webp',.73);
  if(output.length>800_000){canvas.width=Math.max(1,Math.round(canvas.width*.72));canvas.height=Math.max(1,Math.round(canvas.height*.72));const image=await createImageBitmap(file);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close?.();output=canvas.toDataURL('image/webp',.6);}
  if(output.length>800_000)throw new Error('too-large');
  const before=capture(),originalImage=c.imageData,originalName=c.imageName,originalMode=c.mode;
  c.imageData=output;c.imageName=file.name.slice(0,120);c.mode='reference';
  try{localStorage.setItem('amoread-lab-v09',capture());}catch(e){c.imageData=originalImage;c.imageName=originalName;c.mode=originalMode;throw new Error('storage-full')}
  mark(before);renderList();renderPanel();renderPage();toast('레퍼런스 이미지를 첨부했어요.');
 }catch(err){toast(err.message==='storage-full'?'브라우저 저장 공간이 부족해요. 기존 이미지를 줄이거나 URL을 사용해주세요.':'이미지를 처리하지 못했어요. 파일을 확인해주세요.');}
});
$('panel-body').addEventListener('click',e=>{if(!e.target.closest('[data-custom-remove-image]'))return;const c=ensureCustom(section());if(!c)return;const before=capture();c.imageData='';c.imageName='';mark(before);renderList();renderPanel();renderPage();});
// Explicit height entry and reset are separate from generic text fields so a
// drag gesture or numeric entry creates exactly one Undo checkpoint.
function setCustomHeightByInput(raw){
 const c=ensureCustom(section());if(!c)return;
 if(String(raw).trim()===''){const before=capture();c.heightPx=null;c.height='auto';mark(before);renderPage();renderPanel();return;}
 const value=Number(raw);
 if(!Number.isFinite(value)||value<CUSTOM_SIZE_MIN||value>CUSTOM_SIZE_MAX){toast('높이를 160~1600px 사이로 입력해주세요.');renderPanel();return;}
 const before=capture();c.heightPx=Math.round(value/CUSTOM_SIZE_STEP)*CUSTOM_SIZE_STEP;mark(before);renderPage();renderPanel();
}
$('panel-body').addEventListener('change',e=>{const el=e.target;if(!el.matches('[data-custom-height-input]'))return;setCustomHeightByInput(el.value)});
$('panel-body').addEventListener('click',e=>{if(!e.target.closest('[data-custom-fit]'))return;const c=ensureCustom(section());if(!c)return;const before=capture();c.heightPx=null;c.height='auto';mark(before);renderPage();renderPanel();toast('콘텐츠 높이에 맞추도록 변경했어요.');});

// Resize from the bottom handle without rerendering the entire page mid-drag.
// Contents remain in normal document flow, so manual height is only a minimum.
let customDrag=null;
function customLiveHeight(d,value){
 const rounded=Math.min(CUSTOM_SIZE_MAX,Math.max(CUSTOM_SIZE_MIN,Math.round(value/CUSTOM_SIZE_STEP)*CUSTOM_SIZE_STEP));
 d.value=rounded;
 d.frame.style.setProperty('--am-custom-height',rounded+'px');
 d.handle.setAttribute('aria-valuenow',String(rounded));
 d.handle.setAttribute('aria-valuetext',rounded+'픽셀');
 const text=d.handle.querySelector('.am-custom-resize-readout');if(text)text.textContent=rounded+'px';
 return rounded;
}
function commitCustomResize(d){if(!d)return;const s=sections.find(s=>s.id===d.sectionId);if(!s)return;const c=ensureCustom(s);
 // A click without moving the pointer must not silently replace a preset.
 if(!d.moved){if(d.originalStyle)d.frame.style.setProperty('--am-custom-height',d.originalStyle);else d.frame.style.removeProperty('--am-custom-height');return;}
 if(d.value!==d.initialValue||customManualHeight(c)!==d.value){const before=d.before;c.heightPx=d.value;mark(before);saveDemo();renderPage();renderPanel();}
}
$('page').addEventListener('pointerdown',e=>{
 const handle=e.target.closest('[data-custom-resize]');if(!handle||e.button!==0)return;
 const s=sections.find(x=>x.id===handle.dataset.customResize);if(!s||s.layout!=='custom'||window.AM_CB_STATIC_EXPORT)return;
 e.preventDefault();e.stopPropagation();
 const frame=handle.closest('[data-custom-frame]');const c=ensureCustom(s),start=Math.max(CUSTOM_SIZE_MIN,Math.round(frame.getBoundingClientRect().height));
 customDrag={handle,frame,sectionId:s.id,pointerId:e.pointerId,startY:e.clientY,start,initialValue:customManualHeight(c)||customPresetHeight(c),value:start,moved:false,before:capture(),originalStyle:frame.style.getPropertyValue('--am-custom-height')};
 handle.setPointerCapture?.(e.pointerId);customLiveHeight(customDrag,start);handle.focus({preventScroll:true});
});
window.addEventListener('pointermove',e=>{if(!customDrag||e.pointerId!==customDrag.pointerId)return;e.preventDefault();if(Math.abs(e.clientY-customDrag.startY)>=3)customDrag.moved=true;customLiveHeight(customDrag,customDrag.start+e.clientY-customDrag.startY);});
window.addEventListener('pointerup',e=>{if(!customDrag||e.pointerId!==customDrag.pointerId)return;const d=customDrag;customDrag=null;commitCustomResize(d);});
window.addEventListener('pointercancel',e=>{if(!customDrag||e.pointerId!==customDrag.pointerId)return;const d=customDrag;customDrag=null;if(d.originalStyle)d.frame.style.setProperty('--am-custom-height',d.originalStyle);else d.frame.style.removeProperty('--am-custom-height');renderPage();});
$('page').addEventListener('click',e=>{if(e.target.closest('[data-custom-resize]')){e.preventDefault();e.stopPropagation();}},true);
$('page').addEventListener('keydown',e=>{
 const handle=e.target.closest('[data-custom-resize]');if(!handle)return;
 const keys={ArrowUp:-1,ArrowDown:1,Home:0,End:0};if(!(e.key in keys))return;
 e.preventDefault();e.stopPropagation();const s=sections.find(x=>x.id===handle.dataset.customResize);if(!s)return;
 const c=ensureCustom(s),frame=handle.closest('[data-custom-frame]'),start=customManualHeight(c)||Math.round(frame.getBoundingClientRect().height);
 const value=e.key==='Home'?CUSTOM_SIZE_MIN:e.key==='End'?CUSTOM_SIZE_MAX:Math.min(CUSTOM_SIZE_MAX,Math.max(CUSTOM_SIZE_MIN,start+keys[e.key]*(e.shiftKey?100:20)));
 const before=capture();c.heightPx=Math.round(value/CUSTOM_SIZE_STEP)*CUSTOM_SIZE_STEP;mark(before);renderPage();renderPanel();$('page').querySelector('[data-custom-resize="'+CSS.escape(s.id)+'"]')?.focus({preventScroll:true});
});
$('page').addEventListener('keydown',e=>{if(e.key==='Escape'&&customDrag){const d=customDrag;customDrag=null;if(d.originalStyle)d.frame.style.setProperty('--am-custom-height',d.originalStyle);else d.frame.style.removeProperty('--am-custom-height');renderPage();}},true);

$('panel-body').addEventListener('change',async e=>{const el=e.target;if(el.id!=='reviewsCsv'||!el.files?.length)return;const file=el.files[0];if(file.size>2_000_000){toast('2MB 이하 CSV만 사용할 수 있어요');return;}const raw=(await file.text()).replace(/^\uFEFF/,'');const rows=parseCsv(raw);const heads=(rows.shift()||[]).map(x=>x.trim().toLowerCase());const seqI=heads.indexOf('seq'), titleI=heads.indexOf('title'),textI=heads.indexOf('text'), ratingI=heads.indexOf('rating');if(seqI<0||titleI<0||textI<0){toast('CSV 헤더 seq, title, text를 확인해주세요');return;}const before=capture();const parsed=rows.filter(a=>PRODUCTS.some(p=>p.id===String(a[seqI]||'').trim())).slice(0,100).map((a,i)=>({id:'csv_'+Date.now()+'_'+i,productId:a[seqI].trim(),title:String(a[titleI]||'').slice(0,80),text:String(a[textI]||'').slice(0,1500),rating:ratingI>=0?Number(a[ratingI])||5:5,source:'csv'}));REVIEWS=[...REVIEWS.filter(r=>r.source!=='csv'),...parsed];mark(before);renderList();renderPanel();renderPage();toast('후기 CSV '+parsed.length+'건을 불러왔어요 (저장하지 않아요)');});
function pickerMock(x,id){
 const mock=makeSection(x.layout,id,x.layout==='review'?'구매 후기로 확인하세요':x.name,x.description);
 if(x.variantKind==='product')mock.productView=x.variant;
 if(x.variantKind==='tabs')ftSplit(mock,['1만원대','2만원대','3만원 이상']);
 if(x.variantKind==='accordion'){FLOW.ensure(mock);mock.config.presentation='accordion';}
 if(x.layout==='grid3')mock.layoutColumns={grid3:3};
 if(x.variant&&x.layout==='review')mock.rv.layout=x.variant;
 // Keep visual event previews data-equivalent to the center preview.
 if(mock.layout.startsWith('ev-'))ensureEventUI(mock);
 return mock;
}
// Always render at the 340px central-mobile reference width; the viewport only scales it.
// No percentage-width expansion or type-dependent visual squashing.
function pickerMini(x){
 const mock=pickerMock(x,'minisec');
 return `<div class="am-ed-mini-view" aria-hidden="true"><div class="am-ed-mini-contents">${preview(mock)}</div></div>`;
}
// Fit the *whole* 340px composition proportionally. The picker tile intentionally
// crops the vertical continuation; the detail/full views display the full content.
const PICKER_REFERENCE_WIDTH=340;
function fitPickerPreviews(){
 document.querySelectorAll('.am-ed-mini-view').forEach(view=>{
   const canvas=view.querySelector('.am-ed-mini-contents');
   if(!canvas)return;
   const scale=Math.min(1,Math.max(0,(view.clientWidth-2)/PICKER_REFERENCE_WIDTH));
   canvas.style.transform=`scale(${scale})`;
 });
 const detail=$('selectedPreview')?.querySelector('.am-ed-detail-canvas');
 const frame=$('selectedPreview')?.querySelector('.am-ed-detail-frame');
 if(detail&&frame){
   const available=Math.max(0,$('selectedPreview').clientWidth-20);
   const scale=Math.min(1,available/PICKER_REFERENCE_WIDTH);
   detail.style.transform=`scale(${scale})`;
   frame.style.height=`${Math.ceil(detail.scrollHeight*scale)}px`;
 }
}
window.addEventListener('resize',()=>{if($('typeDialog').open)fitPickerPreviews()});

function renderPicker(){
 const query=$('pickerSearch').value.trim().toLowerCase();
 const list=PICKER_OPTIONS.filter(x=>(pickerCategory==='전체'||x.category===pickerCategory)&&[x.name,x.description,x.keywords].join(' ').toLowerCase().includes(query));
 $('pickerCats').innerHTML=['전체','상품','안내·이야기','이벤트','후기'].map(c=>`<button type="button" data-picker-cat="${E(c)}" aria-pressed="${c===pickerCategory}">${E(c)}</button>`).join('');
 $('pickerResults').innerHTML=list.map(x=>`<button type="button" class="am-ed-picker-card" data-picker-id="${E(x.id)}" aria-pressed="${pickerSelected===x.id}">${pickerMini(x)}<b>${E(x.name)}</b><small>${E(x.description)}</small></button>`).join('')||'<p class="am-ed-note">검색 결과가 없어요.</p>';
 $('pickerCount').textContent=`선택 가능한 형태 ${list.length}개 · 기본 구좌 ${CATALOG.length}종`;
 const x=PICKER_OPTION(pickerSelected);
 $('selectedType').textContent=x?.name||'선택해 주세요';$('selectedDesc').textContent=x?.description||'';
 if(x){const mock=pickerMock(x,'sample');$('selectedPreview').innerHTML=`<div class="am-ed-detail-frame"><div class="am-ed-detail-canvas">${preview(mock)}</div></div>`;}else $('selectedPreview').innerHTML='';
 requestAnimationFrame(fitPickerPreviews);
 $('impactNote').textContent=pickerMode==='change'?'제목·설명·버튼·상품·후기·레퍼런스는 그대로 두고 모양만 바꿔요.':'고른 구좌 바로 아래에 넣어요.';
}
function openPicker(mode){
 pickerMode=mode;pickerCategory='전체';$('pickerSearch').value='';pickerSelected=mode==='change'?pickerIdFor(section()):'benefit';
 $('pickerTitle').textContent=mode==='change'?'구좌 유형 변경':'구좌 추가';$('pickerApply').textContent=mode==='change'?'유형 변경':'구좌 추가';
 renderPicker();$('typeDialog').showModal();requestAnimationFrame(fitPickerPreviews);
}
$('addSection').addEventListener('click',()=>openPicker('add'));
$('changeLayout').addEventListener('click',()=>openPicker('change'));
$('pickerCats').addEventListener('click',e=>{const b=e.target.closest('[data-picker-cat]');if(b){pickerCategory=b.dataset.pickerCat;renderPicker()}});
$('pickerResults').addEventListener('click',e=>{const b=e.target.closest('[data-picker-id]');if(b){pickerSelected=b.dataset.pickerId;renderPicker()}});
$('pickerSearch').addEventListener('input',renderPicker);
$('pickerZoom').addEventListener('click',()=>{
 const opt=PICKER_OPTION(pickerSelected);
 if(!opt)return;
 $('fullPreviewName').textContent=opt.name;
 $('pickerFullPreview').innerHTML=preview(pickerMock(opt,'fullscreen-preview'));
 $('fullPreviewDialog').showModal();
});
$('pickerFullClose').addEventListener('click',()=>$('fullPreviewDialog').close());

$('pickerClose').addEventListener('click',()=>$('typeDialog').close());$('pickerCancel').addEventListener('click',()=>$('typeDialog').close());
$('pickerApply').addEventListener('click',()=>{
 const before=capture(),x=PICKER_OPTION(pickerSelected);if(!x)return;let ftNote='';
 if(pickerMode==='add'){
  let i=sections.findIndex(a=>a.id===current);
  const fresh=makeSection(x.layout,'s_'+Date.now().toString(36),x.layout==='review'?'후기 모음':x.variantKind==='tabs'?'탭별 추천':x.name,x.description);
  if(x.variantKind==='product')fresh.productView=x.variant;
  if(x.variantKind==='tabs')ftSplit(fresh);
   if(x.variantKind==='accordion'){FLOW.ensure(fresh);fresh.config.presentation='accordion';}
   if(x.variant&&x.layout==='review')fresh.rv.layout=x.variant;
  fresh.ctaOn=['hero','ev-coupon'].includes(fresh.layout);fresh.cta='자세히 보기';
  sections.splice(i+1,0,fresh);current=fresh.id;
 } else {
  const s=section(),old=s.layout;
  if(old===x.layout&&x.variantKind==='tabs'){}   // 탭은 아래에서
  else if(old===x.layout&&x.variantKind==='product'){s.productView=x.variant;}
   else if(old===x.layout&&x.variantKind==='accordion'){FLOW.ensure(s);s.config.presentation='accordion';}
   else if(old===x.layout&&['notice','timeline'].includes(old)){FLOW.ensure(s);s.config.presentation='plain';}
   else if(old==='review'&&x.layout==='review'){
   // The review type is unchanged: only switch its internal visual layout.
   s.rv.layout=x.variant||'cards';
  } else {
   const def=makeSection(x.layout,s.id,x.name,x.description);
   s.variants=s.variants||{};
   s.variants[old]={items:clone(s.items),ev:clone(s.ev),rv:clone(s.rv),custom:clone(s.custom||{})};
   s.layout=x.layout; /* preserve prior title, subtitle, copy, CTA and notes */
   if(s.variants[x.layout])Object.assign(s,clone(s.variants[x.layout]));
   else {s.items=def.items;s.ev=def.ev;s.rv=def.rv;if(x.layout==='custom')s.custom=def.custom||{};}
   if(x.layout==='review'&&x.variant)s.rv.layout=x.variant;
    if(x.variantKind==='product')s.productView=x.variant;
    if(x.variantKind==='accordion'){FLOW.ensure(s);s.config.presentation='accordion';}
   if(!s.ctaStyleModified)s.ctaStyle=CTA_DEFAULTS[x.layout]||s.ctaStyle;
  }
  if(x.variantKind==='tabs'&&!ftOn(s))ftSplit(s);
  if(!FTAB_LAYOUTS.includes(s.layout)&&s.ftabs?.length){ftDrop(s);ftNote=' · 이 유형은 탭을 쓰지 않아 탭을 없앴어요 (실행 취소 가능)';}
 }
 FLOW.setView(section(),x.layout==='ev-quiz'?'q:0':'before');
 tab=(x.layout==='review'?'review':'copy');mark(before);$('typeDialog').close();renderAll();saveDemo();
 toast((pickerMode==='add'?'구좌를 추가했어요': '구좌 구성을 변경했어요')+ftNote);
});
$('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);
$('exportDemo').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({notice:'AMOREAD 구좌 편집기 기록용 JSON (자사몰 설정에 바로 넣지 않아요)',...serialize()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='amoread-lab-demo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('exportHandoff').addEventListener('click',()=>{const css=document.querySelector('link[href="tokens.demo.css"]');window.AM_CB_STATIC_EXPORT=true;const markup=sections.map(s=>{
  FLOW.ensure(s);
  if(s.layout!=='ev-quiz')return preview(s);
  const previous=FLOW.getView(s),oldSimulation=FLOW.simulation.get(s.id);
  FLOW.simulation.delete(s.id);
  const results=s.ev.ui.quiz.results||[];
  const pages=results.map((r,i)=>{FLOW.setView(s,'r:'+i);return '<div class="cb-handoff-step"><h4>퀴즈 결과 '+(i+1)+' / '+results.length+'</h4>'+preview(s)+'</div>'}).join('');
  FLOW.setView(s,previous);
  if(oldSimulation)FLOW.simulation.set(s.id,oldSimulation);
  return pages;
 }).join('');window.AM_CB_STATIC_EXPORT=false;const safeTitle='AMOREAD 디자이너 인계용 기획안 초안';const content='<!doctype html><html lang="ko"><meta charset="utf-8"><title>'+safeTitle+'</title><style>body{font-family:system-ui, sans-serif;margin:30px auto;max-width:540px;line-height:1.5}section{margin:18px 0;padding:22px;border:1px solid #dcdcdc;border-radius:12px}h3,p{white-space:pre-wrap}small{display:block} .mock-event,.mock-product,.mock-review-card,.mock-item{padding:15px;border:1px solid #ddd;margin:8px 0} .mock-image,.am-flow-img-ghost{background:#f1f3f0;padding:30px;text-align:center} .mock-ev-answer,.mock-cta{display:block;padding:10px;border:1px solid #ddd;margin:6px 0} .mock-ev-wheel{border:2px solid #aaa;border-radius:100px;min-height:150px} .mock-ev-wheel-label{display:inline-block;padding:8px} .mock-product-media{position:relative;overflow:hidden;border-radius:8px} .mock-product-media .mock-product-image{min-height:90px;background:#eee;display:grid;place-items:center} .mock-card-label--corner{position:absolute;background:#141414;color:#fff;padding:4px 6px;border-radius:4px;font-size:10px} .mock-card-label--corner.top-left{top:6px;left:6px}.mock-card-label--corner.top-right{top:6px;right:6px}.mock-card-label--corner.bottom-left{bottom:6px;left:6px}.mock-card-label--corner.bottom-right{bottom:6px;right:6px} .am-custom-frame{border:1px dashed #a1aaa4;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:9px;background:#fafafa;min-height:var(--am-custom-height,0)}.am-custom-frame--medium{min-height:var(--am-custom-height,210px)}.am-custom-frame--short{min-height:var(--am-custom-height,160px)}.am-custom-frame--auto{min-height:var(--am-custom-height,0)}.am-custom-art-placeholder{min-height:130px;border:1px dashed #bbb;background:#f2f2f2;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px}.am-custom-frame--tall{min-height:var(--am-custom-height,350px)}.am-custom-reference-image{width:100%;max-height:630px;object-fit:contain}.am-custom-ref-link{color:#007a46;overflow-wrap:anywhere}.am-custom-chip{font-size:10px;border:1px solid #ddd;border-radius:4px;padding:3px 6px}.am-custom-meta{display:flex;gap:7px}.am-custom-annotation{border:1px solid #eee;padding:8px;background:white}.am-custom-annotation p,.am-custom-intent{white-space:pre-wrap}.cb-node{padding:10px;border:1px solid #d5dad6;margin:8px 0;border-radius:7px}.cb-image{background:#f1f3f0;padding:30px;text-align:center}.cb-cta{padding:10px;border:1px solid #222;text-align:center}.cb-group{display:grid;gap:10px}.cb-direction-row,.cb-direction-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cb-text{white-space:pre-line}.cb-review,.cb-benefit{padding:8px}.am-flow-issue{padding:5px;border-bottom:1px solid #ccc}@media print{section{break-inside:avoid}}</style><h1>'+safeTitle+'</h1><p>AMOREAD 구좌 기획 미리보기예요. 실제 자사몰 화면이 아니며 가격·후기는 기획안 기준 값이에요.</p>'+markup+'</html>';const imageStyle=(()=>{try{const sheet=[...document.styleSheets].find(x=>x.href&&x.href.endsWith('/image-layout-v110.css'));return sheet?[...sheet.cssRules].map(x=>x.cssText).join('\n'):''}catch{return ''}})();const handoffHtml=content.replace('</style>',imageStyle+'</style>');const blob=new Blob([handoffHtml],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='amoread-demo-handoff.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('reset').addEventListener('click',()=>{const before=capture();sections=defaults();current='s3';tab='copy';cbSelected=null;cbRailMode='sections';iaSelectedChild=null;iaGroup='content';REVIEWS=JSON.parse(seedReviews);mark(before);renderAll();toast('예시로 되돌렸어요')});
document.addEventListener('keydown',e=>{
 // Selecting a card attribute in the canvas moves focus to its own visibility toggle in the inspector
 // (.am-inspector-target). Delete there still means "remove the canvas selection", which is the same as unchecking it.
 const targetToggle=!!(e.target.matches?.('input[type=checkbox]')&&e.target.closest('.am-inspector-target'));
 const editing=!targetToggle&&e.target.closest('input,textarea,select,[contenteditable="true"]');
 const overlayOpen=!!document.querySelector('dialog[open]');
 const inCanvas=e.target.closest('#page')||targetToggle||e.target===document.body||e.target===document.documentElement;
 if(canvasTarget&&!editing&&!overlayOpen&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&inCanvas&&['Delete','Backspace'].includes(e.key)){
  e.preventDefault();removeCanvasTarget();return;
 }
 if(e.key==='Escape'&&canvasTarget&&!overlayOpen&&!editing){canvasTarget=null;cbSelected=null;iaSelectedChild=null;renderAll();return;}
 if(e.key.toLowerCase()==='z'&&(e.ctrlKey||e.metaKey)&&!editing){e.preventDefault();e.shiftKey?redo():undo()}
 else if(e.key.toLowerCase()==='y'&&(e.ctrlKey||e.metaKey)&&!editing){e.preventDefault();redo()}
});
// Production-facing data injection contract. The host must normalize records
// and decide authentication, authorization, API transport, and save semantics.
// 레퍼런스 붙이기 동작 (refsPanel·refsFinder 참고)
$('data-library').addEventListener('click',e=>{
 const b=e.target.closest('[data-ref-pick]');if(!b)return;
 const r=REF_SHOWN[Number(b.dataset.refPick)];if(r)toggleRef(section(),r);
});
$('data-library').addEventListener('submit',e=>{
 const f=e.target.closest('[data-ref-link]');if(!f)return;e.preventDefault();
 const url=f.elements.url.value.trim(),name=f.elements.name.value.trim();
 if(!/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(url)){toast('https://로 시작하는 주소를 넣어 주세요');f.elements.url.focus();return;}
 let host='';try{host=new URL(url).hostname.replace(/^www\./,'');}catch(_){}
 toggleRef(section(),{id:'link-'+Date.now().toString(36),name:name||host||'링크',from:'링크'+(host?' · '+host:''),url},true);
});
// 상품 찾기: 다시 그리지 않고 줄만 숨긴다 (입력 중 커서 유지). 고른 상품은 늘 보인다
$('panel-body').addEventListener('input',e=>{
 const q=e.target.closest('[data-prod-q]');if(!q)return;e.stopPropagation();PROD_Q=q.value;const w=PROD_Q.trim().toLowerCase();
 let n=0;   // 찾는 말을 지우면 다시 '고른 것 + 앞 10개'
 $('panel-body').querySelectorAll('.am-ed-product-row').forEach(r=>{const on=!!r.querySelector('input:checked');r.hidden=w?!r.dataset.prodName.includes(w)&&!on:!on&&!PROD_ALL&&n++>=10;});
 const more=$('panel-body').querySelector('[data-prod-all]');if(more)more.hidden=!!w;
},true);
$('panel-body').addEventListener('click',e=>{
 if(e.target.closest('[data-prod-all]')){PROD_ALL=true;renderPanel();return;}
 const nt=e.target.closest('[data-need-tab]');
 if(nt){tab=nt.dataset.needTab;renderPanel();$('panel-body').querySelector('input,button,select')?.focus();return;}
 if(e.target.closest('[data-ref-find]')){cbRailMode='data';iaDataMode='refs';renderAll();$('data-library').querySelector('[data-ref-pick],#refLinkUrl')?.focus();return;}
 const rm=e.target.closest('[data-ref-remove]');
 if(rm){const s=section(),r=(s.refs||[])[Number(rm.dataset.refRemove)];if(r)toggleRef(s,r);}
});
window.AMOREAD_EDITOR_API=Object.freeze({
 version:'1.12',
 // 레퍼런스 목록 공급: fn(section 복사본) → Promise<[{id,name,from,url,why,group}]>. onPick(ref, added, section)은 붙이거나 뺄 때
 setRefSource(fn,opts={}){REF_SOURCE=typeof fn==='function'?fn:null;REF_ON_PICK=typeof opts.onPick==='function'?opts.onPick:null;for(const k of Object.keys(REF_CACHE))delete REF_CACHE[k];renderAll();},
 exportSnapshot:()=>JSON.parse(capture()),
 importSnapshot(input){
  const value=typeof input==='string'?JSON.parse(input):input;
  if(!value||!Array.isArray(value.sections)||!value.sections.length
     ||!value.sections.every(s=>s&&typeof s.id==='string'&&LAYOUTS[s.layout]))
   throw new TypeError('AMOREAD snapshot must have valid section ids and layout types');
  const detached=JSON.parse(JSON.stringify(value));
  sections=detached.sections;
  current=sections.some(s=>s.id===detached.current)?detached.current:sections[0].id;
  tab=typeof detached.tab==='string'?detached.tab:'copy';
  cbSelected=null;canvasTarget=null;iaSelectedChild=null;
  undoStack=[];redoStack=[];renderAll();saveDemo();
 },
 // One-way conversion of the app's existing editor data (page.sections) into a v1.12 snapshot.
 // Returns a new snapshot and never mutates the input. Products are kept only when present in the
 // current catalog (call setCatalog first). Unknown layout ids become 'hero' like the existing editor.
 fromLegacyPage(page){
  const list=(Array.isArray(page?.sections)?page.sections:[]).filter(x=>x&&typeof x==='object').slice(0,40);
  const used=new Set(),str=(v,n)=>String(v??'').slice(0,n);
  const out=list.map((x,i)=>{
   const layout=LAYOUTS[x.layoutId]?x.layoutId:'hero';
   let id=/^[A-Za-z0-9_-]{1,40}$/.test(x.sectionId||'')?x.sectionId:'s'+(i+1);
   while(used.has(id))id+='_'+(i+1);used.add(id);
   const s=makeSection(layout,id,str(x.headline||x.name,120),str(x.subhead,400));
   const v=x.v2&&typeof x.v2==='object'?x.v2:{};
   s.cta=str(x.cta,40);s.ctaOn=!!(v.ctaOn||x.cta);s.ctaTo=str(v.ctaTo,60);s.cat=str(x.zone_tag,40);
   s.notes=str(x.designNotes,2000);s.scope=str(v.scope,200);s.num=!!v.num;
   s.lines=(Array.isArray(v.lines)?v.lines:[]).slice(0,10).map(l=>({text:str(l?.text,120)}));
   const seqs=[...new Set((Array.isArray(x.slots)?x.slots:[]).map(sl=>String(sl?.seq??'')))].filter(seq=>PRODUCTS.some(p=>p.id===seq));
   if(['grid2','grid3','feat','deal-banner'].includes(layout)){s.productIds=seqs;s.slotCount=Math.min(40,(Array.isArray(x.slots)?x.slots:[]).filter(sl=>sl&&!(Array.isArray(sl.items)&&sl.items.length)).length);}
   // 붙인 레퍼런스(v2.att: 예전 편집기와 같은 형식) → 편집기의 refs
   s.refs=(Array.isArray(v.att)?v.att:[]).slice(0,8).filter(a=>a&&a.ref).map(a=>({id:str(a.ref,80),name:str(a.name||'레퍼런스',60),from:str([a.from,a.page].filter(Boolean).join(' · '),80),url:/^https?:\/\//.test(a.url||'')?str(a.url,300):'',attached:true,note:str(a.note,120)}));
   // 탭(필터) 구좌: 탭마다 상품을 나눠 둔다 (plans/28). 칸의 tabId가 없거나 없는 탭이면 첫 탭. 같은 상품이 여러 탭에 있어도 된다
   const ftIn=(Array.isArray(x.tabs)?x.tabs:[]).filter(t=>t&&/^[A-Za-z0-9_-]{1,40}$/.test(t.tabId||'')).slice(0,12);
   if(FTAB_LAYOUTS.includes(layout)&&ftIn.length){
    const ids=new Set(ftIn.map(t=>t.tabId)),tabOf=sl=>ids.has(sl?.tabId)?sl.tabId:ftIn[0].tabId;
    s.ftabs=ftIn.map(t=>({id:t.tabId,label:str(t.label,40),zone:str(t.zone_tag,40),
     productIds:[...new Set((Array.isArray(x.slots)?x.slots:[]).filter(sl=>tabOf(sl)===t.tabId).map(sl=>String(sl?.seq??'')))].filter(seq=>PRODUCTS.some(p=>p.id===seq))}));
    s.ftabCur=s.ftabs[0].id;s.productIds=s.ftabs[0].productIds.slice();   // 처음엔 첫 탭을 본다
   }
   const card=v.card;
   if(card&&Array.isArray(card.order)&&card.order.length===ORDER.length&&ORDER.every(k=>card.order.includes(k)))s.card.order=card.order.slice();
   if(card&&card.on&&typeof card.on==='object')for(const k of ORDER)if(k in card.on)s.card.on[k]=card.on[k]?1:0;
   if(card&&card.def&&typeof card.def==='object')for(const k of ['label','pill','pillText','tag','copy','btn'])if(typeof card.def[k]==='string'&&card.def[k])s.card.def[k]=card.def[k];
   return s;
  });
  if(!out.length)out.push(makeSection('hero','s1'));
  return {sections:out,current:out[0].id,tab:'copy'};
 },
 setCatalog({products,reviews,note}={}){
  if(note!==undefined)CATALOG_NOTE=note?String(note).slice(0,200):null;
  if(products!==undefined){
   if(!Array.isArray(products)||products.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'
       ||!Number.isFinite(p.listPrice)||p.listPrice<=0))
    throw new TypeError('products must be normalized {id,name,listPrice,...} records');
   // Do not replace the array binding: the editor's existing selectors share it.
   PRODUCTS.splice(0,PRODUCTS.length,...JSON.parse(JSON.stringify(products)).map(p=>({
    ...p,rate:Number(p.rate)||0,extraRate:Number(p.extraRate)||0,
    rating:Number(p.rating)||0,reviews:Number(p.reviews)||0,
    quote:String(p.quote||''),appeal:String(p.appeal||'')
   })));
  }
  if(reviews!==undefined){
   if(!Array.isArray(reviews)||reviews.some(r=>!r||typeof r.id!=='string'||typeof r.productId!=='string'))
    throw new TypeError('reviews must be normalized {id,productId,...} records');
   REVIEWS=JSON.parse(JSON.stringify(reviews));
  }
  renderAll();
 },
 subscribe(callback){
  if(typeof callback!=='function')throw new TypeError('subscribe requires a callback');
  hostSubscribers.add(callback);
  return ()=>hostSubscribers.delete(callback);
 }
});
loadDemo();renderAll();

})();
