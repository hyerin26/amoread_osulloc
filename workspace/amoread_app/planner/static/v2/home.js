// ---------------- 예시 데이터 (가상) ----------------
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜 (몰 이벤트·명분은 아직 예시라 이 날짜 근처에만 있어요)
const CLS = {
  season: { name: '시즌', seed: null },
  brand: { name: '브랜드기획전', seed: ['주인공 상품·라인', '예) 말차 라인'] },
  launch: { name: '런칭', seed: ['런칭할 신상품', '예) 제주 영귤 블렌딩티'] },
  collab: { name: '콜라보', seed: ['협업 상대', '예) ○○ 캐릭터'] },
  clear: { name: '클리어런스', seed: ['소진할 상품·라인', '예) 티백 대용량 세트'] },
};
// 몰에 걸린 페이지 (이벤트 목록, 대상 O). 어떤 분류든 기간이 겹칠 수 있다 → 줄을 자동으로 늘린다
const EVENTS = [
  { id: 'e1', name: '가을 티타임 기획전', cls: 'season', s: '2026-10-19', e: '2026-11-08' },
  { id: 'e4', name: '찻잔 세트 재고 정리', cls: 'clear', s: '2026-11-02', e: '2026-11-05' },
  { id: 'e2', name: '말차 라인 기획전', cls: 'brand', s: '2026-11-09', e: '2026-11-22' },
  { id: 'e3', name: '영귤 블렌딩 출시', cls: 'launch', s: '2026-11-16', e: '2026-11-29' },
];
// 내 기획안 (준비 중). next = 제작 일정에서 가장 가까운 마감
const PLAN_STATE = { p1: '준비 중', p4: '준비 중', p2: '준비 중', p3: '날짜 미정' };
// 지난 기획안 (목록에만): 다시 쓰기 = 상품·할인·구성을 올해 날짜로 가져와 새 기획안
const PAST = [
  { id: 'q0', name: '가을 티타임 기획전 (예시)', cls: 'season', s: '2026-10-19', e: '2026-11-08', state: '진행 중' },
  { id: 'q1', name: '설 선물 얼리버드 (예시)', cls: 'season', s: '2026-01-06', e: '2026-01-21', state: '지난 기획안' },
  { id: 'q2', name: '감사선물전 얼리버드 (예시)', cls: 'season', s: '2026-04-08', e: '2026-04-29', state: '지난 기획안' },
  { id: 'q3', name: '헬로키티 콜라보 (예시)', cls: 'collab', s: '2025-07-10', e: '2025-07-31', state: '지난 기획안' },
];
const clsName = k => CLS[k]?.name || '분류 미정';   // 예전 화면에서 만든 기획안은 분류가 없어요
const PLANS = [
  { id: 'p1', name: '블프 말차 묶음전', cls: 'season', s: '2026-11-23', e: '2026-12-06', step: '02 구성', next: ['디자인 착수', '2026-11-12'] },
  { id: 'p4', name: '홈카페 말차 기획전', cls: 'brand', s: '2026-12-01', e: '2026-12-14', step: '01 브리프', next: ['틀 기획 완료', '2026-11-17'] },
  { id: 'p2', name: '연말 선물 기획전', cls: 'season', s: '2026-12-21', e: '2027-01-03', step: '01 브리프', next: ['기획 착수', '2026-11-30'] },
  { id: 'p3', name: '티백 대용량 정리', cls: 'clear', s: null, e: null, step: '01 브리프', next: null },
];
// 명분 사전 (날짜, 종류, 준비 시작 = 며칠 전)
const SEASONS = [
  { id: 'm1', name: '입동', d: '2026-11-07', kind: '절기', lead: 21, ly: ['가을 티타임 기획전 (10/20~11/9)'], past: '지난 같은 명분 행사 2회' },
  { id: 'm2', name: '빼빼로데이', d: '2026-11-11', kind: '기념일', lead: 21, ly: ['스틱 티 선물전 (11/4~11/11)'], past: '지난 같은 명분 행사 2회' },
  { id: 'm3', name: '수능', d: '2026-11-19', kind: '학사', lead: 28, ly: [], past: '지난 같은 명분 행사 없음' },
  { id: 'm4', name: '블랙프라이데이', d: '2026-11-27', kind: '기념일', lead: 35, ly: ['블프 최대 40% (11/25~12/1)'], past: '지난 같은 명분 행사 2회' },
  { id: 'm5', name: '대설', d: '2026-12-07', kind: '절기', lead: 21, ly: [], past: '지난 같은 명분 행사 없음' },
  { id: 'm6', name: '동지', d: '2026-12-22', kind: '세시', lead: 28, ly: ['동지 팥 블렌딩 (12/15~12/22)'], past: '지난 같은 명분 행사 1회' },
  { id: 'm7', name: '크리스마스', d: '2026-12-25', kind: '기념일', lead: 42, ly: ['해피 홀리데이 선물 (12/1~12/25)'], past: '지난 같은 명분 행사 2회' },
];

