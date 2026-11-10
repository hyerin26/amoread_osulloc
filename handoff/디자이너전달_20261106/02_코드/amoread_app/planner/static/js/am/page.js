// 02 구성: 기획 방향(대표 카피) + 구좌 구성안. 구좌 순서, 진열 유형·Zone·필터 탭, 목표, 레이아웃, 추천 레퍼런스, 연결 상품, 디자인 요청
// 할인 트랙과의 다리: 할인 행의 Zone(PROMO_WORK 카테고리명)으로 구좌를 잇는다. 탭 구좌는 탭 하나가 Zone 하나 (plans/17)
// 제안(대표 카피, 지난 진열 구성, 목적별 구성, 레퍼런스)은 sources/의 출처 모듈에 묻는다. 지금은 모두 DEMO (plans/15 2장)
// 구좌 목록은 디자이너 v2.5.1 S06 왼쪽 목록 모양: 손잡이로 끌어 순서 바꾸기, Alt+↑/↓, 실행 취소 (plans/10 D4)
import { $, emit, esc, icon, mmdd, state, toast } from '../core.js';
import { am, dealPlanOf, PURPOSES, scheduleSave, SECTION_GOALS, uid } from './store.js';
import { record, reorderById, snap } from './history.js';
import { sortable } from './sortable.js';
import { ctxTags } from './meta.js';
import { copyIdeas } from './sources/copy.js';
import { pastOutlines, purposeOutline } from './sources/outline.js';
import { layoutFor, ZONE_KINDS } from './sources/zones.js';
import { recommendRefs } from './sources/recommend.js';
import { byRef, REF_BASIS } from './sources/references.js';
import { openRefViewer, refTile } from './refart.js';

// 페이지를 바꾸는 모든 동작은 이것으로 감싼다: 실행 취소 기록 + 자동 저장
export function changePage(fn) { const before = snap(am.cur); const r = fn(); record(am.cur, before); scheduleSave(); return r; }
// 글 입력은 한 글자마다 기록하지 않고, 칸에 들어갈 때의 상태를 칸에서 나올 때 한 번 기록한다
export function bindFieldHistory(box, sel) {
  let before = null;
  box.addEventListener('focusin', e => { if (e.target.matches(sel)) before = snap(am.cur); });
  box.addEventListener('focusout', e => { if (e.target.matches(sel) && before !== null) { record(am.cur, before); before = null; } });
}
// 구좌 하나를 delta(-1 위, 1 아래)만큼 옮긴다
export function stepSection(id, delta) {
  const secs = am.cur.page?.sections || [], i = secs.findIndex(s => s.sectionId === id), j = i + delta;
  if (i < 0 || j < 0 || j >= secs.length) return false;
  changePage(() => reorderById(secs, id, secs[j].sectionId, delta > 0));
  return true;
}

export const LAYOUTS = [
  { id: 'hero', name: '단일 비주얼' },
  { id: 'text-cta', name: '텍스트와 버튼' },
  { id: 'grid2', name: '2열 상품' },
  { id: 'grid3', name: '3열 상품' },
  { id: 'split', name: '좌우 분할' },
  { id: 'benefit', name: '혜택 안내' },
  { id: 'deal-banner', name: '날짜별 특가' },
];
// 가격 노출 방식 (R18 축 2). 섹션 구성을 마친 뒤 정하는 경우가 많아 기본은 미정
export const DISPLAYS = [['', '미정'], ['emphasis', '할인율 강조'], ['price', '가격 표시'], ['name', '이미지·상품명만'], ['section', '섹션 대표 가격']];
const DISPLAY_HINT = { '': '아직 정하지 않았어요. 섹션 구성을 마친 뒤 정해도 돼요', emphasis: '상품마다 할인율을 크게, 할인가와 정가를 함께 보여줘요', price: '상품마다 할인가(와 정가)를 보여줘요', name: '사진과 이름만 보여주고, 가격은 상품 페이지에서 봐요', section: '섹션 제목에 가격 하나(예: 균일가 8,800원), 상품은 사진과 이름만' };
export const layoutName = id => (LAYOUTS.find(l => l.id === id) || {}).name || '레이아웃 미정';

let root = null;
let selId = null;
let copyOpen = false;          // 대표 카피 예시 펼침
let past = null, pastErr = false;   // 지난 진열 구성 (출처 결과)
const pastSplit = new Map();   // 회차 key → 따로 구좌로 가져올 묶음 번호들 (기본은 탭 구좌 1개로)
let kindEdit = null;           // 진열 유형 칸 편집: 'add' | 'rename' | null

const PRODUCT = ['grid2', 'grid3', 'split'];
const MAX_SLOTS = 40, MAX_TABS = 12, PAST_CAP = 12;   // 서버 한도(구좌 카드 40, 탭 12)와 지난 구성 칸 수 상한

export function newSlot(seq = null, items = null, customCopy = '') {
  const has = !!(seq || (items && items.length));
  return { slotId: uid('slot-'), seq: seq ? String(seq) : null, items: items && items.length ? items : null,
    placeholderStatus: has ? 'AVAILABLE' : 'UNDECIDED', customCopy };
}
function newSection(o = {}) {
  return { sectionId: uid('sec-'), order: 0, name: o.name || '새 섹션', purpose: o.purpose || '', role: o.role || '', zone_tag: o.zone_tag || '',
    zone_kind: o.zone_kind || '', tabs: o.tabs || [],
    layoutId: o.layoutId || 'grid2', layoutSourceRefId: null, headline: '', subhead: '', cta: '', slots: o.slots || [],
    designNotes: '', designerReferences: [], unplacedProducts: [], price_display: '', section_price: null };
}
const sections = () => am.cur.page?.sections || [];
const rows = () => am.cur.promo_rows || [];
const isDeal = r => r.type === '하루특가';
// 탭(필터) 구좌: 탭 하나 = Zone 하나. 카드의 tabId가 없으면 첫 탭 카드로 본다
const tabsOf = s => s.tabs || [];
const tabSlots = (s, t, i) => s.slots.filter(x => x.tabId ? x.tabId === t.tabId : i === 0);
const zoneRowsFor = z => z ? rows().filter(r => !isDeal(r) && (r.category_tag || '') === z) : [];

// 섹션 상품이 ② 구좌 상품에서 어떤 할인인지 (상시 n%, 할인 없음, 할인 미정)
function roleOf(slot) {
  const k = slotKey(slot); if (k.startsWith('u:')) return null;
  const r = rows().find(x => !isDeal(x) && rowSlotKey(x) === k);
  if (!r) return ['할인 미정', 'und'];
  return r.type === '큐레이션' ? ['할인 없음', 'none'] : [`상시 ${Math.round((r.rate || 0) * 100)}%`, 'ok'];
}
function productName(slot) {
  if (slot.items && slot.items.length) return '신규 조합: ' + slot.items.map(it => ((state.bySeq.get(String(it.seq)) || {}).name || it.seq) + (it.qty > 1 ? ` ${it.qty}개` : '')).join(' + ');
  if (!slot.seq) return '상품 미정';
  return (state.bySeq.get(String(slot.seq)) || {}).name || `SEQ ${slot.seq} (상품 정보 없음)`;
}
const slotKey = s => s.seq ? `s:${s.seq}` : s.items ? `i:${s.items.map(i => `${i.seq}x${i.qty}`).join('+')}` : `u:${s.slotId}`;
const rowSlotKey = r => r.items && r.items.length ? `i:${r.items.map(i => `${i.seq}x${i.qty}`).join('+')}` : `s:${r.seq}`;

