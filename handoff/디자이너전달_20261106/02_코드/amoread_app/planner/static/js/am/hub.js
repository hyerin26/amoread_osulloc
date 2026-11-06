// AMOREAD 기획안: 작업 중 기획안 칩, 기획안 목록, 기획안 화면(5단계 + 오른쪽 '다음에 할 일')
// 구조 (plans/03 화면 흐름 v0.2, 확정)
// - 기획안 하나가 모든 작업의 그릇. 단계는 잠그지 않는다: 01 브리프 02 구성 03 상품·혜택 04 구좌 편집 05 미리보기·내보내기 (plans/15)
// - 03 상품·혜택(ID promo) = 기존 작업대. 수동 저장이고, 저장하지 않은 변경이 있는 채로 떠나면 묻는다
// - 나머지 단계는 자동 저장
// - 화면 모양은 디자이너 v2.5.1 (홈 목록, 단계 묶음 탭, 자동 저장·실행 취소·다음 단계) plans/10 D1·D2
import { $, $$, addLeaveGuard, api, canLeave, emit, esc, icon, mmdd, on, openPop, closePop, state } from '../core.js';
import { wbIsDirty, wbLoad, wbMarkClean, wbRows, wbSetFilter } from '../plan.js';
import { am, clearCurrent, createProject, dealPlanOf, dLabel, openProject, savedCurrentId, saveNow, scheduleSave, STATUS } from './store.js';
import { renderBrief, resetBriefCache } from './brief.js';
import { addDealSection, pageStats, renderPage } from './page.js';
import { renderEditor, selectEditorSection } from './editor.js';
import { canRedo, canUndo, redo, resetHistory, setHistoryListener, undo } from './history.js';
import { nextItems } from './next.js';
import { keyOf, renderDeals } from './deals.js';
import { renderPool } from './pool.js';
import { deliverStepState, renderDeliver } from './deliver.js';
import { renderEvidence } from './evidence.js';
import { ask, notify } from './ui.js';
import { ctxTags } from './meta.js';

// 단계 (plans/15 확정): 01 브리프 → 02 구성 → 03 상품·혜택 → 04 구좌 편집 → 05 미리보기·내보내기
// ID는 예전 그대로 둔다 (다른 파일이 am:open-step / am:go-step으로 'promo', 'page', 'deliver'를 보냄). 순서와 이름만 바뀜
const STEPS = [
  { id: 'brief', n: '01', name: '브리프', cta: '구성으로' },
  { id: 'page', n: '02', name: '구성', cta: '상품·혜택으로' },
  { id: 'promo', n: '03', name: '상품·혜택', cta: '구좌 편집으로' },
  { id: 'editor', n: '04', name: '구좌 편집', cta: '기획안 미리보기' },
  { id: 'deliver', n: '05', name: '미리보기·내보내기' },
];
const PAGE_STEPS = ['page', 'editor'];   // 실행 취소 기록을 함께 쓰는 단계
let view = 'list';
let step = 'brief';
let histStep = null;            // 실행 취소 기록이 만들어진 단계 묶음
let listQuery = '';             // 기획안 목록 검색어
let wbNodes = null;
let promoSub = 'rows';          // ② 안: 'rows' 구좌 상품(작업대) | 'deals' 하루특가 편성 | 'pool' 후보 상품
let rowsAll = false;            // 구좌 상품 보기에서 하루특가 행도 함께 보기
let poolDraft = null, poolBase = ''; // 후보 상품(역할 미정) 편집 중 값
let dealDraft = null, dealBase = '';   // 하루특가 설정(자리 수, 후보) 편집 중 값. ②의 [저장]으로 반영
const LS_ASIDE = 'amoread.aside.v1';

const amViewOn = () => $('#view-am').classList.contains('on');
export const promoOpen = () => view === 'hub' && step === 'promo' && amViewOn();
const dealDirty = () => !!dealDraft && JSON.stringify(dealDraft) !== dealBase;
const poolDirty = () => !!poolDraft && JSON.stringify(poolDraft) !== poolBase;
const promoDirty = () => promoOpen() && (wbIsDirty() || dealDirty() || poolDirty());
function resetPromoDraft() {
  dealDraft = JSON.parse(JSON.stringify(dealPlanOf(am.cur))); dealBase = JSON.stringify(dealDraft);
  poolDraft = JSON.parse(JSON.stringify(am.cur.pool || [])); poolBase = JSON.stringify(poolDraft);
  wbLoad(am.cur);
}

// 담기 처리가 ②가 열려 있을 때 후보 상품(역할 미정)을 넣는다
export function addPoolDraft(c) {
  if (!poolDraft) return false;
  if (poolDraft.some(x => keyOf(x) === keyOf(c))) return false;
  poolDraft.push({ seq: c.seq || null, items: c.items || null, memo: c.memo || '', source: c.source || '' });
  if (promoSub === 'pool') paintPool();
  paintSub2(); paintWbState(); paintSteps();
  return true;
}

// 담기 처리(intake)가 ②가 열려 있을 때 하루특가 후보를 넣는다 (날짜 없이 '하루특가로 담기', R9)
export function addDealCandidateDraft(c) {
  if (!dealDraft) return false;
  if (dealDraft.candidates.some(x => keyOf(x) === keyOf(c))) return false;
  dealDraft.candidates.push({ seq: c.seq || null, items: c.items || null, rate: c.rate ?? null, memo: c.memo || '' });
  if (promoSub === 'deals') paintDeals();
  paintWbState(); paintSteps();
  return true;
}

