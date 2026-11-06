// ================= 예시 기획안 (구좌 편집 목업 23과 같은 값, 가상) =================
const PLAN = { title: '봄 · 피크닉에서 누리는 차 한 잔의 여유', cls: '시즌', period: '2026-03-02(월) ~ 03-15(일)', page: '이벤트 페이지', myeongbun: '봄',
  concept: '피크닉에서 누리는 차 한 잔의 여유', copy: '피크닉 가방에 차 한 병', who: '주말 한강 피크닉을 준비하는 20~30대', keywords: ['피크닉', '보온병'] };
const PRODUCTS = {
  P101: { name: '벚꽃 블렌딩 티 10입', price: 18000, cost: 4300, after: 15300, rating: 4.8, reviews: 312 },
  P104: { name: '봄 꽃차 3종 선물 세트', price: 28000, cost: 8900, after: 25200, rating: 4.9, reviews: 509 },
  P106: { name: '말차 라떼 파우더', price: 15000, cost: 5200, after: 13500, rating: 4.8, reviews: 809 },
  P107: { name: '은은한 녹차 티백 40입', price: 22000, cost: 4800, after: 19800, rating: 4.7, reviews: 233 },
  P110: { name: '프리미엄 티 기프트 박스', price: 58000, cost: 21800, after: 52200, rating: 4.9, reviews: 420 },
};
const ITEMS = { P101: { rate: 0.2, appeal: '봄에만 만나는 벚꽃 향' }, P104: { rate: 0.15, appeal: '(재구매 1위) 받는 분도 좋아하는 꽃차' }, P106: { rate: 0.1, appeal: '' },
  P107: { rate: 0.25, appeal: '매일 마시기 좋은 기본 녹차' }, P110: { rate: 0.24, appeal: '세작부터 블렌딩까지 담은' } };
const EXTRAS = [{ name: '얼리버드', pct: 0.05, seqs: ['P110', 'P104'] }];
const REVIEWS = { v1: { seq: 'P106', rating: 5, text: '물 조금 넣고 흔든 뒤 우유에 부으면 바로 말차라떼가 돼서 출근 전에도 부담 없이 마실 수 있어요.' },
  v3: { seq: 'P104', rating: 5, text: '어머니 선물로 드렸는데 포장이 예쁘고 향이 은은하다고 좋아하셨어요.' } };
