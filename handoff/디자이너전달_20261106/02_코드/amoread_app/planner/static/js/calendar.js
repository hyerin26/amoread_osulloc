// 행사 캘린더: PROMO_WORK 행사(상시 = 기간 막대, 하루특가 = 날짜별 품목 수) + 시즌 일정 + 기획안 겹쳐 보기
// 날짜를 누르면 그 날 상세(잡힌 행사·하루특가 후보·작년 이 날 베스트)를 시트로 연다.
import { $, $$, api, closePop, closeSheet, emit, esc, man, mmdd, on, openPop, openSheet, pct, state, toast, won } from './core.js';
import { currentRows } from './plan.js';

const DAYS = 28;
let start = null;      // 보이는 첫 월요일 (YYYY-MM-DD)
let data = null;
let seasons = [];
let amData = null;     // AMOREAD 통합 기획안 겹: { dated, undated, status_label }

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const monday = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const WD = '일월화수목금토';

export function initCalendar() {
  start = monday(iso(new Date()));
  $('#calPrev').addEventListener('click', () => { start = addDays(start, -DAYS); load(); });
  $('#calNext').addEventListener('click', () => { start = addDays(start, DAYS); load(); });
  $('#calToday').addEventListener('click', () => { start = monday(iso(new Date())); load(); });
  // AMOREAD: 작업대가 기획안 ② 단계로 들어가면서 '작업대의 지금 행' 겹은 없앰 (내 기획안 겹이 대신함)
  $$('[data-layer]').forEach(el => el.addEventListener('change', render));
  $('#amUndated').addEventListener('click', e => { const b = e.target.closest('[data-amopen]'); if (b) emit('am:open', b.dataset.amopen); });
  on('am:changed', () => { if (loaded) loadAm().then(render); });
  on('seasons:changed', () => { if (loaded) { loadSeasons(); load(); } });
  $('#calGrid').addEventListener('click', e => {
    const am = e.target.closest('[data-amopen]');
    if (am) { emit('am:open', am.dataset.amopen); return; }
    const bar = e.target.closest('[data-bar]');
    if (bar) { showBar(bar); return; }
    const d = e.target.closest('[data-day]');
    if (d) openDay(d.dataset.day);
  });
  $('#seasonBody').addEventListener('click', onSeasonClick);
  $('#mbCards').addEventListener('click', onMbClick); $('#mbKind').addEventListener('click', onMbClick);
  on('calendar:day', day => {
    start = monday(day);
    const first = !loaded; loaded = true;
    $('.tab[data-view="calendar"]').click();
    if (first) loadSeasons();
    load().then(() => openDay(day));
  });
  on('plan:changed', () => { if (data && $('#view-calendar').classList.contains('on')) render(); });
}

let loaded = false;
export function showCalendar() { if (!loaded) { loaded = true; load(); loadSeasons(); } else render(); }