export function initAm() {
  on('am:open', async id => { await openFromOutside(id, null); });
  on('am:open-step', async ({ id, step: s, sub } = {}) => { if (sub) promoSub = sub; await openFromOutside(id || am.cur?.id, s); });
  on('am:new-from-season', async x => { if (await canLeave()) { await goAmView(); await newFromSeason(x); } });
  // R12: 트렌드는 명분 입구. 그 말로 브리프를 열고, 연결 상품은 후보 상품(역할 미정)으로만
  on('am:trend-start', async t => { if (await canLeave()) { await goAmView(); await newFromTrend(t); } });
  on('am:trend-season', t => saveTrendSeason(t));
  on('am:savestate', paintSave);
  on('am:changed', () => { paintChip(); paintResume(); if (view === 'hub' && amViewOn()) { paintSteps(); paintSub(); paintIdent(); refreshNext(); } });
  on('am:current', () => { paintChip(); paintResume(); });
  on('am:brief', k => {
    paintSub(); paintSteps(); refreshNext();
    if (k !== 'title') return;
    paintChip(); paintIdent();
    $$('#amTitle, [data-bt]').forEach(i => { if (i !== document.activeElement) i.value = am.cur.title; });
  });
  on('plan:changed', () => { if (promoOpen()) { paintWbState(); paintSteps(); if (promoSub === 'deals') paintDeals(); } });

  // ② 상품·할인에 저장하지 않은 변경이 있으면 떠나기 전에 묻는다
  addLeaveGuard(async () => {
    if (!promoDirty()) return true;
    // UX 라이팅 8: 왼쪽은 '닫기'(이동을 멈추고 편집 중인 값 유지), 버리기·저장의 결과를 버튼에 드러낸다
    const v = await ask('상품·할인을 아직 저장하지 않았어요', '<p class="sm">저장하면 다른 단계와 캘린더에도 반영돼요. 닫으면 이동하지 않고 지금 편집하던 내용을 그대로 둬요.</p>',
      [{ label: '닫기', value: null }, { label: '변경한 내용 버리고 이동', value: 'drop' }, { label: '저장하고 이동', value: 'save', primary: true }]);
    if (v === 'save') return savePromo();
    if (v === 'drop') { resetPromoDraft(); return true; }
    return false;
  });
  window.addEventListener('beforeunload', e => { if (promoDirty()) { e.preventDefault(); e.returnValue = ''; } });

  $('#amChip').addEventListener('click', openChipMenu);
  // ⑤ 확인·전달에서 보내는 신호: 다른 단계로 가기, 상태 바뀜 (확정, 반영됨)
  document.addEventListener('am:go-step', async e => {
    const { step: s, sub, section } = e.detail || {}; if (!s || view !== 'hub') return;
    if (sub) promoSub = sub;
    if (section) selectEditorSection(section);
    if (s === step) { if (step === 'promo') paintSub2(); return; }
    if (!(await canLeave())) return;
    step = s; paintSteps(); paintTab();
  });
  // 실행 취소·다시 실행 (③ 페이지 구성, ④ 구좌 편집). 입력 칸 안에서는 브라우저 기본 동작을 쓴다
  setHistoryListener(paintUndo);
  document.addEventListener('keydown', e => {
    if (view !== 'hub' || !amViewOn() || !PAGE_STEPS.includes(step) || !(e.ctrlKey || e.metaKey)) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); doRedo(); }
  });
  document.addEventListener('am:status', () => { const sel = $('#amStatus'); if (sel && am.cur) sel.value = am.cur.status; paintSub(); paintSteps(); paintChip(); paintResume(); });
  restoreCurrent();
}

async function restoreCurrent() {
  const id = savedCurrentId();
  if (id) { try { await openProject(id); } catch { clearCurrent(); } }
  paintChip(); paintResume();
}

// 상단 탭 '기획안' (app.js go): 언제나 목록
export function showAm() { paintList(); }

async function goAmView() { const t = $('.tab[data-view="am"]'); if (!t.classList.contains('on')) t.click(); await new Promise(r => setTimeout(r, 0)); }

async function openFromOutside(id, s) {
  if (!(await canLeave())) return;
  if (!amViewOn()) { $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.view === 'am')); $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-am')); window.scrollTo(0, 0); }
  try {
    if (id && (!am.cur || am.cur.id !== id)) { await saveNow(); await openProject(id); resetBriefCache(); }
    if (!am.cur) { paintList(); return; }
    step = s || defaultStep(am.cur); view = 'hub'; paintHub();
  } catch (e) { notify(e.message); paintList(); }
}

function defaultStep(p) { return !(p.brief.myeongbun || '').trim() && p.promo_rows.length ? 'promo' : 'brief'; }

// ---------------------------------------------------------------- 작업 중 기획안 칩
function paintChip() {
  const el = $('#amChip'); if (!el) return;
  const p = am.cur && am.cur.id ? am.cur : null;
  if (!p) { el.innerHTML = '<span class="cap">작업 중 기획안</span><span>없음</span>'; el.classList.add('empty'); return; }
  const ps = pageStats(p);
  el.classList.remove('empty');
  el.innerHTML = `<span class="cap">작업 중</span><span class="am-chip-t">${esc(p.title || '제목 없는 기획안')}</span><span class="cap">상품 ${p.promo_rows.length}${p.page ? ` · 섹션 ${ps.sections}` : ''}</span>`;
  el.title = '어디서 담기를 누르든 이 기획안에 들어가요. 눌러서 바꾸기';
}

async function openChipMenu(e) {
  const anchor = e.currentTarget;
  let list = [];
  try { list = ((await api('/api/am/projects')).projects || []).slice(0, 8); } catch { /* 목록만 비움 */ }
  openPop(anchor, `<div class="am-chipmenu"><h4>작업 중 기획안 바꾸기</h4>
    <p class="cap">고른 기획안에 담기가 들어가요.</p>
    <ul>${list.map(p => `<li><button class="am-chipitem ${am.cur?.id === p.id ? 'on' : ''}" data-pick="${esc(p.id)}"><span>${esc(p.title)}</span><span class="cap">${p.period ? `${mmdd(p.period.start)}~${mmdd(p.period.end)}` : '날짜 미정'} · ${esc(STATUS[p.status] || '')}</span></button></li>`).join('') || '<li class="cap">기획안이 없어요</li>'}</ul>
    <div class="row mt8"><button class="btn sm" data-pick="__open">이 기획안 열기</button><button class="btn sm" data-pick="__list">기획안 목록</button><button class="btn sm primary" data-pick="__new">새 기획안</button></div></div>`,
  pop => { pop.onclick = async ev => {
    const b = ev.target.closest('[data-pick]'); if (!b) return;
    closePop();
    const v = b.dataset.pick;
    if (v === '__list') { $('.tab[data-view="am"]').click(); return; }
    if (v === '__open') { if (am.cur?.id) emit('am:open', am.cur.id); else $('.tab[data-view="am"]').click(); return; }
    if (v === '__new') { if (await canLeave()) { await goAmView(); await newBlank(); } return; }
    if (am.cur?.id === v) return;
    if (!(await canLeave())) return;
    try {
      await saveNow(); await openProject(v); resetBriefCache();
      notify(`작업 중 기획안을 「${am.cur.title}」로 바꿨어요`);
      if (amViewOn() && view === 'hub') paintHub();
    } catch (err) { notify(err.message); }
  }; });
}