function zonesOf(rs) {
  const m = new Map();
  rs.filter(r => !isDeal(r)).forEach(r => { const z = r.category_tag || ''; if (!m.has(z)) m.set(z, []); m.get(z).push(r); });
  return m;
}
function slotsFromRows(rs, deal = false) {
  const seen = new Set(), out = [];
  rs.forEach(r => {
    if (!(r.seq || (r.items && r.items.length))) return;
    const k = rowSlotKey(r) + (deal ? `@${r.start}` : '');
    if (seen.has(k)) return; seen.add(k);
    out.push(newSlot(r.seq, r.items, deal ? `${mmdd(r.start)} 하루특가` : ''));
  });
  return out;
}

// Zone으로 섹션 초안: 비어 있으면 메인 비주얼 + Zone별 섹션 + 하루특가 배너, 있으면 빠진 Zone만 추가
function zoneDraft() {
  const rs = rows();
  if (!rs.length) { toast('할인 행이 없어요. 03 상품·혜택에서 먼저 상품을 담아 주세요'); return; }
  ensurePage();
  const secs = am.cur.page.sections;
  const have = new Set(secs.filter(s => s.layoutId !== 'deal-banner').map(s => s.zone_tag));
  const add = [];
  if (!secs.length) add.push(newSection({ name: '메인 비주얼', layoutId: 'hero', purpose: '브랜딩', role: '명분과 컨셉을 전하는 첫 화면' }));
  zonesOf(rs).forEach((list, z) => {
    if (have.has(z)) return;
    add.push(newSection({ name: z || '상품 구좌', zone_tag: z, purpose: '전환', layoutId: list.length >= 3 ? 'grid3' : 'grid2',
      role: z ? `PROMO_WORK 카테고리명 '${z}'의 상품` : 'Zone을 지정하지 않은 상품', slots: slotsFromRows(list) }));
  });
  const deals = rs.filter(isDeal);
  if (deals.length && !secs.some(s => s.layoutId === 'deal-banner')) add.push(dealSection());
  if (!add.length) { toast('새로 추가할 Zone이 없어요. 기존 섹션은 그대로 두었어요'); return; }
  changePage(() => secs.push(...add));
  selId = add[0].sectionId;
  paint();
  toast(`섹션 ${add.length}개를 추가했어요`);
}

function templateDraft() {
  const add = purposeOutline(am.cur.brief.purpose).items.map(x => newSection(x));
  changePage(() => { ensurePage(); am.cur.page.sections.push(...add); });
  selId = add[0].sectionId; paint();
  toast(`기본 구성 ${add.length}개 섹션을 넣었어요. 규칙 기반 예시이니 고쳐서 쓰세요`);
}

function ensurePage() { if (!am.cur.page) am.cur.page = { sections: [] }; }

// 지난 진열 구성으로 시작 (plans/17 4-1): Zone 순서·유형·칸 수만 가져오고 상품은 가져오지 않는다.
// 다만 이 기획안 03 행에 같은 Zone이 있으면 그 상품을 먼저 카드에 놓고, 남는 칸은 빈 카드로 둔다
function pastDraft(it) {
  const split = pastSplit.get(it.key) || new Set();
  const fill = (zone, n, cap, tabId) => {
    const linked = slotsFromRows(zoneRowsFor(zone)).slice(0, cap);
    const out = linked.concat(Array.from({ length: Math.max(0, Math.min(n, cap) - linked.length) }, () => newSlot()));
    if (tabId) out.forEach(x => { x.tabId = tabId; });
    return out;
  };
  const add = [newSection({ name: '메인 비주얼', layoutId: 'hero', purpose: '브랜딩', role: '명분과 대표 카피를 전하는 첫 화면' })];
  it.units.forEach((u, k) => {
    if (u.group && !split.has(k)) {
      const zs = u.zones.slice(0, MAX_TABS), cap = Math.min(PAST_CAP, Math.floor(MAX_SLOTS / zs.length));
      const tabs = zs.map(z => ({ tabId: uid('tab-'), label: z.name.slice(0, 40), zone_tag: z.name.slice(0, 40) }));
      add.push(newSection({ name: `${u.kind}별 추천`, zone_kind: u.kind, tabs, purpose: '전환', layoutId: layoutFor(Math.max(...zs.map(z => z.count))),
        role: `지난 '${it.promo}'의 ${u.kind} 필터 탭`, slots: tabs.flatMap((t, j) => fill(t.zone_tag, zs[j].count, cap, t.tabId)) }));
    } else u.zones.forEach(z => add.push(newSection({ name: z.name.slice(0, 40), zone_kind: z.kind, zone_tag: z.name.slice(0, 40), purpose: '전환',
      layoutId: layoutFor(z.count), role: `지난 '${it.promo}'의 Zone`, slots: fill(z.name, z.count, PAST_CAP) })));
  });
  if (rows().some(isDeal)) add.push(dealSection());
  changePage(() => { ensurePage(); am.cur.page.sections.push(...add); });
  selId = (add[1] || add[0]).sectionId; paint();
  toast(`'${it.promo}' 진열 구성으로 구좌 ${add.length}개를 만들었어요. 빈 카드는 04 구좌 편집에서 상품을 골라 채워요`);
}

