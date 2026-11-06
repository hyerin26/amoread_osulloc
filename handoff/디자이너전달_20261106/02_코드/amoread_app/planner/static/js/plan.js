// 작업대: 명분·컨셉 → Zone(=PROMO_WORK 카테고리명) → 상품·할인 → 레버 힌트·반응 배수 → 예상 범위 → 확정(예측 고정) → 내보내기·디자이너 브리프
import { $, $$, api, closePop, debounce, emit, esc, icon, man, mmdd, on, openModal, openPop, pct, ribbon, ribbonKey, state, toast, won } from './core.js';
import { starterHTML } from './ideas.js';

const LS_KEY = 'planner.draft.v1';
let plan = blank();
let check = null;
let sortMode = 'type';

function blank() { return { id: null, title: '', brief: '', rationale: '', source: '', rows: [], brief_meta: { myeongbun: '', concept: '', customer: '', target: '' } }; }
function today(off = 0) { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); }
const plus = (s, n) => { const x = new Date(s); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const floor5 = x => Math.floor(x * 20 + 1e-9) / 20;

export function currentRows() { return plan.rows; }
export function currentPlan() { return plan; }
export function savePlanLocal() { persist(); }

// ---------------- AMOREAD: 작업대 = 기획안 ② 상품·할인 단계의 편집기 ----------------
// 기획안의 저장된 할인 행을 불러와 편집하고, 사람이 [저장]을 눌러야 기획안에 반영한다 (수동 저장).
// '저장하지 않은 변경'은 마지막으로 불러오거나 저장한 행과 지금 행을 비교해서 판단한다.
let wbBase = '[]';
export function wbLoad(p) {
  plan = { ...blank(), title: p.title || '', source: '기획안', rationale: p.rationale || '', _am: p.id,
    brief_meta: { myeongbun: p.brief?.myeongbun || '', concept: p.brief?.concept || '', customer: p.brief?.customer || '', target: p.brief?.target || '' },
    rows: [] };
  plan.rows = (p.promo_rows || []).map(normRow);
  wbBase = JSON.stringify(plan.rows);
  renderAll();
}
export const wbRows = () => plan.rows;
export const wbIsDirty = () => JSON.stringify(plan.rows) !== wbBase;
export function wbMarkClean() { wbBase = JSON.stringify(plan.rows); }
export function wbAddRow(d) { addRow(d); }
export function wbAppendRows(rows) { plan.rows.push(...rows.map(normRow)); persist(); renderAll(); }
export function wbReplaceRows(rows) { plan.rows = rows.map(normRow); persist(); renderAll(); }
export function wbNormRow(r) { return normRow(r); }
// 하루특가 편성표가 wbRows()를 직접 고친 뒤 부른다 (표 다시 그리기 + 검증 + plan:changed)
export function wbRefresh() { persist(); renderAll(); }
// 보기 거르기: null 전체 | 'zone' 구좌 상품(상시 할인, 할인 없음)만
let rowFilter = null;
export function wbSetFilter(f) { if (rowFilter === f) return; rowFilter = f; renderAll(); }

export function initPlan() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s && Array.isArray(s.rows)) plan = { ...blank(), ...s }; } catch { /* 저장소 없음 */ }
  $('#planTarget').textContent = pct(state.target);
  $('#planTitle').addEventListener('input', e => { plan.title = e.target.value; persist(); });
  $('#planAdd').addEventListener('click', () => addRow({}));
  $('#planNew').addEventListener('click', () => {
    if (plan.rows.length && !confirmTwice($('#planNew'), '새 기획안')) return;
    plan = blank(); persist(); renderAll(); toast('새 기획안');
  });
  $('#planSave').addEventListener('click', save);
  $('#planExport').addEventListener('click', exportXlsx);
  $('#planShare').addEventListener('click', share);
  $('#planConfirm').addEventListener('click', confirmPlan);
  $('#planBundle').addEventListener('click', () => emit('view:mix'));
  $('#planBrief').addEventListener('input', e => { const k = e.target.dataset.b; if (!k) return; plan.brief_meta = { ...(plan.brief_meta || {}), [k]: e.target.value }; persist(); paintBriefSum(); });
  $('#planList').addEventListener('change', e => { if (e.target.value) load(e.target.value); e.target.value = ''; });
  $('#planAskClaude').addEventListener('click', () => emit('chat:open', { mode: 'claude', useCurrent: true }));
  $('#planSort').value = sortMode;
  $('#planSort').addEventListener('change', e => { sortMode = e.target.value; renderAll(); });
  const tbl = $('#planTable');
  tbl.addEventListener('input', onEdit);
  tbl.addEventListener('change', onEdit);
  tbl.addEventListener('click', e => {
    const zh = e.target.closest('[data-zone-add]');
    if (zh) { addRow({ category_tag: zh.dataset.zoneAdd }); return; }
    const lv = e.target.closest('[data-issue]');
    if (lv) { showIssues(lv, +lv.dataset.issue); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    rowAction(+b.closest('tr').dataset.i, b.dataset.act);
  });
  $('#planIssues').addEventListener('click', e => {
    const b = e.target.closest('[data-bulk]'); if (!b) return;
    if (b.dataset.bulk === 'fixrate') bulkFixRates();
    else if (b.dataset.bulk === 'first') { const r = check.rows.find(x => x.level !== 'ok'); const el = $(`#planTable [data-issue="${r.idx}"]`); el?.scrollIntoView({ block: 'center' }); el && showIssues(el, r.idx); }
  });
  // AMOREAD: 담기 이벤트(plan:add · plan:replace · plan:append)는 am/intake.js가 받아 작업 중 기획안에 넣는다
  refreshList();
  renderAll();
}

