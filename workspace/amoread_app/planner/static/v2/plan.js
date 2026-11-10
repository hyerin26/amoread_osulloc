// 새 버전 기획안 잇기 (plans/23 §3-1): 주소의 ?id=로 기획안 하나를 읽고, 기획안 막대를 채우고, 저장을 맡는다.
// 저장은 예전 화면과 같은 /api/am/projects (같은 파일). 새 버전만 쓰는 값은 doc.v2 (예전 화면이 저장해도 안 지워짐).
// id가 없으면 '예시 기획안'으로 보여 주고 저장하지 않는다.
const PLAN = (() => {
  const STEPS = ['brief', 'compose', 'editor', 'preview', 'deals'];
  const here = location.pathname.split('/').pop();
  const raw = new URLSearchParams(location.search).get('id') || '';
  const st = { id: /^[0-9a-f]{32}$/.test(raw) ? raw : null, doc: null };
  const say = t => { const el = document.getElementById('v2saved'); if (el) el.textContent = t; };
  // 기획안 안의 화면으로 가는 링크에 id를 붙여 같은 기획안으로 이동
  const tagLinks = () => document.querySelectorAll('a[href^="/v2/"]').forEach(a => {
    const u = new URL(a.getAttribute('href'), location.origin);
    if (!STEPS.includes(u.pathname.split('/').pop())) return;
    u.searchParams.set('id', st.id);
    a.setAttribute('href', u.pathname + u.search + u.hash);
  });
  st.ready = (async () => {
    if (!st.id) { say('예시 기획안이에요 · 홈에서 새로 만들면 저장돼요'); return null; }
    try {
      st.doc = await v2api(`/api/am/projects/${st.id}`);
    } catch (e) {
      say(`기획안을 열지 못했어요: ${e.message}`);
      st.id = null;
      return null;
    }
    st.doc.v2 = { cls: '', seed: '', keywords: [], stage: 'brief', ...(st.doc.v2 || {}) };
    const ident = document.querySelector('.v2ident');
    if (ident) { ident.textContent = st.doc.title; ident.title = `기획안 목록으로 · ${st.doc.title}`; }
    document.querySelectorAll('[data-plan-title]').forEach(h => { h.textContent = st.doc.title; });   // 예시 제목 대신 지금 연 기획안 이름
    st.progress();
    tagLinks();
    say(`저장됨 ${String(st.doc.updated_at || '').slice(5, 16)}`);
    if (STEPS.includes(here) && st.doc.v2.stage !== here) st.save(d => { d.v2.stage = here; }, true);   // 홈 목록의 '지금 단계'
    return st.doc;
  })();
  // 단계 막대 진행 상황 (2026-11-10): 저장된 기획안 값으로만 판단. 끝난 단계 = .is-done(체크), 남은 일 = 작은 글자
  //   브리프: 컨셉·메인 카피·고른 키워드 중 하나라도 있으면 끝 / 구좌 구성: 구좌가 있으면 끝(구좌 수) / 구좌 편집: 제목을 아직 안 쓴 구좌 수
  st.progress = () => {
    const d = st.doc;
    if (!d) return;
    const secs = (d.page && d.page.sections) || [];
    const b = d.brief || {}, kws = (d.v2 && d.v2.keywords) || [];
    const left = secs.filter(x => !String(x.headline || '').trim()).length;
    const S = {
      brief: (b.concept || b.key_copy || kws.length) ? { done: true } : { note: '시작 전' },
      compose: secs.length ? { done: true, note: `${secs.length}구좌` } : { note: '고르기 전' },
      editor: !secs.length ? null : left ? { note: `남은 구좌 ${left}` } : { done: true },
    };
    document.querySelectorAll('.v2steps a').forEach(a => {
      const k = new URL(a.getAttribute('href'), location.origin).pathname.split('/').pop();
      const s = S[k];
      a.classList.toggle('is-done', !!(s && s.done));
      a.querySelectorAll('.v2stn, .v2sr').forEach(x => x.remove());
      if (s && s.done) a.insertAdjacentHTML('beforeend', '<span class="v2sr"> (끝남)</span>');
      if (s && s.note) { const n = document.createElement('span'); n.className = 'v2stn'; n.textContent = s.note; a.append(n); }
    });
  };
  // 고친 뒤 부른다. 0.7초 모아서 한 번에, 저장은 차례로 (응답이 와도 그 사이 고친 내용을 덮지 않음)
  let timer = null, chain = Promise.resolve();
  const run = () => {
    timer = null;
    chain = chain.then(() => v2api('/api/am/projects', st.doc)
      .then(d => { st.doc.updated_at = d.updated_at; say(`저장했어요 ${String(d.updated_at).slice(11, 16)}`); st.progress(); })
      .catch(e => say(`저장 못 했어요: ${e.message}`)));
  };
  st.save = (mutate, now = false) => {
    if (!st.doc) return;
    if (mutate) mutate(st.doc);
    say('저장 중…');
    clearTimeout(timer);
    timer = setTimeout(run, now ? 0 : 700);
  };
  // 기다리는 저장을 바로 보내고, 끝날 때까지 기다림 (화면을 옮기기 전에)
  st.flush = () => { if (timer) { clearTimeout(timer); run(); } return chain; };
  // 탭 닫기·새로고침·주소 이동처럼 링크가 아닌 길로 떠날 때도 고친 내용을 잃지 않게 (2026-11-10)
  // 기다리는 저장이 있으면 keepalive 요청으로 마지막 상태를 보낸다. 너무 크면(64KB 제한) 브라우저의 '떠날까요?' 확인을 띄움
  addEventListener('beforeunload', e => {
    if (!timer || !st.doc) return;
    clearTimeout(timer); timer = null;
    const body = JSON.stringify(st.doc);
    if (body.length < 60000) {
      try { fetch('/api/am/projects', { method: 'POST', keepalive: true, headers: { 'x-planner-token': V2_TOKEN, 'Content-Type': 'application/json' }, body }); return; } catch { /* 아래 확인으로 */ }
    }
    e.preventDefault(); e.returnValue = '';
  });
  // 저장이 기다리는 중에 다른 화면 링크를 누르면, 저장을 마친 뒤 이동 (고친 내용이 사라지지 않게)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="/v2/"]');
    if (!a || !timer || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    st.flush().then(() => location.assign(a.getAttribute('href')));
  });
  return st;
})();