// ---------------- 기획 방향 (디자이너 S04 왼쪽 카드). 대표 카피는 브리프에 저장 ----------------
function dirHTML() {
  const b = am.cur.brief, ideas = copyOpen ? copyIdeas(am.cur) : null;
  const dd = (v, empty) => v ? esc(v) : `<span class="cap">${empty}</span>`;
  return `<section class="card am-dir" id="amDir"><h2>기획 방향</h2><div class="am-dir-grid">
    <div><dl class="am-dl">
        <div><dt>기획하는 이유</dt><dd>${dd(b.myeongbun, '01 브리프에서 적어 주세요')}</dd></div>
        <div><dt>콘셉트</dt><dd>${dd(b.concept, '01 브리프에서 적어 주세요')}</dd></div>
        ${b.purpose ? `<div><dt>주요 목적</dt><dd>${esc(b.purpose)}</dd></div>` : ''}</dl>
      <button class="btn sm ghost" data-dir="brief">${icon('arrow-left')} 01 브리프에서 고치기</button></div>
    <div><label class="am-f"><span>대표 카피 <em>페이지 첫 화면의 한 줄. 04에서 메인 카피로 쓸 수 있어요</em></span>
        <input type="text" data-kc maxlength="120" value="${esc(b.key_copy || '')}" placeholder="예) 입동, 첫 추위의 블렌디드 티 바"></label>
      <button class="btn sm" data-dir="ideas" aria-expanded="${copyOpen}">${copyOpen ? '카피 예시 닫기' : '다른 카피 예시 보기'}</button>
      ${ideas ? `<div class="am-ideas"><p class="info-box">미리 준비한 규칙으로 만든 예시예요. AI를 쓰지 않아요.${ideas.basis.length ? ` 쓴 내용: ${esc(ideas.basis.join(', '))}` : ''}</p>
        ${ideas.items.length ? `<ul class="am-ideas-list">${ideas.items.map((t, i) => `<li><span>${esc(t)}</span><button class="btn sm ghost" data-idea="${i}">이 카피 쓰기</button></li>`).join('')}</ul>`
          : '<p class="cap">명분이나 콘셉트를 적으면 예시를 만들 수 있어요.</p>'}</div>` : ''}</div>
  </div></section>`;
}
function bindDir() {
  const d = $('#amDir', root); if (!d) return;
  d.addEventListener('input', e => { if ('kc' in e.target.dataset) { am.cur.brief.key_copy = e.target.value; scheduleSave(); } });
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-dir]');
    if (a?.dataset.dir === 'ideas') { copyOpen = !copyOpen; repaintDir(); $('[data-dir="ideas"]', root)?.focus(); return; }
    if (a?.dataset.dir === 'brief') { document.dispatchEvent(new CustomEvent('am:go-step', { detail: { step: 'brief' } })); return; }
    const i = e.target.closest('[data-idea]');
    if (i) { am.cur.brief.key_copy = copyIdeas(am.cur).items[+i.dataset.idea] || ''; scheduleSave(); repaintDir(); toast('대표 카피로 넣었어요. 이어서 다듬어 주세요'); }
  });
}
function repaintDir() { const d = $('#amDir', root); if (d) { d.outerHTML = dirHTML(); bindDir(); } }

// 하루특가 섹션: 상품을 복사하지 않고 ② 상품·할인의 하루특가 행을 날짜별로 보여준다 (확정 2026-11-05)
function dealSection() {
  return newSection({ name: '하루특가', layoutId: 'deal-banner', purpose: '전환', role: '날짜별로 상품이 바뀌는 특가 영역. 상품은 상품·할인의 하루특가를 따라요' });
}
// 다음에 할 일 [섹션 추가]에서 부른다 (R1). 메인 비주얼 다음 자리에 넣는다
export function addDealSection(p = am.cur) {
  if (!p.page) p.page = { sections: [] };
  const secs = p.page.sections;
  if (secs.some(s => s.layoutId === 'deal-banner')) return null;
  const s = dealSection();
  const at = secs.length && secs[0].layoutId === 'hero' ? 1 : 0;
  secs.splice(at, 0, s);
  if (p.brief.page_kind === '없음') p.brief.page_kind = '이벤트';
  selId = s.sectionId;
  return s;
}
function dealDays() {
  const m = new Map();
  rows().filter(isDeal).forEach(r => { m.set(r.start, (m.get(r.start) || 0) + 1); });
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// ---------------- 그리기 ----------------
let pastFor = null;
export function renderPage(el) {
  root = el;
  const key = `${am.cur.id}|${am.cur.brief.myeongbun}|${am.cur.brief.period?.start || ''}`;
  if (pastFor !== key) { pastFor = key; past = null; pastSplit.clear(); }   // 기획안·명분·시기가 바뀌면 지난 구성을 다시 고른다
  paint();
}

const head = () => `<div class="am-stephead"><div><div class="overline">02 · 구성</div><h2>기획 방향과 구좌 구성</h2>
  <p>대표 카피를 정하고, 페이지를 어떤 구좌로 어떤 순서로 보여 줄지 정해요. 구좌는 끌어서 순서를 바꿀 수 있어요. 키보드는 손잡이에서 Alt+↑/↓예요.</p>${ctxTags()}</div></div>${dirHTML()}`;

function paint() {
  if (!root) return;
  const b = am.cur.brief;
  if (!am.cur.page && b.page_kind === '없음') {
    root.innerHTML = `${head()}<div class="card am-empty-state"><h2>페이지 없이 진행하는 기획안이에요</h2>
      <p class="sm mute">브리프의 페이지 유형이 '페이지 없음(할인만)'으로 되어 있어요. 하루특가 채우기처럼 페이지가 필요 없는 기획이라면 이대로 두면 돼요.</p>
      <button class="btn" id="amStartPage">페이지 기획 시작하기</button></div>`;
    $('#amStartPage', root).addEventListener('click', () => { b.page_kind = '이벤트'; changePage(ensurePage); paint(); });
    bindDir();
    return;
  }
  const secs = sections();
  if (!secs.length) { paintStart(); return; }
  if (!secs.some(s => s.sectionId === selId)) selId = secs[0].sectionId;
  root.innerHTML = `${head()}<div class="am-page">
    <aside class="card am-outline" aria-label="구좌 목록">
      <div class="am-outline-head"><h3>구좌 목록</h3><span class="cap">${secs.length}개</span></div>
      <ol class="am-seclist" id="amSecList"></ol>
      <div class="am-outline-foot">
        <button class="btn primary am-addsec" data-act="add">${icon('plus')} 구좌 추가</button>
        <button class="btn sm" data-act="zone" ${rows().length ? '' : 'disabled'} title="할인 행의 Zone 중 아직 섹션이 없는 것만 추가">Zone 반영</button>
      </div>
      <p class="cap">선택한 구좌 아래에 추가해요.</p>
    </aside>
    <section class="card am-secdetail" id="amSecDetail"></section>
  </div>`;
  paintOutline(); paintDetail(); bindDir();
  bindFieldHistory($('#amSecDetail', root), 'input[data-sf], textarea[data-sf], input[data-tl], input[data-tz]');
  root.querySelector('.am-outline').addEventListener('click', onOutline);
  const list = $('#amSecList', root);
  sortable(list, {
    nameOf: id => (sections().find(s => s.sectionId === id) || {}).name || '구좌',
    onMove: (from, to, after) => { if (changePage(() => reorderById(sections(), from, to, after))) { paintOutline(); toast('구좌 순서를 바꿨어요. 실행 취소로 되돌릴 수 있어요'); } },
    onStep: (id, delta) => { if (stepSection(id, delta)) { paintOutline(); $(`[data-drag="${id}"]`, root)?.focus(); } },
    onCancel: () => toast('구좌 이동을 취소했어요'),
  });
}

function pastHTML() {
  if (!past) return '<div class="empty"><span class="spin"></span> 지난 행사의 진열 구성을 찾고 있어요</div>';
  if (!past.items.length) return `<p class="cap">${pastErr ? '지난 행사 자료를 불러오지 못했어요. 아래 방법으로 시작해 주세요.' : 'Zone이 있는 지난 행사를 찾지 못했어요.'}</p>`;
  return `<p class="info-box">예시예요. ${esc(past.basis.slice(1).join('. '))}. 같은 유형·같은 칸 수의 Zone은 한 구좌 안 필터 탭이었을 수 있어 묶어 보여 줘요.</p>`
    + past.items.map((it, i) => {
      const split = pastSplit.get(it.key) || new Set();
      return `<div class="am-past"><div class="am-past-h"><b>${esc(it.promo)}</b><span class="cap">${mmdd(it.start)}~${mmdd(it.end)} · ${it.rows}행 · ${esc(it.why)}</span>
          <span class="grow"></span><button class="btn sm ${i ? '' : 'primary'}" data-past="${i}">이 구성으로 시작</button></div>
        ${it.units.map((u, k) => `<div class="am-past-u ${u.group ? 'grp' : ''}"><span class="am-past-k ${u.kind ? '' : 'q'}">${esc(u.kind || '유형 모름')}</span>
          <span class="am-past-zs">${u.zones.map(z => `<span class="am-z">${esc(z.name)} <i>${z.count}</i></span>`).join('')}</span>
          ${u.group ? `<span class="am-mseg" role="group" aria-label="${esc(u.kind)} 묶음을 가져오는 방법">
            <button type="button" data-unit="${i}|${k}|tab" aria-pressed="${!split.has(k)}" class="${split.has(k) ? '' : 'on'}">탭 구좌 1개로</button>
            <button type="button" data-unit="${i}|${k}|split" aria-pressed="${split.has(k)}" class="${split.has(k) ? 'on' : ''}">구좌 ${u.zones.length}개로</button></span>` : ''}</div>`).join('')}
        ${it.ordered ? '' : '<p class="cap">진열 순서는 원래 페이지와 다를 수 있어요. 지금 자료에는 행 순서가 없어요.</p>'}</div>`;
    }).join('');
}

function paintStart() {
  const rs = rows(), z = zonesOf(rs).size, d = rs.filter(isDeal).length;
  const p = am.cur.brief.purpose;
  root.innerHTML = `${head()}<div class="am-start">
    <section class="card am-pastcard"><h2>지난 진열 구성에서 시작하기</h2>
      <p class="cap">비슷한 지난 행사의 Zone 순서와 칸 수만 가져와요. 상품은 가져오지 않고 03·04에서 골라요. 숫자는 그 칸에 놓였던 상품 수예요.</p>
      <div id="amPast">${pastHTML()}</div></section>
    <p class="am-start-lead">다른 방법으로 시작할 수도 있어요. 시작한 뒤에도 구좌는 자유롭게 고칠 수 있어요.</p>
    <div class="am-startgrid">
      <button class="am-startcard" data-act="zone" ${rs.length ? '' : 'disabled'}>
        <span class="am-st-t">할인 기획에서 가져오기</span>
        <span class="am-st-d">${rs.length ? `할인 행의 Zone ${z}개${d ? `와 하루특가 ${d}개` : ''}로 섹션 초안을 만들어요. 상품도 함께 연결돼요.` : '할인 행이 아직 없어요. 상품·할인 탭에서 먼저 담으면 쓸 수 있어요.'}</span></button>
      <button class="am-startcard" data-act="tpl">
        <span class="am-st-t">목적별 기본 구성</span>
        <span class="am-st-d">${p ? `브리프 목적 '${esc(p)}'에 맞는 기본 섹션 순서를 넣어요.` : '브리프에서 목적을 고르면 목적에 맞는 순서를 넣어요. 지금은 기본 순서를 넣어요.'} 규칙 기반 예시예요.</span></button>
      <button class="am-startcard" data-act="blank">
        <span class="am-st-t">빈 페이지</span>
        <span class="am-st-d">섹션을 하나씩 직접 추가해요.</span></button>
    </div></div>`;
  root.querySelector('.am-startgrid').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
    if (a.dataset.act === 'zone') zoneDraft();
    else if (a.dataset.act === 'tpl') templateDraft();
    else { const s = newSection({ name: '메인 비주얼', layoutId: 'hero', purpose: '브랜딩' }); changePage(() => { ensurePage(); am.cur.page.sections.push(s); }); selId = s.sectionId; paint(); }
  });
  bindDir();
  const box = $('#amPast', root);
  box.addEventListener('click', e => {
    const u = e.target.closest('[data-unit]');
    if (u) {
      const [i, k, how] = u.dataset.unit.split('|'), key = past.items[+i].key, set = pastSplit.get(key) || new Set();
      how === 'split' ? set.add(+k) : set.delete(+k); pastSplit.set(key, set);
      box.innerHTML = pastHTML(); $(`[data-unit="${u.dataset.unit}"]`, box)?.focus(); return;
    }
    const b = e.target.closest('[data-past]'); if (b) pastDraft(past.items[+b.dataset.past]);
  });
  if (past) return;
  const el = root;
  pastOutlines(am.cur).then(r => { past = r; pastErr = false; }, () => { past = { items: [], basis: [] }; pastErr = true; })
    .then(() => { if (root === el && $('#amPast', root)) $('#amPast', root).innerHTML = pastHTML(); });
}

