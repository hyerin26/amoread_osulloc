// ④ 구좌 편집: 왼쪽 구좌 목록, 가운데 모바일 와이어프레임, 오른쪽 편집 패널 (디자이너 v2.5.1 S06, plans/10 D5)
// - 문구(메인 카피, 서브 카피, 버튼 문구)는 와이어프레임에서 한 번 눌러 바로 고친다: Enter 저장, Shift+Enter 줄바꿈, Esc 취소, 다른 곳 누르면 저장
// - 편집 패널 탭(콘텐츠, 상품·가격, 디자인 요청)은 패널 안을 스크롤해도 위에 붙어 있다
// - 가격은 ② 상품·할인의 할인율을 읽기만 한다. 여기서 바꾸지 않는다 (하루특가는 같은 상품도 날짜마다 다를 수 있음)
// - 모든 변경은 ③과 같은 실행 취소 기록을 쓴다
import { $, $$, attachPicker, emit, esc, icon, mmdd, toast } from '../core.js';
import { am, dealPlanOf, scheduleSave } from './store.js';
import { bindFieldHistory, changePage, DISPLAYS, LAYOUTS, layoutName, newSlot, stepSection } from './page.js';
import { reorderById } from './history.js';
import { sortable } from './sortable.js';
import { ctxTags } from './meta.js';
import { dealDates, edText, keyOf, nameOf, priceOf, priceText, switchWireTab, wireSection } from './wire.js';

const TABS = [['content', '콘텐츠'], ['products', '상품·가격'], ['notes', '디자인 요청']];
const NO_CARDS = ['hero', 'text-cta', 'benefit'];   // 상품 카드를 그리지 않는 레이아웃
const MAX = { headline: 120, subhead: 400, cta: 40 };
const LABEL = { headline: '메인 카피', subhead: '서브 카피', cta: '버튼 문구' };
let root = null, selId = null, tab = 'content', dealDate = null, panelOpen = false, editing = null;

const secs = () => am.cur.page?.sections || [];
const cur = () => secs().find(s => s.sectionId === selId);
const goStep = (step, sub) => document.dispatchEvent(new CustomEvent('am:go-step', { detail: { step, sub } }));

// ③에서 '④ 구좌 편집에서 보기'로 올 때 그 구좌를 고른다
export function selectEditorSection(id) { selId = id; }

export function renderEditor(el) { root = el; editing = null; paint(); }

