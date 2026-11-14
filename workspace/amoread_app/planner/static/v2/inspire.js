// 오늘의 영감: 카드를 한 장씩 넘겨 보며 저장(오른쪽)·넘기기(왼쪽). 카드를 고르고 분류하는 일은 서버(amoread/ai/inspire.py)가 한다.
// 카드 한 장 = 왼쪽 '실제 페이지의 그 자리'(형광 표시) + 오른쪽 '무엇을·왜'(분류마다 모양이 다름) + '좋은지 판단할 근거'
// 손이 덜 가게: 밀기·버튼·키보드(←/→/Z) 모두 되고, 누를 때마다 바로 서버에 기록한다 (창을 닫아도 본 데까지 남는다)
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
let CARDS = [], idx = 0, total = 0, left = 0, last = null, busy = false, view = 'deck', SAVED = [], KINDS = {}, sKind = '', state = 'loading', err = '', pending = 0, fetching = false;
let toastT;
function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
const isNew = c => c.src === 'new';
const dayLabel = d => { if (!d) return ''; const n = Math.round((new Date(new Date().toDateString()) - new Date(`${d.slice(0, 10)}T00:00:00`)) / 864e5); return n <= 0 ? '오늘 올라옴' : n === 1 ? '어제 올라옴' : n <= 7 ? `${n}일 전 올라옴` : ''; };
// 분류마다 아이콘 (색은 CSS의 .k-분류)
const ICON = {
  mech: '<path d="M4 9h16v11H4zM12 9v11M4 13h16M8.5 9C6 9 5.5 5 8 5c2 0 4 4 4 4M15.5 9C18 9 18.5 5 16 5c-2 0-4 4-4 4"/>',
  copy: '<path d="M9 7H5v6h4v-2H7V9h2zM19 7h-4v6h4v-2h-2V9h2zM5 17h14"/>',
  struct: '<path d="M5 4h14v4H5zM5 10h14v4H5zM5 16h14v4H5z"/>',
  design: '<path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5"/><circle cx="9" cy="9" r="1.4"/>',
};
const KIND_SAY = { mech: '할인 말고 다른 방법으로 파는 방식', copy: '참고할 만한 문장', struct: '혜택을 나눠 보여 주는 짜임', design: '화면 구성·분위기' };
const icon = k => `<svg class="kic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.design}</svg>`;
// 글 안에서 찾은 낱말만 형광으로
const markHit = (text, hit) => { const i = hit ? text.indexOf(hit) : -1; return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(hit)}</mark>${esc(text.slice(i + hit.length))}`; };

// ---------- 카드 한 장 ----------
// 오른쪽 글: 제목 하나(이 카드가 말하는 것) → 설명 → 이 페이지에서 쓴 문장 → 판단 근거. 한 화면에 강조는 제목 하나뿐
const CHECK = '<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function headline(c) {
  if (c.kind === 'mech') return (c.hits || [])[0]?.name || (c.tags || [])[0] || c.title;
  if (c.kind === 'copy') return `“${(c.phrases || [])[0] || c.title}”`;
  if (c.kind === 'struct') return c.struct || c.title;
  return c.title;
}
// 인용문은 표시한 자리에서 실제로 읽은 화면 글을 쓴다 → 오른쪽에 적힌 글과 왼쪽에 표시한 자리가 늘 같은 곳이다
const seenText = c => { const t = c.spot?.txt || ''; return t.length > 150 ? `${t.slice(0, 150)}…` : t; };
function lead(c) {
  if (c.kind === 'mech') {
    const hs = c.hits || [], more = hs.slice(1).map(h => h.name);
    return `${c.desc ? `<p class="body">${esc(c.desc)}</p>` : ''}
      ${hs[0] ? `<figure class="used"><figcaption>이 페이지에서는</figcaption><blockquote>${markHit(seenText(c) || hs[0].snip, hs[0].hit)}</blockquote></figure>` : ''}
      ${more.length ? `<p class="also">함께 쓴 방식 <b>${more.map(esc).join(', ')}</b></p>` : ''}`;
  }
  if (c.kind === 'copy') { const rest = (c.phrases || []).slice(1, 3); return rest.length ? `<ul class="lines">${rest.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''; }
  if (c.kind === 'struct') return `<p class="body">혜택을 한 번에 쏟지 않고 단계로 나눠, 아래로 내려갈수록 하나씩 보여 줘요.</p>
    <ol class="steps">${(c.steps || []).map((s, i) => `<li><b>${i + 1}</b><span>${esc(s)}</span></li>`).join('')}</ol>`;
  return `<p class="body">화면 구성과 분위기를 참고해 보세요.</p>${(c.phrases || []).length ? `<ul class="lines">${c.phrases.slice(0, 2).map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}`;
}
// 참고 포인트: 왜 볼 만한지 + 오설록이라면 (서버가 규칙으로 만든 한두 줄)
function note(c) {
  const n = c.note; if (!n || (!n.why && !n.do)) return '';
  return `<div class="note">${n.why ? `<p><b>왜 볼 만한가</b>${esc(n.why)}</p>` : ''}${n.do ? `<p><b>오설록이라면</b>${esc(n.do)}</p>` : ''}</div>`;
}
function signals(c) {
  const s = (c.signals || []).filter(x => !(c.note?.why && /^오설록/.test(x.t)));   // '오설록이 써 봤나'는 참고 포인트가 이미 말한다
  return s.length ? `<ul class="sig">${s.map(x => `<li class="${x.good ? 'good' : ''}">${x.good ? CHECK : '<i></i>'}${esc(x.t)}</li>`).join('')}</ul>` : '';
}
// 왼쪽: 실제 페이지. 사진이 있으면 그 사진을 그대로(안에서 위아래로 넘겨 볼 수 있음), 없으면 수집본을 다시 그린 화면(이미지 없음), 그것도 없으면 안내
function shot(c, live = true) {
  const cap = `<div class="shotcap"><span>실제 페이지</span>${c.shot || c.page ? `<button class="lnk" data-whole="${esc(c.id)}">크게 보기</button>` : ''}</div>`;
  if (c.shot) return `<div class="shot">${cap}<div class="phone scroll" ${live ? `data-shot="${esc(c.id)}"` : ''} tabindex="0" aria-label="실제 페이지 화면 (위아래로 넘겨 볼 수 있어요)"><div class="pgimg tiles">${live ? tilesHtml(c) : ''}</div></div></div>`;
  if (c.page) return `<div class="shot">${cap}<div class="phone"><span class="crop"${live ? ' data-spot' : ''}></span></div><p class="shotnote">이미지 없이 다시 그린 화면이에요</p></div>`;
  return `<div class="shot">${cap}<div class="phone"><span class="noscr"><b>아직 화면을 안 받았어요</b>오른쪽의 [화면 받아 오기]를 누르면 실제 모습을 볼 수 있어요.${c.url ? `<a class="btn xs" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">원본에서 보기 ↗</a>` : ''}</span></div></div>`;
}
// 사진은 화면 높이만큼씩 나눠 찍은 여러 장이다 → y 위치에 차례로 쌓는다 (자리·크기는 placeTiles가 폭에 맞춰 정함)
const tilesOf = c => (c.tiles && c.tiles.length ? c.tiles : c.shot ? [{ src: c.shot, y: 0, h: c.shot_h || 0 }] : []);
const tilesHtml = (c, lazy = false) => tilesOf(c).map(t => `<img src="${esc(t.src)}" alt="" draggable="false" data-y="${t.y}" data-h="${t.h}"${lazy ? ' loading="lazy"' : ''}>`).join('');
// 자리·크기는 전부 비율(%)로 준다: 창 크기가 바뀌어도 사진이 찌그러지지 않고 표시도 같이 따라간다 (px로 고정하면 폭만 늘어나 가로로 늘어졌음)
function placeTiles(wrap, c) {
  const H = c.shot_h || 1;
  wrap.style.aspectRatio = `390 / ${H}`; wrap.style.height = '';
  wrap.querySelectorAll('img').forEach(im => { im.style.top = `${+im.dataset.y / H * 100}%`; im.style.height = ''; });
}
function markSpot(wrap, c, pad = 4) {
  wrap.querySelector('.hl')?.remove();
  if (!c.spot) return;
  const H = c.shot_h || 1, hl = document.createElement('span'); hl.className = 'hl';
  hl.style.top = `calc(${c.spot.y / H * 100}% - ${pad}px)`; hl.style.height = `calc(${c.spot.h / H * 100}% + ${pad * 2}px)`;
  wrap.append(hl);
}
function metaLine(c) {
  const fresh = isNew(c) ? dayLabel(c.first_seen) : '모아 둔 구좌';
  return `<p class="metaline"><b>${esc(c.brand)}</b>${fresh ? `<span>${fresh}</span>` : ''}<span class="ttl" title="${esc(c.title)}">${esc(c.campaign && c.campaign !== c.title ? c.campaign : c.title)}</span></p>`;
}
function cardHtml(c, cls = '') {
  return `<article class="icard k-${esc(c.kind)} ${cls}" data-id="${esc(c.id)}">
    <span class="stamp save" aria-hidden="true">저장</span><span class="stamp pass" aria-hidden="true">넘기기</span>
    ${shot(c, cls !== 'is-under')}
    <div class="info">
      <div class="kline"><span class="kind">${icon(c.kind)}${esc(c.kind_name)}</span>${c.kind !== 'design' && c.grade ? `<span class="grade g${c.grade}">${c.grade === 3 ? '★ ' : ''}${esc(c.grade_name)}</span>` : ''}</div>
      <h2>${esc(headline(c))}</h2>
      ${lead(c)}
      ${note(c)}
      ${signals(c)}
      <div class="foot">${metaLine(c)}${c.url ? `<a class="orig" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">원본 열기 ↗</a>` : ''}</div>
    </div></article>`;
}
// 사진 위에 표시 얹기: 사진 폭에 맞춰 줄인 비율로 자리(y·h)를 옮기고, 그 자리가 가운데쯤 오게 미리 내려 둔다
function placeShot(box, c) {
  const img = box.querySelector('img'), wrap = box.querySelector('.pgimg'); if (!img || !wrap) return;
  const go = () => {
    const k = wrap.clientWidth / 390;
    placeTiles(wrap, c); markSpot(wrap, c);
    if (c.spot) box.scrollTop = Math.max(0, c.spot.y * k - Math.max(40, (box.clientHeight - c.spot.h * k) / 2.6));
  };
  go();
  img.addEventListener('error', () => { box.innerHTML = '<span class="noscr">화면을 불러오지 못했어요</span>'; }, { once: true });
}
// 사진이 없는 카드: 수집본을 다시 그려 그 자리를 보여 준다 (이미지는 회색 칸)
const SPOT = new Map();   // 카드 id → { y, h }
const fallbackOf = c => (isNew(c) ? null : { t: (c.text || '').slice(0, 120), n: c.tl || 0 });
async function drawSpot(root, c) {
  const sb = root?.querySelector('[data-shot]'); if (sb) { placeShot(sb, c); return; }
  const box = root?.querySelector('[data-spot]'); if (!box) return;
  try { const r = await Cap.spot(box, c.page, [c.focus, ...(c.focus_alt || [])], fallbackOf(c)); if (r) SPOT.set(c.id, r); }
  catch (e) { const ph = box.closest('.phone'); if (ph?.isConnected) ph.innerHTML = '<span class="noscr">화면을 불러오지 못했어요</span>'; }
}
// 크게 보기: 페이지 전체를 원래 폭(390)으로, 같은 자리에 표시
async function openWhole(id) {
  const c = [...CARDS, ...SAVED].find(x => x.id === id); if (!c || !(c.shot || c.page)) return;
  $('#pgH').textContent = c.campaign && c.campaign !== c.title ? c.campaign : c.title;
  $('#pgS').textContent = `${c.brand} · ${c.shot ? '받아 둔 실제 화면이에요.' : '이미지 없이 다시 그린 화면이에요.'} 노란 표시가 이 카드가 말하는 자리예요.`;
  const body = $('#pgB');
  $('#pgDlg').showModal();
  if (c.shot) {
    body.innerHTML = `<div class="pgwrap tiles">${tilesHtml(c)}</div>`; placeTiles(body.querySelector('.pgwrap'), c); markSpot(body.querySelector('.pgwrap'), c);
    if (c.spot) body.scrollTop = Math.max(0, c.spot.y * (body.querySelector('.pgwrap').clientWidth / 390) - 160);
    return;
  }
  body.innerHTML = '<div class="pgwrap"><div class="pgframe"></div></div>';
  try {
    await Cap.mount(body.querySelector('.pgframe'), c.page);
    let at = SPOT.get(id);
    if (!at) { const fb = fallbackOf(c), a = await Cap.locate(c.page, c.focus || fb?.t || '', Math.max(12, c.focus ? c.focus.length : fb?.n || 0), 8).catch(() => null); if (a) at = { ...a, found: true }; }
    if (at?.found) { const hl = document.createElement('span'); hl.className = 'hl'; hl.style.top = `${at.y - 4}px`; hl.style.height = `${at.h + 8}px`; body.querySelector('.pgwrap').append(hl); hl.scrollIntoView({ block: 'center' }); }
  } catch (e) { body.innerHTML = `<p class="hint">화면을 불러오지 못했어요: ${esc(e.message)}</p>`; }
}

// ---------- 덱 ----------
function renderDeck() {
  const st = $('#stack'), done = idx >= CARDS.length;
  $('#acts').hidden = state !== 'ok' || done; document.querySelector('.keys').hidden = $('#acts').hidden;
  $('#btnUndo').disabled = !last || busy;
  $('#progT').textContent = state !== 'ok' ? '' : done ? `오늘 ${CARDS.length}장을 다 봤어요` : `${idx + 1} / ${CARDS.length}`;
  $('#progB').style.width = CARDS.length ? `${Math.min(100, idx / CARDS.length * 100)}%` : '0';
  const nb = $('#noscr');
  nb.hidden = state !== 'ok' || (!pending && !fetching);
  if (!nb.hidden) nb.innerHTML = fetching ? '<span>후보의 실제 화면을 받아 확인하는 중이에요… <b id="pfT"></b> 끝나면 확인된 카드가 채워져요.</span>'
    : `<span>화면으로 아직 확인하지 않은 후보가 <b>${pending}개</b> 있어요. 확인된 것만 카드로 보여 드려요.</span><button class="btn xs" data-prefetch>12개 더 확인하기 (6분쯤)</button>`;
  if (state === 'loading') { st.innerHTML = '<div class="iempty">카드를 고르는 중이에요…</div>'; return; }
  if (state === 'err') { st.innerHTML = `<div class="iempty warn">카드를 불러오지 못했어요 (${esc(err)}).<button class="btn sm" data-reload>다시 불러오기</button></div>`; return; }
  if (!CARDS.length && pending) { st.innerHTML = `<div class="iempty"><b>확인된 카드가 아직 없어요</b>카드는 실제 화면에서 근거가 보이는 것만 보여 드려요. 후보 ${pending}개가 확인을 기다리고 있어요.${fetching ? '<span>확인하는 중이에요…</span>' : '<button class="btn sm primary" data-prefetch>후보 12개 확인하기 (6분쯤)</button>'}</div>`; return; }
  if (!CARDS.length) { st.innerHTML = `<div class="iempty"><b>지금 보여 드릴 새 카드가 없어요</b>${total ? '모아 둔 것을 전부 보셨어요. 내일 아침 새 프로모션이 올라오면 다시 채워져요.' : '레퍼런스 화면의 [신규 프로모션 찾기]나 [수집]으로 모으면 여기에 카드가 생겨요.'}<a class="btn sm" href="/v2/library">레퍼런스로 가기</a></div>`; return; }
  if (done) {
    const n = CARDS.filter(c => c._act === 'save').length;
    st.innerHTML = `<div class="iempty done"><b>오늘 카드를 다 봤어요</b>${CARDS.length}장 중 ${n}장을 저장했어요.${left > 0 ? ` 아직 안 본 카드가 ${left}장 더 있어요.` : ''}
      <span class="row">${n ? '<button class="btn sm primary" data-goto="saved">보관함 보기</button>' : ''}${left > 0 ? '<button class="btn sm" data-more>12장 더 보기</button>' : ''}</span></div>`;
    return;
  }
  // 맨 위 카드 + 그 아래 한 장만 그린다 (아래 카드는 밀 때 살짝 보임)
  st.innerHTML = (CARDS[idx + 1] ? cardHtml(CARDS[idx + 1], 'is-under') : '') + cardHtml(CARDS[idx], 'is-top');
  drawSpot(st.querySelector('.icard.is-top'), CARDS[idx]);
  bindDrag(st.querySelector('.icard.is-top'));
}
function renderTaste(t) {
  if (!t) return;
  const seen = t.saved + t.passed;
  $('#taste').innerHTML = `<h3>카드 종류</h3>
    <ul class="legend">${Object.entries(KINDS).map(([k, n]) => `<li class="k-${k}">${icon(k)}<span><b>${esc(n)}</b>${KIND_SAY[k] || ''}</span></li>`).join('')}</ul>
    <h3>취향 반영</h3>
    ${seen < 6 ? `<p class="cap">아직 ${seen}장만 봤어요. 몇 장 더 넘기면 자주 저장하는 종류를 앞에 보여 드려요.</p>`
    : `${t.likes.length ? `<p class="tl"><span>자주 저장</span>${t.likes.map(esc).join(', ')}</p>` : ''}${t.passes.length ? `<p class="tl"><span>자주 넘김</span>${t.passes.map(esc).join(', ')}</p>` : ''}
       ${!t.likes.length && !t.passes.length ? '<p class="cap">아직 뚜렷한 취향이 안 보여요. 골고루 보여 드릴게요.</p>' : ''}
       <p class="cap">저장 ${t.saved}장 · 넘김 ${t.passed}장</p>`}
    ${seen ? '<button class="lnk" data-reset>취향 기록 지우기</button>' : ''}`;
}
async function loadDeck() {
  state = 'loading'; renderDeck();
  try {
    const d = await v2api('/api/am/ai/inspire/deck');
    CARDS = d.cards; idx = 0; last = null; total = d.total; left = d.left; KINDS = d.kinds; pending = d.pending || 0; state = 'ok';
    $('#savedN').textContent = d.saved_n; renderTaste(d.taste);
  } catch (e) { state = 'err'; err = e.message; }
  renderDeck();
}
// 새 프로모션의 실제 화면 받아 오기 (서버가 브라우저로 그 페이지들을 열어 저장한다. 평소엔 아침 자동 확인이 미리 해 둔다)
async function prefetch() {
  if (fetching) return;
  fetching = true; renderDeck();
  try {
    await v2api('/api/am/ai/inspire/prefetch', {});
    for (;;) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await v2api('/api/am/ai/inspire/prefetch');
      const t = $('#pfT'); if (t) t.textContent = s.total ? `${s.done}/${s.total}` : '';
      if (s.state !== 'running') { toast(s.msg || '끝났어요'); break; }
    }
  } catch (e) { toast(`화면을 받지 못했어요: ${e.message}`); }
  fetching = false; loadDeck();
}
// 저장·넘기기: 카드가 날아가는 동안 서버에 기록. 실패하면 카드를 되돌려 놓는다
async function act(kind) {
  if (busy || state !== 'ok' || idx >= CARDS.length) return;
  const c = CARDS[idx], el = document.querySelector('.icard.is-top');
  busy = true;
  if (el) { el.classList.add('fly', kind === 'save' ? 'right' : 'left'); el.style.transform = ''; }
  const anim = new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220));
  try {
    const [r] = await Promise.all([v2api('/api/am/ai/inspire/swipe', { id: c.id, act: kind }), anim]);
    if (!r.ok) throw new Error(r.error || '기록하지 못했어요');
    c._act = kind; last = c; idx++;
    $('#savedN').textContent = r.saved_n; renderTaste(r.taste);
    if (kind === 'save') toast(isNew(c) ? '보관함에 저장했어요' : '보관함과 레퍼런스 즐겨찾기에 저장했어요');
  } catch (e) { toast(`기록하지 못했어요: ${e.message}`); }
  busy = false; renderDeck();
}
async function undo() {
  if (busy || !last) return;
  busy = true;
  try { const r = await v2api('/api/am/ai/inspire/swipe', { id: last.id, act: 'undo' }); idx = CARDS.indexOf(last); delete last._act; last = null; $('#savedN').textContent = r.saved_n; renderTaste(r.taste); }
  catch (e) { toast(`되돌리지 못했어요: ${e.message}`); }
  busy = false; renderDeck();
}
// 밀기: 가로로 90px 넘게 밀면 그쪽으로 처리. 세로 스크롤·글 선택·링크 누르기는 방해하지 않는다
function bindDrag(el) {
  if (!el) return;
  let x0 = 0, y0 = 0, dx = 0, on = false, moved = false;
  el.addEventListener('pointerdown', e => { if (e.button || e.target.closest('a, button')) return; x0 = e.clientX; y0 = e.clientY; dx = 0; on = true; moved = false; });
  el.addEventListener('pointermove', e => {
    if (!on) return;
    dx = e.clientX - x0;
    if (!moved) { if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - y0)) return; moved = true; el.setPointerCapture(e.pointerId); el.classList.add('drag'); }
    el.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
    el.classList.toggle('to-save', dx > 40); el.classList.toggle('to-pass', dx < -40);
  });
  const end = () => {
    if (!on) return; on = false; el.classList.remove('drag', 'to-save', 'to-pass');
    if (moved && Math.abs(dx) > 90) act(dx > 0 ? 'save' : 'pass'); else el.style.transform = '';
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

// ---------- 보관함 ----------
function renderSaved() {
  const n = k => SAVED.filter(x => !k || (x.kinds || [x.kind]).includes(k)).length;
  $('#sfilters').innerHTML = [['', '전체'], ...Object.entries(KINDS)].map(([k, name]) => `<button class="chip ${k ? `k-${k}` : ''}" data-skind="${esc(k)}" aria-pressed="${sKind === k}" ${n(k) || sKind === k ? '' : 'disabled'}>${k ? icon(k) : ''}${esc(name)}<span class="n">${n(k)}</span></button>`).join('');
  const list = SAVED.filter(x => !sKind || (x.kinds || [x.kind]).includes(sKind));
  $('#sgrid').innerHTML = list.length ? list.map(c => `<article class="scard k-${esc(c.kind)}" data-id="${esc(c.id)}">
      ${c.shot ? `<button class="sthumb" data-whole="${esc(c.id)}" aria-label="실제 페이지 크게 보기"><span class="pgimg tiles" data-sthumb="${esc(c.id)}">${tilesHtml(c, true)}</span></button>` : ''}
      <div class="info">
        <div class="kline"><span class="kind">${icon(c.kind)}${esc(c.kind_name)}</span><span class="cap">${esc((c.saved_at || '').slice(5, 10))} 저장</span></div>
        <h2>${esc(headline(c))}</h2>
        ${lead(c)}
        ${note(c)}
        ${metaLine(c)}
        <label class="memo"><span class="cap">메모</span><textarea rows="2" maxlength="300" data-memo="${esc(c.id)}" placeholder="예) 룰렛 → 우리는 찻잎 뽑기로">${esc(c.memo || '')}</textarea></label>
        <div class="row">${c.url ? `<a class="btn xs" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">원본 ↗</a>` : ''}
          ${c.src === 'new' && c.url ? `<button class="btn xs" data-collect="${esc(c.id)}" title="화면까지 받아 레퍼런스 라이브러리에 넣어요">라이브러리에 수집</button>` : c.src !== 'new' ? '<a class="btn xs" href="/v2/library">레퍼런스에서 보기</a>' : ''}
          <span class="grow"></span><button class="btn xs ghost" data-unsave="${esc(c.id)}">빼기</button></div>
      </div>
    </article>`).join('')
    : `<div class="iempty">${SAVED.length ? '이 종류로 저장한 카드가 없어요.' : '<b>아직 저장한 카드가 없어요</b>오늘의 카드에서 오른쪽으로 밀면 여기에 모여요.'}${SAVED.length ? '' : '<button class="btn sm primary" data-goto="deck">오늘의 카드 보기</button>'}</div>`;
  // 보관함 썸네일: 사진에서 표시한 자리가 보이게 올려 둔다
  document.querySelectorAll('#sgrid [data-sthumb]').forEach(w => { const c = SAVED.find(x => x.id === w.dataset.sthumb); if (!c) return;
    placeTiles(w, c); markSpot(w, c, 3); if (!c.spot) return;
    w.style.transform = `translateY(${-Math.max(0, c.spot.y / (c.shot_h || 1) * 100 - 4)}%)`; });
}
async function loadSaved() {
  try { const d = await v2api('/api/am/ai/inspire/saved'); SAVED = d.items; KINDS = d.kinds; $('#savedN').textContent = SAVED.length; }
  catch (e) { toast(`보관함을 불러오지 못했어요: ${e.message}`); }
  renderSaved();
}
function show(v) {
  view = v;
  document.querySelectorAll('#tabs [data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $('#deckView').hidden = v !== 'deck'; $('#savedView').hidden = v !== 'saved';
  if (v === 'saved') loadSaved(); else renderDeck();
  history.replaceState(null, '', v === 'saved' ? '#saved' : location.pathname);
}
// 새 프로모션을 화면까지 수집: 레퍼런스 화면의 수집과 같은 일 (서버가 페이지를 읽고 구좌를 나눠 라이브러리에 넣는다)
async function collect(id, btn) {
  const c = SAVED.find(x => x.id === id); if (!c) return;
  btn.disabled = true; btn.textContent = '수집하는 중…';
  try {
    const j = await v2api('/api/am/ai/collect/start', { urls: [c.url], allow_known: true });
    const tick = async () => {
      let s; try { s = await v2api('/api/am/ai/collect/status?id=' + j.id); } catch { btn.textContent = '진행 상황을 못 읽었어요'; btn.disabled = false; return; }
      if (s.state !== 'done') { setTimeout(tick, 1500); return; }
      const it = s.items[0] || {};
      btn.textContent = it.status === 'added' ? '라이브러리에 넣었어요' : it.status === 'skip' ? '이미 라이브러리에 있어요' : '수집하지 못했어요';
      if (it.status !== 'added' && it.status !== 'skip') { btn.disabled = false; toast(it.msg || '수집하지 못했어요'); }
    };
    tick();
  } catch (e) { btn.disabled = false; btn.textContent = '라이브러리에 수집'; toast(e.message); }
}

// ---------- 동작 ----------
let memoT;
document.addEventListener('click', async e => {
  const t = e.target, d = k => t.closest(`[data-${k}]`);
  if (t.closest('#btnSave')) { act('save'); return; }
  if (t.closest('#btnPass')) { act('pass'); return; }
  if (t.closest('#btnUndo')) { undo(); return; }
  if (d('whole')) { openWhole(d('whole').dataset.whole); return; }
  if (d('prefetch')) { prefetch(); return; }
  if (d('view')) { show(d('view').dataset.view); return; }
  if (d('goto')) { show(d('goto').dataset.goto); return; }
  if (d('more') || d('reload')) { loadDeck(); return; }
  if (d('skind')) { sKind = d('skind').dataset.skind; renderSaved(); return; }
  if (d('collect')) { collect(d('collect').dataset.collect, d('collect')); return; }
  if (d('unsave')) {
    const id = d('unsave').dataset.unsave;
    try { const r = await v2api('/api/am/ai/inspire/edit', { id, remove: true }); if (!r.ok) throw new Error(r.error); SAVED = SAVED.filter(x => x.id !== id); $('#savedN').textContent = SAVED.length; renderSaved(); toast('보관함에서 뺐어요'); }
    catch (er) { toast(`빼지 못했어요: ${er.message}`); }
    return;
  }
  if (d('reset')) {
    if (!confirm('취향 기록을 지울까요?\n넘긴 카드가 다시 나올 수 있어요. 저장한 카드는 보관함에 그대로 남아요.')) return;
    try { await v2api('/api/am/ai/inspire/reset', {}); toast('취향 기록을 지웠어요'); loadDeck(); } catch (er) { toast(er.message); }
  }
});
document.addEventListener('input', e => {
  const id = e.target.dataset?.memo; if (!id) return;
  const it = SAVED.find(x => x.id === id); if (it) it.memo = e.target.value;
  clearTimeout(memoT);
  memoT = setTimeout(() => v2api('/api/am/ai/inspire/edit', { id, memo: e.target.value }).catch(er => toast(`메모를 저장하지 못했어요: ${er.message}`)), 600);
});
document.addEventListener('keydown', e => {
  if (view !== 'deck' || $('#pgDlg').open || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); act('save'); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); act('pass'); }
  else if (e.key === 'z' || e.key === 'Z' || e.key === 'ㅋ') { e.preventDefault(); undo(); }
  else if (e.key === 'Enter' && !e.target.closest('button, a')) { const a = document.querySelector('.icard.is-top .orig'); if (a) window.open(a.href, '_blank', 'noopener'); }
});

loadDeck().then(() => { if (location.hash === '#saved') show('saved'); });
// 아침 자동 확인이 꺼져 있으면 알려 준다 (켜 두어야 매일 새 카드와 화면 사진이 미리 준비된다)
v2api('/api/am/ai/auto').then(s => { const el = $('#autoNote'); if (!el) return;
  el.innerHTML = s.on ? `매일 ${esc(s.at)}에 새 프로모션과 화면을 미리 받아 둬요.${s.last_run ? ` 마지막 확인 ${esc(s.last_run.slice(5))}` : ''}` : '아침 자동 확인이 꺼져 있어요. 켜 두면 매일 새 카드와 화면이 미리 준비돼요. <a href="/v2/settings#auto">설정에서 켜기</a>';
  el.hidden = false; }).catch(() => {});
