// ② 상품·할인 › 후보 상품: 아직 역할을 정하지 않은 상품 (plans/05 R18)
// 상품마다 역할을 골라 보낸다: 상시 할인으로(구좌 상품) · 할인 없이 구좌에(구좌 상품, PROMO_WORK 큐레이션) · 하루특가 후보로(하루특가 편성)
// 아래 '추천'은 캘린더 날짜 상세와 같은 근거를 기획안 기간에 맞춰 보여준다 (작년 이맘때, 하루특가 후보, 요즘 뜨는 상품)
// 편집 중인 값만 바꾸고, ②의 [저장]으로 반영한다
import { $, api, attachPicker, esc, man, mmdd, pct, state, won } from '../core.js';
import { wbAddRow, wbRows } from '../plan.js';
import { am } from './store.js';
import { keyOf, nameOf } from './deals.js';
import { notify } from './ui.js';

const REC_TABS = [['ly', '작년 이맘때 잘 팔린 상품'], ['deal', '하루특가 후보'], ['hot', '요즘 뜨는 상품']];
let recTab = 'ly';
let recCache = { key: '', ly: null, deal: null, dealDate: '', err: '' };

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return iso(x); };

// 추천 기준 기간: 기획안 기간, 없으면 오늘부터 2주
function recRange() {
  const per = am.cur.brief.period;
  if (per) return { a: per.start, b: per.end };
  const t = iso(new Date());
  return { a: t, b: addDays(t, 13) };
}

// ctx: { pool: 후보 상품 초안 배열, deal: 하루특가 설정 초안, onChange: () => void }
export function renderPool(host, ctx) {
  const { pool } = ctx;
  host.innerHTML = `<section class="card am-pool">
      <div class="sec-head"><h2>후보 상품</h2><span class="cap">${pool.length}개 · 역할을 정하지 않은 상품</span></div>
      <p class="cap">트렌드, 리뷰, 상품 화면에서 '역할은 나중에'로 담은 상품과 아래 추천에서 고른 상품이 여기 모여요. 상품마다 역할을 고르면 구좌 상품이나 하루특가 후보로 옮겨져요.</p>
      <div class="picker"><input type="search" id="amPoolSearch" placeholder="상품 이름이나 SEQ로 후보 추가"><div class="dd hidden" id="amPoolDD"></div></div>
      ${pool.length ? `<ul class="am-poollist">${pool.map((c, i) => {
        const p = c.seq ? state.bySeq.get(String(c.seq)) || {} : {};
        return `<li><div class="am-pool-main"><span class="am-cand-n">${esc(nameOf(c))}</span>
            <span class="cap">${[c.source, p.price ? `정가 ${won(p.price)}원` : '', p.max_discount !== undefined && p.max_discount !== null ? `원가율 기준 최대 할인 ${pct(p.max_discount)}` : '', c.memo].filter(Boolean).map(esc).join(' · ')}</span></div>
          <div class="am-pool-acts">
            <button class="btn sm" data-pa="sangsi" data-i="${i}">상시 할인으로</button>
            <button class="btn sm" data-pa="cur" data-i="${i}">할인 없이 구좌에</button>
            <button class="btn sm" data-pa="deal" data-i="${i}">하루특가 후보로</button>
            <button class="btn ghost sm" data-pa="del" data-i="${i}" aria-label="${esc(nameOf(c))} 빼기">빼기</button></div></li>`;
      }).join('')}</ul>` : '<p class="cap mt8">후보 상품이 없어요. 아래 추천에서 골라 보세요.</p>'}
    </section>
    <section class="card am-rec">
      <div class="sec-head"><h2>추천</h2><span class="cap" id="amRecBasis"></span></div>
      <div class="grp" role="tablist" aria-label="추천 종류">${REC_TABS.map(([k, l]) => `<button class="chip ${recTab === k ? 'on' : ''}" data-rt="${k}" aria-pressed="${recTab === k}">${esc(l)}</button>`).join('')}</div>
      <div id="amRecBody"><div class="empty"><span class="spin"></span></div></div>
    </section>`;
  attachPicker($('#amPoolSearch', host), $('#amPoolDD', host), p => addToPool(ctx, { seq: String(p.seq), source: '직접 추가' }));
  host.onclick = e => onClick(e, host, ctx);
  paintRecs(host, ctx);
}

function addToPool(ctx, c) {
  const item = { seq: c.seq || null, items: c.items || null, memo: c.memo || '', source: c.source || '' };
  if (ctx.pool.some(x => keyOf(x) === keyOf(item))) { notify('이미 후보 상품에 있어요'); return false; }
  ctx.pool.push(item); ctx.onChange();
  return true;
}

