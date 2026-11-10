// 성과·레버: 레버 보드 · 행사 회차 성과(증분 매출·교훈) · 계획 대비 실적 · 할인 패턴 / 회차 상세 → 올해 날짜로 다시 기획
import { $, $$, api, closeModal, emit, esc, man, mmdd, on, openModal, pct, qty, state, toast } from './core.js';
import { renderPatterns } from './patterns.js';
import { renderLevers } from './levers.js';

let all = [], lastYear = null, loaded = false;
const f = { q: '', type: '', done: true };
let sortKey = 'start', sortDir = -1;

const COLS = [
  { k: 'promo', t: '행사명' }, { k: 'type', t: '유형' }, { k: 'start', t: '기간', num: true }, { k: 'days', t: '일수', num: true },
  { k: 'rows', t: '품목', num: true }, { k: 'promo_sales', t: '행사 매출(만원)', num: true, title: '세팅 할인율 ±2%p로 팔린 판매 합' },
  { k: 'inc_sales', t: '증분 매출(만원)', num: true, title: '하루특가만: 행사 수량 − 평소(시작 35~8일 전 일평균) × 일수, 평균 판매가로 환산' },
  { k: 'sales_per_row', t: '품목당(만원)', num: true }, { k: 'avg_rate', t: '평균 할인', num: true },
  { k: 'lift_median', t: '평소 대비(중앙)', num: true, title: '하루특가만 표시: 상시는 하루특가와 섞여 참고 불가' },
  { k: 'cra_median', t: '할인후 원가율(중앙)', num: true }, { k: 'over_target', t: '기준 초과', num: true, title: '할인 후 원가율 45% 넘은 품목 수' },
  { k: 'status', t: '상태' },
];

export function initReview() {
  $('#revMode').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode);
  });
  $('#revPlans').addEventListener('click', e => { const b = e.target.closest('[data-actual]'); if (b) openActual(b.dataset.actual); });
  $('#revQuery').addEventListener('input', e => { f.q = e.target.value.replace(/\s/g, '').toLowerCase(); render(); });
  $('#revType').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; $$('#revType .chip').forEach(x => x.classList.toggle('on', x === b)); f.type = b.dataset.type; render(); });
  $('#revDone').addEventListener('change', e => { f.done = e.target.checked; render(); });
  $('#revTable').addEventListener('click', e => {
    const th = e.target.closest('th[data-k]');
    if (th) { const k = th.dataset.k; sortDir = sortKey === k ? -sortDir : (k === 'promo' || k === 'type' ? 1 : -1); sortKey = k; render(); return; }
    const tr = e.target.closest('tr[data-key]'); if (tr) openWave(tr.dataset.key);
  });
  $('#revLastYear').addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (b) openWave(b.dataset.key); });
  on('review:open', key => { $('.tab[data-view="review"]').click(); setMode('waves'); openWave(key); });
  on('review:search', q => { $('.tab[data-view="review"]').click(); setMode('waves'); $('#revQuery').value = q; f.q = q.replace(/\s/g, '').toLowerCase(); f.done = false; $('#revDone').checked = false; render(); });
}

let mode = 'levers';
function setMode(m) {
  mode = m;
  $$('#revMode .chip').forEach(x => x.classList.toggle('on', x.dataset.mode === m));
  $('#revLevers').classList.toggle('hidden', m !== 'levers');
  $('#revWaves').classList.toggle('hidden', m !== 'waves');
  $('#revPlans').classList.toggle('hidden', m !== 'plans');
  $('#patternsBody').classList.toggle('hidden', m !== 'patterns');
  if (m === 'levers') renderLevers();
  if (m === 'patterns') renderPatterns();
  if (m === 'plans') renderPlans();
}

export async function showReview() {
  if (mode === 'levers') renderLevers();
  if (loaded) return;
  loaded = true;
  $('#revTable').innerHTML = '<tbody><tr><td><div class="empty"><span class="spin"></span></div></td></tr></tbody>';
  try { const d = await api('/api/review'); all = d.waves; lastYear = d.last_year; }
  catch (e) { loaded = false; $('#revTable').innerHTML = `<tbody><tr><td><div class="err-box">${esc(e.message)}</div></td></tr></tbody>`; return; }
  renderLastYear(); render();
}
export function reloadReview() { loaded = false; if ($('#view-review').classList.contains('on')) showReview(); }

