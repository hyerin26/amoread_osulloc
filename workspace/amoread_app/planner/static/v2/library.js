// ================= 예시 레퍼런스 (가상) =================
// kind: page 원본 프로모션 전체 페이지 / sec 원본 구좌 레퍼런스 / mood 느낌 레퍼런스 / event 이벤트 아이디어 (구좌 하나)
// season = 명분·시즌, cls = 분류 5종, ben = 혜택 방식, concept = 컨셉 구성 사례(이름), stype = 구좌 종류(임시), mode = 참여 방식, pts = 느낌 참고 포인트
// 2026-11-10: 직접 추가한 것·Pinterest에서 담은 것·즐겨찾기는 서버(planner/data/references)에 저장. 아래 예시(R)는 화면 안에만 있음 (demo: true)
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
  { id: 'm1', kind: 'mood', name: '돗자리 위 티타임', from: '외부', src: '외부 사례 · 봄 피크닉', season: '봄', pts: ['색감', '소품'], r: [2, 3], used: 1 },
  { id: 'm2', kind: 'mood', name: '연둣빛 봄 색감', from: '외부', src: '외부 캠페인 일부', season: '봄', pts: ['색감'], r: [4, 5], used: 1 },
  { id: 'm3', kind: 'mood', name: '보온병 들고 산책', from: '외부', src: '외부 사례 · 아웃도어', season: '봄', pts: ['구도'], r: [9, 16] },
  { id: 'm4', kind: 'mood', name: '벚꽃 아래 찻잔', from: '자사몰', src: '자사몰 지난 행사 일부', season: '봄', pts: ['색감', '구도'], r: [3, 4] },
  { id: 'm5', kind: 'mood', name: '손글씨 시즌 타이포', from: '외부', src: '외부 사례 · 시즌 타이포', season: '', pts: ['글씨체'], r: [1, 1] },
  { id: 'm6', kind: 'mood', name: '보자기 매듭 클로즈업', from: '자사몰', src: '자사몰 지난 행사 일부', season: '설', pts: ['소품', '구도'], r: [4, 5] },
  { id: 'm7', kind: 'mood', name: '어두운 바탕 차회 상차림', from: '자사몰', src: '자사몰 지난 행사 일부', season: '가을', pts: ['색감', '카피 톤'], r: [3, 4] },
];
R.forEach(r => { r.demo = true; });
const BASE_TABS = [['page', '전체 프로모션'], ['sec', '구좌 사례'], ['mood', '느낌'], ['event', '이벤트 아이디어']];
const KIND_N = { page: '원본 프로모션 전체 페이지', sec: '원본 구좌 레퍼런스', mood: '느낌 레퍼런스', event: '이벤트 아이디어 (원본 구좌)' };
// 직접 입력 칸의 기본 선택지 (목록 밖 값도 저장됨 → 필터·상세에 그대로 보임)
const SEASONS = ['봄', '여름', '가을', '겨울', '설', '추석', '블프', '한글날', '연말'];
const PTS = ['색감', '구도', '소품', '글씨체', '카피 톤'];
// 탭 고유 필터 (구좌 종류는 임시 목록 — 디자이너 4가지 / 다른 갈래 7가지 중 나중에 정함)
const EXTRA = {
  page: [['ben', '혜택 방식'], ['concept', '컨셉 구성']],
  sec: [['stype', '구좌 종류', '임시 목록 · 나중에 정해요']],
  mood: [['pts', '참고할 것']],
  event: [['mode', '참여 방식']],
};
const OWN_CHOICE = '__own';

// ================= 상태 =================
let tab = 'page', q = '', f = {}, favOnly = false, cur = null;
let OWN = [], FAV = new Set(), BOARDS = [], PINS = [], libState = 'loading', libErr = '', pinState = 'idle', pinErr = '', boardErr = '', boardBusy = false, editing = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const uniq = a => [...new Set(a.filter(Boolean))];
const all = () => [...OWN, ...R];
const byId = id => all().find(x => x.id === id);
const tk = r => (r.kind === 'etc' ? `etc:${r.kind_label}` : r.kind);           // 탭 열쇠: 직접 입력한 종류는 자기 탭
const kindName = r => (r.kind === 'etc' ? r.kind_label : KIND_N[r.kind] || r.kind);
const clsName = o => CLSN[o] || o;
const pinImg = u => `/refimg/pin?u=${encodeURIComponent(u)}`;
const PIN_LOGO = '<svg class="pinlogo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="12" fill="#e60023"/><path fill="#fff" d="M12.3 4.6c-4 0-6 2.8-6 5.2 0 1.4.5 2.7 1.7 3.2.2.1.4 0 .4-.2l.2-.8c.1-.2 0-.3-.1-.5-.3-.4-.6-1-.6-1.7 0-2.3 1.7-4.3 4.4-4.3 2.4 0 3.7 1.5 3.7 3.4 0 2.6-1.1 4.7-2.8 4.7-.9 0-1.6-.8-1.4-1.7.3-1.1.8-2.4.8-3.2 0-.7-.4-1.4-1.2-1.4-1 0-1.7 1-1.7 2.3 0 .8.3 1.4.3 1.4l-1.1 4.8c-.3 1.4 0 3.2.1 3.4 0 .1.1.1.2 0 .1-.1 1.1-1.4 1.5-2.7l.6-2.3c.3.6 1.2 1.1 2.1 1.1 2.8 0 4.7-2.5 4.7-5.9 0-2.6-2.2-5-5.6-5z"/></svg>';
function demoImg(w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 40}" height="${h * 40}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#f3f3f3"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#p)"/><rect x="0.5" y="0.5" width="${w * 40 - 1}" height="${h * 40 - 1}" fill="none" stroke="#dedede"/></svg>`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="">`;
}
// 윤곽 썸네일: 이미지가 없어도 구좌 역할(메인 비주얼·상품·쿠폰…)을 순서대로 쌓은 간략 화면으로 '이런 구성의 프로모션'을 보인다
const SH = { hero: 24, product_list: 22, coupon_offer: 10, sale_offer: 11, benefit_overview: 13, partner_benefit: 11, brand_story: 15, editorial_story: 14, brand_intro: 13, lookbook: 19, visual_gallery: 19, image_block: 15,
  participation_event: 13, terms_notice: 8, section_navigation: 6, related_promotions: 11, share: 6, app_promo: 7, live_commerce: 15, content: 9 };
const FAM = { hero: 'vis', visual_gallery: 'vis', lookbook: 'vis', image_block: 'vis', product_list: 'prod', coupon_offer: 'ben', sale_offer: 'ben', benefit_overview: 'ben', partner_benefit: 'ben',
  brand_story: 'story', editorial_story: 'story', brand_intro: 'story', participation_event: 'act', live_commerce: 'act', share: 'act', app_promo: 'act', terms_notice: 'info', section_navigation: 'info', related_promotions: 'info', content: 'info' };
