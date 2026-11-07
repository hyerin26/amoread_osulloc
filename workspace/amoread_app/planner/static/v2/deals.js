// ================= 예시 데이터 (가상, 구좌 편집 목업과 같은 상품) =================
// 기획안을 열면(?id=) loadPlan이 아래 예시 값을 실제 상품·이 기획안의 행으로 바꾼다 (LIVE)
const TARGET = 0.45;   // 서버 config.TARGET_COST_RATIO 기본값과 같음
let PERIOD = ['2026-03-02', '2026-03-15'];
// base = 평소 하루 판매 수량(행사 없는 날, 가상), last = 마지막 행사 (가상)
const P = {
  P101: { name: '벚꽃 블렌딩 티 10입', price: 18000, cost: 4300, base: 6, days: 210, last: '봄맞이 티 컬렉션 (2025.03) · 20%' },
  P102: { name: '피크닉 콜드브루 티 세트', price: 32000, cost: 9800, base: 3, days: 95, last: '여름 티캉스 (2025.07) · 25%' },
  P104: { name: '봄 꽃차 3종 선물 세트', price: 28000, cost: 8900, base: 4, days: 33, last: '감사선물전 (2026.04) · 15%' },
  P105: { name: '스틱 아이스티 20입', price: 12000, cost: 2900, base: 9, days: 150, last: '여름 990원딜 (2025.06) · 30%' },
  P106: { name: '말차 라떼 파우더', price: 15000, cost: 5200, base: 11, days: 20, last: '멤버십 리뉴얼 (2026.08) · 10%' },
  P107: { name: '은은한 녹차 티백 40입', price: 22000, cost: 4800, base: 5, days: 300, last: '가을 차회 (2025.10) · 25%' },
  P108: { name: '무카페인 허브 블렌드', price: 19000, cost: 4500, base: 4, days: 180, last: '허브티 출시 (2025.09) · 33%' },
  P109: { name: '달콤한 과일 티 세트', price: 26000, cost: 7400, base: 3, days: 60, last: '블랙 프라이데이 (2026.11) · 30%' },
  P110: { name: '프리미엄 티 기프트 박스', price: 58000, cost: 21800, base: 2, days: 75, last: '설 선물 얼리버드 (2026.01) · 28%' },
};
// 이 기획안의 할인 상품 (상품·할인 공간 = 구좌 편집과 같은 값 하나). where = 구좌 편집에서 놓인 곳 (자동)
let items = [
  { seq: 'P101', type: '상시', rate: 0.2, s: PERIOD[0], e: PERIOD[1], appeal: '봄에만 만나는 벚꽃 향', clear: false, where: ['01 첫 잔, 벚꽃'] },
  { seq: 'P104', type: '상시', rate: 0.15, s: PERIOD[0], e: PERIOD[1], appeal: '(재구매 1위) 받는 분도 좋아하는 꽃차', clear: false, where: ['01 첫 잔, 벚꽃', '03 먼저 마셔 본 후기'] },
  { seq: 'P106', type: '상시', rate: 0.1, s: PERIOD[0], e: PERIOD[1], appeal: '', clear: false, where: ['01 첫 잔, 벚꽃', '03 먼저 마셔 본 후기'] },
  { seq: 'P107', type: '상시', rate: 0.25, s: PERIOD[0], e: PERIOD[1], appeal: '매일 마시기 좋은 기본 녹차', clear: false, where: ['02 가격대별 선물 추천 · 1만원대'] },
  { seq: 'P110', type: '상시', rate: 0.24, s: PERIOD[0], e: PERIOD[1], appeal: '세작부터 블렌딩까지 담은', clear: false, where: ['02 가격대별 선물 추천 · 3만원 이상'] },
  { seq: 'P105', type: '상시', rate: 0.15, s: PERIOD[0], e: '2026-03-08', appeal: '', clear: false, where: [] },
  { seq: 'P108', type: '할인 없음', rate: 0, s: PERIOD[0], e: PERIOD[1], appeal: '', clear: false, where: [] },
  { seq: 'P109', type: '상시', rate: 0.4, s: PERIOD[0], e: PERIOD[1], appeal: '과일 향 가득한 피크닉 티', clear: false, where: [] },   // 한 번에 낮추기로 고칠 수 있는 예시 (P110은 5% 미만이라 묶음으로)
];
let extras = [{ id: 'x1', name: '얼리버드', calc: 'sale_pct', val: 5, seqs: ['P110', 'P104'], s: PERIOD[0], e: '2026-03-05' }];
// 하루특가: 날짜 × 자리. 월·화·수 (블프 '월/수 특가' 같은 요일 리듬, 예시)
let DEAL_DATES = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-09', '2026-03-10', '2026-03-11'];
let slotsPerDay = 4;
let deals = { '2026-03-02': [['P102', 0.35], ['P109', 0.3], ['P101', 0.4]], '2026-03-03': [['P105', 0.4]], '2026-03-04': [['P107', 0.4], ['P108', 0.35], ['P106', 0.3], ['P109', 0.35], ['P102', 0.3]] };
let pool = [{ seq: 'P102', src: '브리프 키워드 · 보온병' }, { seq: 'P105', src: '리뷰 · 재구매 언급' }];
let dealCands = [];   // 하루특가 후보로 보낸 상품 (채우기 목록에서 먼저)

// ================= 기획안 잇기 (LIVE): 실제 상품 + 이 기획안의 할인 행·후보 상품 =================
let LIVE = false, keepRows = [], keepPool = [], keepCands = [], lastSaved = '';
const realP = p => ({ name: p.name, price: p.price, cost: p.cost || 0, base: p.base_qty ?? (p.qty_28 || 0) / 28, days: p.days_since_promo ?? '-',
  last: p.last_promo ? `${p.last_promo} (${String(p.last_promo_start || '').slice(0, 7).replace('-', '.')}) · ${Math.round((p.last_promo_rate || 0) * 100)}%` : '지난 행사 없음', real: p });
