// 조합 추천: 원가 높은 인기 상품마다 '얹으면 할인 여력이 생기는 짝'을 카드로 추천. 직접 계산은 아래 접힌 영역.
import { $, api, attachPicker, emit, esc, man, on, pct, state, toast, won } from './core.js';

let items = [];       // 직접 계산기: [{seq, qty}]
let rate = 0.3;
let focus = null;     // 상품 탐색에서 넘어온 기준 상품

export function initMix() {
  $('#bundleCat').innerHTML += ['티 세트', '티 제품', '티푸드', '라이프 스타일'].map(c => `<option>${c}</option>`).join('');
  $('#bundleRate').addEventListener('change', loadBundles);
  $('#bundleCat').addEventListener('change', loadBundles);
  $('#bundleList').addEventListener('click', e => {
    const b = e.target.closest('[data-pair]'); if (!b) return;
    const [base, partner, r] = b.dataset.pair.split('|');
    if (b.dataset.do === 'plan') {
      emit('plan:add', { items: [{ seq: base, qty: 1 }, { seq: partner, qty: 1 }], type: '상시', rate: +r });
      
    } else {
      items = [{ seq: base, qty: 1 }, { seq: partner, qty: 1 }]; rate = +r;
      $('#manualBox').open = true; renderItems(); calc(); $('#manualBox').scrollIntoView({ behavior: 'smooth' });
    }
  });
  attachPicker($('#mixSearch'), $('#mixDD'), p => addItem(p.seq), { filter: p => p.cost !== null && p.cost !== undefined });
  $('#mixItems').addEventListener('input', e => {
    const i = e.target.dataset.qty; if (i === undefined) return;
    items[+i].qty = Math.max(1, Math.min(20, +e.target.value || 1)); calc();
  });
  $('#mixItems').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { items.splice(+d.dataset.del, 1); renderItems(); calc(); } });
  $('#mixClear').addEventListener('click', () => { items = []; renderItems(); calc(); });
  $('#mixToPlan').addEventListener('click', () => {
    if (items.length < 2) { toast('조합은 상품 2개 이상이어야 합니다'); return; }
    emit('plan:add', { items: items.map(i => ({ ...i })), type: '상시', rate });
    
  });
  on('bundle:focus', d => { focus = String(d.seq); emit('view:mix'); loadBundles(); });
  on('partner:base', d => {
    focus = String(d.seq);
    if (d.rate) $('#bundleRate').value = String(Math.min(0.35, Math.max(0.2, Math.round(d.rate * 20) / 20)));
    emit('view:mix'); loadBundles();
  });
  on('mix:add', d => { addItem(d.seq); $('#manualBox').open = true; emit('view:mix'); });
  renderItems(); calc();
}

export async function loadBundles() {
  const box = $('#bundleList');
  box.innerHTML = '<div class="empty"><span class="spin"></span> 짝을 찾는 중</div>';
  const minRate = +$('#bundleRate').value;
  try {
    const parts = [];
    if (focus) {
      const r = await api('/api/partners', { method: 'POST', body: { seq: focus, min_rate: minRate, limit: 6 } });
      if (r.base) {
        parts.push(bundleCard({ base: r.base, base_max_discount: r.base_max_discount,
          partners: r.partners.map(x => ({ ...x, why: `짝 28일 매출 ${man(x.sales_28)}만원` })) }, true));
      }
    }
    const d = await api('/api/bundles', { method: 'POST', body: { min_rate: minRate, category: $('#bundleCat').value || null } });
    parts.push(...d.bundles.filter(b => String(b.base.seq) !== focus).map(b => bundleCard(b)));
    box.innerHTML = parts.join('') || '<div class="empty">조건에 맞는 추천이 없습니다. 목표 할인을 낮춰 보세요.</div>';
  } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
}

