// 찻잎이 — 안내·알림·질문 응답 캐릭터 (외형은 그대로, 행동을 레퍼런스 수준으로)
//  - 누르면 메뉴 카드(대화·이번 주 아이디어·오늘의 체크·바깥 소식·오늘의 퀴즈)
//  - 상태 배지: ! 알림 / … 답 쓰는 중 / ✓ 끝 — 말풍선은 40초마다 바뀜(하루 같은 문장 1번, 끄기 가능)
//  - 답: 데이터로 바로(규칙, 비용 없음). 기획을 통째로 맡기는 Claude는 사용자가 확인 버튼을 누를 때만(비용 안내)
//  모든 숫자는 서버 데이터 그대로(T1 규칙). AI 문장 없음.
import { $, $$, api, emit, esc, icon, man, maxDiscount, on, pct, state, toast, won } from './core.js';
import { currentRows } from './plan.js';

let busy = false;
const LS_DISMISS = 'planner.alerts.dismissed.v1', LS_QUIET = 'planner.alerts.quiet', LS_SAID = 'planner.bubble.said.v1', LS_QUIZ = 'planner.quiz.v1';
let alerts = [];
const CHIPS_BASE = ['오늘의 체크', '이번 주 하루특가 채우기', '작년 블프랑 비슷하게, 품목만 최신 매출로', '오늘의 퀴즈'];

export function initChat() {
  $('#mascotBtn').addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  $('#drawerClose').addEventListener('click', close);
  $('.modes')?.classList.add('hidden');
  $('#askSend').addEventListener('click', send);
  $('#askInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  $('#quickAsk').addEventListener('click', e => { const c = e.target.closest('[data-q]'); if (c) { $('#askInput').value = c.dataset.q; send(); } });
  $('#msgs').addEventListener('click', onMsgAction);
  document.addEventListener('mousedown', e => { if (!e.target.closest('#mascotMenu') && !e.target.closest('#mascotBtn')) hideMenu(); });
  on('chat:open', d => { open(); if (d?.useCurrent) $('#useCurrent').checked = true; if (d?.text) $('#askInput').value = d.text; $('#askInput').focus(); });
  $('#drawerSub').textContent = '기획 도우미 · 숫자는 바로, 기획은 같이';
  $('#askInput').placeholder = '예) 이번 주 하루특가 채우기 / 프리미엄 말차 몇 %? / 2만원대 선물';
  $('#useCurrentWrap').classList.add('hidden');
  chips();
  greet();
  on('alerts:reload', loadAlerts);
  on('replan:show', r => { open(); showReplan(r); });
  loadAlerts().then(() => { setTimeout(rotateBubble, 1500); setInterval(rotateBubble, 40000); });
}

// ---------------------------------------------------------------- 상태 배지 (! … ✓)
function setBadge(kind) {
  const b = $('#mascotBadge');
  b.className = 'nbadge';
  if (kind === 'think') { b.textContent = '…'; b.classList.add('think'); b.title = '답 쓰는 중'; return; }
  if (kind === 'done') { b.textContent = '✓'; b.classList.add('done'); b.title = '답했어요'; setTimeout(() => setBadge(), 4000); return; }
  const n = visibleAlerts().filter(a => a.level !== 'info').length;
  b.textContent = n ? '!' : ''; b.classList.toggle('hidden', !n); b.title = n ? `확인할 알림 ${n}건` : '';
}

// ---------------------------------------------------------------- 메뉴
function toggleMenu() {
  let m = $('#mascotMenu');
  if (m && !m.classList.contains('hidden')) { hideMenu(); return; }
  if (!m) { m = document.createElement('div'); m.id = 'mascotMenu'; m.className = 'mmenu'; document.body.appendChild(m); }
  const n = visibleAlerts().length, imp = visibleAlerts().filter(a => a.level !== 'info').length;
  const items = [
    ['chat', icon('leaf'), '대화하기', '숫자는 바로 찾고, 기획은 같이 우려요'],
    ['ideas', icon('bulb'), '이번 주 아이디어', '명분·레버·바깥 신호로 짠 초안'],
    ['checks', icon('flag'), `오늘의 체크${n ? ` <span class="tag ${imp ? 'miss' : 'plan'}">${n}</span>` : ''}`, '빈 날 · 명분 준비 · 곧 끝나는 행사'],
    ['scout', icon('trend'), '바깥 소식', '요즘 뜨는 말과 오설록 연결'],
    ['quiz', icon('chart'), '오늘의 퀴즈', '우리 실적으로 푸는 기획 감각 한 문제'],
  ];
  m.innerHTML = items.map(([k, ic, t, s]) => `<button class="mitem" data-m="${k}"><span class="ic">${ic}</span><span><b>${t}</b><small>${s}</small></span></button>`).join('')
    + `<button class="mquiet" data-m="quiet">${quiet() ? '말풍선 켜기' : '말풍선 끄기'}</button>`;
  m.classList.remove('hidden');
  m.onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    hideMenu();
    const k = b.dataset.m;
    if (k === 'chat') open();
    else if (k === 'ideas') $('.tab[data-view="calendar"]').click();
    else if (k === 'checks') { open(); showChecks(); }
    else if (k === 'scout') $('.tab[data-view="signals"]').click();
    else if (k === 'quiz') { open(); quiz(); }
    else if (k === 'quiet') { try { localStorage.setItem(LS_QUIET, quiet() ? '0' : '1'); } catch { /* 무시 */ } toast(quiet() ? '말풍선을 껐어요 (배지는 계속 보여요)' : '말풍선을 켰어요'); }
  };
}
function hideMenu() { $('#mascotMenu')?.classList.add('hidden'); }
function quiet() { try { return localStorage.getItem(LS_QUIET) === '1'; } catch { return false; } }

