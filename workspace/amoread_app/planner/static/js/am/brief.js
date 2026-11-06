// 통합 브리프: 기존 기획 메모(명분, 컨셉, 고객 상황, 목표) + AMOREAD 브리프(목적, 타깃, 배경, 조건) + 기간, 페이지 유형
// 캘린더에서 시작했든 브리프에서 시작했든, 저장된 기간이 그대로 캘린더 '내 기획안' 겹에 보인다.
import { $, $$, api, emit, esc, man, mmdd, toast } from '../core.js';
import { am, dLabel, PURPOSES, scheduleSave, STATUS } from './store.js';
import { ctxTags } from './meta.js';

const KINDS = ['명절·대목', '기념일', '절기·세시', '학사·생활', '직장', '차 고유', '날씨·계절', '쇼핑', '트렌드'];
let seasonView = null;      // /api/seasons 의 view (D-day·잡힌 행사·지난 행사가 붙은 명분 목록)
let conceptItems = null;    // /api/am/concepts
let root = null;
let sideRoot = null;   // 허브 오른쪽 패널 (브리프 옆 카드가 그려지는 곳)

const norm = s => String(s || '').replace(/\s/g, '').toLowerCase();

export function resetBriefCache() { seasonView = null; conceptItems = null; }

// el: 단계 본문, side: 허브 오른쪽 패널 아래쪽 (캘린더 반영, 명분 근거, 컨셉 이력)
export async function renderBrief(el, side) {
  root = el; sideRoot = side;
  const b = am.cur.brief;
  el.innerHTML = `<div class="am-stephead"><div><div class="overline">01 · 브리프</div><h2>프로모션 브리프</h2>
      <p>기획의 배경과 목적을 적어 보세요. 상품은 나중에 골라도 괜찮아요.</p>${ctxTags()}</div></div>
  <div class="am-brief">
    <form class="am-form am-brief-grid" id="amBriefForm" autocomplete="off">
      <div class="am-brief-col">
      <section class="card" aria-label="기본 정보">
        <label class="am-f"><span>프로모션명</span>
          <input type="text" data-bt maxlength="80" value="${esc(am.cur.title)}" placeholder="예) 입동 블렌디드 티 바"></label>
        <div class="am-f" role="group" aria-label="진행 기간"><span>진행 기간</span>
          <div class="am-2col">
            <input type="date" data-bp="start" aria-label="시작일" value="${esc(b.period?.start || '')}">
            <input type="date" data-bp="end" aria-label="종료일" value="${esc(b.period?.end || '')}">
          </div>
          <p class="cap">비워 두면 '날짜 미정'으로 저장되고, 캘린더 아래 보관함에 보여요.</p></div>
        <div class="am-f"><span>페이지 유형 <em>제작 일정 계산에 쓰여요</em></span>
          <div class="grp" id="amKind">${['이벤트', 'GNB', '없음'].map(k => `<button type="button" class="chip ${b.page_kind === k ? 'on' : ''}" data-kind="${k}" aria-pressed="${b.page_kind === k}">${k === '없음' ? '페이지 없음 (할인만)' : k === 'GNB' ? 'GNB 기획전' : '이벤트 페이지'}</button>`).join('')}</div></div>
        <div class="am-f"><span>주요 목적</span>
          <div class="grp" id="amPurpose">${PURPOSES.map(p => `<button type="button" class="chip ${b.purpose === p ? 'on' : ''}" data-purpose="${esc(p)}" aria-pressed="${b.purpose === p}">${esc(p)}</button>`).join('')}</div></div>
        <div class="am-f" role="group" aria-label="타깃 상황"><span>타깃 상황</span>
          <div class="am-2col">
            <input type="text" data-bf="audience" aria-label="타깃" maxlength="300" value="${esc(b.audience)}" placeholder="누구에게: 연말 선물을 고르는 30~40대">
            <input type="text" data-bf="customer" aria-label="고객 상황" maxlength="300" value="${esc(b.customer)}" placeholder="어떤 때: 퇴근길 따뜻한 걸 찾을 때">
          </div></div>
      </section>
      <details class="card am-more" ${[b.target, b.background, b.constraints, b.benefits_note].some(v => (v || '').trim()) ? 'open' : ''}>
        <summary>더 적기 <span class="cap">목표, 기획 배경, 운영 조건, 할인 외 혜택</span></summary>
        <label class="am-f"><span>목표 <em>숫자가 있으면 숫자로</em></span><input type="text" data-bf="target" maxlength="300" value="${esc(b.target)}" placeholder="예) 2주 행사 매출 5,000만 원, 선물 세트 비중 확대"></label>
        <label class="am-f"><span>기획 배경</span><textarea data-bf="background" maxlength="2000" rows="3" placeholder="작년 반응, 상품 상황, 요청 배경 등">${esc(b.background)}</textarea></label>
        <label class="am-f"><span>운영 조건·제약</span><textarea data-bf="constraints" maxlength="1000" rows="2" placeholder="예) 보자기 포장 한정 수량, 하루특가는 평일만">${esc(b.constraints)}</textarea></label>
        <label class="am-f"><span>할인 외 혜택 <em>쿠폰, 사은품, 적립 등. 기존 데이터에 없어 직접 적어요</em></span><textarea data-bf="benefits_note" maxlength="1000" rows="2">${esc(b.benefits_note)}</textarea></label>
      </details>
      </div>
      <div class="am-brief-col">
      <section class="card" aria-label="명분과 콘셉트">
        <label class="am-f"><span>지금 기획하는 이유 <em>명분</em></span>
          <input type="text" data-bf="myeongbun" maxlength="300" value="${esc(b.myeongbun)}" placeholder="예) 입동, 첫 추위가 오는 때"></label>
        <div id="amSeedChips"></div>
        <label class="am-f"><span>기획 콘셉트 <em>한 줄로</em></span>
          <input type="text" data-bf="concept" maxlength="300" value="${esc(b.concept)}" placeholder="예) 첫 추위의 블렌디드 티 바"></label>
        <div id="amConceptWarn" class="am-warn hidden" role="status"></div>
        <p class="info-box">적는 대로 자동 저장해요. 콘셉트가 지난 기획안과 같으면 바로 알려 드려요.</p>
      </section>
      </div>
    </form>
  </div>`;
  side.innerHTML = `<section class="card" id="amCalCard"></section>
      <section class="card" id="amSeasonCard"></section>
      <section class="card" id="amConceptCard"><h2>최근 쓴 명분·컨셉</h2><div class="empty"><span class="spin"></span></div></section>`;
  bind(el);
  paintCalendarCard();
  paintSeeds();
  await Promise.all([loadSeasons(), loadConcepts()]);
  if (root !== el) return;
  paintSeasonCard(); paintSeeds(); paintConcepts(); paintConceptWarn();
}