async function load() {
  loaded = true;
  $('#calGrid').innerHTML = '<div class="empty"><span class="spin"></span></div>';
  try { data = await api(`/api/calendar?start=${start}&days=${DAYS}`); }
  catch (e) { $('#calGrid').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  await loadAm();
  render();
}

async function loadAm() {
  try { amData = await api(`/api/am/calendar?start=${start}&end=${addDays(start, DAYS - 1)}`); } catch { amData = null; }
}

const layerOn = k => { const el = $(`[data-layer="${k}"]`); return !el || el.checked; };

// 날짜 미정 보관함 (브리프에서 기간을 비워 둔 기획안)
function renderUndated() {
  const box = $('#amUndated');
  const xs = (amData?.undated || []);
  box.classList.toggle('hidden', !xs.length || !layerOn('am'));
  box.innerHTML = xs.length ? `<span class="cap">날짜 미정 기획안 ${xs.length}개</span>${xs.map(x => `<button class="am-chip-undated" data-amopen="${esc(x.id)}" title="눌러서 열기">${esc(x.title)}${x.myeongbun ? ` <span class="cap">${esc(x.myeongbun)}</span>` : ''}</button>`).join('')}` : '';
}

// 기획안 행 → 날짜별 하루특가 수, 상시 막대(프로모션명별)
function planOverlay() {
  return { deals: {}, bars: [] };   // 작업대 겹 없음 (기획안 겹은 amData가 그림)
  const deals = {}, bars = {};
  currentRows().forEach(r => {
    if (!r.start) return;
    if (r.type === '하루특가') { (deals[r.start] = deals[r.start] || []).push(r); return; }
    const k = r.promo || '(이름 없음)';
    const b = (bars[k] = bars[k] || { promo: k, type: '기획안', start: r.start, end: r.end || r.start, rows: 0, plan: true });
    if (r.start < b.start) b.start = r.start;
    if ((r.end || r.start) > b.end) b.end = r.end || r.start;
    b.rows++;
  });
  return { deals, bars: Object.values(bars) };
}

function render() {
  if (!data) return;
  closePop();
  const ov = planOverlay();
  const today = data.today;
  const byDay = new Map(data.days.map(d => [d.date, d]));
  const label = amData?.status_label || {};
  const amBars = layerOn('am') ? (amData?.dated || []).map(p => ({ promo: p.title, type: '기획안', start: p.period.start, end: p.period.end,
    rows: p.rows, am: true, id: p.id, status: label[p.status] || '기획 중' })) : [];
  const allBars = [...(layerOn('promo') ? data.bars : []), ...ov.bars, ...amBars];
  const wdx = state.levers?.weekday_index || [];
  let html = '<div class="cal-head">' + '월화수목금토일'.split('').map((w, i) => `<div>${w} <span class="cap" title="평소 몰 매출 요일 지수(평균 1)">${wdx[i] ? wdx[i].toFixed(2) : ''}</span></div>`).join('') + '</div>';
  for (let w = 0; w < DAYS / 7; w++) {
    const ws = addDays(start, w * 7), we = addDays(ws, 6);
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const k = addDays(ws, i), d = byDay.get(k) || { deals: [], seasons: [] };
      const planN = layerOn('am') ? (amData?.dated || []).reduce((a, p) => a + ((p.deal_days || {})[k] || 0), 0) : 0, n = d.deals.length;   // 내 기획안의 그날 하루특가 수
      const future = k > today;
      const first = i === 0 || k.endsWith('-01');
      const ss = (layerOn('season') ? d.seasons : []).map(s => `<span class="sea s${s.kind}" title="${esc(s.type || '')} · ${esc(s.name)}">${s.cont ? '◂ ' : ''}${esc(s.name)}</span>`).join('');
      const deal = n || planN
        ? `<span class="dn-n ${n + planN > data.summary.max_deals_per_day ? 'crowd' : ''}">특가 <b>${n}</b>${planN ? `<span class="pl">+기획 ${planN}</span>` : ''}</span>`
        : (future ? '<span class="gap">! 특가 없음</span>' : '<span class="mute cap">특가 없음</span>');
      const wdi = d.wd_index || 1;
      cells.push(`<button class="day ${k === today ? 'today' : ''} ${k < today ? 'past' : ''} ${future && !n && !planN ? 'is-gap' : ''} ${wdi >= 1.15 ? 'wd-hi' : wdi < 0.8 ? 'wd-lo' : ''}" data-day="${k}" title="${k} · 평소 매출 요일 지수 ${wdi.toFixed(2)} · 눌러서 상세">
        <span class="dh"><b>${first ? `${+k.slice(5, 7)}/${+k.slice(8)}` : +k.slice(8)}</b>${k === today ? '<span class="tg">오늘</span>' : ''}</span>
        <span class="ss">${ss}</span>${deal}</button>`);
    }
    const bars = allBars.filter(b => b.start <= we && b.end >= ws)
      .sort((a, b) => (!!b.am - !!a.am) || (a.plan === b.plan ? 0 : a.plan ? 1 : -1) || a.start.localeCompare(b.start) || b.rows - a.rows)
      .map(b => {
        const c0 = Math.max(0, diff(ws, b.start)) + 1, c1 = Math.min(6, diff(ws, b.end)) + 1;
        const cont = b.start < ws ? '◂ ' : '', more = b.end > we ? ' ▸' : '';
        if (b.am) {
          return `<button class="ev am" data-c0="${c0}" data-c1="${c1}" data-amopen="${esc(b.id)}" title="${esc(`${b.promo} · ${b.status} · ${mmdd(b.start)}~${mmdd(b.end)} · 눌러서 기획안 열기`)}">${cont}${esc(b.promo)} <span class="n">${esc(b.status)}${b.rows ? ` · ${b.rows}행` : ''}</span>${more}</button>`;
        }
        const rr = b.min_rate !== undefined && b.min_rate !== null ? ` · ${pct(b.min_rate)}${b.max_rate !== b.min_rate ? '~' + pct(b.max_rate) : ''}` : '';
        return `<button class="ev ${b.plan ? 'plan' : ''} ${b.type !== '상시' && !b.plan ? 'etc' : ''}" data-c0="${c0}" data-c1="${c1}" data-bar="${esc(JSON.stringify(b))}"
          title="${esc(`${b.promo} ${b.type} ${mmdd(b.start)}~${mmdd(b.end)} · ${b.rows}품목`)}">${cont}${b.plan ? '기획안 · ' : ''}${esc(b.promo)} <span class="n">${b.rows}품목${rr}</span>${more}</button>`;
      }).join('');
    html += `<div class="wk"><div class="wk-days">${cells.join('')}</div><div class="wk-bars">${bars || '<span class="cap mute nobar">상시 행사 없음</span>'}</div></div>`;
  }
  $('#calGrid').innerHTML = html;
  $$('#calGrid .ev').forEach(el => { el.style.gridColumn = `${el.dataset.c0} / ${+el.dataset.c1 + 1}`; });
  kpis(ov);
  $('#calLegend').innerHTML = `<span class="ev-key am">내 기획안 (눌러서 열기)</span><span class="ev-key">잡힌 행사: PROMO_WORK 상시 행사</span><span class="ev-key plan">점선: 작업대의 지금 행</span>
    <span class="gap">! 특가 없음</span><span class="cap">앞으로의 날 중 하루특가가 비어 있는 날</span><span class="sea sday">명분</span><span class="sea sprep">준비 시작</span><span class="wdkey">진한 칸: 평소 잘 팔리는 요일</span>
    <span class="cap">${esc(data.note)}</span>`;
  renderUndated();
}