function onClick(e, host, ctx) {
  const rt = e.target.closest('[data-rt]');
  if (rt) { recTab = rt.dataset.rt; renderPool(host, ctx); return; }
  const ra = e.target.closest('[data-radd]');
  if (ra) { if (addToPool(ctx, { seq: ra.dataset.radd, source: ra.dataset.src, memo: ra.dataset.memo || '' })) notify('후보 상품에 넣었어요. 역할은 위에서 골라 주세요'); return; }
  const rd = e.target.closest('[data-rdeal]');
  if (rd) {
    const c = { seq: rd.dataset.rdeal, items: null, rate: rd.dataset.rate ? +rd.dataset.rate : null, memo: '하루특가 추천' };
    if (ctx.deal.candidates.some(x => keyOf(x) === keyOf(c))) { notify('이미 하루특가 후보에 있어요'); return; }
    ctx.deal.candidates.push(c); ctx.onChange(); notify('하루특가 후보에 넣었어요. 날짜는 하루특가 편성에서 정해요');
    return;
  }
  const b = e.target.closest('[data-pa]'); if (!b) return;
  const pool = ctx.pool, i = +b.dataset.i, c = pool[i]; if (!c) return;
  const per = am.cur.brief.period;
  const base = { seq: c.seq || '', items: c.items || null, promo: am.cur.title, memo: c.memo || '', ...(per ? { start: per.start, end: per.end } : {}) };
  if (b.dataset.pa === 'sangsi') { pool.splice(i, 1); wbAddRow({ ...base, type: '상시' }); notify(`${nameOf(c)}을(를) 구좌 상품(상시 할인)으로 옮겼어요. 할인율은 구좌 상품에서 정해요`); }
  else if (b.dataset.pa === 'cur') { pool.splice(i, 1); wbAddRow({ ...base, type: '큐레이션', rate: 0 }); notify(`${nameOf(c)}을(를) 구좌 상품(할인 없음)으로 옮겼어요`); }
  else if (b.dataset.pa === 'deal') {
    if (!ctx.deal.candidates.some(x => keyOf(x) === keyOf(c))) ctx.deal.candidates.push({ seq: c.seq || null, items: c.items || null, rate: null, memo: c.memo || '' });
    pool.splice(i, 1); notify(`${nameOf(c)}을(를) 하루특가 후보로 옮겼어요. 날짜는 하루특가 편성에서 정해요`);
  } else if (b.dataset.pa === 'del') pool.splice(i, 1);
  ctx.onChange();
}

// ---------------- 추천 ----------------
// 이미 기획안에 있는 상품(구좌 상품, 하루특가 행·후보, 후보 상품)은 '이미 있음'으로 표시
function haveSet(ctx) {
  const s = new Set();
  wbRows().forEach(r => { if (r.seq) s.add(String(r.seq)); });
  ctx.pool.forEach(c => { if (c.seq) s.add(String(c.seq)); });
  ctx.deal.candidates.forEach(c => { if (c.seq) s.add(String(c.seq)); });
  return s;
}

async function loadRecs() {
  const { a, b } = recRange();
  const key = `${am.cur.id}|${a}|${b}|${state.meta?.built_at || ''}`;
  if (recCache.key === key) return recCache;
  recCache = { key, ly: null, deal: null, dealDate: '', err: '' };
  const today = iso(new Date());
  const dealDate = b < today ? '' : (a < today ? today : a);
  try {
    const [ly, deal] = await Promise.all([
      api(`/api/lastyear?date_from=${a}&date_to=${b}&limit=20`),
      dealDate ? api('/api/day', { method: 'POST', body: { date: dealDate, exclude: [] } }) : Promise.resolve(null),
    ]);
    recCache.ly = ly; recCache.deal = deal; recCache.dealDate = dealDate;
  } catch (e) { recCache.err = e.message; }
  return recCache;
}