function comboOf(list) {   // 행의 items(구성품) → 조합 상품 하나
  const seqs = list.map(x => String(x.seq)).filter(q => P[q]);
  if (seqs.length !== list.length || !seqs.length) return null;
  const id = `C${++comboN}`;
  P[id] = { name: seqs.map(q => P[q].name).join(' + '), price: seqs.reduce((a, q) => a + P[q].price, 0), cost: seqs.reduce((a, q) => a + P[q].cost, 0),
    base: Math.min(...seqs.map(q => P[q].base)), days: 0, last: '신규 조합 (SEQ 없음)', combo: seqs, items: list };
  CAT[id] = '조합';
  return id;
}
function loadPlan(doc, prods) {
  for (const k of Object.keys(P)) delete P[k];
  for (const k of Object.keys(CAT)) delete CAT[k];
  prods.forEach(p => { if (p.seq && p.price) { P[String(p.seq)] = realP(p); CAT[String(p.seq)] = p.category || '기타'; } });
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), add = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
  PERIOD = doc.brief?.period ? [doc.brief.period.start, doc.brief.period.end] : [today, add(today, 13)];
  const span = new Set(Array.from({ length: Math.min(31, days(PERIOD[0], PERIOD[1])) }, (_, i) => add(PERIOD[0], i)));
  items = []; deals = {}; extras = []; keepRows = [];
  for (const r of doc.promo_rows || []) {
    const seq = r.items?.length ? comboOf(r.items) : String(r.seq || '');
    if (!seq || !P[seq]) { keepRows.push(r); continue; }   // 화면에 못 그리는 행도 저장할 때 그대로 돌려놓음
    if (r.type === '하루특가') { (deals[r.start] ||= []).push([seq, r.rate || 0, r]); span.add(r.start); continue; }
    items.push({ seq, type: r.type === '큐레이션' ? '할인 없음' : P[seq].combo ? '조합' : '상시', rate: r.type === '큐레이션' ? 0 : r.rate || 0,
      s: r.start || PERIOD[0], e: r.end || PERIOD[1], appeal: r.appeal || '', clear: !!r.clearance, where: [], row: r });
  }
  DEAL_DATES = [...span].sort();
  pool = (doc.pool || []).filter(x => x.seq && P[x.seq]).map(x => ({ seq: String(x.seq), src: x.source || '후보', memo: x.memo || '' }));
  keepPool = (doc.pool || []).filter(x => !(x.seq && P[x.seq]));
  dealCands = (doc.deal_plan?.candidates || []).filter(x => x.seq && P[x.seq]).map(x => String(x.seq));
  keepCands = (doc.deal_plan?.candidates || []).filter(x => !(x.seq && P[x.seq]));
  slotsPerDay = doc.deal_plan?.slots || 4;
  sel = items[0]?.seq || null; tab = 'items'; LIVE = true;
  document.querySelector('.head h1').textContent = doc.title;
  document.querySelector('.demo').innerHTML = '<b>이 기획안의 실제 상품이에요.</b> 정가·원가·평소 판매·마지막 행사·이미 잡힌 행사는 실제 값이고, 고치면 이 기획안에 저장돼요. <b>할인 깊이별 반응·예상 매출·리뷰·지난 행사 할인 기준은 아직 예시</b>예요. 추가 혜택은 아직 저장되지 않아요.';
  lastSaved = snapshot();
}
const rowItems = q => P[q].combo ? (P[q].items || P[q].combo.map(s => ({ seq: s, qty: 1 }))) : null;
function toRows() {
  const promo = (PLAN.doc.title || '').slice(0, 60), blank = { promo, category_tag: '', memo: '', appeal: '', clearance: false };
  const rows = items.map(i => ({ ...blank, ...i.row, type: i.type === '할인 없음' ? '큐레이션' : '상시', start: i.s, end: i.e,
    seq: P[i.seq].combo ? null : i.seq, items: rowItems(i.seq), rate: i.type === '할인 없음' ? 0 : i.rate, appeal: i.appeal.slice(0, 80), clearance: i.clear }));
  for (const d of Object.keys(deals).sort()) for (const [q, r, row] of deals[d]) rows.push({ ...blank, ...row, type: '하루특가', start: d, end: d, seq: P[q].combo ? null : q, items: rowItems(q), rate: r });
  return rows.concat(keepRows).slice(0, 500);
}
const snapshot = () => JSON.stringify([toRows(), pool, dealCands, slotsPerDay]);
function persist() {
  if (!LIVE) return;
  const s = snapshot(); if (s === lastSaved) return; lastSaved = s;
  PLAN.save(d => {
    d.promo_rows = toRows();
    d.pool = pool.map(x => ({ seq: x.seq, items: null, memo: String(x.memo || '').slice(0, 200), source: String(x.src || '').slice(0, 40) })).concat(keepPool).slice(0, 100);
    d.deal_plan = { ...(d.deal_plan || {}), slots: slotsPerDay, candidates: dealCands.map(seq => ({ seq, items: null, rate: null, memo: '' })).concat(keepCands).slice(0, 100) };
  });
}
// 상품 찾아 담기 (이름 일부 또는 SEQ). 판매 중인 상품 먼저, 최근 28일 매출순
function searchDrawer() {
  return `<div class="dh"><div class="grow"><div class="overline">상품 찾아 담기</div><h2 id="drH">이름이나 SEQ로 찾아요</h2><span class="cap">전체 ${Object.keys(P).filter(q => !P[q].combo).length}개 상품 · 판매 중인 상품 먼저, 최근 28일 매출순 · 30개까지</span></div><button class="btn sm" data-close>닫기</button></div>
  <div class="db"><input type="search" id="pq" value="${esc(drawer.q)}" maxlength="40" placeholder="예) 녹차, 1461" aria-label="상품 이름 또는 SEQ"><div id="pres" aria-live="polite">${searchResults()}</div></div>`;
}
function searchResults() {
  const qq = drawer.q.replace(/\s/g, '').toLowerCase();
  if (!qq) return '<p class="hint">상품 이름 일부나 SEQ를 넣어 주세요.</p>';
  const act = q => (P[q].real?.active ? 1 : 0);
  const hit = Object.keys(P).filter(q => !P[q].combo && (q.startsWith(qq) || P[q].name.replace(/\s/g, '').toLowerCase().includes(qq)))
    .sort((a, b) => act(b) - act(a) || (P[b].real?.sales_28 || 0) - (P[a].real?.sales_28 || 0)).slice(0, 30);
  if (!hit.length) return '<p class="hint">맞는 상품이 없어요.</p>';
  return `<div class="pool">${hit.map(q => { const p = P[q], has = itemOf(q) ? '할인 상품' : pool.some(x => x.seq === q) ? '후보 상품' : '';
    return `<div class="pitem"><span><b>${pname(q)}</b> <span class="cap">${q}</span> ${p.real && !p.real.active ? '<span class="tag off">판매 안 함</span>' : ''}</span>
      <span class="meta">${esc(CAT[q])} · 정가 ${won(p.price)} · ${p.cost ? `기준 안 최대 ${maxRate(q)}%` : '원가 없음'} · 최근 28일 ${man(p.real?.sales_28 || 0)}원</span>
      <span class="acts">${has ? `<span class="tag">이 기획안 ${has}에 있어요</span>` : `<button class="btn xs primary" data-sadd="${q}|item">할인 상품에</button><button class="btn xs" data-sadd="${q}|pool">후보로 (역할은 나중에)</button>`}</span></div>`; }).join('')}</div>`;
}

// ================= 계산 (구좌 편집과 같은 규칙) =================
const r10 = n => Math.round(n / 10) * 10;
const won = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
const man = n => `${Math.round(n / 10000).toLocaleString('ko-KR')}만`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const md = d => `${+d.slice(5, 7)}/${+d.slice(8)}`;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
let drafts = {};
const itemOf = seq => items.find(i => i.seq === seq);
const rateOf = seq => seq in drafts ? drafts[seq] : (itemOf(seq)?.rate ?? 0);
const extraOf = seq => extras.find(x => x.seqs.includes(seq)) || null;
function priceOf(seq, rate = rateOf(seq), ex = extraOf(seq)) {
  const p = P[seq], first = r10(p.price * (1 - rate));
  const fin = !ex ? first : ex.calc === 'sale_pct' ? r10(first * (1 - ex.val / 100)) : ex.calc === 'won' ? Math.max(0, first - ex.val) : r10(Math.min(first, p.price * (1 - ex.val / 100)));
  return { list: p.price, first, fin, ex, pct: Math.round((1 - fin / p.price) * 100) };
}
const craOf = (seq, fin) => P[seq].cost / (fin / 1.1);
function judge(seq, pr = priceOf(seq)) {
  if (pr.fin >= pr.list) return { lv: 'none', t: '할인 없음' };
  if (!P[seq].cost) return { lv: 'none', t: '원가 없음' };   // 원가가 없는 실제 상품: 판정하지 않음
  if (1 - pr.fin / pr.list >= 0.8) return { lv: 'err', t: '확인 필요' };
  return craOf(seq, pr.fin) > TARGET ? { lv: 'warn', t: '주의' } : { lv: 'ok', t: '괜찮음' };
}
// 기준 안 가장 깊은 1단 할인 (%), 추가 혜택 포함
function maxRate(seq) { for (let r = 80; r >= 0; r--) { if (craOf(seq, priceOf(seq, r / 100).fin) <= TARGET) return r; } return 0; }
// 반응(평소 대비 판매 배수): 지난 실적의 할인 깊이별 중앙값을 흉내 낸 예시 표 (지금 툴 lift_by_rate 자리)
const LIFT = [[0.1, 1.1], [0.2, 1.4], [0.3, 1.8], [0.4, 2.4], [0.5, 2.9]];
const bucketOf = pct => { const k = LIFT.findIndex(([r]) => pct / 100 <= r); return k < 0 ? LIFT.length - 1 : k; };
const liftOf = pct => pct <= 0 ? 1 : LIFT[bucketOf(pct)][1];
// 예상 매출(참고): 평소 하루 수량 × 반응 × 일수 × 최종가, 범위는 ±25% (지금 툴: 평소 판매 × 요일 × 반응, 하위~상위 25%)
function forecast(it) { const pr = priceOf(it.seq), q = P[it.seq].base * liftOf(pr.pct) * days(it.s, it.e), v = q * pr.fin; return [v * 0.75, v * 1.25]; }

