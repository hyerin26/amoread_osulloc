// ================= 예시 레퍼런스 (가상) =================
// kind: page 원본 프로모션 전체 페이지 / sec 원본 구좌 레퍼런스 / mood 느낌 레퍼런스 / event 이벤트 아이디어 (구좌 하나)
// season = 명분·시즌, cls = 분류 5종, ben = 혜택 방식, concept = 컨셉 구성 사례(이름), stype = 구좌 종류(임시), mode = 참여 방식, pts = 느낌 참고 포인트
const CLSN = { season: '시즌', brand: '브랜드기획전', launch: '런칭', collab: '콜라보', clear: '클리어런스' };
const R = [
  { id: 'g1', kind: 'page', name: '가을 차회', from: '자사몰', season: '가을', cls: 'season', ben: ['쿠폰', '하루특가'], concept: '차회 코스 (마중차 → 본 차담 → 입가심 → 마무리)', r: [9, 20], secs: ['차회 차림 순서', '금주의 메뉴', '01 마중차', '02 본 차담', '03 입가심', '04 마무리', '유의사항'], used: 1 },
  { id: 'g2', kind: 'page', name: '봄맞이 MD의 초대장', from: '자사몰', season: '봄', cls: 'season', ben: ['하루특가'], concept: 'MD의 초대장 (GIFT·ESSENTIAL·BLENDED·RITUAL ROOM)', r: [9, 18], secs: ['MD의 초대장', 'GIFT ROOM', 'ESSENTIAL ROOM', 'BLENDED ROOM', 'RITUAL ROOM', 'SPECIAL ROOM'], used: 0 },
  { id: 'g3', kind: 'page', name: '설 선물 얼리버드', from: '자사몰', season: '설', cls: 'season', ben: ['사은품', '페이백', '하루특가'], concept: '', r: [9, 22], secs: ['메인 비주얼', '혜택 총정리', '올해의 보자기', '가격대별 선물', '하루특가', '유의사항'], used: 2 },
  { id: 'g4', kind: 'page', name: '한글날 말의 맛, 차의 맛', from: '자사몰', season: '한글날', cls: 'season', ben: ['쿠폰', '포인트'], concept: '', r: [9, 19], secs: ['오늘의 어보', '우리말 시험', '차의 맛을 부르는 우리말', '조선에서 온 암호 서신', '마음을 전하세요', '우리말 백일장'], used: 0 },
  { id: 'g5', kind: 'page', name: '블랙 프라이데이', from: '자사몰', season: '블프', cls: 'season', ben: ['쿠폰', '하루특가'], concept: '', r: [9, 24], secs: ['카운트다운', '선착순 쿠폰', '매일 다른 특가', '공유하고 포인트', '유의사항'], used: 1 },
  { id: 'g6', kind: 'page', name: '세작 해차 오픈', from: '자사몰', season: '봄', cls: 'launch', ben: ['페이백'], concept: '수확 이야기 (STORY OF HARVEST → 차밭 → GOLDEN PICK)', r: [9, 17], secs: ['THE STORY OF HARVEST', 'SPECIAL BENEFIT', '올해의 해차', '제주 차밭 3곳', 'GOLDEN PICK'], used: 0 },
  { id: 'g7', kind: 'page', name: '○○ 봄 캠페인', from: '외부', season: '봄', cls: 'season', ben: ['쿠폰'], concept: '', r: [9, 16], secs: ['메인 비주얼', '봄 피크닉 룩북', '신상품', '이벤트 안내'], used: 1 },
  { id: 'g8', kind: 'page', name: '△△ 피크닉 기획전', from: '외부', season: '봄', cls: 'brand', ben: ['사은품'], concept: '피크닉 하루 (아침 → 한낮 → 노을)', r: [9, 18], secs: ['메인 비주얼', '피크닉 세트', '가격대별 추천', '리뷰 모음'], used: 0 },
  { id: 's1', kind: 'sec', name: '01 마중차 (대표 1 + 2×2)', from: '자사몰', page: 'g1', psec: '01 마중차', season: '가을', cls: 'season', stype: '상품 그리드', r: [9, 16] },
  { id: 's2', kind: 'sec', name: '가격대별 선물 탭', from: '자사몰', page: 'g3', psec: '가격대별 선물', season: '설', cls: 'season', stype: '상품 그리드', r: [9, 14] },
  { id: 's3', kind: 'sec', name: '올해의 보자기', from: '자사몰', page: 'g3', psec: '올해의 보자기', season: '설', cls: 'season', stype: '스토리', r: [3, 4] },
  { id: 's4', kind: 'sec', name: '혜택 총정리', from: '자사몰', page: 'g3', psec: '혜택 총정리', season: '설', cls: 'season', stype: '혜택 안내', r: [3, 5] },
  { id: 's5', kind: 'sec', name: 'GIFT ROOM', from: '자사몰', page: 'g2', psec: 'GIFT ROOM', season: '봄', cls: 'season', stype: '상품 그리드', r: [9, 16] },
  { id: 's6', kind: 'sec', name: '제주 차밭 3곳', from: '자사몰', page: 'g6', psec: '제주 차밭 3곳', season: '봄', cls: 'launch', stype: '스토리', r: [4, 5] },
  { id: 's7', kind: 'sec', name: '봄 캠페인 메인 비주얼', from: '외부', page: 'g7', psec: '메인 비주얼', season: '봄', cls: 'season', stype: '메인 비주얼', r: [4, 5] },
  { id: 's8', kind: 'sec', name: '피크닉 세트 큐레이션', from: '외부', page: 'g8', psec: '피크닉 세트', season: '봄', cls: 'brand', stype: '상품 그리드', r: [1, 1] },
  { id: 's9', kind: 'sec', name: '매일 다른 특가', from: '자사몰', page: 'g5', psec: '매일 다른 특가', season: '블프', cls: 'season', stype: '상품 그리드', r: [9, 20] },
  { id: 'e1', kind: 'event', name: '우리말 시험 (퀴즈)', from: '자사몰', page: 'g4', psec: '우리말 시험', season: '한글날', cls: 'season', mode: '퀴즈·테스트', r: [9, 16] },
  { id: 'e2', kind: 'event', name: '암호 서신 (공유)', from: '자사몰', page: 'g4', psec: '조선에서 온 암호 서신', season: '한글날', cls: 'season', mode: '공유 유도', r: [3, 4] },
  { id: 'e3', kind: 'event', name: '우리말 백일장 (댓글)', from: '자사몰', page: 'g4', psec: '우리말 백일장', season: '한글날', cls: 'season', mode: '댓글·사진 인증', r: [3, 4] },
  { id: 'e4', kind: 'event', name: '공유하고 포인트', from: '자사몰', page: 'g5', psec: '공유하고 포인트', season: '블프', cls: 'season', mode: '공유 유도', r: [16, 9] },
  { id: 'e5', kind: 'event', name: '□□ 출석 스탬프', from: '외부', page: null, season: '연말', cls: 'brand', mode: '출석·스탬프', r: [3, 4] },
  { id: 'e6', kind: 'event', name: '◇◇ 취향 테스트', from: '외부', page: null, season: '', cls: 'brand', mode: '퀴즈·테스트', r: [9, 16] },
  { id: 'm1', kind: 'mood', name: '돗자리 위 티타임', from: '외부', src: '핀터레스트 보드 · 봄 피크닉', season: '봄', pts: ['색감', '소품'], r: [2, 3], used: 1 },
  { id: 'm2', kind: 'mood', name: '연둣빛 봄 색감', from: '외부', src: '외부 캠페인 일부', season: '봄', pts: ['색감'], r: [4, 5], used: 1 },
  { id: 'm3', kind: 'mood', name: '보온병 들고 산책', from: '외부', src: '핀터레스트 보드 · 아웃도어', season: '봄', pts: ['구도'], r: [9, 16] },
  { id: 'm4', kind: 'mood', name: '벚꽃 아래 찻잔', from: '자사몰', src: '자사몰 지난 행사 일부', season: '봄', pts: ['색감', '구도'], r: [3, 4] },
  { id: 'm5', kind: 'mood', name: '손글씨 시즌 타이포', from: '외부', src: '핀터레스트 보드 · 시즌 타이포', season: '', pts: ['글씨'], r: [1, 1] },
  { id: 'm6', kind: 'mood', name: '보자기 매듭 클로즈업', from: '자사몰', src: '자사몰 지난 행사 일부', season: '설', pts: ['소품', '구도'], r: [4, 5] },
  { id: 'm7', kind: 'mood', name: '어두운 바탕 차회 상차림', from: '자사몰', src: '자사몰 지난 행사 일부', season: '가을', pts: ['색감', '카피 톤'], r: [3, 4] },
];
let saved = new Set(['g1', 'm1', 's5']);
const TABS = [['page', '전체 프로모션'], ['sec', '구좌 사례'], ['mood', '느낌'], ['event', '이벤트 아이디어']];
// 탭마다 필터 (공통 + 탭 고유). 구좌 종류는 임시 목록 — 디자이너 4가지 / 다른 갈래 7가지 중 나중에 정함
const COMMON = [['from', '출처', ['자사몰', '외부']], ['season', '명분·시즌', ['봄', '가을', '설', '블프', '한글날', '연말']], ['cls', '분류', Object.keys(CLSN)]];
const EXTRA = {
  page: [['ben', '혜택 방식', ['쿠폰', '사은품', '하루특가', '페이백', '포인트']], ['concept', '컨셉 구성', ['컨셉 구성 사례만']]],
  sec: [['stype', '구좌 종류', ['메인 비주얼', '상품 그리드', '혜택 안내', '스토리'], '임시 목록 · 나중에 정해요']],
  mood: [['pts', '참고 포인트', ['색감', '구도', '소품', '글씨', '카피 톤']]],
  event: [['mode', '참여 방식', ['퀴즈·테스트', '공유 유도', '댓글·사진 인증', '출석·스탬프', '뽑기·룰렛', '쿠폰 받기']]],
};
const PLANS = { p5: { name: '봄 · 피크닉에서 누리는 차 한 잔의 여유', secs: ['메인 비주얼', '01 첫 잔, 벚꽃', '02 가격대별 선물 추천', '오늘의 하루특가', '03 먼저 마셔 본 후기', '04 피크닉 사진 인증', '봄맞이 혜택'] },
  p1: { name: '블프 말차 묶음전', secs: ['메인 비주얼', '말차 묶음', '하루특가', '혜택 안내'] }, p2: { name: '연말 선물 기획전', secs: [] } };

