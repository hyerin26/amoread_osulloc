// ② 상품·할인 › 하루특가 편성: 날짜 × 자리 격자 + 후보 상품 (plans/03 12장, 확정)
// - 편성 결과는 할인 행 그대로: 상품 하나 = 날짜 하루 = 하루특가 행 하나. 같은 날짜 안의 행 순서가 자리 순서
// - 작업대 표와 같은 편집 중인 행(wbRows)을 고친다. 저장은 ②의 [저장]으로 (수동 저장)
// - 빈 자리 채우기: 후보에서 고르되 같은 상품 14일 안 재특가와 같은 날 중복을 피한다 (기존 규칙과 같음)
import { $, api, attachPicker, closePop, esc, mmdd, openPop, pct, state } from '../core.js';
import { wbAddRow, wbNormRow, wbRefresh, wbRows } from '../plan.js';
import { am } from './store.js';
import { notify } from './ui.js';

const GAP = 14;            // 같은 상품 하루특가 최소 간격 (engine.RECENT_PROMO_DAYS와 같음)
const MAX_DAYS = 62;
const WD = '일월화수목금토';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
const todayIso = () => iso(new Date());

export const keyOf = c => c.items && c.items.length ? `i:${c.items.map(i => `${i.seq}x${i.qty || 1}`).join('+')}` : (c.seq ? `s:${c.seq}` : '');
export const nameOf = c => c.items && c.items.length
  ? '신규 조합: ' + c.items.map(i => (state.bySeq.get(String(i.seq)) || {}).name || i.seq).join(' + ')
  : ((state.bySeq.get(String(c.seq)) || {}).name || (c.seq ? `SEQ ${c.seq}` : '상품 미정'));
const isDeal = r => r.type === '하루특가';

// 편성 날짜: 기획안 기간 → 없으면 하루특가 행의 날짜 → 없으면 오늘부터 2주
export function dealDates(p, rows) {
  const per = p.brief?.period;
  let a, b;
  if (per) { a = per.start; b = per.end; }
  else {
    const ds = rows.filter(isDeal).map(r => r.start).filter(Boolean).sort();
    if (ds.length) { a = ds[0]; b = ds[ds.length - 1]; } else { a = todayIso(); b = addDays(a, 13); }
  }
  const out = [];
  for (let d = a; d <= b && out.length < MAX_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

function defaultRate(c) {
  if (c.rate !== undefined && c.rate !== null) return +c.rate;
  const p = state.bySeq.get(String(c.seq)) || {};
  return p.daily_deal_rate_median ? Math.round(p.daily_deal_rate_median * 100) / 100 : 0.3;
}

// 이 날짜에 이 상품을 넣으면 걸리는 점 ('' = 없음)
export function conflictOf(c, date, rows, skipIndex = -1) {
  const k = keyOf(c); if (!k) return '';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i === skipIndex || !isDeal(r) || keyOf(r) !== k || !r.start) continue;
    if (r.start === date) return '같은 날 이미 있어요';
    if (Math.abs(diff(r.start, date)) <= GAP) return `${mmdd(r.start)}에도 하루특가 (${GAP}일 안)`;
  }
  const p = c.seq ? state.bySeq.get(String(c.seq)) : null;
  if (p) {
    const up = (p.upcoming || []).find(u => u.type === '하루특가' && u.start && Math.abs(diff(u.start, date)) <= GAP);
    if (up) return `잡힌 행사 ${up.promo || ''} ${mmdd(up.start)} 하루특가 (${GAP}일 안)`;
    if (p.last_deal_end && diff(date, p.last_deal_end) >= 0 && diff(date, p.last_deal_end) <= GAP) return `${mmdd(p.last_deal_end)}에 하루특가를 했어요 (${GAP}일 안)`;
  }
  return '';
}

// 날짜별 하루특가 행 목록 (행 번호 포함, 순서 = 자리)
function byDate(rows) {
  const m = new Map();
  rows.forEach((r, i) => { if (isDeal(r) && r.start) { if (!m.has(r.start)) m.set(r.start, []); m.get(r.start).push(i); } });
  return m;
}