function confirmTwice(b, label) {
  // 브라우저 확인창 대신 버튼 두 번 누르기로 확인
  if (b.dataset.armed) { delete b.dataset.armed; b.textContent = label; return true; }
  b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 비웁니다';
  setTimeout(() => { delete b.dataset.armed; b.textContent = label; }, 3000);
  return false;
}

function normRow(r) {
  return {
    promo: r.promo || plan.title || '', type: r.type === '하루특가' ? '하루특가' : r.type === '큐레이션' ? '큐레이션' : '상시',
    start: r.start || today(7), end: r.end || r.start || today(7),
    seq: r.items && r.items.length ? null : (r.seq ? String(r.seq) : ''), items: r.items && r.items.length ? r.items : null,
    rate: r.type === '큐레이션' ? (+r.rate || 0) : r.rate === undefined || r.rate === null ? 0.2 : +r.rate, appeal: r.appeal || '', category_tag: r.category_tag || '',
    clearance: !!r.clearance, memo: r.memo || '',
  };
}

function addRow(d) {
  const last = plan.rows[plan.rows.length - 1] || {};
  const type = d.type || last.type || '상시';
  const start = d.start || last.start || today(7);
  // 하루특가는 하루, 상시는 같은 시작일의 직전 상시 행 종료일(같은 기간 행사) 또는 시작일+13일
  const lastSangsi = [...plan.rows].reverse().find(r => r.type === '상시');
  const end = type === '하루특가' ? start : (d.end || (lastSangsi && lastSangsi.start === start ? lastSangsi.end : plus(start, 13)));
  plan.rows.push(normRow({ promo: last.promo, ...d, type, start, end }));
  persist(); renderAll();
}

function rowAction(i, act) {
  const r = plan.rows[i];
  closePop();
  if (act === 'del') plan.rows.splice(i, 1);
  else if (act === 'dup') plan.rows.splice(i + 1, 0, JSON.parse(JSON.stringify(r)));
  else if (act === 'fixrate') {
    const c = check?.rows.find(x => x.idx === i);
    if (c && c.max_discount > 0) { r.rate = Math.max(0.05, floor5(c.max_discount)); toast(`할인율을 ${Math.round(r.rate * 100)}%로 낮췄습니다`); }
    else { toast('원가율 기준으로는 할인 여력이 없습니다. 짝을 찾아 묶어 보세요'); return; }
  } else if (act === 'clear') { r.clearance = !r.clearance; }
  else if (act === 'partner') { emit('partner:base', { seq: r.seq, rate: r.rate }); return; }
  else if (act === 'detail') { $('.tab[data-view="products"]').click(); emit('product:open', r.seq); return; }
  persist(); renderAll();
}

function bulkFixRates() {
  let n = 0;
  (check?.rows || []).forEach(c => {
    const r = plan.rows[c.idx];
    if (!r.clearance && c.cost_ratio_after > state.target && c.max_discount > 0.05) { r.rate = floor5(c.max_discount); n++; }
  });
  persist(); renderAll(); toast(n ? `${n}개 행의 할인율을 원가율 기준 최대치로 낮췄습니다` : '낮출 수 있는 행이 없습니다');
}

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(plan)); } catch { /* 저장소 없음 */ }
  $('#planCount').textContent = plan.rows.length;
  $('#planCount').classList.toggle('hidden', !plan.rows.length);
  emit('plan:changed');
}

function onEdit(e) {
  const el = e.target, tr = el.closest('tr[data-i]'); if (!tr || !el.dataset.f) return;
  const r = plan.rows[+tr.dataset.i], f = el.dataset.f;
  if (f === 'rate') r.rate = Math.max(0, Math.min(0.95, (+el.value || 0) / 100));
  else if (f === 'clearance') r.clearance = el.checked;
  else if (f === 'seq') { r.seq = el.value.replace(/\D/g, ''); tr.querySelector('.pname').innerHTML = nameCell(r); }
  else r[f] = el.value;
  if (f === 'type' && r.type === '큐레이션') { r.rate = 0; const ri = tr.querySelector('[data-f="rate"]'); if (ri) ri.value = 0; }
  if (f === 'type' && r.type === '하루특가') { r.end = r.start; tr.querySelector('[data-f="end"]').value = r.end; tr.querySelector('[data-f="end"]').disabled = true; }
  if (f === 'type' && r.type === '상시') tr.querySelector('[data-f="end"]').disabled = false;
  if (f === 'start' && (r.type === '하루특가' || r.end < r.start)) { r.end = r.start; tr.querySelector('[data-f="end"]').value = r.end; }
  persist(); recheck();
}