function paint() {
  if (!root) return;
  const head = `<div class="am-stephead"><div><div class="overline">04 · 구좌 편집</div><h2>구좌 편집</h2>
    <p>레이아웃을 고르고 문구와 상품을 채워 보세요. 제목이나 버튼 문구를 누르면 바로 고칠 수 있어요.</p>${ctxTags()}</div></div>`;
  if (!secs().length) {
    root.innerHTML = `${head}<div class="card am-empty-state"><h2>아직 구좌가 없어요</h2>
      <p class="sm mute">02 구성에서 구좌를 먼저 만들면 여기서 고객 화면 모양으로 편집할 수 있어요.</p>
      <button class="btn primary" id="amEdToPage">02 구성으로</button></div>`;
    $('#amEdToPage', root).addEventListener('click', () => goStep('page'));
    return;
  }
  if (!cur()) selId = secs()[0].sectionId;
  const dates = dealDates(am.cur);
  if (!dates.includes(dealDate)) { const t = new Date(); const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; dealDate = dates.find(d => d >= today) || dates[0] || null; }
  root.innerHTML = `${head}<div class="am-editor ${panelOpen ? 'panel-open' : ''}" id="amEditor">
    <aside class="card am-ed-list" aria-label="구좌 목록"><div class="am-ed-listhead"><h3>구좌 목록</h3><p class="cap">구좌를 끌어 순서를 바꿔 보세요.</p></div>
      <ol class="am-seclist" id="amEdList"></ol></aside>
    <section class="am-ed-canvas" aria-label="모바일 와이어프레임">
      <div class="am-ed-bar"><span class="cap">페이지 구성과 문구를 확인하는 와이어프레임이에요. 상품 이미지는 아직 연결하지 않았어요.</span><span class="grow"></span>
        <button class="btn sm am-ed-paneltoggle" id="amEdPanelBtn" aria-controls="amEdPanel" aria-expanded="${panelOpen}">${icon('panel-open')} 편집 패널</button></div>
      <div class="am-phone"><div class="am-phone-top"><b>OSULLOC</b><span class="cap">모바일 구성 예시</span></div><div class="am-ed-stage" id="amEdStage"></div></div>
    </section>
    <aside class="card am-ed-panel" id="amEdPanel" aria-label="구좌 편집 패널"></aside>
  </div>`;
  paintList(); paintStage(); paintPanel();
  const list = $('#amEdList', root), stage = $('#amEdStage', root), panel = $('#amEdPanel', root);
  const opts = {
    nameOf: id => (secs().find(s => s.sectionId === id) || {}).name || '구좌',
    onMove: (from, to, after) => { if (changePage(() => reorderById(secs(), from, to, after))) { paintList(); paintStage(); paintPanel(); toast('구좌 순서를 바꿨어요. 실행 취소로 되돌릴 수 있어요'); } },
    onStep: (id, delta) => { if (stepSection(id, delta)) { paintList(); paintStage(); paintPanel(); $(`#amEdList [data-drag="${id}"]`, root)?.focus(); } },
    onCancel: () => toast('구좌 이동을 취소했어요'),
  };
  sortable(list, opts);
  sortable(stage, { ...opts, onStep: (id, delta) => { if (stepSection(id, delta)) { paintList(); paintStage(); paintPanel(); $(`#amEdStage [data-drag="${id}"]`, root)?.focus(); } } });
  list.addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if (b) select(b.dataset.sel, true); });
  stage.addEventListener('click', onStageClick);
  stage.addEventListener('keydown', e => {
    const t = e.target.closest('[data-ed]');
    if (t && !t.classList.contains('editing') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startEdit(t); }
  });
  panel.addEventListener('click', onPanelClick);
  panel.addEventListener('input', onPanelInput);
  panel.addEventListener('change', onPanelChange);
  bindFieldHistory(panel, 'input[data-pf], textarea[data-pf], input[data-cc]');
  $('#amEdPanelBtn', root).addEventListener('click', () => setPanel(!panelOpen));
}

function setPanel(open) {
  panelOpen = open;
  $('#amEditor', root)?.classList.toggle('panel-open', open);
  $('#amEdPanelBtn', root)?.setAttribute('aria-expanded', open);
  if (open) $('#amEdPanel [role="tab"][aria-selected="true"]', root)?.focus();
}

// 구좌 고르기: 목록·와이어프레임 표시만 바꾸고 패널을 다시 그린다 (와이어프레임 스크롤 유지)
function select(id, scroll = false) {
  if (selId === id) return;
  selId = id;
  $$('#amEdList .am-sec, #amEdStage .am-wsec', root).forEach(el => el.classList.toggle('on', el.dataset.sortId === id));
  $$('#amEdList [data-sel]', root).forEach(b => b.setAttribute('aria-current', b.dataset.sel === id));
  if (scroll) $(`#amEdStage [data-sort-id="${id}"]`, root)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  paintPanel();
}

// ---------------- 왼쪽 목록 ----------------
function paintList() {
  $('#amEdList', root).innerHTML = secs().map((s, i) => `<li class="am-sec ${s.sectionId === selId ? 'on' : ''}" data-sort-id="${s.sectionId}">
    <button class="am-grip" data-drag="${s.sectionId}" aria-label="${esc(s.name || '이름 없는 구좌')} 끌어 순서 바꾸기. Alt+위·아래 화살표로도 옮겨요" title="끌어 순서 바꾸기 · Alt+↑/↓">${icon('grip')}</button>
    <button class="am-sec-main" data-sel="${s.sectionId}" aria-current="${s.sectionId === selId}"><span class="am-sec-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="am-sec-txt"><span class="am-sec-name">${esc(s.name || '이름 없는 구좌')}</span></span></button></li>`).join('');
}

