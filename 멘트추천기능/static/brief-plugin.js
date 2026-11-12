(function () {
  'use strict';
  const module = window.CopyRecommendation, core = window.CopyRecommendationCore;
  const host = document.getElementById('briefAiRecommendations'), trigger = document.getElementById('aiSug');
  if (!module || !core || !host || !trigger) return;
  const fingerprint = () => core.stable({id:PLAN.id, brief:PLAN.doc?.brief, keywords:picked,
    concept:document.getElementById('concept').value, audience:document.getElementById('who').value,
    copy:document.getElementById('copy').value, root:ROOT});
  let opened=false;
  module.connect({
    fixedTarget:'headline', currentId:()=>'brief', enabled:()=>!!PLAN.id && !!PLAN.doc,
    snapshot() {return {request:{scope:'brief',project_id:PLAN.id,draft:{section_id:'brief',headline:'',subhead:'',layout_id:'hero',scope:'',product_seqs:[]}},fingerprint:fingerprint()};},
    async prepare() {
      if (!PLAN.id || !PLAN.doc) throw Error('홈에서 저장된 기획안을 먼저 열어 주세요.');
      saveBrief(); await PLAN.flush();
    },
    paint() {if(opened)host.innerHTML=module.render('brief');},
    apply(id, patch, meta) {
      const field=document.getElementById('copy'); field.value=patch.name;
      saveBrief(); renderSugs();
      toast('AI 메인 카피를 적용했어요. 직접 수정할 수 있어요.');
    }
  });
  trigger.addEventListener('click',()=>{opened=true;module.request('brief');});
})();