function nameCell(r) {
  if (r.items && r.items.length) {
    const t = r.items.map(it => ((state.bySeq.get(String(it.seq)) || {}).name || it.seq) + (it.qty > 1 ? `×${it.qty}` : '')).join(' + ');
    return `<span title="${esc(t)}"><span class="tag plan">신규 조합</span> ${esc(t)}</span>`;
  }
  const p = state.bySeq.get(String(r.seq));
  return p ? `<span title="${esc(p.name)}">${esc(p.name)}</span>` : (r.seq ? '<span class="over">SEQ 없음</span>' : '<span class="mute">SEQ 입력</span>');
}

function order() {
  const idx = plan.rows.map((_, i) => i);
  if (sortMode === 'date') idx.sort((a, b) => (plan.rows[a].start || '').localeCompare(plan.rows[b].start || '') || a - b);
  if (sortMode === 'zone') idx.sort((a, b) => (plan.rows[a].category_tag || '').localeCompare(plan.rows[b].category_tag || '', 'ko') || (plan.rows[a].start || '').localeCompare(plan.rows[b].start || '') || a - b);
  // 유형·날짜: 상시 먼저(기간별), 하루특가는 날짜별
  if (sortMode === 'type') idx.sort((a, b) => (plan.rows[a].type === '하루특가') - (plan.rows[b].type === '하루특가') || (plan.rows[a].start || '').localeCompare(plan.rows[b].start || '') || (plan.rows[a].end || '').localeCompare(plan.rows[b].end || '') || a - b);
  return idx;
}

