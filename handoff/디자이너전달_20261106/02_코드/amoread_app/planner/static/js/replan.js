// 작년 행사 다시 하기 — 고르기(행사·유형·올해 시작일) → 미리보기(작년 할인율 그대로인지 · 교체 · 확인해 볼 것) → 작업대로
// 숫자는 서버 /api/replan(replan.py)이 만든다. 이 화면은 고르고 보여 주기만 한다.
import { $, api, closeModal, emit, esc, icon, man, mmdd, on, openModal, pct, ribbon, ribbonKey, toast } from './core.js';

let groups = [];          // [{name, core, start, end, waves:[...], types:Set, rows, sales}]
let booked = [];          // 올해 아직 안 끝난 회차 (같은 이름이면 시작일 기본값으로)
let pick = null, result = null;

const core = n => (n || '').replace(/\s/g, '').replace(/^\d+/, '') || (n || '');
const plusDays = (s, n) => { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const yy = s => s ? s.slice(2, 4) + '.' + s.slice(5, 7) + '.' + s.slice(8, 10) : '';

export function initReplan() {
  on('replan:open', q => open(q || ''));
  $('#planReplan')?.addEventListener('click', () => open(''));
}

async function loadGroups() {
  const d = await api('/api/review');
  const done = d.waves.filter(w => w.status === '완료').sort((a, b) => b.start.localeCompare(a.start));
  booked = d.waves.filter(w => w.status !== '완료');
  // 같은 이름(연도 접두 제외)이 7일 안에 시작하면 한 회차 묶음 (상시 + 하루특가)
  const out = [];
  done.forEach(w => {
    const c = core(w.promo);
    const g = out.find(x => x.core === c && Math.abs((new Date(x.start) - new Date(w.start)) / 86400000) <= 7);
    if (g) { g.waves.push(w); g.types.add(w.type); g.rows += w.rows; g.sales += w.promo_sales || 0; if (w.start < g.start) g.start = w.start; if (w.end > g.end) g.end = w.end; }
    else out.push({ name: w.promo, core: c, start: w.start, end: w.end, waves: [w], types: new Set([w.type]), rows: w.rows, sales: w.promo_sales || 0 });
  });
  groups = out;
}

function defaultStart(g) {
  const b = booked.filter(w => core(w.promo) === g.core).sort((a, b2) => a.start.localeCompare(b2.start))[0];
  if (b) return { date: b.start, why: `올해 이미 잡힌 '${b.promo}' 시작일` };
  let s = plusDays(g.start, 364);
  const today = new Date().toISOString().slice(0, 10);
  if (s <= today) { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); s = d.toISOString().slice(0, 10); return { date: s, why: '작년 날짜가 지나 다음 월요일' }; }
  return { date: s, why: '작년과 같은 요일(364일 뒤)' };
}

async function open(query) {
  pick = null; result = null;
  openModal(`<h2>지난 행사 상품·할인 가져오기</h2>
    <div class="steps"><b>1 고르기</b><i></i><span>2 미리보기</span><i></i><span>3 기획안에 담기</span></div>
    <div class="empty"><span class="spin"></span> 지난 행사 목록을 불러오는 중</div>`);
  try { if (!groups.length) await loadGroups(); } catch (e) { $('#modalBody').innerHTML = `<h2>지난 행사 상품·할인 가져오기</h2><div class="err-box">${esc(e.message)}</div>`; return; }
  stepPick(query);
}

