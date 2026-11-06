// 레버 보드: 우리 실적으로 잰 기획 손잡이 — 요일 · 할인 깊이 · 쉰 기간 · 하루 품목 수 · 상시 길이 · 계절
// 숫자는 build 단계(levers.py)가 계산한 값 그대로. 막대는 SVG가 아니라 CSS 막대(data-w)로 그린다.
import { $, api, applyBars, esc, man, state } from './core.js';

let L = null;

export async function renderLevers() {
  const box = $('#revLevers');
  if (!L) {
    box.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    try { L = state.levers || (state.levers = await api('/api/levers')); } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  }
  const x = v => (v === null || v === undefined) ? '-' : `${v.toFixed(1)}배`;
  const bars = (rows, key, label, fmt, hiKey) => {
    const mx = Math.max(1, ...rows.map(r => r[key] || 0));
    return `<table class="lever"><tbody>${rows.map(r => `<tr class="${hiKey && hiKey(r) ? 'hi' : ''}"><th>${esc(label(r))}</th>
      <td class="barc"><span class="bar wide"><i data-w="${(r[key] || 0) / mx}"></i></span></td><td class="num"><b>${fmt(r[key])}</b></td>
      <td class="num cap">${r.n !== undefined ? `${r.n}건` : r.days !== undefined ? `${r.days}일` : r.deal_days !== undefined ? `특가 ${r.deal_days}일` : ''}</td></tr>`).join('')}</tbody></table>`;
  };
  const wk = L.weekday || [];
  const depthCat = L.depth_by_category || [];
  const labels = L.depth_labels || [];
  const depthTable = `<table class="t compact depth"><thead><tr><th>카테고리</th>${labels.map(l => `<th class="num">${l}</th>`).join('')}</tr></thead><tbody>
    ${[...(L.depth_all || []), ...depthCat.filter(r => Object.values(r.cells).reduce((a, c) => a + c.n, 0) >= 20)].map(r => `<tr><td>${esc(r.key)}</td>${labels.map(l => { const c = r.cells[l]; return `<td class="num ${c && c.lift >= 10 ? 'good' : ''}" title="${c ? `하위25 ${c.q1}배 · 상위25 ${c.q3}배 · ${c.n}건` : ''}">${c ? `${c.lift.toFixed(1)}배 <span class="cap">${c.n}</span>` : '<span class="mute">-</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  const dec = L.sangsi_decay || { days: [], value: [] };
  const decRows = dec.days.map((d, i) => ({ d, v: dec.value[i] })).filter(r => [1, 2, 3, 4, 5, 7, 10, 14, 21, 28].includes(r.d));
  const months = L.month_index || [];
  const monthTable = `<table class="t compact month"><thead><tr><th>연도</th>${[...Array(12)].map((_, i) => `<th class="num">${i + 1}월</th>`).join('')}</tr></thead><tbody>
    ${months.map(y => `<tr><td>${y.year}</td>${y.index.map(v => `<td class="num ${v === null ? '' : v >= 1.3 ? 'good' : v < 0.8 ? 'warnc' : ''}">${v === null ? '' : v.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  box.innerHTML = `
    <p class="cap">${esc(L.note || '')} · 하루특가 완료 ${L.n_deals || 0}건 기준</p>
    <div class="levers">
      <section class="card lvcard"><div class="kick">① 요일</div><h2>월요일이 제일 잘 팔리고, 주말은 절반</h2>
        ${bars(wk, 'all', r => r.wd, v => v ? v.toFixed(2) : '-', r => r.all >= 1.2)}
        <table class="t compact"><thead><tr><th>요일</th><th class="num">특가 없는 날</th><th class="num">특가 있는 날</th><th class="num">특가 일수</th></tr></thead><tbody>
        ${wk.map(r => `<tr><td>${r.wd}</td><td class="num">${r.no_deal?.toFixed(2) ?? '-'}</td><td class="num ${r.deal && r.no_deal && r.deal - r.no_deal >= 0.15 ? 'good' : ''}">${r.deal?.toFixed(2) ?? '-'}</td><td class="num cap">${r.deal_days}</td></tr>`).join('')}</tbody></table>
        <p class="take">→ 특가가 몰 전체 매출을 끌어올린 건 수요일(특가 없는 날보다 높음). 월요일은 특가가 있어도 거의 같아요. 일부를 화·목으로 옮겨 시험해 볼 만해요. (몰 일매출 ÷ 28일 이동중앙값)</p></section>
      <section class="card lvcard"><div class="kick">② 할인 깊이</div><h2>36%를 넘으면 반응이 계단식으로</h2><div class="tbl-wrap">${depthTable}</div>
        <p class="take">→ 하루특가 평소 대비 판매 배수(중앙값 · 작은 숫자 = 건수). 30%대 초반과 36%+ 사이 계단을 넘길 수 있는지, 원가율 45% 선과 같이 보세요.</p></section>
      <section class="card lvcard"><div class="kick">③ 쉰 기간</div><h2>같은 상품, 쉬게 할수록 크게 터진다</h2>
        ${bars(L.gap || [], 'lift', r => r.band, x, r => r.band.startsWith('61'))}
        <p class="take">→ 같은 상품 직전 하루특가와의 간격. 14일 안 재특가가 가장 많지만(건수) 반응은 가장 약해요.</p></section>
      <section class="card lvcard"><div class="kick">④ 하루 품목 수</div><h2>하루 3~4개가 적당</h2>
        ${bars(L.items_per_day || [], 'lift', r => r.band, x, r => r.band === '3개' || r.band === '4개')}
        <table class="t compact"><thead><tr><th>그날 품목 수</th><th class="num">그날 특가 매출(중앙·만원)</th><th class="num">일수</th></tr></thead><tbody>
        ${(L.items_per_day || []).map(r => `<tr><td>${r.band}</td><td class="num">${man(r.day_sales)}</td><td class="num cap">${r.days}</td></tr>`).join('')}</tbody></table>
        <p class="take">→ 품목이 많으면 관심이 나뉘어 품목당 반응이 줄어요. 3개 날에는 대형 시즌이 섞였을 수 있어요.</p></section>
      <section class="card lvcard"><div class="kick">⑤ 상시 길이</div><h2>상시 효과는 첫 3~5일에 몰린다</h2>
        ${bars(decRows, 'v', r => `${r.d}일째`, v => v?.toFixed(2) ?? '-', r => r.d <= 3)}
        <p class="take">→ 첫 3일 평균 = 1. 상시 품목 ${dec.n || 0}개 기준. 길게 갈 거면 중간에 새 계기(요일 특가·Zone 교체·2차 오픈)를 두세요.</p></section>
      <section class="card lvcard wide"><div class="kick">⑥ 계절</div><h2>비수기에 명분이 더 필요하다</h2>${monthTable}
        <p class="take">→ 월 매출 ÷ 그해 월평균. 명절·연말은 수요가 스스로 와요. 0.8 아래 달은 명분 캘린더의 절기·날씨·트렌드 명분을 먼저 보세요.</p></section>
    </div>`;
  applyBars(box);
}

export function resetLevers() { L = null; }