function renderLastYear() {
  const ws = (lastYear?.waves || []).slice().sort((a, b) => a.start.localeCompare(b.start));
  $('#revLastYear').innerHTML = ws.length ? `<div class="sec-head"><h2>작년 이맘때 행사</h2><span class="cap">${esc(lastYear.from)} ~ ${esc(lastYear.to)}에 시작한 회차: 올해 같은 시즌 기획의 출발점</span></div>
    <div class="lycards">${ws.map(w => `<button class="lyc" data-key="${esc(w.key)}">
      <span class="kick">${esc(w.type)} · ${w.start.slice(2).replace(/-/g, '/')}~${mmdd(w.end)}</span><b>${esc(w.promo)}</b>
      <span class="facts"><span>품목<b>${w.rows}</b></span><span>행사 매출<b>${man(w.promo_sales)}만</b></span><span>평균 할인<b>${pct(w.avg_rate)}</b></span>${w.type === '하루특가' ? `<span>평소 대비<b>${w.lift_median ? w.lift_median.toFixed(1) + '배' : '-'}</b></span>` : ''}</span>
      <span class="cap">눌러서 품목 보기 · 올해 날짜로 다시 기획</span></button>`).join('')}</div>` : '';
}

function render() {
  if (!all.length && !loaded) return;
  const rows = all.filter(w => (!f.type || w.type === f.type) && (!f.done || w.status === '완료') && (!f.q || w.promo.replace(/\s/g, '').toLowerCase().includes(f.q)));
  rows.sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (typeof x === 'string' ? x.localeCompare(y, 'ko') : x - y) * sortDir;
  });
  $('#revCount').textContent = `${rows.length}개 회차 · 행사 매출 합 ${man(rows.reduce((s, w) => s + (w.promo_sales || 0), 0))}만원`;
  const head = `<thead><tr>${COLS.map(c => `<th class="sort ${c.num ? 'num' : ''}" data-k="${c.k}" title="${esc(c.title || '')}">${c.t}${sortKey === c.k ? `<span class="arr">${sortDir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('')}</tr></thead>`;
  const body = rows.map(w => `<tr class="click" data-key="${esc(w.key)}">
    <td class="name"><span class="n">${esc(w.promo)}</span></td><td>${esc(w.type)}</td>
    <td class="num">${w.start.slice(2).replace(/-/g, '/')}~${mmdd(w.end)}</td><td class="num">${w.days}</td><td class="num">${w.rows}</td>
    <td class="num">${w.promo_sales === null ? '<span class="mute">예정</span>' : man(w.promo_sales)}</td>
    <td class="num ${w.inc_sales < 0 ? 'over' : ''}" title="${w.inc_share !== null && w.inc_share !== undefined ? `행사 매출의 ${Math.round(w.inc_share * 100)}%` : '상시는 쿠폰·하루특가와 섞여 증분 계산 안 함'}">${w.inc_sales === null || w.inc_sales === undefined ? '<span class="mute">-</span>' : man(w.inc_sales)}</td>
    <td class="num">${man(w.sales_per_row)}</td>
    <td class="num">${pct(w.avg_rate)}</td>
    <td class="num">${w.type === '하루특가' && w.lift_median ? w.lift_median.toFixed(1) + '배' : '<span class="mute">-</span>'}</td>
    <td class="num ${w.cra_median > state.target ? 'over' : ''}">${pct(w.cra_median)}</td>
    <td class="num">${w.over_target ? `<span class="over">${w.over_target}</span>` : '<span class="mute">0</span>'}</td>
    <td>${w.status === '완료' ? '<span class="cap">완료</span>' : w.status === '진행중' ? '<span class="tag run">진행 중</span>' : '<span class="tag plan">예정</span>'}</td></tr>`).join('');
  $('#revTable').innerHTML = head + `<tbody>${body || `<tr><td colspan="${COLS.length}"><div class="empty">조건에 맞는 회차가 없습니다</div></td></tr>`}</tbody>`;
}