function renderAll() {
  closePop();
  $('#planTitle').value = plan.title || '';
  $$('#planBrief [data-b]').forEach(el => { el.value = (plan.brief_meta || {})[el.dataset.b] || ''; });
  paintBriefSum();
  const head = `<thead><tr><th>#</th><th>판정</th><th>유형</th><th title="PROMO_WORK 카테고리명 = 페이지 구좌(Zone)">Zone</th><th class="p3">프로모션명</th><th>시작일</th><th>종료일</th><th>SEQ</th><th>상품</th><th class="num">할인율</th>
    <th class="num">할인가</th><th class="num">원가율</th><th class="num" title="과거 같은 할인 구간 하루특가의 평소 대비 판매 배수(중앙값)">반응</th><th class="num" title="같은 상품 마지막 하루특가 이후 지난 일수">쉰 기간</th><th class="num p2" title="평소 판매(행사일 제외) × 요일 × 반응 · 범위는 하위25~상위25%">예상 매출(만원)</th><th class="p3">소구문구</th><th title="재고 털이: 원가율 기준 초과 허용">털이</th><th></th></tr></thead>`;
  const ord = order().filter(i => rowFilter !== 'zone' || plan.rows[i].type !== '하루특가');
  let lastZone = null, lastGroup = null;
  const body = ord.map(i => { const r = plan.rows[i]; const p = state.bySeq.get(String(r.seq)) || {};
    let zh = '';
    if (sortMode === 'zone' && (r.category_tag || '') !== lastZone) {
      lastZone = r.category_tag || '';
      const n = plan.rows.filter(x => (x.category_tag || '') === lastZone).length;
      zh = `<tr class="zonehead"><td colspan="18"><b>${esc(lastZone || 'Zone 미지정')}</b> <span class="cap">${n}행</span> <button class="btn ghost sm" data-zone-add="${esc(lastZone)}">+ 이 Zone에 행</button></td></tr>`;
    }
    if (sortMode === 'type') {
      const gk = x => x.type === '하루특가' ? `d|${x.start}` : `${x.type === '큐레이션' ? 'c' : 's'}|${x.start}|${x.end}`;
      const g = gk(r);
      if (g !== lastGroup) {
        lastGroup = g;
        const same = plan.rows.filter(x => gk(x) === g);
        const wd = r.start ? '일월화수목금토'[new Date(r.start).getDay()] : '';
        zh += r.type === '하루특가'
          ? `<tr class="grouphead"><td colspan="18"><span class="gk d"></span><b>${mmdd(r.start)} (${wd}) 하루특가</b><span class="cap">${same.length}개${same.length >= 5 ? ' · 품목이 많아 관심이 나뉠 수 있어요 (우리 실적상 3~4개가 반응 최대)' : ''}</span></td></tr>`
          : `<tr class="grouphead"><td colspan="18"><span class="gk s"></span><b>${r.type === '큐레이션' ? '할인 없음' : '상시'} ${mmdd(r.start)}~${mmdd(r.end)}</b><span class="cap">${same.length}품목 · ${Math.round((new Date(r.end) - new Date(r.start)) / 86400000) + 1}일</span></td></tr>`;
      }
    }
    // 쉰 기간 = 이 행 시작일 − 같은 상품 마지막 하루특가 종료일 (오늘이 아니라 행사 날 기준)
    const rest = r.type === '하루특가' && p.last_deal_end && r.start ? Math.max(0, Math.round((new Date(r.start) - new Date(p.last_deal_end)) / 86400000)) : null;
    return zh + `<tr data-i="${i}">
    <td class="num mute">${i + 1}</td>
    <td data-c="lv"><span class="mute">…</span></td>
    <td><select data-f="type"><option ${r.type === '상시' ? 'selected' : ''}>상시</option><option ${r.type === '하루특가' ? 'selected' : ''}>하루특가</option><option value="큐레이션" ${r.type === '큐레이션' ? 'selected' : ''}>할인 없음</option></select></td>
    <td><input type="text" class="zone" data-f="category_tag" value="${esc(r.category_tag)}" placeholder="Zone" list="zoneList"></td>
    <td class="p3"><input type="text" class="promo" data-f="promo" value="${esc(r.promo)}"></td>
    <td><input type="date" data-f="start" value="${esc(r.start)}"></td>
    <td><input type="date" data-f="end" value="${esc(r.end)}" ${r.type === '하루특가' ? 'disabled' : ''}></td>
    <td>${r.items ? '<span class="mute">-</span>' : `<input type="text" class="seq" data-f="seq" value="${esc(r.seq || '')}" inputmode="numeric">`}</td>
    <td class="pname">${nameCell(r)}</td>
    <td class="num"><input type="number" class="rate" data-f="rate" min="0" max="90" step="1" value="${Math.round((r.rate || 0) * 100)}">%</td>
    <td class="num" data-c="sale">-</td><td class="num" data-c="cra">-</td><td class="num" data-c="lift">-</td>
    <td class="num ${rest !== null && rest <= 60 ? 'warnc' : ''}">${rest === null ? '<span class="mute">-</span>' : rest + '일'}</td>
    <td class="num p2" data-c="exp">-</td>
    <td class="p3"><input type="text" class="appeal" data-f="appeal" value="${esc(r.appeal)}" placeholder="선택"></td>
    <td><input type="checkbox" data-f="clearance" ${r.clearance ? 'checked' : ''}></td>
    <td class="act"><button class="btn ghost sm rowbtn" data-act="dup" title="복제">복제</button><button class="btn ghost sm rowbtn" data-act="del" title="삭제">삭제</button></td></tr>`; }).join('');
  const zones = [...new Set(plan.rows.map(r => r.category_tag).filter(Boolean))];
  const dl = `<datalist id="zoneList">${zones.map(z => `<option value="${esc(z)}">`).join('')}</datalist>`;
  $('#planTable').innerHTML = dl + head + `<tbody>${body || '<tr><td colspan="18"><div class="planempty"><h3>빈 기획안이에요</h3><p>아래에서 시작하거나, [상품]에서 담거나, [+ 행 추가]로 직접 적어 보세요.</p><div class="starters">${starterHTML()}</div></div></td></tr>'}</tbody>`;
  $('#planMeta').textContent = (plan.id ? `저장됨 · ${plan.source ? plan.source + ' · ' : ''}${plan.updated_at || ''}` : (plan.source ? `${plan.source} · 저장 안 됨` : '저장 안 됨'))
    + (plan.snapshot ? ` · 확정 ${plan.snapshot.confirmed_at} (예측 고정)` : '');
  $('#planRationaleCard').classList.toggle('hidden', !plan.rationale);
  $('#planRationale').textContent = plan.rationale || '';
  persist(); recheck.now();
}

const recheck = debounce(runCheck, 350);
recheck.now = runCheck;

const BADGE = { ok: ['okq', '✓'], warn: ['warn', '! 주의'], error: ['error', '✕ 오류'] };