// 캘린더 옆 '이어서 하기'
async function paintResume() {
  const box = $('#amResumeList'); if (!box) return;
  let list = [];
  try { list = ((await api('/api/am/projects')).projects || []).slice(0, 3); } catch { box.innerHTML = ''; return; }
  box.innerHTML = list.length ? `<ul class="am-resumelist">${list.map(p => `<li><button class="am-resumeitem" data-resume="${esc(p.id)}">
      <span class="am-resume-n">${esc(p.title)}${am.cur?.id === p.id ? ' <span class="am-badge">작업 중</span>' : ''}</span>
      <span class="cap">${p.period ? `${mmdd(p.period.start)}~${mmdd(p.period.end)} · ${dLabel(p.period.start)}` : '날짜 미정'} · ${esc(STATUS[p.status] || '')} · 상품 ${p.rows}${p.sections ? ` · 섹션 ${p.sections}` : ''}</span></button></li>`).join('')}</ul>`
    : '<p class="cap">아직 기획안이 없어요. 명분 카드에서 시작하거나 새 기획안을 만들어 보세요.</p>';
  box.onclick = e => { const b = e.target.closest('[data-resume]'); if (b) emit('am:open', b.dataset.resume); };
}

// ---------------------------------------------------------------- 목록
function parkWb() {
  if (!wbNodes) return;
  const v = $('#view-plan');
  wbNodes.forEach(n => v.appendChild(n));
  const h = $('.sec-head h2', v); if (h) h.textContent = '행사 행';   // 멘토님 기획안 탭의 원래 제목으로
}

async function paintList() {
  parkWb();
  view = 'list';
  $('#amHub').classList.add('hidden');
  const box = $('#amList'); box.classList.remove('hidden');
  const cur = am.cur && am.cur.id ? am.cur : null;
  const resume = cur ? `<div class="card am-resume"><div class="grow"><span class="cap">이어서 하기 · 작업 중 기획안</span>
      <div class="am-resume-t">${esc(cur.title || '제목 없는 기획안')}</div>
      <span class="cap">${esc([cur.brief.myeongbun, cur.brief.period ? `${mmdd(cur.brief.period.start)}~${mmdd(cur.brief.period.end)}` : '날짜 미정', STATUS[cur.status]].filter(Boolean).join(' · '))}</span></div>
      <button class="btn primary" id="amResume">이어서 편집 ${icon('arrow-right')}</button></div>` : '';
  box.innerHTML = `<div class="am-home"><div class="masthead am-homehead"><div class="grow"><div class="overline">AMOREAD · 기획안</div><h1>기획안을 이어서 만들어 보세요</h1>
      <p>명분과 브리프부터 할인, 페이지 기획까지 하나의 기획안으로 관리해요. 캘린더의 명분 카드에서 시작해도 돼요.</p></div>
      <button class="btn primary" id="amNew">${icon('plus')} 새 기획안</button></div>
    ${resume}${draftCard()}
    <div class="am-homebar"><div class="grow"><h2 class="am-sectitle">내 기획안 <span class="am-count" id="amCount"></span></h2>
        <p class="cap">이 PC의 기획 도우미에 자동으로 저장해요.</p></div>
      <label class="am-homesearch"><span class="sr-only">기획안 검색</span><input type="search" id="amSearch" placeholder="기획안 이름·명분·기간으로 검색" value="${esc(listQuery)}"></label></div>
    <div class="am-homeimport"><span class="cap">다른 곳에서 가져오기</span><button class="btn sm" data-start="replan">지난 행사 상품·할인 가져오기</button>
      <select id="amLegacy" aria-label="기존 작업대 기획안 가져오기"><option value="">기존 작업대 기획안 가져오기</option></select></div>
    <div id="amListBody"><div class="empty"><span class="spin"></span></div></div></div>`;
  $('#amNew').addEventListener('click', newBlank);
  $('#amLegacy').addEventListener('change', importLegacy);
  $('#amResume')?.addEventListener('click', () => { step = defaultStep(cur); view = 'hub'; paintHub(); });
  $('#amDraftMove')?.addEventListener('click', moveDraft);
  try {
    const [d, lg] = await Promise.all([api('/api/am/projects'), api('/api/am/legacy')]);
    if (view !== 'list') return;
    $('#amLegacy').innerHTML += lg.plans.map(p => `<option value="${esc(p.id)}">${esc(p.title || '제목 없음')} (${p.rows}행, ${esc((p.updated_at || '').slice(0, 10))})</option>`).join('');
    allPlans = d.projects;
    $('#amSearch').addEventListener('input', e => { listQuery = e.target.value; paintListBody(); });
    paintListBody();
  } catch (e) { $('#amListBody').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
}
let allPlans = [];

// 예전 작업대에 브라우저 임시로 남아 있던 행 → 기획안으로 옮기기 (plans/03 9장)
const LS_DRAFT = 'planner.draft.v1', LS_MOVED = 'amoread.draftMoved.v1';
function oldDraft() {
  try {
    if (localStorage.getItem(LS_MOVED)) return null;
    const d = JSON.parse(localStorage.getItem(LS_DRAFT) || 'null');
    return d && !d._am && (d.rows || []).length ? d : null;
  } catch { return null; }
}
function draftCard() {
  const d = oldDraft(); if (!d) return '';
  return `<div class="card am-draftcard"><div class="grow"><span class="cap">예전 작업대에 저장하지 않은 행이 남아 있어요</span>
    <div>${esc(d.title || '제목 없는 작업대')} · ${d.rows.length}행</div></div>
    <button class="btn" id="amDraftMove">기획안으로 옮기기</button></div>`;
}
async function moveDraft() {
  const d = oldDraft(); if (!d) return;
  try {
    const ds = d.rows.flatMap(r => [r.start, r.end || r.start]).filter(Boolean).sort();
    await createProject({ title: (d.title || '예전 작업대 기획').slice(0, 80), origin: { type: 'legacy', ref: '작업대 임시 내용' },
      brief: { myeongbun: d.brief_meta?.myeongbun || '', concept: d.brief_meta?.concept || '', customer: d.brief_meta?.customer || '', target: d.brief_meta?.target || '',
        period: ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null },
      promo_rows: d.rows, rationale: d.rationale || '' });
    try { localStorage.setItem(LS_MOVED, '1'); } catch { /* 저장소 없음 */ }
    notify('예전 작업대 행을 새 기획안으로 옮겼어요');
    step = 'promo'; view = 'hub'; paintHub();
  } catch (e) { notify(e.message); }
}

// 검색: 제목, 명분, 컨셉, 기간(2026-12-01, 12/01 모두)
const norm = s => String(s || '').replace(/\s/g, '').toLowerCase();
function matches(p, q) {
  if (!q) return true;
  const per = p.period ? `${p.period.start} ${p.period.end} ${mmdd(p.period.start)} ${mmdd(p.period.end)}` : '날짜 미정';
  return norm([p.title, p.myeongbun, p.concept, per, STATUS[p.status]].join(' ')).includes(norm(q));
}

function paintListBody() {
  const body = $('#amListBody'); if (!body) return;
  const ps = allPlans.filter(p => matches(p, listQuery));
  $('#amCount').textContent = listQuery ? `${ps.length} / ${allPlans.length}` : allPlans.length;
  if (!allPlans.length) {
    body.innerHTML = `<div class="card am-empty-state"><h2>아직 기획안이 없어요</h2>
      <p class="sm mute">캘린더에서 명분을 골라 시작하거나, 새 기획안으로 브리프부터 써 보세요.</p>
      <div class="row"><button class="btn" data-go="calendar">캘린더 열기</button><button class="btn primary" data-new>새 기획안</button></div></div>`;
    body.querySelector('[data-go]').addEventListener('click', () => $('.tab[data-view="calendar"]').click());
    body.querySelector('[data-new]').addEventListener('click', newBlank);
    return;
  }
  if (!ps.length) {
    body.innerHTML = `<div class="am-empty-state"><p class="sm">「${esc(listQuery)}」과 맞는 기획안이 없어요. 다른 이름이나 기간으로 찾아보세요.</p>
      <button class="btn sm" data-clear>검색 조건 지우기</button></div>`;
    body.querySelector('[data-clear]').addEventListener('click', () => { listQuery = ''; $('#amSearch').value = ''; paintListBody(); $('#amSearch').focus(); });
    return;
  }
  body.innerHTML = `<ul class="am-plans">${ps.map(p => `<li class="am-plan" data-open="${p.id}">
      <span class="am-plan-ic" aria-hidden="true">${icon('board')}</span>
      <div class="am-plan-main"><button class="am-plan-t" data-open-btn="${p.id}">${esc(p.title)}</button>
        ${am.cur?.id === p.id ? '<span class="am-badge">작업 중</span>' : ''}<span class="am-badge st-${esc(p.status)}">${esc(STATUS[p.status] || p.status)}</span>
        <div class="cap">${esc([p.period ? `${p.period.start} ~ ${p.period.end}` : '날짜 미정', p.myeongbun && `명분 ${p.myeongbun}`, p.page_kind === '없음' ? '페이지 없음' : `${p.page_kind} 페이지`].filter(Boolean).join(' · '))}</div></div>
      <span class="am-plan-meta">상품 ${p.rows || 0} · 구좌 ${p.sections ?? 0}</span>
      <span class="am-plan-meta">${esc((p.updated_at || '').slice(5, 16).replace('-', '/'))} 수정</span>
      <span class="am-plan-go" aria-hidden="true">이어서 편집 ${icon('arrow-right')}</span>
      <button class="btn ghost sm" data-del="${p.id}" aria-label="${esc(p.title)} 삭제">삭제</button></li>`).join('')}</ul>`;
  body.onclick = async e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = '한 번 더'; setTimeout(() => { delete del.dataset.armed; del.textContent = '삭제'; }, 3000); return; }
      try {
        await api(`/api/am/projects/${del.dataset.del}/delete`, { method: 'POST' });
        if (am.cur?.id === del.dataset.del) clearCurrent();
        notify('기획안을 삭제했어요'); emit('am:changed'); paintList();
      } catch (err) { notify(err.message); }
      return;
    }
    const tr = e.target.closest('[data-open]'); if (tr) open(tr.dataset.open);
  };
  body.onkeydown = null;   // 제목 버튼이 키보드로 열기를 맡는다
}