// ---------------- 가운데 와이어프레임 ----------------
function paintStage() {
  const all = secs();
  $('#amEdStage', root).innerHTML = all.map((s, i) => `<section class="am-wsec ${s.sectionId === selId ? 'on' : ''}" data-sort-id="${s.sectionId}" aria-label="${String(i + 1).padStart(2, '0')} ${esc(s.name)}">
    <div class="am-wsec-tools"><button class="am-wgrip" data-drag="${s.sectionId}" aria-label="${esc(s.name || '구좌')} 끌어 순서 바꾸기. Alt+위·아래 화살표로도 옮겨요" title="끌어 순서 바꾸기 · Alt+↑/↓">${icon('grip')}<span>이동</span></button>
      <button data-mv="-1" data-id="${s.sectionId}" aria-label="${esc(s.name)} 위로 이동" title="위로 이동" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up')}</button>
      <button data-mv="1" data-id="${s.sectionId}" aria-label="${esc(s.name)} 아래로 이동" title="아래로 이동" ${i === all.length - 1 ? 'disabled' : ''}>${icon('arrow-down')}</button></div>
    <span class="am-wsec-n">${String(i + 1).padStart(2, '0')} 구좌</span>
    ${wireSection(s, am.cur, { editable: true, date: dealDate })}</section>`).join('');
}

function onStageClick(e) {
  switchWireTab(e);   // 탭 구좌의 알약: 탭을 바꾸고 구좌 선택은 그대로 이어서
  const mv = e.target.closest('[data-mv]');
  if (mv) { if (stepSection(mv.dataset.id, +mv.dataset.mv)) { paintList(); paintStage(); paintPanel(); } return; }
  const t = e.target.closest('[data-ed]');
  if (t) { if (!t.classList.contains('editing')) startEdit(t); return; }
  const sec = e.target.closest('[data-sort-id]');
  if (sec) select(sec.dataset.sortId);
}

// ---------------- 문구 바로 고치기 ----------------
function startEdit(el) {
  const id = el.closest('[data-sort-id]').dataset.sortId, f = el.dataset.ed;
  const s = secs().find(x => x.sectionId === id); if (!s) return;
  if (editing) finishEdit(false);
  select(id); tab = 'content'; paintPanel();
  const ta = document.createElement('textarea');
  ta.className = 'am-w-input'; ta.value = s[f] || ''; ta.maxLength = MAX[f]; ta.rows = 1;
  ta.setAttribute('aria-label', `${LABEL[f]} 바로 편집`);
  const hint = document.createElement('span');
  hint.className = 'am-w-hint'; hint.textContent = f === 'cta' ? 'Enter 저장 · Esc 취소' : 'Enter 저장 · Shift+Enter 줄바꿈 · Esc 취소';
  el.classList.add('editing'); el.replaceChildren(ta, hint);
  editing = { id, f, el, ta };
  const fit = () => { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.scrollHeight, 32)}px`; };
  ta.addEventListener('input', () => { fit(); syncPanelField(f, ta.value); });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishEdit(true, true); }
    else if (e.key === 'Enter' && (!e.shiftKey || f === 'cta') && !e.isComposing) { e.preventDefault(); finishEdit(false, true); }
  });
  ta.addEventListener('blur', () => finishEdit(false));
  ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); fit();
}

function finishEdit(cancel, refocus = false) {
  const ed = editing; if (!ed) return;
  editing = null;
  const s = secs().find(x => x.sectionId === ed.id);
  if (s && !cancel) {
    const v = ed.f === 'cta' ? ed.ta.value.replace(/\s*\n\s*/g, ' ').trim() : ed.ta.value;
    if (v !== (s[ed.f] || '')) { changePage(() => { s[ed.f] = v; }); toast(`${LABEL[ed.f]}를 고쳤어요. 실행 취소로 되돌릴 수 있어요`); }
  }
  ed.el.classList.remove('editing');
  ed.el.innerHTML = s ? edText(s, ed.f, true) : '';
  if (s) syncPanelField(ed.f, s[ed.f] || '');
  if (refocus) ed.el.focus({ preventScroll: true });
}

// 와이어프레임과 편집 패널의 같은 칸을 맞춘다
function syncPanelField(f, v) {
  const inp = $(`#amEdPanel [data-pf="${f}"]`, root);
  if (inp && document.activeElement !== inp) inp.value = v;
}
function syncStageField(s, f) {
  const el = $(`#amEdStage [data-sort-id="${s.sectionId}"] [data-ed="${f}"]`, root);
  if (el && !el.classList.contains('editing')) el.innerHTML = edText(s, f, true);
}

