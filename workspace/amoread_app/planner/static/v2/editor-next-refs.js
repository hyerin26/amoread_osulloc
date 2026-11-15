// 신규 구좌편집기의 레퍼런스 추천 (2026-11-15). 기존 구좌 편집기의 [레퍼런스] 탭과 같은 일을 오른쪽 칸 [참고·인계 › 레퍼런스]에서 한다.
// 서버: POST /api/am/ai/references (구좌 하나에 맞는 수집 구좌 추천, 기존 편집기와 같은 요청) · POST /api/am/ai/feedback (붙임·뺌 기록 → 다음 추천 순서)
//       GET /api/am/ai/inspire/saved (오늘의 영감 보관함에 저장한 구좌)
// 저장: 기획안 page.sections[].v2.att = [{ref, note, name, page, from, url}] — 기존 편집기와 같은 칸이라
//       04 미리보기·내보내기의 '참고 레퍼런스'에 그대로 나오고, 예전 편집기에서 붙인 것도 여기서 보인다.
//       편집기 저장(editor-next-host.js enToLegacy)은 이전 page.sections의 v2를 이어 받으므로 이 값을 지우지 않는다.
// 화면: 편집기 자체의 레퍼런스 묶음은 앱 안에서 늘 비어 있어(가상 자료를 넣지 않음) 이 묶음으로 바꿔 보여 준다. 느낌 레퍼런스(색감·구도…) 칩은 그대로 둔다.
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cut = (v, n) => String(v ?? '').slice(0, n);
  const ED = () => window.AMOREAD_EDITOR_API;
  const snap = () => { try { return ED().exportSnapshot(); } catch { return null; } };
  const REC = new Map();     // 구좌 id + 유형 → { state: 'wait'|'ok'|'none'|'err', items: [] }
  const NOTE_OPEN = new Set();
  let doc = null, more = false, saved = null;   // saved: 영감 보관함 중 레퍼런스 구좌가 있는 것 (null = 아직 안 읽음)

  const secOf = id => ((doc && doc.page && doc.page.sections) || []).find(x => x.sectionId === id) || null;
  const attOf = id => { const s = secOf(id); return (s && s.v2 && Array.isArray(s.v2.att)) ? s.v2.att : []; };
  const keyOf = s => `${s.id}|${s.layout}`;

  async function load(s) {
    const k = keyOf(s);
    if (REC.has(k)) return;
    REC.set(k, { state: 'wait', items: [] });
    try {
      const res = await v2api('/api/am/ai/references', {
        section: { layoutId: cut(s.layout, 40), name: cut(s.name, 40), purpose: cut(s.role, 20) }, n: 8,
        doc: { id: doc.id || '', title: cut(doc.title, 80), brief: doc.brief || {}, v2: { cls: doc.v2?.cls || '', seed: doc.v2?.seed || '', keywords: doc.v2?.keywords || [] } } });
      REC.set(k, res.mode === 'ai' && res.items?.length ? { state: 'ok', items: res.items } : { state: 'none', items: [] });
    } catch (e) { REC.set(k, { state: 'err', items: [], error: e.message }); }
    paint();
  }
  async function loadSaved() {
    if (saved !== null) return;
    saved = [];
    try { saved = ((await v2api('/api/am/ai/inspire/saved')).items || []).filter(x => x.ref); } catch { /* 보관함이 없어도 추천은 그대로 */ }
    paint();
  }

  // 붙이기·빼기·메모 → 기획안에 저장 (기존 편집기와 같은 모양)
  function setAtt(id, fn) {
    if (!secOf(id)) return false;
    PLAN.save(d => {
      const s = (d.page?.sections || []).find(x => x.sectionId === id); if (!s) return;
      s.v2 = s.v2 && typeof s.v2 === 'object' ? s.v2 : {};
      s.v2.att = fn(Array.isArray(s.v2.att) ? s.v2.att : []).slice(0, 8);
    });
    return true;
  }
  const asAtt = r => ({ ref: cut(r.id, 80), note: '', name: cut(r.title || r.name, 60), page: cut(r.campaign || r.page, 60), from: cut(r.from, 10), url: /^https?:\/\//.test(r.url || '') ? cut(r.url, 300) : '' });
  const tell = (event, ref, s) => v2api('/api/am/ai/feedback', { event, doc_id: doc.id || '', ref_id: cut(ref, 80), section: cut(s.layout, 40) }).catch(() => {});

  // ── 그리기 ──
  const libLink = id => `<a class="am-ed-button am-ed-button--subtle am-ed-button--sm" href="/v2/library#open=${encodeURIComponent(id)}" target="_blank" rel="noopener">라이브러리에서 보기</a>`;
  function card(s, r, att) {
    const on = att.some(a => a.ref === r.id);
    return `<li class="en-ref${on ? ' is-on' : ''}">
      <div class="en-ref-t"><b>${esc(r.title)}</b><small>${esc([r.from, r.campaign].filter(Boolean).join(' · '))}</small></div>
      ${r.why || r.reason ? `<p class="en-ref-why">${esc(r.why || r.reason)}</p>` : ''}
      <div class="en-ref-act"><button type="button" class="am-ed-button am-ed-button--sm ${on ? 'am-ed-button--subtle' : 'am-ed-button--primary'}" data-en-ref-att="${esc(r.id)}" aria-pressed="${on}">${on ? '참고에서 빼기' : '참고로 붙이기'}</button>
        ${libLink(r.id)}${r.url ? `<a class="am-ed-button am-ed-button--subtle am-ed-button--sm" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">원본 ↗</a>` : ''}</div></li>`;
  }
  function html(s) {
    const att = attOf(s.id), rec = REC.get(keyOf(s)) || { state: 'wait', items: [] };
    const known = new Set(rec.items.map(r => r.id));
    let h = `<section class="am-ed-group en-refs" data-en-refs="${esc(s.id)}" aria-label="구좌 레퍼런스">
      <h3>구좌 레퍼런스</h3><p class="en-refs-sub">수집해 둔 자사몰·외부 페이지에서 이 구좌와 비슷한 구좌를 골랐어요. 붙인 것은 04 미리보기·인계에 함께 나가요.</p>`;
    if (!secOf(s.id)) return h + '<p class="am-ed-note">홈에서 저장된 기획안을 열면 레퍼런스를 추천받고 붙일 수 있어요.</p></section>';
    // 붙인 것 (메모 포함) — 추천 목록에 없는 것(예전 편집기·보관함에서 붙인 것)도 여기서 보인다
    if (att.length) {
      h += `<div class="en-refs-att"><span class="en-refs-cap">붙인 레퍼런스 ${att.length}개</span><ul>${att.map(a => `<li>
        <div class="en-ref-t"><b>${esc(a.name || '레퍼런스')}</b><small>${esc([a.from, a.page].filter(Boolean).join(' · '))}</small></div>
        ${NOTE_OPEN.has(a.ref) ? `<label class="en-ref-note"><span>참고할 것</span><input class="am-ed-input" maxlength="120" data-en-ref-note="${esc(a.ref)}" value="${esc(a.note)}" placeholder="예) 구도, 상품 배치, 이미지 톤"></label>` : a.note ? `<p class="en-ref-why">참고할 것 · ${esc(a.note)}</p>` : ''}
        <div class="en-ref-act"><button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-en-ref-noteopen="${esc(a.ref)}">${NOTE_OPEN.has(a.ref) ? '메모 닫기' : a.note ? '메모 고치기' : '메모 남기기'}</button>
          <button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-en-ref-att="${esc(a.ref)}" aria-pressed="true">빼기</button></div></li>`).join('')}</ul></div>`;
    }
    if (rec.state === 'wait') h += '<p class="am-ed-note" role="status">수집해 둔 레퍼런스에서 찾는 중이에요…</p>';
    else if (rec.state === 'err') h += `<p class="am-ed-note am-ed-note--warning" role="alert">추천을 불러오지 못했어요 (${esc(rec.error)}). <button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm" data-en-ref-retry>다시 찾기</button></p>`;
    else if (rec.state === 'none') h += '<p class="am-ed-note">아직 추천할 수집 구좌가 없어요. 레퍼런스 화면에서 페이지를 수집하면 여기에 나와요. <a class="lnk" href="/v2/library" target="_blank" rel="noopener">레퍼런스 열기</a></p>';
    else {
      const top = rec.items.slice(0, 3), rest = rec.items.slice(3);
      h += `<span class="en-refs-cap">추천</span><ul class="en-refs-list">${top.map(r => card(s, r, att)).join('')}</ul>`;
      if (rest.length) h += `<button type="button" class="am-ed-button am-ed-button--subtle am-ed-button--sm en-refs-more" data-en-ref-more aria-expanded="${more}">${more ? '더 보기 닫기' : `추천 더 보기 (${rest.length})`}</button>
        ${more ? `<ul class="en-refs-list">${rest.map(r => card(s, r, att)).join('')}</ul>` : ''}`;
    }
    // 오늘의 영감 보관함에 저장한 구좌 (추천에 이미 있는 것은 빼고)
    const fromBox = (saved || []).filter(x => !known.has(x.ref)).slice(0, 6);
    if (fromBox.length) {
      h += `<span class="en-refs-cap">오늘의 영감 보관함</span><ul class="en-refs-list">${fromBox.map(x => card(s, { id: x.ref, title: x.psec || x.title, from: x.brand, campaign: x.campaign, url: x.url, why: x.memo ? `메모 · ${x.memo}` : x.kind_name }, att)).join('')}</ul>`;
    }
    return h + '</section>';
  }

  // 오른쪽 칸이 [레퍼런스]를 보여 줄 때만 (느낌 레퍼런스 칩 data-mood가 있는 화면 = 편집기의 refsPanel)
  function mount() {
    const body = document.getElementById('panel-body'), sn = snap();
    const old = body && body.querySelector('[data-en-refs]');
    if (!body || !sn || !body.querySelector('[data-mood]')) { if (old) old.remove(); return; }
    const s = (sn.sections || []).find(x => x.id === sn.current); if (!s) return;
    if (old && old.dataset.enRefs === s.id) return;
    if (old) old.remove();
    const native = [...body.querySelectorAll('.am-ed-group')].find(g => !g.querySelector('[data-mood]') && !g.querySelector('.am-ed-ref'));
    if (native) native.hidden = true;   // 앱 안에서는 늘 빈 편집기 자체 묶음
    body.insertAdjacentHTML('afterbegin', html(s));
    if (doc) { load(s); loadSaved(); }
  }
  function paint() {
    const el = document.querySelector('[data-en-refs]'), sn = snap(); if (!el || !sn) return;
    const s = (sn.sections || []).find(x => x.id === el.dataset.enRefs); if (!s) return;
    const focus = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset : null;
    el.outerHTML = html(s);
    if (focus) { const k = Object.keys(focus)[0]; const back = k && document.querySelector(`[data-en-refs] [data-${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}="${CSS.escape(focus[k])}"]`); if (back) back.focus(); }
  }

  document.addEventListener('click', e => {
    const box = e.target.closest('[data-en-refs]'); if (!box) return;
    const sn = snap(), s = sn && (sn.sections || []).find(x => x.id === box.dataset.enRefs); if (!s) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-en-ref-more')) { more = !more; paint(); return; }
    if (b.hasAttribute('data-en-ref-retry')) { REC.delete(keyOf(s)); load(s); paint(); return; }
    if (b.dataset.enRefNoteopen) { const k = b.dataset.enRefNoteopen; NOTE_OPEN.has(k) ? NOTE_OPEN.delete(k) : NOTE_OPEN.add(k); paint(); if (NOTE_OPEN.has(k)) document.querySelector(`[data-en-ref-note="${CSS.escape(k)}"]`)?.focus(); return; }
    const id = b.dataset.enRefAtt; if (!id) return;
    const on = attOf(s.id).some(a => a.ref === id);
    const rec = (REC.get(keyOf(s))?.items || []).find(r => r.id === id) || (() => { const x = (saved || []).find(v => v.ref === id); return x && { id, title: x.psec || x.title, from: x.brand, campaign: x.campaign, url: x.url }; })();
    if (!on && attOf(s.id).length >= 8) { b.textContent = '8개까지 붙일 수 있어요'; return; }
    if (!setAtt(s.id, list => on ? list.filter(a => a.ref !== id) : rec ? [...list, asAtt(rec)] : list)) return;
    tell(on ? 'drop_ref' : 'pick_ref', id, s);
    if (on) NOTE_OPEN.delete(id);
    paint();
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-en-ref-note]'); if (!el) return;
    const box = el.closest('[data-en-refs]'), ref = el.dataset.enRefNote;
    setAtt(box.dataset.enRefs, list => list.map(a => (a.ref === ref ? { ...a, note: cut(el.value, 120) } : a)));
  }, true);
  // 편집기 키보드 단축키(Delete·Ctrl+Z)와 편집기 자체 입력 처리가 이 묶음 안 입력을 가로채지 않게
  for (const t of ['keydown', 'input', 'change']) document.addEventListener(t, e => { if (e.target.closest && e.target.closest('[data-en-refs]')) e.stopPropagation(); }, true);

  document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('panel-body');
    if (body) new MutationObserver(() => mount()).observe(body, { childList: true });
    PLAN.ready.then(d => { doc = d; document.querySelector('[data-en-refs]')?.remove(); mount(); });
    mount();
  });
})();