function thumb(layoutId) {
  const n = { grid2: 2, grid3: 3, 'deal-banner': 3 }[layoutId] || 0;
  return `<span class="am-lt lt-${esc(layoutId || 'none')}" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;
}

function paintOutline() {
  const secs = sections();
  $('#amSecList', root).innerHTML = secs.map((s, i) => `<li class="am-sec ${s.sectionId === selId ? 'on' : ''}" data-sort-id="${s.sectionId}">
    <button class="am-grip" data-drag="${s.sectionId}" aria-label="${esc(s.name || '이름 없는 구좌')} 끌어 순서 바꾸기. Alt+위·아래 화살표로도 옮겨요" title="끌어 순서 바꾸기 · Alt+↑/↓">${icon('grip')}</button>
    <button class="am-sec-main" data-sel="${s.sectionId}" aria-current="${s.sectionId === selId}">
      <span class="am-sec-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="am-sec-txt"><span class="am-sec-name">${esc(s.name || '이름 없는 구좌')}</span>
      <span class="cap">${esc([s.zone_kind || s.purpose, tabsOf(s).length ? `탭 ${tabsOf(s).length}개` : '', s.slots.length ? `상품 ${s.slots.length}칸` : layoutName(s.layoutId), (s.designerReferences || []).length ? `참고 ${s.designerReferences.length}` : ''].filter(Boolean).join(' · '))}</span></span>
    </button>
    <span class="am-sec-move">
      <button class="btn ghost sm am-iconbtn" data-up="${s.sectionId}" aria-label="${esc(s.name)} 위로 이동" title="위로 이동" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up')}</button>
      <button class="btn ghost sm am-iconbtn" data-down="${s.sectionId}" aria-label="${esc(s.name)} 아래로 이동" title="아래로 이동" ${i === secs.length - 1 ? 'disabled' : ''}>${icon('arrow-down')}</button>
    </span></li>`).join('');
}

function onOutline(e) {
  const secs = sections();
  const sel = e.target.closest('[data-sel]');
  if (sel) { selId = sel.dataset.sel; kindEdit = null; paintOutline(); paintDetail(); return; }
  const up = e.target.closest('[data-up]'), dn = e.target.closest('[data-down]');
  if (up || dn) { const id = (up || dn).dataset[up ? 'up' : 'down']; if (stepSection(id, up ? -1 : 1)) paintOutline(); return; }
  const act = e.target.closest('[data-act]');
  if (!act || act.disabled) return;
  if (act.dataset.act === 'add') {
    const i = secs.findIndex(s => s.sectionId === selId);
    const s = newSection({ name: '새 구좌' });
    changePage(() => secs.splice(i < 0 ? secs.length : i + 1, 0, s)); selId = s.sectionId; paint();
    $('[data-sf="name"]', root)?.focus();
  }
  if (act.dataset.act === 'zone') zoneDraft();
}

// ---------------- 진열 유형 · Zone · 필터 탭 (plans/17) ----------------
// 진열 유형: 기본 목록 + 이 기획안에서 쓴 유형. 담당자가 새 유형을 추가하고 이름을 고칠 수 있다
// shortcut: 새로 만든 유형은 이 기획안 구좌에만 남는다(전체 공용 목록 저장소 없음). 여러 기획안에 공유하려면 서버 설정 저장이 필요 (plans/16)
const kindsAll = () => [...new Set([...ZONE_KINDS, ...sections().map(x => x.zone_kind).filter(Boolean)])];

function zoneHTML(s) {
  if (!PRODUCT.includes(s.layoutId)) return '';
  const tabs = tabsOf(s);
  const kedit = kindEdit ? `<div class="row am-kedit"><input type="text" data-knew maxlength="20" value="${kindEdit === 'rename' ? esc(s.zone_kind) : ''}"
      aria-label="${kindEdit === 'rename' ? '진열 유형 새 이름' : '새 진열 유형 이름'}" placeholder="예) 선물 대상">
      <button class="btn sm primary" data-kact="ok">${kindEdit === 'rename' ? '이름 바꾸기' : '추가하기'}</button><button class="btn sm ghost" data-kact="cancel">취소</button>
      ${kindEdit === 'rename' ? '<span class="cap">이 기획안에서 이 유형을 쓰는 구좌가 모두 바뀌어요</span>' : ''}</div>` : '';
  return `<div class="am-f"><span>진열 유형 <em>${tabs.length ? '필터 탭을 무엇으로 나눴는지' : '다음 기획 때 비슷한 구성을 찾는 데 쓰여요'}</em></span>
      <div class="grp">${kindsAll().map(k => `<button type="button" class="chip ${s.zone_kind === k ? 'on' : ''}" data-zk="${esc(k)}" aria-pressed="${s.zone_kind === k}">${esc(k)}</button>`).join('')}
        <button type="button" class="chip" data-kact="add">${icon('plus')} 유형 추가</button>
        ${s.zone_kind ? `<button type="button" class="btn ghost sm" data-kact="rename">'${esc(s.zone_kind)}' 이름 고치기</button>` : ''}</div>${kedit}</div>
    <div class="am-f"><span>구좌 형식</span><div class="seg" role="radiogroup" aria-label="구좌 형식">
      <button type="button" role="radio" data-form="one" aria-checked="${!tabs.length}" class="${tabs.length ? '' : 'on'}">상품 묶음 하나</button>
      <button type="button" role="radio" data-form="tabs" aria-checked="${!!tabs.length}" class="${tabs.length ? 'on' : ''}">필터 탭으로 나누기</button></div></div>
    ${tabs.length ? tabsHTML(s) : `<label class="am-f"><span>Zone 이름 <em>PROMO_WORK 카테고리명. 03 상품 행의 Zone이 이 이름과 같으면 이 구좌 상품이 돼요</em></span>
      <input type="text" data-sf="zone_tag" maxlength="40" list="amZoneList" value="${esc(s.zone_tag)}" placeholder="예) 2만원대"></label>${mergeHTML(s)}`}
    <datalist id="amZoneList">${[...zonesOf(rows()).keys()].filter(Boolean).map(z => `<option value="${esc(z)}">`).join('')}</datalist>`;
}

function tabsHTML(s) {
  const tabs = tabsOf(s);
  return `<div class="am-f"><span>필터 탭 <em>탭 하나가 PROMO_WORK Zone 하나예요. 고객은 첫 탭을 먼저 봐요</em></span>
    <ol class="am-tabrows">${tabs.map((t, i) => `<li><span class="am-sec-num">${i + 1}</span>
      <input type="text" data-tl="${i}" maxlength="40" value="${esc(t.label)}" aria-label="${i + 1}번째 탭 이름" placeholder="탭 이름">
      <input type="text" data-tz="${i}" maxlength="40" list="amZoneList" value="${esc(t.zone_tag)}" aria-label="${i + 1}번째 탭 Zone 이름" placeholder="Zone 이름">
      <span class="cap">${tabSlots(s, t, i).length}칸</span>
      <button class="btn ghost sm am-iconbtn" data-tmove="${i}|-1" aria-label="${i + 1}번째 탭 위로" ${i ? '' : 'disabled'}>${icon('arrow-up')}</button>
      <button class="btn ghost sm am-iconbtn" data-tmove="${i}|1" aria-label="${i + 1}번째 탭 아래로" ${i < tabs.length - 1 ? '' : 'disabled'}>${icon('arrow-down')}</button>
      <button class="btn ghost sm" data-tdel="${i}" ${tabs.length > 1 ? '' : 'disabled'}>삭제</button></li>`).join('')}</ol>
    <div class="row wrap"><button class="btn sm" data-dact="tabadd" ${tabs.length >= MAX_TABS ? 'disabled' : ''}>탭 추가</button>
      <button class="btn sm" data-dact="tabsplit">탭을 따로 구좌로 나누기</button></div></div>`;
}

// 바로 다음 구좌가 같은 진열 유형이면 탭으로 묶을 수 있다
function mergeNext(s) {
  const secs = sections(), n = secs[secs.indexOf(s) + 1];
  return s.zone_kind && n && PRODUCT.includes(n.layoutId) && n.zone_kind === s.zone_kind && tabsOf(s).length + Math.max(1, tabsOf(n).length) <= MAX_TABS ? n : null;
}
const mergeHTML = s => { const n = mergeNext(s); return n ? `<div class="row"><button class="btn sm" data-dact="merge">다음 구좌 '${esc(n.name)}'와 탭으로 묶기</button></div>` : ''; };
// 탭이 없는 구좌를 탭 하나로 바꾼다 (카드는 모두 그 탭으로)
function asTabs(s) {
  if (tabsOf(s).length) return s.tabs;
  const t = { tabId: uid('tab-'), label: (s.zone_tag || s.name || '탭').slice(0, 40), zone_tag: s.zone_tag || '' };
  s.slots.forEach(x => { x.tabId = t.tabId; });
  s.tabs = [t]; s.zone_tag = '';
  return s.tabs;
}

// ---------------- 기획에 참고할 섹션 (디자이너 '기획에 참고할 섹션'을 구좌마다) ----------------
// 이 구좌를 기획할 때 참고할 만한 다른 프로모션의 섹션을 2~3개 보여 준다. 열면 전체 프로모션도 본다
function refsHTML(s) {
  if (s.layoutId === 'deal-banner') return '';
  const rec = recommendRefs(s, am.cur), cur = s.layoutSourceRefId ? byRef(s.layoutSourceRefId) : null;
  const att = new Set((s.designerReferences || []).map(r => r.referenceId));
  const acts = r => `<div class="am-rtile-act">${r.applicable && r.layout ? `<button class="btn sm" data-refapply="${r.id}" ${s.layoutSourceRefId === r.id ? 'disabled' : ''}>${s.layoutSourceRefId === r.id ? '적용함' : '레이아웃 적용'}</button>` : ''}
    <button class="btn sm ghost" data-refatt="${r.id}" ${att.has(r.id) ? 'disabled' : ''}>${att.has(r.id) ? '첨부함' : '참고로 첨부'}</button></div>`;
  return `<div class="am-f am-refs"><span>기획에 참고할 섹션 <em>이 구좌와 비슷한 다른 프로모션의 섹션이에요. 열면 전체 프로모션도 볼 수 있어요</em></span>
    <p class="cap">${esc(REF_BASIS)}예요. 브리프와 구좌 레이아웃에 맞춰 고른 시연용 예시이고, 실제 AI 추천은 아니에요.</p>
    ${cur ? `<p class="am-refcur">레이아웃을 가져온 섹션: <b>${esc(cur.title)}</b> <button class="btn ghost sm" data-refnone>선택 안 함</button></p>` : ''}
    ${rec.items.length ? `<div class="am-rtiles">${rec.items.map(r => refTile(r, acts(r))).join('')}</div>` : '<p class="cap">이 구좌에 맞는 예시가 아직 없어요.</p>'}
    ${att.size ? `<p class="cap">디자이너에게 함께 전할 참고: ${[...att].map(id => esc(byRef(id)?.title || id)).join(', ')}</p>` : ''}</div>`;
}

function slotLi(sl) {
  const ro = roleOf(sl);
  return `<li><span class="am-slot-st ${sl.placeholderStatus === 'AVAILABLE' ? 'ok' : 'und'}">${sl.placeholderStatus === 'AVAILABLE' ? '연결됨' : '미정'}</span>
    <span class="am-slot-n">${esc(productName(sl))}</span>${ro ? `<span class="am-role ${ro[1]}">${esc(ro[0])}</span>` : ''}${sl.customCopy ? `<span class="cap">${esc(sl.customCopy)}</span>` : ''}
    <button class="btn ghost sm" data-rmslot="${sl.slotId}" aria-label="${esc(productName(sl))} 카드 삭제하기">카드 삭제하기</button></li>`;
}
// 할인 행 중 아직 카드가 없는 것 (Zone이 같은 행)
const missingOf = (zone, list) => { const have = new Set(list.map(slotKey)); return zoneRowsFor(zone).filter(r => (r.seq || r.items) && !have.has(rowSlotKey(r))); };

function productsHTML(s) {
  if (s.layoutId === 'deal-banner') return dealSummary();
  const tabs = tabsOf(s);
  const body = tabs.length ? tabs.map((t, i) => {
    const list = tabSlots(s, t, i), miss = missingOf(t.zone_tag, list).length;
    return `<div class="am-tabprod"><div class="am-tabprod-h"><b>${esc(t.label || '이름 없는 탭')}</b><span class="cap">${list.length}칸${t.zone_tag ? ` · Zone ${esc(t.zone_tag)}` : ' · Zone 없음'}</span><span class="grow"></span>
        ${t.zone_tag ? `<button class="btn sm" data-tpull="${i}" ${miss ? '' : 'disabled'}>${miss ? `할인 행에서 ${miss}개 가져오기` : '할인 행과 맞춰져 있어요'}</button>` : ''}
        <button class="btn sm" data-tslot="${i}" ${s.slots.length >= MAX_SLOTS ? 'disabled' : ''}>빈 카드 추가</button></div>
      ${list.length ? `<ul class="am-slots">${list.map(slotLi).join('')}</ul>` : '<p class="cap">아직 카드가 없어요. 고객이 이 탭을 누르면 빈 화면이 보여요.</p>'}</div>`;
  }).join('') : (() => {
    const miss = missingOf(s.zone_tag, s.slots).length;
    return `${s.slots.length ? `<ul class="am-slots">${s.slots.map(slotLi).join('')}</ul>` : '<p class="cap">아직 연결된 상품이 없어요.</p>'}
      <div class="row wrap">${s.zone_tag ? `<button class="btn sm" data-tpull="-1" ${miss ? '' : 'disabled'}>${miss ? `할인 행에서 ${miss}개 가져오기` : '할인 행과 맞춰져 있어요'}</button>` : ''}
        <button class="btn sm" data-tslot="-1" ${s.slots.length >= MAX_SLOTS ? 'disabled' : ''}>빈 상품 카드 추가</button></div>`;
  })();
  return `<div class="am-f"><span>연결 상품 <em>${s.slots.length}칸</em></span>${body}
    <p class="cap">상품 바꾸기와 카피는 04 구좌 편집에서 고객 화면 모양으로 다뤄요.</p></div>`;
}

function paintDetail() {
  const box = $('#amSecDetail', root);
  const s = sections().find(x => x.sectionId === selId);
  if (!s) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="am-detail-head"><h2>${esc(s.name || '이름 없는 섹션')}</h2>
      <span class="grow"></span><button class="btn sm" data-dact="dup">구좌 복제하기</button><button class="btn sm danger" data-dact="del">구좌 삭제하기</button></div>
    <label class="am-f"><span>구좌명</span><input type="text" data-sf="name" maxlength="40" value="${esc(s.name)}"></label>
    ${zoneHTML(s)}
    <div class="am-f"><span>섹션 목표</span><div class="grp" id="amGoal">${SECTION_GOALS.map(g => `<button type="button" class="chip ${s.purpose === g ? 'on' : ''}" data-goal="${esc(g)}" aria-pressed="${s.purpose === g}">${esc(g)}</button>`).join('')}</div></div>
    <label class="am-f"><span>이 구좌를 넣은 이유 <em>선택</em></span><input type="text" data-sf="role" maxlength="200" value="${esc(s.role)}" placeholder="이 구좌로 전하고 싶은 내용을 적어 주세요. 예) 선물 대상별로 고르기 쉽게 나눠 보여주기"></label>
    <div class="am-f"><span>레이아웃</span><div class="am-layouts" id="amLayouts">${LAYOUTS.map(l => `<button type="button" class="am-layout ${s.layoutId === l.id ? 'on' : ''}" data-layout="${l.id}" aria-pressed="${s.layoutId === l.id}">${thumb(l.id)}<span>${esc(l.name)}</span></button>`).join('')}</div></div>
    ${refsHTML(s)}
    <div class="am-f"><span>가격 노출 방식 <em>섹션 구성을 마친 뒤 정해도 돼요</em></span>
      <div class="grp" id="amPriceDisp">${DISPLAYS.map(([v, l]) => `<button type="button" class="chip ${(s.price_display || '') === v ? 'on' : ''}" data-pd="${v}" aria-pressed="${(s.price_display || '') === v}">${esc(l)}</button>`).join('')}</div>
      <p class="cap">${esc(DISPLAY_HINT[s.price_display || ''])}</p>
      ${s.price_display === 'section' ? `<label class="am-f am-sprice"><span>섹션 대표 가격 (원)</span><input type="number" data-sf="section_price" min="0" step="100" value="${s.section_price ?? ''}" placeholder="예) 8800"></label>` : ''}</div>
    ${productsHTML(s)}
    <div class="row"><button class="btn sm" data-dact="editor">${icon('arrow-right')} 04 구좌 편집에서 보기</button></div>
    <label class="am-f"><span>디자이너 요청사항 <em>선택</em></span><textarea data-sf="designNotes" maxlength="2000" rows="3" placeholder="예: A와 B 상품 이미지로 새 묶음 상품 이미지를 만들어 주세요.">${esc(s.designNotes)}</textarea></label>`;
  const redraw = () => { paintDetail(); paintOutline(); };
  box.oninput = e => {
    const t = e.target, f = t.dataset.sf;
    if (f) {
      s[f] = f === 'section_price' ? (t.value === '' ? null : Math.max(0, Math.round(+t.value))) : t.value; scheduleSave();
      if (f === 'name') { box.querySelector('.am-detail-head h2').textContent = s.name || '이름 없는 섹션'; paintOutline(); }
      return;
    }
    if (t.dataset.tl !== undefined) {   // 탭 이름: Zone 이름이 탭 이름과 같았으면 함께 바꾼다
      const tab = s.tabs[+t.dataset.tl], z = $(`[data-tz="${t.dataset.tl}"]`, box);
      if (tab.zone_tag === tab.label) { tab.zone_tag = t.value; if (z) z.value = t.value; }
      tab.label = t.value; scheduleSave(); return;
    }
    if (t.dataset.tz !== undefined) { s.tabs[+t.dataset.tz].zone_tag = t.value; scheduleSave(); }
  };
  // Zone 이름은 칸에서 나올 때 연결 상품 수를 다시 센다
  box.onchange = e => { if (e.target.dataset.sf === 'zone_tag' || e.target.dataset.tz !== undefined) redraw(); };
  box.onkeydown = e => {
    if (e.target.dataset.knew === undefined || e.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); $('[data-kact="ok"]', box)?.click(); }
    if (e.key === 'Escape') { kindEdit = null; paintDetail(); }
  };
  box.onclick = e => {
    const g = e.target.closest('[data-goal]');
    if (g) { changePage(() => { s.purpose = s.purpose === g.dataset.goal ? '' : g.dataset.goal; }); redraw(); return; }
    const zk = e.target.closest('[data-zk]');
    if (zk) { changePage(() => { s.zone_kind = s.zone_kind === zk.dataset.zk ? '' : zk.dataset.zk; }); kindEdit = null; redraw(); return; }
    const ka = e.target.closest('[data-kact]');
    if (ka) {
      const act = ka.dataset.kact;
      if (act === 'add' || act === 'rename') { kindEdit = act; paintDetail(); $('[data-knew]', box)?.focus(); return; }
      if (act === 'cancel') { kindEdit = null; paintDetail(); return; }
      const v = ($('[data-knew]', box)?.value || '').trim().slice(0, 20);
      if (!v) { toast('유형 이름을 적어 주세요'); return; }
      if (kindEdit === 'rename') { const old = s.zone_kind; changePage(() => sections().forEach(x => { if (x.zone_kind === old) x.zone_kind = v; })); toast(`유형 이름을 바꿨어요: ${old} → ${v}`); }
      else changePage(() => { s.zone_kind = v; });
      kindEdit = null; redraw(); return;
    }
    const fm = e.target.closest('[data-form]');
    if (fm) {
      const tabs = tabsOf(s);
      if (fm.dataset.form === 'tabs' && !tabs.length) {
        changePage(() => { asTabs(s).push({ tabId: uid('tab-'), label: '새 탭', zone_tag: '' }); });
        redraw(); toast('필터 탭 구좌로 바꿨어요. 탭마다 Zone 이름을 적어 주세요'); return;
      }
      if (fm.dataset.form === 'one' && tabs.length) {
        if (tabs.length > 1 && !fm.dataset.armed) {
          fm.dataset.armed = '1'; fm.textContent = `한 번 더 누르면 탭 ${tabs.length}개를 합쳐요 (Zone은 '${tabs[0].zone_tag || tabs[0].label}'만 남아요)`;
          setTimeout(() => { if (fm.isConnected) { delete fm.dataset.armed; fm.textContent = '상품 묶음 하나'; } }, 4000); return;
        }
        changePage(() => { s.zone_tag = tabs[0].zone_tag; s.slots.forEach(x => { delete x.tabId; }); s.tabs = []; }); redraw(); return;
      }
      return;
    }
    const tm = e.target.closest('[data-tmove]');
    if (tm) { const [i, d] = tm.dataset.tmove.split('|').map(Number); changePage(() => { const t = s.tabs.splice(i, 1)[0]; s.tabs.splice(i + d, 0, t); }); redraw(); return; }
    const td = e.target.closest('[data-tdel]');
    if (td) {
      const i = +td.dataset.tdel, t = s.tabs[i], list = tabSlots(s, t, i), keep = list.filter(x => x.placeholderStatus === 'AVAILABLE');
      changePage(() => {
        s.tabs.splice(i, 1);
        s.slots = s.slots.filter(x => !list.includes(x) || keep.includes(x));
        keep.forEach(x => { x.tabId = s.tabs[0].tabId; });   // 상품이 있는 카드는 지우지 않고 첫 탭으로 옮긴다
      });
      redraw(); toast(keep.length ? `탭을 지웠어요. 상품이 있는 카드 ${keep.length}개는 '${s.tabs[0].label}' 탭으로 옮겼어요` : '탭을 지웠어요'); return;
    }
    const tp = e.target.closest('[data-tpull]');
    if (tp && !tp.disabled) {
      const i = +tp.dataset.tpull, t = i >= 0 ? s.tabs[i] : null;
      const add = slotsFromRows(missingOf(t ? t.zone_tag : s.zone_tag, t ? tabSlots(s, t, i) : s.slots)).slice(0, MAX_SLOTS - s.slots.length);
      if (t) add.forEach(x => { x.tabId = t.tabId; });
      changePage(() => s.slots.push(...add)); redraw(); toast(`상품 ${add.length}개를 연결했어요`); return;
    }
    const ts = e.target.closest('[data-tslot]');
    if (ts && !ts.disabled) { const i = +ts.dataset.tslot, x = newSlot(); if (i >= 0) x.tabId = s.tabs[i].tabId; changePage(() => s.slots.push(x)); redraw(); return; }
    const applyRef = r => { changePage(() => { s.layoutId = r.layout; s.layoutSourceRefId = r.id; }); redraw(); toast(`'${r.title}'의 레이아웃을 가져왔어요. 문구와 상품은 그대로예요`); };
    const attachRef = r => { changePage(() => { s.designerReferences = [...(s.designerReferences || []), { referenceId: r.id, designerNote: '' }].slice(0, 20); }); redraw(); toast('디자이너에게 전할 참고로 첨부했어요'); };
    const ro = e.target.closest('[data-refopen]');
    if (ro) { openRefViewer(ro.dataset.refopen, { applied: s.layoutSourceRefId, attached: new Set((s.designerReferences || []).map(r => r.referenceId)) }, { apply: applyRef, attach: attachRef }); return; }
    const ra = e.target.closest('[data-refapply]');
    if (ra) { applyRef(byRef(ra.dataset.refapply)); return; }
    const rt = e.target.closest('[data-refatt]');
    if (rt) { attachRef(byRef(rt.dataset.refatt)); return; }
    if (e.target.closest('[data-refnone]')) { changePage(() => { s.layoutSourceRefId = null; }); redraw(); return; }
    const pd = e.target.closest('[data-pd]');
    if (pd) { changePage(() => { s.price_display = pd.dataset.pd; if (s.price_display !== 'section') s.section_price = null; }); paintDetail(); emit('am:brief', 'page'); return; }
    const l = e.target.closest('[data-layout]');
    if (l) { changePage(() => { s.layoutId = l.dataset.layout; }); redraw(); return; }
    const rm = e.target.closest('[data-rmslot]');
    if (rm) { changePage(() => { s.slots = s.slots.filter(x => x.slotId !== rm.dataset.rmslot); }); redraw(); return; }
    const a = e.target.closest('[data-dact]'); if (!a || a.disabled) return;
    const secs = sections(), i = secs.indexOf(s);
    if (a.dataset.dact === 'deals') { emit('am:open-step', { step: 'promo', sub: 'deals' }); return; }
    if (a.dataset.dact === 'editor') { document.dispatchEvent(new CustomEvent('am:go-step', { detail: { step: 'editor', section: s.sectionId } })); return; }
    if (a.dataset.dact === 'tabadd') {
      changePage(() => s.tabs.push({ tabId: uid('tab-'), label: '새 탭', zone_tag: '' })); redraw();
      $(`[data-tl="${s.tabs.length - 1}"]`, box)?.select();
    } else if (a.dataset.dact === 'tabsplit') {
      // 탭마다 구좌 하나로. 카드는 자기 탭 구좌로 간다
      const parts = s.tabs.map((t, j) => newSection({ name: (t.label || s.name).slice(0, 40), zone_kind: s.zone_kind, zone_tag: t.zone_tag, layoutId: s.layoutId, purpose: s.purpose,
        role: s.role, slots: tabSlots(s, t, j).map(x => { const c = { ...x }; delete c.tabId; return c; }) }));
      changePage(() => secs.splice(i, 1, ...parts)); selId = parts[0].sectionId; paint(); toast(`탭 ${parts.length}개를 구좌 ${parts.length}개로 나눴어요`);
    } else if (a.dataset.dact === 'merge') {
      const n = mergeNext(s); if (!n) return;
      changePage(() => {
        asTabs(s); const nt = asTabs(n);
        s.tabs.push(...nt); s.slots.push(...n.slots); secs.splice(secs.indexOf(n), 1);
      });
      redraw(); toast(`'${n.name}' 구좌를 이 구좌의 탭으로 묶었어요. 구좌명을 '${s.zone_kind}별 추천'처럼 고쳐 보세요`);
    } else if (a.dataset.dact === 'dup') {
      const c = JSON.parse(JSON.stringify(s)); c.sectionId = uid('sec-'); c.name = `${s.name} 복사본`.slice(0, 40);
      const ids = new Map((c.tabs || []).map(t => { const n = uid('tab-'); const o = t.tabId; t.tabId = n; return [o, n]; }));
      c.slots.forEach(x => { x.slotId = uid('slot-'); if (x.tabId) x.tabId = ids.get(x.tabId) || null; });
      changePage(() => secs.splice(i + 1, 0, c)); selId = c.sectionId; paint(); toast('구좌를 복제했어요');
    } else if (a.dataset.dact === 'del') {
      // R4: 하루특가 섹션을 지워도 하루특가 행은 상품·할인에 그대로 남는다
      const nDeal = s.layoutId === 'deal-banner' ? rows().filter(isDeal).length : 0;
      if (!a.dataset.armed) {
        a.dataset.armed = '1'; a.textContent = nDeal ? `한 번 더 누르면 삭제해요 (하루특가 ${nDeal}개는 상품·할인에 남아요)` : '한 번 더 누르면 삭제해요';
        setTimeout(() => { delete a.dataset.armed; a.textContent = '구좌 삭제하기'; }, 4000); return;
      }
      changePage(() => secs.splice(i, 1)); selId = (secs[i] || secs[i - 1] || {}).sectionId || null; paint();
      toast(nDeal ? `구좌를 삭제했어요. 하루특가 ${nDeal}개는 상품·할인에 그대로 있어요. 실행 취소로 되돌릴 수 있어요` : '구좌를 삭제했어요. 실행 취소로 되돌릴 수 있어요');
    }
  };
}

