// ② 상품·할인 옆 패널: 지금 고른 행·칸의 판단 근거 (plans/05 R14, R15, 확정)
// 근거는 기존 데이터만 쓴다: 할인 패턴(/api/patterns), 레버(/api/levers), 상품 표의 지난 행사 값. 모두 관찰값이며 인과가 아니다
import { esc, mmdd, pct, state, won } from '../core.js';

const WD = '월화수목금토일';   // levers.weekday_index는 월요일부터
const DEPTH = [[0.25, '~25%'], [0.30, '26~30%'], [0.35, '31~35%'], [0.40, '36~40%'], [1, '41%~']];
const bandOf = r => (DEPTH.find(([hi]) => (r || 0) <= hi + 1e-9) || DEPTH[DEPTH.length - 1])[1];
const dow = s => { const [y, m, d] = s.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; };
const prodOf = r => (r && r.seq && !(r.items && r.items.length)) ? state.bySeq.get(String(r.seq)) : null;
const kv = (k, v) => v === null || v === undefined || v === '' ? '' : `<div><span class="k">${esc(k)}</span><span class="am-v">${v}</span></div>`;

function patternFor(type, band) {
  return ((state.patterns && state.patterns.by_type_price) || []).find(x => x['유형'] === type && x['가격대'] === band) || null;
}

function productBlock(p) {
  if (!p) return '<p class="cap">상품 정보가 없어요 (신규 조합이거나 SEQ를 찾지 못했어요).</p>';
  return `<div class="am-facts">
    ${kv('정가', p.price ? `${won(p.price)}원` : '')}
    ${kv('원가율 기준 최대 할인', p.max_discount !== null && p.max_discount !== undefined ? pct(p.max_discount) : '')}
    ${kv('최근 행사', p.last_promo ? `${esc(p.last_promo)} ${esc(p.last_promo_type || '')} ${pct(p.last_promo_rate)}${p.last_promo_start ? ` (${mmdd(p.last_promo_start)})` : ''}` : '없음')}
    ${kv('역대 최대 할인', p.max_rate ? pct(p.max_rate) : '')}
    ${kv('행사 없이 지난 일수', p.days_since_promo !== null && p.days_since_promo !== undefined ? `${p.days_since_promo}일` : '')}
    ${kv('최근 28일 매출', p.sales_28 ? `${Math.round(p.sales_28 / 10000).toLocaleString('ko-KR')}만원` : '')}
  </div>`;
}

