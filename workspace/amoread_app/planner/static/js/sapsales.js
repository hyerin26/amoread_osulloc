// 이번 주(홈) 첫 줄 · 오설록닷컴 SAP 실적: sap_sales_download.py 가 매일 받은 BW 쿼리(S_ZSD_001_Q0009) 요약
import { $, api, esc, mmdd, on, spark } from './core.js';

const mil = v => (v === null || v === undefined) ? '-' : (v / 1e6).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const gr = v => (v === null || v === undefined) ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const rate = v => (v === null || v === undefined) ? '' : `${Math.round(v * 100)}%`;

export function initSapSales() {
  on('data:reload', loadSapSales);
}

export async function loadSapSales() {
  const box = $('#sapKpis');
  let d;
  try { d = await api('/api/sap-sales'); }
  catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  const st = d.status || {};
  const fail = st.ok === false ? `<p class="cap over mt8">마지막 자동 수집 실패 (${esc(st.ran_at || '')}): ${esc(st.message || '')}: tool_sap_sales.bat 으로 다시 받으세요.</p>` : '';
  if (!d.ready) {
    $('#sapSum').textContent = '';
    box.innerHTML = `<div class="empty">아직 받은 SAP 실적이 없어요. tool_sap_sales.bat 을 한 번 실행하세요.</div>${fail}`;
    return;
  }
  const t = d.total, b = d.b2c;
  $('#sapSum').textContent = `${mmdd(d.date)} 기준 · 순매출 백만원 · 자동 수집 ${st.ran_at ? st.ran_at.slice(5) : '-'}`;
  const tile = (k, v, s, cls = '', title = '') =>
    `<div class="kpi ${cls}"${title ? ` title="${esc(title)}"` : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const monthSub = t.month_target
    ? `목표 ${mil(t.month_target)} · 진도 ${rate(t.month_rate)} · 추정 ${mil(t.month_forecast)}`
    : `추정 마감 ${mil(t.month_forecast)} (목표 미입력)`;
  const bySub = `전년비 ${gr(t.by_growth)}` + (t.by_target ? ` · 연간 목표 진도 ${rate(t.by_rate)}` : '');
  const seq = d.seq_last_day
    ? tile('행사 실적(SEQ)', `~${mmdd(d.seq_last_day)}`, d.seq_stale ? `SAP보다 ${d.seq_gap}일 늦음: D2C CSV 교체` : 'SAP와 비슷하게 최신',
        d.seq_stale ? 'warn' : '', '행사 분석은 D2C 관리자 시스템 SEQ 판매실적 CSV 기준. SAP에는 SEQ·할인금액이 없어요.')
    : '';
  box.innerHTML = [
    tile(`${mmdd(d.date)} 순매출`, `${mil(t.day)} <span class="sapspark">${spark((t.spark || []).map(x => x.sales))}</span>`,
      `B2C ${mil(b.day)} · 최근 ${(t.spark || []).length}일 흐름`, '', '오설록닷컴 합계 = 닷컴 B2C + 사업자몰 + B2B'),
    tile(`${esc(d.month_label)} 누계`, mil(t.month), monthSub, '', `목표는 planner/settings/${d.target_file} 에서 고칩니다. 추정 = 지금까지 하루 평균 × 이번 달 일수`),
    tile('전년 동기 대비', gr(t.month_growth), `전년 같은 기간 ${mil(t.month_ly)}`, t.month_growth < 0 ? 'err' : 'ok'),
    tile(`${esc(d.by_label)} 누계`, mil(t.by), bySub),
    seq,
  ].join('') + fail;
}
