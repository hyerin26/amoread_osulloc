// 키워드는 중심 단어에 직접 연결하고, 출처는 노드의 배지와 근거 패널에 표시한다.
window.BriefKeywords = (() => {
  const sources = { searchad:'검색 연관어', content:'콘텐츠 추출어', ai_web:'웹 근거 기반 AI 추천', ai_idea:'AI 아이디어', product:'실제 상품', manual:'직접 추가' };
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const valid = value => /^[가-힣A-Za-z0-9 ]{1,20}$/.test(clean(value));
  function trend(data, word) {
    const source = data?.sources?.datalab;
    const item = source?.status === 'ok' ? source.items.find(x => x.keyword === word) : null;
    const change = item?.change_4w;
    const enough = item?.weekly?.length >= 8 && typeof change === 'number' && Number.isFinite(change);
    return { item, change: enough ? change : null, label: !enough ? '검색 추이 미확인' : change >= .2 ? '최근 관심 상승' : change <= -.2 ? '최근 관심 하락' : '최근 변화 적음' };
  }
  const safeURL = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) && u.href.length <= 2000 ? u.href : ''; } catch { return ''; } };
  function evidence(word, node, data, root) {
    const t = trend(data, word), saved = node?.aiEvidence;
    return { keyword: word, root, category: node?.category || 'topic', source: node?.source || 'manual',
      fetched_at: saved?.fetched_at || data?.fetched_at || '', change_4w: t.change, rationale: saved?.rationale || '',
      articles: (saved?.articles || data?.sources?.naver_search?.items || []).slice(0, 3).map(x => ({ title: String(x.title || '').slice(0, 120), kind: x.kind || '웹 자료', date: String(x.date || '').slice(0, 40), link: safeURL(x.link) })) };
  }
  return { sources, clean, valid, trend, safeURL, evidence };
})();
