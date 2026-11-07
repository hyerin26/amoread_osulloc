// ================= 예시 데이터 (가상) =================
// 데이터 상태: 예전 설정 화면의 '데이터 상태' + 홈 실적·리뷰·공휴일 원천을 한곳에
const DATA = [
  { k: '판매실적', v: 'SEQ별 일자 판매 · 11/5까지', src: '리포트 서비스 CSV · 매일 07:00 자동', st: 'ok' },
  { k: '오설록닷컴 실적 (SAP)', v: '11/5 기준', src: '자동 수집 11/6 07:10', st: 'ok' },
  { k: '원가 (온라인 가이드)', v: '★오설록 온라인 가이드_1104.xlsx', src: '11/4 이 화면에서 올림', st: 'ok' },
  { k: '할인정보 (PROMO_WORK)', v: 'BY26 프로모션별 할인정보.xlsm', src: '스냅샷 11/6 09:00 · 읽기만', st: 'ok' },
  { k: '고객 리뷰', v: '최근 8주 · 1,240건', src: '주간 수집 10/27', st: 'warn', note: '이번 주(11/3) 수집이 아직이에요. 리뷰 수집기를 한 번 돌려 주세요' },
  { k: '공휴일', v: '2027-12-31까지', src: '공휴일 DB + 휴무일 추가 3건', st: 'ok' },
  { k: '몰 이벤트 목록 (홈 일정표)', v: '이벤트목록_1105.xlsx · 대상 O 42건', src: '11/5 이 화면에서 올림 · 몰 관리자에서 내려받은 파일', st: 'ok' },
];
let refreshed = '11/6 09:00', running = false;
let SET_LIVE = false;   // 서버에서 데이터 상태를 읽으면 true (loadSettings)
let costFiles = [['★오설록 온라인 가이드_1104.xlsx', '11/4', true], ['★오설록 온라인 가이드_1021.xlsx', '10/21', false]];
// 외부 연결: 키는 .env에만. 화면은 상태·사용량(자체 한도 기준)·받는 법만 (plans/22 §3·§3-5)
const CONN = [
  { id: 'search', name: '네이버 검색', sub: '블로그·뉴스·카페 · NAVER API HUB', st: 'loading', used: '브리프 근거 글, 트렌드 스카우트' },
  { id: 'trend', name: '네이버 검색어 트렌드', sub: 'NAVER API HUB', st: 'loading', used: '브리프 검색 흐름, 키워드 그룹 검색량' },
  { id: 'shop', name: '네이버 쇼핑인사이트', sub: 'NAVER API HUB · 같은 키', st: 'idle', note: '키는 있어요. 아직 쓰는 화면이 없어요 (다음에 붙일 창구)' },
  { id: 'ad', name: '네이버 검색광고 키워드 도구', sub: '연관 키워드 · 월간 검색수', st: 'loading', how: ['searchad.naver.com 로그인 → 도구 › API 사용 관리 → 약관 동의 후 발급', '액세스 라이선스·비밀키·광고계정 번호를 .env의 NAVER_AD_API_KEY / NAVER_AD_SECRET / NAVER_AD_CUSTOMER_ID에', 'PC 시간 자동 맞춤 켜기 (시각이 틀리면 거절돼요)'] },
  { id: 'yt', name: '유튜브', sub: 'YouTube Data API · 영상 소재', st: 'none', note: '아직 연결 안 했어요. 구글 클라우드 API 키가 필요해요' },
  { id: 'gt', name: '구글 트렌드', sub: '공식 API (알파)', st: 'apply', note: '구글에 알파 신청이 필요해요. 받아 줄지는 구글이 정해요' },
];
const ST = { loading: ['', '확인 중'], ok: ['ok', '연결됨'], nokey: ['warn', '키 없음'], err: ['warn', '오류'], limit: ['warn', '자체 한도 닿음'], idle: ['', '키 있음 · 아직 안 씀'], none: ['', '연결 전'], apply: ['', '신청 필요'] };
// 사전과 목록: 예전엔 CSV를 직접 고침 → 화면에서 고치고 저장 (파일은 같은 settings/ CSV)
const NUM = /^\d+$/;
const LISTS = {
  season: { name: '명분 사전', desc: '홈 일정표 명분·준비 시작에 써요', file: 'settings/명분사전.csv', search: true,
    cols: [['name', '명분', 20, 1], ['date', '날짜 (MM-DD)', 5, 1, /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, '01-31처럼'], ['kind', '종류', 10, 1], ['lead', '준비 시작 (며칠 전)', 3, 1, NUM, '숫자만'], ['memo', '메모', 60, 0, null, null, 1]],
    rows: [['입동', '11-07', '절기', '21', ''], ['빼빼로데이', '11-11', '기념일', '21', '스틱 티'], ['수능', '11-19', '학사', '28', ''], ['블랙프라이데이', '11-27', '기념일', '35', '해마다 날짜 바뀜'], ['동지', '12-22', '세시', '28', '팥 블렌딩'], ['크리스마스', '12-25', '기념일', '35', '12월 내내'], ['설날', '02-17', '명절', '42', '해마다 날짜 바뀜'], ['화이트데이', '03-14', '기념일', '21', '']] },
  groups: { name: '검색어 묶음', desc: '트렌드 검색량·브리프 키워드에서 함께 찾아요', file: 'settings/트렌드키워드.csv', search: true,
    cols: [['name', '묶음 이름', 20, 1], ['kw', '검색어 (;로 구분, 20개까지)', 400, 1, /^[^;]+(;[^;]+){0,19};?$/, '검색어를 ;로 나눠서 20개까지', 1], ['match', '연결 상품 이름 포함어', 300, 0, null, null, 1], ['cat', '카테고리', 20], ['memo', '메모', 100, 0, null, null, 1]],
    rows: [['설 선물', '설 선물;명절 선물세트;설 선물 추천', '선물 세트;보자기', '선물', ''], ['말차', '말차;말차 라떼;말차 디저트', '말차', '파우더', ''], ['피크닉', '피크닉;한강 피크닉;피크닉 도시락', '콜드브루;아이스티', '시즌', '봄·가을']] },
  wrap: { name: '보자기 본품 지정', desc: '이름으로 본품을 못 찾는 보자기 상품', file: 'settings/보자기_본품지정.csv',
    cols: [['wrap', '보자기 SEQ', 12, 1, NUM, '숫자만'], ['main', '본품 SEQ', 12, 1, NUM, '숫자만']], rows: [['500231', '400118'], ['500232', '400121']] },
  kind: { name: '기획 일정 구분', desc: '행사 이름에 이 말이 있으면 이벤트/GNB로 (마감 계산)', file: 'settings/기획일정_구분.csv',
    cols: [['word', '이름에 들어간 말', 20, 1], ['kind', '구분', 5, 1, /^(이벤트|GNB)$/, '이벤트 또는 GNB']], rows: [['기획전', '이벤트'], ['하루특가', 'GNB'], ['출석', '이벤트']] },
  holiday: { name: '휴무일 추가', desc: '공휴일 DB에 없는 임시공휴일·회사 휴무 (마감 계산)', file: 'settings/휴무일_추가.csv',
    cols: [['date', '날짜 (YYYY-MM-DD)', 10, 1, /^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, '2026-12-31처럼'], ['name', '이름', 20]], rows: [['2026-12-31', '회사 휴무'], ['2027-01-02', '회사 휴무'], ['2026-11-13', '창립기념일']] },
  target: { name: '실적 목표', desc: '홈 실적 한 줄의 목표 (SAP에 목표가 비어 있어 손으로 적어요)', file: 'settings/SAP_목표.csv',
    cols: [['period', '기간 (YYYY-MM 또는 BY26)', 7, 1, /^(20\d\d-(0[1-9]|1[0-2])|BY\d\d)$/, '2026-11 또는 BY26'], ['acct', '거래처', 20, 1], ['amt', '목표 (백만원)', 8, 1, /^\d+(\.\d+)?$/, '숫자만']], rows: [['2026-11', '전체', '180'], ['2026-12', '전체', '240'], ['BY26', '전체', '2100']] },
};
let openList = null, draft = null, errs = {}, lq = '';
// 기획 기준: 보기만 (바꾸려면 엔지니어가 .env 또는 config)
const RULES = [
  ['할인 후 원가율 기준', '45%', '원가 ÷ (최종가 ÷ 1.1). 넘으면 주의'],
  ['원가율 넘을 때', '주의 (막지 않음)', '재고 털이는 넘어도 허용'],
  ['보자기 원가', '일반 4,000원 · 한정 9,000원', '본품 원가에 더해요'],
  ['행사 실적으로 보는 할인율 차이', '±2%p 안', ''],
  ['출고 기준 실적', '행사 끝난 다음 날까지', ''],
  ['반응 비교 기간', '시작 35일 전 ~ 8일 전', '직전 행사 여파·예고 효과를 피해요'],
  ['작년 같은 기간', '364일 전 (같은 요일)', ''],
  ['지난 행사 회차 나누기', '21일 넘게 떨어지면 다른 회차', ''],
  ['외부 API 자체 한도', '콘솔 한도의 절반', '위 외부 연결 카드에 창구별로'],
];