const shapeBlock = (role, x, y, w, h, o = {}) => `<g class="f-${FAM[role] || 'info'}">${shapeBlock0(role, x, y, w, h, o)}</g>`;
function shapeBlock0(role, x, y, w, h, o = {}) {
  const R = (a, b, c, d, k, rx = 1) => `<rect class="${k}" x="${(a).toFixed(1)}" y="${(b).toFixed(1)}" width="${Math.max(c, .5).toFixed(1)}" height="${Math.max(d, .5).toFixed(1)}" rx="${rx}"/>`;
  const lines = (a, b, c, n, g = 2.4) => Array.from({ length: n }, (_, i) => R(a, b + i * g, i === n - 1 ? c * .6 : c, 1, 'ln', .5)).join('');
  const cap = (a, b, c, k = 'tx') => (o.t && o.cap ? `<text class="${k}" x="${a.toFixed(1)}" y="${b.toFixed(1)}">${esc(o.t.slice(0, c))}</text>` : '');
  const nI = Math.max(0, o.i || 0);
  switch (role) {
    case 'hero': return R(x, y, w, h, 'ac', 1.6) + cap(x + 5, y + h - 14, 13, 'txw') + R(x + 5, y + h - 11, w * .52, 2.6, 'wh', .8) + R(x + 5, y + h - 7, w * .32, 2, 'wh', .8) + R(x + 5, y + h - 3.8, w * .2, 2.2, 'wh', 1.1);
    case 'product_list': { const n = Math.max(2, Math.min(4, nI || 3)), cw = (w - (n - 1) * 2) / n; return Array.from({ length: n }, (_, i) => R(x + i * (cw + 2), y, cw, h - 5, 'bk', 1) + R(x + i * (cw + 2), y + h - 3.6, cw * .7, 1.3, 'ln', .5)).join(''); }
    case 'coupon_offer': return R(x, y, w, h, 'ol', 1.5) + R(x + 4, y + h / 2 - 1.2, w * .4, 2.4, 'ac2', .8) + R(x + w - 14, y + 2, 10, h - 4, 'ac', 1) + cap(x + 4, y + h / 2 - 3.4, 12);
    case 'sale_offer': return R(x, y, w, h, 'bk', 1.2) + `<circle class="ac" cx="${x + 7}" cy="${y + h / 2}" r="${Math.min(4.2, h / 2 - 1)}"/>` + lines(x + 15, y + h / 2 - 2.4, w - 20, 2);
    case 'benefit_overview': case 'partner_benefit': { const n = o.l > 260 ? 4 : o.l < 60 ? 2 : 3; return Array.from({ length: n }, (_, i) => `<circle class="ac2" cx="${x + 6 + i * (w - 12) / (n - .6)}" cy="${y + 4}" r="2.6"/>` + R(x + 1 + i * (w - 12) / (n - .6), y + 8.4, 9, 1.2, 'ln', .5)).join(''); }
    case 'brand_story': case 'editorial_story': case 'brand_intro': return R(x, y, h, h, 'bk', 1) + lines(x + h + 3, y + 2, w - h - 3, Math.max(2, Math.floor((h - 3) / 2.4)));
    case 'lookbook': case 'visual_gallery': case 'image_block': { const n = Math.max(2, Math.min(6, nI || 4)), cols = n > 4 ? 3 : 2, rows = Math.ceil(n / cols), tw = (w - (cols - 1) * 2) / cols, th = (h - (rows - 1) * 2) / rows; return Array.from({ length: n }, (_, i) => R(x + (i % cols) * (tw + 2), y + Math.floor(i / cols) * (th + 2), tw, th, 'bk', 1)).join(''); }
    case 'participation_event': return lines(x + w * .2, y + 1, w * .6, 2) + R(x + w * .3, y + h - 5.5, w * .4, 4.4, 'ac', 2.2);
    case 'section_navigation': return [0, 1, 2, 3].map(i => R(x + i * (w / 4), y + 1, w / 4 - 2, h - 2, i ? 'bk' : 'ac2', 1.6)).join('');
    case 'related_promotions': return R(x, y, w / 2 - 1, h, 'bk', 1) + R(x + w / 2 + 1, y, w / 2 - 1, h, 'bk', 1);
    case 'terms_notice': return lines(x, y, w, Math.max(2, Math.floor(h / 2.2)), 2.2);
    case 'share': case 'app_promo': return R(x + w * .2, y, w * .6, h, 'ac2', h / 2);
    case 'live_commerce': return R(x, y, w, h, 'bk', 1.2) + `<polygon class="ac" points="${x + w / 2 - 2.5},${y + h / 2 - 3} ${x + w / 2 - 2.5},${y + h / 2 + 3} ${x + w / 2 + 3},${y + h / 2}"/>`;
    default: return lines(x, y, w, Math.max(2, Math.floor(h / 2.4)));
  }
}
// 브랜드(출처)마다 배너 색이 달라지게: 이름에서 색상값을 뽑는다
const hueOf = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
// 화면 수집으로 받은 실제 배치(띠마다 높이·칸 수·이미지 수)로 그린 윤곽: 높이는 제곱근으로 눌러 짧은 띠도 보이게 한다
function bandThumb(r) {
  const B = r.layout.bands.filter(b => b.h >= 12), W = 90, H = 120, PAD = 6, w = W - PAD * 2, gap = 1.4, room = H - PAD * 2 - 8;
  if (B.length < 2) return '';
  const wt = B.map(b => Math.sqrt(b.h)), k = (room - gap * (B.length - 1)) / wt.reduce((a, b) => a + b, 0);
  let y = PAD, out = '';
  B.forEach((b, i) => {
    const h = wt[i] * k, role = b.role || (b.t < 25 && b.i ? 'image_block' : 'content');
    out += h < 7 ? `<g class="f-${FAM[role] || 'info'}"><rect class="bk" x="${PAD}" y="${y.toFixed(1)}" width="${w}" height="${Math.max(h, 1.2).toFixed(1)}" rx="1"/></g>`
      : shapeBlock(role, PAD, y, w, h, { i: role === 'product_list' ? Math.min(4, Math.max(2, b.c)) : b.i, l: b.t });
    y += h + gap;
  });
  return `<svg class="shp ${r.cls ? `c-${esc(r.cls)}` : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="실제 배치 윤곽: 띠 ${B.length}개"><rect class="pg" x=".3" y=".3" width="${W - .6}" height="${H - .6}" rx="2"/>${out}<text x="${W - PAD}" y="${H - 3}" text-anchor="end">구좌 ${B.length}개 · 실제 배치</text></svg>`;
}
function shapeThumb(r) {
  if (r.layout?.bands?.length >= 2) { const t = bandThumb(r); if (t) return t; }
  const X = (r.shape_x && r.shape_x.length ? r.shape_x : (r.shape || (r.role ? [r.role] : [])).map(x => ({ r: x }))).filter(x => x.r !== 'ui_noise' && x.r !== 'empty');
  if (!X.length) return '';
  const W = 90, H = 120, PAD = 6, w = W - PAD * 2, one = r.kind !== 'page' || X.length === 1;
  // 같은 역할이 이어지면 묶되, 묶음마다 글 길이·이미지 수를 합쳐 높이와 모양에 반영
  let g = []; X.forEach(x => { const l = g[g.length - 1]; if (l && l.r === x.r) { l.n++; l.l += x.l || 0; l.i += x.i || 0; } else g.push({ r: x.r, n: 1, l: x.l || 0, i: x.i || 0, t: x.t || '' }); });
  if (one) g = [{ ...g[0], n: 1, big: true }];
  const TOP = 0;
  const room = H - PAD * 2 - 8;
  const TEXTY = new Set(['product_list', 'brand_story', 'editorial_story', 'brand_intro', 'terms_notice', 'content', 'benefit_overview']);
  const hOf = it => { const base = SH[it.r] || 9, k = TEXTY.has(it.r) && it.l ? .75 + Math.min(it.l / it.n, 700) / 700 * .85 : 1; return base * k * (1 + .55 * (Math.min(it.n, 3) - 1)); };
  const total = g.reduce((a, it) => a + hOf(it) + 3, 0);
  const sc = one ? Math.min(2.6, room / hOf(g[0])) : Math.max(.55, Math.min(1, room / total));
  let used = one ? (room - hOf(g[0]) * sc) / 2 : 0, out = '', shown = 0;
  for (const it of g) {
    const h = hOf(it) * sc, gap = 3 * sc;
    if (used + h > room && shown) { out += `<circle class="ln" cx="${W / 2 - 4}" cy="${PAD + TOP + used + 2}" r="1"/><circle class="ln" cx="${W / 2}" cy="${PAD + TOP + used + 2}" r="1"/><circle class="ln" cx="${W / 2 + 4}" cy="${PAD + TOP + used + 2}" r="1"/>`; break; }
    const each = h / Math.min(it.n, 3);
    for (let k = 0; k < Math.min(it.n, 3); k++) out += shapeBlock(it.r, PAD, PAD + TOP + used + k * each, w, each - (it.n > 1 ? 1.5 : 0), { t: it.t, l: it.l / it.n, i: Math.round(it.i / it.n) });
    used += h + gap; shown++;
  }
  const label = one ? esc(r.stype || ROLE_KO[X[0].r] || '') : `구좌 ${X.length}개`;
  return `<svg class="shp ${r.cls ? `c-${esc(r.cls)}` : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="구좌 구성 윤곽: ${esc(g.map(x => ROLE_KO[x.r] || x.r).join(' → ')).slice(0, 200)}"><rect class="pg" x=".3" y=".3" width="${W - .6}" height="${H - .6}" rx="2"/>${out}<text x="${W - PAD}" y="${H - 3}" text-anchor="end">${label}</text></svg>`;
}
// 구좌는 원본 화면을 수집해 둔 페이지면 그 구좌 자리를 잘라 썸네일로 쓴다 (화면에 보일 때 그린다). 못 그리면 아래 구성도가 그대로 보인다
// 구좌 글 카드: 잘라 볼 화면이 없을 때 구성도 대신 쓴다 (같은 유형끼리 똑같아 보이는 문제 방지). 수집 때 저장한 글만 쓴다
function textCard(r) {
  const nm = String(r.name || ''); let t = String(r.summary || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3 && nm && t.startsWith(nm); i++) t = t.slice(nm.length).replace(/^[\s.·:,\-]+/, '');   // 앞에 제목이 반복돼 저장돼 있어서 걷어 낸다
  return `<span class="tc"><b>${esc(nm)}</b>${t ? `<span class="tx">${esc(t)}</span>` : ''}<span class="tk">${esc(r.stype || ROLE_KO[r.role] || '')}</span></span>`;
}
const cropOf = r => { if (r.kind !== 'sec' || r.img) return ''; const p = pageOf(r); if (!p?.rendered) return ''; const b = Cap.band(p.layout, r.psec, r.summary);
  const at = b ? `data-y="${b.y}" data-h="${b.h}"` : `data-t="${esc(r.summary || r.psec)}" data-n="${r.tl || 0}"`;   // 위치를 못 찾으면 글로 그 요소를 찾아 그린다
  return `<span class="cropbox">${textCard(r)}<span class="crop" data-crop data-id="${esc(p.id)}" ${at}></span></span>`; };
