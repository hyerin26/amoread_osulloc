// 진입점: 데이터 불러오기 + 탭 전환 + 화면 초기화
import { $, $$, api, canLeave, closePop, emit, esc, icon, on, state, toast } from './core.js';
import { initIdeas, loadIdeas } from './ideas.js';
import { initProducts, renderProducts } from './products.js';
import { initMix, loadBundles } from './mix.js';
import { initCalendar, showCalendar } from './calendar.js';
import { initReview, reloadReview, showReview } from './review.js';
import { resetLevers } from './levers.js';
import { initSignals, reloadSignals, showSignals } from './signals.js';
import { initScout, showScout } from './scout.js';
import { initPlan } from './plan.js';
import { initSettings, renderSettings } from './settings.js';
import { initChat } from './chat.js';
import { initReplan, resetReplan } from './replan.js';
import { initDday, loadDday } from './dday.js';
import { initSapSales, loadSapSales } from './sapsales.js';
import { initAm, showAm } from './am/hub.js';
import { initIntake } from './am/intake.js';

let metaResp = null;
let bundlesLoaded = false;

async function loadMeta() {
  metaResp = await api('/api/meta');
  state.meta = metaResp.meta;
  state.target = metaResp.target;
  state.claude = metaResp.claude;
  const m = metaResp.meta;
  $('#dataState').innerHTML = m
    ? `<span title="판매실적 마지막 날 (출고일 기준)">실적 ~${esc(m.sales_last_day)}</span><span>·</span><span title="${esc(m.guide_file)}">원가 ${esc(m.cost_sheet)}</span><span>·</span><span>갱신 ${esc((m.built_at || '').slice(5, 16))}</span>`
    : '<span class="over">데이터 없음: [설정]에서 갱신하세요</span>';
  renderSettings(metaResp);
}

async function loadProducts() {
  try {
    const d = await api('/api/products');
    state.products = d.products;
    state.bySeq = new Map(d.products.map(p => [String(p.seq), p]));
  } catch (e) {
    state.products = []; state.bySeq = new Map();
    if (e.code !== 'no_data') toast(e.message);
  }
  try { state.patterns = await api('/api/patterns'); } catch { state.patterns = null; }
  try { state.levers = await api('/api/levers'); } catch { state.levers = null; }
}

// 탭 없는 하위 화면(조합 추천)으로 가기: 기획안 탭을 켠 채로 화면만 바꾼다
function showView(v) {
  closePop();
  $$('.view').forEach(x => x.classList.toggle('on', x.id === `view-${v}`));
  if (v === 'mix') { $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.view === 'am')); if (!bundlesLoaded) { bundlesLoaded = true; loadBundles(); } }
  window.scrollTo(0, 0);
}

async function go(view) {
  const t = $(`.tab[data-view="${view}"]`); if (!t) return;
  if (!(await canLeave({ to: view }))) return;   // 예: 상품·할인에 저장하지 않은 변경이 있으면 먼저 묻는다
  closePop();
  $$('.tab').forEach(x => x.classList.toggle('on', x === t));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === `view-${view}`));
  if (view === 'calendar') showCalendar();
  if (view === 'review') showReview();
  if (view === 'signals') { showScout(); showSignals(); }
  if (view === 'am') showAm();
  window.scrollTo(0, 0);
}

function initTabs() {
  $('#gearBtn').innerHTML = icon('gear');
  document.addEventListener('click', e => {
    const t = e.target.closest('.top .tab'); if (!t) return;
    go(t.dataset.view);
  });
  on('nav:go', go);
  on('view:mix', async () => { if (await canLeave({ to: 'mix' })) showView('mix'); });
  // 조합 추천에서 돌아가기: 작업 중 기획안의 ② 상품·할인
  $('#mixBack').addEventListener('click', () => emit('am:open-step', { step: 'promo' }));
}

async function boot() {
  initTabs();
  try { await loadMeta(); } catch (e) { $('#dataState').innerHTML = `<span class="over">${esc(e.message)}</span>`; return; }
  await loadProducts();
  // 다른 화면에서 조합 추천으로 넘어올 때는 그쪽에서 불러오므로, 화면 전환 시 중복으로 부르지 않게 먼저 표시
  on('bundle:focus', () => { bundlesLoaded = true; });
  on('partner:base', () => { bundlesLoaded = true; });
  initIdeas(); initProducts(); initMix(); initPlan(); initSettings(); initCalendar(); initReview(); initSignals(); initScout(); initChat(); initReplan(); initDday(); initSapSales(); initAm(); initIntake();
  renderProducts();
  loadSapSales();
  // 첫 화면은 캘린더 (이번 주의 할 일·아이디어는 캘린더 옆과 아래로 옮김)
  if (state.meta) { loadIdeas(); loadDday(); go('calendar'); } else $('.tab[data-view="settings"]').click();
  on('data:reload', async () => { resetReplan(); state.patterns = null; bundlesLoaded = false; resetLevers(); await loadMeta(); await loadProducts(); renderProducts(); loadIdeas(); reloadReview(); reloadSignals(); emit('alerts:reload'); });
  on('meta:reload', loadMeta);
}

boot();
