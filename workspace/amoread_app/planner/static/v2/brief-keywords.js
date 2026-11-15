// 검색 근거와 기획자의 판단을 분리하는 브리프 마인드맵 모델.
window.BriefKeywords = (() => {
  const groups = { situation: '소비 상황', need: '고객 니즈', topic: '관심 주제', product: '상품 연결' };
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const valid = value => /^[가-힣A-Za-z0-9 ]{1,20}$/.test(clean(value));
  const category = word => /선물|감사|답례|위로|휴식|리프레시|취향|부담|건강/.test(word) ? 'need'
    : /모임|사무실|피크닉|캠핑|출근|퇴근|여행|티타임|홈카페|나들이|파티|식사/.test(word) ? 'situation' : 'topic';
  function trend(data, word) {
    const source = data?.sources?.datalab;
    const item = source?.status === 'ok' ? source.items.find(x => x.keyword === word) : null;
    const change = item?.change_4w;
    const enough = item?.weekly?.length >= 8 && typeof change === 'number' && Number.isFinite(change);
    return { item, change: enough ? change : null, label: !enough ? '검색 추이 미확인' : change >= .2 ? '최근 관심 상승' : change <= -.2 ? '최근 관심 하락' : '최근 변화 적음' };
  }
  const safeURL = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) && u.href.length <= 2000 ? u.href : ''; } catch { return ''; } };
  function evidence(word, node, data, root) {
    const t = trend(data, word);
    return { keyword: word, root, category: node?.category || category(word), source: node?.source || 'manual',
      fetched_at: data?.fetched_at || '', change_4w: t.change,
      articles: (data?.sources?.naver_search?.items || []).slice(0, 3).map(x => ({ title: String(x.title || '').slice(0, 120), kind: x.kind, date: String(x.date || '').slice(0, 40), link: safeURL(x.link) })) };
  }
  return { groups, clean, valid, category, trend, safeURL, evidence };
})();
