// 상품 탐색: 목적별 빠른 보기 + 촘촘한 표 + 겹쳐 열리는 상세 시트(구성 원가·행사 이력·할인 시뮬레이터)
import { $, $$, api, applyBars, bar, closeSheet, daysAgo, debounce, delta, emit, esc, man, maxDiscount,
  mmdd, on, openSheet, pct, prodTags, promoBadges, qty, spark, state, toast, won } from './core.js';

const CATS = ['티 세트', '티 제품', '티푸드', '라이프 스타일'];
const BANDS = ['1만원 미만', '1만원대', '2만원대', '3~4만원대', '5~7만원대', '8만원 이상'];
// 목적별 빠른 보기: 필터 + 정렬을 한 번에
const PRESETS = [
  { k: 'all', t: '전체 (매출순)', sort: ['sales_28', -1] },
  { k: 'room', t: '할인 여력 큰', f: p => p.max_discount >= 0.35, sort: ['sales_28', -1], hint: '35% 넘게 할인해도 원가율 기준 이내' },
  { k: 'grow', t: '요즘 뜨는', f: p => p.growth_28 >= 0.3 && p.sales_28 >= 300000, sort: ['growth_28', -1], hint: '28일 매출 직전 대비 +30% 이상' },
  { k: 'dorm', t: '오래 행사 없던', f: p => p.days_since_promo === null || p.days_since_promo === undefined || p.days_since_promo >= 45, sort: ['sales_28', -1], hint: 'PROMO_WORK 행사가 45일 넘게 없거나 2025-09 이후 없음' },
  { k: 'rested', t: '푹 쉰 (특가 61일+)', f: p => p.max_discount >= 0.3 && (p.days_since_deal === null || p.days_since_deal === undefined || p.days_since_deal >= 61), sort: ['sales_28', -1], hint: '하루특가를 61일 넘게 쉰 상품: 쉰 상품일수록 반응이 컸음(레버 보드)' },
  { k: 'ly', t: '작년 이맘때 잘 팔린', f: p => p.ly_next28 > 0, sort: ['ly_next28', -1], hint: '작년 같은 기간(앞으로 4주에 해당, 364일 전) 매출순' },
  { k: 'heavy', t: '원가 높은 (묶음 필요)', f: p => p.max_discount !== null && p.max_discount < 0.2, sort: ['sales_28', -1], hint: '혼자서는 20%도 할인하기 어려움' },
];
const COLS = [
  { k: 'seq', t: 'SEQ', num: true, cls: 'seqc' },
  { k: 'name', t: '상품명' },
  { k: 'price', t: '정가', num: true },
  { k: 'cost_ratio', t: '원가율', num: true },
  { k: 'max_discount', t: '최대 할인', num: true, title: '할인 후 원가율이 기준(45%)을 넘지 않는 최대 할인율' },
  { k: 'sales_28', t: '28일 매출(만원)', num: true },
  { k: 'growth_28', t: '직전 대비', num: true, pri: 'p2' },
  { k: 'ly_next28', t: '작년 이맘때(만원)', num: true, pri: 'p3', title: '작년 같은 기간: 앞으로 4주에 해당하는 364일 전 4주 매출' },
  { k: 'spark', t: '90일 추이', sortable: false, pri: 'p3' },
  { k: 'days_since_promo', t: '마지막 행사', num: true, title: 'PROMO_WORK 행사가 끝난 뒤 지난 일수 (- = 2025-09 이후 없음)' },
  { k: 'days_since_deal', t: '특가 쉰 기간', num: true, pri: 'p2', title: '같은 상품 마지막 하루특가 이후 지난 일수, 61일 넘게 쉰 상품의 반응이 컸음' },
  { k: 'promo', t: '진행·예정', sortable: false, pri: 'p2' },
  { k: 'act', t: '', sortable: false },
];

const f = { query: '', cat: '', band: '', type: '', all: false, free: false, preset: 'all' };
let sortKey = 'sales_28', sortDir = -1;

