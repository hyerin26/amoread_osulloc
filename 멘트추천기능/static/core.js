(function (root) {
  'use strict';
  const BRIEF = ['myeongbun','concept','purpose','audience','target','customer','constraints','key_copy','period'];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stable = x => JSON.stringify(x, function (_, value) {
    return value && !Array.isArray(value) && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(k => [k,value[k]])) : value;
  });
  const cards = s => s.tabs ? s.tabs.flatMap(t => t.cards || []) : s.cards || [];
  function snapshot({doc, section:s, sections, products, rows, extras}) {
    if (!doc?.id || !s) throw Error('홈에서 저장된 기획안을 먼저 열어 주세요. 예시 화면에서는 AI를 호출하지 않아요.');
    const seqs = [...new Set(cards(s).map(c => c.seq || c.keep).filter(Boolean).map(String))];
    const brief = Object.fromEntries(BRIEF.map(k => [k,doc.brief?.[k] ?? null]));
    const draft = {section_id:s.id, headline:s.name || '', subhead:s.role || '', layout_id:s.layout,
      scope:s.scope || '', product_seqs:seqs};
    const freshness = {project_id:doc.id, brief, keywords:doc.v2?.keywords || [], draft,
      outline:sections.map(x => [x.id,x.name || '',x.role || '',x.layout]),
      products:seqs.map(seq => ({seq,name:products[seq]?.name || '',category:products[seq]?.category || ''})),
      rates:rows.filter(r => seqs.includes(String(r.seq))).map(r => [String(r.seq),r.rate]),
      extras:extras.filter(e => (e.seqs || []).some(seq => seqs.includes(String(seq))))
        .map(e => ({id:e.id,name:e.name,calc:e.calc,val:e.val,seqs:e.seqs,s:e.s,e:e.e}))};
    return {request:{project_id:doc.id,draft}, fingerprint:stable(freshness)};
  }
  function patchFor(candidate, target) {
    const patch = {};
    if (target !== 'subhead') {
      if (typeof candidate.headline !== 'string' || !candidate.headline.trim() || candidate.headline.length>60) throw Error('메인 카피 글자 수가 올바르지 않아요.');
      patch.name = candidate.headline;
    }
    if (target !== 'headline') {
      if (typeof candidate.subhead !== 'string' || !candidate.subhead.trim() || candidate.subhead.length>200) throw Error('서브 카피 글자 수가 올바르지 않아요.');
      patch.role = candidate.subhead;
    }
    return patch;
  }
  root.CopyRecommendationCore = {esc,stable,snapshot,patchFor};
})(typeof globalThis !== 'undefined' ? globalThis : window);
