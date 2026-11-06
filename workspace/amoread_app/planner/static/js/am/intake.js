// 담기 처리: 화면 곳곳의 담기(plan:add, plan:replace, plan:append)를 받아 '작업 중 기획안'에 넣는다.
// 규칙 (plans/03 6장, 확정)
// - 행 하나 담기: 작업 중 기획안의 저장된 할인 행에 추가. 화면은 옮기지 않고 알림 [보기] [되돌리기]
// - 기획안 통째로(지난 행사, 아이디어, 트렌드, AI): 기획안 밖에서 누르면 새 기획안이 기본. 작업 중 기획안이 있으면 행 추가, 행 바꾸기도 고를 수 있음
// - ② 상품·할인이 열려 있으면 그 편집 중인 표에 넣고, 사람이 [저장]을 눌러야 반영
// - 작업 중 기획안이 없으면 어느 기획안에 담을지 묻는다
import { api, emit, esc, mmdd, on, state } from '../core.js';
import { wbAddRow, wbAppendRows, wbReplaceRows } from '../plan.js';
import { am, blankProject, createProject, dealPlanOf, openProject, payload, saveNow } from './store.js';
import { addDealCandidateDraft, addPoolDraft, promoOpen } from './hub.js';
import { ask, notify } from './ui.js';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d); x.setDate(x.getDate() + n); return iso(x); };
const todayPlus = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x); };

export function initIntake() {
  // 한 박자 늦게 처리한다: 보낸 쪽(지난 행사 가져오기 대화상자 등)이 자기 창을 먼저 닫은 뒤에 확인창을 띄우기 위해
  on('plan:add', d => setTimeout(() => run(() => addOne(d)), 0));
  on('plan:append', rows => setTimeout(() => run(() => addMany(rows)), 0));
  on('plan:replace', p => setTimeout(() => run(() => replaceAll(p)), 0));
  // 역할은 나중에: 후보 상품(역할 미정)으로 담기 (R18)
  on('am:pool-add', d => setTimeout(() => run(() => addPool(d)), 0));
}

async function run(fn) { try { await fn(); } catch (e) { notify(`담지 못했어요: ${e.message}`); } }

// ---------------- 대상 기획안 ----------------
async function ensureTarget(what) {
  if (am.cur && am.cur.id) return am.cur;
  const list = ((await api('/api/am/projects')).projects || []).slice(0, 8);
  const v = await ask('어느 기획안에 담을까요?',
    `<p class="sm mute">${esc(what)}을(를) 담을 기획안을 골라 주세요. 고른 기획안이 작업 중 기획안이 되고, 다음 담기부터는 묻지 않아요.</p>`,
    [{ label: '닫기', value: null }, ...list.map(p => ({ label: `${p.title}${p.period ? ` (${mmdd(p.period.start)}~${mmdd(p.period.end)})` : ' (날짜 미정)'}`, value: p.id })),
      { label: '새 기획안 만들기', value: '__new', primary: true }]);
  if (!v) return null;
  if (v === '__new') return createProject({ title: '새 기획안', origin: { type: 'brief', ref: '' } });
  return openProject(v);
}

// ---------------- 행 만들기 (서버 모델 api.PromoRow와 같은 필드) ----------------
function fillRow(d, p) {
  const per = p?.brief?.period;
  const type = d.type === '하루특가' ? '하루특가' : d.type === '큐레이션' ? '큐레이션' : '상시';
  const start = d.start || per?.start || todayPlus(7);
  const end = type === '하루특가' ? start : (d.end || per?.end || plusDays(start, 13));
  const items = d.items && d.items.length ? d.items.map(i => ({ seq: String(i.seq), qty: Math.max(1, Math.min(20, +i.qty || 1)) })) : null;
  const memo = [d.memo || '', type === '하루특가' && !d.start ? '날짜 미정: 상품·혜택에서 날짜를 정해 주세요' : ''].filter(Boolean).join(' · ');
  return { promo: String(d.promo || p?.title || '').slice(0, 60), type, start, end: end < start ? start : end,
    seq: items ? null : (d.seq ? String(d.seq).slice(0, 12) : ''), items, rate: type === '큐레이션' ? 0 : d.rate === undefined || d.rate === null ? 0.2 : Math.max(0, Math.min(1, +d.rate)),
    appeal: String(d.appeal || '').slice(0, 80), category_tag: String(d.category_tag || '').slice(0, 40), clearance: !!d.clearance, memo: memo.slice(0, 300) };
}
const rowsOf = (rows, p) => (rows || []).map(r => fillRow(r, p));
const nameOf = d => d.items && d.items.length ? '신규 조합' : ((state.bySeq.get(String(d.seq)) || {}).name || (d.seq ? `SEQ ${d.seq}` : '상품'));
function periodOf(rows) {
  const ds = rows.flatMap(r => [r.start, r.end || r.start]).filter(Boolean).sort();
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null;
}
function originOf(source = '') { return /지난|작년|재기획|다시/.test(source) ? 'replan' : 'idea'; }

