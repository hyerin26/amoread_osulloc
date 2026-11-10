// 시장 신호: 네이버 검색 트렌드(키워드 그룹) × 오설록 연결 상품 실적 + 오설록몰 고객 리뷰 반응
import { $, api, delta, emit, esc, man, openPop, pct, toast, won } from './core.js';

let data = null, loaded = false, groups = [];

export function initSignals() {
  $('#sigRefresh').addEventListener('click', refresh);
  $('#sigTrend').addEventListener('click', e => {
    const b = e.target.closest('[data-tplan]'); if (b) { planFrom(b.dataset.tplan); return; }
    const ts = e.target.closest('[data-tseason]'); if (ts) { emit('am:trend-season', { term: ts.dataset.tseason, memo: `검색 트렌드 그룹 ${ts.dataset.tseason}` }); return; }
    const t = e.target.closest('[data-tprod]'); if (t) showProducts(t, t.dataset.tprod);
  });
  $('#sigReview').addEventListener('click', e => {
    const a = e.target.closest('[data-radd]');
    if (a) { emit('plan:add', { seq: a.dataset.radd, type: '상시', rate: 0.2, memo: a.dataset.memo });  e.stopPropagation(); return; }
    const r = e.target.closest('[data-rq]'); if (r) showQuotes(r);
  });
  $('#sigGroups').addEventListener('click', onGroupsClick);
}

export async function showSignals() { if (!loaded) { loaded = true; await load(); loadGroups(); } }
export function reloadSignals() { loaded = false; if ($('#view-signals').classList.contains('on')) showSignals(); }