// 빈 자리 채우기: 날짜순으로, 쓰인 횟수가 적은 후보부터. 반환 { added, left }
export function fillEmpty(plan, dates) {
  const rows = wbRows();
  const cands = plan.candidates.filter(c => keyOf(c));
  if (!cands.length) return { added: 0, left: null };
  const uses = new Map(cands.map(c => [keyOf(c), rows.filter(r => isDeal(r) && keyOf(r) === keyOf(c)).length]));
  const today = todayIso();
  let added = 0, left = 0;
  for (const d of dates) {
    if (d < today) continue;
    let n = rows.filter(r => isDeal(r) && r.start === d).length;
    while (n < plan.slots) {
      const pick = cands.map((c, i) => ({ c, i })).filter(x => !conflictOf(x.c, d, rows))
        .sort((x, y) => uses.get(keyOf(x.c)) - uses.get(keyOf(y.c)) || x.i - y.i)[0];
      if (!pick) { left += plan.slots - n; break; }
      rows.push(wbNormRow({ type: '하루특가', start: d, end: d, seq: pick.c.seq || '', items: pick.c.items || null, rate: defaultRate(pick.c), promo: am.cur.title, memo: '빈 자리 채우기' }));
      uses.set(keyOf(pick.c), uses.get(keyOf(pick.c)) + 1);
      added++; n++;
    }
  }
  if (added) wbRefresh();
  return { added, left };
}