const openStep = (id, step, sub) => emit('am:open-step', { id, step, sub });

// ---------------- 행 하나 담기 ----------------
async function addOne(d) {
  if (d.type === '하루특가' && d.start) return addDealOnDate(d);     // R2
  if (d.type === '하루특가' && !d.start) return addDealCandidate(d);  // R9
  if (promoOpen()) { wbAddRow(d); notify(`${nameOf(d)}을(를) 상품·혜택 표에 넣었어요. 저장을 눌러야 반영돼요`); return; }
  const p = await ensureTarget(nameOf(d)); if (!p) return;
  const row = fillRow(d, p);
  p.promo_rows.push(row);
  await saveNow();
  if (am.saveState === 'error') { p.promo_rows.pop(); throw new Error(am.saveError); }
  notify(`「${p.title}」에 담았어요: ${nameOf(d)} ${row.type === '큐레이션' ? '할인 없음' : `${row.type} ${Math.round(row.rate * 100)}%`}${row.type === '하루특가' ? ` ${mmdd(row.start)}` : ''}`, [
    { label: '보기', run: () => openStep(p.id, 'promo') },
    { label: '되돌리기', run: () => undoRows(p, [row]) },
  ]);
}

// ---------------- 하루특가: 날짜를 아는 담기 (R2, 확정 2026-11-05) ----------------
// 그 날짜에 걸친 기획안이 1개면 바로, 여러 개면 노출할 프로모션을 고르고, 없으면 기획안 고르기 또는 새로
async function loadDoc(id) { return am.cur?.id === id ? am.cur : blankProject(await api(`/api/am/projects/${id}`)); }
async function saveDoc(p) {
  if (p === am.cur) { await saveNow(); if (am.saveState === 'error') throw new Error(am.saveError); return; }
  await api('/api/am/projects', { method: 'POST', body: payload(p) });
  emit('am:changed');
}

async function addDealOnDate(d, exclude = null) {
  if (promoOpen()) { wbAddRow(d); notify(`${mmdd(d.start)} 하루특가를 표에 넣었어요. 저장을 눌러야 반영돼요`); return; }
  const day = (await api(`/api/am/day?date=${d.start}`)).projects.filter(x => x.id !== exclude);
  let id = null;
  if (day.length === 1 && !exclude) id = day[0].id;
  else if (day.length >= 1) {
    id = await ask('어느 프로모션에 노출할까요?',
      `<p class="sm">${esc(nameOf(d))} · ${mmdd(d.start)} 하루특가</p><p class="cap">그날 진행되는 기획안이 ${day.length}개예요. 하루특가 섹션이 있는 기획안을 먼저 보여줘요.</p>`,
      [{ label: '닫기', value: null }, ...day.map(x => ({ label: `${x.title} · ${x.has_deal_section ? `하루특가 ${x.filled}/${x.slots}` : '하루특가 섹션 없음'}`, value: x.id })), { label: '다른 기획안 고르기', value: '__other' }]);
    if (!id) return;
  }
  if (!id || id === '__other') {
    const list = ((await api('/api/am/projects')).projects || []).filter(x => x.id !== exclude).slice(0, 8);
    id = await ask(`${mmdd(d.start)}에 걸친 기획안이 없어요`,
      `<p class="sm">${esc(nameOf(d))}을(를) 담을 기획안을 고르거나 새로 만들어 주세요. 기간 밖 날짜면 다음에 할 일에서 알려줘요.</p>`,
      [{ label: '닫기', value: null }, ...list.map(x => ({ label: `${x.title}${x.period ? ` (${mmdd(x.period.start)}~${mmdd(x.period.end)})` : ' (날짜 미정)'}`, value: x.id })),
        { label: '새 기획안 만들기', value: '__new', primary: true }]);
    if (!id) return;
    if (id === '__new') id = (await createProject({ title: '새 기획안', origin: { type: 'deal_gap', ref: d.start }, brief: { period: { start: d.start, end: d.start } } })).id;
  }
  const p = await loadDoc(id);
  const row = fillRow({ ...d, promo: d.promo && d.promo !== '하루특가' ? d.promo : p.title }, p);
  p.promo_rows.push(row);
  await saveDoc(p);
  const slots = dealPlanOf(p).slots;
  const n = p.promo_rows.filter(r => r.type === '하루특가' && r.start === d.start).length;
  const noSec = !(p.page?.sections || []).some(s => s.layoutId === 'deal-banner') && p.brief.page_kind !== '없음';
  notify(`「${p.title}」 ${mmdd(d.start)} 하루특가에 담았어요 (${n}/${slots}자리)${n > slots ? '. 자리가 이미 찼어요' : ''}${noSec ? '. 페이지에 하루특가 섹션이 아직 없어요' : ''}`, [
    { label: '보기', run: () => openStep(p.id, 'promo', 'deals') },
    { label: '되돌리기', run: () => undoOn(p.id, row) },
    { label: '다른 기획안에 담기', run: async () => { if (await undoOn(p.id, row, true)) run(() => addDealOnDate(d, p.id)); } },
  ]);
}