const BRIEF_MOODS = [{ name: '돗자리 위 티타임', src: '핀터레스트 보드 · 봄 피크닉', pts: ['색감', '소품'], r: [2, 3] }, { name: '연둣빛 봄 색감', src: '외부 캠페인 일부', pts: ['색감'], r: [4, 5] }];
const ON_SALE = ['img', 'label', 'pill', 'appeal', 'tag', 'name', 'list', 'first', 'pct', 'pname', 'sale'];
const ON_PRICE = ['img', 'label', 'appeal', 'tag', 'name', 'list', 'pname', 'sale'];
const c = (seq, x = {}) => ({ seq, label: '', tag: '', pill: '', copy: '', off: [], ...x });
const SECS = [
  { name: '메인 비주얼', layout: 'hero', headline: PLAN.copy, subhead: '들고 나가는 봄, 한 병의 여유', num: false, cta: null,
    refs: [{ name: '봄 캠페인 메인 비주얼', page: '○○ 봄 캠페인 · 외부', note: '상단 여백과 손글씨 느낌', r: [4, 5] }], moods: [{ name: '보온병 들고 산책', src: '핀터레스트 보드 · 아웃도어', pts: ['구도'], r: [9, 16] }], notes: '' },
  { name: '첫 잔, 벚꽃', layout: 'feat', role: '돗자리를 펴고 처음 따르는 봄 한 잔', scope: '시즌 한정 티', num: true, cta: ['시즌 한정 더보기', '시즌 한정 카테고리'], on: ON_SALE,
    cards: [c('P101', { label: 'BEST', tag: '봄 한정', pill: 'up' }), c('P104', { tag: '보자기' }), c('P106'), c(null)],
    refs: [{ name: '마중차 대표+2열', page: '가을 차회 · 자사몰', note: '대표 1 + 2×2 배치', r: [9, 16] }], moods: [], notes: '첫 카드는 돗자리 위 연출 컷이면 좋겠어요' },
  { name: '가격대별 선물 추천', layout: 'grid2', subhead: '예산에 맞춰 골라 보세요', scope: '선물 세트', num: true, cta: null, on: ON_PRICE,
    tabs: [['1만원대', [c('P107'), c(null)]], ['2만원대', [c(null), c(null)]], ['3만원 이상', [c('P110', { label: 'PRESTIGE', tag: '한정 보자기' }), c(null)]]], refs: [], moods: [], notes: '' },
  { name: '오늘의 하루특가', layout: 'deal-banner', num: false, cta: null, refs: [], moods: [], notes: '' },
  { name: '먼저 마셔 본 후기', layout: 'review', subhead: '재구매가 많은 상품의 실제 후기', num: true, cta: null, rv: [['v1', '작고 간편해서 매일 손이 가요'], ['v3', '선물로 드렸더니 좋아하셨어요']],
    refs: [{ name: '재구매 BEST 후기', page: '멤버십 리뉴얼 · 자사몰', note: '제목 + 본문 + 별점 순서', r: [16, 9] }], moods: [], notes: '' },
  { name: '피크닉 사진 인증', layout: 'ev-ugc', subhead: '우리의 봄 피크닉을 보여 주세요', num: true, cta: ['참여하기', '참여 화면 (댓글 쓰기)'],
    ev: { how: '피크닉 사진과 함께 댓글 남기기', reward: '포인트 · 추첨 50명 1,000P', pick: '추첨 50명', when: '3/2(월) ~ 3/15(일)', login: true, notice: '' }, refs: [{ name: '암호 서신 공유', page: '한글날 · 자사몰', note: '참여 버튼 크기', r: [3, 4] }], moods: [], notes: '' },
  { name: '봄맞이 혜택', layout: 'benefit', num: false, cta: ['혜택 받기', '쿠폰 받기'], refs: [], moods: [], notes: '' },
  { name: '유의사항', layout: 'notice', num: false, cta: null, refs: [], moods: [], notes: '' },
];
const LNAME = { hero: '메인 비주얼', feat: '대표 1 + 2열', grid2: '2열 상품', 'deal-banner': '날짜별 특가', review: '후기 모음', 'ev-ugc': '이벤트 · 댓글·사진 인증', benefit: '혜택 총정리', notice: '유의사항' };

// 문구 칸 합치기 (구좌 편집과 같음): 제목 = 구좌 이름 + 구좌 제목, 설명 = 역할 한 줄 + 서브 카피
SECS.forEach(s => { s.name = s.headline || s.name; s.role = s.role || s.subhead || ''; delete s.headline; delete s.subhead; });
SECS[1].lines = ['오늘 돗자리 위에 처음 따를 차를 골라 보세요'];
// ================= 가격 (구좌 편집과 같은 규칙) =================
const r10 = n => Math.round(n / 10) * 10;
const won = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const extraOf = seq => EXTRAS.find(e => e.seqs.includes(seq)) || null;
function priceOf(seq) {
  const p = PRODUCTS[seq], r = ITEMS[seq]?.rate || 0, first = r10(p.price * (1 - r)), ex = extraOf(seq), fin = ex ? r10(first * (1 - ex.pct)) : first;
  return { list: p.price, first, fin, ex, pct: Math.round((1 - fin / p.price) * 100), pname: ex ? `${ex.name}가` : r ? '할인가' : '판매가' };
}
const judgeLv = seq => { const p = PRODUCTS[seq], pr = priceOf(seq); return pr.fin >= p.price ? 'none' : p.cost / (pr.fin / 1.1) > 0.45 ? 'warn' : 'ok'; };
function pillText(cd) {
  if (cd.pill !== 'up') return '';
  const p = PRODUCTS[cd.seq], d = p.after == null ? 0 : p.after - priceOf(cd.seq).fin;
  return d > 0 ? `특가 종료 시 ${d.toLocaleString('ko-KR')}원 비싸져요` : '';
}
const cardsOf = s => s.tabs ? s.tabs.flatMap(([t, cs]) => cs.map(x => ({ ...x, tab: t }))) : (s.cards || []);
const nums = () => { let n = 0; return SECS.map(s => s.num ? ++n : 0); };