function bind(el) {
  const f = $('#amBriefForm', el);
  f.addEventListener('submit', e => e.preventDefault());
  f.addEventListener('input', e => {
    const t = e.target, b = am.cur.brief;
    // 프로모션명 = 기획안 이름. 앱 막대·정보 창과 같은 값 (hub.js가 'title'을 받아 맞춘다)
    if ('bt' in t.dataset) { am.cur.title = t.value; scheduleSave(); emit('am:brief', 'title'); return; }
    if (t.dataset.bf) {
      b[t.dataset.bf] = t.value;
      if (t.dataset.bf === 'concept') paintConceptWarn();
      if (t.dataset.bf === 'myeongbun') { paintConcepts(); paintCalendarCard(); }
      emit('am:brief', t.dataset.bf);
      scheduleSave();
    }
    if (t.dataset.bp) onPeriod(t);
  });
  f.addEventListener('click', e => {
    const p = e.target.closest('[data-purpose]');
    if (p) { const b = am.cur.brief; b.purpose = b.purpose === p.dataset.purpose ? '' : p.dataset.purpose; toggleChips('#amPurpose', 'purpose', b.purpose); scheduleSave(); return; }
    const k = e.target.closest('[data-kind]');
    if (k) { am.cur.brief.page_kind = k.dataset.kind; toggleChips('#amKind', 'kind', k.dataset.kind); scheduleSave(); emit('am:brief', 'page_kind'); return; }
    const sd = e.target.closest('[data-seed]');
    if (sd) { am.cur.brief.concept = sd.dataset.seed; $('[data-bf="concept"]', root).value = sd.dataset.seed; paintConceptWarn(); scheduleSave(); toast('씨앗을 컨셉 초안으로 넣었어요. 이어서 다듬어 주세요'); }
  });
}