function kpis(ov) {
  const s = data.summary;
  const planDays = Object.keys(ov.deals);
  const gaps = s.deal_gap_days.filter(d => !planDays.includes(d));
  const nextSeason = seasons.find(x => x.d_day >= 0);
  $('#calKpis').innerHTML = `
    <div class="kpi"><div class="k">보는 기간</div><div class="v">${mmdd(data.start)}~${mmdd(data.end)}</div><div class="s">4주 · 월요일 시작</div></div>
    <div class="kpi ${gaps.length ? 'warn' : 'ok'}"><div class="k">하루특가 빈 날 (앞으로)</div><div class="v">${gaps.length}<span class="cap"> / ${s.future_days}일</span></div><div class="s">${gaps.length ? gaps.slice(0, 4).map(mmdd).join(', ') + (gaps.length > 4 ? ' 외' : '') : '빈 날 없음'}${planDays.length ? ' · 기획안 반영' : ''}</div></div>
    <div class="kpi"><div class="k">하루특가 품목</div><div class="v">${s.deal_items}</div><div class="s">PROMO_WORK · 하루 참고 상한 ${s.max_deals_per_day}개</div></div>
    <div class="kpi"><div class="k">상시 행사</div><div class="v">${s.bars}</div><div class="s">이 기간에 걸친 행사 이름 수</div></div>
    <div class="kpi"><div class="k">다음 시즌</div><div class="v">${nextSeason ? `D-${nextSeason.d_day}` : '-'}</div><div class="s">${nextSeason ? `${esc(nextSeason.name)} ${mmdd(nextSeason.date)} · 준비 ${mmdd(nextSeason.prep_start)}~` : '시즌 일정을 추가하세요'}</div></div>`;
}