export function initProducts() {
  $('#fPreset').innerHTML = PRESETS.map(p => `<button class="chip ${p.k === 'all' ? 'on' : ''}" data-preset="${p.k}" title="${esc(p.hint || '')}">${esc(p.t)}</button>`).join('');
  $('#fCat').innerHTML = ['전체', ...CATS].map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-cat="${i ? esc(c) : ''}">${esc(c)}</button>`).join('');
  $('#fBand').innerHTML += BANDS.map(b => `<option>${b}</option>`).join('');
  $('#fPreset').addEventListener('click', e => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    $$('#fPreset .chip').forEach(x => x.classList.toggle('on', x === b));
    f.preset = b.dataset.preset; [sortKey, sortDir] = PRESETS.find(p => p.k === f.preset).sort; render();
  });
  $('#fCat').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    $$('#fCat .chip').forEach(x => x.classList.toggle('on', x === b)); f.cat = b.dataset.cat; render();
  });
  $('#fQuery').addEventListener('input', debounce(e => { f.query = e.target.value.replace(/\s/g, '').toLowerCase(); render(); }, 150));
  $('#fBand').addEventListener('change', e => { f.band = e.target.value; render(); });
  $('#fType').addEventListener('change', e => { f.type = e.target.value; render(); });
  $('#fFree').addEventListener('change', e => { f.free = e.target.checked; render(); });
  $('#fAll').addEventListener('change', e => { f.all = e.target.checked; render(); });
  $('#prodTable').addEventListener('click', e => {
    const add = e.target.closest('[data-quickadd]');
    if (add) { quickAdd(add, add.dataset.quickadd); e.stopPropagation(); return; }
    const th = e.target.closest('th[data-k]');
    if (th) { const k = th.dataset.k; sortDir = sortKey === k ? -sortDir : (k === 'name' || k === 'cost_ratio' ? 1 : -1); sortKey = k; render(); return; }
    const tr = e.target.closest('tr[data-seq]');
    if (tr) openDetail(tr.dataset.seq);
  });
  on('sheet:closed', () => $$('#prodTable tr.sel').forEach(t => t.classList.remove('sel')));
  on('product:open', seq => openDetail(seq));
  on('products:preset', k => {
    $('.tab[data-view="products"]').click();
    const b = $(`#fPreset [data-preset="${k}"]`); if (b) b.click();
    if (k === 'grow') { $('#fFree').checked = true; f.free = true; render(); }
  });
}

function quickAdd(btn, seq) {
  const p = state.bySeq.get(seq);
  const rate = Math.max(0.1, Math.min(0.2, Math.floor((p.max_discount || 0.2) * 20) / 20));
  emit('plan:add', { seq, type: '상시', rate });
  
}

function filtered() {
  const pre = PRESETS.find(p => p.k === f.preset);
  return state.products.filter(p => {
    if (!f.all && !p.active) return false;
    if (pre.f && (p.cost === null || p.cost === undefined || !pre.f(p))) return false;
    if (f.cat && p.category !== f.cat) return false;
    if (f.band && p.price_band !== f.band) return false;
    if (f.type && p.product_type !== f.type) return false;
    if (f.free && ((p.upcoming || []).length || (p.running || []).length)) return false;
    if (f.query && !(String(p.seq) === f.query || String(p.name).replace(/\s/g, '').toLowerCase().includes(f.query))) return false;
    return true;
  });
}

export function renderProducts() { render(); }

function promoCell(p) {
  const run = (p.running || []).length, up = (p.upcoming || []).length;
  if (!run && !up) return '<span class="mute">-</span>';
  const tip = [...(p.running || []).map(r => `진행: ${r.promo} ${r.type} ~${mmdd(r.end)} ${pct(r.rate)}`),
    ...(p.upcoming || []).map(u => `예정: ${u.promo} ${u.type} ${mmdd(u.start)}~${mmdd(u.end)} ${pct(u.rate)}`)].join('\n');
  return `<span class="when" title="${esc(tip)}">${run ? `<span class="dot run"></span>진행 ${run}` : ''}${run && up ? ' · ' : ''}${up ? `<span class="dot plan"></span>예정 ${up}` : ''}</span>`;
}