async function newBlank() {
  try { await saveNow(); await createProject({ title: '새 기획안', origin: { type: 'brief', ref: '' } }); resetBriefCache(); step = 'brief'; view = 'hub'; paintHub(); }
  catch (e) { notify(e.message); }
}

async function newFromSeason(x) {
  try {
    await saveNow();
    await createProject({ title: `${x.name} 기획`, origin: { type: 'calendar', ref: `${x.name}|${x.date}`.slice(0, 120) },
      brief: { myeongbun: x.name, period: { start: x.date, end: x.end || x.date }, season_ref: { name: x.name, date: x.date }, background: x.memo || '' } });
    step = 'brief'; view = 'hub'; resetBriefCache(); paintHub();
    notify('명분을 담은 브리프를 열었어요. 컨셉은 씨앗을 눌러 시작할 수 있어요');
  } catch (e) { notify(e.message); }
}

async function newFromTrend(t) {
  const term = String(t.term || '').trim(); if (!term) return;
  const seen = new Set(), pool = [];
  for (const r of t.rows || []) {
    const k = r.items && r.items.length ? r.items.map(i => `${i.seq}x${i.qty || 1}`).join('+') : String(r.seq || '');
    if (!k || seen.has(k)) continue; seen.add(k);
    pool.push({ seq: r.items && r.items.length ? null : String(r.seq), items: r.items && r.items.length ? r.items : null, memo: String(r.memo || '').slice(0, 200), source: String(t.source || '트렌드').slice(0, 40) });
  }
  try {
    await saveNow();
    await createProject({ title: `${term} 기획`.slice(0, 80), origin: { type: 'idea', ref: `트렌드:${term}`.slice(0, 120) },
      brief: { myeongbun: term.slice(0, 300), background: String(t.rationale || '').slice(0, 2000) }, pool: pool.slice(0, 100) });
    step = 'brief'; view = 'hub'; resetBriefCache(); paintHub();
    notify(`트렌드 「${term}」로 브리프를 열었어요.${pool.length ? ` 연결 상품 ${pool.length}개는 03 상품·혜택의 후보 상품에 있어요` : ' 연결 상품은 없어요'}`,
      pool.length ? [{ label: '후보 상품 보기', run: () => emit('am:open-step', { step: 'promo', sub: 'pool' }) }] : []);
  } catch (e) { notify(e.message); }
}

// R12-1: 트렌드는 매년 반복되지 않을 수 있어 '그 시기의 명분'으로만 남긴다 (종류 트렌드, 기본 오늘부터 4주)
async function saveTrendSeason(t) {
  const term = String(t.term || '').trim().slice(0, 30); if (!term) return;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const a = new Date(), b = new Date(); b.setDate(b.getDate() + 27);
  const v = await ask('이 시기 명분으로 남길까요?',
    `<p class="sm">「${esc(term)}」을(를) 명분 사전에 종류 '트렌드'로 남겨요. 기간은 ${mmdd(iso(a))}~${mmdd(iso(b))} (4주)이고, 캘린더 명분 사전에서 고칠 수 있어요.</p>
     <p class="cap">트렌드는 매년 반복되지 않을 수 있어 이 기간에만 캘린더에 보여요.</p>`,
    [{ label: '닫기', value: null }, { label: '남기기', value: 'go', primary: true }]);
  if (v !== 'go') return;
  try {
    const r = await api('/api/am/seasons/add', { method: 'POST', body: { name: term, date: iso(a), end: iso(b), kind: '트렌드', lead: 0, seeds: [],
      memo: `${t.memo || '트렌드'} · 남긴 날 ${iso(a)}`.slice(0, 120) } });
    notify(r.added ? `「${term}」을(를) 이 시기 명분으로 남겼어요` : r.reason);
    emit('seasons:changed');
  } catch (e) { notify(e.message); }
}