function stepPick(query) {
  const m = $('#modalBody');
  m.innerHTML = `<h2>지난 행사 상품·할인 가져오기</h2>
    <div class="steps"><b>1 고르기</b><i></i><span>2 미리보기</span><i></i><span>3 기획안에 담기</span></div>
    <p class="sm mute">작년 품목과 할인율을 그대로 올해 날짜로 옮기고, 지금 안 팔리는 상품만 같은 카테고리·가격대의 요즘 잘 팔리는 상품으로 바꿔요. 규칙 계산이라 비용이 들지 않아요.</p>
    <div class="rp-grid">
      <div>
        <div class="row mt8"><input type="search" id="rpQ" placeholder="행사 이름 (예: 블프, 설, 홀리데이)" value="${esc(query)}" class="grow" aria-label="행사 이름 검색"></div>
        <div class="rp-list mt8" id="rpList" role="listbox" aria-label="끝난 행사"></div>
      </div>
      <div class="rp-side" id="rpSide"><div class="cap">왼쪽에서 다시 할 행사를 고르세요.</div></div>
    </div>
    <div class="foot"><button class="btn" data-close-modal>닫기</button><button class="btn primary" id="rpRun" disabled>미리보기</button></div>`;
  const paint = () => {
    const q = $('#rpQ').value.replace(/\s/g, '');
    const list = groups.filter(g => !q || g.name.replace(/\s/g, '').includes(q)).slice(0, 60);
    $('#rpList').innerHTML = list.map(g => `<button class="rp-opt ${pick === g ? 'on' : ''}" role="option" data-g="${groups.indexOf(g)}">
        <b>${esc(g.name)}</b><span class="num sm">${g.sales ? man(g.sales) + '만원' : ''}</span>
        <span class="cap">${yy(g.start)}~${mmdd(g.end)} · ${[...g.types].map(t => `${t} ${g.waves.filter(w => w.type === t).reduce((a, w) => a + w.rows, 0)}품목`).join(' + ')}</span></button>`).join('')
      || '<div class="empty">그 이름이 들어간 끝난 행사가 없어요</div>';
  };
  paint();
  $('#rpQ').addEventListener('input', paint);
  $('#rpQ').focus();
  $('#rpList').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    pick = groups[+b.dataset.g]; paint(); side();
  });
  if (query) { const first = groups.find(g => g.name.replace(/\s/g, '').includes(query.replace(/\s/g, ''))); if (first) { pick = first; paint(); side(); } }
  $('#rpRun').addEventListener('click', run);
}

function side() {
  const ds = defaultStart(pick);
  const types = [...pick.types];
  $('#rpSide').innerHTML = `<div><b>${esc(pick.name)}</b><div class="cap">작년 ${pick.start} ~ ${pick.end}</div></div>
    <div class="f"><div class="cap">다시 할 유형</div>${types.map(t => `<label class="ck"><input type="checkbox" data-t="${esc(t)}" checked> ${esc(t)} <span class="cap">${pick.waves.filter(w => w.type === t).reduce((a, w) => a + w.rows, 0)}품목</span></label>`).join('<br>')}</div>
    <label class="f">올해 시작일<input type="date" id="rpStart" value="${ds.date}"><span class="cap">${esc(ds.why)}</span></label>`;
  $('#rpRun').disabled = false;
}

async function run() {
  const types = [...document.querySelectorAll('#rpSide [data-t]:checked')].map(x => x.dataset.t);
  if (!types.length) { toast('유형을 하나 이상 고르세요'); return; }
  const start = $('#rpStart').value || null;
  const keys = pick.waves.filter(w => types.includes(w.type)).map(w => w.key);
  lastKeys = keys; mode = 'adjust'; keepRows = null;
  $('#rpRun').disabled = true; $('#rpRun').innerHTML = '<span class="spin"></span> 품목 고르는 중';
  try { result = await api('/api/replan', { method: 'POST', body: { keys, start, types } }); }
  catch (e) { toast(e.message); $('#rpRun').disabled = false; $('#rpRun').textContent = '미리보기'; return; }
  if (!result.ok) { toast(result.message || '만들지 못했어요'); $('#rpRun').disabled = false; $('#rpRun').textContent = '미리보기'; return; }
  stepPreview();
}

function distRows(ly, now) {
  // 유형별로 작년 vs 올해 할인율 분포를 나란히 (높은 할인부터)
  return Object.keys(ly || {}).map(t => {
    const L = Object.fromEntries(ly[t] || []), N = Object.fromEntries((now || {})[t] || []);
    const keys = [...new Set([...Object.keys(L), ...Object.keys(N)])].sort((a, b) => parseInt(b) - parseInt(a));
    const max = Math.max(1, ...Object.values(L), ...Object.values(N));
    return `<div class="sm"><b>${esc(t)}</b> <span class="cap">회색 = 작년, 색 = 올해 안</span></div>
      <div class="rdist">${keys.map(k => `<div class="rr"><span>${k}</span><span class="bars"><span data-w="${(L[k] || 0) / max}"></span><span class="now ${t === '상시' ? 's' : ''}" data-w="${(N[k] || 0) / max}"></span></span><span class="num">${N[k] || 0}개</span></div>`).join('')}</div>`;
  }).join('');
}