async function load() {
  try { data = await api('/api/signals'); } catch (e) { $('#sigTrend').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  render();
}

async function refresh() {
  const b = $('#sigRefresh'); b.disabled = true; b.textContent = '받는 중…';
  try { const r = await api('/api/signals/refresh', { method: 'POST' }); data.trends = r.trends; render(); toast('검색 트렌드를 새로 받았습니다'); emit('alerts:reload'); }
  catch (e) { toast(e.message, 4500); }
  finally { b.disabled = false; b.textContent = '검색 트렌드 새로 받기'; }
}

const sgn = v => (v === null || v === undefined) ? '-' : delta(v);

function line(series) {
  if (!series.length) return '';
  const w = 300, h = 54, n = series.length;
  const x = i => (i / (n - 1 || 1) * w).toFixed(1), y = v => (h - 3 - (v / 100) * (h - 8)).toFixed(1);
  const ly = n - 52;
  return `<svg class="tline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="주별 검색 지수 (최근 ${n}주)">
    ${ly > 0 ? `<line class="ly" x1="${x(ly)}" x2="${x(ly)}" y1="0" y2="${h}"/><line class="ly" x1="${x(ly + 4)}" x2="${x(ly + 4)}" y1="0" y2="${h}"/>` : ''}
    <polyline points="${series.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>
    <circle cx="${x(n - 1)}" cy="${y(series[n - 1])}" r="2.5"/></svg>`;
}

function render() {
  const t = data.trends, rv = data.reviews;
  $('#sigState').textContent = t.fetched_at ? `검색 트렌드 ${t.fetched_at} 받음 · 주 단위 ~${t.end}` : (t.has_keys ? '아직 받지 않음' : '네이버 API 키 없음');
  $('#sigRefresh').classList.toggle('hidden', !t.has_keys);
  const withData = t.groups.filter(g => g.status === 'ok');
  let html = '';
  if (!t.has_keys) html += '<p class="cap">네이버 키가 없어서 검색량 그래프는 아직 없어요. 위 안내대로 키를 넣으면 이 그룹들과 스카우트 후보가 함께 검증돼요. 아래 표는 우리 실적 쪽 계절 흐름이에요.</p>';
  if (withData.length) {
    html += `<div class="sec-head mt12"><h2>검색 수요 × 오설록 매출</h2><span class="cap">${esc(t.note)}</span></div><div class="tcards">${withData.map(card).join('')}</div>`;
  }
  // 키가 없거나 아직 못 받은 그룹: 우리 실적 쪽 계절 흐름만이라도 표로
  const rest = t.groups.filter(g => g.status !== 'ok');
  if (rest.length) {
    html += `<div class="card mt12"><div class="sec-head"><h2>키워드 그룹 · 연결된 오설록 상품</h2><span class="cap">검색 지수를 받기 전에도 우리 실적의 계절 흐름은 볼 수 있어요</span></div>
      <div class="tbl-wrap"><table class="t compact"><thead><tr><th>그룹</th><th>검색어</th><th class="num">연결 상품</th><th class="num">28일 매출(만원)</th><th class="num">직전 28일 대비</th><th class="num" title="최근 28일 ÷ 작년 같은 28일(364일 전)">작년 대비</th><th class="num" title="작년 이 시기: 지난 4주 → 다음 4주 매출 변화 (364일 전)">작년 다음 4주</th><th>매출 1위</th><th></th></tr></thead><tbody>
      ${rest.map(g => `<tr><td><b>${esc(g.name)}</b>${g.status === 'keywords_changed' ? ' <span class="tag old">검색어 바뀜: 새로 받기</span>' : ''}</td><td class="cap">${esc(g.keywords.join(', '))}</td><td class="num">${g.ours.products}</td><td class="num">${man(g.ours.sales_28)}</td><td class="num">${sgn(g.ours.growth)}</td><td class="num">${sgn(g.ours.yoy)}</td><td class="num">${sgn(g.ours.ly_ahead)}</td>
        <td class="cap">${esc(g.ours.top[0]?.name || '-')}</td><td class="act"><button class="btn sm" data-tprod="${esc(g.name)}">상품</button> <button class="btn sm" data-tplan="${esc(g.name)}">이 말로 기획 시작</button> <button class="btn sm ghost" data-tseason="${esc(g.name)}">이 시기 명분으로 남기기</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  $('#sigTrend').innerHTML = html;
  renderReviews(rv);
}

function card(g) {
  const m = g.metrics, o = g.ours;
  const sig = g.signals.map(s => `<span class="status ${s.level === 'important' ? 'warn' : 'ok'}">${s.level === 'important' ? '!' : 'i'} ${esc(s.text)}</span>`).join('');
  return `<article class="tcard">
    <div class="row"><b class="h">${esc(g.name)}</b><span class="cap grow">${esc(g.keywords.slice(0, 4).join(' · '))}</span></div>
    ${line(g.series)}
    <div class="cap tl-key">최근 ${g.series.length}주 · 세로 점선 = 작년 이맘때 4주</div>
    <div class="facts">
      <span>검색 4주<b>${sgn(m.momentum)}</b></span><span>작년 대비<b>${sgn(m.yoy)}</b></span><span title="작년 이맘때 이후 4주 검색 변화">작년 다음 4주<b>${sgn(m.ly_ahead)}</b></span>
      <span class="sep"></span>
      <span>우리 28일<b>${man(o.sales_28)}만</b></span><span title="연결 상품 최근 28일 ÷ 작년 같은 28일">우리 작년 대비<b>${sgn(o.yoy)}</b></span>
    </div>
    <div class="sigs">${sig || '<span class="cap">특이 신호 없음</span>'}</div>
    <div class="acts"><button class="btn sm" data-tprod="${esc(g.name)}">연결 상품 ${o.products}</button><button class="btn sm primary" data-tplan="${esc(g.name)}">이 말로 기획 시작</button><button class="btn sm ghost" data-tseason="${esc(g.name)}">이 시기 명분으로 남기기</button></div>
  </article>`;
}

function showProducts(anchor, name) {
  const g = data.trends.groups.find(x => x.name === name); if (!g) return;
  openPop(anchor, `<h4>${esc(name)}: 연결 상품 매출 상위</h4><table class="mini"><thead><tr><th>상품</th><th class="num">28일(만)</th><th class="num">변화</th><th class="num">최대 할인</th></tr></thead><tbody>
    ${g.ours.top.map(p => `<tr><td>${esc(p.name)}${p.scheduled ? ' <span class="tag plan">예정</span>' : ''}</td><td class="num">${man(p.sales_28)}</td><td class="num">${sgn(p.growth_28)}</td><td class="num">${pct(p.max_discount)}</td></tr>`).join('')}</tbody></table>
    <div class="cap mt8">상품명 포함어: ${esc((g.match || []).join(', ') || '-')}${g.category ? ` · 카테고리 ${esc(g.category)}` : ''}</div>`);
}

async function planFrom(name) {
  try {
    const r = await api('/api/signals/plan', { method: 'POST', body: { group: name } });
    // R12: 트렌드는 명분 입구. 연결 상품은 후보 상품(역할 미정)으로만 담는다. 연결 상품이 없어도 브리프는 시작할 수 있다
    emit('am:trend-start', { term: name, rows: r.rows || [], rationale: r.rationale || '', source: '검색 트렌드' });
  } catch (e) { toast(e.message); }
}

// ---------------------------------------------------------------- 고객 리뷰
function renderReviews(rv) {
  if (!rv.available) { $('#sigReview').innerHTML = `<div class="card"><h2>고객 반응</h2><div class="cap">리뷰 수집기 결과(${esc(rv.source_dir_hint)}\\리뷰_*.csv)를 찾지 못했어요. 리뷰 주간 수집기가 돌면 자동으로 연결됩니다.</div></div>`; return; }
  const row = r => `<tr class="click" data-rq="${esc(r.seq)}"><td class="name"><span class="n" title="${esc(r.name)}">${esc(r.name)}</span></td><td class="num">${r.n}</td><td class="num">${r.avg ? r.avg.toFixed(1) : '-'}</td>
    <td class="num">${r.gift || '<span class="mute">0</span>'}</td><td class="num">${r.repeat || '<span class="mute">0</span>'}</td><td class="num">${pct(r.max_discount)}</td>
    <td>${r.scheduled ? '<span class="tag plan">예정</span>' : ''}</td>
    <td class="act"><button class="btn sm rowbtn" data-radd="${esc(r.seq)}" data-memo="${esc(`리뷰 ${r.n}건 평점 ${r.avg ? r.avg.toFixed(1) : '-'}${r.gift ? ` · 선물 언급 ${r.gift}` : ''}`)}">+ 담기</button></td></tr>`;
  const head = '<thead><tr><th>상품</th><th class="num">리뷰</th><th class="num">평점</th><th class="num" title="후기에 선물·부모님·지인 등">선물 언급</th><th class="num" title="재구매·또 구매 등">재구매 언급</th><th class="num">최대 할인</th><th></th><th></th></tr></thead>';
  $('#sigReview').innerHTML = `<div class="sec-head"><h2>고객 반응: 오설록몰 리뷰</h2><span class="cap">${esc(rv.note)}</span></div>
    <div class="two-col rv">
      <div class="card"><h2>반응 좋은 상품 <span class="cap">신규 유입·대표 상품 노출용</span></h2><div class="tbl-wrap"><table class="t compact">${head}<tbody>${rv.good.slice(0, 15).map(row).join('') || '<tr><td colspan="8" class="mute">없음</td></tr>'}</tbody></table></div></div>
      <div class="card"><h2>선물 언급 많은 상품 <span class="cap">선물 기획·명절 얼리버드용</span></h2><div class="tbl-wrap"><table class="t compact">${head}<tbody>${rv.gift.slice(0, 15).map(row).join('') || '<tr><td colspan="8" class="mute">없음</td></tr>'}</tbody></table></div>
        ${rv.low.length ? `<h3>아쉬운 리뷰가 있는 상품 <span class="cap">평점 3 이하: 행사 전에 원인 확인</span></h3><ul class="lows">${rv.low.slice(0, 5).map(r => `<li><b>${esc(r.name)}</b> <span class="cap">${r.low}건 · 평점 ${r.avg ? r.avg.toFixed(1) : '-'}</span><div class="cap">“${esc(r.low_quotes[0] || '')}”</div></li>`).join('')}</ul>` : ''}</div>
    </div>`;
}

function showQuotes(tr) {
  const all = [...data.reviews.good, ...data.reviews.gift, ...data.reviews.low];
  const r = all.find(x => x.seq === tr.dataset.rq); if (!r) return;
  openPop(tr.querySelector('td'), `<h4>${esc(r.name)}</h4><div class="cap">리뷰 ${r.n}건 · 평점 ${r.avg ? r.avg.toFixed(1) : '-'} · 선물 ${r.gift} · 재구매 ${r.repeat} · 할인 언급 ${r.discount}</div>
    <ul>${r.quotes.map(q => `<li>“${esc(q)}”</li>`).join('')}</ul>
    <div class="cap">후기 일부(60자)만 근거로 보여줘요. 광고 문구로 쓸 땐 그대로 옮기지 말고 요약해서 쓰세요.</div>
    <div class="acts mt8"><button class="btn sm" data-pdet>상품 상세</button></div>`,
  pop => pop.querySelector('[data-pdet]').addEventListener('click', () => { $('.tab[data-view="products"]').click(); emit('product:open', r.seq); }));
}

// ---------------------------------------------------------------- 키워드 그룹 편집
async function loadGroups() {
  try { groups = (await api('/api/settings/trend-groups')).items; } catch { groups = []; }
  renderGroups();
}
function renderGroups() {
  $('#sigGroups').innerHTML = `<table class="mini season"><thead><tr><th>그룹</th><th>검색어 (;로 구분, 최대 20개)</th><th>상품명 포함어 (;)</th><th>카테고리</th><th>메모</th><th></th></tr></thead><tbody>
    ${groups.map((g, i) => `<tr><td><input type="text" class="w120" data-gi="${i}" data-gf="name" value="${esc(g.name)}"></td>
      <td><input type="text" class="w300" data-gi="${i}" data-gf="keywords" value="${esc(g.keywords)}"></td>
      <td><input type="text" class="w200" data-gi="${i}" data-gf="match" value="${esc(g.match)}"></td>
      <td><select data-gi="${i}" data-gf="category">${['', '티 세트', '티 제품', '티푸드', '라이프 스타일'].map(c => `<option ${c === g.category ? 'selected' : ''} value="${c}">${c || '전체'}</option>`).join('')}</select></td>
      <td><input type="text" class="w200" data-gi="${i}" data-gf="memo" value="${esc(g.memo)}"></td><td><button class="btn ghost sm" data-gdel="${i}">삭제</button></td></tr>`).join('')}</tbody></table>
    <div class="row mt8"><button class="btn sm" data-gadd>+ 그룹 추가</button><button class="btn sm primary" data-gsave>저장</button><span class="cap">검색어를 바꾸면 [검색 트렌드 새로 받기]를 다시 눌러야 그 그룹 그래프가 나와요. 그룹은 최대 30개.</span></div>`;
  $('#sigGroups').oninput = e => { const el = e.target; if (el.dataset.gi !== undefined) groups[+el.dataset.gi][el.dataset.gf] = el.value; };
  $('#sigGroups').onchange = $('#sigGroups').oninput;
}
async function onGroupsClick(e) {
  if (e.target.closest('[data-gadd]')) { groups.push({ name: '', keywords: '', match: '', category: '', memo: '' }); renderGroups(); return; }
  const d = e.target.closest('[data-gdel]'); if (d) { groups.splice(+d.dataset.gdel, 1); renderGroups(); return; }
  if (e.target.closest('[data-gsave]')) {
    try { const r = await api('/api/settings/trend-groups', { method: 'POST', body: { items: groups } }); toast(`키워드 그룹 ${r.saved}개 저장`); await loadGroups(); await load(); }
    catch (err) { toast(err.message); }
  }
}