// ---------------- 도우미 ----------------
const D = s => new Date(s + 'T00:00:00');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const add = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const WD = '일월화수목금토';
const md = s => { const d = D(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
const mondayOf = s => { const d = D(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// 빈 구간: 앞으로의 날 중 걸린 페이지도, 날짜 있는 기획안도 없는 날의 연속 구간
function gaps(from, to) {
  const cover = [...EVENTS, ...PLANS].filter(x => x.s);
  const out = []; let cur = null;
  for (let d = from; d <= to; d = add(d, 1)) {
    const covered = cover.some(x => x.s <= d && d <= x.e);
    if (!covered && d >= TODAY) { if (!cur) cur = { s: d, e: d }; else cur.e = d; }
    else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
// 기간 기본값 (plans/20 4-1): 시작 = 앞 페이지 종료 다음 날(= 첫 빈 날), 길이 14일
function defaultPeriod() {
  const g = gaps(TODAY, add(TODAY, 180))[0];
  return g ? { s: g.s, e: add(g.s, 13), why: `앞 페이지가 끝난 다음 날(${md(g.s)})부터 2주로 제안했어요.` } : { s: null, e: null, why: '' };
}
// 겹치는 막대를 줄로 나누기: 시작일 순으로 놓고, 앞 줄에 자리가 있으면 그 줄에
function pack(items, from, to) {
  const ends = [];
  return items.filter(x => x.s && x.e >= from && x.s <= to).sort((a, b) => a.s < b.s ? -1 : a.s > b.s ? 1 : 0).map(x => {
    let r = ends.findIndex(e => e < x.s); if (r < 0) { r = ends.length; ends.push(x.e); } else ends[r] = x.e;
    return { x, r };
  });
}

// ---------------- 상태 ----------------
const WEEKS = 10;
let start = add(mondayOf(TODAY), -7);   // 타임라인: 지난주 월요일부터 10주
let month = TODAY.slice(0, 7) + '-01';   // 캘린더: 이번 달
let view = 'tl';
try { view = localStorage.getItem('amoread.homeView') === 'cal' ? 'cal' : 'tl'; } catch { /* 저장소 없음 */ }
let selected = null;   // { type: 'ev'|'plan'|'m', id }
const isSel = (type, id) => !!selected && selected.type === type && selected.id === id;
const selSeason = () => selected?.type === 'm' ? SEASONS.find(m => m.id === selected.id) : null;

function bar(cls, html, label, data) {
  const b = document.createElement('button');
  b.className = `bar ${cls}`; b.innerHTML = html; b.setAttribute('aria-label', label); b.title = label;
  Object.assign(b.dataset, data);
  if (isSel(data.type, data.id)) b.setAttribute('aria-pressed', 'true');
  return b;
}
const evName = x => CLS[x.cls]?.name || 'PROMO_WORK 행사';
const evBar = x => bar(`c-${x.cls}`, `<span class="nm">${esc(x.name)}</span>`, `${x.name}, ${evName(x)}, ${md(x.s)}~${md(x.e)}`, { type: 'ev', id: x.id });
const planBar = (p, dl = true) => bar('plan', `<span class="nm">${esc(p.name)}</span>${dl && p.next ? `<span class="dl">${esc(p.next[0])} ${md(p.next[1])}</span>` : ''}`,
  `${p.name}, 준비 중, ${md(p.s)}~${md(p.e)}${p.next ? `, 다음 마감 ${p.next[0]} ${md(p.next[1])}` : ''}`, { type: 'plan', id: p.id });
const gapBar = (g, long) => { const n = diff(g.s, g.e) + 1; return bar('gap', long && n >= 5 ? `${n}일 비어요 · 기획 시작` : `${n}일 비어요`, `빈 구간 ${md(g.s)}~${md(g.e)}, ${n}일. 눌러서 이 기간으로 새 기획안`, { type: 'gap', id: `${g.s}|${g.e}` }); };

// ---------------- 타임라인 ----------------
function renderTimeline() {
  const tl = $('#tl'), days = WEEKS * 7, end = add(start, days - 1);
  tl.style.setProperty('--days', days);
  tl.innerHTML = '';
  $('#rangeCap').textContent = `${md(start)} ~ ${md(end)}`;
  const put = (el, s, e, row) => {
    if (e < start || s > end) return false;
    el.style.gridColumn = `${Math.max(0, diff(start, s)) + 2} / ${Math.min(days - 1, diff(start, e)) + 3}`; el.style.gridRow = row; tl.append(el); return true;
  };
  const evs = pack(EVENTS, start, end), pls = pack(PLANS, start, end);
  const evN = Math.max(1, ...evs.map(v => v.r + 1)), plN = Math.max(1, ...pls.map(v => v.r + 1));
  const R = { wk: 1, pick: 2, ev: 3 }; R.plan = R.ev + evN; R.gap = R.plan + plN; R.m = R.gap + 1;
  const lab = (row, n, t, s) => { const d = document.createElement('div'); d.className = 'lab'; d.style.gridRow = `${row} / span ${n}`; d.innerHTML = `<b>${t}</b>${esc(s)}`; tl.append(d); };
  const bg = (row, n) => { const d = document.createElement('div'); d.className = 'lane-bg'; d.style.gridRow = `${row} / span ${n}`; d.style.gridColumn = `2 / ${days + 2}`; tl.append(d); };

  for (let w = 0; w < WEEKS; w++) {
    const s = add(start, w * 7), d = document.createElement('div');
    d.className = 'wk' + (s <= TODAY && TODAY <= add(s, 6) ? ' now' : '');
    d.style.gridRow = R.wk; d.style.gridColumn = `${w * 7 + 2} / span 7`; d.textContent = `${md(s).replace(/\(.\)/, '')} 주`;
    tl.append(d);
  }
  lab(R.pick, 1, '기간 고르기', '끌어서 새 기획안');
  for (let i = 0; i < days; i++) {
    const d = add(start, i), c = document.createElement('div');
    c.className = 'pick' + (D(d).getDay() === 1 ? ' mon' : '') + (d < TODAY ? ' past' : '');
    if (d >= TODAY) c.dataset.pick = d; c.style.gridRow = R.pick; c.style.gridColumn = i + 2; c.title = md(d);
    tl.append(c);
  }
  lab(R.ev, evN, '몰에 걸린 행사', HOME_LIVE ? 'PROMO_WORK' : '이벤트 목록'); bg(R.ev, evN);
  evs.forEach(({ x, r }) => put(evBar(x), x.s, x.e, R.ev + r));
  lab(R.plan, plN, '내 기획안', '준비 중'); bg(R.plan, plN);
  pls.forEach(({ x, r }) => put(planBar(x), x.s, x.e, R.plan + r));
  lab(R.gap, 1, '빈 구간', '걸린 페이지 없음'); bg(R.gap, 1);
  gaps(start, end).forEach(g => put(gapBar(g, true), g.s, g.e, R.gap));
  lab(R.m, 1, '명분', '명분 사전'); bg(R.m, 1);
  const sm = selSeason();
  if (sm) { const ln = document.createElement('div'); ln.className = 'lead'; put(ln, add(sm.d, -sm.lead), add(sm.d, -1), R.m); }   // 준비 기간 선은 고른 명분만 (겹치면 읽을 수 없음)
  // 명분 이름이 겹치지 않게: 보이는 명분을 날짜순으로 보고, 이름이 들어갈 자리가 빈 가장 위 단(0~2)에 놓는다 (2026-11-10)
  const DAYPX = parseFloat(getComputedStyle(tl).getPropertyValue('--day')) || 15, CHAR = 13, MAXW = 112, ends = [-1e9, -1e9, -1e9];
  const lv = {};
  SEASONS.filter(m => m.d >= start && m.d <= end).sort((a, b) => (a.d < b.d ? -1 : 1)).forEach(m => {
    const cx = diff(start, m.d) * DAYPX + DAYPX / 2, w = Math.min(MAXW, m.name.length * CHAR + 8);
    let k = ends.findIndex(e => e + 6 <= cx - w / 2);
    if (k < 0) k = ends.indexOf(Math.min(...ends));
    ends[k] = cx + w / 2; lv[m.id] = k;
  });
  SEASONS.forEach(m => {
    if (m.d < start || m.d > end) return;
    const b = document.createElement('button'); b.className = `mb lv${lv[m.id] || 0}`; b.dataset.type = 'm'; b.dataset.id = m.id;
    b.innerHTML = `<span class="dia" aria-hidden="true"></span><span class="t">${esc(m.name)}</span>`;
    b.title = `${m.name} · ${md(m.d)}`;
    b.setAttribute('aria-label', `명분 ${m.name}, ${md(m.d)}, 준비 시작 ${md(add(m.d, -m.lead))}`);
    if (isSel('m', m.id)) b.setAttribute('aria-pressed', 'true');
    b.style.gridRow = R.m; b.style.gridColumn = `${diff(start, m.d) + 2} / span 1`; b.style.justifySelf = 'center'; tl.append(b);
  });
  if (TODAY >= start && TODAY <= end) {
    const t = document.createElement('div'); t.className = 'today';
    t.style.left = `calc(var(--lane-label) + ${diff(start, TODAY)} * var(--day) + var(--day) / 2)`;
    t.innerHTML = '<span>오늘</span>'; tl.append(t);
  }
}

// ---------------- 캘린더 (월, 월요일 시작) ----------------
function renderCalendar() {
  const box = $('#calWrap'), m0 = month, last = add(add(m0.slice(0, 7) + '-01', 32).slice(0, 7) + '-01', -1);
  const first = mondayOf(m0), weeks = Math.ceil((diff(first, last) + 1) / 7);
  const d0 = D(m0); $('#rangeCap').textContent = `${d0.getFullYear()}년 ${d0.getMonth() + 1}월`;
  const allGaps = gaps(first, add(first, weeks * 7 - 1)), sm = selSeason();
  const inGap = d => allGaps.some(g => g.s <= d && d <= g.e);
  box.innerHTML = `<div class="cal-head">${'월화수목금토일'.split('').map(w => `<span>${w}</span>`).join('')}</div>`;
  for (let w = 0; w < weeks; w++) {
    const ws = add(first, w * 7), we = add(ws, 6), row = document.createElement('div');
    row.className = 'cw';
    // 바탕 칸 (빈 구간 색, 다른 달 색)과 날짜 칸 (끌어서 기간 고르기, 명분)
    for (let i = 0; i < 7; i++) {
      const d = add(ws, i), out = d.slice(0, 7) !== m0.slice(0, 7);
      const bgc = document.createElement('div'); bgc.className = 'cell' + (out ? ' out' : '') + (inGap(d) ? ' gapday' : ''); bgc.style.gridColumn = i + 1; row.append(bgc);
      const c = document.createElement('div');
      c.className = 'cd' + (out ? ' out' : '') + (d === TODAY ? ' today' : '') + (sm && add(sm.d, -sm.lead) <= d && d < sm.d ? ' prep' : '');
      if (d >= TODAY) c.dataset.pick = d; else c.classList.add('pick', 'past');
      c.style.gridColumn = i + 1; c.title = md(d);
      c.innerHTML = `<span class="n">${D(d).getDate()}</span>` + SEASONS.filter(m => m.d === d).map(m =>
        `<button class="mchip" data-type="m" data-id="${m.id}" ${isSel('m', m.id) ? 'aria-pressed="true"' : ''} aria-label="명분 ${esc(m.name)}, ${md(m.d)}"><i aria-hidden="true"></i><span>${esc(m.name)}</span></button>`).join('');
      row.append(c);
    }
    // 막대: 걸린 페이지 → 내 기획안 → 빈 구간 순서로 줄을 쌓는다 (주 안에서 겹치면 아래 줄로)
    let base = 2;
    const lay = (packed, make) => {
      packed.forEach(({ x, r }) => {
        const a = Math.max(0, diff(ws, x.s)), b = Math.min(6, diff(ws, x.e)), el = make(x);
        if (x.s < ws) el.classList.add('cont-l'); if (x.e > we) el.classList.add('cont-r');
        el.style.gridColumn = `${a + 1} / ${b + 2}`; el.style.gridRow = base + r; row.append(el);
      });
      base += packed.length ? Math.max(...packed.map(v => v.r + 1)) : 0;
    };
    lay(pack(EVENTS, ws, we), evBar);
    lay(pack(PLANS, ws, we), p => planBar(p, false));
    lay(pack(allGaps.map(g => ({ ...g })), ws, we), g => gapBar(g, false));
    const sp = document.createElement('div'); sp.className = 'spacer'; sp.style.gridRow = base; row.append(sp);
    box.append(row);
  }
}

function render() {
  $$('.seg [data-view]').forEach(b => b.setAttribute('aria-selected', b.dataset.view === view));
  $('#tlWrap').classList.toggle('hidden', view !== 'tl'); $('#calWrap').classList.toggle('hidden', view !== 'cal');
  $('#prevBtn').textContent = view === 'tl' ? '← 4주 전' : '← 이전 달';
  $('#nextBtn').textContent = view === 'tl' ? '4주 뒤 →' : '다음 달 →';
  if (view === 'tl') renderTimeline(); else renderCalendar();
  const und = PLANS.filter(p => !p.s);
  $('#undated').innerHTML = und.length ? `<span class="cap">날짜 미정 기획안</span>${und.map(p => `<button class="chip" data-type="plan" data-id="${p.id}">${esc(p.name)} · ${esc(clsName(p.cls))}</button>`).join('')}` : '';
  renderSide();
  renderPlans();
}
// 기획안 섹션: 준비 중·진행 중·날짜 미정 위, 지난 기획안 아래 묶음
let plF = '전체', plq = '';
function renderPlans() {
  const all = [...PLANS.map(p => ({ ...p, state: PLAN_STATE[p.id] })), ...PAST];
  const ok = p => (plF === '전체' || p.state === plF) && (!plq || [p.name, p.s || '날짜 미정'].join(' ').includes(plq));
  const STEPN = { '01 브리프': 1, '02 구성': 2 };
  const row = p => `<li class="prow"><span class="nm"><button class="linkbtn" data-openplan="${p.id}">${esc(p.name)}</button><span class="tag cls c-${p.cls}">${esc(clsName(p.cls))}</span></span>
      <span>${p.s ? `${md(p.s)} ~ ${md(p.e)}` : '<span class="cap">날짜 미정</span>'}</span><span><span class="tag">${p.state}</span></span>
      <span>${p.next ? `${esc(p.next[0])} ${md(p.next[1])} <span class="dd ${diff(TODAY, p.next[1]) > 7 ? 'calm' : ''}">D-${diff(TODAY, p.next[1])}</span>` : p.step ? `<span class="cap">${esc(p.step)}</span>` : '<span class="cap">-</span>'}</span>
      <span>${p.legacy ? `<button class="btn xs" data-import="${p.id}">가져오기</button>` : p.state === '지난 기획안' && p.real ? `<button class="btn xs" data-reuse="${p.id}">다시 쓰기</button>` : `<button class="btn xs" data-openplan="${p.id}">${p.state === '지난 기획안' ? '다시 쓰기' : '열기'}</button>`}</span></li>`;
  const now = all.filter(p => p.state !== '지난 기획안' && ok(p)), past = all.filter(p => p.state === '지난 기획안' && ok(p));
  const nHit = now.length + past.length;
  $('#plMeta').textContent = plq ? (nHit ? `${nHit}개 찾았어요` : '') : '';
  $('#plS').classList.toggle('has-value', !!plq);
  $('#plN').textContent = `준비 중 ${all.filter(p => p.state === '준비 중').length} · 날짜 미정 ${all.filter(p => p.state === '날짜 미정').length} · 지난 ${all.filter(p => p.state === '지난 기획안').length}`;
  $('#plF').innerHTML = ['전체', '준비 중', '진행 중', '날짜 미정', '지난 기획안'].map(f => `<button data-pf="${f}" aria-pressed="${plF === f}">${f}</button>`).join('');
  $('#plList').innerHTML = `<ul class="plist"><li class="prow h"><span>기획안</span><span>기간</span><span>상태</span><span>다음 마감</span><span></span></li>
    ${now.map(row).join('') || (past.length ? '' : `<li class="search-meta none">${plq ? `'${esc(plq)}'와 맞는 기획안이 없어요. 다른 말로 찾거나 ✕로 지워 주세요.` : '이 상태의 기획안이 없어요.'}</li>`)}
    ${past.length ? `<li class="grp-h">지난 기획안 <span class="cap">다시 쓰면 상품·할인·구성을 같은 요일의 다가오는 날짜로 옮겨 새 기획안을 만들어요${HOME_LIVE ? ' · 예전 기획 도우미 기획안은 가져오기' : ''}</span></li>${past.map(row).join('')}` : ''}</ul>`;
}
document.addEventListener('click', e => {
  const f = e.target.closest('[data-pf]'); if (f) { plF = f.dataset.pf; renderPlans(); return; }
  const o = e.target.closest('[data-openplan]'); if (o) { const id = o.dataset.openplan, rp = PLANS.find(p => p.id === id && p.real); if (rp) { location.assign(planUrl(rp)); return; } toast(PAST.some(p => p.id === id && p.state === '지난 기획안') ? '예시예요: 지난 기획안을 올해 날짜로 가져와 새 기획안을 만들어요' : '예시예요: 이 기획안의 지금 단계로 이동해요'); return; }
  const so = e.target.closest('[data-soon]'); if (so) { e.preventDefault(); toast(`예시예요: ${so.dataset.soon}`); }
});
document.addEventListener('input', e => { if (e.target.id === 'plq') { plq = e.target.value.trim(); renderPlans(); } });
// 검색창: ✕나 Esc로 지우고 칸에 머묾 (컴포넌트 27 규칙)
const clearPl = () => { const i = $('#plq'); i.value = ''; plq = ''; renderPlans(); i.focus(); };
document.addEventListener('click', e => { if (e.target.closest('#plS [data-sclear]')) clearPl(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.id === 'plq' && e.target.value) { e.preventDefault(); clearPl(); } });

// ---------------- 옆 패널 ----------------
function renderSide() {
  const el = $('#side');
  const back = '<button class="back" data-back>← 오늘 챙길 것</button>';
  if (selected?.type === 'm') {
    const m = selSeason(), prep = add(m.d, -m.lead), left = diff(TODAY, prep);
    el.innerHTML = `${back}<div class="overline">명분 · ${esc(m.kind)}</div><h2>${esc(m.name)}</h2>
      <dl class="facts"><dt>명분일</dt><dd>${md(m.d)} · D-${diff(TODAY, m.d)}</dd>
        <dt>준비 시작</dt><dd>${md(prep)} ${left > 0 ? `<span class="dd calm">${left}일 남음</span>` : '<span class="dd">지났어요</span>'}</dd></dl>
      <h3>${HOME_LIVE ? '이 명분 기간에 이미 잡힌 행사 (PROMO_WORK)' : '작년 같은 명분 때 걸린 페이지'}</h3>
      ${m.ly.length ? `<ul>${m.ly.map(t => `<li class="cap">${esc(t)}</li>`).join('')}</ul>` : `<p class="cap">${HOME_LIVE ? '이 기간에 잡힌 행사가 없어요.' : '작년에는 이 명분으로 걸린 페이지가 없어요.'}</p>`}
      <h3>${HOME_LIVE ? '컨셉 씨앗 · 메모' : '지난 같은 명분 행사'}</h3><p class="cap">${esc(m.past) || '-'}${HOME_LIVE ? '' : ' · 품목, 할인율은 상품·할인에서 볼 수 있어요'}</p>
      <div class="acts"><button class="btn primary" data-start-m="${m.id}">이 명분으로 시작</button></div>`;
    return;
  }
  if (selected?.type === 'plan') {
    const p = PLANS.find(x => x.id === selected.id);
    el.innerHTML = `${back}<div class="overline">내 기획안 · ${esc(clsName(p.cls))}</div><h2>${esc(p.name)}</h2>
      <dl class="facts"><dt>기간</dt><dd>${p.s ? `${md(p.s)} ~ ${md(p.e)}` : '날짜 미정'}</dd><dt>지금 단계</dt><dd>${esc(p.step)}</dd>
        <dt>다음 마감</dt><dd>${p.next ? `${esc(p.next[0])} ${md(p.next[1])} <span class="dd">D-${diff(TODAY, p.next[1])}</span>` : '기간을 정하면 계산해요'}</dd></dl>
      <div class="acts"><button class="btn primary" data-open="${p.id}">이어서 하기 →</button></div>`;
    return;
  }
  if (selected?.type === 'ev') {
    const x = EVENTS.find(e => e.id === selected.id);
    el.innerHTML = `${back}<div class="overline">몰에 걸린 행사 · ${esc(evName(x))}</div><h2>${esc(x.name)}</h2>
      <dl class="facts"><dt>기간</dt><dd>${md(x.s)} ~ ${md(x.e)} (${diff(x.s, x.e) + 1}일)</dd><dt>상태</dt><dd>${x.e < TODAY ? '끝남' : x.s <= TODAY ? '진행 중' : '예정'}</dd></dl>
      <p class="cap note-gap">${x.rows ? `PROMO_WORK에 잡힌 행사예요 (${esc(x.types)} · ${x.rows}행).` : '이벤트 목록에서 가져온 페이지예요.'} 이 서비스에서 고치지 않아요.</p>
      <div class="acts"><button class="btn" data-after="${x.id}">끝난 다음 날부터 새 기획안</button></div>`;
    return;
  }
  const dl = PLANS.filter(p => p.next).sort((a, b) => a.next[1] < b.next[1] ? -1 : 1);
  const g = gaps(TODAY, add(TODAY, 180))[0];
  el.innerHTML = `<div class="overline">${md(TODAY)}</div><h2>오늘 챙길 것</h2>
    <h3>가까운 마감</h3><ul>${dl.map(p => { const n = diff(TODAY, p.next[1]); return `<li><button class="item" data-type="plan" data-id="${p.id}">
      <span class="t"><span class="grow">${esc(p.name)}</span><span class="dd ${n > 7 ? 'calm' : ''}">D-${n}</span></span>
      <span class="cap">${esc(p.next[0])} ${md(p.next[1])} · ${esc(p.step)}</span></button></li>`; }).join('')}</ul>
    ${g ? `<h3>다음 빈 구간</h3><button class="item" data-type="gap" data-id="${g.s}|${g.e}"><span class="t"><span class="grow">${md(g.s)} ~ ${md(g.e)}</span><span class="dd calm">${diff(g.s, g.e) + 1}일</span></span>
      <span class="cap">걸린 페이지가 없어요. 눌러서 이 기간으로 시작</span></button>` : ''}
    <h3>날짜 미정</h3><p class="cap">${PLANS.filter(p => !p.s).length}개 · 일정표 아래에 있어요</p>`;
}

// ---------------- 시작 창 ----------------
// cls 없이 열면(새 기획안·빈 구간·기간 고르기) 분류를 먼저 고르게 한다. 명분에서 열 때만 시즌이 골라져 있다
let dlg = { cls: null, m: null };
function openStart({ cls = null, s, e, m = null, why } = {}) {
  dlg = { cls, m };
  const p = s ? { s, e, why: why || '고른 기간을 넣었어요.' } : defaultPeriod();
  $('#dStart').value = p.s || ''; $('#dEnd').value = p.e || '';
  $('#noDate').checked = !p.s; syncDate();
  $('#dateHelp').textContent = p.why;
  paintDlg();
  $('#startDlg').showModal();
}
function paintDlg() {
  $('#clsChips').innerHTML = Object.entries(CLS).map(([k, v]) => `<button type="button" class="chip" role="radio" aria-checked="${dlg.cls === k}" data-cls="${k}">${v.name}</button>`).join('');
  const box = $('#seedBox');
  if (!dlg.cls) { box.innerHTML = '<span class="h">분류를 고르면 시즌은 명분을, 나머지는 출발점을 정해요.</span>'; return; }
  if (dlg.cls === 'season') {
    const s = $('#dStart').value, near = SEASONS.filter(m => m.d >= TODAY)
      .sort((a, b) => s ? Math.abs(diff(s, a.d)) - Math.abs(diff(s, b.d)) : (a.d < b.d ? -1 : 1));
    box.innerHTML = `<span class="l" id="mL">명분</span><div class="mlist" role="radiogroup" aria-labelledby="mL">${near.map(m => `<button type="button" class="mopt" role="radio" aria-checked="${dlg.m === m.id}" data-m="${m.id}">
      <span class="grow"><b>${esc(m.name)}</b> <span class="cap">${esc(m.kind)}</span></span><span class="cap">${md(m.d)} · 준비 ${md(add(m.d, -m.lead))}</span></button>`).join('')}</div>
      <span class="h">${s ? '기간에 가까운 명분부터 보여줘요.' : '다가오는 순서예요.'} 고른 명분이 다음 화면의 중심 키워드가 돼요.</span>`;
  } else {
    const [l, ph] = CLS[dlg.cls].seed;
    box.innerHTML = `<label><span class="l">${l}</span><input type="text" id="seed" placeholder="${esc(ph)}" maxlength="40"></label>
      <span class="h">이 말이 다음 화면(키워드 확장)의 중심 키워드가 돼요.</span>`;
  }
}
function syncDate() { const off = $('#noDate').checked; $('#dStart').disabled = off; $('#dEnd').disabled = off; }

// ---------------- 이벤트 ----------------
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
document.addEventListener('click', e => {
  if (e.target.closest('#startDlg')) return;
  const v = e.target.closest('.seg [data-view]');
  if (v) { view = v.dataset.view; try { localStorage.setItem('amoread.homeView', view); } catch { /* 저장소 없음 */ } render(); return; }
  if (e.target.closest('[data-back]')) { selected = null; render(); return; }
  const sm = e.target.closest('[data-start-m]');
  if (sm) { const m = SEASONS.find(x => x.id === sm.dataset.startM); openStart({ cls: 'season', m: m.id, s: add(m.d, -13), e: m.d, why: `명분일(${md(m.d)})까지 2주로 넣었어요.` }); return; }
  const op = e.target.closest('[data-open]'); if (op) { const p = PLANS.find(x => x.id === op.dataset.open); location.assign(p?.real ? planUrl(p) : '/v2/brief'); return; }
  const af = e.target.closest('[data-after]');
  if (af) { const x = EVENTS.find(ev => ev.id === af.dataset.after), s = add(x.e, 1); openStart({ s, e: add(s, 13), why: `${x.name}이 끝난 다음 날부터 2주예요.` }); return; }
  const t = e.target.closest('[data-type]'); if (!t) return;
  if (t.dataset.type === 'gap') { const [s, en] = t.dataset.id.split('|'); openStart({ s, e: diff(s, en) > 13 ? add(s, 13) : en, why: `빈 구간(${md(s)}~${md(en)})에서 시작해요. 2주를 넘으면 2주까지만 넣었어요.` }); return; }
  selected = isSel(t.dataset.type, t.dataset.id) ? null : { type: t.dataset.type, id: t.dataset.id };
  render();
});
$('#newBtn').addEventListener('click', () => openStart());
const shiftMonth = n => { const d = D(month); d.setMonth(d.getMonth() + n); month = iso(d); };
$('#prevBtn').addEventListener('click', () => { if (view === 'tl') start = add(start, -28); else shiftMonth(-1); render(); });
$('#nextBtn').addEventListener('click', () => { if (view === 'tl') start = add(start, 28); else shiftMonth(1); render(); });
$('#todayBtn').addEventListener('click', () => { start = add(mondayOf(TODAY), -7); month = TODAY.slice(0, 7) + '-01'; render(); });

// 기간 고르기: 타임라인의 '기간 고르기' 줄, 캘린더의 날짜 칸을 끌어서 범위 선택 → 시작 창
let drag = null;
const pickAt = e => document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pick]');
function paintDrag() { $$('[data-pick]').forEach(c => c.classList.toggle('sel', !!drag && c.dataset.pick >= drag.a && c.dataset.pick <= drag.b)); }
document.addEventListener('pointerdown', e => {
  if (e.target.closest('button, dialog')) return;
  const c = e.target.closest('[data-pick]'); if (!c) return;
  e.preventDefault(); drag = { o: c.dataset.pick, a: c.dataset.pick, b: c.dataset.pick }; paintDrag();
});
document.addEventListener('pointermove', e => {
  if (!drag) return; const c = pickAt(e); if (!c) return;
  const d = c.dataset.pick; drag.a = d < drag.o ? d : drag.o; drag.b = d < drag.o ? drag.o : d; paintDrag();
});
document.addEventListener('pointerup', () => {
  if (!drag) return; const { a, b } = drag; drag = null; paintDrag();
  const single = a === b;
  openStart({ s: a, e: single ? add(a, 13) : b, why: single ? `${md(a)}부터 2주로 넣었어요. 끌면 원하는 기간을 고를 수 있어요.` : '고른 기간을 넣었어요.' });
});

// 시작 창 안
$('#clsChips').addEventListener('click', e => {
  const c = e.target.closest('[data-cls]'); if (!c) return;
  dlg.cls = c.dataset.cls; if (dlg.cls !== 'season') dlg.m = null; paintDlg();
});
$('#seedBox').addEventListener('click', e => { const o = e.target.closest('[data-m]'); if (o) { dlg.m = o.dataset.m; paintDlg(); } });
$('#noDate').addEventListener('change', syncDate);
$('#dStart').addEventListener('change', () => { if ($('#dStart').value) { $('#dEnd').value = add($('#dStart').value, 13); $('#dateHelp').textContent = '시작일에서 2주로 맞췄어요.'; } if (dlg.cls === 'season') paintDlg(); });
$('#startForm').addEventListener('submit', e => {
  if (e.submitter?.value !== 'go') return;
  if (!dlg.cls) { e.preventDefault(); toast('어떤 프로모션인지 골라 주세요'); return; }
  const noDate = $('#noDate').checked, s = $('#dStart').value, en = $('#dEnd').value;
  const seed = dlg.cls === 'season' ? SEASONS.find(m => m.id === dlg.m)?.name : $('#seed')?.value.trim();
  if (!seed) { e.preventDefault(); toast(dlg.cls === 'season' ? '명분을 하나 골라 주세요' : `${CLS[dlg.cls].seed[0]}을 적어 주세요`); return; }
  if (!noDate && (!s || !en || en < s)) { e.preventDefault(); toast('기간을 확인해 주세요. 나중에 정해도 돼요'); return; }
  e.preventDefault();
  // 기획안 만들기 → 브리프로. 명분으로 시작하면 명분이 브리프 중심 키워드, 아니면 씨앗이 중심 키워드
  const m = dlg.cls === 'season' ? SEASONS.find(x => x.id === dlg.m) : null, sd = seed.slice(0, 20);
  const doc = { title: `${sd} 기획안`, origin: { type: m ? 'calendar' : 'brief', ref: m ? m.name.slice(0, 120) : '' },
    brief: { myeongbun: m ? m.name : '', period: noDate ? null : { start: s, end: en }, season_ref: m ? { name: m.name.slice(0, 30), date: m.d } : null },
    v2: { cls: dlg.cls, seed: sd, keywords: [], stage: 'brief' } };
  const btn = e.submitter; if (btn) btn.disabled = true;
  v2api('/api/am/projects', doc).then(d => location.assign(`/v2/brief?id=${d.id}`))
    .catch(err => { if (btn) btn.disabled = false; toast(`기획안을 만들지 못했어요: ${err.message}`); });
});
// ================= 실제 데이터 (새 버전): 기획안 목록·만들기 =================
// 목록은 예전 화면과 같은 저장소(/api/am/projects). 일정표의 몰 행사 = PROMO_WORK(/api/calendar), 명분 = 명분 사전(/api/seasons),
// 다음 마감 = 제작 일정(/api/am/schedule), 실적 = SAP 자동 수집(/api/sap-sales). 하나가 실패해도 나머지는 그대로 보여요
const STEP_NAME = { brief: '01 브리프', compose: '02 구좌 구성', editor: '03 구좌 편집', preview: '04 미리보기', deals: '상품·할인' };
const planUrl = p => `/v2/${p.stage || 'brief'}?id=${p.id}`;
function stateOf(s, e) { return !s ? '날짜 미정' : e < TODAY ? '지난 기획안' : s <= TODAY ? '진행 중' : '준비 중'; }
function loadPlans() {
  v2api('/api/am/projects').then(r => {
    PLANS.length = 0;
    for (const k of Object.keys(PLAN_STATE)) delete PLAN_STATE[k];
    for (const p of r.projects) {
      const s = p.period?.start || null, e = p.period?.end || null;
      PLANS.push({ id: p.id, name: p.title, cls: p.cls || 'none', s, e, step: STEP_NAME[p.stage] || STEP_NAME.brief, stage: p.stage || 'brief', next: null, real: true, kind: p.page_kind });
      PLAN_STATE[p.id] = stateOf(s, e);
    }
    if (selected?.type === 'plan' && !PLANS.some(p => p.id === selected.id)) selected = null;
    render();
    loadDeadlines(r.projects);
  }).catch(e => toast(`기획안 목록을 불러오지 못했어요: ${e.message}`));
}
loadPlans();

let HOME_LIVE = false;
render();

// ---------- 실제 데이터: 몰 행사·명분·실적·마감·지난 기획안 ----------
const mil = v => v == null ? '-' : (v / 1e6).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const gr = v => v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const rt = v => v == null ? '' : `${Math.round(v * 100)}%`;
function paintSales(d) {
  const el = $('.sales'); if (!el) return;
  if (!d?.ready) { el.innerHTML = `<span class="cap">오설록닷컴 실적 · 아직 받은 SAP 실적이 없어요${d?.status?.ok === false ? ' · 마지막 자동 수집 실패' : ''}</span>`; return; }
  const t = d.total, b = d.b2c, dd = `${+d.date.slice(5, 7)}/${+d.date.slice(8)}`;
  el.setAttribute('aria-label', '오설록닷컴 실적');
  el.innerHTML = `<span class="cap">오설록닷컴 실적 · ${dd} 기준 · 순매출 백만원 · SAP 자동 수집</span>
    <span><span class="k">${dd} 순매출</span><b>${mil(t.day)}</b> <span class="cap">B2C ${mil(b?.day)}</span></span>
    <span><span class="k">${esc(d.month_label)} 누계</span><b>${mil(t.month)}</b>${t.month_target ? ` / 목표 ${mil(t.month_target)} (<b>${rt(t.month_rate)}</b>)` : ''}</span>
    <span><span class="k">이대로면 ${esc(d.month_label)}</span><b>${t.month_target ? `목표의 ${rt(t.month_forecast / t.month_target)}` : mil(t.month_forecast)}</b></span>
    <span><span class="k">작년 같은 기간 대비</span><b class="${t.month_growth >= 0 ? 'up' : ''}">${gr(t.month_growth)}</b></span>
    <span><span class="k">${esc(d.by_label)} 누계</span><b>${mil(t.by)}</b>${t.by_target ? ` (목표 ${rt(t.by_rate)})` : ` <span class="cap">전년비 ${gr(t.by_growth)}</span>`}</span>`;
}
async function loadHomeData() {
  const c0 = add(mondayOf(TODAY), -70), wins = [0, 63, 126, 189].map(k => add(c0, k));
  const get = u => v2api(u).catch(() => null);
  const [cals, sea, sap, leg] = await Promise.all([Promise.all(wins.map(w => get(`/api/calendar?start=${w}&days=63`))), get('/api/seasons'), get('/api/sap-sales'), get('/api/am/legacy')]);
  const bars = cals.filter(Boolean).flatMap(c => c.bars || []);
  if (bars.length || cals.some(Boolean)) {   // 몰 행사: 같은 이름(상시·하루특가)은 한 줄로
    const by = {};
    for (const x of bars) { const k = x.promo || '이름 없음', o = by[k] ||= { name: k, s: x.start, e: x.end, rows: 0, types: new Set() };
      o.s = x.start < o.s ? x.start : o.s; o.e = x.end > o.e ? x.end : o.e; o.types.add(x.type); }
    const rows = {}; for (const x of bars) rows[`${x.promo}|${x.type}`] = x.rows;   // 창마다 같은 행사가 다시 나와서 이름·유형마다 한 번만 셈
    Object.entries(rows).forEach(([k, n]) => { by[k.split('|')[0] || '이름 없음'].rows += n; });
    EVENTS.length = 0;
    Object.values(by).sort((a, b) => (a.s < b.s ? -1 : 1)).forEach((x, i) => EVENTS.push({ id: `e${i}`, name: x.name, cls: 'mall', s: x.s, e: x.e, rows: x.rows, types: [...x.types].join('·') }));
  }
  if (sea?.view) {
    SEASONS.length = 0;
    sea.view.forEach((m, i) => SEASONS.push({ id: `m${i}`, name: m.name, d: m.date, kind: m.kind || '', lead: m.lead || 0,
      ly: (m.booked || []).slice(0, 5).map(b => `${b.name} (${b.rows}행)`), past: [(m.seeds || []).join(' · '), m.memo].filter(Boolean).join(' / ') }));
  }
  paintSales(sap);
  PAST.length = 0;
  (leg?.plans || []).forEach(x => PAST.push({ id: x.id, name: `${x.title || '제목 없음'} (예전 기획 도우미)`, cls: 'none', s: null, e: null, state: '지난 기획안', legacy: true }));
  HOME_LIVE = true;
  const demo = $('.demo'); if (demo) demo.innerHTML = '<b>실제 데이터예요.</b> 몰 행사는 PROMO_WORK, 명분은 명분 사전, 실적은 SAP 자동 수집, 마감은 제작 일정 규칙(주말·공휴일 제외)이에요. 오늘은 한국 날짜로 계산해요.';
  render();
}
// 다음 마감: 기간이 정해진 준비 중 기획안마다 제작 일정에서 오늘 이후 가장 가까운 단계
async function loadDeadlines(list) {
  const todo = PLANS.filter(p => p.real && p.s && p.s >= TODAY && p.kind !== '없음');
  const got = await Promise.all(todo.map(p => v2api(`/api/am/schedule?open=${p.s}&kind=${encodeURIComponent(p.kind === 'GNB' ? 'GNB' : '이벤트')}`).then(d => [p, d]).catch(() => [p, null])));
  let n = 0;
  for (const [p, d] of got) { const st = (d?.steps || []).find(x => x.date >= TODAY); if (st) { p.next = [st.label, st.date]; n++; } }
  if (n) render();
}
// 다시 쓰기: 상품·할인·구성을 364일(같은 요일)씩 옮겨 오늘 이후로 → 새 기획안
const shiftD = (d, k) => d ? add(d, k) : d;
async function reuse(id) {
  let doc; try { doc = await v2api(`/api/am/projects/${id}`); } catch (e) { toast(`기획안을 열지 못했어요: ${e.message}`); return; }
  const end = doc.brief?.period?.end; let k = 0; if (end) while (add(end, k) < TODAY) k += 364;
  if (!confirm(`「${doc.title}」을 ${k ? `${k / 364 * 52}주 뒤 같은 요일로` : '같은 날짜로'} 옮겨 새 기획안을 만들어요. 원래 기획안은 그대로 둬요.`)) return;
  const per = doc.brief?.period;
  const nd = { title: `${doc.title} (다시 쓰기)`.slice(0, 80), status: 'planning', origin: { type: 'replan', ref: id },
    brief: { ...doc.brief, period: per ? { start: shiftD(per.start, k), end: shiftD(per.end, k) } : null, season_ref: null },
    promo_rows: (doc.promo_rows || []).map(r => ({ ...r, start: shiftD(r.start, k), end: shiftD(r.end, k) })), deal_plan: doc.deal_plan, pool: doc.pool || [],
    page: doc.page, rationale: doc.rationale || '', v2: { ...(doc.v2 || {}), stage: 'brief', extras: (doc.v2?.extras || []).map(x => ({ ...x, s: shiftD(x.s, k), e: shiftD(x.e, k) })) } };
  try { const d = await v2api('/api/am/projects', nd); location.assign(`/v2/brief?id=${d.id}`); } catch (e) { toast(`새 기획안을 만들지 못했어요: ${e.message}`); }
}
async function importLegacy(id) {
  if (!confirm('예전 기획 도우미의 이 기획안을 새 버전 기획안으로 가져와요. 원래 기획안은 그대로 둬요.')) return;
  try { const d = await v2api(`/api/am/legacy/${encodeURIComponent(id)}/import`, {}); location.assign(`/v2/brief?id=${d.id}`); } catch (e) { toast(`가져오지 못했어요: ${e.message}`); }
}
document.addEventListener('click', e => {
  const r = e.target.closest('[data-reuse]'); if (r) { reuse(r.dataset.reuse); return; }
  const im = e.target.closest('[data-import]'); if (im) importLegacy(im.dataset.import);
});
loadHomeData();