// R13: 가져오는 방식. adjust = 안 팔리는 상품만 바꾸기(기본, 서버 결과 그대로) / keep = 그대로 가져오기(날짜만 옮김, 할인 0%는 할인 없음)
let lastKeys = [], mode = 'adjust', keepRows = null;
const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftD = (s, off) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return isoD(new Date(y, m - 1, d + off)); };
async function loadKeep(r) {
  const seen = new Set(), rows = [];
  const keys = (r.source || []).map(x => `${x.promo}|${x.type}|${x.start}`);   // review._key와 같은 형식 (행사명|유형|시작일)
  for (const k of (keys.length ? keys : lastKeys)) {
    const w = await api(`/api/review/wave?key=${encodeURIComponent(k)}`);
    for (const x of w.items_detail || []) {
      if (!x.exists || !x.start) continue;
      const key = `${x.seq}|${x.type}|${x.start}`; if (seen.has(key)) continue; seen.add(key);
      const zero = !x.rate;
      if (zero && x.type === '하루특가') continue;
      rows.push({ promo: w.promo, type: zero ? '큐레이션' : x.type, start: shiftD(x.start, r.offset), end: shiftD(x.end || x.start, r.offset), seq: x.seq,
        rate: zero ? 0 : x.rate, category_tag: x.zone || '', memo: `지난 ${w.promo} ${mmdd(x.start)} ${zero ? '할인 없음' : pct(x.rate)} 그대로` });
    }
  }
  return rows;
}
function modeNote() {
  const el = $('#rpModeNote'); if (!el) return;
  el.textContent = mode === 'keep'
    ? (keepRows ? `그대로 가져오기: 지난 행사의 상품과 할인율을 날짜만 옮겨요. 지금 안 팔리는 상품도 그대로이고, 할인 없던 상품은 할인 없음(큐레이션)으로 와요. ${keepRows.length}행 (할인 없음 ${keepRows.filter(x => x.type === '큐레이션').length}행)` : '불러오는 중')
    : '안 팔리는 상품만 바꾸기: 최근 90일 판매가 없는 상품만 같은 카테고리·가격대로 바꾸고 할인율은 그대로 둬요. 할인 0% 행은 빼요. 아래 숫자는 이 방식 기준이에요';
}

