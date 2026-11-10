// 할인 패턴: 과거 행사(PROMO_WORK × 실적)에서 뽑은 평소 할인율·반응도
import { $, api, applyBars, esc, pct, state } from './core.js';

export async function renderPatterns() {
  const box = $('#patternsBody');
  let d;
  try { d = state.patterns || (state.patterns = await api('/api/patterns')); } catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  const rows = d.by_type_price || [];
  const lifts = d.lift_by_rate || [];
  const maxLift = Math.max(1, ...lifts.map(l => l['반응도_중앙'] || 0));
  const table = type => `<table class="t compact"><thead><tr><th>가격대</th><th class="num">행사 수</th><th class="num">하위25%</th><th class="num">중앙</th><th class="num">상위25%</th><th class="num">최대</th><th class="num">원가율(중앙)</th>${type === '하루특가' ? '<th class="num">평소 대비</th>' : '<th class="num">행사 일수(중앙)</th>'}</tr></thead><tbody>
    ${rows.filter(r => r['유형'] === type).map(r => `<tr><td>${esc(r['가격대'])}</td><td class="num">${r['행사수']}</td><td class="num">${pct(r['할인율_하위25'])}</td><td class="num"><b>${pct(r['할인율_중앙'])}</b></td><td class="num">${pct(r['할인율_상위25'])}</td><td class="num">${pct(r['할인율_최대'])}</td>
      <td class="num ${r['할인후원가율_중앙'] > state.target ? 'over' : ''}">${pct(r['할인후원가율_중앙'])}</td>
      <td class="num">${type === '하루특가' ? (r['반응도_중앙'] ? r['반응도_중앙'].toFixed(1) + '배' : '-') : (r['행사일수_중앙'] ? Math.round(r['행사일수_중앙']) + '일' : '-')}</td></tr>`).join('')}</tbody></table>`;
  box.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="k">원가율 기준</div><div class="v">${pct(state.target)}</div><div class="s">할인 후 원가율 = 원가 ÷ (할인가/1.1). 클리어런스는 예외</div></div>
      <div class="kpi"><div class="k">실적 기준일</div><div class="v">${esc(d.sales_last_day || '-')}</div><div class="s">출고일 기준 실적 · 행사 실적은 할인율로 귀속(종료 다음 날까지)</div></div>
    </div>
    <div class="card"><div class="sec-head"><h2>하루특가: 할인율별 평소 대비 판매량</h2><span class="cap">행사 당일 수량 ÷ 행사 35~8일 전 일평균 (중앙값, 대략적인 값)</span></div>
      <table class="t compact"><thead><tr><th>할인율</th><th class="num">행사 수</th><th class="num">중앙</th><th></th><th class="num">하위25%</th><th class="num">상위25%</th></tr></thead><tbody>
      ${lifts.map(l => `<tr><td>${esc(l['구간'])}</td><td class="num">${l['행사수']}</td><td class="num"><b>${(l['반응도_중앙'] || 0).toFixed(1)}배</b></td><td><span class="bar wide"><i data-w="${(l['반응도_중앙'] || 0) / maxLift}"></i></span></td><td class="num">${(l['반응도_하위25'] || 0).toFixed(1)}배</td><td class="num">${(l['반응도_상위25'] || 0).toFixed(1)}배</td></tr>`).join('')}
      </tbody></table></div>
    <div class="two-col"><div class="card"><div class="sec-head"><h2>하루특가: 가격대별 평소 할인율</h2></div><div class="tbl-wrap">${table('하루특가')}</div></div>
    <div class="card"><div class="sec-head"><h2>상시 할인: 가격대별 평소 할인율</h2><span class="cap">상시는 같은 기간 하루특가와 섞여 판매 반응도 숫자는 신뢰도가 낮아 표시하지 않습니다</span></div><div class="tbl-wrap">${table('상시')}</div></div></div>`;
  applyBars(box);
}