// ================= 묶음(조합) =================
// 지금 툴 engine.recommend_bundles·suggest_partners와 같은 규칙 (예시 데이터로):
// 기준 = 원가가 높아 혼자서는 목표 할인을 못 하는 잘 팔리는 상품 / 짝 = 전체 상품 중 기준보다 싸고, 묶으면 목표 할인이 기준 안에서 되는 상품
// 짝 순서 = 최근 매출 + 다른 카테고리 0.3 + 같은 계열 0.25 − 이미 다른 기준에 추천된 만큼 0.35 / 제안 할인 = 묶음 최대를 5% 단위로 내림, 35% 넘지 않게
const CAT = { P101: '티백', P102: '선물 세트', P104: '선물 세트', P105: '티백', P106: '파우더', P107: '티백', P108: '티백', P109: '선물 세트', P110: '선물 세트' };
const FAMS = ['말차', '벚꽃', '녹차', '허브', '과일', '꽃차', '콜드브루'];
const famOf = name => FAMS.filter(f => name.includes(f));
const floor5 = m => Math.floor(m / 5) * 5;
const salesOf = q => P[q].base * P[q].price;   // 최근 매출 자리 (가상)
const realSeqs = () => Object.keys(P).filter(q => !P[q].combo && (!LIVE || (P[q].cost && P[q].real.active)));   // 실제 상품: 원가 있고 판매 중인 것만 묶음 후보
// 묶음 최대 할인(기준 안): 정가 합·원가 합으로 (지금 툴 max_discount와 같은 식)
function comboMax(seqs) { const pr = seqs.reduce((a, q) => a + P[q].price, 0), co = seqs.reduce((a, q) => a + P[q].cost, 0); return Math.max(0, Math.floor((1 - co * 1.1 / TARGET / pr) * 100)); }
let bundle = { rate: 25, cat: '', planFirst: true, base: null, calc: [], calcRate: 25 };
function recommend() {
  const T = bundle.rate, inPlan = q => items.some(i => i.seq === q) || pool.some(x => x.seq === q);
  let bases = bundle.base ? [bundle.base] : realSeqs().filter(q => comboMax([q]) < T && (!bundle.cat || CAT[q] === bundle.cat));
  bases.sort((a, b) => (bundle.planFirst ? inPlan(b) - inPlan(a) : 0) || salesOf(b) - salesOf(a));
  const used = {}, out = [];
  for (const b of bases.slice(0, 6)) {
    let parts = realSeqs().filter(q => q !== b && P[q].price <= P[b].price && comboMax([b, q]) >= T).map(q => ({ q, max: comboMax([b, q]) }));
    const top = Math.max(1, ...parts.map(x => salesOf(x.q)));
    parts.forEach(x => {
      const fam = famOf(P[b].name).filter(f => P[x.q].name.includes(f)), other = CAT[x.q] !== CAT[b];
      x.score = salesOf(x.q) / top + (other ? 0.3 : 0) + (fam.length ? 0.25 : 0) - 0.35 * (used[x.q] || 0);
      x.rate = Math.min(35, floor5(x.max));
      x.why = [fam.length && `같은 계열(${fam.join(', ')})`, other && `${CAT[b]}+${CAT[x.q]} 함께 쓰기`, `짝 최근 매출 ${man(salesOf(x.q) * 28)}원`].filter(Boolean).join(' · ');
    });
    parts.sort((a, c) => c.score - a.score); parts = parts.slice(0, 3); parts.forEach(x => { used[x.q] = (used[x.q] || 0) + 1; });
    out.push({ b, solo: comboMax([b]), inPlan: inPlan(b), parts });
  }
  return out;
}
let comboN = 0;
function addCombo(seqs, ratePct) {
  const id = `C${++comboN}`;
  P[id] = { name: seqs.map(q => P[q].name).join(' + '), price: seqs.reduce((a, q) => a + P[q].price, 0), cost: seqs.reduce((a, q) => a + P[q].cost, 0),
    base: Math.min(...seqs.map(q => P[q].base)), days: 0, last: '신규 조합 (SEQ 없음)', combo: seqs };
  CAT[id] = '조합';
  items.push({ seq: id, type: '조합', rate: ratePct / 100, s: PERIOD[0], e: PERIOD[1], appeal: '', clear: false, where: [] });
  tab = 'items'; sel = id; render(); toast(`조합을 할인 상품에 넣었어요 (${ratePct}%). SEQ가 없어 PROMO_WORK 엑셀에서는 '신규조합 제안' 시트로 나가요`);
}
function bundleTab() {
  const recs = recommend(), cats = [...new Set(realSeqs().map(q => CAT[q]))];
  const head = bundle.base ? `<div class="lever">기준 상품: <b>${esc(P[bundle.base].name)}</b> · 혼자서는 기준 안 최대 ${comboMax([bundle.base])}% <button class="btn xs" data-bn="">전체 추천으로</button></div>` : '';
  const card = r => `<section class="card bcard"><div class="bh"><div><span class="cap">기준 상품${r.inPlan ? ' · 이 기획안' : ''}</span><b>${esc(P[r.b].name)}</b></div><span class="cap">혼자서는 기준 안 최대 ${r.solo}% · 정가 ${won(P[r.b].price)}</span></div>
    ${r.parts.length ? `<div class="bparts">${r.parts.map(x => { const sp = r10((P[r.b].price + P[x.q].price) * (1 - x.rate / 100)), cra = (P[r.b].cost + P[x.q].cost) / (sp / 1.1);
      return `<div class="bp"><span class="pn">+ <b>${esc(P[x.q].name)}</b><span class="cap">${esc(x.why)}</span></span>
        <span class="num">정가 합 ${won(P[r.b].price + P[x.q].price)}<br><b class="pp">${x.rate}% ${won(sp)}</b><br><span class="cap">원가율 ${Math.round(cra * 100)}% · 묶음 최대 ${x.max}%</span></span>
        <span class="acts"><button class="btn xs primary" data-bpick="${r.b}|${x.q}|${x.rate}">할인 상품에 넣기</button><button class="btn xs" data-bcalc="${r.b}|${x.q}|${x.rate}">계산기에서 고치기</button></span></div>`; }).join('')}</div>`
      : `<p class="hint">목표 ${bundle.rate}%를 기준 안에서 맞출 짝이 없어요. 목표 할인을 낮춰 보세요.</p>`}</section>`;
  const calc = bundle.calc, sumP = calc.reduce((a, q) => a + P[q].price, 0), sumC = calc.reduce((a, q) => a + P[q].cost, 0), sp = r10(sumP * (1 - bundle.calcRate / 100)), cra = calc.length ? sumC / (sp / 1.1) : 0, cm = calc.length ? comboMax(calc) : 0;
  const calcBox = `<section class="card" id="calcBox"><h2>직접 만들기 <span class="hint">상품을 골라 정가 합·원가율·할인가를 바로 계산해요</span></h2>
    <div class="filters"><select id="calcSel" aria-label="담을 상품">${realSeqs().filter(q => !calc.includes(q)).map(q => `<option value="${q}">${esc(P[q].name)} · ${won(P[q].price)}</option>`).join('')}</select><button class="btn xs" data-calcadd>담기</button></div>
    ${calc.length ? `<ul class="mini calc">${calc.map((q, k) => `<li><b>${esc(P[q].name)}</b><span class="cap">정가 ${won(P[q].price)} · 원가율 ${Math.round(P[q].cost / (P[q].price / 1.1) * 100)}%</span><button class="btn xs ghost" data-calcrm="${k}">빼기</button></li>`).join('')}</ul>
      <div class="kv"><span>정가 합</span><span>${won(sumP)}</span><span>할인율</span><span><input type="number" id="calcRate" min="0" max="80" value="${bundle.calcRate}" aria-label="묶음 할인율">%</span>
        <span>할인가</span><span class="pp">${won(sp)}</span><span>할인 후 원가율</span><span><b class="${cra > TARGET ? 'cra warn' : ''}">${Math.round(cra * 100)}%</b> (기준 ${Math.round(TARGET * 100)}%)</span><span>기준 안 최대</span><span>${cm}%</span></div>
      <div><button class="btn sm primary" data-calcput ${calc.length < 2 ? 'disabled' : ''}>할인 상품에 넣기</button> <span class="hint">${calc.length < 2 ? '두 개 이상 담아 주세요' : ''}</span></div>` : '<p class="hint">위에서 상품을 담거나, 추천 묶음의 [계산기에서 고치기]를 눌러 주세요.</p>'}</section>`;
  return `<div class="filters"><span class="cap">목표 할인</span><select data-bset="rate" aria-label="목표 할인율">${[20, 25, 30, 35].map(r => `<option value="${r}" ${bundle.rate === r ? 'selected' : ''}>${r}%</option>`).join('')}</select>
      <span class="cap">카테고리</span><select data-bset="cat" aria-label="카테고리"><option value="">전체</option>${cats.map(c => `<option ${bundle.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <label class="ck"><input type="checkbox" data-bplan ${bundle.planFirst ? 'checked' : ''}> 이 기획안 상품 먼저</label><span class="grow"></span><span class="tag demo-t">지금 툴과 같은 규칙 · 예시 데이터</span></div>
    ${head}<div class="blist">${recs.length ? recs.map(card).join('') : '<p class="hint">이 조건에서 혼자 할인하기 어려운 상품이 없어요.</p>'}</div>${calcBox}`;
}

// ================= 그리기 =================
let tab = 'items', sel = 'P110', where = 'all', onlyWarn = false, fillDay = null;
const $ = s => document.querySelector(s);
function renderSum() {
  const warn = items.filter(i => judge(i.seq).lv === 'warn').length, f = items.reduce((a, i) => [a[0] + forecast(i)[0], a[1] + forecast(i)[1]], [0, 0]);
  const dn = DEAL_DATES.reduce((a, d) => a + (deals[d] || []).length, 0);
  $('#sum').innerHTML = `<span><span class="k">할인 상품</span><b>${items.length}</b></span><span><span class="k">하루특가</span><b>${DEAL_DATES.length}일 × ${slotsPerDay}자리</b> (${dn}/${DEAL_DATES.length * slotsPerDay} 채움)</span>
    <span><span class="k">추가 혜택</span><b>${extras.length}</b></span><span class="${warn ? 'warn' : ''}"><span class="k">판정 주의</span><b>${warn}</b></span>
    <span><span class="k">예상 매출 (참고)</span><b>${man(f[0])}~${man(f[1])}원</b> <span class="hint">할인 상품만 · 지난 실적 관찰값, 약속 아님</span></span>`;
  const T = [['items', `할인 상품 ${items.length}`], ['deals', '하루특가'], ['extras', `추가 혜택 ${extras.length}`], ['bundle', '묶음(조합)'], ['pool', `후보 상품 ${pool.length}`]];
  $('#tabs').innerHTML = T.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${n}</button>`).join('');
}
function itemsTab() {
  const list = items.filter(i => (where === 'all' || (where === 'on' ? i.where.length : !i.where.length)) && (!onlyWarn || judge(i.seq).lv === 'warn'));
  const nD = Object.keys(drafts).length;
  const rows = list.map(i => {
    const p = P[i.seq], pr = priceOf(i.seq), j = judge(i.seq, pr), cra = pr.fin < pr.list ? craOf(i.seq, pr.fin) : null, f = forecast(i);
    return `<tr data-row="${i.seq}" aria-selected="${sel === i.seq}" tabindex="0">
      <td><span class="judge ${j.lv}">${j.t}</span></td>
      <td class="pn"><b>${p.combo ? esc(p.name) : pname(i.seq)}</b><span class="cap">${p.combo ? "SEQ 없음 · 엑셀 '신규조합 제안' 시트" : i.seq}</span></td>
      <td class="where">${i.where.length ? i.where.map(esc).join('<br>') : '<span class="tag off">페이지에 없음</span>'}</td>
      <td><span class="tag ${i.type === '상시' ? 'sangsi' : i.type === '조합' ? 'deal' : ''}">${i.type}</span></td>
      <td>${i.s === PERIOD[0] && i.e === PERIOD[1] ? '전체' : `${md(i.s)}~${md(i.e)}`}</td>
      <td class="num">${i.type === '할인 없음' ? '-' : `<input type="number" data-rate="${i.seq}" min="0" max="90" value="${Math.round(rateOf(i.seq) * 100)}" aria-label="${esc(p.name)} 1단 할인율">%${i.seq in drafts ? '<span class="draft">바꿈</span>' : ''}`}</td>
      <td>${pr.ex ? `<span class="tag">${esc(pr.ex.name)}</span>` : '-'}</td>
      <td class="num fin">${won(pr.fin)}<small>${pr.pct ? `정가 대비 ${pr.pct}%` : '정가'}</small></td>
      <td class="num"><span class="cra ${j.lv === 'warn' ? 'warn' : ''}">${cra == null ? '-' : `${Math.round(cra * 100)}%`}</span></td>
      <td class="num">${pr.pct ? `${liftOf(pr.pct)}배` : '-'}</td>
      <td class="num">${man(f[0])}~${man(f[1])}</td></tr>`;
  }).join('');
  return `<div class="lay"><section class="card">
      <div class="filters"><span class="cap">놓인 곳</span>${[['all', '전체'], ['on', '페이지에 있음'], ['off', '페이지에 없음']].map(([k, n]) => `<button class="chip" data-where="${k}" aria-pressed="${where === k}">${n}</button>`).join('')}
        <label class="ck"><input type="checkbox" data-onlywarn ${onlyWarn ? 'checked' : ''}> 주의만</label>
        ${fixable().length ? `<button class="btn xs" data-bulk title="원가율은 참고 지표예요. 필요할 때만 쓰세요">원가율 기준 넘는 ${fixable().length}개 낮추기</button>` : ''}<span class="grow"></span>
        ${LIVE ? '<button class="btn xs" data-search>+ 상품 찾아 담기</button>' : '<button class="btn xs" data-toast="예시예요: 상품을 찾아 할인 상품에 넣어요 (구좌 편집의 상품 고르기와 같은 창)">+ 상품 추가</button>'}</div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>판정</th><th>상품</th><th>놓인 곳</th><th>유형</th><th>기간</th><th class="num">1단 할인율</th><th>추가 혜택</th><th class="num">최종가</th><th class="num">원가율</th><th class="num">반응</th><th class="num">예상 매출(참고)</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="11" class="cap">조건에 맞는 상품이 없어요</td></tr>'}</tbody></table></div>
      <p class="hint">원가율 = 최종가(추가 혜택까지) 기준 할인 후 원가율. 반응 = 지난 실적에서 같은 할인 깊이일 때 평소 대비 판매 배수(관찰값, 인과 아님). 놓인 곳은 구좌 편집에서 자동으로 채워져요.</p>
      ${nD ? `<div class="applybar" role="status"><span class="grow">할인 ${nD}건을 바꿨어요. 반영하면 구좌 편집에도 같은 값이 들어가요</span><button class="btn xs" data-undo>되돌리기</button><button class="btn xs primary" data-apply>반영</button></div>` : ''}
    </section><aside class="card side" aria-live="polite">${evidence()}</aside></div>`;
}
function evidence() {
  const i = itemOf(sel); if (!i) return '<p class="hint">표에서 상품을 누르면 근거가 보여요.</p>';
  const p = P[i.seq], pr = priceOf(i.seq), j = judge(i.seq, pr), cra = pr.fin < pr.list ? craOf(i.seq, pr.fin) : null, m = maxRate(i.seq);
  const overlap = p.real ? [...(p.real.upcoming || []), ...(p.real.running || [])].filter(o => (o.start || '') <= PERIOD[1] && (o.end || '9') >= PERIOD[0])
      .map(o => `${o.promo || o.type || '행사'} (${o.start ? md(o.start) : ''}~${o.end ? md(o.end) : ''}) · ${Math.round((o.rate || 0) * 100)}%`)
    : i.seq === 'P110' ?['설 선물 얼리버드 재오픈 (3/1~3/7) · 25%'] : i.seq === 'P105' ? ['여름 준비 기획전 (3/9~) · 20%'] : [];
  return `<div><div class="overline">근거 · ${i.seq}</div><h3>${esc(p.name)}</h3>${p.combo ? '' : `<button class="btn xs" data-pd="${i.seq}">상품 상세</button>`}</div>
    <div class="kv"><span>정가</span><span>${won(p.price)}</span><span>1단 가격</span><span>${won(pr.first)} (${Math.round(rateOf(i.seq) * 100)}%)</span>
      ${pr.ex ? `<span>추가 혜택</span><span>${esc(pr.ex.name)} → ${won(pr.fin)}</span>` : ''}<span>판정</span><span><span class="judge ${j.lv}">${j.t}</span></span>
      <span>할인 후 원가율</span><span>${cra == null ? '-' : `<b>${Math.round(cra * 100)}%</b> (기준 ${Math.round(TARGET * 100)}%)`}</span>
      <span>기준 안 최대</span><span>${p.cost ? `1단 ${m}%${pr.ex ? ` (${esc(pr.ex.name)} 포함)` : ''}` : '원가 없음'}</span></div>
    ${j.lv === 'warn' && !i.clear ? `<div class="chips-row">${floor5(m) >= 5 ? `<button class="btn xs primary" data-lower="${i.seq}">${floor5(m)}%로 낮추기</button>` : ''}${!p.combo ? `<button class="btn xs" data-pair="${i.seq}">이 상품과 묶을 짝 보기</button>` : ''}</div>` : ''}
    ${p.combo ? `<div><h4>구성품</h4><ul class="mini">${p.combo.map(q => `<li>${esc(P[q].name)} · 정가 ${won(P[q].price)}</li>`).join('')}</ul></div>` : ''}
    <div><h4>할인 깊이별 반응 <span class="hint">평소 대비 판매 배수 · 지난 실적 관찰값</span></h4><div class="bars">${LIFT.map(([r, v], k) => `<div class="bar ${pr.pct > 0 && k === bucketOf(pr.pct) ? 'on' : ''}"><span>~${Math.round(r * 100)}%</span><i data-w="${v}"></i><span>${v}배</span></div>`).join('')}</div></div>
    <div><h4>지난 행사</h4><ul class="mini"><li>${esc(p.last)}</li><li>마지막 행사 후 ${p.days}일</li></ul></div>
    <div><h4>같은 기간 이미 잡힌 행사 <span class="hint">PROMO_WORK</span></h4>${overlap.length ? `<ul class="mini">${overlap.map(o => `<li><span class="tag">겹침</span>${esc(o)}</li>`).join('')}</ul>` : '<p class="hint">겹치는 행사가 없어요</p>'}</div>
    <label class="f"><span>소구문구 <em>엑셀 소구문구 · 카드에도 같은 값</em></span><input type="text" data-appeal="${i.seq}" maxlength="80" value="${esc(i.appeal)}" placeholder="예) 세작, 우전, 홍우전까지 포함한">
      ${['면역', '다이어트', '치료', '개선'].some(w => i.appeal.includes(w)) ? '<span class="warnline">효능으로 읽힐 수 있는 표현이 있어요</span>' : ''}</label>
    <div class="f"><span>기간</span><div class="chips-row"><input type="text" data-period="${i.seq}" value="${md(i.s)}~${md(i.e)}" aria-label="기간" maxlength="11"><span class="hint">기획안 기간 3/2~3/15</span></div></div>
    <label class="ck"><input type="checkbox" data-clear="${i.seq}" ${i.clear ? 'checked' : ''}> 재고 털이 (원가율 기준 넘어도 허용)</label>`;
}
function dealsTab() {
  const rows = DEAL_DATES.map(d => {
    const list = deals[d] || [], n = list.length, over = n > slotsPerDay;
    return `<div class="dday"><div class="dh">${md(d)} (${'일월화수목금토'[new Date(d).getDay()]})<small class="${over ? 'warn' : ''}">${n}/${slotsPerDay}자리${over ? ' · 많아요' : ''}</small></div>
      <div><div class="slots" data-n="${Math.max(slotsPerDay, n)}">${list.map(([q, r], k) => { const p = P[q], pr = priceOf(q, r, null), j = judge(q, pr); return `<div class="sl"><b>${esc(p.name)}</b><span class="pp">${Math.round(r * 100)}% ${won(pr.fin)}</span>
          <span class="cap">원가율 ${Math.round(craOf(q, pr.fin) * 100)}% · 쉰 기간 ${p.days}일</span><span class="foot"><span class="judge ${j.lv}">${j.t}</span><button class="btn xs ghost" data-dealrm="${d}|${k}" aria-label="${esc(p.name)} 빼기">빼기</button></span></div>`; }).join('')}
        ${Array.from({ length: Math.max(0, slotsPerDay - n) }, () => `<div class="sl empty"><span class="cap">빈 자리</span><button class="btn xs" data-fill="${d}">채우기</button></div>`).join('')}</div>
        ${fillDay === d ? candList(d) : ''}</div></div>`;
  }).join('');
  return `<section class="card"><div class="filters"><span class="cap">하루 자리 수</span><select data-slots aria-label="하루 자리 수">${[2, 3, 4, 5, 6].map(n => `<option ${n === slotsPerDay ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <span class="grow"></span><span class="cap">하루특가는 상시 할인 위에 얹는 정상 운영이에요</span></div>
    <p class="lever">지난 실적: 하루 3~4개일 때 품목당 반응이 가장 컸어요. 같은 상품은 61~120일 쉬었을 때 반응이 컸어요. (관찰값, 인과 아님)</p>
    <div class="dgrid">${rows}</div></section>`;
}
function candList(d) {
  const used = new Set((deals[d] || []).map(([q]) => q));
  const cand = q => dealCands.includes(q) ? 1 : 0;   // 하루특가 후보로 보낸 상품 먼저
  const c = (LIVE ? realSeqs() : Object.keys(P)).filter(q => !used.has(q)).map(q => ({ q, m: maxRate(q), p: P[q] })).filter(x => x.m >= 20 || cand(x.q)).sort((a, b) => cand(b.q) - cand(a.q) || (b.p.days >= 61 && b.p.days <= 120) - (a.p.days >= 61 && a.p.days <= 120) || b.p.base - a.p.base).slice(0, 4);
  return `<div class="cands"><span class="cap">${md(d)} 추천 후보 <span class="tag demo-t">예시 규칙</span> · 쉰 기간 61~120일 먼저, 평소 잘 팔리는 순</span>${c.map(x => { const r = Math.min(40, x.m); return `<div class="cand"><span><b>${esc(x.p.name)}</b></span>
      <span class="meta">제안 ${r}% · 기준 안 최대 ${x.m}% · 쉰 기간 ${x.p.days}일 · 예상(참고) ${man(x.p.base * liftOf(r) * priceOf(x.q, r / 100, null).fin * 0.75)}~${man(x.p.base * liftOf(r) * priceOf(x.q, r / 100, null).fin * 1.25)}원</span>
      <button class="btn xs primary" data-dealadd="${d}|${x.q}|${r}">넣기</button></div>`; }).join('')}<button class="btn xs ghost" data-fill="">닫기</button></div>`;
}
function extrasTab() {
  const CALC = [['sale_pct', '할인가에서 n% 더'], ['won', '할인가에서 n원 더'], ['list_pct', '정가에서 n% (더 싼 쪽)']];
  return `<div class="ex">${extras.map(x => {
    const rows = x.seqs.map(q => { const before = priceOf(q, rateOf(q), null), after = priceOf(q), jb = judge(q, before), ja = judge(q, after);
      return `<tr><td class="pn"><b>${esc(P[q].name)}</b></td><td class="num">${won(before.fin)}</td><td class="num fin">${won(after.fin)}<small>정가 대비 ${after.pct}%</small></td><td class="num">${Math.round(craOf(q, after.fin) * 100)}%</td><td><span class="judge ${jb.lv}">${jb.t}</span> → <span class="judge ${ja.lv}">${ja.t}</span></td></tr>`; }).join('');
    return `<section class="card"><div class="exrow">
        <label class="f"><span>이름 <em>카드 가격 이름 = 이름 + 가</em></span><input type="text" data-xf="${x.id}|name" value="${esc(x.name)}" maxlength="20"></label>
        <label class="f"><span>계산</span><select data-xf="${x.id}|calc">${CALC.map(([k, n]) => `<option value="${k}" ${x.calc === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f"><span>n</span><input type="number" data-xf="${x.id}|val" value="${x.val}" min="0"></label>
        <label class="f"><span>기간</span><input type="text" value="${md(x.s)}~${md(x.e)}" data-xf="${x.id}|period" maxlength="11"></label></div>
      <div class="f"><span>대상 상품 <em>${x.seqs.length}개 · 누르면 넣고 빼요</em></span><div class="chips-row">${items.filter(i => i.type === '상시').map(i => `<button class="chip" data-xseq="${x.id}|${i.seq}" aria-pressed="${x.seqs.includes(i.seq)}">${esc(P[i.seq].name)}</button>`).join('')}</div></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>대상</th><th class="num">혜택 전</th><th class="num">혜택 후 (최종가)</th><th class="num">원가율</th><th>판정</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="cap">대상 상품을 골라 주세요</td></tr>'}</tbody></table></div>
      <p class="hint">PROMO_WORK 엑셀에는 1단(할인 행)만 들어가요. 추가 혜택을 어떻게 적는지 멘토님께 확인 중이라, 지금은 검증 시트와 메모에만 적어요.</p>
      <div><button class="btn xs ghost" data-xdel="${x.id}">이 혜택 지우기</button></div></section>`;
  }).join('')}
    <div><button class="btn sm" data-xadd>+ 추가 혜택 (쿠폰·얼리버드·멤버십 등)</button></div></div>`;
}
function poolTab() {
  return `<section class="card"><div class="filters"><p class="hint grow">트렌드·리뷰·상품 화면·브리프 키워드에서 '역할은 나중에'로 담은 상품이에요. 역할을 고르면 그쪽으로 옮겨져요.</p>${LIVE ? '<button class="btn xs" data-search>+ 상품 찾아 담기</button>' : ''}</div>
    <div class="pool">${pool.map((x, k) => { const p = P[x.seq], m = maxRate(x.seq); return `<div class="pitem"><span><b>${pname(x.seq)}</b></span><span class="meta">${esc(x.src)} · 정가 ${won(p.price)} · 기준 안 최대 ${m}% · 쉰 기간 ${p.days}일</span>
      <span class="acts"><button class="btn xs primary" data-role="${k}|item">할인 상품으로</button><button class="btn xs" data-role="${k}|deal">하루특가 후보로</button><button class="btn xs" data-role="${k}|none">할인 없이</button><button class="btn xs" data-pair="${x.seq}">묶어 보기</button><button class="btn xs ghost" data-role="${k}|drop">빼기</button></span></div>`; }).join('') || '<p class="hint">후보 상품이 없어요</p>'}</div></section>`;
}

// ================= 서랍: 상품 상세 / 지난 행사 할인 기준 (예전 '상품'·'지난 성과' 메뉴를 이 공간 안으로) =================
// 상품 상세는 상품 이름을 누르면 열림 (할인 상품 표·근거·하루특가·후보 상품). 앱에서는 구좌 편집의 상품 고르기에서도 같은 서랍
let drawer = null;   // { kind: 'product', seq } | { kind: 'levers' }
const pname = seq => `<button class="linkbtn" data-pd="${seq}">${esc(P[seq].name)}</button>`;
// 상품마다 같은 가짜 값이 나오게 (SEQ 숫자로 흔듦)
const seed = seq => +seq.slice(1) % 7;
function detailOf(seq) {
  const p = P[seq], k = seed(seq), sales28 = p.base * 28 * p.price * 0.82;
  const weeks = Array.from({ length: 13 }, (_, w) => Math.round(p.base * 7 * (0.8 + ((w * 3 + k) % 5) * 0.12) * (w === 4 || w === 5 ? 2.1 : 1)));
  const past = [[p.last.split(' · ')[0], '상시', p.last.split(' · ')[1] || '-', Math.round(p.base * 14 * 1.7), '1.7배', '38%'],
    ['하루특가 (2025.12)', '하루특가', '35%', Math.round(p.base * 3.1), '3.1배', '44%']];
  const demo = { sales28, prev: [-0.12, 0.08, 0.21, -0.04, 0.15, 0.02, -0.09][k], ly: [0.06, -0.1, 0.18, 0.04, -0.02, 0.11, 0.09][k], weeks, past,
    next: Math.min(40, floor5(maxRate(seq)) || 10), rating: (4.4 + k * 0.07).toFixed(1), gift: 6 + k * 3, again: 4 + k * 2,
    review: ['향이 은은해서 선물했더니 좋아했어요', '아이스로 우려도 맛있어요', '포장이 고급스러워요'][k % 3], stock: 300 + k * 170 };
  if (!p.real) return demo;
  // 실제 상품: 매출·작년·90일 판매(daily_qty)·마지막 행사는 실제, 반응·리뷰는 예시 그대로
  const r = p.real, dq = r.daily_qty || [], n = dq.length;
  const wk = Array.from({ length: 13 }, (_, w) => dq.slice(Math.max(0, n - 7 * (13 - w)), Math.max(0, n - 7 * (12 - w))).reduce((a, b) => a + b, 0));
  return { ...demo, live: true, sales28: r.sales_28 || 0, prev: r.sales_prev28 ? (r.sales_28 || 0) / r.sales_prev28 - 1 : null, lyAmt: r.ly_next28 || 0, weeks: wk,
    past: r.last_promo ? [[r.last_promo, r.last_promo_type || '-', `${Math.round((r.last_promo_rate || 0) * 100)}%`, '-', '-', '-']] : [] };
}
function productDrawer(seq) {
  const p = P[seq], dt = detailOf(seq), it = itemOf(seq), m = maxRate(seq), sim = drawer.sim ?? Math.round(rateOf(seq) * 100);
  const sp = priceOf(seq, sim / 100, null), cra = sp.fin < p.price ? craOf(seq, sp.fin) : null, unit = sp.fin / 1.1 - p.cost;
  const pct = n => `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`, inPlan = it ? `이 기획안: ${it.type}${it.rate ? ` ${Math.round(it.rate * 100)}%` : ''}` : pool.some(x => x.seq === seq) ? '이 기획안: 후보 상품' : '이 기획안에 없음';
  const mx = Math.max(1, ...dt.weeks), EX = dt.live ? ' <span class="tag demo-t">예시</span>' : '';
  return `<div class="dh"><div class="grow"><div class="overline">상품 상세 · ${seq}</div><h2 id="drH">${esc(p.name)}</h2><span class="cap">${inPlan}</span></div><button class="btn sm" data-close>닫기</button></div>
  <div class="db">
    <div class="kv"><span>정가</span><span>${won(p.price)}</span><span>원가율 (정가)</span><span>${p.cost ? `${Math.round(p.cost / (p.price / 1.1) * 100)}%` : '원가 없음'}</span>
      <span>기준 안 최대 할인</span><span>${p.cost ? `${m}%` : '원가 없음'} <span class="hint">할인 후 원가율 ${Math.round(TARGET * 100)}% 기준</span></span>
      <span>최근 28일 매출</span><span>${man(dt.sales28)}원 · ${dt.prev == null ? '직전 28일 판매 없음' : `직전 28일 대비 ${pct(dt.prev)}`}</span>
      <span>작년 이맘때</span><span>${!dt.live ? `앞 4주 매출 작년 대비 ${pct(dt.ly)}` : dt.lyAmt ? `${man(dt.lyAmt)}원 <span class="hint">앞으로 4주에 해당하는 작년 4주</span>` : '작년 같은 기간 판매 없음'}</span>
      <span>마지막 행사</span><span>${esc(p.last)} · 특가 쉰 지 ${p.days}일</span>
      <span>재고 <em class="hint">참고</em></span><span>${dt.live ? '아직 못 불러와요' : `${dt.stock.toLocaleString('ko-KR')}개`} <span class="hint">기획 계산엔 안 써요</span></span></div>
    <div class="ps"><h4>할인 시뮬레이션 <span class="hint">추가 혜택 빼고 1단만</span></h4>
      <div class="simrow"><label>할인율 <select data-sim="${seq}" aria-label="할인율">${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(r => `<option value="${r}" ${r === sim ? 'selected' : ''}>${r}%</option>`).join('')}</select></label>
        <span>할인가 <b>${won(sp.fin)}</b></span><span>할인 후 원가율 <b class="${cra > TARGET ? 'is-over' : ''}">${cra == null ? '-' : Math.round(cra * 100) + '%'}</b></span><span>개당 이익 <b>${won(unit)}</b></span></div>
      <div class="puts"><button class="btn xs primary" data-put="${seq}|item|${sim}">이 할인으로 할인 상품에</button><button class="btn xs" data-put="${seq}|deal|${sim}">하루특가 후보로</button><button class="btn xs" data-put="${seq}|none|0">할인 없이</button><button class="btn xs" data-put="${seq}|pool|0">역할은 나중에</button><button class="btn xs ghost" data-pair="${seq}">묶을 짝 보기</button></div></div>
    <div class="ps"><h4>최근 90일 주별 판매 <span class="hint">${dt.live ? '실제 판매 수량' : '진하게 = 행사 주'}</span></h4><div class="spark" aria-label="13주 판매 수량">${dt.weeks.map((w, i) => `<i data-h="${Math.round(w / mx * 100)}" class="${!dt.live && (i === 4 || i === 5) ? 'ev' : ''}" title="${w}개"></i>`).join('')}</div></div>
    <div class="ps"><h4>지난 행사 성과${dt.live ? ' <span class="hint">마지막 행사만 · 행사별 수량·반응은 아직 못 불러와요</span>' : ''}</h4><div class="tbl-wrap"><table class="t"><thead><tr><th>행사</th><th>유형</th><th class="num">할인</th><th class="num">하루 수량</th><th class="num">평소 대비</th><th class="num">원가율</th></tr></thead>
      <tbody>${dt.past.length ? '' : '<tr><td colspan="6" class="cap">지난 행사가 없어요</td></tr>'}${dt.past.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td class="num">${r[4]}</td><td class="num">${r[5]}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="ps"><h4>할인 반응: 다음엔 몇 %?${EX}</h4><p class="cap">지난 행사에서 할인을 깊게 할수록 판매가 늘었지만 ${dt.next}%를 넘으면 늘어나는 폭이 줄었어요 → <b>${dt.next}% 안팎</b>을 권해요 (기준 안 최대 ${m}%)</p></div>
    <div class="ps"><h4>고객 리뷰${EX}</h4><ul class="mini"><li>평점 ${dt.rating} · 선물 언급 ${dt.gift}건 · 재구매 언급 ${dt.again}건 <span class="hint">최근 8주</span></li><li>"${esc(dt.review)}"</li></ul></div>
  </div>`;
}
// 지난 행사 할인 기준: 예전 '지난 성과' 레버 보드 + 할인 패턴 (지난 실적 관찰값, 예시)
const LEVERS = [
  ['요일', '특가 없는 날보다 월·수 특가 날 매출이 1.6배', '하루특가는 월·수에 몰아 두면 좋아요'],
  ['할인 깊이', '선물 세트는 25%까지 반응이 크게 늘고 그 뒤로 완만', '세트는 25~30%에서 멈춰도 돼요'],
  ['쉰 기간', '60일 넘게 특가를 쉰 상품은 반응이 1.3배', `이 기획안엔 ${Object.values(P).filter(p => p.days > 60).length}개가 60일 넘게 쉬었어요`],
  ['하루 품목 수', '하루 3~4개일 때 품목당 매출이 가장 높음', `지금 하루 ${slotsPerDay}자리예요`],
  ['상시 길이', '상시 할인 2주를 넘기면 둘째 주 매출이 떨어짐', '기획안 기간 2주 · 괜찮아요'],
  ['계절', '3월 매출 지수 1.15 (연평균 = 1)', '봄 수요가 받쳐 주는 달이에요'],
];
const PATTERN = [['상시 · 1만원대', '10%', '15%', '20%', '30%'], ['상시 · 2만원대', '15%', '20%', '25%', '35%'], ['상시 · 3만원 이상', '15%', '20%', '28%', '33%'], ['하루특가 · 전체', '30%', '35%', '40%', '50%']];
function leversDrawer() {
  return `<div class="dh"><div class="grow"><div class="overline">지난 행사 할인 기준</div><h2 id="drH">언제, 얼마나, 몇 개를 할인했을 때 잘 팔렸나</h2><span class="cap">요일 · 할인 깊이 · 쉰 기간 · 하루 품목 수 · 상시 길이 · 계절, 그리고 유형·가격대별 할인율이에요. 지난 행사 실적에서 본 값(예시)이고 약속은 아니에요</span></div><button class="btn sm" data-close>닫기</button></div>
  <div class="db">
    <div class="lvb">${LEVERS.map(([k, obs, say]) => `<div><b>${k}</b><span class="cap">${esc(obs)}</span><span class="say">${esc(say)}</span></div>`).join('')}</div>
    <div class="ps"><h4>유형 × 가격대별 할인율 <span class="hint">지난 행사 분포</span></h4><div class="tbl-wrap"><table class="t"><thead><tr><th>유형 · 가격대</th><th class="num">하위 25%</th><th class="num">중앙</th><th class="num">상위 25%</th><th class="num">최대</th></tr></thead>
      <tbody>${PATTERN.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(c => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
    <p class="hint">회차별 성과·작년 행사 다시 쓰기는 홈의 '지난 기획안'에서, 계획 대비 실적은 나중에 붙여요.</p>
  </div>`;
}
function renderDrawer() {
  const el = $('#drawer'); el.hidden = $('#scrim').hidden = !drawer;
  if (!drawer) return;
  el.innerHTML = drawer.kind === 'levers' ? leversDrawer() : drawer.kind === 'search' ? searchDrawer() : productDrawer(drawer.seq);
  el.querySelectorAll('.spark i[data-h]').forEach(i => i.style.setProperty('--h', `${Math.max(4, +i.dataset.h)}%`));
}
function putFromDetail(seq, role, r, src = '상품 상세') {
  if (role === 'deal' && !dealCands.includes(seq)) dealCands.push(seq);
  const it = itemOf(seq);
  if (role === 'item' || role === 'none') {
    if (!it) items.push({ seq, type: role === 'item' ? '상시' : '할인 없음', rate: role === 'item' ? r / 100 : 0, s: PERIOD[0], e: PERIOD[1], appeal: '', clear: false, where: [] });
    else if (role === 'item') { if (r / 100 === it.rate) delete drafts[seq]; else drafts[seq] = r / 100; }
    else { it.type = '할인 없음'; it.rate = 0; delete drafts[seq]; }
  }
  if (role === 'pool') { if (!it && !pool.some(x => x.seq === seq)) pool.push({ seq, src }); }
  else pool = pool.filter(x => x.seq !== seq);
  closeDrawer(); render();
  toast({ item: it ? `${r}%로 바꿈에 넣었어요. [반영]을 눌러야 들어가요` : `${r}%로 할인 상품에 넣었어요`, deal: '하루특가 후보로 넣었어요. 하루특가 탭의 [채우기]에서 먼저 보여요', none: '할인 없이 넣었어요', pool: it ? '이미 이 기획안에 있어요' : '후보 상품에 넣었어요' }[role]);
}
function openDrawer(d) { drawer = d; renderDrawer(); $('#drawer [data-close]')?.focus(); }
function closeDrawer() { drawer = null; renderDrawer(); }
function render() {
  renderSum();
  $('#body').innerHTML = ({ items: itemsTab, deals: dealsTab, extras: extrasTab, bundle: bundleTab, pool: poolTab })[tab]();
  // 막대 길이·자리 수는 CSSOM으로 (인라인 style 속성 없이, CSP와 같은 조건)
  document.querySelectorAll('.bar i[data-w]').forEach(el => { el.style.width = `${Math.min(100, el.dataset.w / 3 * 100)}%`; });
  document.querySelectorAll('.slots[data-n]').forEach(el => el.style.setProperty('--n', el.dataset.n));
  persist();
}

// ================= 동작 =================
// 한 번에 낮추기 (지금 툴과 같음): 원가율 기준을 넘는 행을 기준 안 가장 깊은 할인(5% 단위 내림)으로. 재고 털이·5% 미만이면 빼요. 바로 반영하지 않고 '바꿈'으로 모음
const fixable = () => items.filter(i => i.type !== '할인 없음' && !i.clear && judge(i.seq).lv === 'warn' && floor5(maxRate(i.seq)) >= 5);
const parsePeriod = (txt, s0, e0) => { const m = txt.match(/^(\d{1,2})\/(\d{1,2})~(\d{1,2})\/(\d{1,2})$/); if (!m) return null; const f = (a, b) => `2026-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`; const s = f(m[1], m[2]), e = f(m[3], m[4]); return s <= e ? [s, e] : null; };
document.addEventListener('click', e => {
  const t = e.target, d = k => t.closest(`[data-${k}]`), v = k => d(k)?.dataset[k];
  if (d('pd')) { openDrawer({ kind: 'product', seq: v('pd') }); return; }
  if (d('levers')) { openDrawer({ kind: 'levers' }); return; }
  if (d('close') || t.id === 'scrim') { closeDrawer(); return; }
  if (d('put')) { const [q, role, r] = v('put').split('|'); putFromDetail(q, role, +r); return; }
  if (d('tab')) { tab = v('tab'); render(); document.querySelector(`[data-tab="${tab}"]`)?.focus(); return; }
  if (d('toast')) { toast(v('toast')); return; }
  if (d('search')) { openDrawer({ kind: 'search', q: '' }); $('#pq')?.focus(); return; }
  if (d('sadd')) { const [q, role] = v('sadd').split('|'), back = drawer.q;
    putFromDetail(q, role, role === 'item' ? Math.min(20, floor5(maxRate(q))) || 5 : 0, '상품 찾기');
    openDrawer({ kind: 'search', q: back }); $('#pq')?.focus(); return; }   // 여러 개를 이어서 담게 창을 다시 엶
  if (d('where')) { where = v('where'); render(); return; }
  if (d('bulk')) { const f = fixable(); f.forEach(i => { drafts[i.seq] = floor5(maxRate(i.seq)) / 100; }); render(); toast(`${f.length}개를 기준 안으로 낮췄어요. [반영]을 눌러야 들어가요`); return; }
  if (d('lower')) { const q = v('lower'); drafts[q] = floor5(maxRate(q)) / 100; render(); toast(`${floor5(maxRate(q))}%로 낮췄어요. [반영]을 눌러야 들어가요`); return; }
  if (d('pair')) { bundle.base = v('pair'); tab = 'bundle'; drawer = null; renderDrawer(); render(); return; }
  if (d('bn') !== null && t.closest('[data-bn]')) { bundle.base = v('bn') || null; render(); return; }
  if (d('bpick')) { const [b, q, r] = v('bpick').split('|'); addCombo([b, q], +r); return; }
  if (d('bcalc')) { const [b, q, r] = v('bcalc').split('|'); bundle.calc = [b, q]; bundle.calcRate = +r; render(); document.getElementById('calcBox')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (d('calcadd')) { const q = $('#calcSel')?.value; if (q) { bundle.calc.push(q); render(); } return; }
  if (d('calcrm')) { bundle.calc.splice(+v('calcrm'), 1); render(); return; }
  if (d('calcput')) { if (bundle.calc.length >= 2) { const c = [...bundle.calc]; bundle.calc = []; addCombo(c, bundle.calcRate); } return; }
  const row = t.closest('tr[data-row]'); if (row && !t.closest('input')) { sel = row.dataset.row; render(); return; }
  if (d('apply')) { Object.entries(drafts).forEach(([q, r]) => { itemOf(q).rate = r; }); const n = Object.keys(drafts).length; drafts = {}; render(); toast(`할인 ${n}건을 반영했어요. 구좌 편집에도 같은 값이에요`); return; }
  if (d('undo')) { drafts = {}; render(); return; }
  if (d('fill')) { fillDay = v('fill') || null; render(); return; }   // 빈 값(닫기)이면 후보 목록을 닫음
  if (d('dealadd')) { const [dd, q, r] = v('dealadd').split('|'); (deals[dd] ||= []).push([q, +r / 100]); fillDay = null; render(); toast(`${md(dd)} 하루특가에 ${P[q].name}을 넣었어요`); return; }
  if (d('dealrm')) { const [dd, k] = v('dealrm').split('|'); deals[dd].splice(+k, 1); render(); return; }
  if (d('xseq')) { const [id, q] = v('xseq').split('|'), x = extras.find(y => y.id === id); x.seqs = x.seqs.includes(q) ? x.seqs.filter(y => y !== q) : x.seqs.concat(q); render(); return; }
  if (d('xadd')) { extras.push({ id: `x${extras.length + 1}${Date.now() % 1000}`, name: '쿠폰', calc: 'sale_pct', val: 10, seqs: [], s: PERIOD[0], e: PERIOD[1] }); render(); return; }
  if (d('xdel')) { extras = extras.filter(x => x.id !== v('xdel')); render(); return; }
  if (d('role')) { const [k, r] = v('role').split('|'), x = pool[+k];
    if (r === 'item' || r === 'none') { if (!itemOf(x.seq)) items.push({ seq: x.seq, type: r === 'item' ? '상시' : '할인 없음', rate: r === 'item' ? Math.min(20, maxRate(x.seq)) / 100 : 0, s: PERIOD[0], e: PERIOD[1], appeal: '', clear: false, where: [] }); }
    if (r === 'deal' && !dealCands.includes(x.seq)) dealCands.push(x.seq);
    pool.splice(+k, 1); render(); toast(r === 'drop' ? '후보에서 뺐어요' : r === 'deal' ? '하루특가 후보로 옮겼어요. 하루특가 탭의 [채우기]에서 먼저 보여요' : '할인 상품으로 옮겼어요. 구좌 편집에서 카드에 넣을 수 있어요'); return; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer) closeDrawer(); });
document.addEventListener('keydown', e => { const row = e.target.closest?.('tr[data-row]'); if (row && (e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); sel = row.dataset.row; render(); document.querySelector(`tr[data-row="${sel}"]`)?.focus(); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.sim) { drawer.sim = +t.value; renderDrawer(); $('#drawer [data-sim]')?.focus(); return; }
  if (t.dataset.rate) { const q = t.dataset.rate, r = Math.min(90, Math.max(0, Math.round(+t.value || 0))) / 100; if (r === itemOf(q).rate) delete drafts[q]; else drafts[q] = r; sel = q; render(); document.querySelector(`[data-rate="${q}"]`)?.focus(); return; }
  if (t.matches('[data-onlywarn]')) { onlyWarn = t.checked; render(); return; }
  if (t.matches('[data-slots]')) { slotsPerDay = +t.value; render(); return; }
  if (t.dataset.bset) { bundle[t.dataset.bset] = t.dataset.bset === 'rate' ? +t.value : t.value; render(); return; }
  if (t.matches('[data-bplan]')) { bundle.planFirst = t.checked; render(); return; }
  if (t.id === 'calcRate') { bundle.calcRate = Math.min(80, Math.max(0, Math.round(+t.value || 0))); render(); document.getElementById('calcRate')?.focus(); return; }
  if (t.dataset.clear) { itemOf(t.dataset.clear).clear = t.checked; return; }
  if (t.dataset.period) { const it = itemOf(t.dataset.period), pp = parsePeriod(t.value.trim()); if (!pp) { toast('기간은 3/2~3/8처럼 적어 주세요'); render(); return; } [it.s, it.e] = pp; render(); return; }
  if (t.dataset.xf) { const [id, f] = t.dataset.xf.split('|'), x = extras.find(y => y.id === id);
    if (f === 'period') { const pp = parsePeriod(t.value.trim()); if (!pp) { toast('기간은 3/2~3/8처럼 적어 주세요'); render(); return; } [x.s, x.e] = pp; }
    else x[f] = f === 'val' ? Math.max(0, +t.value || 0) : t.value; render(); return; }
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset.appeal) { itemOf(t.dataset.appeal).appeal = t.value; }
  if (t.id === 'pq') { drawer.q = t.value.slice(0, 40); $('#pres').innerHTML = searchResults(); } });   // 입력칸은 그대로 두고 결과만 바꿈 (커서 유지)
document.addEventListener('input', persist);    // 소구문구처럼 다시 그리지 않는 고침도 저장
document.addEventListener('change', persist);   // 재고 털이 체크 등
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2800); }
// 기획안이 열려 있으면 실제 상품·이 기획안의 값으로, 아니면 예시로
if (PLAN.id) $('#body').innerHTML = '<p class="hint">기획안 상품을 불러오는 중이에요…</p>'; else render();
PLAN.ready.then(async doc => {
  if (!doc) { render(); return; }
  try { loadPlan(doc, (await v2api('/api/products')).products || []); } catch (e) { LIVE = false; toast(`상품을 불러오지 못해 예시로 보여요: ${e.message}`); }
  render();
});
