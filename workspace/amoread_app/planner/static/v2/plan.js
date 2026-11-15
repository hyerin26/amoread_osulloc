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
    if (![...STEPS, 'editor-next'].includes(u.pathname.split('/').pop())) return;   // editor-next: 신규 구좌편집기 (단계 저장 대상은 아님)
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
    const hero = st.doc.page?.sections?.find(s => s.layoutId === 'hero');
    const copy = st.doc.brief?.key_copy;
    const copyChanged = !!(hero && copy && hero.headline !== copy);
    if (copyChanged) hero.headline = copy;
    const ident = document.querySelector('.v2ident');
    if (ident) { ident.textContent = st.doc.title; ident.title = `기획안 목록으로 · ${st.doc.title}`; }
    document.querySelectorAll('[data-plan-title]').forEach(h => { h.textContent = st.doc.title; });   // 예시 제목 대신 지금 연 기획안 이름
    st.progress();
    tagLinks();
    say(`저장됨 ${String(st.doc.updated_at || '').slice(5, 16)}`);
    if (STEPS.includes(here) && (st.doc.v2.stage !== here || copyChanged)) st.save(d => { d.v2.stage = here; }, true);   // 홈 목록의 '지금 단계'
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
  // 저장이 안 되면(서버 꺼짐·다른 창에서 바뀜) 화면 아래에 계속 보이는 띠로 알리고, 고친 내용은 창에 그대로 둔다 (2026-11-14)
  //   · 서버 꺼짐·오류: 5초마다 자동으로 다시 시도 + [지금 다시 시도]. 서버를 다시 켜서 토큰이 바뀐 경우는 api.js가 새 토큰을 받아 그대로 저장된다
  //   · 다른 창에서 바뀜(서버가 409 stale): 실제로 달라진 게 없으면(단계 표시만 바뀜) 조용히 저장, 달라졌으면 [새로 불러오기] / [내 것으로 저장]을 고르게 한다
  // 저장 결과는 'plan:saved' 이벤트로도 알린다 (신규 구좌편집기가 실패 시 작성 내용을 임시 보관)
  let timer = null, chain = Promise.resolve(), failed = false, stale = false, retryT = null, base = null;
  // 내용 비교용 글: 저장 시각·단계 표시는 빼고, 키 순서와 상관없이 같게 (서버가 돌려준 것과 이 창의 것을 비교)
  const sorted = v => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v);
  const norm = d => { const c = JSON.parse(JSON.stringify(d || {})); delete c.updated_at; c.v2 = { cls: '', seed: '', keywords: [], ...(c.v2 || {}) }; delete c.v2.stage; return JSON.stringify(sorted(c)); };
  st.ready.then(d => { if (d) base = norm(d); });
  const bar = (msg, btns) => {
    let el = document.getElementById('v2savebar');
    if (!msg) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'v2savebar'; el.className = 'v2savebar'; el.setAttribute('role', 'alert'); document.body.append(el); }
    el.replaceChildren(Object.assign(document.createElement('span'), { textContent: msg }),
      ...btns.map(([t, fn, primary]) => { const b = Object.assign(document.createElement('button'), { type: 'button', className: `v2btn${primary ? ' primary' : ''}`, textContent: t }); b.addEventListener('click', fn); return b; }));
  };
  // 보낼 값: base_updated_at = 마지막으로 받은 저장 시각. editor_next(신규 구좌편집기 값)는 그 화면만 보낸다 (st.sendEditorNext). 안 보내면 서버가 저장된 값을 그대로 둔다
  st.body = force => {
    const { editor_next, ...rest } = st.doc;
    return { ...rest, base_updated_at: st.doc.updated_at || null, force: !!force, ...(st.sendEditorNext ? { editor_next } : {}) };
  };
  const tell = (ok, error) => dispatchEvent(new CustomEvent('plan:saved', { detail: ok ? { ok: true } : { ok: false, error } }));
  const send = force => v2api('/api/am/projects', st.body(force));
  const ok = d => { st.doc.updated_at = d.updated_at; base = norm(d); failed = stale = false; clearTimeout(retryT); bar(''); say(`저장했어요 ${String(d.updated_at).slice(11, 16)}`); st.progress(); tell(true); };
  const run = force => {
    timer = null; clearTimeout(retryT);
    chain = chain.then(() => send(force).then(ok).catch(async e => {
      if (e.code === 'stale') {
        let cur = null; try { cur = await v2api(`/api/am/projects/${st.id}`); } catch { /* 아래에서 묻는다 */ }
        if (cur && base && norm(cur) === base) { st.doc.updated_at = cur.updated_at; return send(false).then(ok); }   // 다른 창은 열기만 했음 → 내 것 저장
        stale = true; say('저장 못 했어요 · 다른 창에서 바뀜'); tell(false, e.message);
        bar('다른 창에서 이 기획안이 바뀌었어요. 여기서 고친 내용은 아직 저장되지 않았어요.', [
          ['새로 불러오기 (여기서 고친 것 버림)', () => { timer = null; stale = failed = false; location.reload(); }],
          ['내 것으로 저장', () => run(true), true]]);
        return null;
      }
      throw e;
    }).catch(e => {
      failed = true; say(`저장 못 했어요: ${e.message}`); tell(false, e.message);
      const off = !e.status;   // 응답 자체가 없음 = 서버가 꺼졌거나 연결이 끊김
      bar(off ? '저장하지 못했어요. 프로그램(서버 창)이 꺼져 있는 것 같아요. 이 창을 닫지 말고 프로그램을 다시 켜 주세요 — 켜지면 자동으로 저장해요.' : `저장하지 못했어요 (${e.message}). 고친 내용은 이 창에 남아 있어요.`,
        [['지금 다시 시도', () => run(false), true]]);
      retryT = setTimeout(() => { if (failed && !timer) run(false); }, 5000);
    }));
  };
  st.save = (mutate, now = false) => {
    if (!st.doc) return;
    if (mutate) mutate(st.doc);
    if (stale) return;   // 고를 때까지 저장을 미룬다 (고친 내용은 st.doc에 쌓인다)
    say('저장 중…');
    clearTimeout(timer);
    timer = setTimeout(run, now ? 0 : 700);
  };
  // 기다리는 저장을 바로 보내고, 끝날 때까지 기다림 (화면을 옮기기 전에)
  st.flush = () => { if (timer) { clearTimeout(timer); run(); } return chain; };
  // 탭 닫기·새로고침·주소 이동처럼 링크가 아닌 길로 떠날 때도 고친 내용을 잃지 않게 (2026-11-10)
  // 기다리는 저장이 있으면 keepalive 요청으로 마지막 상태를 보낸다. 너무 크면(64KB 제한) 브라우저의 '떠날까요?' 확인을 띄움.
  // 저장에 실패한 상태면 보내 봐야 또 실패하므로 '떠날까요?'를 띄운다
  addEventListener('beforeunload', e => {
    if (!st.doc || (!timer && !failed && !stale)) return;
    if (timer && !failed && !stale) {
      clearTimeout(timer); timer = null;
      const body = JSON.stringify(st.body());
      if (body.length < 60000) {
        try { fetch('/api/am/projects', { method: 'POST', keepalive: true, headers: { 'x-planner-token': V2_TOKEN, 'Content-Type': 'application/json' }, body }); return; } catch { /* 아래 확인으로 */ }
      }
    }
    e.preventDefault(); e.returnValue = '';
  });
  // 저장이 기다리는 중에 다른 화면 링크를 누르면, 저장을 마친 뒤 이동 (고친 내용이 사라지지 않게)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="/v2/"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (failed || stale) { e.preventDefault(); say('저장이 안 돼서 이동하지 않았어요 · 아래 안내를 봐 주세요'); document.getElementById('v2savebar')?.querySelector('button')?.focus(); return; }
    if (!timer) return;
    e.preventDefault();
    st.flush().then(() => { if (!failed && !stale) location.assign(a.getAttribute('href')); });
  });
  return st;
})();
