// ---------------- 예시 데이터 (가상) ----------------
const LAYOUTS = { hero: '단일 비주얼', 'text-cta': '텍스트와 버튼', grid2: '2열 상품', grid3: '3열 상품', split: '좌우 분할', benefit: '혜택 안내', 'deal-banner': '날짜별 특가' };
let COPY = '피크닉 가방에 차 한 병';   // 기획안이면 메인 카피(없으면 명분)
// 원본 프로모션 전체 페이지 (1): 자사몰 지난 행사와 외부 페이지. secs = 그 페이지의 원본 구좌 레퍼런스 (2) 이름
const PAGES = {
  // r = 첫 화면 캡처 비율(가로:세로, 예시). 프로모션 이미지는 대부분 세로가 길다
  spring: { name: '봄맞이 티 컬렉션', from: '자사몰', period: '2026.03.02~03.15', r: [9, 16], secs: ['메인 비주얼', '벚꽃 한정', '가격대별 선물 추천', '취향별 추천', '혜택 안내'] },
  extA: { name: '○○ 봄 캠페인', from: '외부', period: '', r: [4, 5], secs: ['메인 비주얼', '봄 피크닉 룩북', '신상품', '이벤트 안내'] },
  nadri: { name: '봄 나들이 티', from: '자사몰', period: '2026.04.13~04.26', r: [9, 16], secs: ['메인 비주얼', '들고 가기 좋은 차', '함께 사면 좋은', '혜택 안내'] },
  extB: { name: '△△ 피크닉 기획전', from: '외부', period: '', r: [3, 4], secs: ['메인 비주얼', '피크닉 세트', '가격대별 추천', '리뷰 모음'] },
};
// 원본 구좌 레퍼런스 이미지 비율 (예시): 구좌마다 다르다. 가로가 긴 것도 섞어 둠
const SEC_R = { '메인 비주얼': [4, 5], '피크닉 세트': [1, 1], '들고 가기 좋은 차': [3, 4], '가격대별 선물 추천': [16, 9] };
// type: rule = 규칙만(원본 없음) / single = 한 페이지에서 가져옴 / mix = 여러 곳의 원본 구좌를 조합 (AI·로직, 연결 예정)
// secs: [구좌 이름, 레이아웃, 넣은 이유, 덧붙임]. 덧붙임 = { kind, tabs } 탭 구좌 묶음(plans/17) · { src: [페이지, 그 페이지의 원본 구좌] } 출처
// match: 이번 브리프와 겹치는 것 [이름, 겹침 여부]
const CANDS = [
  { id: 'A', type: 'rule', title: '시즌 기본형', why: '시즌 프로모션의 기본 틀에 고른 키워드를 넣었어요', basis: '분류: 시즌',
    match: [['같은 분류: 시즌', true], ["키워드: 피크닉", true], ['같은 명분', false]],
    secs: [['메인 비주얼', 'hero', '명분과 메인 카피를 첫 화면에 크게'], ['피크닉 추천 차', 'grid2', "고른 키워드 '피크닉'에 맞는 상품"], ['하루특가', 'deal-banner', '날짜마다 바뀌는 특가로 다시 찾게'], ['혜택 안내', 'benefit', '쿠폰·사은품 같은 혜택을 한곳에']] },
  { id: 'B', type: 'single', page: 'spring', title: '작년 봄 기획전처럼', why: '작년 같은 시기, 같은 명분의 시즌 프로모션 구성이에요',
    match: [['같은 명분: 봄', true], ['비슷한 시기', true], ['같은 분류: 시즌', true], ['키워드: 피크닉', false]],
    secs: [['메인 비주얼', 'hero', '명분과 메인 카피를 첫 화면에 크게'], ['벚꽃 한정', 'grid3', '시즌 한정 상품을 먼저'],
      ['가격대별 선물 추천', 'grid2', '예산이 정해진 선물 고객이 먼저 고르게', { kind: '가격대', tabs: ['1만원대', '2만원대', '3만원 이상'] }],
      ['취향별 추천', 'grid2', '맛 취향으로 고르기 쉽게', { kind: '취향·테마', tabs: ['달콤한', '은은한', '무카페인'] }], ['혜택 안내', 'benefit', '혜택을 한곳에']] },
  { id: 'C', type: 'mix', title: '레퍼런스 조합 추천', why: "브리프 키워드 '피크닉'에 맞는 섹션을 여러 페이지에서 골라 이었어요",
    match: [['키워드: 피크닉', true], ['같은 분류: 시즌', true], ['비슷한 시기', true], ['같은 명분', false]],
    secs: [['메인 비주얼', 'hero', '명분과 메인 카피를 첫 화면에 크게', { src: ['extA', '메인 비주얼'] }],
      ['피크닉 추천 차', 'grid2', '피크닉 장면에 어울리는 상품', { src: ['extB', '피크닉 세트'] }],
      ['들고 가기 좋은 차', 'grid3', '휴대하기 좋은 상품', { src: ['nadri', '들고 가기 좋은 차'] }],
      ['가격대별 선물 추천', 'grid2', '예산으로 고르기 쉽게', { kind: '가격대', tabs: ['1만원대', '2만원대', '3만원 이상'], src: ['spring', '가격대별 선물 추천'] }],
      ['하루특가', 'deal-banner', '날짜마다 바뀌는 특가로 다시 찾게'], ['혜택 안내', 'benefit', '혜택을 한곳에']] },
];
// 출처 번호: 조합 안에서 원본 구좌가 나오는 순서대로 ① ② ③ …
const NUM = '①②③④⑤⑥⑦⑧';
const srcList = c => c.secs.filter(s => s[3]?.src).map(s => s[3].src);
const pagesOf = c => [...new Set(srcList(c).map(([p]) => p))];