// ================= 확인할 것 =================
function checks() {
  const out = [], go = i => ({ i });   // 구좌 번호만 붙임 (글은 t에)
  SECS.forEach((s, i) => {
    cardsOf(s).forEach(cd => { if (cd.seq && judgeLv(cd.seq) === 'warn') out.push({ lv: 'warn', t: `${PRODUCTS[cd.seq].name}: 최종가 기준 원가율 주의 (판정)`, ...go(i) }); });
    const empty = cardsOf(s).filter(cd => !cd.seq).length; if (empty) out.push({ lv: 'info', t: `${s.name}: 상품 미정 카드 ${empty}개 (디자이너 기획안에 '미정'으로 보여요)`, ...go(i) });
    cardsOf(s).forEach(cd => { if (cd.seq && cd.pill === 'up' && !pillText(cd)) out.push({ lv: 'warn', t: `${PRODUCTS[cd.seq].name}: 가격 오름 예고를 계산하지 못했어요`, ...go(i) }); });
    if (s.layout === 'review') out.push({ lv: 'info', t: `${s.name}: 후기를 페이지에 써도 되는지 운영·법무 확인 필요`, ...go(i) });
    if (s.ev && !s.ev.notice) out.push({ lv: 'warn', t: `${s.name}: 이벤트 유의사항이 비어 있어요 (운영·법무 기준 확인 필요)`, ...go(i) });
    if (s.layout === 'deal-banner') out.push({ lv: 'info', t: '하루특가: 날짜별 상품은 상품·할인의 하루특가 편성 기준이에요', ...go(i) });
  });
  return out;
}
function renderChecks() {
  const cs = checks(), w = cs.filter(x => x.lv === 'warn'), n = cs.filter(x => x.lv === 'info');
  document.getElementById('chkN').textContent = `주의 ${w.length} · 알림 ${n.length}`;
  const li = x => `<li class="${x.lv}"><span class="lv">${x.lv === 'warn' ? '주의' : '알림'}</span><span>${esc(x.t)}</span><button class="go" data-go="${x.i}">구좌 보기</button></li>`;
  document.getElementById('chk').innerHTML = (w.length ? `<h3 class="chk-h">꼭 볼 것</h3><ul class="chk">${w.map(li).join('')}</ul>` : '<ul class="chk"><li class="ok"><span class="lv">✓</span><span>꼭 볼 것이 없어요</span></li></ul>')
    + (n.length ? `<h3 class="chk-h">알아 두기</h3><ul class="chk">${n.map(li).join('')}</ul>` : '')
    + '<p class="cap note-gap">남아 있어도 내보낼 수 있어요. 내보낼 때 한 번 더 알려 드려요.</p>';
}

// ================= 디자이너 기획안 =================
// 카드 글(상품명·가격 등)은 카드 문구표에 있으니, 여기서는 페이지 구성과 구좌별 요소가 잘 보이게 한다
function demoImg(w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 40}" height="${h * 40}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#f3f3f3"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#p)"/><rect x="0.5" y="0.5" width="${w * 40 - 1}" height="${h * 40 - 1}" fill="none" stroke="#dedede"/></svg>`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="">`;
}
const EL_NAME = { img: '이미지', label: '라벨', pill: '알약', appeal: '소구문구', tag: '[태그]', name: '상품명', list: '정가', first: '1단 가격', pct: '할인율', pname: '가격 이름', sale: '판매가', rating: '별점', review: '후기 한 줄', copy: '카드 문구', btn: '버튼' };
const nn = (s, i) => s.num ? String(nums()[i]).padStart(2, '0') : '';