// ---------------------------------------------------------------- 회차 상세 → 다시 기획
function defaultStart(w) {
  const d = new Date(w.start); d.setDate(d.getDate() + 364);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d > today) return d.toISOString().slice(0, 10);
  const m = new Date(today); m.setDate(m.getDate() + ((8 - m.getDay()) % 7 || 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

async function openWave(key) {
  openModal('<div class="empty"><span class="spin"></span></div>');
  let w;
  try { w = await api(`/api/review/wave?key=${encodeURIComponent(key)}`); } catch (e) { openModal(`<div class="err-box">${esc(e.message)}</div><div class="foot"><button class="btn" data-close-modal>닫기</button></div>`); return; }
  const items = w.items_detail;
  const inactive = items.filter(x => !x.now_active).length, overNow = items.filter(x => x.now_cost_ratio_after > state.target).length;
  const noRate = items.filter(x => !x.rate).length;
  // 올해 같은 계열 행사가 이미 잡혀 있는지 (이름에 원래 행사명이 들어간 예정·진행 회차)
  const base = w.promo.replace(/^\d{2}\s*/, '').replace(/\s/g, '');
  const booked = all.filter(x => x.status !== '완료' && x.key !== w.key && x.promo.replace(/\s/g, '').includes(base));
  const rowsHtml = items.map(x => `<tr class="${x.now_active ? '' : 'dim'}"><td class="name"><span class="n" title="${esc(x.name)}">${esc(x.name)}</span></td>
    <td class="num">${mmdd(x.start)}${x.end !== x.start ? '~' + mmdd(x.end) : ''}</td><td class="num">${x.rate ? pct(x.rate) : '<span class="mute" title="할인 없이 노출만">노출</span>'}</td>
    <td class="num">${x.promo_qty === null ? '-' : qty(x.promo_qty)}</td><td class="num">${man(x.promo_sales)}</td>
    <td class="num">${x.lift ? x.lift.toFixed(1) + '배' : '-'}</td>
    <td class="num ${x.inc_sales < 0 ? 'over' : ''}">${x.inc_sales === null || x.inc_sales === undefined ? '-' : man(x.inc_sales)}</td>
    <td class="num ${x.cost_ratio_after > state.target ? 'over' : ''}">${pct(x.cost_ratio_after)}</td>
    <td class="num ${x.now_cost_ratio_after > state.target ? 'over' : ''}">${pct(x.now_cost_ratio_after)}</td>
    <td>${x.now_active ? '<span class="cap">판매 중</span>' : '<span class="tag miss">판매 없음</span>'}</td></tr>`).join('');
  openModal(`<div class="kick cap">${esc(w.type)} · ${esc(w.start)} ~ ${esc(w.end)} (${w.days}일)</div><h2>${esc(w.promo)}</h2>
    <div class="kpis mt10">
      <div class="kpi"><div class="k">품목</div><div class="v">${w.rows}</div><div class="s">SEQ ${w.items}개</div></div>
      <div class="kpi"><div class="k">행사 매출</div><div class="v">${w.promo_sales === null ? '예정' : man(w.promo_sales) + '<span class="cap"> 만원</span>'}</div><div class="s">품목당 ${man(w.sales_per_row)}만원</div></div>
      <div class="kpi"><div class="k">평균 할인</div><div class="v">${pct(w.avg_rate)}</div><div class="s">${pct(w.min_rate)}~${pct(w.max_rate)}</div></div>
      <div class="kpi ${overNow ? 'warn' : ''}"><div class="k">지금 원가로 기준 초과</div><div class="v">${overNow}</div><div class="s">같은 할인율 · 원가율 ${pct(state.target)} 기준</div></div>
    </div>
    <div class="tbl-wrap"><table class="t compact"><thead><tr><th>상품</th><th class="num">기간</th><th class="num">할인</th><th class="num">수량</th><th class="num">행사 매출(만원)</th><th class="num">평소 대비</th><th class="num" title="하루특가만">증분(만원)</th><th class="num">당시 원가율</th><th class="num">지금 원가율</th><th>지금</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
    ${(w.lessons || []).length ? `<div class="lessons"><b>교훈 (규칙)</b><ul>${w.lessons.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}
    <p class="cap mt8">${esc(w.note)}</p>
    ${booked.length ? `<div class="info-box mt8 sm">올해 이미 잡힌 비슷한 행사: ${booked.map(x => `<b>${esc(x.promo)}</b> ${esc(x.type)} ${mmdd(x.start)}~${mmdd(x.end)} ${x.rows}품목`).join(' · ')}: 날짜를 맞추거나 빠진 상품만 보완하는 데 쓰세요.</div>` : ''}
    <div class="redo">
      <b class="sm">올해 다시 기획</b>
      <span class="sm">새 시작일</span><input type="date" id="redoStart" value="${defaultStart(w)}">
      <label class="ck"><input type="checkbox" id="redoActive" checked> 지금 판매 없는 상품 빼기 (${inactive}개)</label>
      <label class="ck"><input type="checkbox" id="redoOver"> 지금 원가로 기준 넘는 품목 빼기 (${overNow}개)</label>
      ${noRate ? `<label class="ck" title="PROMO_WORK에 할인율 0으로 들어간 행, 할인 없이 기획전에 노출만 한 상품"><input type="checkbox" id="redoZero" checked> 할인 없는 노출 행 빼기 (${noRate}개)</label>` : ''}
    </div>
    <div class="foot"><button class="btn" data-close-modal>닫기</button><button class="btn" id="redoGo">그대로 가져오기</button><button class="btn primary" id="redoFresh" title="구성과 할인율은 유지하고 안 팔리는 품목만 요즘 잘 팔리는 상품으로 바꿔요. 미리보기에서 그대로 가져오기로도 바꿀 수 있어요">안 팔리는 상품만 바꿔서 가져오기</button></div>`,
  m => {
    m.querySelector('#redoFresh').addEventListener('click', async () => {
      const ns = m.querySelector('#redoStart').value;
      const peers = all.filter(x => x.promo === w.promo && x.status === '완료' && Math.abs(new Date(x.start) - new Date(w.start)) <= 7 * 86400000).map(x => x.key);
      try { const r = await api('/api/replan', { method: 'POST', body: { keys: peers.length ? peers : [w.key], start: ns || null } }); closeModal(); emit('replan:show', r); }
      catch (e) { toast(e.message); }
    });
    m.querySelector('#redoGo').addEventListener('click', () => {
    const ns = m.querySelector('#redoStart').value;
    if (!ns) { toast('새 시작일을 고르세요'); return; }
    const off = Math.round((new Date(ns) - new Date(w.start)) / 86400000);
    const shift = s => { const d = new Date(s); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
    const zero = m.querySelector('#redoZero')?.checked, seen = new Set();
    const keep = items.filter(x => x.exists && (!m.querySelector('#redoActive').checked || x.now_active)
      && (!m.querySelector('#redoOver').checked || !(x.now_cost_ratio_after > state.target)) && (!zero || x.rate))
      .filter(x => { const k = `${x.seq}|${x.type}|${x.start}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!keep.length) { toast('남는 품목이 없습니다'); return; }
    const rows = keep.map(x => ({ promo: w.promo, type: x.type, start: shift(x.start), end: shift(x.end || x.start), seq: x.seq, rate: x.rate, category_tag: x.zone || '',
      memo: `지난 ${w.promo} ${mmdd(x.start)} ${pct(x.rate)} · 행사 매출 ${man(x.promo_sales)}만원${x.lift ? ` · 평소 대비 ${x.lift.toFixed(1)}배` : ''}` }));
    emit('plan:replace', { title: `${w.promo} 다시 기획 (원본 ${w.start.slice(2)})`, source: '지난 행사 재기획', brief: '',
      rationale: `지난 '${w.promo}' ${w.type} 회차(${w.start}~${w.end}, ${w.rows}품목, 행사 매출 ${man(w.promo_sales)}만원)를 ${off}일 뒤로 옮겼습니다. 할인율은 그대로이며 지금 원가로 다시 검증합니다.`, rows });
    closeModal();
  });
  });
}