async function paintRecs(host, ctx) {
  const box = $('#amRecBody', host), basis = $('#amRecBasis', host); if (!box) return;
  const { a, b } = recRange();
  const rc = await loadRecs();
  if (!$('#amRecBody', host)) return;
  if (rc.err) { box.innerHTML = `<div class="err-box">${esc(rc.err)}</div>`; return; }
  const have = haveSet(ctx);
  const tag = seq => have.has(String(seq)) ? '<span class="am-badge">이미 있음</span>' : '';
  const addBtn = (seq, src, memo = '') => have.has(String(seq)) ? '' : `<button class="btn sm" data-radd="${esc(String(seq))}" data-src="${esc(src)}" data-memo="${esc(memo)}">후보에 추가</button>`;

  if (recTab === 'ly') {
    const ly = rc.ly;
    basis.textContent = ly && ly.available ? `작년 ${mmdd(ly.ly_from)}~${mmdd(ly.ly_to)} (364일 전, 같은 요일) 매출 기준. 지금 판매 중인 상품만` : '';
    if (!ly || !ly.available || !ly.rows.length) { box.innerHTML = `<p class="cap">작년 같은 기간(${mmdd(a)}~${mmdd(b)}의 364일 전) 실적이 없어요.</p>`; return; }
    box.innerHTML = `<ul class="am-reclist">${ly.rows.map(r => `<li class="${have.has(String(r.seq)) ? 'have' : ''}"><div class="am-rec-main">
        <span class="am-cand-n">${esc(r.name)} ${tag(r.seq)}</span>
        <span class="cap">작년 이 기간 ${man(r.ly_sales)}만원${(r.ly_promos || []).length ? ` · 작년 행사 ${esc(r.ly_promos.join(', '))}` : ' · 작년 행사 없음'}${r.max_discount !== null && r.max_discount !== undefined ? ` · 최대 할인 ${pct(r.max_discount)}` : ''}${(r.upcoming || []).length ? ' · 예정 행사 있음' : ''}</span></div>
        ${addBtn(r.seq, '작년 이맘때 추천', `작년 이 기간 ${man(r.ly_sales)}만원`)}</li>`).join('')}</ul>`;
    return;
  }
  if (recTab === 'deal') {
    const d = rc.deal;
    basis.textContent = rc.dealDate ? `${mmdd(rc.dealDate)} 기준. 원가율 기준 최대 할인 30% 이상, 앞뒤 14일 하루특가 없음, 최근 28일 매출순` : '';
    if (!rc.dealDate) { box.innerHTML = '<p class="cap">기획안 기간이 이미 지나 하루특가 후보를 계산하지 않아요.</p>'; return; }
    const cands = (d && d.candidates) || [];
    if (!cands.length) { box.innerHTML = '<p class="cap">조건에 맞는 하루특가 후보가 없어요.</p>'; return; }
    box.innerHTML = `<ul class="am-reclist">${cands.map(c => `<li class="${have.has(String(c.seq)) ? 'have' : ''}"><div class="am-rec-main">
        <span class="am-cand-n">${esc(c.name)} ${tag(c.seq)}</span>
        <span class="cap">제안 할인 ${pct(c.suggest_rate)} · 최대 ${pct(c.max_discount)} · 예상 매출 ${man(c.exp_sales)}만원(참고치) · 지난 하루특가 ${c.last_deal ? mmdd(c.last_deal) : '없음'}</span></div>
        ${have.has(String(c.seq)) ? '' : `<button class="btn sm" data-rdeal="${esc(String(c.seq))}" data-rate="${c.suggest_rate ?? ''}">하루특가 후보로</button>${addBtn(c.seq, '하루특가 추천')}`}</li>`).join('')}</ul>`;
    return;
  }
  // 요즘 뜨는 상품: 최근 28일 매출이 직전보다 30% 넘게 늘고 진행·예정 행사가 없는 상품 (기존 '할 일' 알림과 같은 규칙)
  basis.textContent = '최근 28일 매출이 직전 28일보다 30% 넘게 늘고 진행·예정 행사가 없는 상품, 28일 매출 50만원 이상';
  const hot = (state.products || []).filter(p => p.active && (p.growth_28 || 0) >= 0.3 && (p.sales_28 || 0) >= 500000 && !(p.upcoming || []).length && !(p.running || []).length)
    .sort((x, y) => (y.sales_28 || 0) - (x.sales_28 || 0)).slice(0, 20);
  if (!hot.length) { box.innerHTML = '<p class="cap">조건에 맞는 상품이 없어요.</p>'; return; }
  box.innerHTML = `<ul class="am-reclist">${hot.map(p => `<li class="${have.has(String(p.seq)) ? 'have' : ''}"><div class="am-rec-main">
      <span class="am-cand-n">${esc(p.name)} ${tag(p.seq)}</span>
      <span class="cap">최근 28일 ${man(p.sales_28)}만원 · 직전 대비 ${Math.round((p.growth_28 || 0) * 100)}% 증가${p.max_discount !== null && p.max_discount !== undefined ? ` · 최대 할인 ${pct(p.max_discount)}` : ''}</span></div>
      ${addBtn(p.seq, '요즘 뜨는 상품', `최근 28일 ${Math.round((p.growth_28 || 0) * 100)}% 증가`)}</li>`).join('')}</ul>`;
}