// ---------------------------------------------------------------- 그리기
// ctx: { plan: 하루특가 설정 초안, onPlanChange: () => void }
export function renderDeals(host, ctx) {
  const plan = ctx.plan;
  const rows = wbRows();
  const dates = dealDates(am.cur, rows);
  const map = byDate(rows);
  const today = todayIso();
  const maxN = Math.max(plan.slots, ...dates.map(d => (map.get(d) || []).length));
  const inRange = new Set(dates);
  const outside = [...map.keys()].filter(d => !inRange.has(d)).sort();
  const filled = dates.reduce((a, d) => a + Math.min(plan.slots, (map.get(d) || []).length), 0);
  const future = dates.filter(d => d >= today).length;

  const head = dates.map(d => { const w = parse(d).getDay(); return `<th class="${w === 0 || w === 6 ? 'we' : ''} ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}"><span>${mmdd(d)}</span><span class="cap">${WD[w]}</span></th>`; }).join('');
  let body = '';
  for (let s = 0; s < maxN; s++) {
    const over = s >= plan.slots;
    body += `<tr class="${over ? 'over' : ''}"><th class="slot">${over ? '넘침' : `자리 ${s + 1}`}</th>${dates.map(d => {
      const ix = (map.get(d) || [])[s];
      if (ix === undefined) {
        if (over) return '<td class="none"></td>';
        const next = s === (map.get(d) || []).length;   // 그 날짜의 다음 빈 자리만 넣을 수 있음
        return next ? `<td><button class="am-cell empty" data-empty="${d}" ${d < today ? 'disabled' : ''} aria-label="${mmdd(d)} 자리 ${s + 1}에 넣기">+</button></td>` : '<td><span class="am-cell empty later" aria-hidden="true"></span></td>';
      }
      const r = rows[ix], warn = conflictOf(r, d, rows, ix);
      return `<td><button class="am-cell ${warn ? 'warn' : ''}" data-cell="${ix}" title="${esc(nameOf(r))} ${pct(r.rate)}${warn ? ` · ${warn}` : ''}">
        <span class="am-cell-n">${esc(nameOf(r))}</span><span class="am-cell-r">${pct(r.rate)}${warn ? ' !' : ''}</span></button></td>`;
    }).join('')}</tr>`;
  }
  host.innerHTML = `<section class="card am-deals">
      <div class="sec-head"><h2>하루특가 편성</h2>
        <span class="cap">${dates.length}일 · 하루</span>
        <select id="amSlots" aria-label="하루 자리 수">${[1, 2, 3, 4, 5, 6, 8].map(n => `<option value="${n}" ${n === plan.slots ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <span class="cap">자리 · 채운 자리 ${filled}/${dates.length * plan.slots}</span>
        <span class="grow"></span>
        <button class="btn sm primary" data-dl="fill" ${future && plan.candidates.length ? '' : 'disabled'}>빈 자리 채우기</button></div>
      <p class="cap">같은 날짜 안의 순서가 자리 순서예요. 빈 칸을 눌러 후보나 다른 상품을 넣고, 채운 칸을 눌러 할인율을 바꾸거나 빼요. 같은 상품을 ${GAP}일 안에 다시 넣으면 ! 로 표시돼요.
        ${am.cur.brief.period ? '' : ' 기획안 기간이 없어 하루특가 날짜 기준으로 보여줘요.'}</p>
      <div class="am-dealgrid-wrap"><table class="am-dealgrid"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      ${outside.length ? `<p class="am-warn mt8">기획안 기간 밖 하루특가 ${outside.reduce((a, d) => a + map.get(d).length, 0)}개: ${outside.map(mmdd).join(', ')}. 할인 행 화면에서 날짜를 고치거나 기간을 늘려 주세요.</p>` : ''}
    </section>
    <section class="card am-dealcands">
      <div class="sec-head"><h2>후보 상품</h2><span class="cap">${plan.candidates.length}개</span><span class="grow"></span>
        <button class="btn sm" data-dl="suggest" ${future ? '' : 'disabled'} title="가장 가까운 날의 하루특가 후보(원가율 여력, 14일 안 하루특가 없음, 최근 매출순)를 가져와요">추천 후보 가져오기</button></div>
      <div class="picker"><input type="search" id="amCandSearch" placeholder="상품 이름이나 SEQ로 후보 추가"><div class="dd hidden" id="amCandDD"></div></div>
      ${plan.candidates.length ? `<ul class="am-candlist">${plan.candidates.map((c, i) => {
        const used = rows.filter(r => isDeal(r) && keyOf(r) === keyOf(c)).map(r => r.start).sort();
        return `<li><span class="am-cand-n">${esc(nameOf(c))}</span>
          <label class="am-cand-rate">할인 <input type="number" min="1" max="80" step="1" data-crate="${i}" value="${Math.round(defaultRate(c) * 100)}">%</label>
          <span class="cap">${used.length ? `${used.length}번 (${used.slice(0, 3).map(mmdd).join(', ')}${used.length > 3 ? ' 외' : ''})` : '아직 안 씀'}</span>
          <button class="btn ghost sm" data-cdel="${i}" aria-label="${esc(nameOf(c))} 후보에서 빼기">빼기</button></li>`;
      }).join('')}</ul>` : '<p class="cap mt8">후보가 없어요. 위에서 상품을 찾아 추가하거나, 추천 후보를 가져오거나, 캘린더 날짜 상세의 하루특가 후보에서 담아 주세요.</p>'}
    </section>`;

  $('#amSlots', host).addEventListener('change', e => { plan.slots = +e.target.value; ctx.onPlanChange(); });
  attachPicker($('#amCandSearch', host), $('#amCandDD', host), p => addCandidate(plan, { seq: String(p.seq) }, ctx));
  host.onclick = e => onClick(e, host, ctx, dates);
  host.onchange = e => {
    const r = e.target.closest('[data-crate]'); if (!r) return;
    const c = plan.candidates[+r.dataset.crate]; c.rate = Math.max(0.01, Math.min(0.8, (+r.value || 30) / 100)); ctx.onPlanChange();
  };
}

function addCandidate(plan, c, ctx) {
  if (plan.candidates.some(x => keyOf(x) === keyOf(c))) { notify('이미 후보에 있어요'); return false; }
  plan.candidates.push({ seq: c.seq || null, items: c.items || null, rate: c.rate ?? null, memo: c.memo || '' });
  ctx.onPlanChange();
  return true;
}

async function onClick(e, host, ctx, dates) {
  const plan = ctx.plan, rows = wbRows();
  const dl = e.target.closest('[data-dl]');
  if (dl && dl.dataset.dl === 'fill') {
    const r = fillEmpty(plan, dates);
    notify(r.added ? `빈 자리 ${r.added}개를 채웠어요${r.left ? `. ${r.left}자리는 조건에 맞는 후보가 없어요 (같은 날 중복, ${GAP}일 안 재특가)` : ''}. 저장을 눌러야 반영돼요`
      : `채울 수 있는 후보가 없어요${r.left ? ` (빈 자리 ${r.left}개)` : ''}. 후보를 늘리거나 할인 행에서 직접 넣어 주세요`);
    return;
  }
  if (dl && dl.dataset.dl === 'suggest') {
    const d = dates.find(x => x >= todayIso()); if (!d) return;
    try {
      const res = await api('/api/day', { method: 'POST', body: { date: d, exclude: [] } });
      let n = 0;
      for (const c of (res.candidates || []).slice(0, 10)) {
        if (plan.candidates.some(x => keyOf(x) === `s:${c.seq}`)) continue;
        plan.candidates.push({ seq: String(c.seq), items: null, rate: c.suggest_rate ?? null, memo: '추천 후보' }); n++;
      }
      ctx.onPlanChange();
      notify(n ? `추천 후보 ${n}개를 가져왔어요 (${mmdd(d)} 기준)` : '새로 가져올 추천 후보가 없어요');
    } catch (err) { notify(err.message); }
    return;
  }
  const del = e.target.closest('[data-cdel]');
  if (del) { plan.candidates.splice(+del.dataset.cdel, 1); ctx.onPlanChange(); return; }

  const cell = e.target.closest('[data-cell]');
  if (cell) {
    const ix = +cell.dataset.cell, r = rows[ix], warn = conflictOf(r, r.start, rows, ix);
    openPop(cell, `<h4>${esc(nameOf(r))}</h4><div class="cap">${mmdd(r.start)} 하루특가${warn ? ` · <span class="over">${esc(warn)}</span>` : ''}</div>
      <label class="am-f mt8"><span>할인율</span><span class="row"><input type="number" id="amCellRate" min="1" max="80" value="${Math.round((r.rate || 0) * 100)}"> %</span></label>
      <div class="acts"><button class="btn sm primary" data-pa="rate">할인율 바꾸기</button><button class="btn sm" data-pa="swap">다른 상품으로</button><button class="btn sm danger" data-pa="del">빼기</button></div>`,
    pop => { pop.onclick = ev => {
      const b = ev.target.closest('[data-pa]'); if (!b) return;
      if (b.dataset.pa === 'rate') { r.rate = Math.max(0.01, Math.min(0.8, (+$('#amCellRate', pop).value || 0) / 100)); closePop(); wbRefresh(); }
      else if (b.dataset.pa === 'del') { rows.splice(ix, 1); closePop(); wbRefresh(); }
      else if (b.dataset.pa === 'swap') { closePop(); pickFor(cell, r.start, ctx, ix); }
    }; });
    return;
  }
  const empty = e.target.closest('[data-empty]');
  if (empty && !empty.disabled) pickFor(empty, empty.dataset.empty, ctx, -1);
}

// 빈 칸 채우기 또는 바꾸기: 후보 목록(걸리는 점 표시) + 상품 검색
function pickFor(anchor, date, ctx, replaceIx) {
  const plan = ctx.plan, rows = wbRows();
  const list = plan.candidates.map((c, i) => ({ c, i, warn: conflictOf(c, date, rows, replaceIx) }));
  openPop(anchor, `<h4>${mmdd(date)} ${replaceIx >= 0 ? '상품 바꾸기' : '하루특가 넣기'}</h4>
    ${list.length ? `<ul class="am-pickcands">${list.map(x => `<li><button class="am-pickcand ${x.warn ? 'warn' : ''}" data-pc="${x.i}"><span>${esc(nameOf(x.c))} ${pct(defaultRate(x.c))}</span>${x.warn ? `<span class="cap over">${esc(x.warn)}</span>` : ''}</button></li>`).join('')}</ul>`
      : '<p class="cap">후보가 없어요. 아래에서 상품을 찾으면 후보에도 추가돼요.</p>'}
    <div class="picker mt8"><input type="search" id="amPickSearch" placeholder="다른 상품 찾기"><div class="dd hidden" id="amPickDD"></div></div>`,
  pop => {
    const put = c => {
      closePop();
      if (replaceIx >= 0) { const r = rows[replaceIx]; r.seq = c.seq || ''; r.items = c.items || null; r.rate = defaultRate(c); wbRefresh(); }
      else wbAddRow({ type: '하루특가', start: date, end: date, seq: c.seq || '', items: c.items || null, rate: defaultRate(c), promo: am.cur.title });
    };
    pop.onclick = ev => { const b = ev.target.closest('[data-pc]'); if (b) put(plan.candidates[+b.dataset.pc]); };
    attachPicker($('#amPickSearch', pop), $('#amPickDD', pop), p => {
      const c = { seq: String(p.seq) };
      if (!plan.candidates.some(x => keyOf(x) === keyOf(c))) plan.candidates.push({ seq: c.seq, items: null, rate: null, memo: '' });
      put(c); ctx.onPlanChange();
    });
    $('#amPickSearch', pop).focus();
  });
}