// 전체 와이어프레임 (왼쪽, 늘 보임): 구좌마다 이름표 + 모양. 누르면 그 구좌로
function overview(cur = -1) {
  const shape = s => {
    if (s.layout === 'hero') return '<span class="ov-hero"></span>';
    if (s.layout === 'feat') return '<span class="ov-grid g2"><span class="w2"></span><span></span><span></span><span></span><span></span></span>';
    if (s.layout === 'grid2') return `${s.tabs ? '<span class="ov-tabs"><i></i><i></i><i></i></span>' : ''}<span class="ov-grid g2"><span></span><span></span></span>`;
    if (s.layout === 'deal-banner') return '<span class="ov-grid g4"><span></span><span></span><span></span><span></span></span>';
    if (s.layout === 'review') return '<span class="ov-lines"><i></i><i></i></span>';
    if (s.ev) return '<span class="ov-box"></span>';
    if (s.layout === 'benefit') return '<span class="ov-lines y"><i></i><i></i><i></i></span>';
    return '<span class="ov-lines"><i></i><i></i></span>';
  };
  return `<div class="ov">${SECS.map((s, i) => `<button class="ov-s ${i === cur ? 'on' : ''}" data-jump="${i}"><span class="ov-n">${nn(s, i) || '·'} ${esc(s.name)}</span>${shape(s)}${s.cta ? '<span class="ov-bt"></span>' : ''}</button>`).join('')}</div>`;
}