// ---------------------------------------------------------------- 말풍선 (40초마다, 같은 문장은 하루 1번)
function bubbleLines() {
  const out = [];
  const wd = new Date().getDay(), idx = state.levers?.weekday_index?.[(wd + 6) % 7];
  visibleAlerts().filter(a => a.level !== 'info').slice(0, 2).forEach(a => out.push({ id: a.id, t: `${a.title}: 저를 눌러 확인하세요` }));
  if (idx) {
    if (wd === 1) out.push({ id: 'wd1', t: `월요일이에요. 평소에도 매출이 ${idx.toFixed(1)}배인 날. 특가는 화·목이 더 효과적일 수 있어요` });
    else if (wd === 5) out.push({ id: 'wd5', t: '금요일이에요. 주말엔 평소의 0.6배만 팔려요. 월요일 준비는 끝났나요?' });
    else out.push({ id: `wd${wd}`, t: `오늘 평소 매출 요일 지수 ${idx.toFixed(2)}: 진한 칸이 잘 팔리는 요일이에요(명분 캘린더)` });
  }
  const rested = state.products.filter(p => p.active && (p.days_since_deal >= 61) && p.max_discount >= 0.3).sort((a, b) => (b.sales_28 || 0) - (a.sales_28 || 0))[0];
  if (rested) out.push({ id: `rest:${rested.seq}`, t: `${rested.name}, 하루특가 ${rested.days_since_deal}일 쉬었어요. 지금 걸면 반응 클 때예요` });
  out.push({ id: 'quiz', t: '오늘의 퀴즈 풀어 볼래요? 저를 누르면 있어요' });
  out.push({ id: 'tip-menu', t: '저를 누르면 이번 주 아이디어·오늘의 체크·바깥 소식을 볼 수 있어요' });
  return out;
}
function said() { try { return JSON.parse(localStorage.getItem(LS_SAID) || '{}'); } catch { return {}; } }
function rotateBubble() {
  if (quiet() || !$('#drawer').classList.contains('hidden')) return;
  const today = new Date().toISOString().slice(0, 10);
  const s = said();
  const next = bubbleLines().find(l => s[l.id] !== today);
  if (!next) return;
  s[next.id] = today; try { localStorage.setItem(LS_SAID, JSON.stringify(s)); } catch { /* 무시 */ }
  const b = $('#mascotBubble'); b.innerHTML = `${esc(next.t)}<span class="bsrc">데이터 · 규칙</span>`; b.classList.remove('hidden');
  setTimeout(() => b.classList.add('hidden'), 7000);
}

// ---------------------------------------------------------------- 오늘의 체크 (규칙 알림)
function dismissed() { try { return JSON.parse(localStorage.getItem(LS_DISMISS) || '{}'); } catch { return {}; } }
function visibleAlerts() { const d = dismissed(); return alerts.filter(a => !d[a.id]); }
async function loadAlerts() {
  try { alerts = (await api('/api/alerts')).alerts; } catch { alerts = []; }
  state.alerts = alerts; emit('alerts:loaded', alerts);
  setBadge(); chips();
}
function showChecks() {
  const vs = visibleAlerts();
  const LV = { urgent: ['error', '✕ 긴급'], important: ['warn', '! 중요'], info: ['ok', 'i 참고'] };
  const d = addMsg('bot', vs.length ? `<div class="ans-head">오늘 확인할 게 <b>${vs.length}건</b> 있어요.</div><div class="checks">${vs.map(a => `<div class="chk" data-aid="${esc(a.id)}">
      <div class="row"><span class="status ${LV[a.level][0]}">${LV[a.level][1]}</span><b class="grow">${esc(a.title)}</b></div>
      <div class="sm">${esc(a.text)}</div>
      <div class="acts"><button class="btn sm" data-ago="${esc(a.id)}">보기</button><button class="btn sm ghost" data-adone="${esc(a.id)}">확인했어요</button></div></div>`).join('')}</div>
      <div class="basis">규칙으로 계산한 알림 · '확인했어요'를 누르면 같은 알림은 다시 안 떠요</div>`
    : '<div class="ans-head">오늘은 확인할 게 없어요 ✓</div><div class="basis">하루특가 빈 날·명분 준비·곧 끝나는 행사·뜨는 상품·바깥 신호를 매번 확인해요</div>', '오늘의 체크');
  d.addEventListener('click', e => {
    const go = e.target.closest('[data-ago]'), done = e.target.closest('[data-adone]');
    if (done) { const m = dismissed(); m[done.dataset.adone] = new Date().toISOString().slice(0, 10); try { localStorage.setItem(LS_DISMISS, JSON.stringify(m)); } catch { /* 무시 */ } done.closest('.chk').remove(); setBadge(); return; }
    if (go) { const a = alerts.find(x => x.id === go.dataset.ago); if (a) runAction(a.action); }
  });
}
function runAction(act) {
  if (!act) return;
  if (act.view === 'calendar') emit('calendar:day', act.arg || new Date().toISOString().slice(0, 10));
  else if (act.view === 'products') emit('products:preset', act.arg || 'all');
  else if (act.view === 'review') act.arg ? emit('review:open', act.arg) : $('.tab[data-view="review"]').click();
  else $(`.tab[data-view="${act.view}"]`)?.click();
}

// ---------------------------------------------------------------- 서랍
function open() { hideMenu(); $('#drawer').classList.remove('hidden'); $('#mascotBtn').classList.add('hidden'); $('#mascotBubble').classList.add('hidden'); $('#askInput').focus(); }
function close() { $('#drawer').classList.add('hidden'); $('#mascotBtn').classList.remove('hidden'); }

function chips() {
  const wd = new Date().getDay();
  const extra = wd === 1 || wd === 5 ? ['이번 주 하루특가 채우기'] : [];
  const mb = (state.alerts || alerts).find(a => a.id.startsWith('season:'));
  const list = [...new Set([...extra, ...CHIPS_BASE, mb ? `${mb.title.replace(/^D-\d+ /, '')} 작년엔 어땠어?` : '작년 이맘때 잘 팔린 상품'])].slice(0, 4);
  $('#quickAsk').innerHTML = list.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('');
}

function greet() {
  const wd = new Date().getDay(), idx = state.levers?.weekday_index?.[(wd + 6) % 7];
  addMsg('bot', `<div class="ans-head">안녕하세요, 찻잎이예요</div>숫자는 바로 찾아 드리고, 기획은 같이 우려 볼게요.
    ${idx ? `<div class="basis">오늘 ${'일월화수목금토'[wd]}요일 · 평소 매출 지수 ${idx.toFixed(2)}${(state.alerts || []).length ? ` · 확인할 것 ${(state.alerts || []).length}건` : ''}</div>` : ''}`);
}