// ================= 상태 =================
let tab = 'page', q = '', f = {}, savedOnly = false, cur = null, putOpen = false, ownN = 0;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function demoImg(w, h, own) {
  if (own) return own;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 40}" height="${h * 40}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#f3f3f3"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#p)"/><rect x="0.5" y="0.5" width="${w * 40 - 1}" height="${h * 40 - 1}" fill="none" stroke="#dedede"/></svg>`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="">`;
}
const thumb = r => r.img ? `<img src="${r.img}" alt="">` : r.link ? '<span class="cap">링크</span>' : demoImg(r.r[0], r.r[1]);
const pageOf = r => r.page ? R.find(x => x.id === r.page) : null;
// 한 레퍼런스가 필터에 맞는지: 그룹 안은 하나만 고름, 그룹끼리는 모두 맞아야 (안 고른 그룹은 통과)
function match(r, filters = f, kind = tab) {
  if (r.kind !== kind) return false;
  if (savedOnly && !saved.has(r.id)) return false;
  for (const [k, v] of Object.entries(filters)) {
    if (!v) continue;
    if (k === 'concept') { if (!r.concept) return false; continue; }
    const val = r[k]; if (Array.isArray(val) ? !val.includes(v) : val !== v) return false;
  }
  if (q) { const hay = [r.name, r.season, CLSN[r.cls], r.concept, r.src, pageOf(r)?.name, r.stype, r.mode, ...(r.ben || []), ...(r.pts || [])].filter(Boolean).join(' '); if (!hay.includes(q)) return false; }
  return true;
}
const groups = () => [...COMMON, ...(EXTRA[tab] || [])].filter(([k]) => !(tab === 'mood' && k === 'cls'));

