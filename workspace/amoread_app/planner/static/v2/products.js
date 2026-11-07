// 실제 상품 불러오기 (상품·할인, 구좌 편집, 미리보기가 함께 씀). 한 화면 안에서는 한 번만 부름
const PRODUCTS_API = (() => {
  let all = null;
  const detail = {};
  return {
    // 전체 상품 491개 (/api/products): 정가·원가·평소 판매·마지막 행사·90일 판매 등
    all: () => (all ||= v2api('/api/products').then(d => d.products || [])),
    // 상품 하나: 행사 이력(history)·후기 요약(reviews). 실패하면 null (화면은 '못 불러옴'으로)
    detail: seq => (detail[seq] ||= /^\d{1,12}$/.test(String(seq)) ? v2api(`/api/product/${seq}`).catch(() => null) : Promise.resolve(null)),
  };
})();
// 기획안의 구좌 카드 → SEQ마다 놓인 곳 ('구좌 이름 · 탭'). 상품·할인의 '놓인 곳'
function placesOf(doc) {
  const out = {};
  for (const s of doc?.page?.sections || []) {
    const tabs = Object.fromEntries((s.tabs || []).map(t => [t.tabId, t.label]));
    for (const sl of s.slots || []) {
      if (!sl.seq) continue;
      const where = `${s.headline || s.name || '구좌'}${sl.tabId && tabs[sl.tabId] ? ` · ${tabs[sl.tabId]}` : ''}`;
      (out[sl.seq] ||= []).includes(where) || out[sl.seq].push(where);
    }
  }
  return out;
}
// 추가 혜택(2단) 계산: 상품·할인과 구좌 편집이 같은 식
function extraPrice(first, list, ex) {
  if (!ex) return first;
  const r10 = n => Math.round(n / 10) * 10;
  return ex.calc === 'won' ? Math.max(0, first - ex.val) : ex.calc === 'list_pct' ? r10(Math.min(first, list * (1 - ex.val / 100))) : r10(first * (1 - ex.val / 100));
}
const extraText = ex => !ex ? '' : ex.calc === 'won' ? `${ex.name} ${Number(ex.val).toLocaleString('ko-KR')}원 더` : ex.calc === 'list_pct' ? `${ex.name} 정가에서 ${ex.val}%` : `${ex.name} ${ex.val}% 더`;