// ---------------- 상태 ----------------
let n = 3;          // 목업 보기용: 2개 / 3개
let pair = 'AB';    // 목업 보기용: 2개일 때 어떤 두 안 (실제로는 추천이 고름, 고정하지 않음)
let chosen = null;  // 고른 구성안 id ('blank'은 빈 페이지)
let rows = [];      // 고른 구성: { id, name, layout, why, kind?, tabs?: [{tabId, label}](탭 구좌일 때), tnote?(탭 출처 안내), gk?(묶음 열쇠), gname?(묶음 이름, 따로 둘 때), carry?(나누기·합치기로 이어 받을 상품 칸) }
// 탭 구좌 (plans/28): 탭은 tabId로 다룬다 → 이름·순서를 바꾸거나 지워도 상품 칸(slots[].tabId)이 제 탭에 붙어 있다
const TAB_LAYOUTS = ['grid2', 'grid3', 'feat'], TAB_MIN = 2, TAB_MAX = 12;
const tid = () => `t${Date.now().toString(36)}${++uidN}`;
const newTabs = (labels = ['탭 1', '탭 2']) => labels.map(label => ({ tabId: tid(), label: String(label).slice(0, 40) }));
function dropTabs(r) { delete r.tabs; delete r.kind; delete r.gk; delete r.tnote; }
let sel = null;     // 고른 구좌 (미리보기에 테두리)
let uidN = 0;
const uid = () => `s${++uidN}`;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 기획안 전체 와이어프레임 (4): 구좌 종류별 작은 모양을 쌓는다
function wire(secs, big = false) {
  const inner = (ly, nm) => {
    const b = '<span class="blk"></span>';
    if (ly === 'hero') return `<span class="blk">${big ? esc(COPY) : ''}</span>`;
    if (ly === 'grid2') return `<span class="row">${b.repeat(2)}</span>`;
    if (ly === 'grid3') return `<span class="row">${b.repeat(3)}</span>`;
    if (ly === 'split') return `<span class="row">${b.repeat(2)}</span>`;
    if (ly === 'deal-banner') return `<span class="row">${b.repeat(4)}</span>`;
    if (ly === 'text-cta') return `${b}${b}<span class="btnb"></span>`;
    return b;   // benefit
  };
  const pills = s => s.tabs ? `<span class="pills">${s.tabs.map((t, i) => `<span class="${i ? '' : 'on'}">${big ? esc(t.label ?? t) : ''}</span>`).join('')}</span>` : '';
  return `<div class="wf ${big ? 'big' : ''}" aria-hidden="true">${secs.map(s => `<div class="s ${s.layout} ${big && s.id === sel ? 'on' : ''}"><span class="nm">${esc(s.name)}</span>${pills(s)}${inner(s.layout, s.name)}</div>`).join('')}</div>`;
}
const toRows = c => c.secs.map(([name, layout, why, g]) => ({ id: uid(), name, layout, why, ...(g?.tabs ? { kind: g.kind, tabs: newTabs(g.tabs), gk: uid(), tnote: g.note || '추천에서 옴' } : {}) }));
function cardLine(c, [nm, ly, , g]) {
  const shape = g?.tabs ? `탭 ${g.tabs.length} · ${LAYOUTS[ly]}` : LAYOUTS[ly];
  let src = '';
  if (c.type === 'mix') {
    if (g?.src) { const i = srcList(c).findIndex(x => x === g.src), p = PAGES[g.src[0]]; src = `<span class="src"><b>${NUM[i]}</b> ${esc(p.from)} · ${esc(p.name)}</span>`; }
    else src = '<span class="src">규칙</span>';
  }
  return `<span class="ln"><span>${esc(nm)} <span class="ly">${shape}</span></span>${src}</span>`;
}
// 카드 그림 자리: 한 페이지 = 원본 첫 화면 / 조합 = 쓰인 원본 구좌 모음 / 규칙 = 글
// 예시 이미지: 원본마다 비율이 다르다는 걸 보이려고 비율만 다른 빗금 그림 (실제 캡처 연결 전)
// 틀은 늘 같은 크기, 이미지는 원본 비율 그대로 틀 안에 맞춘다 (늘리거나 자르지 않음, 남는 곳은 바탕색)
function demoImg(w, h, alt) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 40}" height="${h * 40}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#f3f3f3"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#p)"/><rect x="0.5" y="0.5" width="${w * 40 - 1}" height="${h * 40 - 1}" fill="none" stroke="#dedede"/></svg>`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${esc(alt)}">`;
}
// 수집해 둔 화면이 있으면 원본 구좌 자리를 잘라 보여 준다 (없으면 빗금 자리)
const capOf = src => { const p = PAGES[src[0]]; if (!p?.cap) return ''; const b = Cap.band(p.layout, src[1]);
  const sx = CANDS.flatMap(k => k.secs).map(s => s[3]).find(g => g?.src && g.src[0] === src[0] && g.src[1] === src[1])?.sx;
  const at = b ? `data-y="${b.y}" data-h="${b.h}"` : sx ? `data-t="${esc(sx.t)}" data-n="${sx.n}"` : '';
  return at ? `<span class="crop" data-crop data-id="${esc(src[0])}" ${at}></span>` : ''; };
function visual(c) {
  if (c.type === 'single') {
    const p = PAGES[c.page];
    return `<button class="vis thumb" data-orig="${c.page}" aria-label="${esc(p.name)} 원본 페이지 보기">${demoImg(p.r[0], p.r[1], '')}<span class="lb">${p.zones ? `진열 칸 ${p.secs.length}개 · 캡처 연결 전` : `원본 첫 화면 · 예시 ${p.r[0]}:${p.r[1]}`}</span></button>`;
  }
  if (c.type === 'mix') {
    const s = srcList(c), show = s.slice(0, s.length > 4 ? 3 : 4), more = s.length - show.length;
    return `<button class="vis mosaic" data-src="${c.id}" aria-label="출처 ${s.length}개 보기">${show.map((x, i) => { const r = SEC_R[x[1]] || [3, 4]; return `<span class="cell">${capOf(x) || demoImg(r[0], r[1], '')}<b>${NUM[i]}</b></span>`; }).join('')}${more ? `<span class="cell more">+${more}</span>` : ''}</button>`;
  }
  return `<div class="vis none"><span>원본 없음</span><span class="cap">${AI_LIVE ? '유형 규칙으로 정한 기본 틀이라 가져온 원본 페이지가 없어요' : `${esc(c.basis)} 기준으로 자동으로 짠 구성이에요`}</span></div>`;
}
function headTag(c) {
  if (c.type === 'single') { const p = PAGES[c.page]; return `<span class="tag ${p.from === '자사몰' ? 'real' : ''}">${p.from === '자사몰' ? '지난 행사' : '외부'}</span>`; }
  if (c.type === 'mix') return `<span class="tag">${pagesOf(c).length}곳에서 조합</span>`;
  return '<span class="tag">규칙</span>';
}
const glance = c => {
  const tabs = c.secs.filter(s => s[3]?.tabs).length, deal = c.secs.some(s => s[1] === 'deal-banner');
  return `구좌 ${c.secs.length} · 탭 구좌 ${tabs} · 하루특가 ${deal ? '있음' : '없음'}`;
};
const basisOf = c => c.type === 'single' ? `${PAGES[c.page].from} · ${PAGES[c.page].name}${PAGES[c.page].period ? ` (${PAGES[c.page].period})` : ''}`
  : c.type === 'mix' ? `자사몰·외부 레퍼런스 ${pagesOf(c).length}곳 · ${AI_LIVE ? '수집한 사례에서 골랐어요' : '연결 후 AI·로직'}` : c.basis;