// 구좌 와이어프레임 (크게): 실제 문구(제목·설명·추가 문구·버튼) + 요소 자리 이름표. 카드 칸에는 카드 모양(요소 순서)만
function secWire(s, i) {
  const head = s.layout === 'hero' ? '' : `${s.num ? `<span class="sw-num">${nn(s, i)}</span>` : ''}<span class="sw-title">${esc(s.name)}</span>${s.role ? `<span class="sw-desc">${esc(s.role)}</span>` : ''}${(s.lines || []).map(l => `<span class="sw-desc">${esc(l)}</span>`).join('')}`;
  const cardFrame = (big = false) => `<span class="sw-card ${big ? 'big' : ''}"><span class="sw-img">이미지${s.on.includes('label') ? '<b>라벨</b>' : ''}</span>${s.on.filter(k => !['img', 'label', 'tag', 'pct', 'pname'].includes(k)).map(k => k === 'name' && s.on.includes('tag') ? '[태그] 상품명' : k === 'sale' ? [s.on.includes('pct') && '할인율', s.on.includes('pname') && '가격 이름', '판매가'].filter(Boolean).join(' · ') : EL_NAME[k]).map(t => `<span class="sw-el">${t}</span>`).join('')}</span>`;
  let body = '';
  if (s.layout === 'hero') body = `<span class="sw-hero"><span class="sw-tag">메인 비주얼 이미지</span><span class="sw-title">${esc(s.name)}</span>${s.role ? `<span class="sw-desc">${esc(s.role)}</span>` : ''}</span>`;
  else if (s.on) {
    const n = cardsOf(s).length, tabs = s.tabs ? `<span class="sw-tabs">${s.tabs.map(([t], j) => `<span class="${j ? '' : 'on'}">${esc(t)}</span>`).join('')}</span>` : '';
    const per = s.tabs ? s.tabs[0][1].length : n;
    body = `${tabs}<span class="sw-grid ${s.layout === 'feat' ? 'feat' : 'g2'}">${Array.from({ length: per }, (_, j) => cardFrame(s.layout === 'feat' && j === 0)).join('')}</span>`;
  } else if (s.layout === 'deal-banner') body = '<span class="sw-dates"><span class="on">3/2</span><span>3/3</span><span>3/4</span><span>…</span></span><span class="sw-grid g2"><span class="sw-card"><span class="sw-img">이미지</span><span class="sw-el">상품명</span><span class="sw-el">할인율 · 판매가</span></span><span class="sw-card"><span class="sw-img">이미지</span><span class="sw-el">상품명</span><span class="sw-el">할인율 · 판매가</span></span></span><span class="sw-note">날짜마다 바뀌어요 · 상품은 하루특가 편성표</span>';
  else if (s.rv) body = `<span class="sw-rv">${s.rv.map(([id, title]) => { const v = REVIEWS[id]; return `<span class="sw-rvc"><span class="sw-img sm">상품 이미지</span><span><b>${esc(title)}</b><span class="sw-q">${esc(v.text.length > 44 ? v.text.slice(0, 44) + '…' : v.text)}</span><span class="sw-el">★ 별점 · 상품명</span></span></span>`; }).join('')}</span>`;
  else if (s.ev) body = `<span class="sw-ev"><span class="sw-el">참여 방법: ${esc(s.ev.how)}</span><span class="sw-el">보상: ${esc(s.ev.reward)}</span><span class="sw-el">기간: ${esc(s.ev.when)}</span></span>`;
  else if (s.layout === 'benefit') body = '<span class="sw-lines y"><span>혜택 1</span><span>혜택 2</span><span>혜택 3</span></span>';
  else body = '<span class="sw-lines"><span>안내 글</span><span>안내 글</span></span>';
  return `<div class="sw" aria-hidden="true">${head}${body}${s.cta ? `<span class="sw-btn">${esc(s.cta[0])}</span>` : ''}</div>`;
}
const refCards = list => `<div class="refrow">${list.map(r => `<div class="refc"><span class="fr">${demoImg(r.r[0], r.r[1])}</span><b>${esc(r.name)}</b><span class="cap">${esc(r.page || r.src)}</span>${r.note ? `<span>${esc(r.note)}</span>` : ''}${r.pts ? `<span class="pts">${r.pts.join(' · ')}</span>` : ''}</div>`).join('')}</div>`;
function renderDoc() {
  const cover = `<header class="dh"><div class="overline">AMOREAD · 디자이너 기획안 · 2026-11-06</div><h2>${esc(PLAN.title)}</h2>
      <div class="facts"><span class="tag cls">${PLAN.cls}</span><span class="tag">${PLAN.period}</span><span class="tag">${PLAN.page}</span><span class="tag">구좌 ${SECS.length}개</span></div>
      <dl class="brief"><dt>컨셉</dt><dd>${esc(PLAN.concept)}</dd><dt>메인 카피</dt><dd><b>${esc(PLAN.copy)}</b></dd><dt>누구에게</dt><dd>${esc(PLAN.who)}</dd>
        <dt>추가 혜택</dt><dd>${EXTRAS.map(e => `${esc(e.name)} (할인가에서 ${Math.round(e.pct * 100)}% 더)`).join(', ')}</dd></dl>
      <div class="blk"><h4>기획안 전체 느낌</h4>${refCards(BRIEF_MOODS)}</div></header>`;
  const sec = (s, i) => {
    const t = cardTables().findIndex(x => x.s === s);
    const notes = [
      s.cta ? `<div class="nt"><span class="k">버튼</span><span>${esc(s.cta[0])} → ${esc(s.cta[1] || '어디로 미정')}</span></div>` : '',
      s.on ? `<div class="nt"><span class="k">카드</span><span>${cardsOf(s).length}칸${s.tabs ? ` · 탭 ${s.tabs.length}개 (${s.tabs.map(([x]) => esc(x)).join(', ')})` : ''} · 글은 <button class="lnk" data-view="cards">카드 문구표 ${t + 1}번</button>${cardsOf(s).some(x => !x.seq) ? ' · <span class="undef">상품 미정 있음</span>' : ''}</span></div>` : '',
      s.ev ? `<div class="nt"><span class="k">운영 조건</span><span>${esc(s.ev.pick)} · ${s.ev.login ? '로그인 필요' : '로그인 없이'} · 유의사항 ${s.ev.notice ? '있음' : '<span class="undef">미정</span>'}</span></div>` : '',
      s.rv ? '<div class="nt"><span class="k">후기</span><span>원문 그대로 · 작성자 숨김</span></div>' : '',
      s.refs.length ? `<div class="blk"><h4>참고 (원본 구좌)</h4>${refCards(s.refs)}</div>` : '',
      s.moods.length ? `<div class="blk"><h4>느낌</h4>${refCards(s.moods)}</div>` : '',
      `<div class="blk"><h4>디자인 요청</h4><textarea class="req" data-req="${i}" rows="2" placeholder="따로 부탁할 것이 없어요">${esc(s.notes)}</textarea></div>`,
    ].join('');
    return `<section class="dsec" id="dsec-${i}" aria-label="${i + 1}번 구좌"><div class="dsec-h"><span class="dn">${i + 1}</span><h3>${s.num ? `<span class="cap">${nn(s, i)}</span> ` : ''}${esc(s.name)}</h3><span class="tag">${esc(LNAME[s.layout])}</span></div>
      <div class="dsec-b">${secWire(s, i)}<div class="notes">${notes}</div></div></section>`;
  };
  document.getElementById('doc').innerHTML = `${cover}<div class="dbody"><aside class="dside"><h4>전체 와이어프레임</h4>${overview()}<p class="cap">누르면 그 구좌로 가요</p></aside><div class="dmain">${SECS.map(sec).join('')}</div></div>`;
}