// ---------------- 오른쪽 편집 패널 ----------------
function paintPanel() {
  const box = $('#amEdPanel', root); if (!box) return;
  const s = cur();
  if (!s) { box.innerHTML = '<p class="cap">왼쪽 목록에서 편집할 구좌를 선택해 주세요.</p>'; return; }
  const i = secs().indexOf(s);
  box.innerHTML = `<div class="am-ed-phead"><div class="grow"><h3>${esc(s.name || '이름 없는 구좌')}</h3><p class="cap">${String(i + 1).padStart(2, '0')} 구좌 · ${esc(layoutName(s.layoutId))}</p></div>
      <button class="btn sm ghost am-iconbtn am-ed-close" data-close aria-label="편집 패널 닫기" title="편집 패널 닫기">${icon('close')}</button></div>
    <div class="seg am-ed-tabs" role="tablist" aria-label="편집 패널">${TABS.map(([id, n]) => `<button role="tab" id="amEdTab-${id}" class="${tab === id ? 'on' : ''}" data-tab="${id}" aria-selected="${tab === id}" aria-controls="amEdBody" tabindex="${tab === id ? 0 : -1}">${n}</button>`).join('')}</div>
    <div class="am-ed-pbody" id="amEdBody" role="tabpanel" aria-labelledby="amEdTab-${tab}">${tab === 'content' ? contentTab(s) : tab === 'products' ? productsTab(s) : notesTab(s)}</div>`;
  box.querySelector('.am-ed-tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const k = TABS.findIndex(t => t[0] === tab), n = TABS[(k + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
    tab = n; paintPanel(); $(`#amEdTab-${n}`, root)?.focus();
  });
}

const fld = (label, html, hint = '') => `<label class="am-f"><span>${label}${hint ? ` <em>${hint}</em>` : ''}</span>${html}</label>`;