// ================= 그리기 =================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const fmt = n => n.toLocaleString('ko-KR');
const warnN = () => DATA.filter(d => d.st !== 'ok').length;
const connWarn = () => CONN.filter(c => ['nokey', 'err', 'limit'].includes(stateOf(c))).length;
const stateOf = c => c.st;
function renderToc() {
  const cur = location.hash || '#data';
  $('#toc').innerHTML = [['#data', '데이터 상태', warnN()], ['#conn', '외부 연결', connWarn()], ['#lists', '사전과 목록', 0], ['#rules', '기획 기준', 0]]
    .map(([h, n, w]) => `<a href="${h}" ${cur === h ? 'aria-current="true"' : ''}>${n}${w ? `<span class="n" aria-label="확인할 것 ${w}개">${w}</span>` : ''}</a>`).join('');
}
function renderData() {
  $('#data').innerHTML = `<div class="sec-head"><div><h2 id="dataH">데이터 상태</h2><span class="cap">마지막 갱신 ${running ? '갱신하는 중…' : refreshed}</span></div>
      <button class="btn sm primary" data-refresh ${running ? 'disabled' : ''}>${running ? '갱신하는 중…' : '데이터 갱신'}</button><button class="btn sm" data-full ${running ? 'disabled' : ''}>실적 CSV까지 전체 다시 집계</button></div>
    ${warnN() ? `<p class="alert" role="status">확인할 것 ${warnN()}개: ${DATA.filter(d => d.st !== 'ok').map(d => esc(d.note)).join(' · ')}</p>` : ''}
    <div class="dlist">${DATA.map(d => `<div class="drow"><div><b>${esc(d.k)}</b><span class="cap">${esc(d.src)}</span></div><span class="v">${esc(d.v)}</span><span class="tag ${d.st}">${d.st === 'ok' ? '최신' : '확인 필요'}</span></div>`).join('')}</div>
    <div class="sec-head"><div><h3>원가 파일 (온라인 가이드)</h3><span class="cap">새 파일을 올리면 가장 최근 것을 써요. .xlsx만, 60MB까지. 원가는 기획 화면에만 보이고 공유 파일엔 안 들어가요</span></div>
      <button class="btn sm" data-pickcost>파일 올리기</button><input type="file" id="costFile" accept=".xlsx" hidden aria-label="원가 파일 고르기"></div>
    ${SET_LIVE ? '<p class="cap note-gap">홈 일정표의 몰 행사는 PROMO_WORK(할인정보)에서 가져와요. 몰 이벤트 목록 파일을 따로 받을지는 엔지니어 확인 중이에요.</p>' : `<div class="sec-head"><div><h3>몰 이벤트 목록</h3><span class="cap">홈 일정표의 '몰에 걸린 페이지'예요. 몰 관리자 화면에서 내려받은 파일을 올려요 (자동으로 받을 수 있는지는 확인 중)</span></div>
      <button class="btn sm" data-toast="예시예요: 이벤트 목록 파일을 올리면 홈 일정표가 바뀌어요. 바뀌는 행사를 먼저 보여 주고 반영해요">파일 올리기</button></div>`}
    <ul class="files">${costFiles.map(([n, d, cur]) => `<li><span>${esc(n)}</span><span class="cap">${esc(d)} ${SET_LIVE ? '' : '올림'}</span>${cur ? '<span class="tag ok">지금 쓰는 파일</span>' : ''}</li>`).join('')}</ul>`;
}
function meter(label, [n, cap]) {
  const r = n / cap;
  return `<div class="meter ${r >= 0.8 ? 'hi' : ''}"><span class="cap">${label}</span><span class="bar"><i data-w="${Math.min(100, r * 100).toFixed(1)}"></i></span><span class="num">${fmt(n)} / ${fmt(cap)}</span></div>`;
}
function connCard(c) {
  const s = stateOf(c), [cls, lab] = ST[s];
  const day = s === 'limit' ? [c.day[1], c.day[1]] : c.day;
  let body = '';
  if (c.day && (s === 'ok' || s === 'err' || s === 'limit')) body += meter('오늘', day) + meter('이번 달', c.month);
  if (s === 'ok') body += `<span class="msg">${c.last ? `마지막 호출 ${c.last} · ` : ''}쓰는 곳: ${esc(c.used)}</span>`;
  if (s === 'err' && c.errMsg) body += `<span class="msg warn">${esc(c.errMsg)}</span>`;
  else if (s === 'err') body += '<span class="msg warn">키가 올바르지 않아요 (NAVER API HUB에서 받은 키인지 확인하세요. 예전 개발자센터 키는 안 돼요). 이 창구만 멈추고 나머지는 그대로예요</span>';
  if (s === 'limit') body += '<span class="msg warn">오늘 자체 한도 10,000회를 다 써서 멈췄어요. 내일 0시(한국 시간)에 다시 돼요. 다른 창구는 그대로예요</span>';
  if (s === 'nokey' && c.id === 'search') body += '<span class="msg">키가 없어서 이 창구를 부르지 않아요. 브리프 근거 패널에 \'연결 안 됨\'으로 보여요</span>';
  if (c.note && s !== 'nokey') body += `<span class="msg">${esc(c.note)}</span>`;
  const how = c.how || (c.id === 'search' ? ['네이버 클라우드 콘솔 › NAVER API HUB › 신청하기', 'Application 등록에서 검색·검색어 트렌드 고르기', '인증 정보의 Client ID·Secret을 .env의 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET에'] : null);
  if (how && (s === 'nokey' || s === 'err')) body += `<details ${s === 'nokey' ? 'open' : ''}><summary class="cap">키 받는 법</summary><ol class="how">${how.map(h => `<li>${esc(h)}</li>`).join('')}</ol></details>`;
  const test = s === 'ok' || s === 'err' ? `<button class="btn xs" data-test="${c.id}">연결 확인</button>` : '';
  return `<div class="conn"><div class="t"><div><b>${esc(c.name)}</b><span class="cap">${esc(c.sub)}</span></div><span class="tag ${cls}">${lab}</span></div>${body}${test ? `<div class="row">${test}</div>` : ''}</div>`;
}
function renderConn() {
  $('#conn').innerHTML = `<div class="sec-head"><div><h2 id="connH">외부 연결</h2><span class="cap">밖으로 보내는 것은 키워드뿐이에요. 매출·원가·고객 정보는 보내지 않아요. 사용량은 이 PC가 센 값이고, 자체 한도(콘솔 한도의 절반)에 닿으면 그 창구만 멈춰요</span></div>
      <span class="cap" aria-live="polite">${connLoaded === 'loading' ? '연결 상태 불러오는 중…' : connLoaded === 'ok' ? '네이버 카드 3개는 실제 상태·사용량이에요' : `연결 상태를 불러오지 못했어요: ${esc(connLoaded)}`}</span></div>
    <div class="conns">${CONN.map(connCard).join('')}</div>
    <div class="keynote"><b>키는 화면에서 넣지 않아요</b><span class="cap">비밀값이 화면·브라우저·기록에 닿지 않게, 키는 <code>workspace\\amoread_app\\.env</code> 파일에만 넣고 앱을 다시 켜요. 빈 양식은 같은 폴더의 <code>.env.example</code>이에요 (이 파일엔 키를 넣지 마세요. git에 올라가요). 콘솔의 '한도 및 알림'도 같은 값으로 걸어 두면 마지막 안전장치가 돼요.</span></div>`;
}
function renderLists() {
  const L = openList && LISTS[openList];
  let ed = '';
  if (L) {
    const nChanged = JSON.stringify(draft) !== JSON.stringify(L.rows), show = draft.map((r, i) => [r, i]).filter(([r]) => !lq || r.join(' ').includes(lq));
    ed = `<div class="editor" aria-labelledby="edH"><div class="sec-head"><div><h3 id="edH">${esc(L.name)}</h3><span class="cap">${esc(L.desc)} · <code>${esc(L.file)}</code></span></div>
        ${nChanged ? '<span class="dirty" role="status">저장 안 한 변경이 있어요</span>' : ''}</div>
      ${L.search ? `<div class="row"><label class="search ${lq ? 'has-value' : ''}" id="lqS"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input type="search" id="lq" value="${esc(lq)}" placeholder="${esc(L.cols[0][1])}·내용으로 찾기" aria-label="${esc(L.name)}에서 찾기" autocomplete="off"><button class="clear" type="button" data-sclear aria-label="검색어 지우기"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></label>
        <span class="search-meta ${lq && !show.length ? 'none' : ''}" aria-live="polite">${lq ? (show.length ? `${show.length}줄 찾았어요` : `'${esc(lq)}'와 맞는 줄이 없어요`) : `${draft.length}줄`}</span></div>` : ''}
      <div class="tbox"><table class="e"><thead><tr>${L.cols.map(c => `<th scope="col">${esc(c[1])}${c[3] ? ' <span aria-hidden="true">*</span>' : ''}</th>`).join('')}<th class="x"><span class="sr">지우기</span></th></tr></thead>
        <tbody>${show.map(([r, i]) => `<tr class="${i >= L.rows.length ? 'new' : ''}">${L.cols.map((c, j) => { const e = errs[`${i}:${j}`];
          return `<td class="${c[6] ? 'w' : ''}"><input type="text" data-cell="${i}:${j}" value="${esc(r[j])}" maxlength="${c[2]}" aria-label="${i + 1}번째 줄 ${esc(c[1])}" ${e ? `aria-invalid="true" aria-describedby="er${i}_${j}"` : ''}>${e ? `<div class="err" id="er${i}_${j}">${esc(e)}</div>` : ''}</td>`; }).join('')}
          <td class="x"><button class="ib" data-rowdel="${i}" aria-label="${i + 1}번째 줄 지우기">✕</button></td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="btn xs" data-rowadd>+ 줄 추가</button><span class="grow"></span>
        <span class="cap">* 꼭 채워야 하는 칸</span><button class="btn sm ghost" data-revert ${nChanged ? '' : 'disabled'}>되돌리기</button><button class="btn sm primary" data-save ${nChanged ? '' : 'disabled'}>저장</button></div></div>`;
  }
  $('#lists').innerHTML = `<div class="sec-head"><div><h2 id="listsH">사전과 목록</h2><span class="cap">예전엔 CSV 파일을 직접 고쳤던 것들이에요. 여기서 고치면 같은 파일에 저장돼요</span></div></div>
    <div class="lists">${Object.entries(LISTS).map(([k, l]) => `<button class="lcard" data-list="${k}" aria-pressed="${openList === k}" ${l.off ? 'disabled' : ''}><b>${esc(l.name)}</b><span class="cap">${esc(l.desc)}</span><span class="cap">${l.off ? `화면 저장 연결 전 · ${esc(l.file)}을 직접 고쳐요` : `${l.rows.length}줄`}</span></button>`).join('')}</div>${ed}`;
}
function renderRules() {
  $('#rules').innerHTML = `<div class="sec-head"><div><h2 id="rulesH">기획 기준</h2><span class="cap">계산에 쓰는 기준이에요. 화면에서는 바꾸지 않아요 (엔지니어가 .env·설정 파일에서)</span></div></div>
    <div class="kv">${RULES.map(([k, v, n]) => `<span>${esc(k)}</span><span><b>${esc(v)}</b>${n ? ` <span class="cap">${esc(n)}</span>` : ''}</span>`).join('')}</div>`;
}
function render() {
  renderToc(); renderData(); renderConn(); renderLists(); renderRules();
  document.querySelectorAll('.meter .bar i[data-w]').forEach(el => el.style.setProperty('--w', `${el.dataset.w}%`));   // 인라인 style 속성 없이 (CSP와 같은 조건)
}

// ================= 동작 =================
function validate(L, rows) {
  const e = {};
  rows.forEach((r, i) => L.cols.forEach((c, j) => { const v = (r[j] || '').trim();
    if (c[3] && !v) e[`${i}:${j}`] = '채워 주세요';
    else if (v && c[4] && !c[4].test(v)) e[`${i}:${j}`] = c[5];
  }));
  const seen = new Map();   // 첫 칸이 같은 줄은 한 번만
  rows.forEach((r, i) => { const k = (L.key || [0]).map(j => (r[j] || '').trim()).join('|'); if (!(r[0] || '').trim()) return; if (seen.has(k)) e[`${i}:0`] = `${seen.get(k) + 1}번째 줄과 같아요`; else seen.set(k, i); });
  return e;
}
const focusCell = id => document.querySelector(`[data-cell="${id}"]`)?.focus();
document.addEventListener('click', e => {
  const t = e.target, d = k => t.closest(`[data-${k}]`), v = k => d(k)?.dataset[k];
  if (d('refresh') && SET_LIVE) { rebuild(false); return; }
  if (d('refresh')) { running = true; render(); setTimeout(() => { running = false; refreshed = '방금'; render(); toast('데이터를 갱신했어요 (예시)'); }, 900); return; }
  if (d('full')) { $('#dlg').showModal(); return; }
  if (d('pickcost')) { $('#costFile').click(); return; }
  if (d('toast')) { toast(v('toast')); return; }
  if (d('dlgno')) { $('#dlg').close(); return; }
  if (d('dlgyes') && SET_LIVE) { $('#dlg').close(); rebuild(true); return; }
  if (d('dlgyes')) { $('#dlg').close(); toast('예시예요: 전체 다시 집계를 시작해요. 끝나면 알려 드려요'); return; }
  if (d('test')) { const b = d('test'); b.disabled = true; toast('키워드 하나(차)로 시험 호출해요 · 검색 2회, 트렌드 1회 사용');
    v2api('/api/keywords/expand', { q: '차', refresh: true }).then(r => { const s = r.sources;
      toast(`시험 호출 결과 — 검색 ${LIVE_SAY[s.naver_search.status]} · 트렌드 ${LIVE_SAY[s.datalab.status]} · 검색광고 ${LIVE_SAY[s.searchad.status]}${[s.naver_search, s.datalab].find(x => x.status === 'error') ? ` (${[s.naver_search, s.datalab].find(x => x.status === 'error').message})` : ''}`); })
      .catch(e => toast(`시험 호출 실패: ${e.message}`)).finally(loadConn); return; }
  if (d('list')) { const k = v('list'); if (openList && JSON.stringify(draft) !== JSON.stringify(LISTS[openList].rows) && k !== openList) { toast('저장 안 한 변경이 있어요. 저장하거나 되돌린 뒤 다른 목록을 열어 주세요'); return; }
    openList = openList === k ? null : k; draft = openList ? LISTS[k].rows.map(r => r.slice()) : null; errs = {}; lq = ''; render(); document.querySelector(`[data-list="${k}"]`)?.focus(); return; }
  if (d('rowadd')) { const L = LISTS[openList]; draft.push(L.cols.map(() => '')); lq = ''; render(); focusCell(`${draft.length - 1}:0`); return; }
  if (d('rowdel')) { draft.splice(+v('rowdel'), 1); errs = {}; render(); return; }
  if (d('revert')) { draft = LISTS[openList].rows.map(r => r.slice()); errs = {}; render(); toast('저장한 내용으로 되돌렸어요'); return; }
  if (d('save')) { const L = LISTS[openList], clean = draft.filter(r => r.some(x => x.trim())).map(r => r.map(x => x.trim()));
    errs = validate(L, clean);
    if (Object.keys(errs).length) { draft = clean; lq = ''; render(); toast(`고칠 칸이 ${Object.keys(errs).length}개 있어요`); focusCell(Object.keys(errs)[0]); return; }
    if (L.live) { saveList(L, clean); return; }
    L.rows = clean; draft = clean.map(r => r.slice()); render(); toast(`저장했어요 (예시: 실제로는 ${L.file})`); return; }
  if (d('sclear')) { lq = ''; render(); $('#lq')?.focus(); return; }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.cell) { const [i, j] = t.dataset.cell.split(':').map(Number), key = `${i}:${j}`, hadErr = key in errs; draft[i][j] = t.value; delete errs[key];
    // 다시 그리는 건 '저장 안 한 변경' 표시가 처음 생길 때와 오류가 풀릴 때만 (매 글자마다 그리면 입력이 끊김)
    if (hadErr || !document.querySelector('.dirty')) { const pos = t.selectionStart; render(); const el = document.querySelector(`[data-cell="${key}"]`); el?.focus(); el?.setSelectionRange(pos, pos); } return; }
  if (t.id === 'lq') { lq = t.value.trim(); render(); const el = $('#lq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.id === 'lq' && e.target.value) { e.preventDefault(); lq = ''; render(); $('#lq')?.focus(); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'costFile') { const f = t.files[0]; if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { toast('.xlsx 파일만 올릴 수 있어요'); return; }
    if (f.size > 60 * 1024 * 1024) { toast('60MB가 넘어요. 필요 없는 시트를 지운 뒤 올려 주세요'); return; }
    if (SET_LIVE) { uploadGuide(f); t.value = ''; return; }
    costFiles = [[f.name, '방금', true], ...costFiles.map(c => [c[0], c[1], false])]; render(); toast('원가 파일을 올렸어요 (예시: 실제로는 읽어서 확인한 뒤 바꿔요)'); }
});

// ================= 실제 데이터 (새 버전) =================
// 네이버 검색·검색어 트렌드·검색광고 카드의 상태와 사용량은 서버에서 (키 값은 오지 않고 있음/없음만).
// 데이터 상태·원가 파일·갱신·사전과 목록(명분 사전·검색어 묶음·보자기)·기획 기준도 서버에서 (loadSettings). 유튜브·구글 트렌드 카드는 아직 안내만
const LIVE_BUCKET = { search: 'naver_search', trend: 'naver_trend', ad: 'naver_searchad' };
let connLoaded = 'loading';
function loadConn() {
  return v2api('/api/connections').then(c => {
    for (const x of CONN) {
      const b = c.usage[LIVE_BUCKET[x.id]];
      if (!b) continue;
      const hasKey = x.id === 'ad' ? c.keys.searchad : c.keys.naver;
      x.day = [b.day, b.day_cap]; x.month = [b.month, b.month_cap]; x.last = '';
      x.st = b.broken ? 'err' : !hasKey ? 'nokey' : (b.day >= b.day_cap || b.month >= b.month_cap) ? 'limit' : 'ok';
      x.errMsg = b.broken ? '사용량 기록을 읽지 못해 이 창구를 멈췄어요 (data/api_usage.json 확인)' : '';
    }
    connLoaded = 'ok'; render();
  }).catch(e => { connLoaded = e.message; render(); });
}
const LIVE_SAY = { ok: '정상', no_key: '키 없음', error: '실패' };
window.addEventListener('hashchange', renderToc);
loadConn();

// ---------- 실제: 데이터 상태 · 원가 파일 · 갱신 · 사전과 목록 · 기획 기준 ----------
const DATE_RE = /^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const SKINDS = ['명절·대목', '기념일', '절기·세시', '학사·생활', '직장', '차 고유', '날씨·계절', '쇼핑', '트렌드'];   // schedule.KINDS와 같음
const LIVE_LISTS = {
  season: { api: '/api/seasons', save: '/api/seasons', key: [0, 1],
    cols: [['name', '명분', 30, 1], ['date', '날짜 (YYYY-MM-DD)', 10, 1, DATE_RE, '2026-12-25처럼'], ['end', '끝나는 날 (기간일 때)', 10, 0, DATE_RE, '2026-12-31처럼'],
      ['kind', '종류', 10, 1, new RegExp(`^(${SKINDS.join('|')})$`), SKINDS.join(' · ')], ['lead', '준비 시작 (며칠 전)', 3, 1, NUM, '숫자만'], ['keyword', '행사 이름 키워드', 20],
      ['seeds', '컨셉 씨앗 (|로 구분)', 250, 0, null, null, 1], ['memo', '메모', 120, 0, null, null, 1]],
    from: it => [it.name, it.date, it.end && it.end !== it.date ? it.end : '', it.kind, String(it.lead ?? ''), it.keyword || '', (Array.isArray(it.seeds) ? it.seeds : []).join('|'), it.memo || ''],
    to: r => ({ name: r[0], date: r[1], end: r[2], kind: r[3], lead: +r[4] || 0, keyword: r[5], seeds: r[6], memo: r[7] }) },
  groups: { api: '/api/settings/trend-groups', save: '/api/settings/trend-groups', key: [0],
    cols: [['name', '묶음 이름', 20, 1], ['keywords', '검색어 (;로 구분, 20개까지)', 400, 1, /^[^;]+(;[^;]+){0,19};?$/, '검색어를 ;로 나눠서 20개까지', 1], ['match', '연결 상품 이름 (;로 구분)', 300, 0, null, null, 1], ['category', '카테고리', 20], ['memo', '메모', 100, 0, null, null, 1]],
    from: it => [it.name, it.keywords || '', it.match || '', it.category || '', it.memo || ''], to: r => ({ name: r[0], keywords: r[1], match: r[2], category: r[3], memo: r[4] }) },
  wrap: { api: '/api/settings/wrap', save: '/api/settings/wrap', key: [0],
    cols: [['wrap_seq', '보자기 SEQ', 12, 1, NUM, '숫자만'], ['base_seq', '본품 SEQ', 12, 1, NUM, '숫자만'], ['memo', '메모', 100, 0, null, null, 1]],
    from: it => [it.wrap_seq, it.base_seq, it.memo || ''], to: r => ({ wrap_seq: r[0], base_seq: r[1], memo: r[2] }) },
};
const daysAgo = d => d ? Math.floor((Date.now() + 9 * 3600e3 - Date.parse(String(d).slice(0, 10))) / 864e5) : null;
const mdd = d => d ? `${+String(d).slice(5, 7)}/${+String(d).slice(8, 10)}` : '-';
function dataRows(mt, sap, sig) {
  const m = mt?.meta || {}, out = [], g = (mt?.guides || []).find(x => x.in_use), rv = sig?.reviews || {};
  const sd = daysAgo(m.sales_last_day);
  out.push({ k: '판매실적', v: m.sales_last_day ? `SEQ별 일자 판매 · ${mdd(m.sales_last_day)}까지` : '아직 없어요', src: `리포트 서비스 CSV ${(m.sales_files || []).length}개`, st: m.sales_last_day && sd <= 3 ? 'ok' : 'warn',
    note: m.sales_last_day ? `판매실적이 ${sd}일 전까지예요. 새 CSV를 넣고 데이터 갱신을 눌러 주세요` : '판매실적 CSV가 없어요' });
  out.push({ k: '오설록닷컴 실적 (SAP)', v: sap?.ready ? `${mdd(sap.date)} 기준` : '아직 없어요', src: `자동 수집 ${sap?.status?.ran_at ? String(sap.status.ran_at).slice(5, 16) : '-'}`, st: sap?.ready && sap?.status?.ok !== false ? 'ok' : 'warn',
    note: sap?.status?.ok === false ? `마지막 자동 수집 실패: ${sap.status.message || ''}` : 'SAP 실적을 아직 받지 않았어요' });
  const sample = /샘플|가상/.test(g?.name || m.guide_file || '');
  out.push({ k: '원가 (온라인 가이드)', v: g?.name || m.guide_file || '없음', src: g ? `${g.folder} · ${g.modified}` : '-', st: g && !sample ? 'ok' : 'warn',
    note: sample ? '샘플(가상 원가) 파일을 쓰고 있어요. 원가율·판정이 실제와 달라요. 실제 온라인 가이드를 올려 주세요' : '원가 파일이 없어요' });
  out.push({ k: '할인정보 (PROMO_WORK)', v: m.promo_workbook_modified ? `파일 수정 ${String(m.promo_workbook_modified).slice(5, 16)}` : '-', src: '읽기만 · 데이터 갱신 때 다시 읽어요', st: m.promo_workbook_modified ? 'ok' : 'warn', note: 'PROMO_WORK를 읽지 못했어요' });
  const lastRv = (rv.files || []).slice(-1)[0] || '', rvEnd = (lastRv.match(/_(\d{8})\.csv$/) || [])[1], rvAgo = rvEnd ? daysAgo(`${rvEnd.slice(0, 4)}-${rvEnd.slice(4, 6)}-${rvEnd.slice(6)}`) : null;
  out.push({ k: '고객 리뷰', v: rv.available ? `최근 ${rv.weeks}주 · ${fmt(rv.reviews || 0)}건 · 상품 ${rv.products}개` : '없어요', src: lastRv ? `주간 수집 · ${lastRv}` : '-', st: rv.available && rvAgo != null && rvAgo <= 10 ? 'ok' : 'warn',
    note: rv.available ? `마지막 리뷰 파일이 ${rvAgo}일 전까지예요. 리뷰 수집기를 한 번 돌려 주세요` : '리뷰 파일이 없어요' });
  return out;
}
let rebuildT = null;
function pollRebuild() {
  clearTimeout(rebuildT);
  rebuildT = setTimeout(() => v2api('/api/rebuild').then(st => {
    if (st.running) { pollRebuild(); return; }
    running = false; loadSettings().then(() => toast(st.ok === false ? `갱신하지 못했어요: ${(st.log || []).slice(-1)[0] || ''}` : '데이터를 갱신했어요'));
  }).catch(() => pollRebuild()), 2000);
}
function rebuild(full) {
  running = true; render();
  v2api('/api/rebuild', { full }).then(r => { toast(r.started ? (full ? '전체 다시 집계를 시작했어요. 끝나면 알려 드려요' : '데이터 갱신을 시작했어요') : '이미 갱신하는 중이에요'); pollRebuild(); })
    .catch(e => { running = false; render(); toast(`시작하지 못했어요: ${e.message}`); });
}
function uploadGuide(f) {
  const fd = new FormData(); fd.append('file', f, f.name); toast('원가 파일을 올리는 중이에요…');
  fetch('/api/guide', { method: 'POST', headers: { 'x-planner-token': V2_TOKEN }, body: fd })
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `서버 오류 (${r.status})`); return d; })
    .then(d => { costFiles = (d.guides || []).map(g => [g.name, g.modified, g.in_use]); render(); toast('원가 파일을 올렸어요. 데이터 갱신을 누르면 새 원가로 다시 계산해요'); })
    .catch(e => toast(`올리지 못했어요: ${e.message}`));
}
function saveList(L, clean) {
  const k = Object.keys(LISTS).find(x => LISTS[x] === L), def = LIVE_LISTS[k];
  v2api(def.save, { items: clean.map(def.to) }).then(r => {
    toast(`${L.file}에 저장했어요${typeof r.saved === 'number' && r.saved !== clean.length ? ` (${r.saved}줄 저장, 형식이 맞지 않는 줄은 빠졌어요)` : ''}`);
    return v2api(def.api).then(x => { L.rows = (x.items || []).map(def.from); draft = L.rows.map(rr => rr.slice()); render(); });
  }).catch(e => toast(`저장하지 못했어요: ${e.message}`));
}
async function loadSettings() {
  const get = u => v2api(u).catch(() => null), keys = Object.keys(LIVE_LISTS);
  const [mt, sap, sig, ...lists] = await Promise.all([get('/api/meta'), get('/api/sap-sales'), get('/api/signals'), ...keys.map(k => get(LIVE_LISTS[k].api))]);
  if (mt) {
    DATA.length = 0; DATA.push(...dataRows(mt, sap, sig));
    costFiles = (mt.guides || []).map(g => [g.name, g.modified, g.in_use]);
    refreshed = mt.meta?.built_at ? String(mt.meta.built_at).slice(5, 16) : '-';
    running = !!mt.rebuild?.running;
    const r = mt.meta?.rules || {}, pc = v => `${Math.round(v * 100)}%`;
    if (r.target_cost_ratio != null) RULES[0][1] = pc(r.target_cost_ratio);
    if (r.wrap_cost != null) RULES[2][1] = `일반 ${fmt(r.wrap_cost)}원 · 한정 ${fmt(r.wrap_cost_limited || 0)}원`;
    if (r.rate_match_tol != null) RULES[3][1] = `±${Math.round(r.rate_match_tol * 100)}%p 안`;
    if (r.ship_lag_days != null) RULES[4][1] = `행사 끝난 뒤 ${r.ship_lag_days}일까지`;
  }
  keys.forEach((k, i) => { const x = lists[i]; if (!x) return; Object.assign(LISTS[k], { cols: LIVE_LISTS[k].cols, key: LIVE_LISTS[k].key, rows: (x.items || []).map(LIVE_LISTS[k].from), live: true }); });
  for (const k of ['kind', 'holiday', 'target']) Object.assign(LISTS[k], { off: true, rows: [] });
  if (openList && LISTS[openList].off) { openList = null; draft = null; }
  SET_LIVE = !!mt; render();
  if (running) pollRebuild();
}
loadSettings();

let toastT;
function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2800); }
render();