function showBar(el) {
  const b = JSON.parse(el.dataset.bar);
  openPop(el, `<h4>${esc(b.promo)} <span class="cap">${esc(b.type)}</span></h4>
    <div class="sm">${mmdd(b.start)}~${mmdd(b.end)} · ${b.rows}품목${b.min_rate !== undefined && b.min_rate !== null ? ` · 할인 ${pct(b.min_rate)}~${pct(b.max_rate)}` : ''}</div>
    <div class="acts mt8">${b.plan ? '<button class="btn sm" data-pa="plan">기획안 보기</button>' : '<button class="btn sm" data-pa="review">지난 행사에서 찾기</button>'}</div>`,
  pop => {
    pop.querySelector('[data-pa="plan"]')?.addEventListener('click', () => { closePop(); $('.tab[data-view="plan"]').click(); });
    pop.querySelector('[data-pa="review"]')?.addEventListener('click', () => { closePop(); emit('review:search', b.promo); });
  });
}

// ---------------------------------------------------------------- 날짜 상세
async function openDay(day) {
  openSheet('<div class="empty"><span class="spin"></span></div>');
  const planRows = [];
  // 그날에 걸친 내 기획안과 하루특가 편성 (R3)
  let ad = { projects: [] };
  try { ad = await api(`/api/am/day?date=${day}`); } catch { /* 기획안 정보 없이 보여준다 */ }
  const amSeqs = ad.projects.flatMap(p => p.deals.map(x => x.seq)).filter(Boolean).map(String);
  let d;
  try { d = await api('/api/day', { method: 'POST', body: { date: day, exclude: amSeqs } }); }
  catch (e) { openSheet(`<div class="err-box">${esc(e.message)}</div>`); return; }
  const wd = WD[parse(day).getDay()];
  const nm = seq => (state.bySeq.get(String(seq)) || {}).name || seq;
  const planDeals = planRows.filter(r => r.type === '하루특가'), planSangsi = planRows.filter(r => r.type !== '하루특가');
  const past = day <= (state.meta?.sales_last_day || '');
  const deals = d.deals.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.promo)}</td><td class="num">${pct(x.rate)}</td><td class="num ${x.cost_ratio_after > state.target ? 'over' : ''}">${pct(x.cost_ratio_after)}</td>
    ${past ? `<td class="num">${man(x.promo_sales)}</td><td class="num">${x.lift ? x.lift.toFixed(1) + '배' : '-'}</td>` : ''}</tr>`).join('');
  const running = d.running.map(g => `<tr><td>${esc(g.promo)}</td><td>${esc(g.type)}</td><td class="num">${mmdd(g.start)}~${mmdd(g.end)}</td><td class="num">${g.rows}</td><td class="num">${g.min_rate !== null ? `${pct(g.min_rate)}${g.max_rate !== g.min_rate ? '~' + pct(g.max_rate) : ''}` : '-'}</td></tr>`).join('');
  const cands = d.candidates.map(c => `<tr><td class="name"><span class="n" title="${esc(c.name)}">${esc(c.name)}</span></td><td class="num">${pct(c.max_discount)}</td><td class="num"><b>${pct(c.suggest_rate)}</b></td>
    <td class="num">${man(c.exp_sales)}</td><td class="num">${man(c.exp_profit)}</td><td class="num">${c.last_deal ? mmdd(c.last_deal) : '<span class="mute">없음</span>'}</td>
    <td><button class="btn sm" data-cadd="${c.seq}" data-rate="${c.suggest_rate}">담기</button></td></tr>`).join('');
  const ly = d.ly.available ? d.ly.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="num">${man(r.ly_sales)}</td><td class="cap">${esc((r.ly_promos || []).join(', ') || '행사 없음')}</td></tr>`).join('') : '';
  openSheet(`<button class="btn ghost x" data-close-sheet>닫기 ✕</button>
    <h2>${mmdd(day)} (${wd})</h2>
    <div class="cap">${esc(day)}${d.seasons.length ? ' · ' + d.seasons.map(s => `<span class="sea ${day >= s.date && day <= s.end ? 'sday' : 'sprep'}">${esc(s.name)} ${s.d_day > 0 ? 'D-' + s.d_day : s.d_day === 0 ? 'D-day' : ''}</span>`).join(' ') : ''}</div>
    ${d.seasons.some(s => (s.seeds || []).length) ? `<div class="seeds">${d.seasons.flatMap(s => (s.seeds || []).map(x => `<span class="seed">${esc(x)}</span>`)).join('')}</div>` : ''}
    <h3>이 날의 내 기획안 ${ad.projects.length}개</h3>
    ${ad.projects.length ? `<ul class="am-dayplans">${ad.projects.map(p => `<li><div class="grow"><span class="am-v">${esc(p.title)}</span><div class="cap">${mmdd(p.period.start)}~${mmdd(p.period.end)} · ${p.has_deal_section ? `하루특가 ${p.filled}/${p.slots}자리` : (p.filled ? `하루특가 ${p.filled}개 · 페이지에 하루특가 섹션 없음` : '하루특가 섹션 없음')}</div>${p.deals.length ? `<div class="cap">${p.deals.map(x => esc(x.items ? '신규 조합' : nm(x.seq)) + ' ' + pct(x.rate)).join(', ')}</div>` : ''}</div><button class="btn sm" data-amday="${esc(p.id)}">편성 보기</button></li>`).join('')}</ul>` : '<div class="cap">이 날짜를 기간에 포함한 기획안이 없어요. 후보를 담으면 기획안을 고르거나 새로 만들 수 있어요.</div>'}
    <h3>하루특가: PROMO_WORK에 잡힌 ${d.deals.length}개${d.deals.length > 6 ? ' <span class="over">(많음)</span>' : ''}</h3>
    ${deals ? `<table class="mini"><thead><tr><th>상품</th><th>행사</th><th class="num">할인</th><th class="num">원가율</th>${past ? '<th class="num">행사 매출(만원)</th><th class="num">평소 대비</th>' : ''}</tr></thead><tbody>${deals}</tbody></table>` : '<div class="cap">잡힌 하루특가가 없어요</div>'}
    <h3>진행 중 상시 행사 ${d.running.length}개${planSangsi.length ? ` · 기획안 ${planSangsi.length}행` : ''}</h3>
    ${running ? `<table class="mini"><thead><tr><th>행사</th><th>유형</th><th class="num">기간</th><th class="num">품목</th><th class="num">할인</th></tr></thead><tbody>${running}</tbody></table>` : '<div class="cap">없음</div>'}
    ${d.candidates.length ? `<h3>이 날 하루특가 후보</h3><table class="mini cand"><thead><tr><th>상품</th><th class="num">최대</th><th class="num">제안</th><th class="num" title="최근 28일 일평균 × 과거 하루특가 반응도">예상매출(만)</th><th class="num" title="예상 수량 × (할인가÷1.1 − 원가)">예상이익(만)</th><th class="num">지난특가</th><th></th></tr></thead><tbody>${cands}</tbody></table>` : (parse(day) > new Date() ? '<h3>이 날 하루특가 후보</h3><div class="cap">조건에 맞는 후보가 없어요</div>' : '')}
    ${ly ? `<h3>작년 이 날(${esc(d.ly.ly_from)}) 잘 팔린 상품</h3><table class="mini"><thead><tr><th>상품</th><th class="num">작년 매출(만원)</th><th>작년 행사</th></tr></thead><tbody>${ly}</tbody></table>` : ''}
    <p class="cap mt12">${esc(d.note)}</p>`,
  sheet => { sheet.querySelectorAll('[data-amday]').forEach(b => b.addEventListener('click', () => { closeSheet(); emit('am:open-step', { id: b.dataset.amday, step: 'promo', sub: 'deals' }); }));
  sheet.querySelectorAll('[data-cadd]').forEach(b => b.addEventListener('click', () => {
    emit('plan:add', { seq: b.dataset.cadd, type: '하루특가', start: day, end: day, rate: +b.dataset.rate, promo: '하루특가' });
    b.disabled = true; setTimeout(() => { b.disabled = false; }, 1500);   // 결과는 담기 알림이 알려준다
  })); });
}