const shown = () => n === 3 ? CANDS : CANDS.filter(c => pair.includes(c.id));

// 탭 구좌 ↔ 따로 구좌: 탭 하나로 = 탭 하나가 PROMO_WORK Zone 하나 / 따로 = 탭마다 구좌 하나 (같은 묶음 열쇠 gk로 다시 묶을 수 있음)
function splitGroup(id) {
  const i = rows.findIndex(r => r.id === id), g = rows[i]; if (!g?.tabs) return;
  // 탭마다 구좌 하나: 그 탭의 상품 칸은 새 구좌로 간다 (carry)
  rows.splice(i, 1, ...g.tabs.map(t => ({ id: uid(), name: t.label, layout: g.layout, why: '', kind: g.kind, gk: g.gk, gname: g.name, carry: [{ sid: g.id, tabId: t.tabId }] })));
}
function mergeGroup(gk) {
  const parts = rows.filter(r => r.gk === gk && !r.tabs); if (parts.length < 2 || parts.length > TAB_MAX) return;
  const at = rows.indexOf(parts[0]), tabs = parts.map(p => ({ tabId: tid(), label: String(p.name).slice(0, 40) }));
  const merged = { id: uid(), name: parts[0].gname || `${parts[0].kind}별 추천`, layout: parts[0].layout, why: '', kind: parts[0].kind, tabs, gk,
    carry: parts.map((p, j) => ({ sid: p.id, toTab: tabs[j].tabId })) };   // 구좌마다 탭 하나: 그 구좌의 상품 칸은 그 탭으로
  rows = rows.filter(r => !parts.includes(r)); rows.splice(at, 0, merged);
}

function renderCands() {
  const list = shown(), box = $('#cands');
  box.className = `cands n${list.length}`;
  $('#candCap').textContent = COMP_LIVE && AI_LIVE ? `이 기획안의 브리프(분류·키워드·메인 카피)와 수집한 레퍼런스로 ${list.length}개를 만들었어요` : COMP_LIVE ? `이 기획안의 브리프(분류·키워드·메인 카피)와 PROMO_WORK 지난 행사로 ${list.length}개를 만들었어요` : `브리프(분류·키워드·메인 카피)와 레퍼런스로 ${list.length}개를 만들었어요`;
  box.innerHTML = list.map(c => {
    return `<article class="cand n${list.length}" ${chosen === c.id ? 'aria-current="true"' : ''} aria-labelledby="c${c.id}">
      <div class="head"><span class="letter">${c.id}</span><div class="grow"><h3 id="c${c.id}">${esc(c.title)}</h3><p class="cap">${esc(basisOf(c))}</p></div>${headTag(c)}</div>
      <p class="why">${esc(c.why)}</p>
      <div class="body">${visual(c)}<ol>${c.secs.map(s => `<li>${cardLine(c, s)}</li>`).join('')}</ol></div>
      <div class="facts2">
        <div class="match" aria-label="이번 브리프와 겹치는 것">${c.match.map(([t, on]) => `<span class="mt ${on ? 'on' : ''}">${on ? '' : '<span class="sr-only">겹치지 않음: </span>'}${esc(t)}</span>`).join('')}</div>
        <p class="glance">${glance(c)}</p></div>
      <div class="acts">
        ${c.type === 'single' ? `<button class="btn sm" data-orig="${c.page}">원본 페이지 보기</button>` : c.type === 'mix' ? `<button class="btn sm" data-src="${c.id}">출처 보기</button>` : ''}
        <button class="btn sm ${chosen === c.id ? '' : 'primary'}" data-choose="${c.id}">${chosen === c.id ? '고른 구성안' : '이 구성 고르기'}</button>
      </div></article>`;
  }).join('');
}

