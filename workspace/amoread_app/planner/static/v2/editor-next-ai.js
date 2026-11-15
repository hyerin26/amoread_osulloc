// 신규 구좌편집기의 AI 카피 추천 (2026-11-15, plans/27 §13)
// 서버: 저장소 루트 멘트추천기능/ (POST /api/am/copy/jobs → GET /jobs/{id} 반복 → 결과 3개). Claude 호출은 서버가 하고 키는 브라우저에 없음.
// 화면: 오른쪽 칸 [내용 › 문구]의 '고객에게 보이는 글' 설명 입력칸 아래. 고른 안은 제목·설명 입력칸에 넣고 input 이벤트를 보내
//       편집기의 원래 저장·실행 취소를 그대로 탄다. 적용 기록은 page.sections[].v2.copyRecommendation (editor-next-host.js enToLegacy)
// 서버는 저장된 page.sections에서 구좌를 찾으므로 요청 전에 기다리는 저장을 먼저 보낸다 (PLAN.flush)
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TARGETS = [['both', '제목·설명 함께'], ['headline', '제목만'], ['subhead', '설명만'], ['polish', '지금 설명 다듬기']];
  const TONES = ['브랜드 기본', '담백하게', '감성적으로'];
  const S = new Map();   // 구좌 id → 상태 (다른 구좌로 옮겨도 결과를 보관)
  const st = id => { if (!S.has(id)) S.set(id, { target: 'both', tone: '브랜드 기본', busy: false, result: null, error: '', stale: false, run: 0, job: null, fp: null, applied: null }); return S.get(id); };
  let doc = null, avail = null;   // avail: null=확인 중, {available:bool}
  const token = () => (document.querySelector('meta[name="planner-token"]') || {}).content || '';
  async function api(path, body) {
    const r = await fetch('/api/am/copy' + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'x-planner-token': token(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    let data = {}; try { data = await r.json(); } catch { /* 빈 응답 */ }
    if (!r.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.error || '추천 요청을 처리하지 못했어요.');
    return data;
  }
  const ED = () => window.AMOREAD_EDITOR_API;
  const section = id => { try { return (ED().exportSnapshot().sections || []).find(s => s.id === id) || null; } catch { return null; } };
  const currentId = () => { try { return ED().exportSnapshot().current; } catch { return null; } };
  const seqsOf = s => (s.productIds || []).map(String).filter(x => /^\d{1,12}$/.test(x));
  const fingerprint = s => JSON.stringify([s.name || '', s.role || '', s.layout, seqsOf(s)]);

  // ── 그리기 ────────────────────────────────────────────────────────────
  function html(id) {
    const x = st(id), live = !!doc, off = avail && !avail.available;
    const sel = (k, opts) => `<select class="am-ed-select" data-en-ai="${k}" ${x.busy ? 'disabled' : ''} aria-label="${k === 'target' ? '무엇을 추천받을지' : '말투'}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${x[k] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    let h = `<section class="en-ai" data-en-ai-sec="${esc(id)}" aria-label="AI 카피 추천">
      <div class="en-ai-head"><b>AI 카피 추천</b><small>Claude · 고르기 전에는 지금 문구를 바꾸지 않아요</small></div>
      <div class="en-ai-ctl">${sel('target', TARGETS)}${sel('tone', TONES.map(t => [t, t]))}</div>
      <div class="en-ai-act"><button type="button" class="am-ed-button ${x.result ? 'am-ed-button--subtle' : 'am-ed-button--primary'}" data-en-ai-go ${x.busy || off || !live || avail === null ? 'disabled' : ''}>${x.busy ? '만드는 중…' : x.result ? '다시 추천' : '추천 받기'}</button>${x.busy ? '<button type="button" class="am-ed-button am-ed-button--subtle" data-en-ai-cancel>취소</button>' : ''}</div>`;
    if (!live) h += '<p class="en-ai-note">홈에서 저장된 기획안을 열면 쓸 수 있어요. 예시 화면은 AI에 보내지 않아요.</p>';
    else if (avail === null) h += '<p class="en-ai-note" role="status">연결 확인 중…</p>';
    else if (off) h += '<p class="en-ai-err" role="status">AI 연결이 준비되지 않았어요 (서버에 Claude SDK 없음). README 6번을 확인해 주세요.</p>';
    if (x.busy) h += '<p class="en-ai-note" role="status" aria-live="polite">지금 문구는 그대로 둔 채 만드는 중이에요. 다른 구좌로 옮겨도 이 구좌 결과로 보관해요.</p>';
    if (x.error) h += `<p class="en-ai-err" role="alert">${esc(x.error)}</p>`;
    if (x.stale && x.result) h += '<p class="en-ai-err">추천 뒤에 제목·설명·상품이 바뀌었어요. 지금 내용으로 다시 추천해 주세요.</p>';
    if (x.result) {
      const r = x.result, label = Object.fromEntries((r.sources || []).map(s => [s.id, s.text]));
      if (r.task === 'polish') h += `<div class="en-ai-orig"><small>다듬기 전</small><p>${esc(r.original_text)}</p></div>`;
      h += '<ol class="en-ai-list">' + r.items.map(it => {
        const head = r.task !== 'polish' && r.target !== 'subhead', sub = r.target !== 'headline';
        const btn = r.task === 'polish' ? '이 설명 쓰기' : r.target === 'headline' ? '제목에 쓰기' : r.target === 'subhead' ? '설명에 쓰기' : '제목·설명에 쓰기';
        return `<li class="en-ai-cand${x.applied === it.candidate_id ? ' is-applied' : ''}">
          <div class="en-ai-angle">${esc(it.angle)}${x.applied === it.candidate_id ? ' <span>적용함</span>' : ''}</div>
          ${head ? `<p class="en-ai-h">${esc(it.headline)}</p>` : ''}${sub ? `<p class="en-ai-s">${esc(it.subhead)}</p>` : ''}
          <div class="en-ai-row"><small>${head ? `제목 ${it.headline.length}자` : ''}${head && sub ? ' · ' : ''}${sub ? `설명 ${it.subhead.length}자` : ''}</small>
            <button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-en-ai-apply="${esc(it.candidate_id)}" ${x.stale || x.busy ? 'disabled' : ''}>${btn}</button></div>
          <details><summary>근거</summary><ul>${(it.basis || []).map(k => `<li>${esc(label[k] || k)}</li>`).join('')}</ul></details></li>`;
      }).join('') + '</ol>';
      if ((r.warnings || []).length) h += `<ul class="en-ai-warn">${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
      h += '<p class="en-ai-note">AI 초안이에요. 게시 전에 혜택·상품 사실과 표현을 확인해 주세요. 원가·매출·후기는 보내지 않아요.</p>';
    }
    return h + '</section>';
  }
  // 오른쪽 칸이 고른 구좌의 [문구]를 보여 줄 때만, 설명 입력칸 바로 아래에 붙인다
  function mount() {
    const body = document.getElementById('panel-body');
    const role = body && body.querySelector('textarea[data-bind="role"]');
    const old = body && body.querySelector('[data-en-ai-sec]');
    const id = currentId();
    if (!role || !id) { if (old) old.remove(); return; }
    const anchor = role.closest('.am-ed-field') || role;
    if (old && old.dataset.enAiSec === id && old.previousElementSibling === anchor) return;
    if (old) old.remove();
    anchor.insertAdjacentHTML('afterend', html(id));
  }
  const paint = id => { const el = document.querySelector(`[data-en-ai-sec="${CSS.escape(id)}"]`); if (el) el.outerHTML = html(id); };

  // ── 추천 · 취소 · 적용 ─────────────────────────────────────────────────
  async function generate(id) {
    const x = st(id); if (x.busy || !doc) return;
    x.busy = true; x.error = ''; x.result = null; x.applied = null; x.stale = false; x.run += 1; const run = x.run; paint(id);
    try {
      await PLAN.flush();   // 서버가 저장된 page.sections에서 이 구좌를 찾는다
      if (x.run !== run) return;
      const s = section(id); if (!s) throw new Error('구좌를 찾지 못했어요.');
      if (x.target === 'polish' && !String(s.role || '').trim()) throw new Error('다듬을 설명을 먼저 써 주세요.');
      x.fp = fingerprint(s);
      let job = await api('/jobs', { task: x.target === 'polish' ? 'polish' : 'suggest', scope: 'section', project_id: doc.id,
        target: x.target === 'polish' ? 'subhead' : x.target, tone: x.tone,
        draft: { section_id: s.id, headline: String(s.name || '').slice(0, 120), subhead: String(s.role || '').slice(0, 400), layout_id: s.layout, scope: String(s.scope || '').slice(0, 200), product_seqs: seqsOf(s).slice(0, 40) } });
      if (x.run !== run) { api(`/jobs/${job.id}/cancel`, {}).catch(() => {}); return; }
      x.job = job.id;
      while (job.status === 'running') {
        await new Promise(r => setTimeout(r, 1200));
        if (x.run !== run) return;
        job = await api(`/jobs/${x.job}`);
      }
      if (job.status !== 'done') throw new Error(job.error || '추천을 끝내지 못했어요.');
      const r = job.result;
      if (!r || r.section_id !== id || !Array.isArray(r.items) || !r.items.length) throw new Error('추천 결과 형식이 올바르지 않아요.');
      x.result = r;
    } catch (e) { if (x.run === run) x.error = e.message; }
    finally { if (x.run === run) { x.busy = false; x.job = null; check(id); paint(id); } }
  }
  async function cancel(id) {
    const x = st(id), job = x.job; x.run += 1; x.busy = false; x.job = null; x.error = '요청을 취소했어요.'; paint(id);
    if (job) api(`/jobs/${job}/cancel`, {}).catch(e => { x.error = e.message; paint(id); });
  }
  function apply(id, cid) {
    const x = st(id); if (!x.result || x.busy) return;
    check(id); if (x.stale) { paint(id); return; }
    const r = x.result, it = r.items.find(c => c.candidate_id === cid); if (!it) return;
    if (currentId() !== id) { x.error = '이 구좌를 다시 고른 뒤 적용해 주세요.'; paint(id); return; }
    const body = document.getElementById('panel-body');
    const set = (bind, v) => { const el = body.querySelector(`textarea[data-bind="${bind}"]`); if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    window.EN_AI_META[id] = { request_id: r.request_id, candidate_id: it.candidate_id, task: r.task || 'suggest', model: r.model,
      prompt_version: r.prompt_version, basis: it.basis, applied_at: new Date().toISOString() };
    if (r.task !== 'polish' && r.target !== 'subhead') set('name', it.headline);
    if (r.target !== 'headline') set('role', it.subhead);
    x.fp = fingerprint(section(id) || {}); x.stale = false; x.applied = cid; x.error = '';
    mount(); paint(id);
  }
  // 손으로 고치면 '추천 뒤 바뀜' 표시 (다시 그리지 않고 표시만 — 입력 중 커서 유지)
  function check(id) {
    const x = st(id); if (!x.fp) return;
    const s = section(id); x.stale = !s || fingerprint(s) !== x.fp;
    const el = document.querySelector(`[data-en-ai-sec="${CSS.escape(id)}"]`);
    if (el) el.querySelectorAll('[data-en-ai-apply]').forEach(b => { b.disabled = x.stale || x.busy; });
  }

  document.addEventListener('click', e => {
    const box = e.target.closest('[data-en-ai-sec]'); if (!box) return;
    const id = box.dataset.enAiSec;
    if (e.target.closest('[data-en-ai-go]')) generate(id);
    else if (e.target.closest('[data-en-ai-cancel]')) cancel(id);
    else { const b = e.target.closest('[data-en-ai-apply]'); if (b) apply(id, b.dataset.enAiApply); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-en-ai]'); if (!el) return;
    const id = el.closest('[data-en-ai-sec]').dataset.enAiSec, x = st(id);
    x[el.dataset.enAi] = el.value; x.result = null; x.error = ''; x.stale = false; paint(id);
  });
  // 편집기 입력은 AI 상자 밖에서 일어남: 'input'이 편집기 저장 처리로 먼저 간 뒤 확인
  document.addEventListener('input', e => { if (e.target.closest('[data-en-ai-sec]')) return; queueMicrotask(() => { const id = currentId(); if (id && S.has(id)) check(id); }); });
  // 편집기 키보드 단축키(Delete·Ctrl+Z)가 AI 상자 안 입력을 가로채지 않게
  document.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('[data-en-ai-sec]')) e.stopPropagation(); }, true);

  document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('panel-body');
    if (body) new MutationObserver(() => mount()).observe(body, { childList: true });
    PLAN.ready.then(d => { doc = d; const id = currentId(); if (id) paint(id); mount(); });
    api('/status').then(s => { avail = s; }).catch(() => { avail = { available: false }; })
      .finally(() => { const id = currentId(); if (id) paint(id); });
    mount();
  });
})();