// ---------------------------------------------------------------- 다가오는 명분 카드
let mbKind = '';
function renderMb() {
  const kinds = [...new Set(seasons.map(x => x.kind))];
  $('#mbKind').innerHTML = ['', ...kinds].map(k => `<button class="chip ${k === mbKind ? 'on' : ''}" data-mk="${esc(k)}">${k || '전체'}</button>`).join('');
  const xs = seasons.filter(x => x.d_day >= -3 && x.d_day <= 60 && (!mbKind || x.kind === mbKind)).slice(0, 12);
  $('#mbCards').innerHTML = xs.map(x => `<article class="mb">
    <div class="kick">${esc(x.kind)} · ${x.d_day > 0 ? 'D-' + x.d_day : x.d_day === 0 ? 'D-day' : '진행 중'}</div>
    <h3>${esc(x.name)} <span class="cap">${mmdd(x.date)}${x.end !== x.date ? '~' + mmdd(x.end) : ''}${x.lead ? ` · 준비 ${mmdd(x.prep_start)}~` : ''}</span></h3>
    <div class="seeds">${(x.seeds || []).map(sd => `<span class="seed">${esc(sd)}</span>`).join('') || '<span class="cap">씨앗 없음: 명분 사전에서 추가</span>'}</div>
    ${(x.seed_flags || []).length ? `<div class="cap over">효능 표현 주의: ${esc(x.seed_flags.join(', '))}</div>` : ''}
    <div class="mbfacts">
      ${x.month_index_ly ? `<span>작년 같은 달 매출 지수 <b>${x.month_index_ly.toFixed(2)}</b></span>` : ''}
      ${x.booked.length ? `<span>잡힌 행사 <b>${x.booked.reduce((a, b) => a + b.rows, 0)}품목</b></span>` : '<span class="gap">잡힌 행사 없음</span>'}
    </div>
    ${(x.past || []).length ? `<div class="past">${x.past.map(w => `<button class="pastw" data-wave="${esc(w.key)}">지난 ${esc(w.promo)} ${esc(w.type)} · ${w.rows}품목 · ${man(w.promo_sales)}만${w.lift_median && w.type === '하루특가' ? ` · ${w.lift_median.toFixed(1)}배` : ''}</button>`).join('')}</div>` : ''}
    ${x.memo ? `<div class="cap">${esc(x.memo)}</div>` : ''}
    <div class="acts"><button class="btn sm" data-mbday="${x.date}">캘린더에서 보기</button><button class="btn sm primary" data-mbplan="${esc(x.name)}|${x.date}">이 명분으로 기획 시작</button></div>
  </article>`).join('') || '<div class="empty">60일 안 명분이 없어요. 명분 사전에 추가하세요</div>';
}