function dealSummary() {
  const slots = dealPlanOf(am.cur).slots;
  const cnt = new Map(dealDays());
  const per = am.cur.brief.period;
  const dates = [];
  if (per) { for (let d = per.start, i = 0; d <= per.end && i < 62; i++) { dates.push(d); const [y, m, dd] = d.split('-').map(Number); const x = new Date(y, m - 1, dd + 1); d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; } }
  else dates.push(...cnt.keys());
  const total = [...cnt.values()].reduce((a, n) => a + n, 0);
  const empty = dates.reduce((a, d) => a + Math.max(0, slots - (cnt.get(d) || 0)), 0);
  return `<div class="am-f"><span>하루특가 <em>하루 ${slots}자리. 상품은 상품·할인의 하루특가 편성을 따라요</em></span>
    ${dates.length ? `<ul class="am-dealdays">${dates.map(d => { const n = cnt.get(d) || 0; return `<li class="${n < slots ? 'gapday' : ''}"><span>${mmdd(d)}</span><span class="cap">${n}/${slots}</span></li>`; }).join('')}</ul>
      <p class="cap">${dates.length}일, 상품 ${total}개${empty ? `, 빈 자리 ${empty}개` : ''}.</p>`
      : '<p class="cap">아직 하루특가 행이 없어요.</p>'}
    <div class="row"><button class="btn sm" data-dact="deals">하루특가 편성 열기</button></div></div>`;
}

export const pageStats = p => {
  const secs = p.page?.sections || [];
  return { sections: secs.length, slots: secs.reduce((a, s) => a + s.slots.length, 0),
    undecided: secs.reduce((a, s) => a + s.slots.filter(x => x.placeholderStatus !== 'AVAILABLE').length, 0) };
};
export { PURPOSES };
