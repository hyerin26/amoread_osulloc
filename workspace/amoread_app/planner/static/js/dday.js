// 이번 주(홈) · 기획 D-day: PROMO_WORK 상시 시작일 = 오픈. 업무일(주말·공휴일 제외)로 단계별 목표일을 거꾸로 계산
import { $, api, emit, esc, mmdd, on, state, toast } from './core.js';

const MODE_CLS = { '표준': 'run', '압축': 'old', '위험': 'miss', '매우위험': 'miss strong' };
const MODE_TIP = {
  '표준': '남은 업무일이 리드타임 이상: 표준 일정대로',
  '압축': '틀 기획 기간을 줄이면 맞출 수 있음',
  '위험': '디자인 기간까지 줄여야 함',
  '매우위험': '퍼블·개발 기간도 안 남음: 범위 축소·오픈일 조정 검토',
};
let data = null, onlyNear = true;

export function initDday() {
  $('#ddBody').addEventListener('click', e => {
    const k = e.target.closest('[data-kind]');
    if (k) { setKind(k.dataset.promo, k.dataset.kind === 'GNB' ? '이벤트' : 'GNB'); return; }
  });
  $('#ddNear').addEventListener('change', e => { onlyNear = e.target.checked; paint(); });
  on('data:reload', loadDday);
}

export async function loadDday() {
  try { data = await api('/api/dday'); }
  catch (e) { data = null; $('#ddBody').innerHTML = e.code === 'no_data' ? '' : `<div class="err-box">${esc(e.message)}</div>`; return; }
  state.dday = data;
  paint();
  emit('dday:loaded');
}

async function setKind(promo, kind) {
  try { data = await api('/api/dday/kind', { method: 'POST', body: { promo, kind } }); }
  catch (e) { toast(e.message); return; }
  state.dday = data; paint(); emit('dday:loaded');
  toast(`${promo} → ${kind} 일정으로 바꿨어요`);
}

const md = (s, dow) => `${mmdd(s)}<small>${dow ? `(${dow})` : ''}</small>`;

function stepCell(s) {
  const tip = `${s.label} ${mmdd(s.date)}(${s.dow})` + (s.state === 'past' ? ' · 지남' : s.state === 'today' ? ' · 오늘' : ` · ${s.wd_left}WD 뒤`);
  return `<td class="dd-s ${s.state ? `is-${s.state}` : ""}" title="${esc(tip)}">${md(s.date, s.dow)}${s.state === 'today' ? '<b class="dd-now">오늘</b>' : ''}</td>`;
}

function row(r) {
  const slack = r.slack >= 0 ? `<span class="mute">여유 ${r.slack}</span>` : `<span class="over">부족 ${-r.slack}</span>`;
  const next = r.next
    ? `${esc(r.next.label)} ${r.next.state === 'today' ? '<b>오늘</b>' : `${mmdd(r.next.date)} · ${r.next.wd_left}WD 뒤`}`
    : '오픈 준비 끝';
  const main = `<tr class="dd-r ${r.mode !== '표준' ? 'risk' : ''}">
    <td class="name"><b>${esc(r.promo)}</b><span class="cap">상시 ${r.items}품목 · ~${mmdd(r.end)} · 다음: ${next}</span></td>
    <td><button class="chip sm dd-kind ${r.kind === 'GNB' ? 'on' : ''}" data-kind="${esc(r.kind)}" data-promo="${esc(r.promo)}"
      title="${esc(r.kind_by ? `'${r.kind_by}' 포함 → ${r.kind}. ` : '')}눌러서 ${r.kind === 'GNB' ? '이벤트' : 'GNB'}로 바꾸기">${esc(r.kind)}</button></td>
    <td class="num"><b>${md(r.open, r.open_dow)}</b><span class="cap">D-${r.days_left}</span></td>
    <td class="num"><b>${r.wd_left}</b><span class="cap">/ ${r.lead} · ${slack}</span></td>
    <td><span class="tag ${MODE_CLS[r.mode]}" title="${esc(MODE_TIP[r.mode])}">${esc(r.mode)}</span>${r.no_holiday_data ? '<span class="tag old" title="공휴일 DB 범위 밖: 주말만 뺐어요">휴일?</span>' : ''}</td>
    ${r.steps.map(stepCell).join('')}
  </tr>`;
  if (!r.squeeze) return main;
  const q = r.squeeze;
  return main + `<tr class="dd-q"><td colspan="5" class="cap">압축안: 퍼블은 그대로, 틀 기획 ${q.plan}WD · 디자인 ${q.design}WD · 퍼블 ${q.dev}WD</td>
    ${q.steps.map(stepCell).join('')}</tr>`;
}