const thumb = r => (cropOf(r) || (r.kind === 'sec' && !r.img && r.ai ? `<span class="cropbox">${textCard(r)}</span>` : thumb0(r)));
const thumb0 = r => (r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy">` : shapeThumb(r) || (r.link ? '<span class="cap">링크만 있어요</span>' : demoImg(r.r[0], r.r[1])));
const pageOf = r => (r.page ? all().find(x => x.id === r.page) : null);

// 서버에 저장된 항목 → 화면용 (출처·이미지 주소를 붙임)
function view(x) {
  const pin = x.source === 'Pinterest', b = BOARDS.find(y => y.url === x.board);
  const ver = encodeURIComponent(x.updated_at || '');
  return { ...x, own: true, from: pin ? 'Pinterest' : x.migrated ? x.from_label : '직접 추가', src: pin ? `Pinterest${b?.name ? ` · ${b.name}` : ''}` : x.migrated ? x.brand : '직접 추가',
    img: x.img_file ? `/refimg/own/${x.img_file}?v=${ver}` : x.pin_img ? pinImg(x.pin_img) : '', r: [3, 4] };
}
const FIELDS = ['id', 'kind', 'kind_label', 'name', 'season', 'cls', 'source', 'link', 'pin_id', 'pin_img', 'board', 'pts', 'tags', 'memo'];
function bodyOf(r) {
  const o = {};
  FIELDS.forEach(k => { if (r[k] !== undefined && r[k] !== null) o[k] = r[k]; });
  if (!o.id) delete o.id;
  return o;
}
function upsert(x) { const v = view(x), i = OWN.findIndex(y => y.id === x.id); if (i >= 0) OWN[i] = v; else OWN.unshift(v); return v; }

// 한 레퍼런스가 필터에 맞는지: 그룹 안은 하나만 고름, 그룹끼리는 모두 맞아야 (안 고른 그룹은 통과)
function match(r, filters = f, kind = tab) {
  if (tk(r) !== kind) return false;
  if (favOnly && !FAV.has(r.id)) return false;
  for (const [k, v] of Object.entries(filters)) {
    if (!v) continue;
    if (k === 'concept') { if (!r.concept) return false; continue; }
    const val = r[k]; if (Array.isArray(val) ? !val.includes(v) : val !== v) return false;
  }
  if (q) {
    const hay = [r.name, r.season, clsName(r.cls || ''), r.concept, r.src, r.kind_label, r.memo, pageOf(r)?.name, r.stype, r.mode, ...(r.ben || []), ...(r.pts || []), ...(r.tags || [])].filter(Boolean).join(' ');
    if (!hay.includes(q)) return false;
  }
  return true;
}
// 필터 선택지는 이 탭에 실제로 있는 값에서 만든다 (직접 입력한 값도 그대로 나옴). 기본 목록 순서를 먼저
function optsOf(k, base = []) {
  const vals = all().filter(r => tk(r) === tab).flatMap(r => (k === 'concept' ? (r.concept ? ['컨셉 구성 사례만'] : []) : Array.isArray(r[k]) ? r[k] : [r[k]]));
  const have = uniq(vals);
  return [...base.filter(x => have.includes(x)), ...have.filter(x => !base.includes(x))];
}
function groups() {
  const g = [['from', '출처', optsOf('from', ['자사몰', '외부', '직접 추가', 'Pinterest'])], ['season', '명분·시즌', optsOf('season', SEASONS)]];
  if (tab !== 'mood') g.push(['cls', '분류', optsOf('cls', Object.keys(CLSN))]);
  (EXTRA[tab] || []).forEach(([k, label, note]) => g.push([k, label, optsOf(k, k === 'pts' ? PTS : []), note]));
  return g.filter(([, , o]) => o.length);
}
function tabsList() {
  const extra = uniq(OWN.filter(r => r.kind === 'etc').map(tk)).map(k => [k, k.slice(4)]);
  return [...BASE_TABS, ...extra];
}

// ================= 그리기 =================
function render() {
  const pinsOn = tab === 'pin';
  const tabs = tabsList();
  if (!pinsOn && !tabs.some(t => t[0] === tab)) tab = 'page';
  $('#tabs').innerHTML = tabs.map(([k, n]) => `<button role="tab" data-tab="${esc(k)}" aria-selected="${tab === k}">${esc(n)}<span class="n">${all().filter(r => match(r, k === tab ? f : {}, k)).length}</span></button>`).join('')
    + `<button role="tab" data-tab="pin" aria-selected="${pinsOn}" class="pin-tab">${PIN_LOGO}Pinterest 보드<span class="n">${BOARDS.length ? `${BOARDS.length}개 보드` : '연결 전'}</span></button>`;
  $('#favOnly').setAttribute('aria-pressed', String(favOnly));
  $('#favOnly').hidden = pinsOn;
  $('#favN').textContent = FAV.size ? String(FAV.size) : '';
  $('#qS').classList.toggle('has-value', !!q);
  $('#q').placeholder = pinsOn ? '핀 제목·보드 이름으로 찾기' : '명분·키워드·페이지 이름으로 찾기 (예: 봄, 피크닉, 보자기)';
  if (pinsOn) { renderPins(); renderDrawer(); return; }
  // 필터 칩 옆 숫자 = 그 칩을 고르면 남는 개수 (나머지 필터·검색은 그대로)
  $('#filters').innerHTML = groups().map(([k, label, opts, note]) => `<div class="fg"><span>${label}</span><div class="chips-row">${opts.map(o => { const n = all().filter(r => match(r, { ...f, [k]: o })).length;
    return `<button class="chip" data-f="${esc(k)}|${esc(o)}" aria-pressed="${f[k] === o}" ${n || f[k] === o ? '' : 'disabled'}>${esc(k === 'cls' ? clsName(o) : o)}<span class="n">${n}</span></button>`; }).join('')}${note ? `<span class="note">${note}</span>` : ''}</div></div>`).join('');
  const list = all().filter(r => match(r));
  const any = q || favOnly || Object.values(f).some(Boolean);
  const tname = tabs.find(t => t[0] === tab)[1];
  $('#resN').textContent = `${tname} ${list.length}개${any ? ' · 고른 조건에 맞는 것만' : ' · 필터를 안 골라서 전체'}`;
  $('#clearAll').hidden = !any;
  $('#grid').className = 'grid';
  const empty = favOnly && !q && !Object.values(f).some(Boolean)
    ? `<div class="empty">이 탭에 즐겨찾기한 레퍼런스가 없어요. 카드의 ☆를 누르면 여기에 모여요.<button class="btn sm" data-clearall>즐겨찾기만 끄기</button></div>`
    : !any ? `<div class="empty">${tname}에 담긴 레퍼런스가 아직 없어요.${tab === 'mood' ? ' 위 [+ 레퍼런스 추가]로 이미지·링크를 올리거나 Pinterest 보드를 연결하면 여기에 모여요.' : ' [신규 프로모션 찾기]나 [수집]으로 모을 수 있어요.'}</div>`
    : `<div class="empty">${q ? `'${esc(q)}'와 ` : ''}고른 조건에 맞는 레퍼런스가 없어요.<button class="btn sm" data-clearall>필터·검색 지우기</button></div>`;
  $('#grid').innerHTML = (libState === 'err' ? `<div class="empty warn">직접 추가한 레퍼런스를 불러오지 못했어요 (${esc(libErr)}). 예시만 보여요.<button class="btn sm" data-reload>다시 불러오기</button></div>` : '')
    + (list.length ? list.map(card).join('') : empty);
  Cap.lazy($('#grid'));
  renderDrawer();
}
function card(r) {
  const p = pageOf(r), tags = [];
  if (r.demo) tags.push('<span class="tag demo-t">예시</span>');
  tags.push(`<span class="tag ${r.from === '자사몰' ? 'real' : r.from === 'Pinterest' ? 'pin' : ''}">${esc(r.from)}</span>`);
  if (r.cls && r.kind !== 'mood') tags.push(`<span class="tag ${CLSN[r.cls] ? `c-${r.cls}` : ''}">${esc(clsName(r.cls))}</span>`);
  if (r.season) tags.push(`<span class="tag">${esc(r.season)}</span>`);
  if (r.concept) tags.push('<span class="tag">컨셉 구성</span>');
  if (r.stype) tags.push(`<span class="tag">${esc(r.stype)}</span>`);
  if (r.mode) tags.push(`<span class="tag">${esc(r.mode)}</span>`);
  (r.pts || []).forEach(x => tags.push(`<span class="tag">${esc(x)}</span>`));
  (r.tags || []).forEach(x => tags.push(`<span class="tag">#${esc(x)}</span>`));
  if (r.used) tags.push(`<span class="tag">지난 기획안에서 ${r.used}번 씀</span>`);
  const fav = FAV.has(r.id);
  return `<div class="rc" ${cur === r.id ? 'aria-current="true"' : ''}><button class="open" data-open="${r.id}" aria-label="${esc(r.name)} 자세히"><span class="fr">${thumb(r)}</span>
      <span class="nm">${esc(r.name)}</span></button><span class="cap">${p ? `${esc(p.name)}에서` : r.src ? esc(r.src) : r.kind === 'page' ? `구좌 ${r.secs.length}개` : '외부 사례'}</span>
    <span class="tags">${tags.join('')}</span><button class="star" data-star="${r.id}" aria-pressed="${fav}" aria-label="${esc(r.name)} ${fav ? '즐겨찾기 해제' : '즐겨찾기'}">${fav ? '★' : '☆'}</button></div>`;
}

// ---------- Pinterest 보드 ----------
function renderPins() {
  const busy = boardBusy ? 'disabled' : '';
  $('#filters').innerHTML = `<div class="pinbar">
      <form class="pinform" id="boardForm" novalidate><label class="f grow"><span>공개 보드 주소</span>
        <input type="url" id="boardUrl" placeholder="https://www.pinterest.com/아이디/보드이름/" autocomplete="off" aria-describedby="boardMsg" ${busy}></label>
        <button class="btn sm primary" ${busy}>${boardBusy ? '불러오는 중…' : '보드 추가'}</button></form>
      <p class="cap ${boardErr ? 'err' : ''}" id="boardMsg" aria-live="polite">${boardErr ? esc(boardErr) : '공개 보드의 최근 핀(보드마다 25개 안팎)을 읽어 와요. 비공개 보드·핀 하나·검색 주소는 안 돼요. 로그인은 필요 없어요.'}</p>
      ${BOARDS.length ? `<div class="boards" aria-label="구독한 보드">${BOARDS.map(b => `<span class="board ${b.error ? 'bad' : ''}"><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.name || b.url)}</a><span class="cap">${b.error ? esc(b.error) : `핀 ${b.pins}개`}</span><button class="x" data-unboard="${esc(b.url)}" aria-label="${esc(b.name || b.url)} 보드 빼기">✕</button></span>`).join('')}</div>` : ''}
    </div>`;
  const list = PINS.filter(p => !q || `${p.title} ${p.board_name}`.includes(q));
  const saved = new Map(OWN.filter(x => x.pin_id).map(x => [x.pin_id, x.id]));
  $('#resN').textContent = pinState === 'loading' ? '보드를 읽는 중…' : BOARDS.length ? `핀 ${list.length}개${q ? ' · 검색어에 맞는 것만' : ''} · 담은 핀은 [느낌] 탭에 모여요` : '';
  $('#clearAll').hidden = !q;
  $('#grid').className = 'grid pins';
  if (!BOARDS.length) { $('#grid').innerHTML = `<div class="empty">${PIN_LOGO}<b>아직 구독한 보드가 없어요</b>위 칸에 Pinterest 공개 보드 주소를 넣으면 그 보드의 핀이 여기에 보여요. 마음에 드는 핀은 [라이브러리에 담기]로 느낌 레퍼런스가 돼요.</div>`; return; }
  if (pinState === 'loading' && !PINS.length) { $('#grid').innerHTML = '<div class="empty">보드를 읽는 중이에요…</div>'; return; }
  if (pinState === 'err') { $('#grid').innerHTML = `<div class="empty warn">핀을 불러오지 못했어요 (${esc(pinErr)}).<button class="btn sm" data-pinreload>다시 불러오기</button></div>`; return; }
  $('#grid').innerHTML = list.length ? list.map(p => { const sid = saved.get(p.pin_id);
    return `<div class="rc pin"><span class="fr">${p.img ? `<img src="${esc(pinImg(p.img))}" alt="" loading="lazy">` : '<span class="cap">이미지 없음</span>'}</span>
      <span class="nm">${esc(p.title || 'Pinterest 핀')}</span><span class="cap">${esc(p.board_name || '')}</span>
      <span class="pacts">${sid ? `<button class="btn xs" data-open="${sid}">✓ 담았어요 · 보기</button>` : `<button class="btn xs primary" data-pinsave="${p.pin_id}">라이브러리에 담기</button>`}
        <a class="plink" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(p.title || 'Pinterest 핀')} Pinterest에서 보기 (새 창)">Pinterest에서 보기</a></span></div>`; }).join('')
    : `<div class="empty">${q ? `'${esc(q)}'에 맞는 핀이 없어요.<button class="btn sm" data-sclear>검색어 지우기</button>` : '보드에 읽을 수 있는 핀이 없어요.'}</div>`;
}
async function loadPins() {
  if (!BOARDS.length) { PINS = []; pinState = 'ok'; return; }
  pinState = 'loading'; if (tab === 'pin') render();
  try { const d = await v2api('/api/am/pinterest/pins'); PINS = d.pins || []; BOARDS = d.boards || []; pinState = 'ok'; OWN = OWN.map(view); }
  catch (e) { pinState = 'err'; pinErr = e.message; }
  render();
}
async function addBoard() {
  const url = $('#boardUrl').value.trim();
  if (!url) { boardErr = '보드 주소를 넣어 주세요'; render(); $('#boardUrl').focus(); return; }
  boardBusy = true; boardErr = ''; render();
  try { const r = await v2api('/api/am/pinterest/boards', { url }); boardBusy = false;
    BOARDS = [{ url: r.board, name: r.name, pins: r.pins.length, error: '' }, ...BOARDS.filter(b => b.url !== r.board)]; await loadPins(); toast(`'${r.name || '보드'}'를 구독했어요. 핀 ${r.pins.length}개`); }
  catch (e) { boardBusy = false; boardErr = e.message; render(); const i = $('#boardUrl'); i.value = url; i.focus(); }
}
async function savePin(pid) {
  const p = PINS.find(x => x.pin_id === pid); if (!p) return;
  try {
    const out = await v2api('/api/am/references', { kind: 'mood', name: (p.title || 'Pinterest 핀').slice(0, 60), source: 'Pinterest', link: p.link, pin_id: p.pin_id, pin_img: p.img, board: p.board, pts: [], tags: [], memo: '' });
    upsert(out); render(); toast('느낌 탭에 담았어요. 구좌 편집의 느낌 레퍼런스 목록에도 나와요');
  } catch (e) { toast(`담지 못했어요: ${e.message}`); }
}

// ---------- 상세 서랍 ----------
function renderDrawer() {
  const r = byId(cur), d = $('#drawer');
  d.hidden = !r; $('#scrim').hidden = !r; if (!r) return;
  queueMicrotask(() => Cap.lazy(d));
  const p = pageOf(r), kids = r.kind === 'page' ? all().filter(x => x.page === r.id) : [], fav = FAV.has(r.id);
  const kv = [['종류', kindName(r)], ['출처', r.from + (r.src && r.src !== r.from ? ` · ${r.src.replace(/^Pinterest · /, '')}` : '')], r.cls && ['분류', clsName(r.cls)], r.season && ['명분·시즌', r.season], p && ['페이지', p.name], r.concept && ['컨셉 구성', r.concept],
    r.ben && ['혜택 방식', r.ben.join(', ')], r.stype && ['구좌 종류', `${r.stype} (임시)`], r.mode && ['참여 방식', r.mode], r.pts?.length && ['참고할 것', r.pts.join(', ')], r.tags?.length && ['태그', r.tags.map(t => `#${t}`).join(' ')], r.created_at && ['추가한 날', r.created_at.slice(0, 10)]].filter(Boolean);
  const use = r.ai ? '수집한 원본 페이지·구좌예요. 분류(명분·분류·혜택 방식)는 자동으로 붙인 값이라 틀릴 수 있어요. 구좌 구성 추천에 쓰여요.' : r.demo ? '예시 레퍼런스라 기획안에 붙일 수 없어요. 직접 추가하거나 Pinterest에서 담은 레퍼런스는 구좌 편집 › 레퍼런스 탭 › [느낌 레퍼런스 추가] 목록에 나와요.'
    : '이 레퍼런스는 구좌 편집 › 레퍼런스 탭 › [느낌 레퍼런스 추가] 목록에 나와요. 즐겨찾기한 것이 먼저 보여요.';
  d.innerHTML = `<div class="dh"><div class="grow"><div class="overline">${esc(kindName(r))}${r.demo ? ' · 예시' : ''}</div><h2 id="drH">${esc(r.name)}</h2></div><button class="btn sm" data-close>닫기</button></div>
    <div class="db"><figure class="dfig">${thumb(r)}</figure>
      <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}${r.link ? `<dt>링크</dt><dd><a class="lnk" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</a></dd>` : ''}</dl>
      <div class="acts">
        <div class="row"><button class="btn sm" data-star="${r.id}" aria-pressed="${fav}">${fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</button>
          ${r.kind === 'page' ? `<button class="btn sm" data-whole="${r.id}">전체 페이지 보기</button>${kids.length ? `<button class="btn sm" data-kids="${r.id}">이 페이지의 구좌 ${kids.length}개</button>` : ''}`
            : p ? `<button class="btn sm" data-whole="${p.id}" data-mark="${esc(r.psec)}">전체 페이지 보기 · 이 구좌 위치</button>` : ''}
          ${r.own ? `<button class="btn sm" data-edit="${r.id}">고치기</button><button class="btn sm ghost danger" data-del="${r.id}">삭제</button>` : r.ai && r.kind === 'page' ? `<button class="btn sm ghost danger" data-hide="${r.id}">삭제</button>` : ''}</div>
        <p class="hint">${use}</p>
      </div>
      <label class="f"><span>메모 <em>(선택) ${r.own ? '저장돼요' : '예시라 저장되지 않아요'}</em></span><textarea rows="3" maxlength="300" data-memo="${r.id}" placeholder="예) 탭 모양만 참고, 색은 너무 진함">${esc(r.memo || '')}</textarea><span class="cap" id="memoSt" aria-live="polite"></span></label>
    </div>`;
}
// 수집 범위 표: 이 레퍼런스에서 무엇을 받았고 무엇을 못 받았는지 (디자인·배치가 있는지 직접 확인하는 용도)
function captureBox(c, p, rd) {
  if (!c || c.bytes === undefined) return '<p class="hint">이 레퍼런스는 수집 범위 정보가 없어요 (예전에 저장됨).</p>';
  const note = p?.content_changed ? '<p class="hint err">이 화면은 <b>나중에 다시 받은 것</b>이에요. 같은 주소지만 내용(상품 목록 등)이 달라져서 구좌 제목·검색용 글과 안 맞을 수 있어요.</p>' : '';
  const row = (a, b, st, t) => `<tr><td>${a}</td><td>${b}</td><td class="cp-${st}">${t}</td></tr>`;
  return `<div class="cap-box"><h3>어디까지 받아 왔나</h3>${note}<table class="cap-tb"><tbody>
    ${row('HTML 구조(태그 뼈대)', `${Math.round(c.bytes / 1024)}KB · 클래스 요소 ${c.cls}개`, 'ok', '✔ 받음')}
    ${row('글(텍스트)', `${c.text.toLocaleString()}자`, 'ok', '✔ 받음')}
    ${row('이미지', `img ${c.img}개 (주소 ${c.img_src}개)`, 'mid', '△ 주소만 · 파일 없음')}
    ${rd ? row('CSS 스타일', `파일 ${rd.css_files}개 · ${Math.round(rd.css_bytes / 1024)}KB (그려진 화면에 적용)`, 'ok', '✔ 받음') : row('CSS 파일·블록', `파일 ${c.css_link}개 · 블록 ${c.style_tag}개`, c.css_link || c.style_tag ? 'mid' : 'no', c.css_link || c.style_tag ? '△ 일부 있음' : '✘ 못 받음')}
    ${row('요소에 직접 붙은 스타일', `${c.style_attr}개`, c.style_attr ? 'mid' : 'no', c.style_attr ? '△ 일부(크기·색 일부)' : '✘ 없음')}
    ${row('글꼴·아이콘 파일', '-', 'no', '✘ 못 받음')}
    ${rd ? row('실제 배치(몇 칸·크기·위치)', `모바일 ${rd.viewport[0]}px · 세로 ${rd.page_h.toLocaleString()}px · 구좌 띠 ${rd.bands}개 (${rd.captured_at})`, 'ok', '✔ 받음') : row('실제 배치(몇 칸·크기·위치)', '-', 'no', '✘ 못 받음 (화면을 그려 보지 않아서)')}
    ${row('버튼·링크', `링크 ${c.a}개 · 버튼 ${c.button}개`, 'ok', '✔ 받음')}</tbody></table>
    <p class="hint">${rd ? '아래 화면은 <b>그려서 저장한 원본 모양</b>이에요 (이미지 파일만 빠져 회색 칸으로 보여요).' : '그래서 카드의 색 블록 그림은 받은 구조로 <b>우리가 그린 구성도</b>이고, 원본의 색·모양·간격이 아니에요. 화면 수집(재수집)을 하면 채워져요.'}${p?.link ? ` 원본은 <a class="lnk" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">링크</a>에서 확인할 수 있어요 (바뀌었을 수 있음).` : ''}</p></div>`;
}
// 수집 당시 화면: 저장해 둔 페이지를 읽기용으로 보여 준다 (외부 링크가 바뀌거나 만료돼도 그대로)
async function snapView(id) {
  const p = all().find(x => x.id === id);
  $('#dlgB').innerHTML = '<p class="hint">불러오는 중…</p>';
  try {
    const d = await v2api('/api/am/ai/snapshot?id=' + encodeURIComponent(id));
    $('#dlgB').innerHTML = d.ok ? `${captureBox(d.capture, p, d.rendered)}${d.rendered ? `<div class="snapframe" aria-label="수집 당시 화면 (원본 모양)"></div>
      <details class="snapd"><summary>글만 읽기용으로 보기</summary><div class="snap">${d.html}</div></details>`
      : `<p class="hint">글·구조만 읽기용으로 보여 줘요 (이미지는 자리로 표시, 링크는 눌리지 않아요). 이미지 ${d.images}개 · 원본 링크가 바뀌어도 이 화면은 그대로예요.</p><div class="snap">${d.html}</div>`}`
      : '<p class="hint">이 레퍼런스는 저장된 수집본이 없어요. 구좌 목록만 볼 수 있어요.</p>';
  } catch (e) { $('#dlgB').innerHTML = `<p class="hint">불러오지 못했어요: ${esc(e.message)}</p>`; }
  $('#dlgF').innerHTML = `<button class="btn sm" data-whole="${esc(id)}">구좌 목록으로</button>`;
  $('#dlgB').scrollTop = 0;
  if ($('#dlgB .snapframe')) mountCapture($('#dlgB .snapframe'), id);
  if (p) $('#dlgS').textContent = '수집 당시 화면';
}
// 수집해 둔 페이지(그려서 저장한 HTML+CSS)를 이 화면 안에 격리해 그린다: 섀도 DOM + CSSOM 스타일시트 (화면 보안 설정을 풀지 않고, 칸(iframe) 없이 어느 브라우저에서나 보임)
// 스크립트는 수집 때 이미 빠져 있고, 태그 안 style은 CSP가 막으므로 값을 떼어 두었다가 CSSOM으로 다시 입힌다
async function mountCapture(host, id) {
  try { await Cap.mount(host, id); return true; } catch (e) { host.textContent = `화면을 불러오지 못했어요: ${e.message}`; return false; }
}
function wholePage(id, mark, mode) {
  const p = all().find(x => x.id === id);
  const vis = p.layout?.bands?.length >= 2 && mode !== 'list';
  $('#dlgO').textContent = `원본 프로모션 전체 페이지 · ${p.from}${p.demo ? ' · 예시' : ''}`; $('#dlgH').textContent = p.name;
  $('#dlgS').textContent = vis ? (p.content_changed ? '나중에 다시 받은 화면이에요 (내용이 달라져 구좌 제목과 안 맞을 수 있어요). ' : '') + '수집 당시 모습 그대로, 구좌별로 박스를 쳤어요. 박스 위 [이 구좌 보기]로 구좌만 따로 볼 수 있어요 (이미지는 파일을 저장하지 않아 회색 칸).' : p.concept ? `컨셉 구성: ${p.concept}` : '실제로 걸렸던 페이지 한 장 전체 자리예요 (예시)';
  const can = (p.ai || p.own) && p.kind === 'page';
  if (vis) { wholeVisual(p, mark); }
  else $('#dlgB').innerHTML = p.secs.map((s, i) => { const k = all().find(x => x.page === p.id && x.psec === s); return `<div class="oseg ${s === mark ? 'used' : ''}"><div class="t"><span class="grow">${i + 1}. ${esc(s)}</span>${s === mark ? '<span class="tag real">지금 보는 구좌</span>' : ''}${k ? `<button class="btn xs" data-open="${k.id}" data-fromdlg>이 구좌 보기</button>` : ''}</div><span class="ph"></span></div>`; }).join('');
  $('#dlgF').innerHTML = (can ? `<button class="btn sm" data-snap="${esc(p.id)}">수집 범위 보기</button>` : '') + (p.layout?.bands?.length >= 2 ? `<button class="btn sm" data-whole="${esc(p.id)}" ${mark ? `data-mark="${esc(mark)}"` : ''} data-wmode="${vis ? 'list' : 'vis'}">${vis ? '목록으로 보기' : '원본 모양으로 보기'}</button>` : '');
  $('#dlg').showModal();
  if (mark) ($('#dlgB .used') || $('#dlgB .wb.used'))?.scrollIntoView({ block: 'center' });
}
// 수집한 페이지를 원본 모양 그대로(칸 안) 보여 주고, 그 위에 구좌 띠마다 박스를 얹는다 (위치·높이는 수집 때 잰 값)
function wholeVisual(p, mark) {
  const L = p.layout, linked = L.bands.some(b => b.st || b.role), bands = linked ? L.bands.filter(b => b.h >= 8) : [], k = t => (t ? all().find(x => x.page === p.id && x.psec === t) : null);
  let n = 0;
  $('#dlgB').innerHTML = `<div class="wv" data-h="${L.ph}"><div class="wvf" aria-label="수집 당시 화면"></div>`
    + bands.map(b => { const kk = k(b.st), tag = b.st || ROLE_KO[b.role] || ''; if (tag) n++;
      return `<div class="wb ${tag ? '' : 'none'} ${b.st && b.st === mark ? 'used' : ''}" data-y="${b.y}" data-h="${b.h}"><div class="wbt"><span>${tag ? `${n}. ${esc(tag.slice(0, 22))}` : '상단·기타'}</span>${kk ? `<button class="btn xs" data-open="${kk.id}" data-fromdlg>이 구좌 보기</button>` : ''}</div></div>`; }).join('') + '</div>';
  if (!linked) $('#dlgB').insertAdjacentHTML('afterbegin', '<p class="hint">이 페이지는 띠를 구좌에 연결하지 못해 박스를 그리지 않았어요 (예전 수집분과 내용이 많이 달라졌거나 상품 목록 위주일 때 그래요).</p>');
  const px = (el, o) => { for (const [a, v] of Object.entries(o)) el.style[a] = v + 'px'; };   // 위치는 CSSOM으로 (화면 보안 설정이 태그 안 style을 막아서)
  px($('#dlgB .wv'), { height: L.ph }); px($('#dlgB .wvf'), { height: L.ph });
  mountCapture($('#dlgB .wvf'), p.id);
  $('#dlgB').querySelectorAll('.wb').forEach(e => px(e, { top: +e.dataset.y, height: +e.dataset.h }));
}

// ---------- 추가·고치기 창 (종류·분류·명분·시즌·참고할 것은 '직접 입력' 가능) ----------
function pickField(id, label, opts, value, nameOf = x => x, none = '') {
  const own = value && !opts.includes(value);
  return `<label class="f"><span>${label}</span><select id="${id}" data-own="${id}Own">${none ? `<option value="">${none}</option>` : ''}${opts.map(o => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(nameOf(o))}</option>`).join('')}<option value="${OWN_CHOICE}" ${own ? 'selected' : ''}>직접 입력…</option></select>
    <input type="text" id="${id}Own" maxlength="20" placeholder="직접 입력" aria-label="${label} 직접 입력" value="${own ? esc(value) : ''}" ${own ? '' : 'hidden'}></label>`;
}
function openAdd(r) {
  editing = r || null;
  const kind = r ? (r.kind === 'etc' ? r.kind_label : r.kind) : (BASE_TABS.some(t => t[0] === tab) ? tab : tab.startsWith('etc:') ? tab.slice(4) : 'mood');
  const kinds = BASE_TABS.map(t => t[0]).concat(uniq(OWN.filter(x => x.kind === 'etc').map(x => x.kind_label)));
  const kName = k => (BASE_TABS.find(t => t[0] === k) || [0, k])[1];
  const seasons = uniq([...SEASONS, ...all().map(x => x.season)]);
  const clss = uniq([...Object.keys(CLSN), ...all().map(x => x.cls)]);
  const pts = uniq([...PTS, ...all().flatMap(x => x.pts || [])]);
  const on = new Set(r?.pts || []);
  $('#dlgO').textContent = r ? '레퍼런스 고치기' : '레퍼런스 추가';
  $('#dlgH').textContent = r ? r.name : '링크·HTML 파일·이미지로 모으기';
  $('#dlgS').textContent = r?.source === 'Pinterest' ? 'Pinterest에서 담은 핀이에요. 이미지는 볼 때 Pinterest에서 받아 와요.' : r ? '이미지는 이 PC의 프로그램 폴더에 저장돼요(5MB까지). 링크는 주소만 저장하고 열어 볼 때만 쓰여요.' : '링크나 HTML 파일을 가져오면 이름·분류·구좌를 자동으로 채워 드려요. 확인하고 고친 뒤 [추가]를 눌러 주세요. 이미지는 직접 골라 주세요.';
  $('#dlgB').innerHTML = `${r?.source === 'Pinterest' ? '' : !r ? importBlock() : `<div class="two"><label class="f"><span>링크</span><input type="url" id="addUrl" placeholder="https://…" value="${esc(r?.link || '')}"></label>
      <label class="f"><span>이미지 파일 ${r?.img_file ? '<em>(바꿀 때만)</em>' : ''}</span><input type="file" id="addFile" accept="image/png,image/jpeg,image/webp,image/gif"></label></div>`}
    <label class="f"><span>이름</span><input type="text" id="addName" maxlength="60" placeholder="예) 노을빛 피크닉 상차림" value="${esc(r?.name || '')}"></label>
    <div class="two">${pickField('addKind', '종류', kinds, kind, kName)}${pickField('addSeason', '명분·시즌 <em>(선택)</em>', seasons, r?.season || '', x => x, '없음')}</div>
    <div class="two">${pickField('addCls', '분류 <em>(선택)</em>', clss, r?.cls || '', clsName, '없음')}
      <label class="f"><span>태그 <em>(선택) 쉼표로 여러 개</em></span><input type="text" id="addTags" maxlength="120" placeholder="예) 피크닉, 보온병" value="${esc((r?.tags || []).join(', '))}"></label></div>
    ${!r ? `<div class="f" id="benBox"><span>혜택 방식 <em>(선택) 여러 개 · 가져오면 본문에서 찾아 채워요</em></span><div class="chips-row">${BENS.map(b => `<button type="button" class="chip" data-addben="${esc(b)}" aria-pressed="false">${esc(b)}</button>`).join('')}</div></div>` : ''}
    <div class="f" id="ptsBox"><span>참고할 것 <em>여러 개 · 직접 입력은 쉼표로</em></span><div class="chips-row">${pts.map(p => `<button type="button" class="chip" data-addpt="${esc(p)}" aria-pressed="${on.has(p)}">${esc(p)}</button>`).join('')}</div>
      <input type="text" id="addPtsOwn" maxlength="60" placeholder="직접 입력 (예: 조명, 여백)" aria-label="참고할 것 직접 입력"></div>
    <div id="impSecs"></div>
    <p class="cap err" id="addErr" aria-live="polite"></p>`;
  draft = null; impMethod = 'url';
  $('#dlgF').innerHTML = `<button class="btn sm primary" data-addgo ${r ? '' : 'disabled'}>${r ? '저장' : '추가'}</button>`;
  $('#dlg').showModal();
  $('#addName').focus();
}

// ---------- 수집(임시 버튼): 주소 목록을 한꺼번에 내려받아 구좌 나누기·분류까지 자동으로 추가 ----------
let collectTimer = null;
async function openCollect() {
  let urls = [], max = 30;
  try { const d = await v2api('/api/am/ai/collect/sources'); urls = d.urls || []; max = d.max || max; } catch { /* 빈 목록으로 */ }
  $('#dlgO').textContent = '레퍼런스 수집'; $('#dlgH').textContent = '링크 한꺼번에 수집하기';
  $('#dlgS').textContent = `주소를 한 줄에 하나씩 적고 [수집 시작]을 누르면 읽어서 구좌 나누기와 분류까지 자동으로 하고 라이브러리에 넣어요 (한 번에 ${max}개까지). 이미 있는 주소는 건너뛰고, 분류는 자동이라 틀릴 수 있어요.`;
  $('#dlgB').innerHTML = `<label class="f"><span>수집할 주소 <em>한 줄에 하나</em></span><textarea id="colUrls" rows="8" placeholder="https://…">${esc(urls.join('\n'))}</textarea></label>
    <div id="colOut" aria-live="polite"></div>`;
  $('#dlgF').innerHTML = '<button class="btn sm primary" data-colgo>수집 시작</button>';
  $('#dlg').showModal();
}
function colRows(items) {
  const ST = { added: ['추가됨', 'ok'], skip: ['건너뜀', ''], empty: ['본문 없음', 'err'], gone: ['없는 페이지', 'err'], fail: ['실패', 'err'] };
  return items.map(it => { const [t, c] = ST[it.status] || [it.status, '']; return `<div class="imp-row"><span class="chip ${c}">${t}</span> <b>${esc(it.name || it.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50))}</b> <span class="cap">${esc(it.msg || '')}</span></div>`; }).join('');
}
async function startCollect(btn) {
  const urls = $('#colUrls').value.split('\n').map(x => x.trim()).filter(Boolean), out = $('#colOut');
  btn.disabled = true; out.innerHTML = '<p class="hint">시작하는 중…</p>';
  try {
    const j = await v2api('/api/am/ai/collect/start', { urls });
    const tick = async () => {
      let s; try { s = await v2api('/api/am/ai/collect/status?id=' + j.id); } catch { out.innerHTML = '<p class="cap err">진행 상황을 읽지 못했어요</p>'; btn.disabled = false; return; }
      const n = s.items.filter(x => x.status === 'added').length;
      out.innerHTML = `<p class="hint">${s.state === 'done' ? `끝났어요 — ${s.total}개 중 ${n}개 추가` : `읽는 중… ${s.done}/${s.total}`}</p>${colRows(s.items)}`;
      if (s.state === 'done') { btn.disabled = false; if (n) loadLib(); return; }
      collectTimer = setTimeout(tick, 1500);
    };
    tick();
  } catch (e) { out.innerHTML = `<p class="cap err">${esc(e.message)}</p>`; btn.disabled = false; }
}

// ---------- 마켓별 신규 프로모션 찾기: 마켓 버튼 → 목록 화면에서 링크 긁기 → 우리 레퍼런스에 없는 것(신규)을 골라 추가 ----------
let DISC = [], DAILY = {}, discKey = '', discTimer = null;
const DISC_MAX = 30;
async function openDiscover() {
  $('#dlgO').textContent = '레퍼런스 수집'; $('#dlgH').textContent = '마켓별 신규 프로모션 찾기';
  $('#dlgS').textContent = `마켓을 누르면 그 마켓의 기획전·이벤트 목록을 열어 링크를 읽고, 라이브러리에 없는 새 프로모션을 알려 드려요. 추가할 것을 골라 [추가]를 누르면 상세 페이지를 읽어 구좌 나누기·분류까지 자동으로 해요 (한 번에 ${DISC_MAX}개까지). 읽기만 하고 로그인·클릭은 하지 않아요.`;
  $('#dlgF').innerHTML = '';
  $('#dlg').showModal();
  await loadDisc();
}
async function loadDisc() {
  try { const d = await v2api('/api/am/ai/discover'); DISC = d.markets || []; DAILY = d.daily || {}; } catch (e) { $('#dlgB').innerHTML = `<p class="cap err">${esc(e.message)}</p>`; return; }
  if (!discKey || !DISC.some(m => m.key === discKey)) discKey = DISC.find(m => m.checked)?.key || DISC[0]?.key || '';
  renderDisc();
}
function renderDisc(msg) {
  const m = DISC.find(x => x.key === discKey), news = m ? m.items.filter(x => x.new) : [], have = m ? m.have : 0;
  $('#dlgB').innerHTML = `<p class="cap">${DAILY.last_ok ? `마지막 자동 확인(매일 아침): ${esc(DAILY.last_ok)}` : '자동 확인 기록이 아직 없어요 (매일 자동 확인을 켜면 여기에 시각이 나와요)'}</p><div class="chips-row" id="discMarkets">${DISC.map(x => `<button type="button" class="chip" data-dmk="${esc(x.key)}" aria-pressed="${x.key === discKey}">${esc(x.label)}${x.checked ? ` · 신규 ${x.new}` : ''}</button>`).join('')}</div>
    ${m ? `<p class="hint" aria-live="polite">${msg || (m.checked ? `${esc(m.label)} · 마지막 확인 ${esc(m.at)} · 찾은 ${m.total}개 중 신규 ${news.length}개 · 이미 있음 ${m.have}개${m.ended ? ` · 끝남 ${m.ended}개` : ''} (내용으로 비교)` : `${esc(m.label)} · 아직 확인 전이에요`)}</p>
      <div class="dbar"><div class="dtools"><button class="btn sm" data-dgo="${esc(m.key)}">${m.checked ? '다시 확인' : '신규 확인'}</button>${news.length ? `<button class="btn sm" data-dall="1">전체 선택/해제</button><span class="dcount" id="dCount"></span><button class="btn sm primary" data-dadd>선택한 것 추가</button>` : ''}</div>
      <div id="colOut" class="dout" aria-live="polite"></div></div>
      <div id="discList">${dList(news.filter(x => !x.low), true)}${dLow(news.filter(x => x.low))}${!news.length && m.checked ? '<p class="cap">새로 올라온 프로모션이 없어요.</p>' : ''}</div>` : ''}`;
  $('#dlgF').innerHTML = '';
  discCount();
}
const dUnread = x => x.score == null && /^[\w\-./]{1,60}$/.test(x.title || '');   // 점수도 없고 제목이 주소 조각뿐 = 목록에서 제목을 못 읽고 내용도 아직 안 본 링크 (예전 확인 결과)
function dRow(x, checked) {
  const unread = dUnread(x); checked = checked && !unread;   // 뭔지 모르는 링크는 미리 체크하지 않는다 (원본을 보고 직접 고르게)
  const why = [...(x.why || []).filter(w => w !== '기간 있음'), ...(unread ? ['제목·내용을 아직 못 읽었어요 — 원본 ↗로 확인하거나 \'다시 확인\'을 눌러 주세요'] : [])].join(' · ');
  return `<div class="drow"><label class="dmain"><input type="checkbox" class="dsel" value="${esc(x.url)}" ${checked ? 'checked' : ''}><span class="dtxt"><b>${esc(x.title || x.url.slice(0, 50))}</b><span class="dmeta">${x.changed ? '<em class="dchg">내용 바뀐 같은 링크</em> · ' : ''}처음 본 날 ${esc((x.first_seen || '').slice(5))}${why ? ` · <em class="dwhy">${esc(why)}</em>` : ''}</span></span></label>${x.score == null ? '' : `<span class="dscore ${x.low ? 'lo' : x.score >= 70 ? 'hi' : ''}" title="참고 가치 점수(규칙 계산)">참고 ${x.score}</span>`}<a class="dlink" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" aria-label="원본 열기">원본 ↗</a></div>`;
}
function dList(items, pick) {
  if (!items.length) return '';
  let n = 0;
  return `<div class="dlist">${items.map(x => dRow(x, pick && !dUnread(x) && n++ < DISC_MAX)).join('')}</div>`;
}
function dLow(items) {
  if (!items.length) return '';
  return `<details class="dlow"><summary>참고 가치 낮음 ${items.length}개 접어 둠 <span class="cap">(카드·결제 행사, 상설 코너, 내용 적음 등 · 눌러서 보기)</span></summary>${dList(items, false)}</details>`;
}
function discCount() {
  const all = [...document.querySelectorAll('.dsel')], n = all.filter(x => x.checked).length, c = $('#dCount'), b = $('[data-dadd]');
  all.forEach(x => { x.disabled = !x.checked && n >= DISC_MAX; });   // 한 번에 DISC_MAX개까지: 가득 차면 나머지는 눌러지지 않게 막는다
  if (c) c.textContent = n >= DISC_MAX ? `${n}/${DISC_MAX}개 선택 (최대)` : `${n}개 선택`;
  if (b) { b.textContent = n ? `선택한 ${n}개 추가` : '선택한 것 추가'; b.disabled = !n; }
}
async function discGo(key, btn) {
  btn.disabled = true; renderDiscBusy(`${DISC.find(x => x.key === key)?.label || ''} 목록과 각 페이지 내용을 읽는 중… (1~5분, 창을 닫아도 계속돼요)`);
  try {
    const j = await v2api('/api/am/ai/discover/start', { market: key });
    const tick = async () => {
      let s; try { s = await v2api('/api/am/ai/discover/status?id=' + j.id); } catch { renderDisc('진행 상황을 읽지 못했어요'); return; }
      if (s.state === 'running') { discTimer = setTimeout(tick, 1500); return; }
      await loadDisc(); if (s.state === 'error') renderDisc(s.error);
    };
    tick();
  } catch (e) { await loadDisc(); renderDisc(e.message); }
}
function renderDiscBusy(msg) { $('#discList') && ($('#discList').innerHTML = ''); const h = $('#dlgB .hint'); if (h) h.textContent = msg; $('#dlgB [data-dgo]')?.setAttribute('disabled', ''); }
async function discAdd(btn) {
  const urls = [...document.querySelectorAll('.dsel:checked')].map(x => x.value), out = $('#colOut');
  if (!urls.length) { out.innerHTML = '<p class="cap err">추가할 프로모션을 골라 주세요</p>'; return; }
  if (urls.length > DISC_MAX) { out.innerHTML = `<p class="cap err">한 번에 ${DISC_MAX}개까지예요. ${urls.length - DISC_MAX}개를 빼 주세요</p>`; return; }
  btn.disabled = true; out.innerHTML = '<p class="hint">시작하는 중…</p>';
  try {
    const j = await v2api('/api/am/ai/collect/start', { urls, allow_known: true });
    const tick = async () => {
      let s; try { s = await v2api('/api/am/ai/collect/status?id=' + j.id); } catch { out.innerHTML = '<p class="cap err">진행 상황을 읽지 못했어요</p>'; btn.disabled = false; return; }
      const n = s.items.filter(x => x.status === 'added').length;
      out.innerHTML = `<p class="hint">${s.state === 'done' ? `끝났어요 — ${s.total}개 중 ${n}개 추가` : `읽는 중… ${s.done}/${s.total}`}</p>${colRows(s.items)}`;
      if (s.state === 'done') { btn.disabled = false; if (n) { loadLib(); const keep = out.innerHTML; loadDisc().then(() => { const o = $('#colOut'); if (o) o.innerHTML = keep; }); } return; }
      discTimer = setTimeout(tick, 1500);
    };
    tick();
  } catch (e) { out.innerHTML = `<p class="cap err">${esc(e.message)}</p>`; btn.disabled = false; }
}