function bundleCard(b, isFocus = false) {
  const base = b.base;
  const pairs = b.partners.map(x => {
    const r = x.suggest_rate ?? Math.min(0.35, Math.floor(x.combo_max_discount * 20 + 1e-9) / 20);
    const sale = x.combo_sale_price ?? Math.floor(x.combo_price * (1 - r) / 100) * 100;
    return `<div class="pair">
      <div class="plus">+ ${esc(x.name)}</div>
      <div class="cap">${esc(x.category || '')} · 정가 ${won(x.price)}원 · 원가율 ${pct(x.cost_ratio)}</div>
      <div class="row"><span class="big">${pct(r)}</span><span class="sm">할인 → 묶음가 <b>${won(sale)}</b>원 <span class="mute">(정가 ${won(x.combo_price)})</span></span></div>
      <div class="why">${esc(x.why || '')} · 묶음 최대 ${pct(x.combo_max_discount)}</div>
      <div class="acts"><button class="btn sm primary" data-do="plan" data-pair="${base.seq}|${x.seq}|${r}">기획안에 담기</button><button class="btn sm" data-do="calc" data-pair="${base.seq}|${x.seq}|${r}">계산기에서 조정</button></div>
    </div>`;
  }).join('');
  return `<section class="bundle">
    <div class="bundle-head">${isFocus ? '<span class="tag plan">선택한 상품</span>' : ''}<b>${esc(base.name)}</b>
      <span class="sm mute">정가 ${won(base.price)}원 · 원가율 ${pct(base.cost_ratio)} · 28일 ${man(base.sales_28)}만원 · 혼자서는 ${b.base_max_discount > 0 ? `최대 ${pct(b.base_max_discount)}` : '할인 여력 없음'}</span></div>
    <div class="pairs">${pairs || '<div class="empty">조건을 만족하는 짝이 없습니다</div>'}</div>
  </section>`;
}

// ---------------- 직접 계산기 ----------------
function addItem(seq) {
  seq = String(seq);
  const ex = items.find(i => i.seq === seq);
  if (ex) ex.qty += 1; else items.push({ seq, qty: 1 });
  renderItems(); calc();
}

function renderItems() {
  $('#mixItems').innerHTML = items.length ? `<thead><tr><th>상품</th><th class="num">정가</th><th class="num">원가율</th><th class="num">28일 매출(만원)</th><th class="num">수량</th><th></th></tr></thead><tbody>` +
    items.map((it, i) => { const p = state.bySeq.get(it.seq) || {}; return `<tr><td>${esc(p.name || it.seq)}</td><td class="num">${won(p.price)}</td><td class="num">${pct(p.cost_ratio)}</td><td class="num">${man(p.sales_28)}</td>
      <td class="num"><input type="number" min="1" max="20" value="${it.qty}" data-qty="${i}" class="w64"></td><td><button class="btn ghost sm" data-del="${i}">삭제</button></td></tr>`; }).join('') + '</tbody>'
    : '<tbody><tr><td class="mute">위에서 상품을 추가하세요</td></tr></tbody>';
}

async function calc() {
  const box = $('#mixSim');
  if (!items.length) { box.innerHTML = '<span class="cap">상품을 넣으면 정가·원가·할인 여력을 계산합니다</span>'; return; }
  let r;
  try { r = await api('/api/mix', { method: 'POST', body: { items, rate } }); } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  const md = r.max_discount;
  box.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="k">정가 합</div><div class="v">${won(r.price)}<span class="cap"> 원</span></div><div class="s">원가 합 ${won(r.cost)}원 · 원가율 ${pct(r.cost_ratio)}</div></div>
      <div class="kpi ${md !== null && md < 0.2 ? 'warn' : 'ok'}"><div class="k">최대 할인 (원가율 ${pct(r.target)} 기준)</div><div class="v">${md === null ? '-' : md <= 0 ? '없음' : pct(md)}</div><div class="s">${r.max_discount_price ? `할인가 ${won(r.max_discount_price)}원까지 가능` : ''}</div></div>
    </div>
    ${r.missing?.length ? `<div class="err-box mt8">${r.missing.map(esc).join(' / ')}</div>` : ''}
    <div class="row mt10"><b class="sm">할인율</b><span class="grow"></span><b id="mixRateTxt">${Math.round(rate * 100)}%</b></div>
    <input type="range" id="mixRate" min="5" max="70" step="1" value="${Math.round(rate * 100)}">
    <div class="res"><span>할인가 <b>${won(r.sale_price)}</b>원</span><span>할인 후 원가율 <b class="${r.ok ? 'good' : 'over'}">${pct(r.cost_ratio_after)}</b></span>
      <span>${r.ok ? '<span class="status ok">✓ 원가율 45% 이내</span>' : '<span class="status warn">! 원가율 45% 넘음(참고)</span>'}</span></div>`;
  $('#mixRate').addEventListener('input', e => { $('#mixRateTxt').textContent = e.target.value + '%'; });
  $('#mixRate').addEventListener('change', e => { rate = +e.target.value / 100; calc(); });
}