function contentTab(s) {
  return `<div class="am-ed-layout"><div><span class="cap">현재 레이아웃</span><div class="am-v">${esc(layoutName(s.layoutId))}</div></div>
      <label class="am-ed-laysel" title="문구와 연결한 상품은 유지해요"><span class="sr-only">레이아웃 바꾸기. 문구와 연결한 상품은 유지해요</span><select data-layout>${LAYOUTS.map(l => `<option value="${l.id}" ${s.layoutId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label></div>
    ${fld('구좌명', `<input type="text" data-pf="name" maxlength="40" value="${esc(s.name)}">`)}
    ${fld('메인 카피', `<textarea data-pf="headline" maxlength="120" rows="3">${esc(s.headline)}</textarea>`)}
    ${fld('서브 카피', `<textarea data-pf="subhead" maxlength="400" rows="3">${esc(s.subhead)}</textarea>`)}
    ${fld('버튼 문구', `<input type="text" data-pf="cta" maxlength="40" value="${esc(s.cta)}">`, '비우면 버튼을 그리지 않아요')}`;
}

function productsTab(s) {
  const disp = `<div class="am-f"><span>가격 노출 방식</span><div class="grp">${DISPLAYS.map(([v, l]) => `<button type="button" class="chip ${(s.price_display || '') === v ? 'on' : ''}" data-pd="${v}" aria-pressed="${(s.price_display || '') === v}">${esc(l)}</button>`).join('')}</div>
    ${s.price_display === 'section' ? `<label class="am-f am-sprice"><span>섹션 대표 가격 (원)</span><input type="number" data-pf="section_price" min="0" step="100" value="${s.section_price ?? ''}" placeholder="예) 8800"></label>` : ''}</div>`;
  if (s.layoutId === 'deal-banner') {
    const dates = dealDates(am.cur), n = dealPlanOf(am.cur).slots;
    const day = (am.cur.promo_rows || []).filter(r => r.type === '하루특가' && r.start === dealDate);
    return `<div class="am-f"><span>보여줄 날짜 <em>와이어프레임에 그날 상품이 보여요</em></span>
        ${dates.length ? `<select data-dealdate aria-label="보여줄 날짜">${dates.map(d => `<option value="${d}" ${d === dealDate ? 'selected' : ''}>${mmdd(d)}</option>`).join('')}</select>` : '<p class="cap">기간과 하루특가가 아직 없어요.</p>'}</div>
      <div class="am-f"><span>${dealDate ? `${mmdd(dealDate)} 하루특가` : '하루특가'} <em>하루 ${n}자리</em></span>
        ${day.length ? `<ul class="am-ed-slots">${day.map(r => `<li><span class="am-ed-slot-n">${esc(nameOf(r))}</span><span class="cap">${r.rate ? `하루특가 ${Math.round(r.rate * 100)}%` : ''}</span></li>`).join('')}</ul>` : '<p class="cap">이 날 하루특가가 없어요.</p>'}
        ${day.length < n ? `<p class="cap">빈 자리 ${n - day.length}개</p>` : ''}</div>
      <div class="info-box am-ed-note">하루특가 상품과 할인율은 03 상품·혜택의 하루특가 편성에서 정해요.</div>
      <div class="row"><button class="btn sm" data-goto="deals">하루특가 편성 열기</button></div>`;
  }
  const rows = am.cur.promo_rows || [];
  const noCards = NO_CARDS.includes(s.layoutId);
  return `${noCards ? `<div class="am-warn" role="status">${s.slots.length ? `상품 ${s.slots.length}개를 아직 배치하지 않았어요. 상품 카드가 있는 레이아웃을 골라 주세요.` : '상품형 레이아웃을 선택하면 이 구좌에도 상품 카드를 넣을 수 있어요.'}</div>` : ''}${disp}
    <div class="am-f"><span>상품 <em>${s.slots.length}개</em></span>
      ${s.slots.length ? `<ul class="am-ed-slots">${s.slots.map(sl => { const pr = priceOf(sl, rows); return `<li data-slot="${sl.slotId}">
        <div class="am-ed-slot-h"><span class="am-ed-slot-n">${esc(keyOf(sl) ? nameOf(sl) : '상품 미정')}</span>
          <span class="am-ed-slot-a"><button class="btn sm" data-swap="${sl.slotId}">${keyOf(sl) ? '상품 바꾸기' : '상품 연결하기'}</button><button class="btn sm ghost" data-rm="${sl.slotId}" aria-label="${esc(keyOf(sl) ? nameOf(sl) : '빈 카드')} 카드 삭제하기">카드 삭제하기</button></span></div>
        <span class="am-ed-slot-p ${pr.und ? 'und' : ''}">${esc(priceText(pr))}</span>
        <div class="picker hidden" data-picker="${sl.slotId}"><input type="search" placeholder="상품명이나 SEQ를 입력해 주세요" aria-label="이 카드에 연결할 상품 찾기"><div class="dd hidden"></div></div>
        <input type="text" data-cc="${sl.slotId}" maxlength="200" value="${esc(sl.customCopy || '')}" placeholder="상품을 소개하는 문구 (선택) · 이 카드에만 보여줄 문구" aria-label="상품을 소개하는 문구 (선택)"></li>`; }).join('')}</ul>
        ${s.slots.some(sl => !keyOf(sl)) ? '<p class="cap">상품을 정하기 전에도 빈 카드와 메모를 포함해 기획안을 공유할 수 있어요. 새 묶음 상품을 준비 중이라면 디자인 요청에 상품 구성과 필요한 이미지를 적어 주세요.</p>' : ''}` : '<p class="cap">아직 연결한 상품이 없어요. 빈 상품 카드를 추가하고 상품을 연결해 보세요.</p>'}
      <div class="row"><button class="btn sm" data-addslot>${icon('plus')} 빈 상품 카드 추가</button></div></div>
    <div class="info-box am-ed-note">가격은 03 상품·혜택의 할인율을 그대로 보여줘요.</div>
    <div class="row"><button class="btn sm" data-goto="rows">03 상품·혜택에서 할인 바꾸기</button></div>`;
}

function notesTab(s) {
  return `${fld('디자이너 요청사항', `<textarea data-pf="designNotes" maxlength="2000" rows="10" placeholder="예: A와 B 상품 이미지로 새 묶음 상품 이미지를 만들어 주세요.">${esc(s.designNotes)}</textarea>`, '선택')}
    <p class="cap">05 미리보기·내보내기의 디자이너 기획안에 그대로 들어가요. 거기서 고쳐도 같은 내용이에요.</p>`;
}

function onPanelInput(e) {
  const s = cur(); if (!s) return;
  const f = e.target.dataset.pf;
  if (f) {
    s[f] = f === 'section_price' ? (e.target.value === '' ? null : Math.max(0, Math.round(+e.target.value))) : e.target.value;
    scheduleSave();
    if (MAX[f]) syncStageField(s, f);
    if (f === 'name') { paintList(); $('.am-ed-phead h3', root).textContent = s.name || '이름 없는 구좌'; }
    if (f === 'section_price') paintStage();
    return;
  }
  const cc = e.target.dataset.cc;
  if (cc) { const sl = s.slots.find(x => x.slotId === cc); if (sl) { sl.customCopy = e.target.value; scheduleSave(); paintStage(); } }
}

function onPanelChange(e) {
  const s = cur(); if (!s) return;
  if (e.target.matches('[data-layout]')) { changePage(() => { s.layoutId = e.target.value; }); paintList(); paintStage(); paintPanel(); toast('레이아웃을 바꿨어요. 문구와 연결한 상품은 유지해요'); }
  if (e.target.matches('[data-dealdate]')) { dealDate = e.target.value; paintStage(); paintPanel(); }
}

function onPanelClick(e) {
  const s = cur(); if (!s) return;
  if (e.target.closest('[data-close]')) { setPanel(false); $('#amEdPanelBtn', root)?.focus(); return; }
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; paintPanel(); $(`#amEdTab-${tab}`, root)?.focus(); return; }
  const pd = e.target.closest('[data-pd]');
  if (pd) { changePage(() => { s.price_display = pd.dataset.pd; if (s.price_display !== 'section') s.section_price = null; }); paintStage(); paintPanel(); emit('am:brief', 'page'); return; }
  const g = e.target.closest('[data-goto]');
  if (g) { goStep('promo', g.dataset.goto); return; }
  if (e.target.closest('[data-addslot]')) { changePage(() => s.slots.push(newSlot())); paintStage(); paintPanel(); return; }
  const rm = e.target.closest('[data-rm]');
  if (rm) { changePage(() => { s.slots = s.slots.filter(x => x.slotId !== rm.dataset.rm); }); paintStage(); paintPanel(); toast('카드를 삭제했어요. 실행 취소로 되돌릴 수 있어요'); return; }
  const sw = e.target.closest('[data-swap]');
  if (sw) {
    const pick = $(`[data-picker="${sw.dataset.swap}"]`, root); if (!pick) return;
    pick.classList.remove('hidden');
    const inp = pick.querySelector('input');
    if (!pick.dataset.bound) {
      pick.dataset.bound = '1';
      attachPicker(inp, pick.querySelector('.dd'), p => {
        const sl = s.slots.find(x => x.slotId === sw.dataset.swap); if (!sl) return;
        // 슬롯 ID와 짧은 문구는 그대로 두고 상품만 바꾼다
        changePage(() => { sl.seq = String(p.seq); sl.items = null; sl.placeholderStatus = 'AVAILABLE'; });
        paintStage(); paintPanel(); toast(`선택한 카드에 「${p.name}」을 연결했어요`);
      });
    }
    inp.focus();
  }
}