async function importLegacy(e) {
  const id = e.target.value; e.target.value = ''; if (!id) return;
  try {
    await saveNow();
    const d = await api(`/api/am/legacy/${id}/import`, { method: 'POST' });
    await openProject(d.id); resetBriefCache(); step = defaultStep(am.cur); view = 'hub'; paintHub();
    notify('기존 기획안을 새 기획안으로 가져왔어요. 원래 기획안은 그대로 있어요'); emit('am:changed');
  } catch (err) { notify(err.message); }
}

async function open(id) {
  try { await saveNow(); await openProject(id); resetBriefCache(); step = defaultStep(am.cur); view = 'hub'; paintHub(); }
  catch (e) { notify(e.message); paintList(); }
}

// ---------------------------------------------------------------- 기획안 화면
function asideOpen() { try { return localStorage.getItem(LS_ASIDE) !== 'closed'; } catch { return true; } }

function paintHub() {
  parkWb();
  view = 'hub';
  $('#amList').classList.add('hidden');
  const hub = $('#amHub'); hub.classList.remove('hidden');
  const p = am.cur;
  // 아랫줄 앱 막대 (디자이너 v2.5.1 구성, plans/15 1장): 이름 한 줄(정보 창) · 단계 탭 · 할 일 · 저장 · 실행 취소 · 다음 행동.
  // 기간·상태·명분·제작 일정은 막대에 두지 않고 정보 창과 단계 제목 아래 작은 표시로 (이름이 길어도 겹치지 않게)
  hub.innerHTML = `<div class="am-appbar" id="amAppbar">
      <button class="am-ident" id="amIdent" aria-haspopup="dialog" aria-expanded="false" aria-controls="amInfoPop"><span class="am-ident-t" id="amIdentT"></span>${icon('chev', 'am-ident-chev')}</button>
      <nav class="seg am-stepbar" role="tablist" aria-label="기획안 단계" id="amStepBar"></nav>
      <div class="am-acts">
        <button class="am-todo" id="amTodoBtn" aria-haspopup="dialog" aria-expanded="false" aria-controls="amTodoPop"><span class="long">다음에 할 일</span><span class="short">할 일</span> <b id="amTodoN">0</b></button>
        <span class="am-save" id="amSave" role="status" aria-live="polite"></span>
        <button class="btn sm ghost am-iconbtn" id="amUndo" aria-label="실행 취소" title="실행 취소 (Ctrl+Z)" disabled>${icon('undo')}</button>
        <button class="btn sm ghost am-iconbtn" id="amRedo" aria-label="다시 실행" title="다시 실행 (Ctrl+Y)" disabled>${icon('redo')}</button>
        <button class="btn primary am-nextbtn" id="amNextStep"></button>
      </div>
      <div class="am-pop am-infopop hidden" id="amInfoPop" role="dialog" aria-label="기획안 정보">
        <label class="am-f"><span>기획안 이름</span><input type="text" class="am-title" id="amTitle" maxlength="80" value="${esc(p.title)}" placeholder="기획안 이름"></label>
        <div class="am-facts" id="amSub"></div>
        <label class="am-f am-statussel"><span>상태</span><select id="amStatus">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <section id="amSched"></section>
        <div class="row wrap am-pop-foot"><button class="btn sm" id="amBack">${icon('arrow-left')} 기획안 목록</button><button class="btn sm" id="amSwitch">다른 기획안으로</button>
          <button class="btn sm ghost" id="amAsideBtn" aria-pressed="${asideOpen()}">${asideOpen() ? '옆 패널 접기' : '옆 패널 펴기'}</button></div>
      </div>
      <div class="am-pop am-todopop hidden" id="amTodoPop" role="dialog" aria-label="다음에 할 일"><section id="amNext"><h2>다음에 할 일</h2><div class="empty"><span class="spin"></span></div></section></div>
    </div>
    <div class="am-hubbody ${asideOpen() ? '' : 'aside-closed'}" id="amBody">
      <div class="am-main" id="amTab"></div>
      <aside class="am-aside" id="amAside" aria-label="이 단계의 근거"><div id="amAsideStep"></div></aside>
    </div>`;
  paintIdent();
  bindPop('#amIdent', '#amInfoPop', () => $('#amTitle')?.focus());
  bindPop('#amTodoBtn', '#amTodoPop');
  $('#amBack').addEventListener('click', async () => { closePops(); if (await canLeave()) { await saveNow(); paintList(); } });
  $('#amSwitch').addEventListener('click', e => { closePops(); openChipMenu({ currentTarget: $('#amIdent') }); });
  $('#amTitle').addEventListener('input', e => { p.title = e.target.value; scheduleSave(); emit('am:brief', 'title'); });
  $('#amStatus').addEventListener('change', e => { p.status = e.target.value; scheduleSave(); paintSub(); });
  $('#amAsideBtn').addEventListener('click', e => {
    const open = !asideOpen();
    try { localStorage.setItem(LS_ASIDE, open ? 'open' : 'closed'); } catch { /* 저장소 없음 */ }
    $('#amBody').classList.toggle('aside-closed', !open);
    e.currentTarget.textContent = open ? '옆 패널 접기' : '옆 패널 펴기'; e.currentTarget.setAttribute('aria-pressed', open);
  });
  const go = async s => { if (!s || s === step || !(await canLeave())) return; step = s; paintSteps(); paintTab(); $(`#amStepBar [data-step="${s}"]`)?.focus(); };
  $('#amStepBar').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) go(b.dataset.step); });
  $('#amStepBar').addEventListener('keydown', e => {   // 탭 목록: 좌우 화살표로 단계 이동
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = STEPS.findIndex(s => s.id === step), j = i + (e.key === 'ArrowRight' ? 1 : -1);
    if (j >= 0 && j < STEPS.length) { e.preventDefault(); go(STEPS[j].id); }
  });
  $('#amNextStep').addEventListener('click', e => go(e.currentTarget.dataset.to));
  $('#amUndo').addEventListener('click', doUndo);
  $('#amRedo').addEventListener('click', doRedo);
  $('#amNext').addEventListener('click', onNextClick);
  paintSub(); paintSave(); paintSteps(); paintTab(); paintChip();
}