function render() {
  const rows = filtered();
  rows.sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    if (x === y) return 0;
    if (x === null || x === undefined) return sortKey === 'days_since_promo' && sortDir < 0 ? -1 : 1;
    if (y === null || y === undefined) return sortKey === 'days_since_promo' && sortDir < 0 ? 1 : -1;
    return (typeof x === 'string' ? x.localeCompare(y, 'ko') : x - y) * sortDir;
  });
  kpis(rows);
  const pre = PRESETS.find(p => p.k === f.preset);
  $('#prodCount').textContent = `${rows.length.toLocaleString()}개${pre.hint ? ' · ' + pre.hint : ''}${rows.length > 400 ? ' (상위 400개 표시)' : ''}`;
  const head = `<thead><tr>${COLS.map(c => `<th class="${c.num ? 'num' : ''} ${c.pri || ''} ${c.sortable === false ? '' : 'sort'}" ${c.sortable === false ? '' : `data-k="${c.k}"`} title="${esc(c.title || '')}">${c.t}${sortKey === c.k ? `<span class="arr">${sortDir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('')}</tr></thead>`;
  const body = rows.slice(0, 400).map(p => `<tr class="click" data-seq="${p.seq}">
      <td class="num seqc">${p.seq}</td>
      <td class="name" title="${esc(p.name)} · ${esc(p.category || '')} · ${esc(p.product_type || '')}"><span class="n">${esc(p.name)}<span class="tags">${prodTags(p)}</span></span></td>
      <td class="num">${won(p.price)}</td>
      <td class="num">${pct(p.cost_ratio)}</td>
      <td class="num">${p.max_discount === null || p.max_discount === undefined ? '-' : `${p.max_discount <= 0 ? '<span class="over">없음</span>' : pct(p.max_discount)}${bar(p.max_discount)}`}</td>
      <td class="num">${man(p.sales_28)}</td>
      <td class="num p2">${delta(p.growth_28)}</td>
      <td class="num p3">${p.ly_next28 ? man(p.ly_next28) : '<span class="mute">-</span>'}</td>
      <td class="p3">${spark(p.daily_qty, 84, 22)}</td>
      <td class="num" title="${esc(p.last_promo ? `${p.last_promo} ${p.last_promo_type || ''} ${pct(p.last_promo_rate)}` : '2025-09 이후 행사 없음')}">${p.days_since_promo === null || p.days_since_promo === undefined ? '<span class="mute">없음</span>' : daysAgo(p.days_since_promo)}</td>
      <td class="num p2 ${p.days_since_deal !== null && p.days_since_deal !== undefined && p.days_since_deal <= 60 ? 'warnc' : ''}">${p.days_since_deal === null || p.days_since_deal === undefined ? '<span class="mute">없음</span>' : p.days_since_deal + '일'}</td>
      <td class="p2">${promoCell(p)}</td>
      <td class="act"><button class="btn sm rowbtn" data-quickadd="${p.seq}" title="작업 중 기획안의 구좌 상품(상시 할인)으로 담기">+ 담기</button></td></tr>`).join('');
  $('#prodTable').innerHTML = head + `<tbody>${body || `<tr><td colspan="${COLS.length}"><div class="empty">조건에 맞는 상품이 없습니다</div></td></tr>`}</tbody>`;
  applyBars($('#prodTable'));
}

function kpis(rows) {
  const withCost = rows.filter(p => p.cost_ratio !== null && p.cost_ratio !== undefined);
  const med = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const sales = rows.reduce((s, p) => s + (p.sales_28 || 0), 0);
  const tight = withCost.filter(p => p.max_discount < 0.2).length;
  $('#prodKpis').innerHTML = `
    <div class="kpi"><div class="k">상품 수</div><div class="v">${rows.length.toLocaleString()}</div><div class="s">원가 있음 ${withCost.length.toLocaleString()}개</div></div>
    <div class="kpi"><div class="k">28일 매출 합</div><div class="v">${man(sales)}<span class="cap"> 만원</span></div><div class="s">~${esc(state.meta?.sales_last_day || '')} · 출고일 기준</div></div>
    <div class="kpi"><div class="k">원가율 중앙값</div><div class="v">${pct(med(withCost.map(p => p.cost_ratio)))}</div><div class="s">원가 ÷ (정가/1.1)</div></div>
    <div class="kpi"><div class="k">최대 할인 중앙값</div><div class="v">${pct(med(withCost.map(p => p.max_discount)))}</div><div class="s">할인 후 원가율 ${pct(state.target)} 기준</div></div>
    <div class="kpi ${tight ? 'warn' : ''}"><div class="k">할인 여력 20% 미만</div><div class="v">${tight}</div><div class="s">[조합 추천]에서 짝을 찾아 보세요</div></div>`;
}