function stepPreview() {
  const r = result, s = r.summary, L = r.log;
  const li = (arr, f, n = 30) => arr.slice(0, n).map(f).join('') + (arr.length > n ? `<li class="cap">외 ${arr.length - n}개</li>` : '');
  const same = JSON.stringify(s.rate_dist) === JSON.stringify(s.ly_rate_dist);
  $('#modalBody').innerHTML = `<h2>${esc(r.title)}</h2>
    <div class="steps"><span>1 고르기</span><i></i><b>2 미리보기</b><i></i><span>3 기획안에 담기</span></div>
    <div class="grp mt8" id="rpMode" role="group" aria-label="가져오는 방식"><button class="chip on" data-rm="adjust" aria-pressed="true">안 팔리는 상품만 바꾸기</button><button class="chip" data-rm="keep" aria-pressed="false">그대로 가져오기</button></div>
    <p class="cap" id="rpModeNote"></p>
    <p class="cap">가져와요: 상품, 할인율, 상시·하루특가 구분, 날짜 간격, Zone. 가져오지 않아요: 명분, 컨셉, 소구문구, 페이지 구성</p>
    <div class="sm">원본 ${r.source.map(x => `${esc(x.promo)} ${esc(x.type)} ${yy(x.start)}~${mmdd(x.end)} ${x.rows}품목`).join(' · ')} → <b>${esc(r.start)}</b>부터</div>
    ${(r.booked || []).length ? `<div class="info-box sm mt8">올해 이미 잡힌 같은 이름 행사: ${r.booked.map(b => `<b>${esc(b.promo)}</b> ${esc(b.type)} ${mmdd(b.start)}~${mmdd(b.end)} ${b.rows}품목`).join(' · ')}</div>` : ''}
    <div class="rp-sum">
      <div><div class="k">행</div><div class="v">${s.rows}</div></div>
      <div><div class="k">작년 그대로</div><div class="v">${s.kept}</div></div>
      <div><div class="k">교체 (안 팔림)</div><div class="v">${s.replaced}</div></div>
      <div><div class="k">확인해 볼 것</div><div class="v">${s.watch}</div></div>
    </div>
    <div class="row"><span class="sm"><b>날짜 리듬</b></span><span class="grow"></span>${ribbonKey()}</div>
    <div class="mt8">${ribbon(r.rows)}</div>
    <div class="rp-cols mt12">
      <div><h4>할인율${same ? ': 작년과 똑같아요' : ''}</h4>${distRows(s.ly_rate_dist, s.rate_dist)}
        ${L.rate.length ? `<h4>원가율 참고 <span class="cap">45% 넘지만 작년 할인율 유지</span></h4><ul>${li(L.rate, x => `<li>${esc(x.name)} ${pct(x.rate)} <span class="cap">할인 후 원가율 ${pct(x.cost_ratio)}</span></li>`, 8)}</ul>` : ''}</div>
      <div>
        ${L.replaced.length ? `<h4>교체 <span class="cap">할인율은 그 자리 그대로</span></h4><ul>${li(L.replaced, x => `<li>${esc(x.from)} → <b>${esc(x.to)}</b> <span class="cap">${esc(x.pick_why)}</span></li>`)}</ul>` : '<h4>교체 없음</h4>'}
        ${L.watch.length ? `<h4>확인해 볼 것 <span class="cap">작년대로 넣어 뒀어요</span></h4><ul>${li(L.watch, x => `<li>${esc(x.name)} <span class="cap">${esc(x.why)}</span></li>`)}</ul>` : ''}
        ${L.added.length ? `<h4>추가 (올해 뜬 베스트)</h4><ul>${li(L.added, x => `<li>${esc(x.name)} <span class="cap">${esc(x.why)}</span></li>`)}</ul>` : ''}
        ${L.dropped.length ? `<h4>뺌</h4><ul>${li(L.dropped, x => `<li>${esc(x.name)} <span class="cap">${esc(x.why)}</span></li>`)}</ul>` : ''}
      </div>
    </div>
    <p class="cap mt12">${esc(r.note)} 예상 매출(참고) ${man(s.expected_range?.[0])}~${man(s.expected_range?.[1])}만원.</p>
    <div class="foot"><button class="btn ghost" id="rpBack">다시 고르기</button><span class="grow"></span><button class="btn" data-close-modal>닫기</button><button class="btn primary" id="rpLoad">${icon('board')} 기획안에 담기</button></div>`;
  document.querySelectorAll('#modalBody [data-w]').forEach(el => { el.style.width = `${Math.max(0.02, Math.min(1, +el.dataset.w)) * 100}%`; });
  $('#rpBack').addEventListener('click', () => stepPick(pick?.name || ''));
  modeNote();
  $('#rpMode').addEventListener('click', async e => {
    const b = e.target.closest('[data-rm]'); if (!b || b.dataset.rm === mode) return;
    mode = b.dataset.rm;
    document.querySelectorAll('#rpMode [data-rm]').forEach(x => { const on = x.dataset.rm === mode; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    modeNote();
    if (mode === 'keep' && !keepRows) { try { keepRows = await loadKeep(r); } catch (err) { toast(err.message); mode = 'adjust'; } modeNote(); }
  });
  $('#rpLoad').addEventListener('click', () => {
    if (mode === 'keep' && !keepRows) { toast('그대로 가져올 행을 불러오는 중이에요'); return; }
    emit('plan:replace', { title: r.title, source: '지난 행사 상품·할인 가져오기', rows: mode === 'keep' ? keepRows : r.rows,
      rationale: `${r.note}\n원본: ${r.source.map(x => `${x.promo} ${x.type} ${x.start}~${x.end}`).join(', ')}\n${mode === 'keep' ? `그대로 가져오기 ${keepRows.length}행` : `작년 그대로 ${s.kept} · 교체 ${s.replaced} · 확인해 볼 것 ${s.watch} · 뺌 ${s.dropped} · 추가 ${s.added}`}`,
      brief_meta: { myeongbun: `작년 ${r.source[0].promo} (${r.source[0].start})`, concept: '', customer: '', target: '' } });
    closeModal(); 
  });
}

export function resetReplan() { groups = []; }