function addMsg(who, html, src) {
  const d = document.createElement('div');
  d.className = `msg ${who === 'me' ? 'me' : ''}`;
  d.innerHTML = (src ? `<div class="src">${esc(src)}</div>` : '') + html;
  $('#msgs').appendChild(d);
  $('#msgs').scrollTop = $('#msgs').scrollHeight;
  return d;
}

// 답 카드: 결론 1줄 → 표 → 한 줄 → 기준(레퍼런스 형식)
function ans(head, body = '', take = '', basis = '') {
  return `<div class="ans-head">${head}</div>${body}${take ? `<div class="take">${take}</div>` : ''}${basis ? `<div class="basis">${basis}</div>` : ''}`;
}

async function send() {
  const text = $('#askInput').value.trim();
  if (!text || busy) return;
  $('#askInput').value = '';
  addMsg('me', esc(text));
  // "작년 ○○랑 비슷하게 … 최신 매출로 조정" → 규칙 재기획(비용 없음)
  if (/(작년|지난\s*(번|해)?|예전)/.test(text) && /(비슷|그대로|참고|조정|최신|맞춰|다시|처럼|같이)/.test(text)) {
    const ev = await eventName(text);
    if (ev) {
      setBadge('think');
      const thinking = addMsg('bot', `<span class="typing"><i></i><i></i><i></i></span> <span class="cap">작년 '${esc(ev)}' 구성을 펼쳐 놓고 품목을 고르는 중</span>`);
      const body = { query: ev, start: parseStartDate(text), types: parseTypes(text) };
      let r; try { r = await api('/api/replan', { method: 'POST', body }); } catch (e) { thinking.remove(); addMsg('bot', ans(esc(e.message))); setBadge(); return; }
      thinking.remove(); showReplan(r); setBadge('done');
      return;
    }
  }
  // 기획을 통째로 맡기는 요청 → Claude 제안(사용자가 눌러야 실행, 비용 안내)
  if (/(짜\s*줘|기획해|다듬어|구성해\s*줘|만들어\s*줘)/.test(text) && !/(퀴즈|체크)/.test(text)) {
    addMsg('bot', ans('통째로 기획하는 건 Claude랑 우려야 해요.', '', '대신 바로 쓸 수 있는 건 [캘린더] 아래의 이번 주 아이디어, 캘린더 명분의 "이 명분으로 기획 시작", [트렌드]의 "이 말로 기획 시작"이에요.',
      `Claude 기획은 1~3분 · 회당 비용이 들어요${state.claude.available ? '' : ' (지금 PC에는 연결 패키지가 없어요)'}`)
      + (state.claude.available ? `<div class="acts"><button class="btn sm" data-claude="${esc(text)}">그래도 Claude랑 우려보기</button></div>` : ''));
    return;
  }
  setBadge('think');
  const thinking = addMsg('bot', '<span class="typing"><i></i><i></i><i></i></span> <span class="cap">찻잎 고르는 중</span>');
  await new Promise(r => setTimeout(r, 900));
  thinking.remove();
  await quickAnswer(text);
  setBadge('done');
}

// ---------------------------------------------------------------- 지난 행사 다시 기획 (규칙)
const ALIAS = { '블랙프라이데이': '블프', '블랙 프라이데이': '블프', '크리스마스': '홀리데이', '연말': '홀리데이', '설날': '설', '명절': '추석', '감사의 달': '감사의달', '가정의 달': '감사의달', '차의 날': '차의날' };
let waveNames = null;
async function eventName(t) {
  for (const [k, v] of Object.entries(ALIAS)) if (t.includes(k)) return v;
  if (!waveNames) { try { waveNames = [...new Set((await api('/api/review')).waves.filter(w => w.status === '완료').map(w => w.promo))]; } catch { waveNames = []; } }
  const tt = t.replace(/\s/g, '');
  const hit = waveNames.filter(n => n.length >= 1 && tt.includes(n.replace(/\s/g, ''))).sort((a, b) => b.length - a.length)[0];
  return hit || null;
}