function renderEdit() {
  const body = $('#editBody');
  if (!chosen) {
    $('#editCap').textContent = '구성안을 고르면 여기서 순서와 이름을 고쳐요';
    body.innerHTML = '<div class="empty-pick">위 추천 구성안 중 하나를 골라 주세요. 빈 페이지에서 시작할 수도 있어요.</div>';
    $('#nextBtn').disabled = true; $('#pv').innerHTML = ''; return;
  }
  const c = CANDS.find(x => x.id === chosen);
  $('#editCap').textContent = c ? `${c.id} ${c.title}에서 시작했어요 · 끌거나 ↑↓로 순서를 바꿔요` : '빈 페이지에서 시작했어요';
  $('#nextBtn').disabled = !rows.length;
  body.innerHTML = `<ol class="rows" id="rowList">${rows.map((r, i) => `<li class="r ${sel === r.id ? 'on' : ''}" data-id="${r.id}" draggable="true">
      <button class="handle" aria-label="${esc(r.name)} 옮기기 (Alt+↑↓)" title="끌어서 옮기기">⋮⋮</button>
      <span class="no">${i + 1}</span>
      <input type="text" class="name-in" data-f="name" value="${esc(r.name)}" maxlength="40" aria-label="${i + 1}번 구좌 이름">
      <select data-f="layout" aria-label="${i + 1}번 구좌 종류">${Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}" ${r.layout === k ? 'selected' : ''}>${v}</option>`).join('')}${r.layout === 'custom' ? '<option value="custom" selected>레퍼런스 구조</option>' : ''}</select>
      <input type="text" class="why-in" data-f="why" value="${esc(r.why)}" maxlength="80" placeholder="이 구좌를 넣은 이유 (선택)" aria-label="${i + 1}번 구좌를 넣은 이유">
      <span class="tools"><button class="ib" data-mv="-1" ${i ? '' : 'disabled'} aria-label="위로">↑</button><button class="ib" data-mv="1" ${i < rows.length - 1 ? '' : 'disabled'} aria-label="아래로">↓</button>
        ${TAB_LAYOUTS.includes(r.layout) && !r.tabs && !r.gk ? `<button class="ib wide" data-tsplit aria-label="${esc(r.name)} 탭으로 나누기" title="가격대·취향처럼 상품을 탭으로 나눠요">탭 나누기</button>` : ''}
        <button class="ib" data-del aria-label="${esc(r.name)} 삭제">✕</button></span>${groupLine(r, i)}</li>`).join('')}</ol>
    <div class="addrow"><button class="btn sm" id="addBtn">+ 구좌 추가</button><button class="btn sm" id="addTabBtn">+ 탭 구좌 추가</button><span class="cap">${rows.length}개 구좌</span></div>
    <datalist id="kindList"><option value="가격대"><option value="취향·테마"><option value="카테고리"><option value="탭"></datalist>`;
  $('#pv').innerHTML = rows.length ? wire(rows, true) : '<p class="cap">구좌가 없어요</p>';
}
// 묶음 줄: 탭 구좌면 진열 유형·탭 이름 고치기·추가·지우기·없애기 + [탭 하나로|따로 구좌로] / 따로 둔 묶음은 첫 구좌에만 바꾸기
function groupLine(r, i) {
  if (!r.gk) return '';
  const first = !r.tabs && rows.findIndex(x => x.gk === r.gk) === i, parts = rows.filter(x => x.gk === r.gk && !x.tabs).length;
  if (!r.tabs && !first) return `<div class="grp"><span class="tag">${esc(r.kind)}</span><span class="cap">'${esc(r.gname)}' 묶음에서 나눈 구좌</span></div>`;
  const seg = `<span class="gseg" role="group" aria-label="${esc(r.tabs ? r.name : r.gname)} 보여주는 방식">
      <button data-group="tab" data-gk="${r.gk}" aria-pressed="${!!r.tabs}" ${!r.tabs && parts < 2 ? 'disabled title="남은 구좌가 하나라 묶을 수 없어요"' : !r.tabs && parts > TAB_MAX ? `disabled title="탭은 ${TAB_MAX}개까지예요"` : ''}>탭 하나로</button>
      <button data-group="split" data-gk="${r.gk}" data-gid="${r.id}" aria-pressed="${!r.tabs}">따로 구좌로</button></span>`;
  if (!r.tabs) return `<div class="grp"><span class="tag">${esc(r.kind)}</span>${seg}<span class="cap">'${esc(r.gname)}' 묶음을 구좌 ${parts}개로 나눴어요</span></div>`;
  const n = r.tabs.length;
  const chips = r.tabs.map((t, j) => `<span class="tchip"><input type="text" data-tlabel="${t.tabId}" value="${esc(t.label)}" maxlength="40" aria-label="${esc(r.name)} ${j + 1}번 탭 이름"><button class="ib" data-tdel="${t.tabId}" ${n <= TAB_MIN ? 'disabled title="탭은 2개 이상이어야 해요"' : ''} aria-label="${esc(t.label)} 탭 지우기">✕</button></span>`).join('');
  return `<div class="grp"><input type="text" class="kind-in" data-tkind value="${esc(r.kind || '')}" list="kindList" maxlength="20" placeholder="진열 유형" aria-label="${esc(r.name)} 진열 유형">${seg}
    <span class="tchips">${chips}</span><button class="btn xs" data-tadd ${n >= TAB_MAX ? 'disabled' : ''}>+ 탭</button><button class="btn xs" data-tdrop>탭 없애기</button>
    <span class="cap">탭 하나가 PROMO_WORK 칸 하나${r.tnote ? ` · ${esc(r.tnote)}` : ''}</span></div>`;
}
function render() {
  renderCands(); renderEdit(); Cap.lazy($('#cands'));
  $$('.demo .seg [data-n]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.n === n));
  $$('.demo [data-pair]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pair === pair));
  $('#pairSeg').hidden = n !== 2;
}

// ---------------- 동작 ----------------
let dirty = false;   // 고른 구성을 고쳤는지 (다른 안을 고를 때 덮어쓰기 확인)
function choose(id) {
  if (chosen && chosen !== id && dirty && !confirm('고친 구성이 있어요. 다른 구성안으로 바꿀까요? (고친 내용은 사라져요)')) return;
  if (AI_LIVE && id !== 'blank') v2api('/api/am/ai/feedback', { event: 'pick_cand', doc_id: PLAN.id || '', cand_id: id }).catch(() => {});   // 어떤 추천안을 골랐는지 기록 (화면 변화 없음)
  chosen = id; rows = id === 'blank' ? [{ id: uid(), name: '메인 비주얼', layout: 'hero', why: '' }] : toRows(CANDS.find(c => c.id === id));
  sel = null; dirty = false; render();
  $('#editH').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function move(id, d) {
  const i = rows.findIndex(r => r.id === id), j = i + d; if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]]; dirty = true; sel = id; renderEdit();
  $(`.r[data-id="${id}"] .handle`)?.focus();
}
document.addEventListener('click', e => {
  const t = e.target;
  const nb = t.closest('.demo .seg [data-n]');
  const pb = t.closest('.demo [data-pair]');
  if (nb || pb) {
    if (nb) n = +nb.dataset.n; if (pb) pair = pb.dataset.pair;
    if (chosen && chosen !== 'blank' && !shown().some(c => c.id === chosen)) { chosen = null; rows = []; }
    render(); return;
  }
  const ch = t.closest('[data-choose]'); if (ch) { choose(ch.dataset.choose); return; }
  const og = t.closest('[data-orig]'); if (og) { openOrig(og.dataset.orig, og.dataset.mark); return; }
  const sr = t.closest('[data-src]'); if (sr) { openSources(sr.dataset.src); return; }
  const gb = t.closest('[data-group]');
  if (gb) {
    if (gb.getAttribute('aria-pressed') === 'true') return;
    if (gb.dataset.group === 'split') splitGroup(gb.dataset.gid); else mergeGroup(gb.dataset.gk);
    dirty = true; sel = null; renderEdit(); return;
  }
  const r = t.closest('.r');
  if (r) {
    const id = r.dataset.id;
    if (t.closest('[data-mv]')) { move(id, +t.closest('[data-mv]').dataset.mv); return; }
    if (t.closest('[data-del]')) { rows = rows.filter(x => x.id !== id); dirty = true; if (sel === id) sel = null; renderEdit(); return; }
    // 탭 구좌 (plans/28). 지운 탭·없앤 탭의 상품 칸은 저장할 때 첫 탭·한 구좌로 모인다 (toSections)
    const row = rows.find(x => x.id === id), tb = t.closest('[data-tsplit],[data-tadd],[data-tdel],[data-tdrop]');
    if (row && tb) {
      if (tb.hasAttribute('data-tsplit')) { Object.assign(row, { kind: '탭', tabs: newTabs(), gk: uid() }); toast('탭 2개로 나눴어요. 탭 이름을 적어 주세요. 지금 상품은 첫 탭에 있어요'); }
      else if (tb.hasAttribute('data-tadd')) { if (row.tabs.length >= TAB_MAX) return; row.tabs.push(...newTabs([`탭 ${row.tabs.length + 1}`])); }
      else if (tb.dataset.tdel) { if (row.tabs.length <= TAB_MIN) return; row.tabs = row.tabs.filter(x => x.tabId !== tb.dataset.tdel); toast('탭을 지웠어요. 그 탭의 상품은 첫 탭으로 옮겨요'); }
      else { dropTabs(row); toast('탭을 없앴어요. 모든 탭의 상품을 이 구좌에 모아요'); }
      dirty = true; sel = id; renderEdit();
      const focus = tb.hasAttribute('data-tadd') ? `[data-tlabel="${row.tabs[row.tabs.length - 1].tabId}"]` : tb.hasAttribute('data-tsplit') ? `[data-tlabel="${row.tabs[0].tabId}"]` : `.r[data-id="${id}"] .name-in`;
      $(focus)?.select?.(); return;
    }
    if (sel !== id) { sel = id; $$('.r').forEach(x => x.classList.toggle('on', x.dataset.id === id)); $('#pv').innerHTML = wire(rows, true); }
  }
  if (t.closest('#addBtn')) { const nr = { id: uid(), name: '새 구좌', layout: 'grid2', why: '' }; rows.push(nr); sel = nr.id; dirty = true; renderEdit(); $(`.r[data-id="${nr.id}"] .name-in`)?.select(); }
  if (t.closest('#addTabBtn')) { const nr = { id: uid(), name: '탭별 추천', layout: 'grid2', why: '', kind: '탭', tabs: newTabs(), gk: uid() }; rows.push(nr); sel = nr.id; dirty = true; renderEdit(); $(`.r[data-id="${nr.id}"] .name-in`)?.select(); }
});
$('#blankBtn').addEventListener('click', () => choose('blank'));
$('#editBody').addEventListener('input', e => {
  const el = e.target, r = rows.find(x => x.id === el.closest('.r')?.dataset.id); if (!r) return;
  if (el.dataset.tlabel) { const tb = r.tabs?.find(x => x.tabId === el.dataset.tlabel); if (tb) tb.label = el.value.slice(0, 40); }
  else if (el.hasAttribute('data-tkind')) r.kind = el.value.slice(0, 20);
  else if (el.dataset.f === 'layout' && r.tabs && !TAB_LAYOUTS.includes(el.value)) {
    // 상품 탭을 쓰지 않는 종류로 바꾸면 탭을 없앤다 (plans/28 2장)
    if (!confirm(`'${r.name}'에는 탭이 ${r.tabs.length}개 있어요. ${LAYOUTS[el.value]}(으)로 바꾸면 탭을 없애고 상품은 한 구좌로 모아요. 바꿀까요?`)) { el.value = r.layout; return; }
    r.layout = el.value; dropTabs(r); dirty = true; renderEdit(); return;
  }
  else if (el.dataset.f) {
    r[el.dataset.f] = el.value;
    if (el.dataset.f === 'layout') { dirty = true; renderEdit(); $(`.r[data-id="${r.id}"] select[data-f="layout"]`)?.focus(); return; }   // [탭 나누기] 보이기·숨기기
  }
  else return;
  dirty = true; $('#pv').innerHTML = wire(rows, true);
});
$('#editBody').addEventListener('keydown', e => {
  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  const r = e.target.closest('.r'); if (!r) return; e.preventDefault(); move(r.dataset.id, e.key === 'ArrowUp' ? -1 : 1);
});
// 끌어서 순서 바꾸기
let dragId = null;
$('#editBody').addEventListener('dragstart', e => { const r = e.target.closest('.r'); if (!r) return; dragId = r.dataset.id; r.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
$('#editBody').addEventListener('dragover', e => { const r = e.target.closest('.r'); if (!r || !dragId) return; e.preventDefault(); $$('.r').forEach(x => x.classList.toggle('over', x === r && x.dataset.id !== dragId)); });
$('#editBody').addEventListener('dragend', () => { dragId = null; $$('.r').forEach(x => x.classList.remove('drag', 'over')); });
$('#editBody').addEventListener('drop', e => {
  const r = e.target.closest('.r'); if (!r || !dragId) return; e.preventDefault();
  const from = rows.findIndex(x => x.id === dragId), item = rows.splice(from, 1)[0];
  rows.splice(rows.findIndex(x => x.id === r.dataset.id), 0, item); dirty = true; sel = dragId; dragId = null; renderEdit();
});
$('#nextBtn').addEventListener('click', () => { if (!PLAN.id) { toast(`예시예요: ${rows.length}개 구좌로 구좌 편집 화면으로 넘어가요`); return; } PLAN.flush().then(() => location.assign(`/v2/editor?id=${PLAN.id}`)); });

// 원본 프로모션 전체 페이지 (1): 그 안의 구좌 하나하나가 원본 구좌 레퍼런스 (2)
// mark = 이번 구성안이 가져온 원본 구좌 (출처 보기에서 열었을 때 표시)
function openOrig(pageKey, mark) {
  const p = PAGES[pageKey]; if ($('#srcDlg').open) $('#srcDlg').close();
  $('#origH').textContent = p.name;
  if (p.cap) {   // 수집해 둔 화면이 있으면 원본 모양 그대로 + 가져온 구좌 위치 강조
    $('#origSub').textContent = `${p.from} · 수집 당시 모습 그대로예요. 초록 실선 박스가 이번 구성에 가져온 구좌예요 (이미지는 파일을 저장하지 않아 회색 칸)`;
    $('#origNote').textContent = '';
    const sx = mark ? CANDS.flatMap(k => k.secs).map(s => s[3]).find(g => g?.src && g.src[0] === pageKey && g.src[1] === mark)?.sx : null;
    Cap.whole($('#origBody'), pageKey, p.layout, mark, sx);
    $('#origDlg').showModal(); return;
  }

  $('#origSub').textContent = p.zones ? `${p.from}${p.period ? ` · ${p.period}` : ''} · PROMO_WORK 카테고리명(진열 칸)을 행 순서대로 늘어놓았어요` : `${p.from}${p.period ? ` · ${p.period}` : ''} · 실제로 걸렸던 페이지 한 장 전체예요`;
  $('#origBody').innerHTML = p.secs.map((nm, i) => `<div class="oseg ${nm === mark ? 'used' : ''}"><div class="t"><span class="grow">${i + 1}. ${esc(nm)}</span>
      ${nm === mark ? '<span class="tag real">이번 구성에 가져온 구좌</span>' : ''}<span class="tag">${p.zones ? `진열 칸 · 상품 ${p.zones[i]?.count ?? '-'}개` : '원본 구좌 레퍼런스'}</span></div>
    <div class="ph" aria-hidden="true" data-h="${i === 0 ? 120 : 64}"></div></div>`).join('');
  $$('#origBody .ph').forEach(x => { x.style.height = `${x.dataset.h}px`; });
  $('#origNote').textContent = p.zones ? '페이지 캡처는 아직 없어서, 그 행사 할인 행의 카테고리명(진열 칸) 순서로 보여요. 같은 유형·같은 칸 수의 진열 칸은 한 구좌 안 탭이었을 가능성이 높아 묶었어요 (추정).' : '캡처를 연결하기 전이라 빗금 자리로 보여요. 각 칸(원본 구좌 레퍼런스)은 다음 화면 구좌 편집에서 참고로 붙이거나 레이아웃을 가져올 수 있어요.';
  $('#origDlg').showModal();
  if (mark) $('#origBody .used')?.scrollIntoView({ block: 'center' });
}
// 출처 보기 (조합 안): 우리 구좌 ← 가져온 원본 구좌 레퍼런스 (2) ← 원본 프로모션 전체 페이지 (1)
function openSources(id) {
  const c = CANDS.find(x => x.id === id), list = srcList(c);
  $('#srcH').textContent = `${c.id} ${c.title}`;
  $('#srcBody').innerHTML = `<table class="srct"><thead><tr><th>우리 구좌</th><th>가져온 원본 구좌 레퍼런스</th><th>출처: 원본 프로모션 전체 페이지</th><th></th></tr></thead><tbody>${c.secs.map(([nm, , , g], i) => {
    if (!g?.src) return `<tr><td>${i + 1}. ${esc(nm)}</td><td class="cap">레퍼런스 없이 규칙으로 넣었어요</td><td></td><td></td></tr>`;
    const k = list.indexOf(g.src), p = PAGES[g.src[0]];
    const r = SEC_R[g.src[1]] || [3, 4];
    return `<tr><td>${i + 1}. ${esc(nm)}</td><td><span class="sth ${capOf(g.src) ? 'cap' : ''}">${capOf(g.src) || demoImg(r[0], r[1], '')}<b>${NUM[k]}</b></span> ${esc(g.src[1])}</td>
      <td><span class="tag ${p.from === '자사몰' ? 'real' : ''}">${p.from}</span> ${esc(p.name)}</td>
      <td><button class="btn sm" data-orig="${g.src[0]}" data-mark="${esc(g.src[1])}">전체 페이지 보기</button></td></tr>`;
  }).join('')}</tbody></table>`;
  $('#srcDlg').showModal();
  Cap.lazy($('#srcBody'));
}


// ---------- 추천 구성안을 이 기획안으로 (실제) ----------
// A = 분류·고른 키워드·메인 카피로 만든 규칙 틀 / B = PROMO_WORK 지난 상시 할인 중 명분 단어·시기가 가장 가까운 행사의 진열 칸(카테고리명) 순서
// C = 레퍼런스 조합: 레퍼런스 라이브러리가 아직 예시라 예시로 남김 (그렇다고 표시)
const CLS_N = { season: '시즌', brand: '브랜드기획전', launch: '런칭', collab: '콜라보', clear: '클리어런스' };
const Z_RULES = [['요일', /^[월화수목금토일]\s/], ['가격대', /만\s*원|원\s*이상|원대|가격대/], ['혜택 방식', /혜택|균일가|할인|쿠폰|\d\s*\+\s*\d|정율|정액|페이백|사은품|%/], ['', /^\d+$|가이드\s*\d+$|ROOM$|\s0\d$/i],
  ['포장·구성', /보자기|쇼핑백|보틀|\d+\s*입$|PRESTIGE|패키지/i], ['큐레이션', /인기|재구매|리뷰|후기|급상승|새로|NEW|베스트|BEST|순위|카트|트렌디|같이\s*구매|핫템/i],
  ['차 종류', /말차|허브|블렌디드|녹차|발효차|잎차|콤부|콜드브루|밀크티|티푸드|티웨어|아이스티|그린티|티세트|디저트|스프레드|비스코티|초콜릿|랑드샤|스킨케어/], ['취향·테마', /달콤|은은|무카페인|다양|하절|리추얼|티타임|민트|선물/]];   // 예전 화면 sources/zones.js와 같은 규칙
const zKind = n => (Z_RULES.find(([, re]) => re.test(n)) || [''])[0];
const layoutFor = n => (n % 3 === 0 || n === 5) && n !== 6 ? 'grid3' : 'grid2';
function zoneUnits(items) {   // 행 순서대로 진열 칸 → 같은 유형·같은 칸 수 2개 이상은 탭 묶음 (zones.js units와 같음)
  const m = new Map(), list = items.some(x => Number.isFinite(x.row)) ? [...items].sort((x, y) => (x.row ?? 1e9) - (y.row ?? 1e9)) : items;   // 원천 행 순서 = 진열 순서
  list.forEach(x => { const z = String(x.zone || '').trim(); if (!z || z === '-' || /미노출/.test(z)) return; m.set(z, (m.get(z) || 0) + 1); });
  const zones = [...m].map(([name, count]) => ({ name, count, kind: zKind(name) })), key = z => z.kind ? `${z.kind}|${z.count}` : null, size = new Map(), out = [], at = new Map();
  zones.forEach(z => { const k = key(z); if (k) size.set(k, (size.get(k) || 0) + 1); });
  zones.forEach(z => { const k = key(z); if (k && size.get(k) >= 2) { if (at.has(k)) { out[at.get(k)].zones.push(z); return; } at.set(k, out.length); out.push({ kind: z.kind, zones: [z], group: true }); } else out.push({ kind: z.kind, zones: [z], group: false }); });
  return { zones, units: out };
}
const words = t => String(t || '').split(/[\s,·/()]+/).map(w => w.replace(/^\d+/, '')).filter(w => w.length >= 2);
async function pastCand(doc) {
  const rv = await v2api('/api/review').catch(() => null);
  const ws = (rv?.waves || []).filter(w => w.type === '상시' && w.status === '완료'), ref = doc.brief?.period?.start || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const ks = [...words(doc.brief?.myeongbun), ...words(doc.v2?.seed), ...(doc.v2?.keywords || []), ...words(doc.title)];
  const ranked = ws.map(w => { const hit = ks.find(x => String(w.promo || '').replace(/\s/g, '').includes(x.replace(/\s/g, ''))), d = Math.abs(+ref.slice(5, 7) - +String(w.start).slice(5, 7)), md = Math.min(d, 12 - d);
    return { w, hit, md, k: (hit ? 100 : 0) + (md <= 1 ? 30 : md <= 2 ? 10 : 0) }; }).sort((a, b) => b.k - a.k || String(b.w.start).localeCompare(String(a.w.start))).slice(0, 6);
  for (const c of ranked) {
    const d = await v2api(`/api/review/wave?key=${encodeURIComponent(c.w.key)}`).catch(() => null);
    const { zones, units } = zoneUnits(d?.items_detail || []);
    if (zones.length < 2) continue;
    const per = `${String(c.w.start).slice(0, 10).replace(/-/g, '.')}~${String(c.w.end).slice(5, 10).replace('-', '.')}`;
    PAGES.past = { name: c.w.promo, from: '자사몰', period: per, r: [9, 16], secs: zones.map(z => z.name), zones };
    const secs = [['메인 비주얼', 'hero', '명분과 메인 카피를 첫 화면에 크게']].concat(units.map(u => u.group
      ? [`${u.kind}별 추천`, layoutFor(u.zones[0].count), `지난 행사에서 '${u.kind}' 진열 칸 ${u.zones.length}개를 탭으로 쓴 것 같아요 (칸마다 상품 ${u.zones[0].count}개)`, { kind: u.kind, tabs: u.zones.map(z => z.name.slice(0, 40)), note: '지난 행사에서 추정' }]
      : [u.zones[0].name.slice(0, 40), layoutFor(u.zones[0].count), `지난 행사 진열 칸 · 상품 ${u.zones[0].count}개`]));
    return { id: 'B', type: 'single', page: 'past', title: `지난 '${c.w.promo}'처럼`, why: `PROMO_WORK 지난 상시 할인 '${c.w.promo}'의 진열 칸(카테고리명)을 행 순서대로 옮겼어요`,
      match: [[c.hit ? `같은 말: ${c.hit}` : '같은 명분 단어', !!c.hit], ['비슷한 시기', c.md <= 1], [`할인 행 ${c.w.rows}개`, true]], secs: secs.slice(0, 12) };
  }
  return null;
}
function renderBriefSummary(doc) {
  const b = doc.brief || {}, period = b.period || {};
  const dateLabel = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '미정';
    const date = new Date(`${value}T00:00:00`);
    return `${date.getMonth()+1}/${date.getDate()}(${'일월화수목금토'[date.getDay()]})`;
  };
  $('#briefClass').textContent = CLS_N[doc.v2?.cls] || '분류 미정';
  $('#briefPeriod').textContent = period.start || period.end ? `${dateLabel(period.start)} ~ ${dateLabel(period.end)}` : '기간 미정';
  $('#briefKeywords').textContent = (doc.v2?.keywords || []).join(' · ') || '선택한 키워드 없음';
  $('#briefCopy').textContent = b.key_copy || '메인 카피 미정';
}
let COMP_LIVE = false, AI_LIVE = false;
// 구좌 구성 AI (서버 /api/am/ai/compose): 브리프 → A 규칙형, C 레퍼런스 조합 + 원본 페이지(PAGES). 실패·색인 없음(mode≠ai)이면 false를 돌려 지금 로직을 그대로 쓴다
async function applyAi(doc) {
  try {
    const r = await v2api('/api/am/ai/compose', { doc: { id: doc.id || '', title: doc.title || '', brief: doc.brief || {}, v2: { cls: doc.v2?.cls || '', seed: doc.v2?.seed || '', keywords: doc.v2?.keywords || [] } }, per_section: 1 });
    if (r.mode !== 'ai') return false;
    Object.assign(PAGES, r.pages || {});
    for (const c of r.candidates || []) { const i = CANDS.findIndex(x => x.id === c.id); if (i >= 0) CANDS[i] = c; else CANDS.push(c); }
    return true;
  } catch (e) { return false; }
}
async function buildLive(doc) {
  const kw = (doc.v2?.keywords || [])[0] || doc.v2?.seed || doc.brief?.myeongbun || '', cls = CLS_N[doc.v2?.cls] || '분류 미정', base = CANDS.find(c => c.id === 'A');
  COPY = doc.brief?.key_copy || doc.brief?.myeongbun || doc.title || '';
  renderBriefSummary(doc);
  Object.assign(base, { title: `${cls} 기본형`, why: `${cls} 프로모션의 기본 틀에 고른 키워드를 넣었어요`, basis: `분류: ${cls}`,
    match: [[`같은 분류: ${cls}`, !!doc.v2?.cls], [`키워드: ${kw || '없음'}`, !!kw], ['메인 카피', !!doc.brief?.key_copy]],
    secs: [['메인 비주얼', 'hero', '명분과 메인 카피를 첫 화면에 크게'], ...(doc.v2?.keywords || []).slice(0, 2).map(k => [`${k} 추천`, 'grid2', `고른 키워드 '${k}'에 맞는 상품`]),
      ...(kw && !(doc.v2?.keywords || []).length ? [[`${kw} 추천`, 'grid2', `'${kw}'에 맞는 상품`]] : []), ['하루특가', 'deal-banner', '날짜마다 바뀌는 특가로 다시 찾게'], ['혜택 안내', 'benefit', '쿠폰·사은품 같은 혜택을 한곳에']] });
  const past = await pastCand(doc), bi = CANDS.findIndex(c => c.id === 'B');
  if (past) CANDS[bi] = past; else CANDS.splice(bi, 1);
  const mix = CANDS.find(c => c.id === 'C');
  if (mix) Object.assign(mix, { title: '레퍼런스 조합 추천 (예시)', why: '레퍼런스 라이브러리가 아직 예시예요. 연결되면 실제 페이지의 구좌를 골라 이어요. 지금은 구성 모양만 참고하세요' });
  AI_LIVE = await applyAi(doc);   // 서버 AI가 준비돼 있으면 A·C를 그 결과로 바꾼다. 아니면 위 예시 그대로
  COMP_LIVE = true; n = 3;
  document.querySelectorAll('.demo .seg, .demo > .cap').forEach(x => { x.hidden = true; });   // 목업 보기용 개수 고르기는 숨김
  const dp = document.querySelector('.demo p'); if (dp) dp.innerHTML = AI_LIVE ? '<b>이 기획안으로 만든 추천이에요.</b> A는 프로모션 유형의 필수 구좌, C는 브리프에 가까운 레퍼런스 페이지에서 구좌를 가져와 이은 구성이에요. 지난 우리 기획안이 비슷하면 D로 나와요.'
    : '<b>이 기획안으로 만든 추천이에요.</b> A는 분류·키워드 규칙, B는 PROMO_WORK 지난 행사의 진열 칸 순서예요. C(레퍼런스 조합)와 원본 페이지 캡처는 아직 예시예요.';
}

let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
render();
// ================= 기획안 잇기 (새 버전) =================
// 고른 구성 = 기획안의 page.sections. 구좌 편집에서 채운 내용(제목·문구·카드 모양 등)은 같은 구좌(id)면 그대로 남아요
let lastJ = null;
function toSections(prev) {
  const old = Object.fromEntries(((prev && prev.sections) || []).map(x => [x.sectionId, x]));
  const firstHero = rows.find(r => r.layout === 'hero');
  // 나누기·합치기로 새로 생긴 구좌는 원래 구좌의 상품 칸을 이어 받는다 (carry: 나눈 탭의 칸 / 합친 구좌의 칸 → 새 탭)
  const carried = carry => carry.flatMap(c => {
    const s = old[c.sid]; if (!s) return [];
    const f = s.tabs?.[0]?.tabId;
    return (s.slots || []).filter(sl => !c.tabId || (sl.tabId || f) === c.tabId).map(sl => ({ ...sl, tabId: c.toTab }));
  });
  return rows.map((r, i) => {
    const o = old[r.id] || (r.carry ? { slots: carried(r.carry) } : {});
    const tabs = (r.tabs || []).slice(0, TAB_MAX).map(t => { const ot = (o.tabs || []).find(x => x.tabId === t.tabId) || {};
      return { ...ot, tabId: t.tabId, label: String(t.label).slice(0, 40), zone_tag: ot.zone_tag || '' }; });
    // 칸의 탭: tabId가 없으면 이전 첫 탭. 지운 탭의 칸은 첫 탭으로, 탭을 없앴으면 탭 표시를 지우고 같은 상품은 하나로
    const ids = new Set(tabs.map(t => t.tabId)), was0 = o.tabs?.[0]?.tabId, key = c => `${c.tabId || ''}|${c.seq}`;
    const norm = (o.slots || []).map(sl => {
      const c = { ...sl }, was = sl.tabId || was0, stay = tabs.length ? ids.has(was) : !was;
      if (tabs.length) c.tabId = stay ? was : tabs[0].tabId; else delete c.tabId;
      return [c, stay];
    });
    // 한 탭(탭 없으면 구좌) 안에서 같은 상품은 하나: 원래 그 탭에 있던 칸을 남긴다 (탭별 문구 등이 있을 수 있음)
    const stayKeys = new Set(norm.filter(([c, stay]) => stay && c.seq).map(([c]) => key(c))), seen = new Set();
    const slots = norm.filter(([c, stay]) => { if (!c.seq) return true; const k = key(c); if (seen.has(k) || (!stay && stayKeys.has(k))) return false; seen.add(k); return true; }).map(([c]) => c);
    return { ...o, ...(r === firstHero ? {headline: PLAN.doc?.brief?.key_copy || ''} : {}), sectionId: r.id, order: i, name: String(r.name).slice(0, 40), layoutId: r.layout, role: String(r.why || '').slice(0, 200),
      zone_kind: String(r.kind || '').slice(0, 20), tabs, slots, v2: { ...(o.v2 || {}), gk: r.gk || '', gname: r.gname || '', tnote: r.tnote || '' } };
  });
}
function saveCompose() {
  if (!PLAN.doc || !chosen) return;   // 고른 안이 없으면 저장하지 않음 (보기 전환으로 잠깐 비어도 지우지 않게)
  const j = JSON.stringify([chosen, rows]);
  if (j === lastJ) return;
  lastJ = j;
  PLAN.save(d => { d.page = { ...(d.page || {}), sections: toSections(d.page) }; d.v2.compose = chosen; });
}
const renderEditBase = renderEdit;
renderEdit = function () { renderEditBase(); saveCompose(); };
document.addEventListener('input', () => setTimeout(saveCompose));
PLAN.ready.then(async doc => {
  if (!doc) return;
  await buildLive(doc);
  const secs = (doc.page?.sections || []).slice().sort((a, b) => a.order - b.order);
  if (!secs.length) { render(); return; }
  chosen = doc.v2.compose || 'blank';
  if (chosen !== 'blank' && !shown().some(c => c.id === chosen)) n = 3;
  rows = secs.map(x => ({ id: x.sectionId, name: x.name || x.headline || '구좌', layout: x.layoutId || 'hero', why: x.role || '',
    // 탭 출처 안내(tnote)가 없는 예전 저장본의 탭 구좌는 지난 행사(B안)에서만 생겼다
    ...(x.tabs?.length ? { kind: x.zone_kind || '탭', tabs: x.tabs.map(t => ({ tabId: t.tabId, label: t.label || '' })), gk: x.v2?.gk || uid(), tnote: x.v2?.tnote ?? '지난 행사에서 추정' }
      : x.v2?.gk ? { kind: x.zone_kind, gk: x.v2.gk, gname: x.v2.gname } : {}) }));
  uidN = Math.max(uidN, ...rows.map(r => +String(r.id).replace(/\D/g, '') || 0), ...rows.map(r => +String(r.gk || '').replace(/\D/g, '') || 0));
  lastJ = JSON.stringify([chosen, rows]);
  dirty = true;   // 저장된 구성을 다른 안으로 바꿀 때는 한 번 묻기
  render();
  toast('저장된 구성을 불러왔어요');
});
