// 이번 주(홈): ① 할 일(규칙 알림 + 작업대 이어하기) ② 기획 시작 3가지 ③ 이번 주 아이디어 목록(행을 누르면 그 자리에서 펼침)
import { $, api, emit, esc, icon, man, mmdd, on, pct, ribbon, state, statusBadge, toast } from './core.js';

let data = null, page = 0, openKey = null;
const LS_DISMISS = 'planner.alerts.dismissed.v1', LS_DRAFT = 'planner.draft.v1';

// ---------------- 기획 시작 (이번 주 · 작업대 빈 화면 공통)
export function starterHTML() {
  return [
    ['replan', 'history', '지난 행사 상품·할인 가져오기', '상품, 할인율, 날짜 간격을 올해로. 컨셉은 가져오지 않아요'],
    ['gap', 'bolt', '하루특가 빈 날 채우기', '캘린더에서 빈 날의 후보 고르기'],
    ['ideas', 'bulb', '아이디어에서 시작', '명분과 실적으로 짠 이번 주 초안'],
  ].map(([k, ic, t, s]) => `<button class="starter" data-start="${k}"><span class="ti">${icon(ic)}</span><span><b>${t}</b><span>${s}</span></span></button>`).join('');
}
export function runStarter(k) {
  if (k === 'replan') emit('replan:open', '');
  else if (k === 'gap') {
    const g = (state.alerts || []).find(a => a.id.startsWith('gap:'));
    emit('calendar:day', g?.action?.arg || new Date().toISOString().slice(0, 10));
  } else if (k === 'ideas') { emit('nav:go', 'calendar'); setTimeout(() => $('.ideahead')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
}

export function initIdeas() {
  $('#starterList').innerHTML = starterHTML();
  document.addEventListener('click', e => { const s = e.target.closest('[data-start]'); if (s) runStarter(s.dataset.start); });
  $('#ideaStart').addEventListener('change', e => { page = 0; load(e.target.value); });
  $('#ideaMore').addEventListener('click', () => { page += 1; load($('#ideaStart').value || null); });
  $('#ideaCards').addEventListener('click', e => {
    const v = e.target.closest('[data-vote]');
    if (v) { vote(v.dataset.key, v.dataset.vote); return; }
    const b = e.target.closest('[data-idea]');
    if (b) { const idea = data.ideas.find(i => i.key === b.dataset.idea); if (b.dataset.do === 'load') loadIdea(idea); return; }
    const row = e.target.closest('[data-toggle]');
    if (row) { openKey = openKey === row.dataset.toggle ? null : row.dataset.toggle; paintIdeas(); }
  });
  $('#todoList').addEventListener('click', e => {
    const b = e.target.closest('[data-todo]'); if (!b) return;
    const t = todos().find(x => x.id === b.dataset.todo); if (t) t.run();
  });
  on('alerts:loaded', paintTodo);
  on('plan:changed', paintTodo);
  on('dday:loaded', paintTodo);
  paintHead();
}

export async function loadIdeas() { await load($('#ideaStart').value || null); }

// ---------------- 머리: "10월 넷째 주"
function paintHead() {
  const d = new Date(), mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  // 1일이 든 주를 첫째 주로 센다 (월요일 시작)
  const first = new Date(mon.getFullYear(), mon.getMonth(), 1);
  const nth = Math.min(4, Math.floor((mon.getDate() + (first.getDay() + 6) % 7 - 1) / 7));
  $('#homeTitle').textContent = `${mon.getMonth() + 1}월 ${['첫째', '둘째', '셋째', '넷째', '다섯째'][nth]} 주`;
  const f = x => `${x.getMonth() + 1}/${x.getDate()}`;
  const idx = (state.levers?.weekday_index || [])[(d.getDay() + 6) % 7];
  $('#homeSub').textContent = `${f(mon)}(월) ~ ${f(sun)}(일)` + (state.meta ? ` · 실적은 ${mmdd(state.meta.sales_last_day)}까지` : '')
    + (idx ? ` · 오늘(${'일월화수목금토'[d.getDay()]}) 평소 매출 지수 ${idx.toFixed(2)}` : '');
}

// ---------------- 할 일
function dismissed() { try { return JSON.parse(localStorage.getItem(LS_DISMISS) || '{}'); } catch { return {}; } }
function draft() { try { return JSON.parse(localStorage.getItem(LS_DRAFT) || 'null'); } catch { return null; } }

function todos() {
  const out = [], dis = dismissed();
  const al = (state.alerts || []).filter(a => !dis[a.id]);
  // AMOREAD: 작업대 '이어하기'는 없앰. 하던 기획안은 캘린더 옆 '이어서 하기'가 보여준다
  // 기획 D-day: 오늘·내일 마감 단계, 일정 빠듯한 행사 (최대 3개)
  (state.dday?.rows || []).flatMap(r => {
    const n = r.next;
    if (n && (n.state === 'today' || n.wd_left <= 1)) return [{ id: `dd:${r.promo}:${n.key}`, ic: 'calendar', cls: r.mode === '표준' ? 'sangsi' : 'warn',
      title: `${r.promo} · ${n.label} ${n.state === 'today' ? '오늘' : '다음 업무일'} 마감`, sub: `오픈 ${mmdd(r.open)} · 남은 ${r.wd_left}WD · ${r.mode}` }];
    if (r.mode !== '표준' && r.overdue.length) return [{ id: `dd:${r.promo}:late`, ic: 'alert', cls: 'warn',
      title: `${r.promo} · ${r.mode}`, sub: `오픈 ${mmdd(r.open)}까지 ${r.wd_left}WD (필요 ${r.lead}WD) · 지난 단계: ${r.overdue.join(', ')}` }];
    return [];
  }).filter(t => !dis[t.id]).slice(0, 3).forEach(t => out.push({ ...t, btn: '일정 보기',
    run: () => { emit('nav:go', 'ideas'); setTimeout(() => $('.dday')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); } }));
  al.forEach(a => {
    if (a.id.startsWith('gap:')) out.push({ id: a.id, ic: 'bolt', cls: 'deal', title: a.title, sub: a.text.replace(/^앞으로 2주 중 PROMO_WORK에 하루특가가 없는 날: /, '').replace(/ 캘린더에서.*$/, ''), btn: '채우기', run: () => emit('calendar:day', a.action?.arg) });
    else if (a.id.startsWith('season:')) {
      const key = a.action?.view === 'review' && a.action.arg ? a.action.arg.split('|')[0] : null;
      out.push({ id: a.id, ic: 'flag', cls: '', title: a.title, sub: a.text, btn: key ? `작년 ${key} 다시 하기` : '캘린더 보기',
        run: () => key ? emit('replan:open', key) : emit('calendar:day', a.action?.arg) });
    } else if (a.id.startsWith('stale:')) out.push({ id: a.id, ic: 'alert', cls: 'warn', title: a.title, sub: a.text, btn: '데이터 갱신', run: () => emit('nav:go', 'settings') });
    else if (a.id.startsWith('hot:')) out.push({ id: a.id, ic: 'trend', cls: '', title: a.title, sub: a.text.replace(/^[^:]+: /, ''), btn: '상품 보기', run: () => emit('products:preset', a.action?.arg || 'grow') });
  });
  return out.slice(0, 6);
}

function paintTodo() {
  const ts = todos();
  $('#todoList').innerHTML = ts.length ? ts.map(t => `<li><span class="ti ${t.cls}">${icon(t.ic)}</span>
      <span class="tx"><b>${esc(t.title)}</b><span title="${esc(t.sub)}">${esc(t.sub)}</span></span>
      <button class="btn sm" data-todo="${esc(t.id)}">${esc(t.btn)}</button></li>`).join('')
    : '<li class="none">지금 챙길 일이 없어요. 오른쪽에서 새 기획을 시작해 보세요.</li>';
  paintHead();
}

// ---------------- 이번 주 아이디어
async function load(start) {
  const box = $('#ideaCards');
  box.innerHTML = '<div class="empty"><span class="spin"></span> 이번 주 아이디어를 우리는 중</div>';
  try { data = await api(`/api/ideas?page=${page}${start ? `&start=${encodeURIComponent(start)}` : ''}`); }
  catch (e) { box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  $('#ideaStart').value = data.start;
  const thisMon = new Date(); thisMon.setDate(thisMon.getDate() - ((thisMon.getDay() + 6) % 7));
  const wk = Math.round((new Date(data.start) - new Date(thisMon.toISOString().slice(0, 10))) / 604800000);
  $('.ideahead h2').textContent = `${wk === 0 ? '이번 주' : wk === 1 ? '다음 주' : `${mmdd(data.start)} 주`} 아이디어`;
  $('#ideaPeriod').textContent = `${mmdd(data.start)}~${mmdd(data.end)} · ${data.total}개 중 ${data.page + 1}/${data.pages}묶음 · 규칙으로 생성`;
  $('#ideaNote').textContent = data.note;
  paintIdeas(); paintTodo();
}

function range(f) {
  const r0 = f.expected_range?.[0], r1 = f.expected_range?.[1];
  return r1 && Math.round(r0 / 1000) !== Math.round(r1 / 1000) ? `${man(r0)}~${man(r1)}` : (f.expected_sales ? man(f.expected_sales) : '-');
}

function paintIdeas() {
  const box = $('#ideaCards');
  if (!data || !data.ideas.length) { box.innerHTML = '<div class="empty">이 주에 만들 수 있는 아이디어가 없어요. 주 시작을 바꾸거나 [다른 아이디어]를 눌러 보세요.</div>'; return; }
  box.innerHTML = data.ideas.map(i => {
    const f = i.facts, op = openKey === i.key;
    return `<article class="idea ${op ? 'open' : ''}">
      <button class="idea-row" data-toggle="${esc(i.key)}" aria-expanded="${op}">
        ${ribbon(i.rows, { mini: true })}
        <span class="ttl"><b>${esc(i.title)}</b><span>${esc(i.why ? '왜 지금: ' + i.why : i.period)}</span></span>
        <span class="fv">${f.count}<small>품목</small></span>
        <span class="fv">${pct(f.avg_rate)}<small>평균 할인</small></span>
        <span class="fv p2">${range(f)}<small>예상 매출(만원)</small></span>
        <span class="chev">${icon('chev')}</span>
      </button>
      ${op ? body(i) : ''}
    </article>`;
  }).join('');
}

function body(i) {
  const rows = i.items.map((it, k) => {
    const r = i.rows[k];
    return `<tr><td><span class="tag ${it.type === '하루특가' ? 't-deal' : 't-sangsi'}">${esc(it.type)}</span></td><td class="num">${mmdd(r.start)}${r.end !== r.start ? '~' + mmdd(r.end) : ''}</td><td class="name"><span class="n">${esc(it.name)}</span></td><td class="num">${pct(it.rate)}</td><td>${statusBadge(it.level)}</td><td class="cap">${esc(r.memo || '')}</td></tr>`;
  }).join('');
  return `<div class="idea-body">
    <p class="lead">${esc(i.lead)}</p>
    ${(i.evidence || []).length ? `<ul class="evl">${i.evidence.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${(i.levers || []).length ? `<div class="grp">${i.levers.map(x => `<span class="chip lvchip">${esc(x)}</span>`).join('')}</div>` : ''}
    <div class="tbl-wrap mt8"><table class="t compact"><thead><tr><th>유형</th><th class="num">기간</th><th>상품</th><th class="num">할인</th><th>판정</th><th>근거</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="acts">
      <button class="btn primary" data-idea="${esc(i.key)}" data-do="load">${icon('board')} 기획안에 담기</button>
      <span class="grow"></span>
      <button class="vote ${i.vote === 'up' ? 'on' : ''}" data-vote="up" data-key="${esc(i.key)}" title="비슷한 아이디어를 앞에 보여 줘요">좋아요</button>
      <button class="vote ${i.vote === 'down' ? 'on' : ''}" data-vote="down" data-key="${esc(i.key)}" title="다시 안 보여 줘요">별로예요</button>
      <button class="vote ${i.vote === 'done' ? 'on' : ''}" data-vote="done" data-key="${esc(i.key)}" title="8주 동안 숨겨요">이미 했어요</button>
    </div></div>`;
}

async function vote(key, v) {
  const cur = data.ideas.find(i => i.key === key);
  const next = cur && cur.vote === v ? 'clear' : v;
  try { await api('/api/ideas/feedback', { method: 'POST', body: { key, vote: next } }); } catch (e) { toast(e.message); return; }
  if (cur) cur.vote = next === 'clear' ? null : next;
  paintIdeas();
  toast({ up: '다음에 비슷한 걸 앞에 둘게요', down: '다음부터 안 보여 드려요', done: '8주 동안 숨길게요', clear: '취소했어요' }[next]);
}

function loadIdea(i) {
  emit('plan:replace', { title: `${i.title.split(/s—s|:s/)[0]} ${i.period}`, rationale: `${i.lead}\n근거: ${(i.evidence || []).join(' / ')}`, brief: i.brief,
    source: '이번 주 아이디어', rows: i.rows, brief_meta: { myeongbun: i.why || '', concept: i.title.split(/s—s|:s/)[1] || i.title, customer: '', target: '' } });
  
}

// 예전 호출 호환 (chat.js 등)
export function paintToday() { paintTodo(); }