// R11: 지난 같은 명분 행사를 누르면 성과 화면으로 빠지지 않고 작은 미리보기
function previewWave(el) {
  const key = el.dataset.wave;
  const w = seasons.flatMap(x => x.past || []).find(p => p.key === key); if (!w) { emit('review:open', key); return; }
  openPop(el, `<h4>${esc(w.promo)} <span class="cap">${esc(w.type)}</span></h4>
    <div class="sm">${mmdd(w.start)}~${mmdd(w.end)} · ${w.rows}품목 · 행사 매출 ${man(w.promo_sales)}만원${w.avg_rate ? ` · 평균 할인 ${pct(w.avg_rate)}` : ''}${w.lift_median && w.type === '하루특가' ? ` · 평소 대비 ${w.lift_median.toFixed(1)}배` : ''}</div>
    <p class="cap mt8">이 행사의 상품, 할인율, 날짜 간격을 올해 날짜로 가져올 수 있어요. 컨셉은 가져오지 않아요.</p>
    <div class="acts"><button class="btn sm primary" data-pw="replan">지난 행사 상품·할인 가져오기</button><button class="btn sm" data-pw="review">성과 자세히 보기</button></div>`,
  pop => { pop.onclick = ev => {
    const b = ev.target.closest('[data-pw]'); if (!b) return;
    closePop();
    if (b.dataset.pw === 'replan') emit('replan:open', w.promo); else emit('review:open', key);
  }; });
}

function onMbClick(e) {
  const k = e.target.closest('[data-mk]'); if (k) { mbKind = k.dataset.mk; renderMb(); return; }
  const w = e.target.closest('[data-wave]'); if (w) { previewWave(w); return; }
  const d = e.target.closest('[data-mbday]'); if (d) { start = monday(d.dataset.mbday); load().then(() => { window.scrollTo(0, 0); openDay(d.dataset.mbday); }); return; }
  const pl = e.target.closest('[data-mbplan]');
  if (pl) {
    const [name, date] = pl.dataset.mbplan.split('|');
    const x = seasons.find(y => y.name === name && y.date === date); if (!x) return;
    // AMOREAD: 명분을 담은 통합 기획안을 만들고 브리프를 연다 (기간·명분 사전 연결·씨앗이 함께 넘어감)
    emit('am:new-from-season', x);
  }
}