async function runCheck() {
  if (!plan.rows.length) { check = null; paintKpis(); paintIssues(); $('#planDays').innerHTML = ''; $('#planExisting').innerHTML = '<div class="empty">행을 추가하면 그 기간의 기존 행사를 보여줍니다</div>'; return; }
  try { check = await api('/api/am/check', { method: 'POST', body: { rows: plan.rows } }); } catch (e) { toast(e.message); return; }
  check.rows.forEach(c => {
    const tr = $(`#planTable tr[data-i="${c.idx}"]`); if (!tr) return;
    tr.className = `lv-${c.level}`;
    tr.querySelector('[data-c="sale"]').textContent = won(c.sale_price);
    const cra = tr.querySelector('[data-c="cra"]');
    cra.textContent = pct(c.cost_ratio_after);
    cra.className = `num ${c.cost_ratio_after > state.target ? 'warnc' : ''}`;
    cra.title = c.cost_ratio_after > state.target ? '원가율 45% 참고선을 넘어요 (오류 아님)' : '';
    const ex = tr.querySelector('[data-c="exp"]');
    ex.textContent = man(c.expected_sales);
    const lf = tr.querySelector('[data-c="lift"]');
    lf.textContent = c.lift ? `${c.lift.toFixed(1)}배` : '-';
    lf.title = c.lift_band ? `${c.lift_band} 구간 과거 반응(중앙) · 근거 ${c.lift_n || 0}건${c.base_qty !== undefined ? ` · 평소 하루 ${c.base_qty}개` : ''}` : '';
    ex.title = c.expected_range ? `범위 ${man(c.expected_range[0])}~${man(c.expected_range[1])}만원 (과거 반응 하위25~상위25%)` : '';
    const n = c.errors.length + c.warnings.length;
    const [cls, txt] = BADGE[c.level];
    tr.querySelector('[data-c="lv"]').innerHTML = `<button class="status ${cls}" data-issue="${c.idx}" title="눌러서 확인할 점 보기">${txt}${n > 1 ? ` ${n}` : ''}</button>${(c.hints || []).length ? `<button class="hint" data-issue="${c.idx}" title="레버 힌트 ${c.hints.length}개" aria-label="레버 힌트">${icon('bulb')}</button>` : ''}`;
  });
  paintKpis(); paintIssues(); paintDays(); paintExisting();
}

function showIssues(anchor, i) {
  const c = check?.rows.find(x => x.idx === i); if (!c) return;
  const r = plan.rows[i];
  const over = c.cost_ratio_after > state.target;
  const items = [...c.errors.map(m => `<li class="e">${esc(m)}</li>`), ...c.warnings.map(m => `<li class="w">${esc(m)}</li>`), ...(c.hints || []).map(m => `<li class="h">힌트 · ${esc(m)}</li>`)].join('');
  openPop(anchor, `<h4>${esc(c.name || r.seq || '행 ' + (i + 1))}</h4>
    ${items ? `<ul>${items}</ul>` : `<p class="good">${icon('check')} 확인할 점이 없어요</p>`}
    <div class="cap">정가 ${won(c.price)}원 · 할인가 ${won(c.sale_price)}원 · 할인 후 원가율 ${pct(c.cost_ratio_after)} · 원가율 기준 최대 할인 ${c.max_discount > 0 ? pct(c.max_discount) : '없음'}${c.expected_sales ? ` · 예상 매출 ${man(c.expected_sales)}만원${c.expected_range ? ` (${man(c.expected_range[0])}~${man(c.expected_range[1])})` : ''}` : ''}${c.lift ? ` · 반응 ${c.lift.toFixed(1)}배(${esc(c.lift_band)}, ${c.lift_n}건)` : ''}</div>
    ${r.memo ? `<div class="cap mt8">메모: ${esc(r.memo)}</div>` : ''}
    <div class="acts mt8">
      ${over && !r.clearance && c.max_discount > 0.05 ? `<button class="btn sm primary" data-pa="fixrate">${pct(floor5(c.max_discount))}로 낮추기</button>` : ''}
      ${over && c.kind === '기존' ? '<button class="btn sm" data-pa="partner">묶을 짝 찾기</button>' : ''}
      ${over ? `<button class="btn sm" data-pa="clear">${r.clearance ? '털이 표시 해제' : '재고 털이로 표시'}</button>` : ''}
      ${c.kind === '기존' && r.seq ? '<button class="btn sm" data-pa="detail">상품 상세</button>' : ''}
      <button class="btn sm ghost" data-pa="del">행 삭제</button>
    </div>`, pop => pop.querySelectorAll('[data-pa]').forEach(b => b.addEventListener('click', () => rowAction(i, b.dataset.pa))));
}

function paintIssues() {
  const bar = $('#planIssues');
  const s = check?.summary;
  if (!s || (!s.errors && !s.warnings)) { bar.classList.add('hidden'); return; }
  const fixable = check.rows.filter(c => !plan.rows[c.idx].clearance && c.cost_ratio_after > state.target && c.max_discount > 0.05).length;
  bar.className = `issuebar ${s.errors ? 'bad' : ''}`;
  bar.innerHTML = `<b>확인할 것 ${s.errors + s.warnings}건</b><span>오류 ${s.errors} · 주의 ${s.warnings}</span>
    <button class="btn sm" data-bulk="first">첫 번째부터 보기</button>
    ${fixable ? `<button class="btn sm" data-bulk="fixrate" title="원가율은 참고 지표예요. 필요할 때만 쓰세요">원가율 45% 넘는 ${fixable}행 낮추기(선택)</button>` : ''}
    <span class="cap">오류가 남아도 엑셀은 만들 수 있고, '검증' 시트에 함께 적힙니다</span>`;
}