async function openDetail(seq) {
  $$('#prodTable tr.sel').forEach(t => t.classList.remove('sel'));
  $(`#prodTable tr[data-seq="${seq}"]`)?.classList.add('sel');
  openSheet('<div class="empty"><span class="spin"></span></div>');
  let p;
  try { p = await api(`/api/product/${encodeURIComponent(seq)}`); } catch (e) { openSheet(`<div class="err-box">${esc(e.message)}</div>`); return; }
  const md = maxDiscount(p.price, p.cost);
  const comps = (p.components || []).map(c => `<tr><td>${esc(c.name || c.sap)}</td><td class="num">${c.cost === null || c.cost === undefined ? '<span class="tag miss">없음</span>' : won(c.cost)}</td></tr>`).join('');
  const hist = (p.history || []).slice(0, 15).map(h => `<tr><td>${esc(h.promo)}</td><td>${h.type === '하루특가' ? '특가' : esc(h.type)}</td><td class="num">${mmdd(h.start)}${h.end && h.end !== h.start ? '~' + mmdd(h.end) : ''}</td><td class="num">${pct(h.rate)}</td><td class="num">${h.promo_qty === null || h.promo_qty === undefined ? '-' : qty(h.promo_qty)}</td><td class="num">${h.lift ? h.lift.toFixed(1) + '배' : '-'}</td><td class="num ${h.cost_ratio_after > state.target ? 'over' : ''}">${pct(h.cost_ratio_after)}</td></tr>`).join('');
  const defRate = Math.round(Math.max(0.1, Math.min(0.5, p.last_promo_rate || 0.2)) * 100);
  openSheet(`<button class="btn ghost x" data-close-sheet>닫기 ✕</button>
    <h2>${esc(p.name)}</h2><div class="cap">SEQ ${p.seq} · ${esc(p.category || '')} · ${esc(p.product_type || '')} ${prodTags(p)}</div>
    <div class="kpis mt10">
      <div class="kpi"><div class="k">정가</div><div class="v">${won(p.price)}</div><div class="s">원가 ${won(p.cost)} · 원가율 ${pct(p.cost_ratio)}</div></div>
      <div class="kpi ${md !== null && md < 0.2 ? 'warn' : 'ok'}"><div class="k">최대 할인</div><div class="v">${md === null ? '-' : md <= 0 ? '없음' : pct(md)}</div><div class="s">할인 후 원가율 ${pct(state.target)} 기준</div></div>
      <div class="kpi"><div class="k">최근 28일</div><div class="v">${man(p.sales_28)}<span class="cap">만</span></div><div class="s">${qty(p.qty_28)}개 ${delta(p.growth_28)}</div></div>
    </div>
    <div class="sim">
      <div class="row"><b class="sm">할인 시뮬레이션</b><span class="grp" id="simType"><button class="chip on" data-t="상시">상시</button><button class="chip" data-t="하루특가">하루특가</button></span><span class="grow"></span><b id="simRateTxt">${defRate}%</b></div>
      <input type="range" id="simRate" min="5" max="60" step="1" value="${defRate}">
      <div class="res" id="simRes"></div>
      <div class="cap mt8" id="simExp"></div>
      <div class="row wrap mt8">
        <button class="btn sm primary" data-add="상시" title="작업 중 기획안의 구좌 상품으로, 위 할인율로">구좌 상품으로 (상시 할인)</button>
        <button class="btn sm" data-add="큐레이션" title="할인 없이 구좌에 놓아요 (PROMO_WORK 큐레이션)">구좌 상품으로 (할인 없음)</button>
        <button class="btn sm" data-add="하루특가" title="하루특가 후보로. 날짜는 하루특가 편성에서 정해요">하루특가 후보로</button>
        <button class="btn sm ghost" data-pool="1" title="역할은 나중에 정해요">역할은 나중에</button>
        ${md !== null && md < 0.25 ? '<button class="btn sm" id="detToBundle">묶을 짝 보기</button>' : ''}
      </div>
    </div>
    <dl class="kv">
      <dt>마지막 행사</dt><dd>${p.last_promo ? `${esc(p.last_promo)} ${esc(p.last_promo_type || '')} ${pct(p.last_promo_rate)} · ${daysAgo(p.days_since_promo)}` : '2025-09 이후 행사 없음'}</dd>
      <dt>역대 최대 할인</dt><dd>${pct(p.max_rate)} · 하루특가 중앙 ${pct(p.daily_deal_rate_median)}</dd>
      ${p.upcoming?.length || p.running?.length ? `<dt>진행·예정</dt><dd>${promoBadges(p)}</dd>` : ''}
      ${p.note ? `<dt>원가 비고</dt><dd>${esc(p.note)}</dd>` : ''}
      ${p.reviews ? `<dt>고객 리뷰</dt><dd>최근 ${p.reviews.n}건 · 평점 ${p.reviews.avg ? p.reviews.avg.toFixed(1) : '-'}${p.reviews.gift ? ` · 선물 언급 ${p.reviews.gift}` : ''}${p.reviews.repeat ? ` · 재구매 언급 ${p.reviews.repeat}` : ''}${p.reviews.low ? ` · <span class="over">평점 3 이하 ${p.reviews.low}</span>` : ''}${p.reviews.quotes.length ? `<div class="cap">“${esc(p.reviews.quotes[0])}”</div>` : ''}</dd>` : ''}
      <dt>작년 이맘때</dt><dd>${p.ly_next28 ? `${man(p.ly_next28)}만원 <span class="mute">(앞으로 4주에 해당하는 작년 4주)</span>` : '<span class="mute">작년 같은 기간 판매 없음</span>'}</dd>
      ${p.stock_ref ? `<dt>재고(참고)</dt><dd>${qty(p.stock_ref)}개 <span class="mute">상품장 전 채널·월마감: 기획 계산에는 쓰지 않음</span></dd>` : ''}
    </dl>
    ${responseCard(p.response)}
    <h3>최근 90일 일별 판매 수량</h3>${spark(p.daily_qty, 410, 54)}
    <h3>구성 원가</h3><table class="mini"><thead><tr><th>구성품</th><th class="num">원가</th></tr></thead><tbody>${comps || '<tr><td colspan="2" class="mute">구성 정보 없음</td></tr>'}</tbody></table>
    <h3>지난 행사 성과 <span class="cap">수량 = 세팅 할인율과 같은 판매, 종료 다음 날까지</span></h3>
    <table class="mini"><thead><tr><th>행사</th><th>유형</th><th class="num">기간</th><th class="num">할인</th><th class="num">수량</th><th class="num">평소 대비</th><th class="num">원가율</th></tr></thead><tbody>${hist || '<tr><td colspan="7" class="mute">이력 없음</td></tr>'}</tbody></table>`,
  sheet => {
    let simType = '상시', seqNow = 0;
    // 숫자는 서버(engine.simulate_single) 한 곳에서 계산 — 화면은 표시만
    const sim = debounce(async () => {
      const r = +$('#simRate', sheet).value / 100, my = ++seqNow;
      let x;
      try { x = await api(`/api/simulate?seq=${encodeURIComponent(p.seq)}&rate=${r}&type=${encodeURIComponent(simType)}`); } catch (e) { $('#simRes', sheet).innerHTML = `<span class="over">${esc(e.message)}</span>`; return; }
      if (my !== seqNow) return;
      const cra = x.cost_ratio_after ?? null;
      $('#simRes', sheet).innerHTML = `<span>할인가 <b>${won(x.sale_price)}</b>원</span>
        <span>할인 후 원가율 <b class="${cra > state.target ? 'over' : 'good'}">${pct(cra)}</b></span>
        <span>개당 이익 <b>${won(x.unit_profit)}</b>원 <span class="mute">(정가 ${won(x.regular_unit_profit)})</span></span>
        <span>${cra === null ? '<span class="mute">원가 없음</span>' : cra > state.target ? '<span class="status warn">! 원가율 45% 넘음(참고)</span>' : '<span class="status ok">✓ 원가율 45% 이내</span>'}</span>`;
      $('#simExp', sheet).innerHTML = x.base_daily_qty ? `하루 예상 ${qty(x.daily_qty)}개 · 매출 ${man(x.daily_sales)}만원 · 이익 ${man(x.daily_profit)}만원: 평소 하루 ${x.base_daily_qty.toFixed(1)}개 × ${simType === '하루특가' ? `하루특가 반응도 ${x.lift.toFixed(1)}배(과거 중앙값)` : '상시 1.0배 가정'} (참고치)` : '최근 28일 판매가 없어 예상치를 낼 수 없어요';
    }, 120);
    const showRate = () => { $('#simRateTxt', sheet).textContent = `${$('#simRate', sheet).value}%`; };
    $('#simRate', sheet).addEventListener('input', () => { showRate(); sim(); }); sim();
    $('#simType', sheet).addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; simType = b.dataset.t; sheet.querySelectorAll('#simType .chip').forEach(c => c.classList.toggle('on', c === b)); sim(); });
    sheet.querySelector('[data-pool]')?.addEventListener('click', () => emit('am:pool-add', { seq: String(p.seq), source: '상품 화면' }));
    sheet.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
      emit('plan:add', { seq: String(p.seq), type: b.dataset.add, rate: +$('#simRate', sheet).value / 100 });
      
    }));
    $('#detToBundle', sheet)?.addEventListener('click', () => { closeSheet(); emit('bundle:focus', { seq: String(p.seq) }); });
    applyBars(sheet);
  });
}