// ---------------------------------------------------------------- 명분 사전 편집
let seasonItems = [];
const KINDS = ['명절·대목', '기념일', '절기·세시', '학사·생활', '직장', '차 고유', '날씨·계절', '쇼핑', '트렌드'];
async function loadSeasons() {
  try { const r = await api('/api/seasons'); seasonItems = r.items; seasons = r.view; } catch (e) { $('#seasonBody').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  renderSeasons(); renderMb(); if (data) kpis(planOverlay());
}

function renderSeasons() {
  const view = new Map(seasons.map(s => [`${s.name}|${s.date}`, s]));
  $('#seasonBody').innerHTML = `<div class="tbl-wrap"><table class="mini season"><thead><tr><th>날짜</th><th>종료일</th><th>이름</th><th>종류</th><th class="num">준비(일 전)</th><th>지난 행사 키워드</th><th>씨앗 (|로 구분)</th><th>메모</th><th class="num">D-day</th><th></th></tr></thead><tbody>
    ${seasonItems.map((s, i) => { const v = view.get(`${s.name}|${s.date}`); return `<tr>
      <td><input type="date" data-si="${i}" data-sf="date" value="${esc(s.date)}"></td>
      <td><input type="date" data-si="${i}" data-sf="end" value="${esc(s.end !== s.date ? s.end : '')}"></td>
      <td><input type="text" data-si="${i}" data-sf="name" value="${esc(s.name)}" class="w120"></td>
      <td><select data-si="${i}" data-sf="kind">${KINDS.map(k => `<option ${k === s.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
      <td class="num"><input type="number" data-si="${i}" data-sf="lead" value="${s.lead}" min="0" max="120" class="w64"></td>
      <td><input type="text" data-si="${i}" data-sf="keyword" value="${esc(s.keyword)}" class="w80" placeholder="예: 블프"></td>
      <td><input type="text" data-si="${i}" data-sf="seeds" value="${esc((s.seeds || []).join('|'))}" class="w300"></td>
      <td><input type="text" data-si="${i}" data-sf="memo" value="${esc(s.memo)}" class="w200"></td>
      <td class="num">${v ? (v.d_day >= 0 ? 'D-' + v.d_day : '지남') : '<span class="mute">-</span>'}</td>
      <td><button class="btn ghost sm" data-sdel="${i}">삭제</button></td></tr>`; }).join('')}</tbody></table></div>
    <div class="row mt8"><button class="btn sm" data-sadd>+ 명분 추가</button><button class="btn sm primary" data-ssave>저장</button>
    <span class="cap">키워드를 적으면 그 이름이 든 행사를 '잡힌 행사'·'지난 성과'로 연결해요. 씨앗은 오설록과 엮는 각도, 효능 표현(감기·면역 등)은 쓰지 마세요. 절기·음력 날짜는 ±1일 확인.</span></div>`;
  $('#seasonBody').oninput = e => { const el = e.target; if (el.dataset.si === undefined) return; const it = seasonItems[+el.dataset.si]; const f = el.dataset.sf; it[f] = f === 'lead' ? +el.value : f === 'seeds' ? el.value.split('|') : el.value; };
  $('#seasonBody').onchange = $('#seasonBody').oninput;
}

async function onSeasonClick(e) {
  if (e.target.closest('[data-sadd]')) { seasonItems.push({ date: iso(new Date()), end: '', name: '', kind: '기념일', lead: 21, keyword: '', seeds: [], memo: '' }); renderSeasons(); return; }
  const del = e.target.closest('[data-sdel]');
  if (del) { seasonItems.splice(+del.dataset.sdel, 1); renderSeasons(); return; }
  if (e.target.closest('[data-ssave]')) {
    try {
      const r = await api('/api/seasons', { method: 'POST', body: { items: seasonItems.map(s => ({ ...s, end: s.end && s.end !== s.date ? s.end : '', lead: +s.lead || 0, seeds: (s.seeds || []).join('|') })) } });
      toast(`명분 ${r.saved}건 저장`); await loadSeasons(); load(); emit('alerts:reload');
    } catch (err) { toast(err.message); }
  }
}