async function undoOn(id, row, quiet = false) {
  if (promoOpen() && am.cur?.id === id) { notify('상품·혜택 화면이 열려 있어요. 표에서 직접 지워 주세요'); return false; }
  const p = await loadDoc(id);
  const i = p.promo_rows.findIndex(r => r === row || (r.type === row.type && r.start === row.start && r.seq === row.seq && JSON.stringify(r.items) === JSON.stringify(row.items)));
  if (i < 0) { notify('되돌릴 행을 찾지 못했어요'); return false; }
  p.promo_rows.splice(i, 1);
  await saveDoc(p);
  if (!quiet) notify('되돌렸어요');
  return true;
}

// ---------------- 하루특가: 날짜를 모르는 담기 → 후보 목록 (R9) ----------------
async function addDealCandidate(d) {
  const c = { seq: d.items && d.items.length ? null : (d.seq ? String(d.seq) : null), items: d.items && d.items.length ? d.items : null, rate: d.rate ?? null, memo: '' };
  if (promoOpen()) { notify(addDealCandidateDraft(c) ? `${nameOf(d)}을(를) 하루특가 후보에 넣었어요. 저장을 눌러야 반영돼요` : '이미 하루특가 후보에 있어요'); return; }
  const p = await ensureTarget(nameOf(d)); if (!p) return;
  const plan = dealPlanOf(p);
  const k = x => x.items && x.items.length ? x.items.map(i => `${i.seq}x${i.qty || 1}`).join('+') : x.seq;
  if (plan.candidates.some(x => k(x) === k(c))) { notify(`이미 「${p.title}」 하루특가 후보에 있어요`); return; }
  plan.candidates.push(c); p.deal_plan = plan;
  await saveNow();
  notify(`「${p.title}」 하루특가 후보에 담았어요: ${nameOf(d)}. 날짜는 하루특가 편성에서 정해요`, [
    { label: '편성 보기', run: () => openStep(p.id, 'promo', 'deals') },
    { label: '되돌리기', run: async () => { if (am.cur !== p || promoOpen()) { notify('지금은 되돌릴 수 없어요'); return; } p.deal_plan.candidates = p.deal_plan.candidates.filter(x => x !== c); await saveNow(); notify('되돌렸어요'); } },
  ]);
}

// ---------------- 후보 상품 (역할 미정) ----------------
async function addPool(d) {
  const c = { seq: d.items && d.items.length ? null : (d.seq ? String(d.seq) : null), items: d.items && d.items.length ? d.items : null, memo: String(d.memo || '').slice(0, 200), source: String(d.source || '').slice(0, 40) };
  if (promoOpen()) { notify(addPoolDraft(c) ? `${nameOf(d)}을(를) 후보 상품에 넣었어요. 저장을 눌러야 반영돼요` : '이미 후보 상품에 있어요'); return; }
  const p = await ensureTarget(nameOf(d)); if (!p) return;
  const k = x => x.items && x.items.length ? x.items.map(i => `${i.seq}x${i.qty || 1}`).join('+') : x.seq;
  p.pool = p.pool || [];
  if (p.pool.some(x => k(x) === k(c))) { notify(`이미 「${p.title}」 후보 상품에 있어요`); return; }
  p.pool.push(c);
  await saveNow();
  notify(`「${p.title}」 후보 상품에 담았어요: ${nameOf(d)}. 역할은 상품·혜택에서 정해요`, [
    { label: '보기', run: () => openStep(p.id, 'promo', 'pool') },
    { label: '되돌리기', run: async () => { if (am.cur !== p || promoOpen()) { notify('지금은 되돌릴 수 없어요'); return; } p.pool = p.pool.filter(x => x !== c); await saveNow(); notify('되돌렸어요'); } },
  ]);
}