function paint() {
  const box = $('#ddBody');
  if (!data) return;
  const all = data.rows;
  const rows = onlyNear ? all.filter((r, i) => r.wd_left <= r.lead + 10 || i < 3) : all;
  const t = data.today;
  const risky = all.filter(r => r.mode !== '표준').length;
  const dueWeek = all.flatMap(r => r.steps.filter(s => s.state === 'today' || (s.state === '' && s.wd_left <= 4))).length;
  $('#ddSum').innerHTML = `오늘 ${mmdd(t)}${data.today_workday ? '' : ' (휴일)'} · 오픈 예정 ${all.length}건`
    + (risky ? ` · <span class="over">일정 빠듯 ${risky}건</span>` : '') + ` · 5WD 안 마감 ${dueWeek}개`;
  if (!all.length) { box.innerHTML = '<div class="empty">PROMO_WORK에 앞으로 열릴 상시 할인이 없어요. 데이터 갱신 후 다시 확인하세요.</div>'; return; }
  const heads = ['기획 착수', '틀 기획', '디자인 착수', '최종 기획', '디자인 완료', '퍼블 시작', '퍼블·QA'];
  box.innerHTML = `<div class="tbl-wrap"><table class="t compact ddt">
    <thead><tr><th>행사</th><th>구분</th><th class="num">오픈</th><th class="num">남은 WD</th><th>모드</th>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row).join('')}</tbody></table></div>
    ${rows.length < all.length ? `<p class="cap mt8">먼 행사 ${all.length - rows.length}건은 숨겼어요 (위 '가까운 것만' 해제).</p>` : ''}`;
  const r = data.rules, hol = data.upcoming_holidays.map(h => `${mmdd(h.date)} ${h.name}`).join(', ');
  $('#ddRules').innerHTML = `<p class="cap">상시 할인 시작일을 오픈일로 보고, 오픈 당일을 빼고 주말·공휴일을 제외한 업무일(WD)로 거꾸로 셉니다. D-n = 오픈 전 n번째 업무일.</p>
    <table class="t compact mt8"><thead><tr><th>구분</th><th class="num">총 리드타임</th><th>기획 착수</th><th>틀 기획 완료</th><th>디자인 착수 · 최종 기획</th><th>디자인 완료</th><th>퍼블&amp;개발 · QA</th></tr></thead><tbody>
    ${Object.entries(r).map(([k, v]) => `<tr><td>${k}</td><td class="num">${v.lead}WD</td><td>D-${v.lead}</td><td>D-${v.design + v.dev + 1} (착수 후 ${v.plan}WD)</td>
      <td>D-${v.design + v.dev} (병행)</td><td>D-${v.dev + 1} (${v.design}WD)</td><td>D-${v.dev}~D-1 (${v.dev}WD) · QA D-1</td></tr>`).join('')}
    </tbody></table>
    <p class="cap mt8">모드: 표준(남은 WD ≥ 리드타임) · 압축(틀 기획 줄이면 됨) · 위험(디자인까지 줄여야 함) · 매우위험(퍼블 기간도 부족).
      구분은 settings/기획일정_구분.csv(행사명 포함어)로 정하고, 표의 구분 버튼을 누르면 바뀝니다.</p>
    <p class="cap">공휴일: ${esc(data.holiday_source)} · ${data.holiday_count}일 (~${esc(data.holiday_last || '-')}). 임시공휴일·회사 휴무는 settings/휴무일_추가.csv에 적어 주세요.${hol ? ` 60일 안: ${esc(hol)}` : ''}</p>`;
}