// ---------------------------------------------------------------- 계획 대비 실적
async function renderPlans() {
  const box = $('#revPlans');
  box.innerHTML = '<div class="empty"><span class="spin"></span></div>';
  let ps;
  try { ps = (await api('/api/plans')).plans; } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  const cf = ps.filter(p => p.confirmed_at);
  box.innerHTML = `<p class="sm mute">예전 작업대에서 확정한 기획안 목록이에요. 확정하면 그때의 예측을 고정해 둡니다. 행사가 끝나고 PROMO_WORK·실적을 갱신하면 여기서 예측과 실제를 맞춰 봐요. 반응 배수가 맞았는지 보고 다음 할인율을 정하세요.</p>
    ${cf.length ? `<table class="t compact"><thead><tr><th>기획안</th><th>확정</th><th class="num">행</th><th></th></tr></thead><tbody>
    ${cf.map(p => `<tr><td>${esc(p.title)}</td><td class="cap">${esc(p.confirmed_at)}</td><td class="num">${p.rows}</td><td><button class="btn sm" data-actual="${esc(p.id)}">계획 대비 실적</button></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">예전 작업대에서 확정한 기획안이 없어요. 새 기획안은 05 미리보기·내보내기에서 확정하고 결과를 봐요.</div>'}`;
}

async function openActual(id) {
  openModal('<div class="empty"><span class="spin"></span></div>');
  let d;
  try { d = await api(`/api/plans/${encodeURIComponent(id)}/actual`); } catch (e) { openModal(`<div class="err-box">${esc(e.message)}</div>`); return; }
  const rows = d.rows.map(r => `<tr><td>${esc(r.type)}</td><td class="num">${mmdd(r.start)}${r.end !== r.start ? '~' + mmdd(r.end) : ''}</td><td class="name"><span class="n">${esc(r.name || r.seq)}</span></td><td class="num">${pct(r.rate)}</td>
    <td class="num">${man(r.expected_sales)}</td><td class="num">${r.actual_sales === null || r.actual_sales === undefined ? `<span class="mute">${esc(r.status || '-')}</span>` : man(r.actual_sales)}</td>
    <td class="num ${r.ratio >= 1 ? 'good' : r.ratio < 0.7 ? 'over' : ''}">${r.ratio ? Math.round(r.ratio * 100) + '%' : '-'}</td>
    <td class="num">${r.lift ? r.lift.toFixed(1) + '배' : '-'} → ${r.actual_lift ? r.actual_lift.toFixed(1) + '배' : '-'}</td></tr>`).join('');
  openModal(`<h2>계획 대비 실적: ${esc(d.plan)}</h2>
    <div class="kpis mt10"><div class="kpi"><div class="k">맞춰진 행</div><div class="v">${d.matched || 0}<span class="cap"> / ${d.rows.length}</span></div><div class="s">확정 ${esc(d.snapshot?.confirmed_at || '')}</div></div>
    <div class="kpi"><div class="k">예측</div><div class="v">${man(d.expected_sum)}<span class="cap"> 만원</span></div><div class="s">맞춰진 행 합</div></div>
    <div class="kpi ${d.ratio >= 1 ? 'ok' : d.ratio < 0.7 ? 'err' : ''}"><div class="k">실적</div><div class="v">${man(d.actual_sum)}<span class="cap"> 만원</span></div><div class="s">${d.ratio ? `예측의 ${Math.round(d.ratio * 100)}%` : '-'}</div></div></div>
    <div class="tbl-wrap"><table class="t compact"><thead><tr><th>유형</th><th class="num">기간</th><th>상품</th><th class="num">할인</th><th class="num">예측(만원)</th><th class="num">실적(만원)</th><th class="num">달성</th><th class="num">반응 예측 → 실제</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="cap mt8">${esc(d.note || '')}</p><div class="foot"><button class="btn" data-close-modal>닫기</button></div>`);
}