function paintKpis() {
  const s = check?.summary, box = $('#planOverview');
  if (!s || !plan.rows.length) { box.classList.add('hidden'); return; }
  const ns = plan.rows.filter(r => r.type === '상시').length, nd = plan.rows.filter(r => r.type === '하루특가').length;
  const rates = plan.rows.map(r => r.rate).filter(Boolean);
  const ds = plan.rows.flatMap(r => [r.start, r.end || r.start]).filter(Boolean).sort();
  const issues = s.errors + s.warnings;
  box.classList.remove('hidden');
  box.innerHTML = `<div class="ov-r">
      <div class="row"><span class="sm"><b>${mmdd(ds[0])} ~ ${mmdd(ds[ds.length - 1])}</b> <span class="cap">${Math.round((new Date(ds[ds.length - 1]) - new Date(ds[0])) / 86400000) + 1}일</span></span><span class="grow"></span>${ribbonKey()}</div>
      ${ribbon(plan.rows, { maxDays: 62 })}
    </div>
    <div class="nums">
      <div><div class="k">행</div><div class="v">${s.rows}<small> 상시 ${ns} · 특가 ${nd}</small></div></div>
      <div title="평소 판매(행사일 제외) × 요일 × 과거 반응, 범위는 하위25~상위25%"><div class="k">예상 매출(참고)</div><div class="v">${s.expected_range ? `${man(s.expected_range[0])}~${man(s.expected_range[1])}` : man(s.expected_sales)}<small> 만원</small></div></div>
      <div><div class="k">평균 할인</div><div class="v">${pct(rates.reduce((a, b) => a + b, 0) / (rates.length || 1))}</div></div>
      <div><div class="k">확인할 것</div><div class="v ${s.errors ? 'errv' : issues ? 'warnv' : ''}">${issues ? issues : icon('check')}<small>${s.errors ? ` 오류 ${s.errors}` : ''}${s.hints ? ` · 힌트 ${s.hints}` : ''}</small></div></div>
    </div>`;
}

function paintBriefSum() {
  const b = plan.brief_meta || {};
  const parts = [['명분', b.myeongbun], ['컨셉', b.concept], ['고객', b.customer], ['목표', b.target]].filter(x => x[1]);
  $('#planBriefSum').textContent = parts.length ? parts.map(([k, v]) => `${k} ${v}`).join('  /  ') : '기획 메모 쓰기 (명분·컨셉·고객·목표)';
}