// 할인 반응 카드: 이 상품의 지난 하루특가 반응(할인 구간별) vs 같은 카테고리 곡선 → 다음 할인 제안(규칙)
function responseCard(r) {
  if (!r) return '';
  const bands = ['~25%', '26~30%', '31~35%', '36~40%', '41%~'];
  const own = Object.fromEntries((r.own || []).map(x => [x.band, x]));
  const cat = r.category_curve || {};
  const mx = Math.max(1, ...bands.map(b => Math.max(own[b]?.lift || 0, cat[b]?.lift || 0)));
  return `<h3>할인 반응: 다음엔 몇 %?</h3>
    <div class="resp">
      <table class="lever"><thead><tr><th>할인</th><th>이 상품</th><th class="num"></th><th>${esc(r.category || '카테고리')} 평균</th><th class="num"></th></tr></thead><tbody>
      ${bands.map(b => `<tr><th>${b}</th>
        <td class="barc"><span class="bar"><i data-w="${(own[b]?.lift || 0) / mx}"></i></span></td><td class="num">${own[b] ? `<b>${own[b].lift.toFixed(1)}배</b> <span class="cap">${own[b].n}건</span>` : '<span class="mute">-</span>'}</td>
        <td class="barc"><span class="bar ghostbar"><i data-w="${(cat[b]?.lift || 0) / mx}"></i></span></td><td class="num">${cat[b] ? `${cat[b].lift.toFixed(1)}배 <span class="cap">${cat[b].n}</span>` : '<span class="mute">-</span>'}</td></tr>`).join('')}
      </tbody></table>
      <ul class="tips">${(r.tips || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="cap">평소 하루 ${r.base_qty !== null && r.base_qty !== undefined ? r.base_qty.toFixed(1) + '개' : '-'} (${esc(r.base_src || '')}) · 원가율: 30% ${pct(r.cost_ratio_at?.['30'])} · 36% ${pct(r.cost_ratio_at?.['36'])} · 40% ${pct(r.cost_ratio_at?.['40'])}</div>
      <div class="cap">${esc(r.note || '')}</div>
    </div>`;
}