// "11/2 - 11/16", "11월 2일부터", "2026-11-02" → 첫 날짜를 시작일로 (지난 날짜면 내년)
function parseStartDate(t) {
  const iso = t.match(/(20\d\d)-(\d{1,2})-(\d{1,2})/);
  let y, m, d;
  if (iso) { [y, m, d] = [+iso[1], +iso[2], +iso[3]]; }
  else {
    const k = t.match(/(\d{1,2})\s*(?:\/|월)\s*(\d{1,2})\s*일?/);
    if (!k) return null;
    [m, d] = [+k[1], +k[2]];
    const now = new Date();
    y = now.getFullYear();
    if (new Date(y, m - 1, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)) y += 1;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseTypes(t) {
  const deal = /하루\s*특가|특가/.test(t), sangsi = /상시/.test(t);
  if (deal && !sangsi) return ['하루특가'];
  if (sangsi && !deal) return ['상시'];
  return null;
}

let lastReplan = null;
function showReplan(r) {
  if (!r.ok) { addMsg('bot', ans(esc(r.message || '찾지 못했어요'), '', '행사명을 PROMO_WORK에 적힌 그대로 말해 주세요 (예: 블프, 설, 홀리데이, 감사의달).')); return; }
  lastReplan = r;
  const s = r.summary, L = r.log;
  const src = r.source.map(x => `${x.promo} ${x.type} ${x.start.slice(2)}~${x.end.slice(5)} ${x.rows}품목`).join(' · ');
  const li = (arr, f) => arr.slice(0, 6).map(f).join('') + (arr.length > 6 ? `<li class="cap">외 ${arr.length - 6}개</li>` : '');
  const dist = d => Object.entries(d || {}).map(([t, arr]) => `${esc(t)} ${arr.map(([k, n]) => `${k}×${n}`).join(' · ')}`).join(' / ');
  const shift = r.requested_start ? `요청하신 <b>${esc(r.start)}</b>부터` : `<b>${esc(r.start)}</b>부터 (${r.offset}일 뒤${r.offset % 7 ? '' : ', 같은 요일'})`;
  const body = `<div class="sm">원본: ${esc(src)} → ${shift}</div>
    ${(r.booked || []).length ? `<div class="info-box sm mt8">올해 이미 잡힌 같은 이름 행사: ${r.booked.map(b => `<b>${esc(b.promo)}</b> ${esc(b.type)} ${b.start.slice(5)}~${b.end.slice(5)} ${b.rows}품목`).join(' · ')}${r.requested_start ? '' : ': 날짜를 맞추려면 "11/2부터"처럼 시작일을 같이 말해 주세요.'}</div>` : ''}
    <div class="sm mt8"><b>할인율</b> 작년 그대로: ${dist(s.rate_dist)}</div>
    <table class="mini mt8"><tbody>
      <tr><td>유지</td><td class="num"><b>${s.kept}</b></td><td>교체</td><td class="num"><b>${s.replaced}</b></td></tr>
      <tr><td>뺌 · 추가</td><td class="num"><b>${s.dropped} · ${s.added}</b></td><td>확인해 볼 것</td><td class="num"><b>${s.watch}</b></td></tr></tbody></table>
    ${L.replaced.length ? `<div class="sm mt8"><b>교체</b> <span class="cap">지금 안 팔리는 상품만 · 할인율은 그 자리 그대로</span><ul class="tips">${li(L.replaced, x => `<li>${esc(x.from)} → <b>${esc(x.to)}</b> <span class="cap">${esc(x.why)} · ${esc(x.pick_why)}</span></li>`)}</ul></div>` : ''}
    ${L.watch.length ? `<div class="sm"><b>확인해 볼 것</b> <span class="cap">작년대로 넣어 뒀어요 · 바꿀지 판단해 주세요</span><ul class="tips">${li(L.watch, x => `<li>${esc(x.name)} <span class="cap">${esc(x.why)}</span></li>`)}</ul></div>` : ''}
    ${L.added.length ? `<div class="sm"><b>추가 (올해 뜬 베스트)</b><ul class="tips">${li(L.added, x => `<li>${esc(x.name)} <span class="cap">${esc(x.why)}</span></li>`)}</ul></div>` : ''}
    ${L.dropped.length ? `<div class="sm"><b>뺌</b><ul class="tips">${li(L.dropped, x => `<li>${esc(x.name)} <span class="cap">${esc(x.why)}</span></li>`)}</ul></div>` : ''}
    ${L.rate.length ? `<div class="sm"><b>원가율 참고</b> <span class="cap">45% 넘지만 작년 할인율 유지</span><ul class="tips">${li(L.rate, x => `<li>${esc(x.name)} ${pct(x.rate)} <span class="cap">할인 후 원가율 ${pct(x.cost_ratio)}</span></li>`)}</ul></div>` : ''}`;
  addMsg('bot', ans(`작년 품목·할인율 그대로 옮겼어요. <b>${s.rows}행</b> · 예상 ${man(s.expected_range?.[0])}~${man(s.expected_range?.[1])}만원`, body,
    s.errors ? `오류 ${s.errors}건은 기획안 03 상품·혜택의 판정 배지에서 확인할 수 있어요.` : '', esc(r.note))
    + `<div class="acts"><button class="btn sm primary" data-replan="go">기획안에 담기</button><button class="btn sm" data-rpopen="${esc(r.source[0].promo)}">날짜·유형 바꿔서 보기</button></div>`, '지난 행사 다시 기획 · 규칙');
}

// ---------------------------------------------------------------- 빠른 답 (규칙 · 비용 없음)
function parsePrice(t) {
  const m = t.match(/(\d+)\s*만\s*원?\s*(대|이상|이하|미만)?/);
  if (!m) return null;
  const n = +m[1] * 10000, k = m[2] || '대';
  if (k === '대') return [n, n + 9999];
  if (k === '이상') return [n, Infinity];
  return [0, n - (k === '미만' ? 1 : 0)];
}
function parseCat(t) {
  if (/티푸드|과자|디저트|랑드샤|쿠키|케이크/.test(t)) return '티푸드';
  if (/세트|선물/.test(t)) return '티 세트';
  if (/라이프|다구|텀블러|컵/.test(t)) return '라이프 스타일';
  if (/티백|잎차|녹차|블렌디드|티 제품/.test(t)) return '티 제품';
  return null;
}
function findProduct(t) {
  const clean = t.replace(/(묶을|짝|조합|섞|어때|알려줘|찾아줘|상품|할인|원가|몇\s*%|몇\s*프로|반응|\?|은|는|이|가|을|를|와|과|랑)/g, ' ').replace(/\s+/g, '');
  if (clean.length < 2) return null;
  const nm = p => String(p.name).replace(/\s/g, '');
  const exact = state.products.find(p => nm(p) === clean);
  if (exact) return exact;
  const inside = state.products.filter(p => clean.includes(nm(p)));            // 질문이 상품명을 통째로 품은 경우: 가장 긴 이름
  if (inside.length) return inside.sort((a, b) => nm(b).length - nm(a).length)[0];
  const hits = state.products.filter(p => nm(p).includes(clean));             // 상품명이 질문을 품은 경우: 가장 짧은(가까운) 이름
  return hits.sort((a, b) => nm(a).length - nm(b).length || (b.sales_28 || 0) - (a.sales_28 || 0))[0] || null;
}
// 질문 속 말로 상품 거르기(레퍼런스처럼 상품명을 무시하지 않게): 말차·세작·밀크티…
const FAMILY = ['말차', '세작', '우전', '녹차', '호지', '밀크티', '블렌디드', '블랙티', '얼그레이', '영귤', '꿀배', '허브', '콤부차', '콜드브루', '랑드샤', '롤케이크'];
function familyOf(t) { return FAMILY.filter(w => t.includes(w)); }

function prodTable(rows, cols) {
  return `<table class="mini"><thead><tr><th>상품</th>${cols.map(c => `<th class="num">${c[0]}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(p => `<tr><td>${esc(p.name)}</td>${cols.map(c => `<td class="num">${c[1](p)}</td>`).join('')}
    <td><button class="btn sm" data-add="${p.seq}" data-type="${esc(p._type || '상시')}" data-rate="${p._rate || ''}">담기</button></td></tr>`).join('')}</tbody></table>`;
}

async function quickAnswer(t) {
  const active = state.products.filter(p => p.active && p.cost !== null && p.cost !== undefined);
  const price = parsePrice(t), cat = parseCat(t), fam = familyOf(t);
  const pool = active.filter(p => (!price || (p.price >= price[0] && p.price <= price[1])) && (!cat || p.category === cat)
    && (!fam.length || fam.some(w => String(p.name).includes(w))));
  const scope = [price ? `${won(price[0])}~${Number.isFinite(price[1]) ? won(price[1]) : ''}원` : '', cat || '', fam.join('·')].filter(Boolean).join(' · ') || '전체';
  const sales = '28일 매출(만원)';

  if (/퀴즈/.test(t)) { quiz(); return; }
  if (/오늘의 ?체크|알림/.test(t)) { showChecks(); return; }
  if (/빈 ?날|비어|하루특가 ?채우/.test(t)) {
    const a = alerts.find(x => x.id.startsWith('gap:'));
    const rows = pool.filter(p => p.max_discount >= 0.3 && (p.days_since_deal === null || p.days_since_deal === undefined || p.days_since_deal >= 61) && !(p.upcoming || []).length)
      .sort((x, y) => (y.sales_28 || 0) - (x.sales_28 || 0)).slice(0, 6).map(p => ({ ...p, _type: '하루특가', _rate: Math.min(0.4, Math.floor(p.max_discount * 20) / 20) }));
    addMsg('bot', ans(a ? esc(a.text.split('.')[0]) + '.' : '앞으로 2주 안 하루특가 빈 날은 없어요.',
      rows.length ? prodTable(rows, [['쉰 기간', p => p.days_since_deal === null || p.days_since_deal === undefined ? '첫 특가' : `${p.days_since_deal}일`], ['제안', p => pct(p._rate)], [sales, p => man(p.sales_28)]]) : '',
      '채울 땐 푹 쉰 상품을 화·수·목에 하루 3~4개, 우리 실적상 반응이 가장 컸어요.', '쉰 기간 = 같은 상품 마지막 하루특가 이후 · 제안 = 원가율 45% 안 최대(40% 상한)')
      + (a ? `<div class="acts"><button class="btn sm" data-cal="${esc(a.action.arg)}">캘린더에서 날짜 보기</button></div>` : ''));
    return;
  }
  if (/푹 ?쉰|쉬었던|오래 ?쉰/.test(t)) {
    const rows = pool.filter(p => p.max_discount >= 0.3 && (p.days_since_deal === null || p.days_since_deal === undefined || p.days_since_deal >= 61))
      .sort((x, y) => (y.sales_28 || 0) - (x.sales_28 || 0)).slice(0, 8).map(p => ({ ...p, _type: '하루특가', _rate: Math.min(0.4, Math.floor(p.max_discount * 20) / 20) }));
    const g = Object.fromEntries((state.levers?.gap || []).map(x => [x.band, x]));
    addMsg('bot', ans(`${esc(scope)} 중 하루특가를 두 달 넘게 쉰 인기 상품이에요.`,
      prodTable(rows, [['쉰 기간', p => p.days_since_deal === null || p.days_since_deal === undefined ? '첫 특가' : `${p.days_since_deal}일`], ['최대 할인', p => pct(p.max_discount)], [sales, p => man(p.sales_28)]]),
      g['61~120일'] && g['~14일'] ? `61~120일 쉰 상품은 평소의 <b>${g['61~120일'].lift.toFixed(1)}배</b>, 14일 안 재특가는 ${g['~14일'].lift.toFixed(1)}배였어요.` : '', '레버 보드 ③ 쉰 기간 · 하루특가 완료 건 기준'));
    return;
  }
  const mp = /몇\s*(%|프로)|반응|얼마나 ?할인|할인율/.test(t) ? findProduct(t) : null;
  if (mp) {
    let r; try { r = await api(`/api/response/${mp.seq}`); } catch { r = null; }
    const own = (r?.own || []).map(x => `${x.band} ${x.lift.toFixed(1)}배(${x.n})`).join(' · ') || '하루특가 기록 없음';
    addMsg('bot', ans(`<b>${esc(mp.name)}</b>: ${esc((r?.tips || [])[0] || '')}`, `<div class="sm">이 상품 하루특가 반응: ${esc(own)}</div>`,
      (r?.tips || []).slice(1).map(esc).join('<br>'), r?.note ? esc(r.note) : '')
      + `<div class="acts"><button class="btn sm" data-detail="${mp.seq}">상품 상세에서 반응 카드 보기</button></div>`);
    return;
  }
  if (/작년|이맘때|어땠/.test(t)) {
    const rows = pool.filter(p => p.ly_next28 > 0).sort((a, b) => b.ly_next28 - a.ly_next28).slice(0, 8);
    const mb = alerts.find(x => x.id.startsWith('season:') && t.includes(x.title.replace(/^D-\d+ /, '')));
    addMsg('bot', ans(`${esc(scope)} 중 작년 같은 시기(앞으로 4주에 해당하는 364일 전 4주)에 많이 팔린 상품이에요.`,
      prodTable(rows, [['작년 4주(만원)', p => man(p.ly_next28)], ['올해 28일', p => man(p.sales_28)], ['최대 할인', p => pct(p.max_discount)]]),
      '작년 같은 시즌 행사 구성은 [지난 성과]의 행사 회차 성과에서 올해 날짜로 다시 기획할 수 있어요.', '작년 = 364일 전 같은 요일')
      + (mb && mb.action?.view === 'review' ? `<div class="acts"><button class="btn sm" data-wave="${esc(mb.action.arg)}">작년 행사 성과 열기</button></div>` : ''));
    return;
  }
  if (/평소|패턴|보통/.test(t)) {
    const pats = (state.patterns?.by_type_price || []);
    if (!pats.length) { addMsg('bot', ans('할인 패턴은 [지난 성과]에서 볼 수 있어요.')); return; }
    addMsg('bot', ans('과거 행사 기준 평소 할인율(중앙)이에요.', `<table class="mini"><thead><tr><th>유형</th><th>가격대</th><th class="num">중앙</th><th class="num">상위25%</th><th class="num">행사 수</th></tr></thead><tbody>${pats.map(r => `<tr><td>${esc(r['유형'])}</td><td>${esc(r['가격대'])}</td><td class="num">${pct(r['할인율_중앙'])}</td><td class="num">${pct(r['할인율_상위25'])}</td><td class="num">${r['행사수']}</td></tr>`).join('')}</tbody></table>`, '', 'PROMO_WORK 2025-09 이후'));
    return;
  }
  if (/짝|묶|조합|섞/.test(t)) {
    const p = findProduct(t);
    if (!p) { addMsg('bot', ans('어떤 상품을 묶을지 상품명을 같이 적어 주세요.', '', '예) "말차 클래식 기프트 묶을 짝"')); return; }
    emit('partner:base', { seq: p.seq, rate: 0.3 });
    const md = maxDiscount(p.price, p.cost);
    addMsg('bot', ans(`<b>${esc(p.name)}</b>: ${md > 0 ? `혼자서는 최대 <b>${pct(md)}</b>까지예요.` : '혼자서는 조금만 할인해도 원가율 기준을 넘어요.'}`, '', '조합 추천 화면 맨 위에 짝 후보를 띄웠어요.', `원가율 ${pct(p.cost_ratio)} · 기준 ${pct(state.target)}`));
    return;
  }
  if (/하루특가|특가|딜/.test(t)) {
    const rows = pool.filter(p => p.max_discount >= 0.35 && !(p.upcoming || []).length).sort((a, b) => (b.sales_28 || 0) - (a.sales_28 || 0)).slice(0, 8)
      .map(p => ({ ...p, _type: '하루특가', _rate: Math.min(0.4, Math.floor(p.max_discount * 20) / 20) }));
    addMsg('bot', rows.length ? ans(`${esc(scope)} 중 <b>35% 넘게 할인해도 원가율 ${pct(state.target)} 안</b>이고 예정 행사가 없는 상품이에요.`,
      prodTable(rows, [['최대 할인', p => pct(p.max_discount)], ['제안', p => pct(p._rate)], ['쉰 기간', p => p.days_since_deal === null || p.days_since_deal === undefined ? '첫' : `${p.days_since_deal}일`], [sales, p => man(p.sales_28)]]),
      '36~40%에서 반응이 계단식으로 뛰었어요. 제안 할인율로 담겨요.', '최근 28일 매출순') : ans('조건에 맞는 상품이 없어요.'));
    return;
  }
  if (/예시|아이디어/.test(t) && !fam.length) {
    $('.tab[data-view="calendar"]').click();
    addMsg('bot', ans('[캘린더] 아래에 이번 주 아이디어를 띄웠어요.', '', '명분·레버·바깥 신호·고객 반응 묶음이 섞여 있어요. "다른 아이디어 보기"로 넘겨 보세요.'));
    return;
  }
  if (/재고|털이|클리어런스|소진/.test(t)) {
    addMsg('bot', ans('재고 데이터는 연결되어 있지 않아 재고 기준으로는 못 찾아요.', '', "털이 상품을 알려 주시면 작업대에서 그 행을 '털이'로 표시해 원가율 기준을 넘겨도 허용할 수 있어요."));
    return;
  }
  if (/오래|행사 ?없/.test(t)) {
    const rows = pool.filter(p => p.days_since_promo === null || p.days_since_promo === undefined || p.days_since_promo >= 45)
      .sort((a, b) => (b.sales_28 || 0) - (a.sales_28 || 0)).slice(0, 8);
    addMsg('bot', ans(`${esc(scope)} 중 꾸준히 팔리는데 45일 넘게 행사가 없었던 상품이에요.`,
      prodTable(rows, [['마지막 행사', p => p.days_since_promo === null || p.days_since_promo === undefined ? '없음' : `${p.days_since_promo}일 전`], ['최대 할인', p => pct(p.max_discount)], [sales, p => man(p.sales_28)]]), '', 'PROMO_WORK 기준 · 28일 매출순'));
    return;
  }
  if (/뜨는|성장|오르|늘어|핫/.test(t)) {
    const rows = pool.filter(p => (p.sales_28 || 0) > 500000 && p.growth_28 !== null).sort((a, b) => b.growth_28 - a.growth_28).slice(0, 8);
    addMsg('bot', ans(`${esc(scope)} 중 최근 28일 매출이 직전보다 많이 는 상품이에요.`,
      prodTable(rows, [['직전 대비', p => `${Math.round(p.growth_28 * 100)}%`], [sales, p => man(p.sales_28)], ['최대 할인', p => pct(p.max_discount)]]), '바깥에서 뜨는 말은 [트렌드 스카우트]에서 봐요.', '28일 매출 50만원 이상'));
    return;
  }
  if (/원가율.*(높|넘)|할인 여력.*(없|적)/.test(t)) {
    const rows = pool.sort((a, b) => b.cost_ratio - a.cost_ratio).slice(0, 8);
    addMsg('bot', ans(`${esc(scope)} 중 원가율이 높은 상품이에요.`, prodTable(rows, [['원가율', p => pct(p.cost_ratio)], ['최대 할인', p => pct(Math.max(0, p.max_discount))], [sales, p => man(p.sales_28)]]), '할인하려면 원가 낮은 상품과 묶어 보세요 (예: "○○ 묶을 짝").'));
    return;
  }
  if (/베스트|잘 ?팔|매출|인기/.test(t) || price || cat || fam.length) {
    const rows = pool.sort((a, b) => (b.sales_28 || 0) - (a.sales_28 || 0)).slice(0, 8);
    const tot = pool.reduce((s, p) => s + (p.sales_28 || 0), 0);
    const grow = pool.reduce((s, p) => s + (p.sales_28 || 0) / (1 + (p.growth_28 ?? 0)), 0);
    const g = tot && grow ? tot / grow - 1 : null;
    addMsg('bot', ans(`${esc(scope)} 최근 28일 매출 <b>${man(tot)}만원</b>${g !== null ? ` · 직전 28일보다 <b>${g >= 0 ? '▲' : '▼'}${Math.abs(Math.round(g * 100))}%</b>` : ''}`, prodTable(rows, [['정가', p => won(p.price)], ['최대 할인', p => pct(p.max_discount)], [sales, p => man(p.sales_28)]]),
      rows[0] ? `가장 많이 판 상품은 <b>${esc(rows[0].name)}</b>(${man(rows[0].sales_28)}만원).` : '',
      `${/이번 ?주|지난 ?주|어제|오늘/.test(t) ? '주·일 단위 매출은 아직 없어서 최근 28일로 답했어요 · ' : ''}~${esc(state.meta?.sales_last_day || '')} 출고일 기준`));
    return;
  }
  const p = findProduct(t);
  if (p) {
    addMsg('bot', ans(`<b>${esc(p.name)}</b>: 최근 28일 ${man(p.sales_28)}만원 · 최대 할인 <b>${pct(p.max_discount)}</b>`,
      `<div class="sm">정가 ${won(p.price)}원 · 원가율 ${pct(p.cost_ratio)} · 하루특가 쉰 기간 ${p.days_since_deal === null || p.days_since_deal === undefined ? '기록 없음' : p.days_since_deal + '일'}</div>`,
      '"몇 %?"라고 물으면 이 상품의 할인 반응을 보여 드려요.', `SEQ ${p.seq}`)
      + `<div class="acts"><button class="btn sm" data-add="${p.seq}" data-type="상시" data-rate="0.2">상시 20%로 담기</button><button class="btn sm" data-detail="${p.seq}">상세 보기</button></div>`);
    return;
  }
  addMsg('bot', ans('그건 데이터로 바로 찾기 어려워요.', '', '제가 찾을 수 있는 것: 하루특가 채우기 · 푹 쉰 상품 · ○○ 몇 %? · 작년 이맘때 · 가격대·카테고리·상품명 · 요즘 뜨는 · 원가율 높은 · 짝 찾기 · 오늘의 체크 · 퀴즈'));
}

// ---------------------------------------------------------------- 오늘의 퀴즈 (우리 실적으로 · 하루 1문제)
function quiz() {
  const L = state.levers;
  if (!L) { addMsg('bot', ans('레버 데이터가 아직 없어요. 데이터를 갱신해 주세요.')); return; }
  const day = Math.floor(Date.now() / 86400000);
  const qs = [];
  const ts = (L.depth_by_category || []).find(r => r.key === '티 세트')?.cells;
  if (ts) qs.push({ q: '티 세트 하루특가, 몇 % 구간부터 반응이 확 뛸까요?', opts: ['~25%', '26~30%', '31~35%', '36~40%'], ans: '36~40%',
    why: ['~25%', '26~30%', '31~35%', '36~40%'].map(b => `${b} ${ts[b]?.lift?.toFixed(1) ?? '-'}배`).join(' · ') });
  const wk = L.weekday || [];
  if (wk.length) { const best = wk.reduce((a, b) => (b.all > a.all ? b : a)); qs.push({ q: '특가가 없어도 몰 매출이 가장 높은 요일은?', opts: ['월', '수', '금', '토'], ans: best.wd, why: wk.map(w => `${w.wd} ${w.all?.toFixed(2)}`).join(' · ') }); }
  const gp = L.gap || [];
  if (gp.length) { const best = gp.reduce((a, b) => (b.lift > a.lift ? b : a)); qs.push({ q: '같은 상품 하루특가, 얼마나 쉬었을 때 반응이 가장 컸을까요?', opts: gp.map(g => g.band).slice(0, 4), ans: best.band, why: gp.map(g => `${g.band} ${g.lift.toFixed(1)}배`).join(' · ') }); }
  const dec = L.sangsi_decay;
  if (dec?.value?.length >= 5) qs.push({ q: '상시 할인 품목, 5일째 판매는 첫 3일의 몇 % 정도일까요?', opts: ['약 90%', '약 70%', '약 40%', '약 10%'], ans: '약 40%', why: `5일째 ${Math.round((dec.value[4] || 0) * 100)}% · 7일째 ${Math.round((dec.value[6] || 0) * 100)}% (첫 3일 평균 = 100%)` });
  const ip = L.items_per_day || [];
  if (ip.length) { const best = ip.reduce((a, b) => (b.lift > a.lift ? b : a)); qs.push({ q: '하루 하루특가 품목이 몇 개일 때 품목당 반응이 가장 컸을까요?', opts: ip.map(x => x.band).slice(0, 4), ans: best.band, why: ip.map(x => `${x.band} ${x.lift.toFixed(1)}배`).join(' · ') }); }
  if (!qs.length) return;
  const q = qs[day % qs.length];
  let done = {}; try { done = JSON.parse(localStorage.getItem(LS_QUIZ) || '{}'); } catch { /* 무시 */ }
  const box = addMsg('bot', `<div class="ans-head">오늘의 퀴즈</div><div>${esc(q.q)}</div><div class="quiz">${q.opts.map(o => `<button class="chip" data-qz="${esc(o)}">${esc(o)}</button>`).join('')}</div>${done[day] ? '<div class="basis">오늘 이미 풀었어요. 다시 골라도 돼요</div>' : ''}`, '');
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-qz]'); if (!b || box.dataset.answered) return;
    box.dataset.answered = '1';
    const ok = b.dataset.qz === q.ans;
    box.querySelectorAll('[data-qz]').forEach(x => x.classList.toggle('on', x.dataset.qz === q.ans));
    done[day] = ok ? 'ok' : 'no'; try { localStorage.setItem(LS_QUIZ, JSON.stringify(done)); } catch { /* 무시 */ }
    box.insertAdjacentHTML('beforeend', ans(ok ? '정답이에요 ✓ 깔끔하게 우러났어요' : `아쉬워요. 정답은 <b>${esc(q.ans)}</b>`, '', esc(q.why), '우리 실적으로 잰 값 · 레버 보드'));
    setBadge(ok ? 'done' : undefined);
  });
}

function onMsgAction(e) {
  const a = e.target.closest('[data-add]');
  if (a) { emit('plan:add', { seq: a.dataset.add, type: a.dataset.type || '상시', rate: a.dataset.rate ? +a.dataset.rate : 0.2 });  return; }
  const cal = e.target.closest('[data-cal]');
  if (cal) { emit('calendar:day', cal.dataset.cal); return; }
  const wv = e.target.closest('[data-wave]');
  if (wv) { emit('review:open', wv.dataset.wave); return; }
  const ro = e.target.closest('[data-rpopen]');
  if (ro) { emit('replan:open', ro.dataset.rpopen); return; }
  const rp = e.target.closest('[data-replan]');
  if (rp && lastReplan) {
    const r = lastReplan;
    emit('plan:replace', { title: r.title, source: '지난 행사 다시 기획', rows: r.rows,
      rationale: `${r.note}\n원본: ${r.source.map(x => `${x.promo} ${x.type} ${x.start}~${x.end}`).join(', ')}\n교체 ${r.summary.replaced} · 할인 조정 ${r.summary.rate} · 뺌 ${r.summary.dropped} · 추가 ${r.summary.added}`,
      brief_meta: { myeongbun: `작년 ${r.source[0].promo} (${r.source[0].start})`, concept: '', customer: '', target: '' } });
     return;
  }
  const c = e.target.closest('[data-claude]');
  if (c) { c.disabled = true; claudePlan(c.dataset.claude); return; }
  const d = e.target.closest('[data-detail]');
  if (d) { $('.tab[data-view="products"]').click(); emit('product:open', d.dataset.detail); return; }
  const l = e.target.closest('[data-load]');
  if (l) {
    const res = JSON.parse(l.closest('.msg').dataset.result);
    if (l.dataset.load === 'replace') emit('plan:replace', { title: res.title, rationale: res.rationale, brief: res.brief, source: 'Claude 기획', rows: res.rows });
    else emit('plan:append', res.rows);
    
  }
}

// ---------------------------------------------------------------- Claude 기획 (사용자가 확인했을 때만 · 비용 발생)
const STEP_TEA = { '상품 찾는 중': '찻잎 고르는 중', '조합 원가 계산': '물 온도 맞추는 중', '기획안 검증': '맛보는 중' };
async function claudePlan(brief) {
  if (!state.claude.available) { addMsg('bot', '<div class="err-box">Claude 연결 패키지가 없어 실행할 수 없습니다.</div>'); return; }
  busy = true; $('#askSend').disabled = true; setBadge('think');
  const useCur = $('#useCurrent').checked && currentRows().length;
  const box = addMsg('bot', `<div><span class="typing"><i></i><i></i><i></i></span> Claude랑 우리는 중이에요${useCur ? ' (현재 기획안 수정)' : ''}… 1~3분</div><div class="progress mt8"></div>`, `Claude 기획 · ${state.claude.model}`);
  try {
    const { job } = await api('/api/claude/plan', { method: 'POST', body: { brief, rows: useCur ? currentRows() : [] } });
    let st;
    for (;;) {
      await new Promise(r => setTimeout(r, 1500));
      st = await api(`/api/claude/job/${job}`);
      box.querySelector('.progress').innerHTML = st.events.map(ev => `<div>${esc(STEP_TEA[ev.label] || ev.label)}${ev.detail ? ` <span class="mute">${esc(ev.detail)}</span>` : ''}</div>`).join('');
      $('#msgs').scrollTop = $('#msgs').scrollHeight;
      if (st.status !== 'running') break;
    }
    if (st.status === 'error') throw new Error(st.error || 'Claude 기획 실패');
    renderResult(box, st.result, brief, st.elapsed);
    setBadge('done');
  } catch (e) {
    box.innerHTML = `<div class="src">Claude 기획</div><div class="err-box">${esc(e.message)}</div>`; setBadge();
  } finally { busy = false; $('#askSend').disabled = false; }
}

function renderResult(box, r, brief, elapsed) {
  const chk = r.check || { rows: [], summary: {} };
  const s = chk.summary;
  box.dataset.result = JSON.stringify({ title: r.title, rationale: r.rationale, rows: r.rows, brief });
  const rows = chk.rows.map(c => `<tr><td>${esc(c.type)}</td><td class="num">${(c.start || '').slice(5)}${c.end && c.end !== c.start ? '~' + c.end.slice(5) : ''}</td><td>${c.kind === '신규조합' ? '<span class="tag plan">조합</span> ' : ''}${esc(c.name || c.seq)}</td><td class="num">${pct(c.rate)}</td><td class="num ${c.cost_ratio_after > state.target ? 'over' : ''}">${pct(c.cost_ratio_after)}</td><td>${{ ok: '✓', warn: '!', error: '✕' }[c.level]}</td></tr>`).join('');
  box.innerHTML = `<div class="src">Claude 기획 · AI 작성 · ${esc(state.claude.model)} · ${elapsed}초${r.cost_usd ? ` · 약 $${r.cost_usd.toFixed(2)}` : ''}</div>
    <div class="ans-head">${esc(r.title)}</div>
    <div class="rationale mt8">${esc(r.rationale)}</div>
    <table class="mini mt8"><thead><tr><th>유형</th><th class="num">기간</th><th>상품</th><th class="num">할인</th><th class="num">원가율</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    ${(r.questions || []).length ? `<div class="info-box mt8 sm"><b>확인해 주세요</b><br>${r.questions.map(q => '· ' + esc(q)).join('<br>')}</div>` : ''}
    <div class="basis">${s.rows}행 · 오류 ${s.errors} · 주의 ${s.warnings} · 예상 매출 ${man(s.expected_sales)}만원(참고): 숫자는 서버가 다시 검증한 값</div>
    <div class="acts"><button class="btn sm primary" data-load="replace">기획안에 담기</button><button class="btn sm" data-load="append">작업 중 기획안에 행 추가</button></div>`;
  $('#msgs').scrollTop = $('#msgs').scrollHeight;
}