function avgCra() {
  const xs = (check?.rows || []).map(r => r.cost_ratio_after).filter(v => v !== null && v !== undefined);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function paintDays() {
  const days = check?.summary?.daily_deals_per_day || {};
  const crowded = check?.summary?.crowded_days || {};
  const keys = Object.keys(days).sort();
  const spread = check?.summary?.spread_days || {};
  $('#planDays').innerHTML = (keys.length ? `<div class="cap">하루특가 일자별 품목 수: 우리 실적상 하루 3~4개일 때 품목당 반응이 가장 컸어요 (5개 이상 분산, 7개 이상 주황)</div><div class="daylist mt8">${keys.map(k => `<span class="${crowded[k] ? 'crowd' : spread[k] ? 'spread' : ''}">${mmdd(k)}(${'일월화수목금토'[new Date(k).getDay()]}) · ${days[k]}개</span>`).join('')}</div>` : '')
    + `<div class="cap mt8">${esc(check?.summary?.note || '')}</div>`;
}

async function paintExisting() {
  const ds = plan.rows.map(r => r.start).filter(Boolean).sort(), de = plan.rows.map(r => r.end || r.start).filter(Boolean).sort();
  if (!ds.length) return;
  let res;
  try { res = await api(`/api/promos?date_from=${ds[0]}&date_to=${de[de.length - 1]}`); } catch { return; }
  const groups = {};
  res.rows.forEach(r => { const k = `${r.promo}|${r.type}`; const g = (groups[k] = groups[k] || { promo: r.promo, type: r.type, start: r.start, end: r.end, n: 0, rates: [] }); g.n++; g.rates.push(r.rate); if (r.start < g.start) g.start = r.start; if (r.end > g.end) g.end = r.end; });
  const gs = Object.values(groups);
  $('#planExistingSum').textContent = gs.length ? `${ds[0]} ~ ${de[de.length - 1]} · ${gs.length}개 행사 ${res.rows.length}개 품목` : `${ds[0]} ~ ${de[de.length - 1]} · 잡힌 행사 없음`;
  $('#planExisting').innerHTML = gs.length ? `<table class="mini"><thead><tr><th>프로모션</th><th>유형</th><th class="num">기간</th><th class="num">품목 수</th><th class="num">할인율 범위</th></tr></thead><tbody>
    ${gs.map(g => { const rs = g.rates.filter(x => x !== null && x !== undefined); return `<tr><td>${esc(g.promo)}</td><td>${esc(g.type)}</td><td class="num">${mmdd(g.start)}~${mmdd(g.end)}</td><td class="num">${g.n}</td><td class="num">${rs.length ? `${pct(Math.min(...rs))}~${pct(Math.max(...rs))}` : '-'}</td></tr>`; }).join('')}</tbody></table>`
    : '<div class="empty">이 기간에 잡힌 행사가 없습니다</div>';
}

async function save() {
  if (!plan.title) { plan.title = `기획안 ${today()}`; $('#planTitle').value = plan.title; }
  try {
    const d = await api('/api/plans', { method: 'POST', body: plan });
    plan.id = d.id; plan.updated_at = d.updated_at; persist(); renderAll(); refreshList(); toast('저장했습니다');
  } catch (e) { toast(e.message); }
}

async function load(id) {
  try {
    const d = await api(`/api/plans/${encodeURIComponent(id)}`);
    plan = { ...blank(), ...d, rows: (d.rows || []).map(normRow) }; persist(); renderAll(); toast(`불러왔습니다: ${d.title}`);
  } catch (e) { toast(e.message); }
}

async function refreshList() {
  try {
    const d = await api('/api/plans');
    $('#planList').innerHTML = '<option value="">불러오기</option>' + d.plans.map(p => `<option value="${esc(p.id)}">${esc(p.title)} · ${p.rows}행 · ${esc((p.updated_at || '').slice(5, 16))}</option>`).join('');
  } catch { /* 무시 */ }
}

async function exportXlsx() {
  if (!plan.rows.length) { toast('내보낼 행이 없습니다'); return; }
  if (check?.summary?.errors) toast(`오류 ${check.summary.errors}건이 있습니다. 엑셀 '검증' 시트에서 확인하세요`, 3500);
  try {
    const res = await api('/api/am/export', { method: 'POST', body: plan, raw: true });
    const blob = await res.blob();
    const name = decodeURIComponent((res.headers.get('content-disposition') || '').split("filename*=utf-8''")[1] || '') || '기획안.xlsx';
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('엑셀을 만들었습니다 (osulloc_ops\\output 폴더에도 저장됨)');
  } catch (e) { toast(e.message); }
}

// ---------------- 공유용 요약 (Teams·메일에 붙여넣기) — 숫자는 서버 검증 결과 그대로
function shareText() {
  const s = check?.summary; if (!s) return '';
  const rows = check.rows;
  const nm = c => c.name || c.seq || '';
  const dates = plan.rows.map(r => r.start).concat(plan.rows.map(r => r.end || r.start)).filter(Boolean).sort();
  const deals = rows.filter(c => c.type === '하루특가').sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const byDay = {};
  deals.forEach(c => { (byDay[c.start] = byDay[c.start] || []).push(`${nm(c)} ${pct(c.rate)}`); });
  const sangsi = rows.filter(c => c.type !== '하루특가');
  const byPromo = {};
  sangsi.forEach(c => { const k = `${c.promo || '상시'} ${mmdd(c.start)}~${mmdd(c.end)}`; (byPromo[k] = byPromo[k] || []).push(c); });
  // 상시는 할인율별로 묶어 한 줄씩 (높은 할인부터)
  const promoLines = Object.entries(byPromo).flatMap(([k, cs]) => {
    const byRate = {};
    cs.forEach(c => { (byRate[c.rate] = byRate[c.rate] || []).push(`${c.kind === '신규조합' ? '[신규 조합] ' : ''}${nm(c)}`); });
    return [`${k} (${cs.length}개)`, ...Object.entries(byRate).sort((x, y) => y[0] - x[0]).map(([r, ns]) => `  · ${pct(+r)} ${ns.length}개: ${ns.join(', ')}`)];
  });
  const issues = rows.filter(c => c.level !== 'ok').slice(0, 8).map(c => `- ${nm(c)}: ${[...c.errors, ...c.warnings].join(' / ')}`);
  const rates = rows.map(c => c.rate).filter(Boolean);
  return [
    `[프로모션 기획안] ${plan.title || '제목 없음'}`,
    `기간 ${dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '-'} · 상시 ${sangsi.length}행 · 하루특가 ${deals.length}행`,
    `예상 매출 ${man(s.expected_sales)}만원 · 매출총이익 ${man(s.expected_profit)}만원(이익률 ${pct(s.profit_rate)}) · 평균 할인 ${pct(rates.reduce((a, b) => a + b, 0) / (rates.length || 1))} · 할인 후 원가율 평균 ${pct(avgCra())} (기준 ${pct(state.target)})`,
    '',
    ...(promoLines.length ? ['■ 상시', ...promoLines, ''] : []),
    ...(Object.keys(byDay).length ? ['■ 하루특가', ...Object.entries(byDay).map(([d, v]) => `${mmdd(d)}: ${v.join(', ')}`), ''] : []),
    `■ 확인 필요. 오류 ${s.errors} · 주의 ${s.warnings}`, ...(issues.length ? issues : ['- 없음']),
    '',
    '※ 예상 매출·이익은 최근 28일 판매 × 과거 하루특가 반응도로 낸 참고치 (상시는 평소 수준 가정, 신규 조합 제외)',
  ].join('\n');
}

function designerText() {
  const b = plan.brief_meta || {};
  const rows = check?.rows || [];
  const zones = {};
  rows.forEach(c => { const z = c.category_tag || '(Zone 미지정)'; (zones[z] = zones[z] || []).push(c); });
  const dates = plan.rows.map(r => r.start).concat(plan.rows.map(r => r.end || r.start)).filter(Boolean).sort();
  const deals = rows.filter(c => c.type === '하루특가').sort((a, b2) => (a.start || '').localeCompare(b2.start || ''));
  const flags = rows.flatMap(c => c.warnings.filter(w => w.includes('효능')));
  return [
    `[디자이너 브리프] ${plan.title || ''}`,
    `기간 ${dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '-'}`,
    `명분 ${b.myeongbun || '-'}`,
    `컨셉 ${b.concept || '-'}`,
    `고객 상황 ${b.customer || '-'}`,
    '',
    '■ 페이지 구성 (Zone 순서 = PROMO_WORK 카테고리명)',
    ...Object.entries(zones).flatMap(([z, cs], i) => {
      const appeals = [...new Set(cs.map(c => c.appeal).filter(Boolean))];
      return [`${i + 1}. ${z}: ${cs.length}개 상품${appeals.length ? ` · 문구: ${appeals.join(' / ')}` : ''}`,
        `   ${cs.slice(0, 8).map(c => `${c.name || c.seq} ${pct(c.rate)}`).join(', ')}${cs.length > 8 ? ' 외' : ''}`];
    }),
    '',
    ...(deals.length ? ['■ 하루특가 교체 영역 (날짜별 배너)', ...Object.entries(deals.reduce((a, c) => { (a[c.start] = a[c.start] || []).push(`${c.name || c.seq} ${pct(c.rate)}`); return a; }, {})).map(([d, v]) => `${mmdd(d)}(${'일월화수목금토'[new Date(d).getDay()]}) ${v.join(', ')}`), ''] : []),
    '■ 톤', '오설록 톤: 과장(대박·역대급) 금지, 차분하고 구체적으로. 질병 예방·치료 효능 표현 금지.',
    ...(flags.length ? ['', '■ 문구 확인 필요', ...flags.map(f => `- ${f}`)] : []),
  ].join('\n');
}

function share() {
  if (!plan.rows.length || !check) { toast('요약할 행이 없습니다'); return; }
  const texts = { team: shareText(), designer: designerText() };
  let cur = 'team';
  openModal(`<h2>공유·디자이너 브리프</h2>
    <div class="grp" id="shareTabs"><button class="chip on" data-st="team">팀 공유 요약</button><button class="chip" data-st="designer">디자이너 브리프</button></div>
    <p class="sm mute mt8">Teams·메일·피그마에 붙여넣을 수 있는 글이에요. 숫자는 지금 검증 결과 그대로입니다.</p>
    <textarea class="share" id="shareText" readonly></textarea>
    <div class="foot"><button class="btn" data-close-modal>닫기</button><button class="btn primary" id="shareCopy">복사</button></div>`,
  m => {
    const ta = m.querySelector('#shareText'); ta.value = texts.team;
    m.querySelector('#shareTabs').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; cur = b.dataset.st; ta.value = texts[cur]; m.querySelectorAll('#shareTabs .chip').forEach(x => x.classList.toggle('on', x === b)); });
    m.querySelector('#shareCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(texts[cur]); toast('복사했습니다'); }
      catch { ta.select(); document.execCommand('copy'); toast('복사했습니다'); }
    });
  });
}

async function confirmPlan() {
  if (!plan.rows.length) { toast('확정할 행이 없습니다'); return; }
  await save();
  if (!plan.id) return;
  try {
    const d = await api(`/api/plans/${encodeURIComponent(plan.id)}/confirm`, { method: 'POST' });
    plan.snapshot = d.snapshot; persist(); renderAll(); refreshList();
    toast(`확정했어요. 예상 ${man(d.snapshot.summary.expected_sales)}만원을 고정했어요. 행사가 끝나고 데이터를 갱신하면 [지난 성과]의 계획 대비 실적에서 비교해요.`, 5000);
  } catch (e) { toast(e.message); }
}
