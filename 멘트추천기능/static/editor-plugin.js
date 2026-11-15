(function () {
  'use strict';
  const C = window.CopyRecommendationCore, states = new Map();
  let bridge = null, availability = null;
  const state = id => { if (!states.has(id)) states.set(id,{target:'both',tone:'브랜드 기본',busy:false,result:null,error:'',stale:false,run:0,applied:null}); return states.get(id); };
  const paint = id => bridge?.paint(id);
  async function api(path, body) {
    const token = document.querySelector('meta[name="planner-token"]')?.content;
    const response = await fetch('/api/am/copy'+path,{method:body === undefined ? 'GET':'POST',
      headers:{'x-planner-token':token || '',...(body===undefined?{}:{'Content-Type':'application/json'})},
      body:body===undefined?undefined:JSON.stringify(body)});
    const data = await response.json();
    if (!response.ok) throw Error(typeof data.detail==='string' ? data.detail : data.error || '추천 요청을 처리하지 못했어요.');
    return data;
  }
  function render(id) {
    const st=state(id), unavailable=availability && !availability.available, live=bridge?.enabled?.();
    const select=(key,values) => `<select data-cr-control="${key}" ${st.busy?'disabled':''} aria-label="${key==='target'?'추천할 문구':'카피 톤'}">${values.map(([v,t])=>`<option value="${C.esc(v)}" ${st[key]===v?'selected':''}>${t}</option>`).join('')}</select>`;
    let html=`<section class="cr-box" data-cr-section="${C.esc(id)}" aria-label="AI 카피 추천"><div class="cr-title"><b>AI 카피 추천</b><span class="tag">Claude</span></div>
      <p class="hint">${st.target==='polish'?'입력한 설명의 뜻을 유지하며 자연스럽고 감각적인 광고 문장 3개로 다듬어요.':bridge?.fixedTarget==='headline'?'브리프의 명분·키워드·컨셉으로 메인 카피 3개를 만들어요.':'브리프와 이 구좌의 상품으로 메인·서브 카피 3세트를 만들어요.'} 선택해 적용하기 전에는 현재 문구를 바꾸지 않아요.</p>
      <div class="cr-options">${bridge?.fixedTarget?'':select('target',[['both','메인·서브 세트'],['headline','메인 카피만'],['subhead','서브 카피만'],['polish','설명 다듬기']])}${select('tone',[['브랜드 기본','브랜드 기본'],['담백하게','담백하게'],['감성적으로','감성적으로']])}</div>
      <div class="cr-actions"><button type="button" class="btn xs primary" data-cr-generate ${st.busy||unavailable||!live?'disabled':''}>${st.busy?'추천 만드는 중…':st.result?'다시 추천':'AI 카피 추천'}</button>${st.busy?'<button type="button" class="btn xs" data-cr-cancel>취소</button>':''}</div>
      ${!live?'<p class="hint">홈에서 저장된 기획안을 열면 사용할 수 있어요. 예시 데이터는 AI에 보내지 않아요.</p>':''}
      ${availability===null?'<p class="hint">연결 상태 확인 중…</p>':unavailable?'<p class="cr-error" role="status">Claude SDK가 설치되어 있지 않아요. README의 실행 준비를 확인해 주세요.</p>':''}
      ${st.busy?`<p class="hint" role="status" aria-live="polite">현재 문구를 유지한 채 만드는 중이에요.${bridge?.fixedTarget?'':' 다른 구좌로 이동해도 이 구좌의 결과로 보관합니다.'}</p>`:''}
      ${st.error?`<p class="cr-error" role="alert">${C.esc(st.error)}</p>`:''}
      <p class="cr-error" data-cr-stale ${st.stale?'':'hidden'}>추천 후 문구·상품·브리프가 바뀌었어요. 현재 내용으로 다시 추천해 주세요.</p>`;
    if (st.result) {
      const result=st.result, labels=Object.fromEntries(result.sources.map(x=>[x.id,x.text]));
      if(result.task==='polish')html+=`<div class="cr-original"><b>다듬기 전 설명</b><p>${C.esc(result.original_text)}</p></div>`;
      html+=`<div class="cr-candidates">${result.items.map(item=>`<article class="cr-candidate"><div class="cr-title"><strong>${C.esc(item.angle)}</strong>${st.applied===item.candidate_id?'<span class="tag">적용됨</span>':''}</div>
        ${result.task==='polish'?'':`<p class="cr-headline">${C.esc(item.headline)}</p>`}${bridge?.fixedTarget?'':`<p class="cr-subhead">${C.esc(item.subhead)}</p>`}
        <p class="hint">${result.task==='polish'?`설명 ${item.subhead.length}자`:`메인 ${item.headline.length}자${bridge?.fixedTarget?'':` · 서브 ${item.subhead.length}자`}`}${result.target!=='both'?' · 선택한 문구만 변경':''}</p>
        <details><summary>추천 근거</summary><ul>${item.basis.map(k=>`<li>${C.esc(labels[k] || k)}</li>`).join('')}</ul></details>
        <button type="button" class="btn xs" data-cr-apply="${C.esc(item.candidate_id)}" ${st.stale||st.busy?'disabled':''}>${result.task==='polish'?'이 설명 적용':result.target==='headline'?'메인만 적용':result.target==='subhead'?'서브만 적용':'이 세트 적용'}</button></article>`).join('')}</div>`;
      if (result.warnings.length) html+=`<ul class="hint">${result.warnings.map(t=>`<li>${C.esc(t)}</li>`).join('')}</ul>`;
      html+=`<details class="cr-sources"><summary>AI에 전달된 참고 정보</summary><ul>${result.sources.map(s=>`<li>${C.esc(s.text)}</li>`).join('')}</ul></details>`;
      html+='<p class="hint">AI 초안이에요. 실제 혜택·상품 특징과 게시 표현은 담당자가 확인해 주세요.</p>';
    }
    return html+'</section>';
  }
  function changed(id) {
    const st=state(id);
    if (!st.fingerprint || !bridge) return;
    try { st.stale=bridge.snapshot(id).fingerprint!==st.fingerprint; } catch { st.stale=true; }
    // 입력 중 패널 전체를 다시 그리지 않아 포커스·커서를 유지한다.
    document.querySelectorAll('[data-cr-section]').forEach(host=>{
      if(host.dataset.crSection!==id)return;
      const msg=host.querySelector('[data-cr-stale]');if(msg)msg.hidden=!st.stale;
      host.querySelectorAll('[data-cr-apply]').forEach(b=>{b.disabled=st.stale||st.busy;});
    });
  }
  async function generate(id) {
    const st=state(id); if(st.busy || !bridge)return;
    st.busy=true;st.error='';st.result=null;st.applied=null;st.fingerprint=null;st.stale=false;st.run+=1;const run=st.run;paint(id);
    try {
      await bridge.prepare(id);
      if(st.run!==run)return;
      const snap=bridge.snapshot(id);st.fingerprint=snap.fingerprint;
      let job=await api('/jobs',{...snap.request,target:st.target==='polish'?'subhead':st.target,task:st.target==='polish'?'polish':'suggest',tone:st.tone});
      if(st.run!==run){await api(`/jobs/${job.id}/cancel`,{});return;}
      st.job=job.id;
      while(job.status==='running') {
        await new Promise(resolve=>setTimeout(resolve,1200));
        if(st.run!==run)return;
        job=await api(`/jobs/${st.job}`);
        if(job.section_id!==id || job.id!==st.job)throw Error('추천 결과의 구좌가 일치하지 않아요.');
      }
      if(job.status!=='done')throw Error(job.error || '추천을 완료하지 못했어요.');
      const result=job.result;
      if(result?.mode!=='ai' || result.section_id!==id || !Array.isArray(result.items) || result.items.length!==3)throw Error('추천 응답 형식이 올바르지 않아요.');
      result.items.forEach(item=>C.patchFor(item,result.target));
      st.result=result;st.applied=null;changed(id);
    } catch(e) { if(st.run===run)st.error=e.message; }
    finally { if(st.run===run){st.busy=false;st.job=null;changed(id);paint(id);} }
  }
  async function cancel(id) {
    const st=state(id), job=st.job;st.run+=1;st.busy=false;st.job=null;st.error='요청을 취소했어요.';paint(id);
    if(job)try {await api(`/jobs/${job}/cancel`,{});}catch(e){st.error=e.message;paint(id);}
  }
  function apply(id, candidateId) {
    const st=state(id);if(st.busy||!st.result||!bridge)return;
    changed(id);
    if(st.stale){st.error='현재 내용으로 다시 추천한 뒤 적용해 주세요.';paint(id);return;}
    const item=st.result.items.find(x=>x.candidate_id===candidateId);if(!item)return;
    try {
      bridge.apply(id,C.patchFor(item,st.result.target),{request_id:st.result.request_id,candidate_id:item.candidate_id,
        task:st.result.task || 'suggest',model:st.result.model,prompt_version:st.result.prompt_version,basis:item.basis,applied_at:new Date().toISOString()});
      st.fingerprint=bridge.snapshot(id).fingerprint;st.stale=false;st.applied=candidateId;st.error='';paint(id);
    }catch(e){st.error=e.message;paint(id);}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-copy-polish]')){window.CopyRecommendation.polish(bridge.currentId());return;}
    const host=event.target.closest('[data-cr-section]');if(!host)return;
    const id=host.dataset.crSection;
    if(event.target.closest('[data-cr-generate]'))generate(id);
    else if(event.target.closest('[data-cr-cancel]'))cancel(id);
    else {const button=event.target.closest('[data-cr-apply]');if(button)apply(id,button.dataset.crApply);}
  });
  document.addEventListener('change',event=>{
    const el=event.target.closest('[data-cr-control]');if(!el)return;
    const host=el.closest('[data-cr-section]'),st=state(host.dataset.crSection);
    st[el.dataset.crControl]=el.value;st.result=null;st.error='';st.stale=false;paint(host.dataset.crSection);
  });
  ['input','change'].forEach(type=>document.addEventListener(type,event=>{
    if(event.target.closest('[data-cr-section]'))return;
    queueMicrotask(()=>{for(const id of states.keys())changed(id);});
  }));
  window.CopyRecommendation={render,changed,request:generate,polish(id){const st=state(id);if(st.busy)return;st.target='polish';generate(id);},connect(value){bridge=value;if(bridge.fixedTarget)state(bridge.currentId()).target=bridge.fixedTarget;api('/status').then(x=>{availability=x;paint(bridge.currentId());}).catch(e=>{
    availability={available:false};const id=bridge.currentId();if(id){state(id).error=e.message;paint(id);}
  });}};
})();