// 앱 막대 왼쪽: 기획안 이름 한 줄. 넘치면 CSS로 말줄임, 전체 이름은 title과 정보 창에
function paintIdent() {
  const t = $('#amIdentT'), b = $('#amIdent'); if (!t || !am.cur) return;
  const name = am.cur.title || '제목 없는 기획안';
  t.textContent = name; b.title = `${name} · 눌러서 기간, 상태, 제작 일정 보기`;
  b.setAttribute('aria-label', `기획안 ${name}. 기획안 정보 열기`);
}

// 앱 막대의 작은 창 (기획안 정보, 다음에 할 일): 하나만 열고, 바깥을 누르거나 Esc로 닫는다
function closePops() {
  $$('#amAppbar .am-pop').forEach(p => p.classList.add('hidden'));
  $$('#amAppbar [aria-haspopup]').forEach(b => { b.setAttribute('aria-expanded', 'false'); b.classList.remove('open'); });
}
function bindPop(btnSel, popSel, onOpen) {
  const btn = $(btnSel), pop = $(popSel);
  btn.addEventListener('click', () => {
    const open = pop.classList.contains('hidden');
    closePops();
    if (!open) return;
    pop.classList.remove('hidden'); btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open');
    onOpen?.();
  });
}
document.addEventListener('click', e => { if (!e.target.closest('#amAppbar .am-pop, #amAppbar [aria-haspopup]')) closePops(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = $('#amAppbar .am-pop:not(.hidden)'); if (!open) return;
  const btn = $(`#amAppbar [aria-controls="${open.id}"]`); closePops(); btn?.focus();
});

function doUndo() { if (PAGE_STEPS.includes(step) && undo(am.cur)) { scheduleSave(); paintTab(); notify('마지막 편집을 되돌렸어요'); } }
function doRedo() { if (PAGE_STEPS.includes(step) && redo(am.cur)) { scheduleSave(); paintTab(); notify('편집을 다시 실행했어요'); } }
function paintUndo() {
  const on = PAGE_STEPS.includes(step);
  const u = $('#amUndo'), r = $('#amRedo'); if (!u) return;
  u.disabled = !on || !canUndo(); r.disabled = !on || !canRedo();
  u.classList.toggle('hidden', !on); r.classList.toggle('hidden', !on);
}

function stepState(id) {
  const p = am.cur, b = p.brief, rows = p.promo_rows, ps = pageStats(p);
  if (id === 'brief') return !(b.myeongbun || '').trim() ? ['명분 없음', 'warn'] : (b.concept && b.period ? ['준비됨', 'ok'] : ['작성 중', '']);
  if (id === 'promo') {
    if (promoDirty()) return ['저장하지 않은 변경', 'warn'];
    const deals = rows.filter(r => r.type === '하루특가').length;
    return rows.length ? [`상품 ${rows.length}${deals ? ` · 하루특가 ${deals}` : ''}`, ''] : ['비어 있음', 'mute'];
  }
  if (id === 'page') {
    if (!p.page && b.page_kind === '없음') return ['해당 없음', 'mute'];
    return ps.sections ? [`섹션 ${ps.sections}`, ''] : ['비어 있음', 'mute'];
  }
  if (id === 'deliver') return deliverStepState(p);
  if (id === 'editor') {
    if (!ps.sections) return ['구좌 없음', 'mute'];
    const done = (p.page?.sections || []).filter(s => s.headline).length;
    return [`카피 ${done}/${ps.sections}`, done === ps.sections ? 'ok' : ''];
  }
  return ['', 'mute'];
}

function paintSteps() {
  const bar = $('#amStepBar'); if (!bar || !am.cur) return;
  // 디자이너 단계 탭은 한 줄. 단계 상태는 탭 설명(title·낭독)으로, 확인이 필요하면 작은 점으로 표시
  bar.innerHTML = STEPS.map(s => {
    const [label, cls] = stepState(s.id);
    return `<button role="tab" class="am-step ${s.id === step ? 'on' : ''} ${cls === 'warn' ? 'warn' : ''}" data-step="${s.id}" aria-selected="${s.id === step}" tabindex="${s.id === step ? 0 : -1}"
      title="${esc(label)}" aria-label="${s.n} ${esc(s.name)}${label ? `, ${esc(label)}` : ''}"><span class="am-step-no">${s.n}</span><span class="am-step-nm">${esc(s.name)}</span></button>`;
  }).join('');
  const cur = STEPS.find(s => s.id === step), i = STEPS.indexOf(cur), nx = STEPS[i + 1], b = $('#amNextStep');
  if (b) { b.classList.toggle('hidden', !nx); if (nx) { b.dataset.to = nx.id; b.innerHTML = `<span class="long">${esc(cur.cta)}</span><span class="short">다음</span> ${icon('arrow-right')}`; b.title = `${nx.n} ${nx.name}`; } }
}

function paintSub() {
  const sub = $('#amSub'); if (!sub || !am.cur) return;
  const p = am.cur, b = p.brief, per = b.period;
  sub.innerHTML = [['기간', per ? `${per.start} ~ ${per.end} · ${dLabel(per.start)}` : '날짜 미정'],
    ['명분', b.myeongbun || '아직 정하지 않았어요'], ['페이지', b.page_kind === '없음' ? '페이지 없음' : `${b.page_kind} 페이지`],
    p.snapshot && ['확정', p.snapshot.confirmed_at]].filter(Boolean).map(([k, v]) => `<div><span class="k">${k}</span><span class="am-v">${esc(v)}</span></div>`).join('');
}

function paintSave() {
  const el = $('#amSave'); if (!el) return;
  const s = am.saveState;
  el.className = `am-save ${s}`;
  el.textContent = s === 'saving' || s === 'dirty' ? '저장하고 있어요' : s === 'saved' ? '저장했어요' : '';
  if (s === 'error') { el.innerHTML = `${esc(`저장을 확인해 주세요: ${am.saveError}`)} <button class="btn sm" id="amRetry">다시 시도</button>`; $('#amRetry').addEventListener('click', () => saveNow()); }
}

function paintTab() {
  parkWb();
  // 실행 취소 기록은 ③④ 안에서만 이어 쓴다. 다른 단계(⑤의 디자인 요청 등)에서 고친 것을 되돌려 덮지 않도록 묶음을 벗어나면 비운다
  const grp = PAGE_STEPS.includes(step) ? 'page' : step;
  if (grp !== histStep || am.cur?.id !== histPid) { resetHistory(am.cur?.id); histStep = grp; histPid = am.cur?.id; }
  paintUndo();
  const el = $('#amTab'), side = $('#amAsideStep');
  side.innerHTML = '';
  $('#amBody').classList.toggle('am-wide', step === 'editor');   // ④는 옆 패널 없이 넓게 (구좌 목록·와이어프레임·편집 패널 3열)
  $('#amAsideBtn').classList.toggle('hidden', step === 'editor');
  if (step === 'brief') renderBrief(el, side);
  else if (step === 'promo') paintPromo(el, side);
  else if (step === 'page') renderPage(el);
  else if (step === 'editor') renderEditor(el);
  else if (step === 'deliver') renderDeliver(el, side);
  refreshNext();
  paintSchedule();
}
let histPid = null;

// ---------------- ② 상품·할인 (작업대 + 하루특가 편성) ----------------
function paintPromo(el, side) {
  // 디자이너 S05 '상품·혜택' 구성: 단계 머리 → 안내 띠 → 보기 탭 → 표 → 표 아래 원가 안내. 내용과 데이터 항목은 멘토님 툴(작업대) 그대로
  el.innerHTML = `<div class="am-stephead"><div class="grow"><div class="overline">03 · 상품·혜택</div><h2>상품·혜택 검토</h2>
        <p>어떤 상품을 얼마에, 언제 할인할지 정해요. 할인 행과 하루특가 편성은 직접 저장하고, 저장한 내용만 다른 단계와 캘린더에 반영돼요.</p>${ctxTags()}</div>
      <div class="am-wbbar"><span class="am-wbstate" id="amWbState" role="status" aria-live="polite"></span>
      <button class="btn" id="amWbUndo">저장 전으로 되돌리기</button>
      <button class="btn primary" id="amWbSave">저장하기</button></div>
    </div>
    <div class="info-box am-promo-note"><b>기획안의 할인만 바꿔요.</b> 실제 판매 가격과 PROMO_WORK는 바뀌지 않아요. 05 미리보기·내보내기에서 내보낸 엑셀을 PROMO_WORK에 붙여 넣어야 반영돼요.</div>
    <nav class="seg am-subtabs" role="tablist" aria-label="상품·할인 보기">
      <button role="tab" class="am-subtab" data-sub="rows">구좌 상품</button>
      <button role="tab" class="am-subtab" data-sub="deals">하루특가 편성</button>
      <button role="tab" class="am-subtab" data-sub="pool">후보 상품</button>
    </nav>
    <div id="amRowsBar" class="am-rowsbar"><span class="cap">상시 할인과 할인 없음 상품이에요. Zone이 페이지의 상품 구좌가 돼요.</span><span class="grow"></span><label class="ck"><input type="checkbox" id="amRowsAll"> 하루특가 행도 함께 보기</label></div>
    <div class="am-wb" id="amWbHost"></div>
    <div id="amDealHost"></div>
    <div id="amPoolHost"></div>
    <p class="cap am-promo-foot">원가와 원가율은 이 화면에서만 보여요. 디자이너 기획안과 팀 공유 요약에는 넣지 않아요. 페이지에서 가격을 어떻게 보여줄지는 02 구성과 04 구좌 편집에서 정해요.</p>`;
  side.innerHTML = `<section class="card" id="amEvidence"></section><section class="card"><h2>이 단계에서</h2><ul class="am-plain">
      <li>구좌 상품과 하루특가 편성은 같은 표를 나눠 보는 거예요. 한쪽에서 고치면 다른 쪽에도 보여요</li>
      <li>할인 없음은 할인 없이 구좌에 놓이는 상품이에요 (PROMO_WORK 큐레이션). 페이지에서 가격을 어떻게 보여줄지는 04 구좌 편집에서 정해요</li>
      <li>상품 화면, 캘린더 하루특가 후보, 조합 추천에서 담은 상품이 여기 모여요</li>
      <li>지난 행사 상품·할인 가져오기는 지금 기획안을 채워요</li>
      <li>상시 할인 위에 하루특가를 얹는 것은 정상 운영이에요</li></ul></section>`;
  if (!wbNodes) wbNodes = [...$('#view-plan').children];
  const host = $('#amWbHost');
  wbNodes.forEach(n => host.appendChild(n));
  resetPromoDraft();
  // R14·R15: 고른 행·칸의 근거를 옆 패널에
  const ev = (row, date) => renderEvidence($('#amEvidence'), row, { rows: wbRows(), date });
  ev(null);
  const pickRow = e => { const tr = e.target.closest('#planTable tr[data-i]'); if (tr) ev(wbRows()[+tr.dataset.i] || null); };
  host.addEventListener('focusin', pickRow); host.addEventListener('click', pickRow);
  $('#amDealHost').addEventListener('click', e => {
    const c = e.target.closest('[data-cell]'); if (c) { ev(wbRows()[+c.dataset.cell] || null); return; }
    const em = e.target.closest('[data-empty]'); if (em) ev(null, em.dataset.empty);
  });
  $('#amWbSave').addEventListener('click', () => savePromo());
  $('#amWbUndo').addEventListener('click', () => { resetPromoDraft(); paintSub2(); paintWbState(); paintSteps(); notify('저장하기 전 상태로 되돌렸어요'); });
  el.querySelector('.am-subtabs').addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (b) { promoSub = b.dataset.sub; paintSub2(); } });
  $('#amRowsAll').checked = rowsAll;
  $('#amRowsAll').addEventListener('change', e => { rowsAll = e.target.checked; wbSetFilter(rowsAll ? null : 'zone'); });
  paintSub2();
  paintWbState();
}