// row: 고른 할인 행 (없으면 null) / ctx: { rows: 편집 중인 행 전체, date: 비어 있는 하루특가 칸의 날짜 }
export function renderEvidence(box, row, ctx = {}) {
  if (!box) return;
  const rows = ctx.rows || [];
  if (!row && !ctx.date) {
    const sang = rows.filter(r => r.type === '상시' && r.rate), deals = rows.filter(r => r.type === '하루특가');
    const perDay = {}; deals.forEach(r => { perDay[r.start] = (perDay[r.start] || 0) + 1; });
    const days = Object.values(perDay);
    box.innerHTML = `<h2>근거</h2><p class="cap">표의 행이나 하루특가 칸을 고르면 그 상품의 판단 근거가 여기 보여요.</p>
      <div class="am-facts">
        ${kv('상시 할인 평균', sang.length ? pct(sang.reduce((a, r) => a + r.rate, 0) / sang.length) : '')}
        ${kv('하루특가', deals.length ? `${deals.length}개, ${days.length}일 (하루 ${Math.min(...days)}~${Math.max(...days)}개)` : '')}
        ${kv('할인 없음', rows.filter(r => r.type === '큐레이션').length || '')}
      </div>
      <p class="cap">레버: 하루특가는 하루 3~4개일 때 품목당 반응이 가장 컸어요. 같은 상품 하루특가는 61~120일 쉬었을 때 반응이 컸어요. (우리 실적 관찰값, 인과 아님)</p>`;
    return;
  }
  if (!row && ctx.date) {
    const wi = (state.levers?.weekday_index || [])[dow(ctx.date)];
    const n = rows.filter(r => r.type === '하루특가' && r.start === ctx.date).length;
    box.innerHTML = `<h2>근거 <span class="cap">${mmdd(ctx.date)} 하루특가 칸</span></h2>
      <div class="am-facts">${kv('이 요일 평소 매출 지수', wi ? `${WD[dow(ctx.date)]} ${wi.toFixed(2)} (평균 1)` : '')}${kv('이 날 하루특가', `${n}개`)}</div>
      ${liftTable(null)}`;
    return;
  }
  const p = prodOf(row);
  const name = p ? p.name : (row.items && row.items.length ? '신규 조합' : `SEQ ${row.seq || '미정'}`);
  if (row.type === '큐레이션') {
    box.innerHTML = `<h2>근거 <span class="cap">할인 없음</span></h2><p class="sm">${esc(name)}</p>${productBlock(p)}
      <p class="cap">할인 없이 구좌에 놓이는 상품이라 할인 근거는 보여주지 않아요.</p>`;
    return;
  }
  const band = p ? p.price_band : '';
  const pt = band ? patternFor(row.type, band) : null;
  const ptBlock = pt ? `<h3>${esc(band)} ${esc(row.type)}의 평소 할인율 <span class="cap">과거 행사 ${pt['행사수']}건</span></h3>
      <div class="am-facts">${kv('하위 25%', pct(pt['할인율_하위25']))}${kv('중앙', pct(pt['할인율_중앙']))}${kv('상위 25%', pct(pt['할인율_상위25']))}${kv('최대', pct(pt['할인율_최대']))}</div>
      <p class="cap">지금 ${pct(row.rate)}는 ${row.rate < pt['할인율_하위25'] ? '평소보다 낮은 편' : row.rate > pt['할인율_상위25'] ? '평소보다 높은 편' : '평소 범위 안'}이에요.</p>` : '';
  if (row.type === '하루특가') {
    const wi = row.start ? (state.levers?.weekday_index || [])[dow(row.start)] : null;
    const n = rows.filter(r => r.type === '하루특가' && r.start === row.start).length;
    const rest = p && p.last_deal_end && row.start ? Math.round((new Date(row.start) - new Date(p.last_deal_end)) / 86400000) : null;
    box.innerHTML = `<h2>근거 <span class="cap">${row.start ? mmdd(row.start) : ''} 하루특가</span></h2><p class="sm">${esc(name)} · ${pct(row.rate)}</p>
      <div class="am-facts">
        ${kv('마지막 하루특가', p && p.last_deal_end ? `${mmdd(p.last_deal_end)}${rest !== null && rest >= 0 ? ` (이 날까지 ${rest}일 쉼)` : ''}` : '없음')}
        ${kv('이 요일 평소 매출 지수', wi ? `${WD[dow(row.start)]} ${wi.toFixed(2)} (평균 1)` : '')}
        ${kv('이 날 하루특가', `${n}개`)}
      </div>
      ${liftTable(row.rate)}${ptBlock}${productBlock(p)}`;
    return;
  }
  box.innerHTML = `<h2>근거 <span class="cap">상시 할인</span></h2><p class="sm">${esc(name)} · ${pct(row.rate)}</p>${ptBlock || '<p class="cap">이 가격대의 상시 할인 패턴이 없어요.</p>'}${productBlock(p)}
    <p class="cap">상시는 판매가 첫 3~5일에 몰려요. 14일보다 길면 중간 계기(요일 특가, 2차 오픈)를 검토해 보세요. (레버)</p>`;
}

function liftTable(rate) {
  const lifts = (state.patterns && state.patterns.lift_by_rate) || [];
  if (!lifts.length) return '';
  const cur = rate ? bandOf(rate) : '';
  return `<h3>할인 깊이별 하루특가 반응 <span class="cap">평소 대비 판매 배수 중앙값</span></h3>
    <table class="mini am-lift"><tbody>${lifts.map(l => `<tr class="${l['구간'] === cur ? 'on' : ''}"><th>${esc(l['구간'])}${l['구간'] === cur ? ' (지금)' : ''}</th><td class="num">${l['반응도_중앙'] ? `${(+l['반응도_중앙']).toFixed(1)}배` : '-'}</td><td class="cap">${l['행사수']}건</td></tr>`).join('')}</tbody></table>
    <p class="cap">우리 실적 관찰값이에요. 시즌과 상품 선정이 섞여 있어 인과로 보지 않아요.</p>`;
}