// 페이지 와이어프레임 (따로 내보내는 파일): 메모 없이 페이지 하나로. 구좌 사이 경계만 얇게
function renderPage() {
  document.getElementById('doc').innerHTML = `<header class="dh"><div class="overline">페이지 와이어프레임 · 따로 내보내는 파일이에요</div><h2>${esc(PLAN.title)}</h2>
      <p class="cap">고객이 위에서 아래로 보는 순서 그대로예요. 카드 칸에는 요소 이름만 있고, 실제 글은 카드 문구표에 있어요.</p></header>
    <div class="pagewf">${SECS.map((s, i) => `<div class="pw-s"><span class="pw-n">${i + 1}</span>${secWire(s, i)}</div>`).join('')}</div>`;
}

// ================= 카드 문구표 =================
// 칸은 구좌에서 켜진 요소만. 숫자는 서비스가 계산한 값 (옮겨 적기 실수 방지)
const COLS = [['label', '모서리 라벨'], ['pill', '알약'], ['appeal', '소구문구'], ['tag', '이름 앞 태그'], ['name', '상품명'], ['list', '정가'], ['first', '1단 가격'], ['pct', '할인율'], ['pname', '가격 이름'], ['sale', '판매가'], ['copy', '카드 문구']];
function cellOf(k, cd) {
  if (!cd.seq) return k === 'name' ? '미정' : '';
  const p = PRODUCTS[cd.seq], pr = priceOf(cd.seq);
  return { label: cd.label, pill: pillText(cd), appeal: ITEMS[cd.seq]?.appeal || '', tag: cd.tag ? `[${cd.tag}]` : '', name: p.name, list: pr.fin < pr.list ? won(pr.list) : '',
    first: pr.ex ? won(pr.first) : '', pct: pr.pct ? `${pr.pct}%` : '', pname: pr.pname, sale: won(pr.fin), copy: cd.copy }[k] || '';
}
function cardTables() {
  return SECS.filter(s => s.on).map(s => { const cols = COLS.filter(([k]) => s.on.includes(k) || k === 'copy' && cardsOf(s).some(x => x.copy)), rows = cardsOf(s);
    return { s, cols, rows, tsv: [['구좌·탭', '순서', ...cols.map(c => c[1])].join('\t'), ...rows.map((cd, j) => [cd.tab ? `${s.name} · ${cd.tab}` : s.name, j + 1, ...cols.map(([k]) => cellOf(k, cd))].join('\t'))].join('\n') }; });
}
function renderCards() {
  document.getElementById('doc').innerHTML = `<header class="dh"><div class="overline">카드 문구표 · 같은 내용을 엑셀로도 내려받을 수 있어요</div><h2>${esc(PLAN.title)}</h2>
    <p class="cap">구좌에서 켜진 요소만 칸으로 보여요. 가격은 서비스가 계산한 값이라 그대로 옮겨 쓰면 돼요.</p></header>`
    + cardTables().map((t, ti) => `<section><div class="cc-h"><h4>${esc(t.s.name)} <span class="cap">${esc(LNAME[t.s.layout])} · ${t.rows.length}칸</span></h4><button class="btn xs" data-copy="${ti}">표 복사</button></div>
      <div class="tbl-wrap"><table class="cc"><thead><tr><th>구좌·탭</th><th>#</th>${t.cols.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map((cd, j) => `<tr><td>${esc(cd.tab || t.s.name)}</td><td class="num">${j + 1}</td>${t.cols.map(([k]) => { const v = cellOf(k, cd); return `<td class="${['list', 'first', 'pct', 'sale'].includes(k) ? 'num' : ''} ${['pill', 'appeal', 'name', 'copy'].includes(k) ? 'wrap' : ''} ${k === 'sale' ? 'sale' : ''} ${v ? '' : 'empty'}">${esc(v || '-')}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('');
}

// ================= 동작 =================
let view = 'doc', log = [];
const $ = s => document.querySelector(s);
function render() { renderChecks(); ({ doc: renderDoc, page: renderPage, cards: renderCards })[view](); document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', b.dataset.view === view)); }
document.addEventListener('click', e => {
  const t = e.target;
  const vb = t.closest('[data-view]'); if (vb) { view = vb.dataset.view; render(); return; }
  const jp = t.closest('[data-jump]'); if (jp) { document.getElementById(`dsec-${jp.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const g = t.closest('[data-go]'); if (g) { toast(`예시예요: 구좌 편집에서 ${+g.dataset.go + 1}번 구좌 '${SECS[+g.dataset.go].name}'을 열어요`); return; }
  const cp = t.closest('[data-copy]'); if (cp) { const tsv = cardTables()[+cp.dataset.copy].tsv;
    (navigator.clipboard?.writeText(tsv) || Promise.reject()).then(() => toast('표를 복사했어요. 엑셀이나 피그마에 붙여 넣을 수 있어요'), () => toast('이 브라우저에서는 복사가 막혀 있어요. 엑셀로 내려받아 주세요')); return; }
  const ex = t.closest('[data-exp]'); if (ex) {
    const w = checks().filter(x => x.lv === 'warn').length, k = ex.dataset.exp;
    if (k !== 'pdf' && w && !confirm(`꼭 볼 것이 ${w}건 남아 있어요. 그래도 내보낼까요?`)) return;
    const files = [...document.querySelectorAll('[data-zf]:checked')].map(x => ({ doc: '기획안.html', page: '페이지_와이어프레임.html', cards: '카드_문구표.xlsx' })[x.dataset.zf]);
    if (k === 'zip' && !files.length) { toast('묶음에 넣을 파일을 하나 이상 골라 주세요'); return; }
    const name = { zip: `디자이너 전달 묶음 (ZIP: ${files.join(', ')})`, promo: 'PROMO_WORK 붙여넣기 (엑셀)', pdf: 'PDF 인쇄 화면' }[k];
    if (k === 'pdf') { window.print(); return; }
    log.unshift(`${new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${name}`);
    $('#log').innerHTML = log.map(x => `<li>${esc(x)}</li>`).join('');
    toast(`예시예요: ${name}을 내보냈어요. 실제로는 파일이 내려받아져요`); return;
  }
});
document.addEventListener('input', e => { const r = e.target.dataset.req; if (r != null) SECS[+r].notes = e.target.value; });
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2800); }
render();