async function addMany(rows) {
  if (promoOpen()) { wbAppendRows(rows || []); notify(`상품·혜택 표에 ${rows.length}행을 넣었어요. 저장을 눌러야 반영돼요`); return; }
  const p = await ensureTarget(`${rows.length}개 행`); if (!p) return;
  const add = rowsOf(rows, p);
  p.promo_rows.push(...add);
  await saveNow();
  notify(`「${p.title}」에 ${add.length}행을 담았어요`, [{ label: '보기', run: () => openStep(p.id, 'promo') }, { label: '되돌리기', run: () => undoRows(p, add) }]);
}

async function undoRows(p, rows) {
  if (promoOpen()) { notify('상품·혜택 화면이 열려 있어요. 표에서 직접 지워 주세요'); return; }
  if (am.cur !== p) { notify('작업 중 기획안이 바뀌어 되돌릴 수 없어요'); return; }
  p.promo_rows = p.promo_rows.filter(r => !rows.includes(r));
  await saveNow();
  notify('되돌렸어요');
}

// ---------------- 기획안 통째로 ----------------
async function replaceAll(p) {
  const rows = p.rows || [];
  if (promoOpen()) {   // ② 안에서 누른 '지난 행사 상품·할인 가져오기' 등: 지금 기획안을 채운다
    const has = am.cur?.promo_rows?.length || 0;
    const v = has ? await ask('지금 기획안에 어떻게 넣을까요?', `<p class="sm">가져온 ${rows.length}행을 상품·혜택 표에 넣어요. 저장을 눌러야 반영돼요.</p>`,
      [{ label: '닫기', value: null }, { label: '기존 행에 추가', value: 'add', primary: true }, { label: '기존 행 바꾸기', value: 'replace' }]) : 'replace';
    if (!v) return;
    if (v === 'add') wbAppendRows(rows); else wbReplaceRows(rows);
    notify(`상품·혜택 표에 ${rows.length}행을 ${v === 'add' ? '추가' : '넣'}었어요. 저장을 눌러야 반영돼요`);
    return;
  }
  const cur = am.cur && am.cur.id ? am.cur : null;
  const v = cur ? await ask('가져온 행을 어디에 둘까요?',
    `<p class="sm">${esc(p.title || '가져온 기획')} · ${rows.length}행</p><p class="sm mute">작업 중 기획안: 「${esc(cur.title)}」</p>`,
    [{ label: '닫기', value: null }, { label: '새 기획안으로 만들기', value: 'new', primary: true }, { label: '작업 중 기획안에 행 추가', value: 'add' },
      { label: '작업 중 기획안의 행 바꾸기', value: 'replace' }]) : 'new';
  if (!v) return;
  if (v === 'new') {
    const per = periodOf(rows);
    const np = await createProject({ title: String(p.title || '새 기획안').slice(0, 80), origin: { type: originOf(p.source), ref: String(p.source || '').slice(0, 120) },
      brief: { period: per, background: String(p.rationale || p.brief || '').slice(0, 2000) },
      promo_rows: rowsOf(rows, { title: p.title, brief: { period: per } }), rationale: String(p.rationale || '').slice(0, 20000) });
    notify(`새 기획안 「${np.title}」을 만들었어요 (${rows.length}행). 작업 중 기획안이 바뀌었어요`, [{ label: '열기', run: () => openStep(np.id, 'promo') }]);
    return;
  }
  const before = cur.promo_rows.slice();
  const add = rowsOf(rows, cur);
  cur.promo_rows = v === 'add' ? [...cur.promo_rows, ...add] : add;
  await saveNow();
  notify(`「${cur.title}」에 ${add.length}행을 ${v === 'add' ? '추가' : '바꿔 넣'}었어요`, [
    { label: '보기', run: () => openStep(cur.id, 'promo') },
    { label: '되돌리기', run: async () => { if (am.cur !== cur || promoOpen()) { notify('지금은 되돌릴 수 없어요'); return; } cur.promo_rows = before; await saveNow(); notify('되돌렸어요'); } },
  ]);
}