// ---------- 새 레퍼런스 가져오기: 링크/HTML 파일 → 서버가 읽고 분류한 초안 → 확인·수정 → 추가 ----------
const BENS = ['쿠폰', '하루특가', '사은품', '페이백', '포인트', '무료배송', '카드혜택'];
const ROLE_KO = { hero: '메인 비주얼', product_list: '상품 목록', coupon_offer: '쿠폰', sale_offer: '특가·세일', benefit_overview: '혜택 안내', partner_benefit: '제휴 혜택', brand_story: '브랜드 스토리', editorial_story: '소개·스토리', brand_intro: '브랜드 소개',
  lookbook: '룩북', visual_gallery: '이미지', participation_event: '참여 이벤트', terms_notice: '유의사항', section_navigation: '바로가기', related_promotions: '관련 기획전', share: '공유', app_promo: '앱 안내', live_commerce: '라이브', content: '기타', image_block: '이미지', ui_noise: '메뉴·안내' };
let draft = null, impMethod = 'url';
function importBlock() {
  return `<div class="f" id="impBox"><span>어떻게 가져올까요? <em>가져오면 이름·분류를 먼저 채워 드려요. 확인하고 고친 뒤 [추가]를 눌러 주세요</em></span>
    <div class="chips-row" id="impMethods">${[['url', '링크'], ['html', 'HTML 파일'], ['img', '이미지']].map(([k, n]) => `<button type="button" class="chip" data-impm="${k}" aria-pressed="${k === 'url'}">${n}</button>`).join('')}</div>
    <div id="impIn">${impInput('url')}</div><p class="cap" id="impSt" aria-live="polite"></p></div>`;
}
function impInput(m) {
  if (m === 'url') return '<div class="two"><label class="f"><span>링크 <em>서버가 HTML을 내려받아요</em></span><input type="url" id="addUrl" placeholder="https://…"></label><div class="f"><span>&nbsp;</span><button type="button" class="btn sm" data-impload="url">불러오기</button></div></div>';
  if (m === 'html') return '<label class="f"><span>HTML 파일 <em>브라우저에서 \'페이지를 HTML로 저장\'한 파일 (5MB까지)</em></span><input type="file" id="impFile" accept=".html,.htm,text/html"></label>';
  return '<label class="f"><span>이미지 파일 <em>내용은 읽지 않아요 — 아래 항목을 직접 골라 주세요 (5MB까지)</em></span><input type="file" id="addFile" accept="image/png,image/jpeg,image/webp,image/gif"></label>';
}
function impSetMethod(m) {
  impMethod = m; draft = null;
  document.querySelectorAll('[data-impm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.impm === m)));
  $('#impIn').innerHTML = impInput(m); $('#impSt').textContent = ''; $('#impSecs').innerHTML = '';
  $('[data-addgo]').disabled = true;
}
function setPick(id, val) {
  const sel = $(`#${id}`), own = $(`#${id}Own`);
  if (!val) { sel.value = ''; if (own) own.hidden = true; return; }
  if ([...sel.options].some(o => o.value === val)) { sel.value = val; if (own) own.hidden = true; }
  else { sel.value = OWN_CHOICE; if (own) { own.hidden = false; own.value = val; } }
}
function impFill(d) {
  draft = d;
  $('#addName').value = d.name || ''; setPick('addKind', d.kind || 'page'); setPick('addSeason', d.season || ''); setPick('addCls', d.cls || '');
  document.querySelectorAll('[data-addben]').forEach(b => b.setAttribute('aria-pressed', String((d.ben || []).includes(b.dataset.addben))));
  if (d.link && $('#addUrl') && !$('#addUrl').value) $('#addUrl').value = d.link;
  const ff = d.fields_from || {};
  $('#impSt').innerHTML = `불러왔어요 · <b>${esc(d.type_name || '')}</b> 유형으로 보여요 (확신 ${esc({ medium: '중간', 'low-medium': '낮음', low: '낮음' }[d.confidence] || d.confidence)})<br>이름: ${esc(ff.name || '')} · 명분·시즌: ${esc(ff.season || '')} · 분류: ${esc(ff.cls || '')} · 구좌: ${esc(ff.sections || '')}`;
  const warn = (d.warnings || []).map(w => `<p class="cap warn">${esc(w)}</p>`).join('');
  $('#impSecs').innerHTML = `${warn}<div class="f"><span>나눈 구좌 ${d.sections.length}개 <em>자동으로 나눈 거라 틀릴 수 있어요. 추가하면 구좌 사례로 검색돼요</em></span><ol class="imp-secs">${d.sections.map(x => `<li><b>${esc(x.title || '(제목 없음)')}</b> <span class="tag">${esc(ROLE_KO[x.role] || x.role)}</span> <span class="cap">${esc((x.text || '').slice(0, 60))}</span></li>`).join('')}</ol></div>`;
  $('[data-addgo]').disabled = false;
}
async function impLoad(body, st) {
  $('#addErr').textContent = ''; $('#impSt').textContent = st; $('#impSecs').innerHTML = ''; draft = null; $('[data-addgo]').disabled = true;
  document.querySelectorAll('[data-impload]').forEach(b => { b.disabled = true; });
  try { impFill(await v2api('/api/am/ai/intake/preview', body)); }
  catch (e) { $('#impSt').textContent = ''; $('#addErr').textContent = e.message; }
  document.querySelectorAll('[data-impload]').forEach(b => { b.disabled = false; });
}
const readHtml = async file => { const buf = await file.arrayBuffer(); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('euc-kr').decode(buf); } };
const pickVal = id => { const s = $(`#${id}`); return s.value === OWN_CHOICE ? $(`#${id}Own`).value.trim() : s.value; };
const readFile = file => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => no(new Error('파일을 읽지 못했어요')); fr.readAsDataURL(file); });
async function saveAdd(btn) {
  const err = m => { $('#addErr').textContent = m; };
  if (draft) {   // 링크·HTML로 가져온 초안: 담당자가 고친 값으로 추가
    for (const id of ['addKind', 'addSeason', 'addCls']) if ($(`#${id}`).value === OWN_CHOICE && !$(`#${id}Own`).value.trim()) { err('직접 입력 칸을 채우거나 다른 값을 골라 주세요'); $(`#${id}Own`).focus(); return; }
    const kv = pickVal('addKind'), base = BASE_TABS.find(t => t[0] === kv || t[1] === kv);
    const body = { draft_id: draft.draft_id, name: ($('#addName').value.trim() || draft.name).slice(0, 60), kind: base ? base[0] : 'etc', kind_label: base ? '' : kv, season: pickVal('addSeason'), cls: pickVal('addCls'),
      ben: [...document.querySelectorAll('[data-addben][aria-pressed="true"]')].map(b => b.dataset.addben), mode: draft.mode || [], type: draft.type || '',
      pts: uniq([...[...document.querySelectorAll('[data-addpt][aria-pressed="true"]')].map(b => b.dataset.addpt), ...$('#addPtsOwn').value.split(',').map(s => s.trim().slice(0, 20))]).filter(Boolean).slice(0, 10),
      tags: uniq($('#addTags').value.split(',').map(s => s.trim().replace(/^#/, '').slice(0, 20))).filter(Boolean).slice(0, 20) };
    btn.disabled = true; err('');
    try {
      const out = await v2api('/api/am/ai/intake/commit', body);
      const v = upsert(out); tab = tk(v); f = {}; cur = v.id; $('#dlg').close(); render();
      toast(`'${tabsList().find(t => t[0] === tab)?.[1] || kv}' 탭에 추가했어요. 구좌 ${draft.sections.length}개는 추천 검색에도 쓰여요`);
    } catch (e) { err(e.message); btn.disabled = false; }
    return;
  }
  const urlEl = $('#addUrl'), fileEl = $('#addFile');
  const raw = urlEl ? urlEl.value.trim() : editing?.link || '', file = fileEl?.files[0];
  let link = raw;
  if (raw) { let u; try { u = new URL(raw); } catch { u = null; } if (!u || !/^https?:$/.test(u.protocol)) { err('링크는 http나 https로 시작하는 주소를 넣어 주세요'); urlEl?.focus(); return; } }
  if (file) { if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { err('PNG·JPG·WEBP·GIF 이미지만 올릴 수 있어요'); return; } if (file.size > 5 * 1024 * 1024) { err('5MB가 넘는 이미지는 올릴 수 없어요'); return; } }
  if (!link && !file && !editing?.img_file && !editing?.pin_img) { err('링크나 이미지 파일을 하나 넣어 주세요'); urlEl?.focus(); return; }
  for (const id of ['addKind', 'addSeason', 'addCls']) if ($(`#${id}`).value === OWN_CHOICE && !$(`#${id}Own`).value.trim()) { err('직접 입력 칸을 채우거나 다른 값을 골라 주세요'); $(`#${id}Own`).focus(); return; }
  const kv = pickVal('addKind'), base = BASE_TABS.find(t => t[0] === kv || t[1] === kv);
  const pts = uniq([...[...document.querySelectorAll('[data-addpt][aria-pressed="true"]')].map(b => b.dataset.addpt), ...$('#addPtsOwn').value.split(',').map(s => s.trim().slice(0, 20))]).slice(0, 10);
  const tags = uniq($('#addTags').value.split(',').map(s => s.trim().replace(/^#/, '').slice(0, 20))).slice(0, 20);
  let name = $('#addName').value.trim();
  if (!name) { try { name = link ? new URL(link).hostname.replace(/^www\./, '') : file ? file.name.replace(/\.[^.]+$/, '') : editing?.name || ''; } catch { name = ''; } }
  const item = { ...(editing ? bodyOf(editing) : { source: '직접 추가', memo: '' }), kind: base ? base[0] : 'etc', kind_label: base ? '' : kv, name: name.slice(0, 60) || '이름 없는 레퍼런스', season: pickVal('addSeason'), cls: pickVal('addCls'), link, pts, tags };
  btn.disabled = true; err('');
  try {
    let out = await v2api('/api/am/references', item);
    if (file) {
      try { const r2 = await v2api(`/api/am/references/${out.id}/image`, { data_url: await readFile(file) }); out = { ...out, img_file: r2.img_file, updated_at: `${out.updated_at}i` }; }
      catch (e) { upsert(out); err(`레퍼런스는 저장했지만 이미지를 올리지 못했어요: ${e.message}`); btn.disabled = false; render(); return; }
    }
    const v = upsert(out); tab = tk(v); f = {}; cur = v.id; $('#dlg').close(); render();
    toast(editing ? '고친 내용을 저장했어요' : `'${tabsList().find(t => t[0] === tab)?.[1] || kv}' 탭에 추가했어요`);
  } catch (e) { err(e.message); }
  btn.disabled = false;
}
async function delRef(id) {
  const r = byId(id); if (!r?.own) return;
  if (!confirm(`'${r.name}'을(를) 지울까요?${r.img_file ? ' 올린 이미지도 함께 지워져요.' : ''} 되돌릴 수 없어요.`)) return;
  try { await v2api(`/api/am/references/${id}/delete`, {}); OWN = OWN.filter(x => x.id !== id); FAV.delete(id); cur = null; render(); toast('레퍼런스를 지웠어요'); }
  catch (e) { toast(`지우지 못했어요: ${e.message}`); }
}
// 수집본 페이지 삭제: 색인 파일은 그대로 두고 삭제 목록에만 적는다 (색인을 다시 만들어도 안 나오고, 되돌릴 수 있다)
async function hideRef(id) {
  const r = byId(id); if (!r) return;
  if (!confirm(`'${r.name}'을(를) 라이브러리에서 지울까요?\n이 페이지의 구좌도 함께 안 보이고 구좌 추천에도 쓰이지 않아요. 수집을 다시 해도 다시 나오지 않아요.`)) return;
  try {
    await v2api('/api/am/ai/hide', { id, on: true });
    for (let i = R.length - 1; i >= 0; i--) if (R[i].id === id || R[i].page === id) R.splice(i, 1);
    FAV.delete(id); cur = null; render(); toast('레퍼런스를 지웠어요');
  } catch (e) { toast(`지우지 못했어요: ${e.message}`); }
}
async function toggleFav(id) {
  const on = !FAV.has(id); on ? FAV.add(id) : FAV.delete(id); render();
  toast(on ? "즐겨찾기에 넣었어요. '즐겨찾기만'을 켜면 모아 볼 수 있어요" : '즐겨찾기에서 뺐어요');
  try { FAV = new Set((await v2api('/api/am/references/favorite', { id, on })).favorites); }
  catch (e) { on ? FAV.delete(id) : FAV.add(id); render(); toast(`즐겨찾기를 저장하지 못했어요: ${e.message}`); }
}
let memoT;
function saveMemo(id, text) {
  const r = byId(id); if (!r) return; r.memo = text;
  if (!r.own) return;
  clearTimeout(memoT); $('#memoSt').textContent = '';
  memoT = setTimeout(async () => { try { const out = await v2api('/api/am/references', bodyOf(r)); upsert(out); const st = $('#memoSt'); if (st) st.textContent = '저장했어요'; } catch (e) { const st = $('#memoSt'); if (st) st.textContent = `저장하지 못했어요: ${e.message}`; } }, 700);
}

// ================= 동작 =================
document.addEventListener('change', e => { if (e.target.classList?.contains('dsel')) discCount(); });
document.addEventListener('click', e => {
  const t = e.target, d = k => t.closest(`[data-${k}]`), v = k => d(k)?.dataset[k];
  if (d('tab')) { const k = v('tab'); if (k === tab) return; tab = k; f = {}; cur = null; if (tab === 'pin' && pinState === 'idle') loadPins(); render(); document.querySelector(`[data-tab="${CSS.escape(tab)}"]`)?.focus(); return; }
  if (d('f')) { const [k, ...rest] = v('f').split('|'), o = rest.join('|'); f[k] = f[k] === o ? '' : o; render(); document.querySelector(`[data-f="${CSS.escape(`${k}|${o}`)}"]`)?.focus(); return; }
  if (d('clearall') || t.closest('#clearAll')) { f = {}; q = ''; favOnly = false; $('#q').value = ''; render(); return; }
  if (t.closest('#favOnly')) { favOnly = !favOnly; render(); return; }
  if (d('sclear')) { q = ''; $('#q').value = ''; render(); $('#q').focus(); return; }
  if (d('star')) { toggleFav(v('star')); return; }
  if (d('open')) { const fromDlg = d('fromdlg'); cur = v('open'); if (fromDlg) $('#dlg').close(); const r = byId(cur); if (r && tk(r) !== tab) { tab = tk(r); f = {}; } render(); return; }
  if (d('close') || t.id === 'scrim') { cur = null; render(); return; }
  if (d('hide')) { hideRef(v('hide')); return; }
  if (d('colgo')) { startCollect(d('colgo')); return; }
  if (d('snap')) { snapView(v('snap')); return; }
  if (d('whole')) { wholePage(v('whole'), d('whole').dataset.mark, d('whole').dataset.wmode === 'list' ? 'list' : ''); return; }
  if (d('kids')) { const id = v('kids'), p = R.find(x => x.id === id); tab = 'sec'; f = {}; q = p.name; $('#q').value = q; cur = null; render(); toast(`'${p.name}'의 구좌만 보여요`); return; }
  if (d('edit')) { openAdd(byId(v('edit'))); return; }
  if (d('del')) { delRef(v('del')); return; }
  if (d('addpt')) { const b = d('addpt'); b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); return; }
  if (d('addgo')) { saveAdd(d('addgo')); return; }
  if (d('impm')) { impSetMethod(v('impm')); return; }
  if (d('addben')) { const b = d('addben'); b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); return; }
  if (d('impload')) {
    const u = ($('#addUrl')?.value || '').trim();
    if (!/^https?:\/\//.test(u)) { $('#addErr').textContent = '링크는 http나 https로 시작하는 주소를 넣어 주세요'; $('#addUrl')?.focus(); return; }
    impLoad({ method: 'url', url: u }, '불러오는 중… 서버가 페이지를 내려받고 있어요 (최대 15초)'); return;
  }
  if (t.closest('#collectBtn')) { openCollect(); return; }
  if (t.closest('#discoverBtn')) { openDiscover(); return; }
  if (d('dmk')) { discKey = v('dmk'); renderDisc(); return; }
  if (d('dgo')) { discGo(v('dgo'), d('dgo')); return; }
  if (d('dall')) { const bx = [...document.querySelectorAll('.dsel')], on = bx.some(x => !x.checked); bx.forEach((x, i) => { x.disabled = false; x.checked = on && i < DISC_MAX; }); discCount(); return; }
  if (d('dadd')) { discAdd(d('dadd')); return; }
  if (t.closest('#addBtn')) { openAdd(); return; }
  if (d('unboard')) { const url = v('unboard'); v2api('/api/am/pinterest/boards/delete', { url }).then(r => { BOARDS = r.boards; PINS = PINS.filter(p => p.board !== url); render(); toast('보드 구독을 뺐어요. 이미 담은 핀은 라이브러리에 남아요'); }).catch(er => toast(er.message)); return; }
  if (d('pinsave')) { const b = d('pinsave'); b.disabled = true; savePin(v('pinsave')); return; }
  if (d('pinreload')) { loadPins(); return; }
  if (d('reload')) { loadLib(); return; }
});
document.addEventListener('submit', e => { if (e.target.id === 'boardForm') { e.preventDefault(); addBoard(); } });
document.addEventListener('change', async e => {
  const t0 = e.target;
  if (t0.id === 'impFile' && t0.files[0]) {
    const file = t0.files[0];
    if (file.size > 5 * 1024 * 1024) { $('#addErr').textContent = '5MB가 넘는 파일은 올릴 수 없어요'; return; }
    impLoad({ method: 'html', html: await readHtml(file), filename: file.name }, '파일을 읽는 중…'); return;
  }
  if (t0.id === 'addFile' && !editing && t0.files[0]) {   // 이미지: 내용은 읽지 않고 파일 이름만 채운다
    const file = t0.files[0]; draft = null;
    if (!$('#addName').value.trim()) $('#addName').value = file.name.replace(/\.[^.]+$/, '').slice(0, 60);
    setPick('addKind', 'mood'); $('#impSt').textContent = '이미지는 내용을 읽지 않아요. 종류·명분·분류를 직접 골라 주세요.'; $('[data-addgo]').disabled = false;
  }
  const t = e.target;
  if (t.dataset.own) { const o = $(`#${t.dataset.own}`); o.hidden = t.value !== OWN_CHOICE; if (!o.hidden) o.focus(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { q = t.value.trim(); render(); return; }
  if (t.dataset.memo) saveMemo(t.dataset.memo, t.value);
  if (t.id === 'boardUrl' && boardErr) { boardErr = ''; const m = $('#boardMsg'); m.classList.remove('err'); m.textContent = '공개 보드의 최근 핀(보드마다 25개 안팎)을 읽어 와요.'; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && e.target.id === 'q' && e.target.value) { e.preventDefault(); q = ''; e.target.value = ''; render(); return; }
  if (e.key === 'Escape' && cur && !$('#dlg').open) { cur = null; render(); }
});
let toastT;
function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200); }

async function loadLib() {
  try {
    const d = await v2api('/api/am/references');
    BOARDS = d.boards || []; OWN = (d.items || []).map(view); FAV = new Set(d.favorites || []); libState = 'ok'; libErr = '';
  } catch (e) { libState = 'err'; libErr = e.message; }
  try {   // 수집한 원본 페이지·구좌가 준비돼 있으면 예시 대신 그것을 보여 준다 (서버 /api/am/ai/library). 실패하면 예시 그대로
    const ai = await v2api('/api/am/ai/library');
    if (ai.mode === 'ai' && ai.items.length) { R.length = 0; R.push(...ai.items); }
  } catch (e) { /* 예시 유지 */ }
  render();
  if (tab === 'pin') loadPins();
  loadHealth();
}
// 데이터 자체 점검(서버 /api/am/ai/health): 고쳐야 할 문제가 있을 때만 맨 위에 알린다. 문제가 없거나 '확인할 것' 수준이면 아무것도 안 보인다
async function loadHealth() {
  try {
    const h = await v2api('/api/am/ai/health');
    if (h.status !== 'error') return;
    const box = document.createElement('div'); box.className = 'empty warn'; box.setAttribute('role', 'alert');
    box.innerHTML = `<b>레퍼런스 데이터에 고쳐야 할 문제가 있어요</b><br>${h.items.filter(x => x.level === 'error').map(x => `${esc(x.title)}${x.fix ? ` → ${esc(x.fix)}` : ''}`).join('<br>')}`;
    $('#grid').before(box);
  } catch (e) { /* 점검을 못 해도 화면은 그대로 */ }
}
// 다른 화면에서 /v2/library#mood 처럼 탭을 집어 열 수 있게 (브리프의 [라이브러리에서 더 보기])
{ const h = decodeURIComponent(location.hash.slice(1)); if (h === 'pin' || BASE_TABS.some(t => t[0] === h)) tab = h; }
render();
loadLib();