// ================= 그리기 =================
function render() {
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${n}<span class="n">${R.filter(r => match(r, f, k)).length}</span></button>`).join('');
  // 필터 칩 옆 숫자 = 그 칩을 고르면 남는 개수 (나머지 필터·검색은 그대로)
  $('#filters').innerHTML = groups().map(([k, label, opts, note]) => `<div class="fg"><span>${label}</span><div class="chips-row">${opts.map(o => { const n = R.filter(r => match(r, { ...f, [k]: o })).length;
    return `<button class="chip" data-f="${k}|${o}" aria-pressed="${f[k] === o}" ${n || f[k] === o ? '' : 'disabled'}>${k === 'cls' ? CLSN[o] : o}<span class="n">${n}</span></button>`; }).join('')}${note ? `<span class="note">${note}</span>` : ''}</div></div>`).join('');
  const list = R.filter(r => match(r));
  const any = q || savedOnly || Object.values(f).some(Boolean);
  $('#resN').textContent = `${TABS.find(t => t[0] === tab)[1]} ${list.length}개${any ? ' · 고른 조건에 맞는 것만' : ' · 필터를 안 골라서 전체'}`;
  $('#clearAll').hidden = !any;
  $('#qS').classList.toggle('has-value', !!q);
  $('#grid').innerHTML = list.length ? list.map(card).join('') : `<div class="empty">${q ? `'${esc(q)}'와 ` : ''}고른 조건에 맞는 레퍼런스가 없어요.<button class="btn sm" data-clearall>필터·검색 지우기</button></div>`;
  renderDrawer();
}
function card(r) {
  const p = pageOf(r), tags = [`<span class="tag ${r.from === '자사몰' ? 'real' : ''}">${r.from}</span>`];
  if (r.cls && r.kind !== 'mood') tags.push(`<span class="tag c-${r.cls}">${CLSN[r.cls]}</span>`);
  if (r.season) tags.push(`<span class="tag">${esc(r.season)}</span>`);
  if (r.concept) tags.push('<span class="tag">컨셉 구성</span>');
  if (r.stype) tags.push(`<span class="tag">${esc(r.stype)}</span>`);
  if (r.mode) tags.push(`<span class="tag">${esc(r.mode)}</span>`);
  (r.pts || []).forEach(x => tags.push(`<span class="tag">${x}</span>`));
  if (r.used) tags.push(`<span class="tag">지난 기획안에서 ${r.used}번 씀</span>`);
  return `<div class="rc" ${cur === r.id ? 'aria-current="true"' : ''}><button class="open" data-open="${r.id}" aria-label="${esc(r.name)} 자세히"><span class="fr">${thumb(r)}</span>
      <span class="nm">${esc(r.name)}</span></button><span class="cap">${p ? `${esc(p.name)}에서` : r.src ? esc(r.src) : r.kind === 'page' ? `구좌 ${r.secs.length}개` : '외부 사례'}</span>
    <span class="tags">${tags.join('')}</span><button class="star" data-star="${r.id}" aria-pressed="${saved.has(r.id)}" aria-label="${esc(r.name)} 저장">${saved.has(r.id) ? '★' : '☆'}</button></div>`;
}
const KIND_N = { page: '원본 프로모션 전체 페이지', sec: '원본 구좌 레퍼런스', mood: '느낌 레퍼런스', event: '이벤트 아이디어 (원본 구좌)' };
function renderDrawer() {
  const r = R.find(x => x.id === cur), d = $('#drawer');
  d.hidden = !r; $('#scrim').hidden = !r; if (!r) return;
  const p = pageOf(r), kids = r.kind === 'page' ? R.filter(x => x.page === r.id) : [];
  const kv = [['종류', KIND_N[r.kind]], ['출처', r.from + (r.src ? ` · ${r.src}` : '')], r.cls && ['분류', CLSN[r.cls]], r.season && ['명분·시즌', r.season], p && ['페이지', p.name], r.concept && ['컨셉 구성', r.concept],
    r.ben && ['혜택 방식', r.ben.join(', ')], r.stype && ['구좌 종류', `${r.stype} (임시)`], r.mode && ['참여 방식', r.mode], r.pts && ['참고 포인트', r.pts.join(', ')], r.link && ['링크', r.link]].filter(Boolean);
  const target = r.kind === 'mood' ? '느낌으로' : '참고로';
  d.innerHTML = `<div class="dh"><div class="grow"><div class="overline">${KIND_N[r.kind]}</div><h2 id="drH">${esc(r.name)}</h2></div><button class="btn sm" data-close>닫기</button></div>
    <div class="db"><span class="fr big">${thumb(r)}</span>
      <div class="kv">${kv.map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join('')}</div>
      <div class="acts">
        <div class="row">${r.kind === 'page' ? `<button class="btn sm" data-whole="${r.id}">전체 페이지 보기</button>${kids.length ? `<button class="btn sm" data-kids="${r.id}">이 페이지의 구좌 ${kids.length}개</button>` : ''}`
          : p ? `<button class="btn sm" data-whole="${p.id}" data-mark="${esc(r.psec)}">전체 페이지 보기 · 이 구좌 위치</button>` : ''}
          <button class="btn sm" data-star="${r.id}" aria-pressed="${saved.has(r.id)}">${saved.has(r.id) ? '★ 저장됨' : '☆ 저장'}</button></div>
        <button class="btn sm primary" data-put aria-expanded="${putOpen}">기획안에 ${target} 담기 ▾</button>
        ${putOpen ? putBox(r) : ''}
        <p class="hint">${r.kind === 'sec' || r.kind === 'event' ? '레이아웃 가져오기는 구좌 편집 안에서 해요 (바꿀 구좌가 있어야 해서). 여기서는 참고로만 담아요.' : r.kind === 'page' ? '전체 페이지는 구좌 구성 추천의 참고로 담겨요. 구좌 하나만 담으려면 [이 페이지의 구좌]에서 골라요.' : '느낌 레퍼런스는 구조가 없어 레이아웃은 가져오지 않아요. 기획안 전체나 구좌 하나에 붙여요.'}</p>
      </div>
      <label class="f"><span>메모 <em>(선택) 나만 봐요</em></span><textarea rows="3" data-memo="${r.id}" placeholder="예) 탭 모양만 참고, 색은 너무 진함">${esc(r.memo || '')}</textarea></label>
    </div>`;
}
function putBox(r) {
  const pid = r._plan || 'p5', plan = PLANS[pid], needSec = r.kind === 'sec' || r.kind === 'event';
  const opts = (needSec ? [] : ['기획안 전체']).concat(plan.secs);
  return `<div class="putbox"><label class="f"><span>기획안</span><select data-putplan="${r.id}">${Object.entries(PLANS).map(([k, v]) => `<option value="${k}" ${k === pid ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    <label class="f"><span>${needSec ? '어느 구좌에' : '어디에'}</span><select id="putSec" ${opts.length ? '' : 'disabled'}>${opts.length ? opts.map(o => `<option>${esc(o)}</option>`).join('') : '<option>구좌가 아직 없어요</option>'}</select></label>
    <div class="row"><button class="btn xs primary" data-putgo="${r.id}" ${opts.length ? '' : 'disabled'}>담기</button><button class="btn xs ghost" data-put>취소</button></div>
    ${opts.length ? '' : '<span class="hint">이 기획안은 구좌 구성 전이에요. 구성을 정한 뒤 담거나, 기획안 전체에 담아 주세요.</span>'}</div>`;
}
function wholePage(id, mark) {
  const p = R.find(x => x.id === id);
  $('#dlgO').textContent = `원본 프로모션 전체 페이지 · ${p.from}`; $('#dlgH').textContent = p.name; $('#dlgS').textContent = p.concept ? `컨셉 구성: ${p.concept}` : '실제로 걸렸던 페이지 한 장 전체예요 (예시 자리)';
  $('#dlgB').innerHTML = p.secs.map((s, i) => { const k = R.find(x => x.page === p.id && x.psec === s); return `<div class="oseg ${s === mark ? 'used' : ''}"><div class="t"><span class="grow">${i + 1}. ${esc(s)}</span>${s === mark ? '<span class="tag real">지금 보는 구좌</span>' : ''}${k ? `<button class="btn xs" data-open="${k.id}" data-fromdlg>이 구좌 보기</button>` : ''}</div><span class="ph"></span></div>`; }).join('');
  $('#dlgF').innerHTML = '';
  $('#dlg').showModal();
  if (mark) $('#dlgB .used')?.scrollIntoView({ block: 'center' });
}
function openAdd() {
  $('#dlgO').textContent = '레퍼런스 추가'; $('#dlgH').textContent = '링크나 파일로 모으기'; $('#dlgS').textContent = '파일은 이 PC에서 미리보기만, 링크는 주소만 저장해요(열지 않아요). 핀터레스트 보드 연결은 엔지니어 검증 뒤에 붙어요.';
  $('#dlgB').innerHTML = `<div class="two"><label class="f"><span>링크</span><input type="url" id="addUrl" placeholder="https://…"></label>
      <label class="f"><span>또는 파일</span><input type="file" id="addFile" accept="image/*,.pdf"></label></div>
    <div class="two"><label class="f"><span>종류</span><select id="addKind">${TABS.map(([k, n]) => `<option value="${k}" ${k === tab ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f"><span>명분·시즌 <em>(선택)</em></span><select id="addSeason"><option value="">없음</option>${COMMON[1][2].map(s => `<option>${s}</option>`).join('')}</select></label></div>
    <label class="f"><span>이름</span><input type="text" id="addName" maxlength="40" placeholder="예) 노을빛 피크닉 상차림"></label>
    <button class="btn sm" disabled title="연결 예정">핀터레스트 보드 연결 (연결 예정)</button>`;
  $('#dlgF').innerHTML = '<button class="btn sm primary" data-addgo>추가</button>';
  $('#dlg').showModal();
}
function addRef() {
  const raw = $('#addUrl').value.trim(), file = $('#addFile').files[0], name = $('#addName').value.trim(), kind = $('#addKind').value;
  let link = '', img = '';
  if (raw) { let u; try { u = new URL(raw); } catch { u = null; } if (!u || !/^https?:$/.test(u.protocol)) { toast('http나 https로 시작하는 주소를 넣어 주세요'); return; } link = raw; }
  if (file) { if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { toast('이미지나 PDF 파일만 넣을 수 있어요'); return; } if (file.type.startsWith('image/')) img = URL.createObjectURL(file); }
  if (!link && !file) { toast('링크나 파일을 하나 넣어 주세요'); return; }
  const r = { id: `own${++ownN}`, kind, name: name || (link ? new URL(link).hostname.replace(/^www\./, '') : file.name), from: '외부', src: '직접 추가', season: $('#addSeason').value, cls: kind === 'mood' ? undefined : '', r: [3, 4], link, img, pts: kind === 'mood' ? [] : undefined, secs: kind === 'page' ? [] : undefined };
  R.unshift(r); tab = kind; $('#dlg').close(); render(); toast('레퍼런스를 추가했어요. 태그는 상세에서 더할 수 있어요');
}

// ================= 동작 =================
document.addEventListener('click', e => {
  const t = e.target, d = k => t.closest(`[data-${k}]`), v = k => d(k)?.dataset[k];
  if (d('tab')) { tab = v('tab'); f = {}; cur = null; render(); document.querySelector(`[data-tab="${tab}"]`)?.focus(); return; }
  if (d('f')) { const [k, o] = v('f').split('|'); f[k] = f[k] === o ? '' : o; render(); document.querySelector(`[data-f="${k}|${o}"]`)?.focus(); return; }
  if (d('clearall') || t.id === 'clearAll') { f = {}; q = ''; savedOnly = false; $('#q').value = ''; $('#savedOnly').checked = false; render(); return; }
  if (d('sclear')) { q = ''; $('#q').value = ''; render(); $('#q').focus(); return; }
  if (d('star')) { const id = v('star'); saved.has(id) ? saved.delete(id) : saved.add(id); render(); toast(saved.has(id) ? '저장했어요. ★ 저장한 것만에서 모아 봐요' : '저장을 뺐어요'); return; }
  if (d('open')) { const fromDlg = d('fromdlg'); cur = v('open'); putOpen = false; if (fromDlg) $('#dlg').close(); const r = R.find(x => x.id === cur); if (r.kind !== tab) { tab = r.kind; f = {}; } render(); return; }
  if (d('close') || t.id === 'scrim') { cur = null; putOpen = false; render(); return; }
  if (d('whole')) { wholePage(v('whole'), d('whole').dataset.mark); return; }
  if (d('kids')) { const id = v('kids'), p = R.find(x => x.id === id); tab = 'sec'; f = {}; q = p.name; $('#q').value = q; cur = null; render(); toast(`'${p.name}'의 구좌만 보여요`); return; }
  if (d('put')) { putOpen = !putOpen; renderDrawer(); return; }
  if (d('putgo')) { const r = R.find(x => x.id === v('putgo')), pid = r._plan || 'p5', where = $('#putSec').value; r.used = (r.used || 0) + 1; putOpen = false; render();
    toast(`'${PLANS[pid].name}'의 ${where}에 ${r.kind === 'mood' ? '느낌' : '참고'}로 담았어요. 구좌 편집의 레퍼런스 탭에 보여요`); return; }
  if (d('addgo')) { addRef(); return; }
  if (t.id === 'addBtn') { openAdd(); return; }
  if (d('toast')) toast(v('toast'));
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'savedOnly') { savedOnly = t.checked; render(); return; }
  if (t.dataset.putplan) { R.find(x => x.id === t.dataset.putplan)._plan = t.value; renderDrawer(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { q = t.value.trim(); render(); return; }
  if (t.dataset.memo) { R.find(x => x.id === t.dataset.memo).memo = t.value; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && e.target.id === 'q' && e.target.value) { e.preventDefault(); q = ''; e.target.value = ''; render(); return; }
  if (e.key === 'Escape' && cur && !$('#dlg').open) { cur = null; putOpen = false; render(); }
});
let toastT;
function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2800); }
render();
