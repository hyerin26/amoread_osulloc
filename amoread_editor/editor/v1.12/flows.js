/* AMOREAD Flow Specification Engine v1.2 — local demonstration data only.
   Additive to v1.1: never writes to APIs or modifies original Green UI tokens. */
window.AMFlow=(()=>{
 'use strict';
 const esc=s=>window.AMEditorUI.escape(String(s??''));
 const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
 const f=(key,label,val,o={})=>window.AMEditorUI.field(key,label,val,o);
 const c=(key,values,val)=>window.AMEditorUI.choices(key,values,val);
 const b=(text,action,extra='')=>`<button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm ${extra}" data-flow="${esc(action)}">${esc(text)}</button>`;
 const select=(key,label,value,opts,help='')=>`<div class="am-ed-field"><label class="am-ed-label" for="ed-${esc(key.replace(/\W/g,'-'))}">${esc(label)}</label><select id="ed-${esc(key.replace(/\W/g,'-'))}" class="am-ed-input" data-bind="${esc(key)}">${opts.map(([v,l])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>${help?`<small class="am-ed-support">${esc(help)}</small>`:''}</div>`;
 const label='am-ed-label';
 const views=new Map(); const editQs=new Map();const editRs=new Map();const simulation=new Map();
 const getView=s=>views.get(s.id)||(s.layout==='ev-quiz'?'q:0':'before');
 const setView=(s,v)=>{views.set(s.id,v);simulation.delete(s.id)};
 const defaultQuiz=old=>({mode:'type',intro:'나에게 맞는 차를 찾아보세요',introButton:'테스트 시작',questions:[{id:uid('q'),text:old.question||'가장 끌리는 맛은 무엇인가요?',required:true,options:(Array.isArray(old.options)&&old.options.length>=2?old.options:['꽃향과 산뜻함','구수하고 깊은 풍미']).map((x,i)=>({id:uid('o'),text:String(x),resultId:i%2?'result_b':'result_a',score:i%2?2:0}))}],results:[{id:'result_a',title:'산뜻한 티타임',description:'화사한 향과 가벼운 맛을 좋아하는 취향이에요.',productId:'D001',minScore:0,ctaText:'추천 상품 보기',layout:'product',imageHint:'결과 화면 추천 상품 이미지',ctaUrl:''},{id:'result_b',title:'깊은 티타임',description:'은은하고 구수한 맛을 즐기는 취향이에요.',productId:'D002',minScore:2,ctaText:'추천 상품 보기',layout:'product',imageHint:'결과 화면 추천 상품 이미지',ctaUrl:''}],finishText:'당신의 차 취향을 찾았어요'});
 const baseInfo={
  hero:{imageHint:'상단 히어로 비주얼 · 주제 이미지 요청',imagePosition:'background',height:'large'},
  split:{imageHint:'좌우 분할용 대표 이미지',imagePosition:'left',ratio:'half'},
  'text-cta':{align:'center',emphasis:'lead'},
  benefit:{columns:'2',badge:'혜택',footnote:'혜택별 적용 조건을 확인해주세요'},
  service:{columns:'2',imagePosition:'top',presentation:'plain',footnote:'일부 상품은 제공 조건이 다를 수 있습니다'},
  story:{columns:'1',imagePosition:'alternate',imageHint:'각 단락별 이미지 자리',footnote:''},
  detail:{columns:'1',imagePosition:'left',footnote:'상품별 특징을 확인해주세요'},
  timeline:{columns:'1',density:'comfortable',presentation:'plain',footnote:'일정은 운영 상황에 따라 변경될 수 있습니다'},
  notice:{density:'comfortable',presentation:'plain',footnote:''},
  countdown:{endAt:'2026-11-30T23:59',expiredLabel:'프로모션이 종료되었습니다',after:'hide-cta'},
  'deal-banner':{endAt:'2026-11-30T23:59',expiredLabel:'오늘의 특가가 종료되었습니다',after:'hide-cta'}
 };
 const eventExtra={
  'ev-share':{shareUrl:'',verification:'unconfirmed',successTitle:'공유해주셔서 감사합니다',successText:'참여 인정 조건은 운영 담당자 확인이 필요합니다',previewStage:'before'},
  'ev-ugc':{minImages:'1',maxImages:'3',maxChars:'200',moderation:'manual',successTitle:'제출이 접수되었습니다',rejectedText:'검수 기준에 맞게 다시 제출해주세요',previewStage:'before'},
  'ev-stamp':{policy:'daily',rewards:[{id:'reward_1',day:'3',title:'3일 출석 보상'},{id:'reward_2',day:'7',title:'7일 출석 보상'}],successTitle:'출석 완료!',previewStage:'before'},
  'ev-draw':{prizes:[{id:'prize_1',label:'티 샘플러',quantity:'20',resultText:'당첨을 축하합니다'},{id:'prize_2',label:'할인 쿠폰',quantity:'100',resultText:'쿠폰을 확인해주세요'}],loseLabel:'아쉽지만 다음 기회에',repeat:'once',previewStage:'before'},
  'ev-coupon':{couponCode:'',minOrder:'',issueLimit:'1',expireDate:'2026-12-31',alreadyIssued:'이미 발급받은 쿠폰입니다',successTitle:'쿠폰 발급 완료',previewStage:'before'}
 };
 const deep=v=>JSON.parse(JSON.stringify(v));
 function ensure(s){
   if(!s||!s.layout)return;
   if(s.layout==='ev-quiz'){
     s.ev=s.ev||{};s.ev.ui=s.ev.ui||{};
     if(!s.ev.ui.quiz||!Array.isArray(s.ev.ui.quiz.questions))s.ev.ui.quiz=defaultQuiz(s.ev.ui);
     const q=s.ev.ui.quiz;
     if(!Array.isArray(q.results)||!q.results.length)q.results=defaultQuiz(s.ev.ui).results;
     q.questions=q.questions||[];q.mode=q.mode||'type';q.results.forEach(r=>{if(!r.layout)r.layout='product';if(r.imageHint===undefined)r.imageHint='';if(r.ctaUrl===undefined)r.ctaUrl=''});
     // Keep legacy fields intact to preserve older v1.1 JSON exports.
   }
   if(eventExtra[s.layout]){
     s.ev=s.ev||{};s.ev.ui=s.ev.ui||{};
     for(const [k,v] of Object.entries(eventExtra[s.layout])) if(s.ev.ui[k]===undefined)s.ev.ui[k]=deep(v);
   }
   if(baseInfo[s.layout]){
     s.config=s.config||{};for(const [k,v] of Object.entries(baseInfo[s.layout]))if(s.config[k]===undefined)s.config[k]=v;
   }
 }
 function quiz(s){ensure(s);return s.ev.ui.quiz}
 function questionIdx(s){const q=quiz(s);const i=q.questions.findIndex(x=>x.id===editQs.get(s.id));return Math.max(0,i);}
 function resultIdx(s){const q=quiz(s);const i=q.results.findIndex(x=>x.id===editRs.get(s.id));return Math.max(0,i)}
 function quizPanel(s){
  const q=quiz(s);const qi=questionIdx(s),ri=resultIdx(s),question=q.questions[qi],result=q.results[ri];
  const nav=`<div class="am-flow-stage" role="group" aria-label="퀴즈 미리보기 단계">${[['intro','시작 화면'],...q.questions.map((x,i)=>['q:'+i,`질문 ${i+1}`]),...q.results.map((x,i)=>['r:'+i,`결과 ${i+1}`])].map(([v,title])=>`<button type="button" data-flow-view="${esc(v)}" aria-pressed="${getView(s)===v}">${esc(title)}</button>`).join('')}</div>`;
  const qlist=`<div class="am-flow-itemlist">${q.questions.map((it,i)=>`<button type="button" class="am-flow-navitem" data-flow="editQuestion:${i}" aria-pressed="${qi===i}"><span>Q${i+1}</span><strong>${esc(it.text||'새 질문')}</strong><small>${it.options.length}개 선택지</small></button>`).join('')}</div>`;
  const questionControls=question?`<div class="am-flow-card am-flow-card--active"><div class="am-flow-card-top"><strong>질문 ${qi+1} / ${q.questions.length}</strong><div class="am-flow-actions">${b('↑',`moveQuestion:${qi}:-1`)}${b('↓',`moveQuestion:${qi}:1`)}${b('복제',`cloneQuestion:${qi}`)}${b('삭제',`removeQuestion:${qi}`)}</div></div>
  ${f(`ev.ui.quiz.questions.${qi}.text`,'질문 문구',question.text,{area:true,rows:2,max:180})}
  <div class="am-flow-stack-label">답변 선택지 <small>2~6개 · 순서 변경 가능</small></div>
  ${question.options.map((o,i)=>`<div class="am-flow-option-editor"><div class="am-flow-option-index">${String.fromCharCode(65+i)}</div><div class="am-flow-option-body">${f(`ev.ui.quiz.questions.${qi}.options.${i}.text`,'선택지 문구',o.text,{max:120})}${q.mode==='type'?select(`ev.ui.quiz.questions.${qi}.options.${i}.resultId`,'연결 결과',o.resultId,q.results.map(r=>[r.id,r.title])):select(`ev.ui.quiz.questions.${qi}.options.${i}.score`,'점수',o.score,[[0,'0점'],[1,'1점'],[2,'2점'],[3,'3점'],[4,'4점'],[5,'5점']])}</div><div class="am-flow-stack-actions">${b('↑',`moveAnswer:${qi}:${i}:-1`)}${b('↓',`moveAnswer:${qi}:${i}:1`)}${b('×',`removeAnswer:${qi}:${i}`)}</div></div>`).join('')}
 ${b('+ 선택지 추가',`addAnswer:${qi}`)}
 </div>`:'<div class="am-ed-note">질문을 추가해주세요.</div>';
 const rlist=`<div class="am-flow-itemlist">${q.results.map((it,i)=>`<button type="button" class="am-flow-navitem" data-flow="editResult:${i}" aria-pressed="${ri===i}"><span>R${i+1}</span><strong>${esc(it.title||'새 결과')}</strong><small>${q.mode==='score'?`${it.minScore}점 이상`:'유형별 결과'}</small></button>`).join('')}</div>`;
 const rcontrols=result?`<div class="am-flow-card am-flow-card--active"><div class="am-flow-card-top"><strong>결과 ${ri+1} / ${q.results.length}</strong>${b('결과 삭제',`removeResult:${ri}`)}</div>${f(`ev.ui.quiz.results.${ri}.title`,'결과 제목',result.title,{max:100})}${f(`ev.ui.quiz.results.${ri}.description`,'결과 설명',result.description,{area:true,rows:3,max:300})}${select(`ev.ui.quiz.results.${ri}.productId`,'추천 상품 (선택)',result.productId,[['','추천 상품 없음'],...window.AM_PRODUCT_DEMO.map(p=>[p.seq,p.name])])}${select(`ev.ui.quiz.results.${ri}.layout`,'결과 화면 구성',result.layout,[['product','추천 상품 카드형'],['editorial','스토리·설명 중심형'],['coupon','혜택·쿠폰 안내형']])}${f(`ev.ui.quiz.results.${ri}.imageHint`,'이미지/비주얼 요청',result.imageHint,{max:160,area:true,rows:2,optional:true})}${f(`ev.ui.quiz.results.${ri}.ctaText`,'결과 CTA 문구',result.ctaText,{max:40})}${f(`ev.ui.quiz.results.${ri}.ctaUrl`,'결과 CTA 목적지 URL (선택)',result.ctaUrl,{max:200,optional:true})}${q.mode==='score'?select(`ev.ui.quiz.results.${ri}.minScore`,'최소 점수',result.minScore,Array.from({length:31},(_,i)=>[i,String(i)+'점']), '점수 기준 이상에서 가장 높은 조건의 결과를 표시합니다.'):''}</div>`:'';
 return `<div class="am-flow-guidance"><strong>질문 → 답변 → 결과까지 설계</strong><p>현재 화면은 고객용 운영 기능이 아닌 디자이너 인계용 플로우 설계입니다. 실제 운영·상품 추천 자동화는 사내 확인이 필요합니다.</p></div>
 <div class="am-flow-subtitle">미리보기 화면 이동</div>${nav}
 <div class="am-ed-field"><span class="${label}">결과 결정 방식</span>${c('ev.ui.quiz.mode',[['type','선택지별 결과 유형'],['score','답변 점수 합산']],q.mode)}</div>
 ${f('ev.ui.quiz.intro','시작 화면 설명',q.intro,{area:true,rows:2,max:180})}${f('ev.ui.quiz.introButton','시작 버튼',q.introButton,{max:40})}
 <div class="am-flow-section-head"><strong>질문 구성 <small>${q.questions.length}개</small></strong>${b('+ 질문 추가','addQuestion')}</div>${qlist}${questionControls}
 <div class="am-flow-section-head"><strong>결과 화면 <small>${q.results.length}개</small></strong>${b('+ 결과 추가','addResult')}</div>${rlist}${rcontrols}
 ${f('ev.ui.quiz.finishText','결과 화면 상단 문구',q.finishText,{max:140})}
 <div class="am-flow-sim-panel"><b>답 흐름 미리 해 보기</b><p>문항마다 답을 고르면 정한 대로 결과 화면까지 넘어가요. 실제로 응모되거나 저장되지는 않아요.</p>${b('▶ 답변 흐름 시험','simStart','am-ed-button--primary')}${simulation.has(s.id)?b('미리보기 초기화','simReset'):''}</div>`;
 }
 function otherPanel(s){ensure(s);const u=s.ev.ui;
 if(s.layout==='ev-share')return `<div class="am-flow-guidance">공유할 콘텐츠 · 공유 후 상태 · 참여 인정 조건을 분리해 지정하세요.</div>${f('ev.ui.shareUrl','공유 대상 URL',u.shareUrl,{max:240,optional:true})}${select('ev.ui.verification','공유 완료 확인 방식',u.verification,[['unconfirmed','수동 확인 / 미정'],['click','공유 버튼 클릭 기준'],['url','공유 링크 방문 확인(추후 구현)']])}${f('ev.ui.successTitle','공유 후 완료 문구',u.successTitle,{max:80})}${f('ev.ui.successText','완료 상태 안내',u.successText,{area:true,rows:2,max:160})}${stageChoices(s,['before','after'])}`;
 if(s.layout==='ev-ugc')return `<div class="am-flow-guidance">입력 조건과 제출 완료·검수·반려 상태를 모두 설계합니다. 실제 업로드는 하지 않습니다.</div>${select('ev.ui.minImages','최소 이미지 수',u.minImages,[[0,'0장'],[1,'1장'],[2,'2장'],[3,'3장']])}${select('ev.ui.maxImages','최대 이미지 수',u.maxImages,[[1,'1장'],[2,'2장'],[3,'3장'],[4,'4장'],[5,'5장']])}${select('ev.ui.maxChars','댓글 최대 글자 수',u.maxChars,[[100,'100자'],[200,'200자'],[500,'500자']])}${select('ev.ui.moderation','승인 정책',u.moderation,[['manual','관리자 수동 검수'],['auto','자동 접수 후 별도 검수'],['none','승인 없이 완료(검증 필요)']])}${f('ev.ui.successTitle','제출 완료 안내',u.successTitle,{max:80})}${f('ev.ui.rejectedText','반려 안내',u.rejectedText,{max:140})}${stageChoices(s,['before','pending','rejected'])}`;
 if(s.layout==='ev-stamp')return `<div class="am-flow-guidance">누적 출석·중복 참여 정책 및 달성 단계별 보상을 설계합니다.</div>${select('ev.ui.policy','출석 인정 규칙',u.policy,[['daily','하루 1회'],['consecutive','연속 출석'],['total','기간 내 누적']])}${f('ev.ui.successTitle','출석 완료 문구',u.successTitle,{max:80})}<div class="am-flow-section-head"><strong>스탬프 달성 보상</strong>${b('+ 보상 단계','addStampReward')}</div>${u.rewards.map((r,i)=>`<div class="am-flow-pair">${f(`ev.ui.rewards.${i}.day`,'달성 일수',r.day,{max:3,type:'number'})}${f(`ev.ui.rewards.${i}.title`,'보상 안내',r.title,{max:80})}${b('삭제',`removeStampReward:${i}`)}</div>`).join('')}${stageChoices(s,['before','after','reward'])}`;
 if(s.layout==='ev-draw')return `<div class="am-flow-guidance">당첨 결과별 내용만 적어요. 확률과 추첨은 실제 페이지에서 따로 정해요.</div>${select('ev.ui.repeat','참여 제한 (초안)',u.repeat,[['once','계정당 1회'],['daily','하루 1회'],['none','반복 제한 미정']])}<div class="am-flow-section-head"><strong>경품과 당첨 결과</strong>${b('+ 경품', 'addPrize')}</div>${u.prizes.map((r,i)=>`<div class="am-flow-card">${f(`ev.ui.prizes.${i}.label`,'경품명',r.label,{max:80})}${f(`ev.ui.prizes.${i}.quantity`,'수량 · 기획 입력',r.quantity,{max:8,type:'number'})}${f(`ev.ui.prizes.${i}.resultText`,'당첨 화면 문구',r.resultText,{max:140})}${b('경품 삭제',`removePrize:${i}`)}${b('이 결과 미리보기',`viewPrize:${i}`)}</div>`).join('')}${f('ev.ui.loseLabel','미당첨 화면 문구',u.loseLabel,{max:120})}${stageChoices(s,['before','win','lose'])}<div class="am-ed-note am-ed-note--warning">당첨 확률·물량은 운영팀과 정한 뒤 적어 주세요.</div>`;
 if(s.layout==='ev-coupon')return `<div class="am-flow-guidance">쿠폰 발급 전·완료·중복 발급·기간 종료 화면을 설계합니다.</div>${f('ev.ui.couponCode','쿠폰 코드 / 식별자 (선택)',u.couponCode,{max:80,optional:true})}${f('ev.ui.minOrder','최소 주문 금액 (선택)',u.minOrder,{max:20,optional:true})}${select('ev.ui.issueLimit','발급 제한',u.issueLimit,[[1,'계정당 1장'],[2,'계정당 2장'],[3,'계정당 3장'],[0,'운영 정책 미정']])}${f('ev.ui.expireDate','사용 마감일 (YYYY-MM-DD)',u.expireDate,{max:20})}${f('ev.ui.successTitle','발급 완료 문구',u.successTitle,{max:90})}${f('ev.ui.alreadyIssued','중복 발급 안내',u.alreadyIssued,{max:90})}${stageChoices(s,['before','issued','duplicate','expired'])}`;
 return '';
 }
 const stageLabels={before:'참여 전',after:'참여 완료',pending:'접수·검수 중',rejected:'반려',reward:'보상 달성',win:'당첨',lose:'미당첨',issued:'발급 완료',duplicate:'기발급',expired:'기간 종료'};
 function stageChoices(s,opts){return `<div class="am-ed-field"><span class="am-ed-label">중앙 와이어프레임 상태 보기</span><div class="am-flow-stage">${opts.map(st=>`<button type="button" data-flow-view="${st}" aria-pressed="${getView(s)===st}">${stageLabels[st]}</button>`).join('')}</div></div>`}
 function footer(s){const e=s.ev||{};return `<div class="mock-ev-footer"><div class="mock-ev-meta"><span>${esc(e.when||'운영 기간 미확정')}</span><span>${esc([e.reward,e.rewardText].filter(Boolean).join(' · ')||'보상 조건 미확정')}</span></div>${e.how?`<p>${esc(e.how)}</p>`:''}</div>`}
 function quizRender(s){const q=quiz(s),sim=simulation.get(s.id);let view=sim?sim.stage:getView(s);if(view==='before')view='intro';
  const cover=`<div class="mock-ev-quiz-cover"><div class="mock-ev-quiz-symbol" aria-hidden="true">✦</div><strong>${esc(q.intro||'나만의 취향 찾기')}</strong></div>`;
  if(view==='intro')return `<div class="mock-event mock-event--quiz">${cover}<div class="mock-ev-content"><h4>${esc(q.intro)}</h4><div class="mock-ev-action">${esc(q.introButton||'시작하기')}　→</div></div>${footer(s)}</div>`;
  let ri=view.startsWith('r:')?Math.min(Number(view.split(':')[1]),q.results.length-1):-1;if(sim&&sim.stage==='result')ri=Math.max(0,q.results.findIndex(r=>r.id===sim.resultId));
  if(ri>=0){const r=q.results[ri]||q.results[0];const linkedProduct=window.AM_PRODUCT_DEMO.find(p=>p.seq===r.productId)?.name||'상품 미지정';let content='';if(r.layout==='editorial')content=`<div class="am-flow-result-hero"><div class="am-flow-img-ghost">${esc(r.imageHint||'결과 비주얼 이미지 자리')}</div><p>${esc(r.description)}</p></div>`;else if(r.layout==='coupon')content=`<div class="am-flow-result-coupon"><p>${esc(r.description)}</p></div>`;else content=`<p class="mock-ev-subcopy">${esc(r.description)}</p><div class="am-flow-mock-recommend"><span>${esc(linkedProduct)}</span><small>${esc(r.imageHint||'상품 이미지 자리')}</small></div>`;return `<div class="mock-event mock-event--quiz">${cover}<div class="mock-ev-content"><p class="mock-ev-subcopy">${esc(q.finishText||'')}</p><h4>${esc(r.title)}</h4>${content}${window.AMBlocks?.renderSlot(s,'result:'+r.id+':main',window.AM_BLOCK_CONTEXT?.()||{}, {staticView:!!window.AM_CB_STATIC_EXPORT,showEmpty:!!(window.AM_CB_IS_LIB?.()&&window.AM_CB_CURRENT?.()===s.id&&!window.AM_CB_STATIC_EXPORT)})||''}<div class="mock-ev-action" title="${esc(r.ctaUrl||'목적지 미지정')}">${esc(r.ctaText||'추천 상품 보기')}　→</div></div>${footer(s)}</div>`}
  let i=Math.max(0,Math.min(q.questions.length-1,Number(view.split(':')[1])||0));if(sim&&sim.stage==='question')i=sim.index;
  const question=q.questions[i];const opts=(question?.options||[]).map((o,idx)=>`<div class="mock-ev-answer" ${sim?`data-flow-preview="${esc(o.id)}" role="button" tabindex="0"`:''}><span class="mock-ev-radio">${String.fromCharCode(65+idx)}</span><span>${esc(o.text)}</span><span class="mock-ev-arrow">›</span></div>`).join('');
  return `<div class="mock-event mock-event--quiz">${cover}<div class="mock-ev-content"><div class="mock-ev-step"><span>QUESTION ${String(i+1).padStart(2,'0')} / ${String(q.questions.length).padStart(2,'0')}</span><div class="mock-ev-progress">${q.questions.map((_,idx)=>`<i data-am-style="background:${idx<=i?'var(--accent)':'var(--line)'}"></i>`).join('')}</div></div><h4>${esc(question?.text||'질문을 작성해주세요')}</h4><div class="mock-ev-answers">${opts}</div>${sim?'<small>선택지를 클릭해 다음 질문으로 이동합니다.</small>':'<div class="mock-ev-action">선택하면 다음 질문으로 이동　→</div>'}</div>${footer(s)}</div>`;
 }
 function completeSim(s,answers){const q=quiz(s);if(q.mode==='score'){const score=Object.values(answers).reduce((a,o)=>a+(Number(o.score)||0),0);const valid=q.results.filter(r=>Number(r.minScore)<=score).sort((a,b)=>Number(b.minScore)-Number(a.minScore));return (valid[0]||q.results[0])?.id}
  const score={};Object.values(answers).forEach(o=>{score[o.resultId]=(score[o.resultId]||0)+1});return q.results.slice().sort((a,b)=>(score[b.id]||0)-(score[a.id]||0))[0]?.id;
 }
 function answer(s,optionId){const state=simulation.get(s.id),q=quiz(s);if(!state||state.stage!=='question')return false;const question=q.questions[state.index],option=question?.options.find(o=>o.id===optionId);if(!option)return false;state.answers[question.id]=option;state.index++;if(state.index>=q.questions.length){state.stage='result';state.resultId=completeSim(s,state.answers)}return true}
 function eventPreview(s){ensure(s);const u=s.ev.ui,stage=getView(s);if(s.layout==='ev-quiz')return quizRender(s);
  const base=st=>`<div class="mock-event mock-event--${esc(s.layout.slice(3))}"><div class="mock-ev-content"><div class="mock-ev-badge">${esc(stageLabels[st]||'참여 안내')}</div>`;
  if(s.layout==='ev-share'){const done=stage==='after';return base(stage)+`<h4>${esc(done?u.successTitle:u.sharePrompt)}</h4><p class="mock-ev-subcopy">${esc(done?u.successText:(u.shareUrl||'공유 대상 URL 미설정'))}</p>${!done?`<div class="mock-ev-link"><span>${esc(u.shareUrl||'공유할 콘텐츠 URL을 설정하세요')}</span><b>복사</b></div>`:'<div class="am-flow-mock-state">공유 이후 확인 화면 · 실적 검증 미연결</div>'}<div class="mock-ev-channels">${String(u.shareChannels||'').split(/[,，\n]/).map(ch=>ch.trim()).filter(Boolean).map(ch=>`<span>${esc(ch)}</span>`).join('')}</div><div class="mock-ev-action">${done?'참여 안내 확인':'친구에게 공유하기'}　→</div></div>${footer(s)}</div>`}
  if(s.layout==='ev-ugc'){const completed=stage==='pending'||stage==='rejected',photo=u.entryMode!=='comment',comment=u.entryMode!=='photo';return base(stage)+`<h4>${esc(stage==='pending'?u.successTitle:stage==='rejected'?u.rejectedText:u.entryPrompt)}</h4>${!completed?`${photo?`<div class="mock-ev-upload"><b>▧ 사진 ${u.minImages}–${u.maxImages}장</b><small>이미지 자리 · 전송 미구현</small></div>`:''}${comment?`<div class="mock-ev-comment">댓글 작성 · 최대 ${esc(u.maxChars)}자</div>`:''}<div class="mock-ev-action">인증 제출하기　→</div>`:`<div class="am-flow-mock-state">${stage==='pending'?'검수 결과를 기다리는 중':'수정 후 다시 제출할 수 있어요'}</div>`}</div>${footer(s)}</div>`}
  if(s.layout==='ev-stamp'){const total=Math.max(1,Math.min(28,Number(u.totalDays)||7)),progress=stage==='reward'?total:stage==='after'?Math.min(total,Number(u.currentDays||0)+1):Math.min(total,Number(u.currentDays)||0);return `<div class="mock-event mock-event--stamp"><div class="mock-ev-stamp-cover"><div class="mock-ev-badge">${esc(stageLabels[stage]||'출석 전')}</div><h4>${esc(stage==='after'?u.successTitle:u.stampCaption)}</h4><div class="mock-ev-stamp-status"><strong>${progress}<small> / ${total}일</small></strong><span>${esc(u.policy==='consecutive'?'연속 출석':u.policy==='total'?'누적 출석':'하루 1회')}</span></div><div class="mock-ev-track"><i data-am-style="width:${100*progress/total}%"></i></div></div><div class="mock-ev-content"><div class="am-flow-daygrid">${Array.from({length:total},(_,i)=>`<div class="mock-ev-day ${i<progress?'complete':''}"><b>${i<progress?'✓':i+1}</b><small>D${i+1}</small></div>`).join('')}</div><div class="am-flow-mock-state">${u.rewards.map(r=>`${esc(r.day)}일: ${esc(r.title)}`).join(' · ')||'보상 단계 미설정'}</div><div class="mock-ev-action">${stage==='reward'?'달성 보상 확인':'출석 확인'}　→</div></div>${footer(s)}</div>`}
  if(s.layout==='ev-draw'){const prize=u.prizes[Math.max(0,Math.min(u.prizes.length-1,u.previewPrizeIndex||0))],won=stage==='win',lost=stage==='lose';return `<div class="mock-event mock-event--draw"><div class="mock-ev-draw-cover"><div class="mock-ev-badge">${esc(stageLabels[stage]||'참여 전')}</div><h4>${esc(won?prize?.resultText:lost?u.loseLabel:u.drawCaption)}</h4>${!won&&!lost?`<div class="mock-ev-wheel-shell"><div class="mock-ev-pointer"></div><div class="mock-ev-wheel">${String(u.wheelLabels||'').split('\n').slice(0,4).map((x,i)=>`<span class="mock-ev-wheel-label label-${i}">${esc(x)}</span>`).join('')}<div class="mock-ev-wheel-center" aria-hidden="true"></div></div></div>`:`<div class="am-flow-win-result">${esc(won?prize?.label:'다음 기회에 참여해주세요')}</div>`}</div><div class="mock-ev-content"><div class="mock-ev-action">${won?'경품 안내':'참여하기'}　→</div></div>${footer(s)}</div>`}
  if(s.layout==='ev-coupon'){const value=u.couponValue;const display=stage==='issued'?u.successTitle:stage==='duplicate'?u.alreadyIssued:stage==='expired'?'사용 기간이 종료되었습니다':value;return base(stage)+`<div class="mock-ev-ticket"><div class="mock-ev-ticket-body"><strong>${esc(display)}</strong><p>${esc(u.couponCondition)}</p></div><div class="mock-ev-ticket-side">↓</div></div><div class="am-flow-mock-state">사용 마감 ${esc(u.expireDate)} · ${esc(u.issueLimit)}장 제한</div><div class="mock-ev-action">${stage==='before'?'쿠폰 받기':'쿠폰 상태 확인'} →</div></div>${footer(s)}</div>`}
  return null;
 }
 function itemFields(s,i){const k=s.layout,it=s.items[i];if(!it)return '';let html='';
   if(k==='benefit')html+=select(`items.${i}.kind`,'혜택 유형',it.kind||'discount',[['discount','할인'],['gift','사은품'],['shipping','배송'],['points','포인트'],['other','기타']]);
   if(['benefit','service','detail','notice'].includes(k))html+=f(`items.${i}.condition`,'적용 조건 / 고지 (선택)',it.condition||'',{max:160,area:true,rows:2,optional:true});
   if(['service','story','detail'].includes(k))html+=f(`items.${i}.imageHint`,'이미지·연출 요청 (선택)',it.imageHint||'',{max:180,optional:true});
   if(k==='timeline')html+=f(`items.${i}.date`,'날짜·시간 표기',it.date||'',{max:80,optional:true,help:'표기 그대로 미리보기에 반영됩니다.'});
   if(k==='notice')html+=select(`items.${i}.priority`,'안내 중요도',it.priority||'info',[['info','참고 안내'],['required','필수 확인'],['warning','주의 필요']]);
   if(['notice','service','timeline'].includes(k)&&s.config?.presentation==='accordion')html+=select(`items.${i}.openByDefault`,'기본 상태',String(it.openByDefault===true||it.openByDefault==='true'),[['false','접힌 상태'],['true','펼친 상태']]);
   return html;
 }
 function infoPanel(s){ensure(s);if(!s.config)return '';const k=s.layout,x=s.config;let fields='';
  if(['hero','split'].includes(k))fields+=f('config.imageHint','비주얼 디자인 요청',x.imageHint,{area:true,rows:2,max:180})+select('config.imagePosition','비주얼 배치',x.imagePosition,k==='hero'?[['background','전체 배경'],['top','상단 이미지'],['side','이미지+텍스트']]:[['left','이미지 왼쪽'],['right','이미지 오른쪽'],['top','이미지 상단']]);
  if(k==='hero')fields+=select('config.height','비주얼 상하 여백',x.height,[['small','간결하게'],['medium','기본'],['large','넉넉하게']], '이미지 종횡비는 상단 이미지 비율 설정으로 유지하고, 여기서는 비주얼 영역의 상하 여백을 조정합니다.');
  if(k==='text-cta')fields+=select('config.emphasis','문구 강조',x.emphasis,[['lead','메시지 강조'],['compact','간결한 문구']])+select('config.align','문구 정렬',x.align||'center',[['left','왼쪽'],['center','가운데'],['right','오른쪽']]);
  if(k==='split')fields+=x.imagePosition==='top'?'<div class="am-ed-note">사진이 위에 있어 좌우 비율은 쓰지 않아요. 좌우 배치로 바꾸면 다시 쓸 수 있어요.</div>':select('config.ratio','이미지와 글 비율',x.ratio,[['half','1:1'],['visual','이미지 강조 2:1'],['copy','글 강조 1:2']]);
  if(['service','story','detail'].includes(k)){
  fields+=select('config.imagePosition','항목 이미지 자리',x.imagePosition,[['none','이미지 없음'],['top','위쪽'],['left','왼쪽'],['right','오른쪽'],['alternate','단락마다 교차']]);
  if(k==='service'&&x.presentation==='accordion'){
    fields+='<div class="am-ed-note">'+(x.imagePosition==='none'?'펼침 목록에 사진을 넣지 않아요. 사진 위치를 고르면 펼친 항목 안에 사진 자리가 생겨요.':'펼쳤을 때 사진이 이 배치로 나와요. 사진 설명은 항목마다 적어요.')+'</div>';
    fields+='<div class="am-ed-note">펼침 목록은 세로 한 줄로 나와요. 일반형으로 돌아가면 열 수가 다시 적용돼요.</div>';
  }
  if(x.imagePosition==='alternate'&&s.items.length<2)fields+='<div class="am-ed-note">교차 배치는 항목이 2개 이상일 때 차이가 보여요.</div>';
 }
  if(['timeline','notice'].includes(k))fields+=select('config.density','표시 밀도',x.density,[['compact','압축'],['comfortable','기본'],['spacious','여유']]);
   if(['notice','timeline','service'].includes(k))fields+=select('config.presentation','안내 표시 방식',x.presentation||'plain',[['plain','일반 본문형'],['accordion','접고 펼치는 아코디언형']], '아코디언 제목을 눌러 펼치면 설명·조건과 선택한 이미지 배치가 함께 나타납니다.');
  if(['countdown','deal-banner'].includes(k))fields+=select('config.previewState','미리보기 상태',x.previewState||'live',[['live','진행 중'],['expired','종료 후']]);
  if(['countdown','deal-banner'].includes(k))fields+=f('config.endAt','종료 일시 · 기획값',x.endAt,{max:35})+f('config.expiredLabel','종료 시 안내 문구',x.expiredLabel,{max:120})+select('config.after','종료 후 CTA',x.after,[['hide-cta','버튼 숨김'],['show-result','결과 안내'],['leave','기존 버튼 유지']],'미리보기 상태를 종료 후로 바꾸면 적용됩니다. 결과 안내는 운영 연동 전의 문구 시안입니다.');
  if(['benefit','service','story','detail','timeline','notice'].includes(k))fields+=f('config.footnote','하단 조건 및 고지',x.footnote,{area:true,rows:2,max:220,optional:true});
  return fields?`<section class="am-ed-group"><div class="am-ed-group__title"><h3>구좌 전용 상세 설정</h3></div><p class="am-ed-group__description">공통 구성 요소 외 해당 구좌만의 콘텐츠 구조와 상태를 제어합니다.</p><div class="am-ed-stack">${fields}</div></section>`:'';
 }
 function infoPreview(s){ensure(s);const k=s.layout,x=s.config;if(!x)return null;
  if(['countdown','deal-banner'].includes(k))return `<div class="am-flow-info-banner"><strong>${x.previewState==='expired'?esc(x.expiredLabel):esc(x.endAt||'')}</strong>${x.previewState==='expired'?'<div class="am-flow-info-clock">행사 종료</div>':'<div class="am-flow-info-clock" aria-label="시안용 카운트다운 자리">남은 시간 표시</div>'}</div>`;
  if(k==='text-cta')return `<div class="am-flow-info-text ${esc(x.emphasis||'lead')} align-${esc(['left','center','right'].includes(x.align)?x.align:'center')}"><strong>${esc(s.name||'')}</strong>${s.role?`<small>${esc(s.role)}</small>`:''}</div>`;
  if(k==='hero')return `<div class="am-flow-info-hero height-${esc(['small','medium','large'].includes(x.height)?x.height:'large')} position-${esc(['background','top','side'].includes(x.imagePosition)?x.imagePosition:'background')}"><div class="am-flow-img-ghost">대표 이미지 자리</div><small>${esc(x.imageHint||'비주얼 디자인 요청을 입력해주세요')}</small></div>`;
  if(k==='split')return `<div class="am-flow-info-split ${esc(['left','right','top'].includes(x.imagePosition)?x.imagePosition:'left')} ratio-${esc(['half','visual','copy'].includes(x.ratio)?x.ratio:'half')}"><div class="am-flow-img-ghost">이미지 자리</div><div class="am-flow-split-copy">${s.role?`<b>${esc(s.role)}</b>`:''}</div></div>`;
   if(['notice','service','timeline'].includes(k)&&x.presentation==='accordion'){
  const hasVisual=k==='service'&&['top','left','right','alternate'].includes(x.imagePosition);
  const visualPos=hasVisual?x.imagePosition:'none';
  return `<div class="am-ed-accordion-list am-ed-accordion-list--${esc(k)} density-${esc(x.density||'comfortable')} image-${esc(visualPos)}">${s.items.map((it,i)=>{
    const side=visualPos==='alternate'?(i%2?'right':'left'):visualPos;
    const image=hasVisual?`<div class="am-flow-img-ghost am-accordion-img-ghost" role="img" aria-label="${esc(it.imageHint||'이미지 자리')}"><span>이미지 자리</span>${it.imageHint?`<small>${esc(it.imageHint)}</small>`:''}</div>`:'';
    const text=`<div class="am-accordion-copy"><p>${esc(it.text||'안내 내용을 입력해주세요')}</p>${it.condition?`<small>적용 조건 · ${esc(it.condition)}</small>`:''}${it.date?`<small>일정 · ${esc(it.date)}</small>`:''}${it.priority==='warning'?'<small class="am-accordion-warning">주의 필요</small>':it.priority==='required'?'<small>필수 확인</small>':''}</div>`;
    return `<details class="am-ed-accordion" data-native-accordion-index="${i}" ${it.openByDefault===true||it.openByDefault==='true'?'open':''}><summary><span>${esc(it.label||'안내 제목을 입력해주세요')}</span><span class="am-ed-accordion-icon" aria-hidden="true"></span></summary><div class="am-ed-accordion-content"><div class="am-accordion-visual image-${esc(side)}">${image}${text}</div></div></details>`;
  }).join('')}${x.footnote?`<p class="am-flow-footnote">${esc(x.footnote)}</p>`:''}</div>`;
 }
   if(['benefit','service','story','detail','timeline','notice'].includes(k))return `<div class="am-flow-info-list am-flow-info-list--${esc(k)} cols-${esc(x.columns||'1')} image-${esc(x.imagePosition||'none')} density-${esc(x.density||'comfortable')}">${s.items.map((it,i)=>`<div class="am-flow-info-item">${['service','story','detail'].includes(k)&&x.imagePosition!=='none'?'<div class="am-flow-img-ghost">이미지 자리</div>':''}<div><span>${String(i+1).padStart(2,'0')}</span>${k==='benefit'?`<span class="am-benefit-kind kind-${esc(['discount','gift','shipping','points','other'].includes(it.kind)?it.kind:'discount')}">${esc(({discount:'할인',gift:'사은품',shipping:'배송',points:'포인트',other:'기타'})[it.kind]||'할인')}</span>`:''}<strong>${esc(it.label)}</strong><small>${esc(it.text)}</small>${it.imageHint?`<small>이미지 요청: ${esc(it.imageHint)}</small>`:''}${it.date?`<small>일정: ${esc(it.date)}</small>`:''}${it.priority==='required'?'<em>필수 안내</em>':it.priority==='warning'?'<em>주의 필요</em>':''}${it.condition?`<em>${esc(it.condition)}</em>`:''}</div></div>`).join('')}${x.footnote?`<p class="am-flow-footnote">${esc(x.footnote)}</p>`:''}</div>`;
  return null;
 }
 function action(s,a){ensure(s);if(s.layout==='ev-quiz'){
  const q=quiz(s),parts=a.split(':'),[cmd,raw,raw2,raw3]=parts,i=Number(raw),j=Number(raw2),move=Number(raw3);
  if(cmd==='editQuestion'){editQs.set(s.id,q.questions[i]?.id);setView(s,`q:${i}`);return true}
  if(cmd==='editResult'){editRs.set(s.id,q.results[i]?.id);setView(s,`r:${i}`);return true}
  if(cmd==='addQuestion'){if(q.questions.length>=12)return false;const nq={id:uid('q'),text:'새로운 질문을 작성하세요',required:true,options:[{id:uid('o'),text:'선택지 A',resultId:q.results[0]?.id,score:0},{id:uid('o'),text:'선택지 B',resultId:q.results.at(-1)?.id,score:2}]};q.questions.push(nq);editQs.set(s.id,nq.id);setView(s,`q:${q.questions.length-1}`);return true}
  if(cmd==='removeQuestion'){if(q.questions.length<=1)return false;q.questions.splice(i,1);editQs.set(s.id,q.questions[Math.min(i,q.questions.length-1)].id);setView(s,`q:${Math.min(i,q.questions.length-1)}`);return true}
  if(cmd==='cloneQuestion'){if(q.questions.length>=12)return false;const nq=deep(q.questions[i]);nq.id=uid('q');nq.options.forEach(o=>o.id=uid('o'));q.questions.splice(i+1,0,nq);editQs.set(s.id,nq.id);setView(s,`q:${i+1}`);return true}
  if(cmd==='moveQuestion'){const dest=i+j;if(dest<0||dest>=q.questions.length)return false;[q.questions[i],q.questions[dest]]=[q.questions[dest],q.questions[i]];setView(s,`q:${dest}`);return true}
  if(cmd==='addAnswer'){if(q.questions[i].options.length>=6)return false;q.questions[i].options.push({id:uid('o'),text:'새로운 선택지',resultId:q.results[0]?.id,score:0});return true}
  if(cmd==='removeAnswer'){if(q.questions[i].options.length<=2)return false;q.questions[i].options.splice(j,1);return true}
  if(cmd==='moveAnswer'){const arr=q.questions[i].options,dest=j+move;if(dest<0||dest>=arr.length)return false;[arr[j],arr[dest]]=[arr[dest],arr[j]];return true}
  if(cmd==='addResult'){if(q.results.length>=10)return false;const r={id:uid('result'),title:'새로운 결과',description:'이 유형의 특징을 입력하세요',productId:'',minScore:0,ctaText:'추천 상품 보기',layout:'product',imageHint:'',ctaUrl:''};q.results.push(r);editRs.set(s.id,r.id);setView(s,`r:${q.results.length-1}`);return true}
  if(cmd==='removeResult'){if(q.results.length<=1)return false;const deleted=q.results[i]?.id;if(q.questions.some(x=>x.options.some(o=>o.resultId===deleted)))return false;q.results.splice(i,1);editRs.set(s.id,q.results[Math.min(i,q.results.length-1)].id);return true}
  if(cmd==='simStart'){simulation.set(s.id,{stage:'question',index:0,answers:{}});return true}
  if(cmd==='simReset'){simulation.delete(s.id);setView(s,'q:0');return true}
 }
 const ui=s.ev?.ui;
 if(a==='addStampReward'){ui.rewards.push({id:uid('reward'),day:'1',title:'신규 보상'});return true}
 if(a.startsWith('removeStampReward:')){if(ui.rewards.length<=1)return false;ui.rewards.splice(Number(a.split(':')[1]),1);return true}
 if(a==='addPrize'){if(ui.prizes.length>=12)return false;ui.prizes.push({id:uid('prize'),label:'새 경품',quantity:'1',resultText:'당첨을 축하합니다'});return true}
 if(a.startsWith('removePrize:')){if(ui.prizes.length<=1)return false;ui.prizes.splice(Number(a.split(':')[1]),1);return true}
 if(a.startsWith('viewPrize:')){ui.previewPrizeIndex=Number(a.split(':')[1]);setView(s,'win');return true}
 return false;
 }
 function issues(s){ensure(s);const out=[];
 const add=(level,text)=>out.push({level,text});
 if(!String(s.name||'').trim())add('error','구좌 제목을 입력해주세요.');
 if(s.ctaOn&&s.ctaTargetType!=='none'&&!s.ctaTarget)add('warn','CTA 목적지 유형은 정했지만 연결 대상이 비어 있습니다.');
 if(s.ctaOn&&s.ctaTargetType==='none')add('info','CTA 이동 대상이 아직 정해지지 않았습니다.');
 if(['grid2','grid3','feat','deal-banner'].includes(s.layout)&&!s.productIds?.length)add('warn','노출할 상품이 선택되지 않았습니다.');
 if(s.layout==='review'&&!s.rv?.selected?.length)add('warn','보여줄 후기가 선택되지 않았습니다.');
 if(s.layout==='ev-quiz'){
  const q=quiz(s);if(q.questions.length===0)add('error','퀴즈 질문이 없습니다.');
  q.questions.forEach((x,i)=>{if(!x.text?.trim())add('error',`질문 ${i+1}: 질문 문구가 비었습니다.`);if(x.options.length<2)add('error',`질문 ${i+1}: 답변이 2개 미만입니다.`);x.options.forEach((o,j)=>{if(!o.text?.trim())add('error',`질문 ${i+1} 선택지 ${j+1}: 문구 없음`);if(q.mode==='type'&&!q.results.some(r=>r.id===o.resultId))add('error',`질문 ${i+1} 선택지 ${j+1}: 결과 연결 끊김`);})});
  q.results.forEach((r,i)=>{if(!r.title?.trim())add('error',`결과 ${i+1}: 제목 없음`);if(!r.description?.trim())add('warn',`결과 ${i+1}: 설명이 비었습니다.`);if(r.ctaText&&!r.ctaUrl&&!r.productId)add('info',`결과 ${i+1}: 결과 CTA 이동 대상 미정`)});
  if(q.mode==='type')q.results.forEach((r,i)=>{if(!q.questions.some(x=>x.options.some(o=>o.resultId===r.id)))add('info',`결과 ${i+1}: 연결된 답변이 없습니다.`)});
  if(q.mode==='score'){const thresholds=q.results.map(r=>Number(r.minScore));if(new Set(thresholds).size!==thresholds.length)add('warn','점수형 결과의 최소 점수가 중복됩니다. 결과 우선순위를 확인해주세요.');}
 }
 if(s.layout==='ev-share'&&!s.ev.ui.shareUrl)add('warn','공유할 콘텐츠 URL이 정해지지 않았습니다.');
 if(s.layout==='ev-ugc'&&s.ev.ui.entryMode!=='comment'&&Number(s.ev.ui.minImages)>Number(s.ev.ui.maxImages))add('error','이미지 최소 수가 최대 수를 초과합니다.');
 if(s.layout==='ev-stamp'&&s.ev.ui.rewards.some(r=>Number(r.day)>Number(s.ev.ui.totalDays)))add('warn','출석 최대 일수보다 높은 보상 단계가 있습니다.');
 if(s.layout==='ev-draw'&&s.ev.ui.prizes.some(r=>!r.label?.trim()))add('warn','경품명이 비어 있습니다.');
 if(s.layout==='ev-coupon'&&!s.ev.ui.expireDate)add('warn','쿠폰 사용 마감일이 입력되지 않았습니다.');
 if(s.config?.endAt&&!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(s.config.endAt))add('warn','종료 일시 형식이 YYYY-MM-DDTHH:MM이 아닙니다.');
 if(s.layout.startsWith('ev-'))add('info','실제 운영 API·법무·추첨·쿠폰 발급은 사내 담당자 검수 대상입니다.');
 return out;
 }
 function qualityPanel(s){const its=issues(s);return `<section class="am-ed-group"><div class="am-ed-group__title"><h3>구좌 완결성 점검</h3></div><p class="am-ed-group__description">빠진 입력을 찾아 줘요. 운영 승인은 아니에요.</p><div class="am-flow-issues">${its.length?its.map(x=>`<div class="am-flow-issue ${esc(x.level)}"><b>${x.level==='error'?'오류':x.level==='warn'?'확인 필요':'안내'}</b><span>${esc(x.text)}</span></div>`).join(''):'<p>현재 점검 규칙상 발견된 누락이 없습니다.</p>'}</div></section><section class="am-ed-group"><div class="am-ed-group__title"><h3>인계 전 확인</h3></div><p class="am-ed-group__description">상품·이벤트·후기·CTA는 실제 운영 값과 맞춰 본 뒤 확정해요.</p><div class="am-ed-note">내보낸 JSON은 기록·복원용이에요. 자사몰 운영 설정을 바꾸지 않아요.</div></section>`;}
 return {ensure,eventPreview,quizPanel,otherPanel,infoPanel,infoPreview,itemFields,qualityPanel,issues,action,setView,getView,simulation,answer};
})();