function paintSub2() {
  $$('.am-subtab').forEach(b => { const on = b.dataset.sub === promoSub; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const deals = am.cur.promo_rows.filter(r => r.type === '하루특가').length;
  const db = $('.am-subtab[data-sub="deals"]'); if (db) db.textContent = `하루특가 편성${deals ? ` (${deals})` : ''}`;
  const pb = $('.am-subtab[data-sub="pool"]'); if (pb) pb.textContent = `후보 상품${poolDraft && poolDraft.length ? ` (${poolDraft.length})` : ''}`;
  $('#amWbHost').classList.toggle('hidden', promoSub !== 'rows');
  $('#amRowsBar').classList.toggle('hidden', promoSub !== 'rows');
  $('#amDealHost').classList.toggle('hidden', promoSub !== 'deals');
  $('#amPoolHost').classList.toggle('hidden', promoSub !== 'pool');
  wbSetFilter(promoSub === 'rows' && !rowsAll ? 'zone' : null);
  if (promoSub === 'deals') paintDeals();
  if (promoSub === 'pool') paintPool();
}

function paintDeals() {
  const host = $('#amDealHost'); if (!host || !dealDraft) return;
  renderDeals(host, { plan: dealDraft, onPlanChange: () => { paintDeals(); paintWbState(); paintSteps(); } });
}

function paintPool() {
  const host = $('#amPoolHost'); if (!host || !poolDraft) return;
  renderPool(host, { pool: poolDraft, deal: dealDraft, onChange: () => { paintPool(); paintSub2(); paintWbState(); paintSteps(); } });
}

function paintWbState() {
  const st = $('#amWbState'); if (!st) return;
  const dirty = wbIsDirty() || dealDirty() || poolDirty();
  st.className = `am-wbstate ${dirty ? 'dirty' : 'clean'}`;
  st.textContent = dirty ? '아직 기획안에 저장하지 않았어요' : '저장했어요';
  $('#amWbSave').disabled = !dirty; $('#amWbUndo').disabled = !dirty;
  // 디자이너 상품·혜택의 카드 제목. 표 카드(plan.js 마크업)는 그대로 쓰고 제목만 바꿈, parkWb에서 되돌림
  const h = $('#amWbHost .sec-head h2'); if (h) h.innerHTML = `상품·가격 <span class="cap">${wbRows().length}행</span>`;
}

async function savePromo() {
  const prevRows = am.cur.promo_rows, prevDeal = am.cur.deal_plan;
  am.cur.promo_rows = JSON.parse(JSON.stringify(wbRows()));
  const prevPool = am.cur.pool;
  if (dealDraft) am.cur.deal_plan = JSON.parse(JSON.stringify(dealDraft));
  if (poolDraft) am.cur.pool = JSON.parse(JSON.stringify(poolDraft));
  await saveNow();
  if (am.saveState === 'error') { am.cur.promo_rows = prevRows; am.cur.deal_plan = prevDeal; am.cur.pool = prevPool; notify(`저장하지 못했어요: ${am.saveError}`); return false; }
  wbMarkClean(); dealBase = JSON.stringify(dealDraft); poolBase = JSON.stringify(poolDraft);
  paintWbState(); paintSteps(); paintChip(); refreshNext(); paintSub2();
  notify('상품·할인을 저장했어요');
  return true;
}

// ---------------- 오른쪽: 다음에 할 일, 제작 일정 ----------------
let schedCache = { key: '', data: null };
async function loadSchedule() {
  const b = am.cur?.brief;
  if (!b || !b.period || b.page_kind === '없음') return null;
  const key = `${b.period.start}|${b.page_kind}`;
  if (schedCache.key === key) return schedCache.data;
  try { schedCache = { key, data: await api(`/api/am/schedule?open=${b.period.start}&kind=${encodeURIComponent(b.page_kind)}`) }; }
  catch { schedCache = { key, data: null }; }
  return schedCache.data;
}

let nextSeq = 0;
async function refreshNext() {
  const box = $('#amNext'); if (!box || !am.cur) return;
  const my = ++nextSeq;
  const items = await nextItems(am.cur, { dirty: promoDirty(), sched: await loadSchedule() });
  if (my !== nextSeq || !$('#amNext')) return;
  const top = items.slice(0, 3), more = items.slice(3);
  const li = it => `<li><button class="am-nextitem" data-go-step="${it.step}" ${it.sub ? `data-go-sub="${it.sub}"` : ''}>${esc(it.text)}</button>${it.act ? `<button class="btn sm" data-next-act="${it.act}">${esc(it.actLabel)}</button>` : ''}</li>`;
  box.innerHTML = `<h2>다음에 할 일</h2>${items.length ? `<ul class="am-nextlist">${top.map(li).join('')}</ul>
    ${more.length ? `<details class="am-nextmore"><summary>${more.length}개 더 보기</summary><ul class="am-nextlist">${more.map(li).join('')}</ul></details>` : ''}`
    : '<p class="sm">단계 사이에서 맞지 않는 곳이 없어요. 05 미리보기·내보내기에서 확정하고 내보낼 수 있어요.</p>'}`;
  // 앱 막대의 '다음에 할 일' 버튼에 개수
  const n = $('#amTodoN'), btn = $('#amTodoBtn');
  if (n) { n.textContent = items.length; btn.classList.toggle('has', items.length > 0); }
}

async function onNextClick(e) {
  const act = e.target.closest('[data-next-act]');
  if (act && act.dataset.nextAct === 'deal-section') {
    closePops();
    if (!(await canLeave())) return;
    addDealSection(am.cur); scheduleSave();
    step = 'page'; paintSteps(); paintTab();
    notify('페이지에 하루특가 구좌를 추가했어요. 위치는 02 구성의 구좌 목록에서 바꿀 수 있어요');
    return;
  }
  const go = e.target.closest('[data-go-step]');
  if (!go) return;
  closePops();
  if (go.dataset.goSub) promoSub = go.dataset.goSub;
  if (go.dataset.goStep === step) { if (step === 'promo') paintSub2(); return; }
  if (!(await canLeave())) return;
  step = go.dataset.goStep; paintSteps(); paintTab();
}

async function paintSchedule() {
  const box = $('#amSched'); if (!box) return;
  const b = am.cur.brief;
  if (b.page_kind === '없음') { box.innerHTML = '<h2>제작 일정</h2><p class="cap">페이지 없이 진행하는 기획안이라 제작 일정이 없어요.</p>'; return; }
  if (!b.period) { box.innerHTML = '<h2>제작 일정</h2><p class="cap">기간을 정하면 오픈일(시작일) 기준으로 기획 착수부터 QA까지 날짜를 계산해요.</p>'; return; }
  const d = await loadSchedule();
  if (!$('#amSched')) return;
  if (!d) { box.innerHTML = '<h2>제작 일정</h2><p class="cap">일정을 계산하지 못했어요.</p>'; return; }
  const modeCls = { 표준: 'ok', 압축: 'warn', 위험: 'err', 매우위험: 'err' }[d.mode] || '';
  box.innerHTML = `<div class="sec-head"><h2>제작 일정</h2><span class="am-badge ${modeCls}">${esc(d.mode)}</span></div>
    <ol class="am-steps-v">${d.steps.map(s => `<li class="${s.state}"><span>${esc(s.label)}</span><span class="cap">${mmdd(s.date)}(${s.dow})${s.state === 'past' ? ' 지남' : s.state === 'today' ? ' 오늘' : ''}</span></li>`).join('')}</ol>
    <p class="cap">${esc(d.rule)}. 오픈일은 브리프 시작일로 봐요.</p>`;
}