function toggleChips(sel, key, val) {
  $$(`${sel} [data-${key}]`, root).forEach(c => { const on = c.dataset[key] === val; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
}

function onPeriod(t) {
  const b = am.cur.brief;
  const s = $('[data-bp="start"]', root), e = $('[data-bp="end"]', root);
  if (!s.value) { b.period = null; e.value = ''; }
  else {
    if (!e.value || e.value < s.value) e.value = s.value;
    b.period = { start: s.value, end: e.value };
  }
  paintCalendarCard(); emit('am:brief', 'period'); scheduleSave();
}

// ---------------- 캘린더 반영 (브리프 → 캘린더) ----------------
function paintCalendarCard() {
  const card = $('#amCalCard', sideRoot); if (!card) return;
  const b = am.cur.brief, per = b.period;
  const st = STATUS[am.cur.status] || '기획 중';
  const linked = b.season_ref;
  let addForm = '';
  if (!linked && per && b.myeongbun.trim()) {
    addForm = `<details class="am-addseason"><summary>이 명분을 명분 사전에도 남기기</summary>
      <p class="cap">명분 사전은 캘린더의 '직접 등록 명분' 목록이에요. 다음 해에도 이 명분이 캘린더에 떠요.</p>
      <label class="am-f"><span>명분 이름</span><input type="text" id="amSName" maxlength="30" value="${esc(b.myeongbun.trim().slice(0, 30))}"></label>
      <div class="am-2col">
        <label class="am-f"><span>종류</span><select id="amSKind">${KINDS.map(k => `<option>${k}</option>`).join('')}</select></label>
        <label class="am-f"><span>준비 시작 (며칠 전)</span><input type="number" id="amSLead" min="0" max="120" value="21"></label>
      </div>
      <button type="button" class="btn sm" id="amSAdd">명분 사전에 추가</button></details>`;
  }
  card.innerHTML = `<h2>캘린더 반영</h2>
    ${per ? `<div class="am-calprev"><span class="am-evkey"></span><div><span class="am-v">${mmdd(per.start)}~${mmdd(per.end)}</span> · ${esc(st)}<div class="cap">${dLabel(per.start)} · 캘린더 '내 기획안' 겹에 이 기간으로 보여요</div></div></div>`
      : '<div class="am-calprev undated"><div><span class="am-v">날짜 미정</span><div class="cap">캘린더 아래 \'날짜 미정\' 보관함에 보여요</div></div></div>'}
    ${linked ? `<p class="sm mt8">명분 사전의 ${esc(linked.name)} (${mmdd(linked.date)})과 연결되어 있어요.</p>` : ''}
    ${addForm}
    <div class="row mt8"><button type="button" class="btn sm" id="amToCal" ${per ? '' : 'disabled'}>캘린더에서 보기</button></div>`;
  $('#amToCal', card)?.addEventListener('click', () => emit('calendar:day', per.start));
  $('#amSAdd', card)?.addEventListener('click', addSeason);
}

async function addSeason() {
  const b = am.cur.brief;
  const body = { name: $('#amSName', sideRoot).value.trim(), date: b.period.start, end: b.period.end !== b.period.start ? b.period.end : '',
    kind: $('#amSKind', sideRoot).value, lead: +$('#amSLead', sideRoot).value || 0,
    seeds: b.concept.trim() ? [b.concept.trim().slice(0, 60)] : [], memo: '' };
  if (!body.name) { toast('명분 이름을 적어 주세요'); return; }
  try {
    const r = await api('/api/am/seasons/add', { method: 'POST', body });
    b.season_ref = r.season_ref; scheduleSave();
    toast(r.added ? '명분 사전에 추가했어요' : r.reason);
    seasonView = null; await loadSeasons(); paintCalendarCard(); paintSeasonCard(); paintSeeds();
    emit('seasons:changed');
  } catch (e) { toast(e.message); }
}

// ---------------- 명분 근거 (캘린더 명분과 연결된 경우) ----------------
async function loadSeasons() {
  if (seasonView) return;
  try { seasonView = (await api('/api/seasons')).view || []; } catch { seasonView = []; }
}
function season() {
  const r = am.cur.brief.season_ref;
  return r && seasonView ? seasonView.find(x => x.name === r.name && x.date === r.date) : null;
}

function paintSeasonCard() {
  const card = $('#amSeasonCard', sideRoot); if (!card) return;
  const x = season();
  if (!x) {
    card.innerHTML = `<h2>명분 근거</h2><p class="cap">캘린더 명분에서 시작하면 D-day·준비 시작일·작년 같은 명분 행사·이미 잡힌 행사가 여기 보여요.</p>
      <button type="button" class="btn sm" id="amGoCal">캘린더에서 명분 고르기</button>`;
    $('#amGoCal', card).addEventListener('click', () => $('.tab[data-view="calendar"]').click());
    return;
  }
  const booked = x.booked.reduce((a, b) => a + b.rows, 0);
  card.innerHTML = `<h2>명분 근거 <span class="cap">${esc(x.kind)}</span></h2>
    <div class="am-facts">
      <div><span class="k">명분일</span><span class="am-v">${mmdd(x.date)}${x.end !== x.date ? '~' + mmdd(x.end) : ''}</span> <span class="cap">${x.d_day > 0 ? 'D-' + x.d_day : x.d_day === 0 ? 'D-day' : '진행 중'}</span></div>
      <div><span class="k">준비 시작</span><span class="am-v">${mmdd(x.prep_start)}</span> <span class="cap">${x.lead}일 전</span></div>
      <div><span class="k">이미 잡힌 행사</span>${booked ? `<span class="am-v">${booked}품목</span> <span class="cap">${esc(x.booked.slice(0, 2).map(b => b.name).join(', '))}</span>` : '<span class="gap">없음</span>'}</div>
      ${x.month_index_ly ? `<div><span class="k">작년 같은 달 매출 지수</span><span class="am-v">${x.month_index_ly.toFixed(2)}</span></div>` : ''}
    </div>
    ${(x.past || []).length ? `<h3>지난 같은 명분 행사</h3><ul class="am-plain">${x.past.map(w => `<li>${esc(w.promo)} ${esc(w.type)} · ${mmdd(w.start)}~${mmdd(w.end)} · ${w.rows}품목 · ${man(w.promo_sales)}만원</li>`).join('')}</ul>` : ''}
    ${x.memo ? `<p class="cap">${esc(x.memo)}</p>` : ''}`;
}

function paintSeeds() {
  const box = $('#amSeedChips', root); if (!box) return;
  const x = season();
  const seeds = x ? (x.seeds || []) : [];
  box.innerHTML = seeds.length ? `<div class="am-seeds"><span class="cap">명분 사전의 씨앗입니다. 누르면 컨셉 초안으로 들어가요</span><div class="seeds">${seeds.map(s => `<button type="button" class="seed am-seedbtn" data-seed="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>` : '';
  if (x && (x.seed_flags || []).length) box.innerHTML += `<div class="cap over">씨앗에 효능으로 읽힐 수 있는 표현: ${esc(x.seed_flags.join(', '))}</div>`;
}

// ---------------- 컨셉 이력 · 중복 알림 ----------------
async function loadConcepts() {
  try { conceptItems = (await api('/api/am/concepts')).items || []; } catch { conceptItems = []; }
}
function others() { return (conceptItems || []).filter(c => c.id !== am.cur.id); }

function paintConcepts() {
  const card = $('#amConceptCard', sideRoot); if (!card || !conceptItems) return;
  const mb = norm(am.cur.brief.myeongbun);
  const key = mb.slice(0, 4);
  const items = others().slice(0, 12);
  card.innerHTML = `<h2>최근 쓴 명분·컨셉</h2>
    <p class="cap">같은 시기·같은 명분에서 컨셉이 겹치지 않게 참고하세요. 같은 명분은 강조돼요.</p>
    ${items.length ? `<ul class="am-concepts">${items.map(c => {
      const same = key.length >= 2 && norm(c.myeongbun).includes(key);
      return `<li class="${same ? 'same' : ''}"><div class="cap">${esc(c.date || '')} · ${esc(c.source)}</div><span class="am-v">${esc(c.myeongbun || '(명분 없음)')}</span><div>${esc(c.concept || '(컨셉 없음)')}</div></li>`;
    }).join('')}</ul>` : '<p class="cap">아직 기록된 컨셉이 없어요.</p>'}`;
}

function paintConceptWarn() {
  const w = $('#amConceptWarn', root); if (!w || !conceptItems) return;
  const c = norm(am.cur.brief.concept);
  const hit = c.length >= 4 && others().find(x => norm(x.concept) === c);
  w.classList.toggle('hidden', !hit);
  w.innerHTML = hit ? `주의: 「${esc(hit.title || hit.myeongbun)}」(${esc(hit.date || '')})에서 같은 컨셉을 썼어요. 이번엔 다른 각도를 검토해 보세요.` : '';
}
