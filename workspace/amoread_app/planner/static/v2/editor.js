// ================= 예시 데이터 (가상) =================
const COPY = '피크닉 가방에 차 한 병';
const TARGET = 0.45;   // 할인 후 원가율 기준 (지금 툴 config와 같은 값)
// cost = 가상 원가 (판정을 열었을 때만 원가율로 보임). after = 행사가 끝난 다음 날 상시 할인가(찾았을 때만, 블프 사례: 정가로 돌아가지 않음)
// rating·reviews = 별점·리뷰 수(리뷰 데이터에서 자동)
let PRODUCTS = [
  { seq: 'P101', name: '벚꽃 블렌딩 티 10입', price: 18000, cost: 4300, days: 210, ly: true, kw: [], after: 15300, rating: 4.8, reviews: 312 },
  { seq: 'P102', name: '피크닉 콜드브루 티 세트', price: 32000, cost: 9800, days: 95, ly: false, kw: ['피크닉', '보온병'], after: null, rating: 4.6, reviews: 88 },
  { seq: 'P103', name: '휴대용 티 텀블러 세트', price: 45000, cost: 16500, days: 400, ly: false, kw: ['보온병'], after: 40500, rating: 4.7, reviews: 140 },
  { seq: 'P104', name: '봄 꽃차 3종 선물 세트', price: 28000, cost: 8900, days: 33, ly: true, kw: [], after: 25200, rating: 4.9, reviews: 509 },
  { seq: 'P105', name: '스틱 아이스티 20입', price: 12000, cost: 3100, days: 150, ly: false, kw: ['피크닉'], after: null, rating: 4.5, reviews: 61 },
  { seq: 'P106', name: '말차 라떼 파우더', price: 15000, cost: 5200, days: 20, ly: true, kw: [], after: 13500, rating: 4.8, reviews: 809 },
  { seq: 'P107', name: '은은한 녹차 티백 40입', price: 22000, cost: 4800, days: 300, ly: false, kw: [], after: 19800, rating: 4.7, reviews: 233 },
  { seq: 'P108', name: '무카페인 허브 블렌드', price: 19000, cost: 4500, days: 180, ly: true, kw: [], after: null, rating: 4.6, reviews: 97 },
  { seq: 'P109', name: '달콤한 과일 티 세트', price: 26000, cost: 7400, days: 60, ly: false, kw: ['피크닉'], after: 23400, rating: 4.7, reviews: 175 },
  { seq: 'P110', name: '프리미엄 티 기프트 박스', price: 58000, cost: 21800, days: 75, ly: true, kw: [], after: 52200, rating: 4.9, reviews: 420 },
];
const P = Object.fromEntries(PRODUCTS.map(p => [p.seq, p]));
// 이 기획안의 상품·할인 (상품·할인 공간과 같은 값 하나). appeal = 소구문구 = PROMO_WORK 소구문구 열
let items = [
  { seq: 'P101', rate: 0.2, source: 'direct', appeal: '봄에만 만나는 벚꽃 향' }, { seq: 'P104', rate: 0.15, source: 'excel', appeal: '(재구매 1위) 받는 분도 좋아하는 꽃차' },
  { seq: 'P107', rate: 0.25, source: 'excel', appeal: '매일 마시기 좋은 기본 녹차' }, { seq: 'P110', rate: 0.24, source: 'direct', appeal: '세작부터 블렌딩까지 담은' },
  { seq: 'P106', rate: 0.1, source: 'direct', appeal: '' },
];
// 2단: 추가 혜택 (상품·할인 공간에서 정함). 자사몰 설·감사선물전 사례: 할인가에서 약 5% 더 = '얼리버드가'
let EXTRAS = [{ id: 'eb', name: '얼리버드', calc: 'sale_pct', val: 5, seqs: ['P110', 'P104'] }];   // 상품·할인과 같은 모양 (기획안이면 doc.v2.extras)
// 고객 후기 (리뷰 데이터 열: 평점, 구매후기, 나만의TIP, 베스트여부, 등록일 — 제목·작성자 없음)
let REVIEWS = [
  { id: 'v1', seq: 'P106', rating: 5, best: true, date: '2026-02-11', gift: false, repeat: true, text: '물 조금 넣고 흔든 뒤 우유에 부으면 바로 말차라떼가 돼서 출근 전에도 부담 없이 마실 수 있어요.' },
  { id: 'v2', seq: 'P106', rating: 5, best: false, date: '2026-03-02', gift: false, repeat: true, text: '벌써 세 번째 구매예요. 진하고 쓴맛이 덜해서 매일 마셔요.' },
  { id: 'v3', seq: 'P104', rating: 5, best: true, date: '2026-01-20', gift: true, repeat: false, text: '어머니 선물로 드렸는데 포장이 예쁘고 향이 은은하다고 좋아하셨어요.' },
  { id: 'v4', seq: 'P104', rating: 4, best: false, date: '2026-03-08', gift: true, repeat: false, text: '꽃향이 생각보다 진하지 않아서 좋았어요. 지인 선물용으로 또 살 생각이에요.' },
  { id: 'v5', seq: 'P101', rating: 5, best: true, date: '2026-03-15', gift: false, repeat: true, text: '봄마다 찾는 차예요. 벚꽃 향이 은은하고 아이스로 마셔도 맛있어요.' },
  { id: 'v6', seq: 'P101', rating: 3, best: false, date: '2026-03-18', gift: false, repeat: false, text: '향은 좋은데 생각보다 연해요. 두 개 넣어 마셔요.' },
];
const REFS = {
  r1: { name: '봄 캠페인 메인 비주얼', page: '○○ 봄 캠페인', from: '외부', layout: 'hero', r: [4, 5], why: '구좌 구성에서 가져온 출처예요' },
  r2: { name: '마중차 대표+2열', page: '가을 차회', from: '자사몰', layout: 'feat', r: [9, 16], why: "컨셉 이름 구좌 사례 · 대표 1 + 2×2" },
  r3: { name: '가격대별 선물 탭', page: '봄맞이 티 컬렉션', from: '자사몰', layout: 'grid2', r: [9, 16], why: '구좌 구성에서 가져온 출처예요' },
  r4: { name: '피크닉 세트 큐레이션', page: '△△ 피크닉 기획전', from: '외부', layout: 'grid2', r: [1, 1], why: "고른 키워드 '피크닉'과 맞아요" },
  r5: { name: '암호 서신 공유', page: '한글날 말의 맛, 차의 맛', from: '자사몰', layout: 'ev-share', r: [3, 4], why: '공유 유도 이벤트 사례' },
  r6: { name: '재구매 BEST 후기', page: '멤버십 리뉴얼', from: '자사몰', layout: 'review', r: [16, 9], why: '후기 구좌 사례 · 제목 + 본문 + 별점' },
  r7: { name: '혜택 한눈에 보기', page: '감사선물전', from: '자사몰', layout: 'benefit', r: [3, 4], why: '혜택 총정리 사례' },
};
const MOODS = {
  m1: { name: '돗자리 위 티타임', src: '핀터레스트 보드 · 봄 피크닉', r: [2, 3] }, m2: { name: '연둣빛 봄 색감', src: '외부 캠페인 일부', r: [4, 5] },
  m3: { name: '보온병 들고 산책', src: '핀터레스트 보드 · 아웃도어', r: [9, 16] }, m4: { name: '벚꽃 아래 찻잔', src: '자사몰 지난 행사 일부', r: [3, 4] },
};
const BRIEF_MOODS = [['m1', ['색감', '소품']], ['m2', ['색감']]];
const POINTS = ['색감', '구도', '소품', '글씨체', '카피 톤'];

// 구좌 종류: 묶음(상품 / 안내·이야기 / 이벤트 / 후기). kind = 패널에서 어떤 탭을 보일지
const LAYOUTS = [
  ['상품', [['grid2', '2열 상품'], ['grid3', '3열 상품'], ['feat', '대표 1 + 2열'], ['deal-banner', '날짜별 특가']]],
  ['안내·이야기', [['hero', '메인 비주얼'], ['text-cta', '텍스트와 버튼'], ['split', '좌우 분할'], ['benefit', '혜택 총정리'], ['story', '스토리(산지·제조·브랜드)'], ['service', '포장·서비스 안내'], ['detail', '상품 상세(체크포인트)'], ['timeline', '배송·일정 안내'], ['countdown', '카운트다운'], ['notice', '유의사항']]],
  ['이벤트', [['ev-quiz', '퀴즈·테스트'], ['ev-share', '공유 유도'], ['ev-ugc', '댓글·사진 인증'], ['ev-stamp', '출석·스탬프'], ['ev-draw', '뽑기·룰렛'], ['ev-coupon', '쿠폰 받기']]],
  ['후기', [['review', '후기 모음']]],
];
const LNAME = Object.fromEntries(LAYOUTS.flatMap(([, ls]) => ls));
const kindOf = ly => ['grid2', 'grid3', 'feat'].includes(ly) ? 'product' : ly === 'deal-banner' ? 'deal' : ly.startsWith('ev-') ? 'event' : ly === 'review' ? 'review' : 'info';

// 카드 요소 (자사몰 페이지에서 본 순서). src: 자동 = 데이터에서 / 직접 = 담당자 / AI = 연결 예정·검토 필요
const ELS = {
  img: ['상품 이미지', '자동'], label: ['모서리 라벨', '직접'], pill: ['알약', '자동·직접'], appeal: ['소구문구', '직접 · 엑셀 소구문구와 같은 값'],
  tag: ['이름 앞 태그', '직접'], name: ['상품명', '자동'], list: ['정가 (취소선)', '자동'], first: ['1단 가격 (2단일 때 취소선)', '자동'],
  pct: ['할인율 (정가 대비 최종)', '자동'], pname: ['가격 이름 (할인가·얼리버드가…)', '자동'], sale: ['판매가', '자동'],
  rating: ['별점·리뷰 수', '자동'], review: ['고객 후기 한 줄', '자동 · 실제 후기에서 고름'], ai: ['AI 후기 요약', 'AI · 연결 예정'], copy: ['카드 문구', '직접'], btn: ['버튼', '직접'],
};
const PRESETS = {
  '할인율 강조': { img: 1, label: 1, pill: 0, appeal: 1, tag: 1, name: 1, list: 1, first: 1, pct: 1, pname: 1, sale: 1, rating: 0, review: 0, ai: 0, copy: 0, btn: 0 },
  '가격 표시': { img: 1, label: 1, pill: 0, appeal: 1, tag: 1, name: 1, list: 1, first: 0, pct: 0, pname: 1, sale: 1, rating: 0, review: 0, ai: 0, copy: 0, btn: 0 },
  '이미지·상품명만': { img: 1, label: 0, pill: 0, appeal: 0, tag: 0, name: 1, list: 0, first: 0, pct: 0, pname: 0, sale: 0, rating: 0, review: 0, ai: 0, copy: 0, btn: 0 },
  '후기와 함께': { img: 1, label: 0, pill: 0, appeal: 0, tag: 0, name: 1, list: 0, first: 0, pct: 0, pname: 0, sale: 0, rating: 1, review: 1, ai: 0, copy: 0, btn: 0 },
};
const ORDER = ['img', 'label', 'pill', 'appeal', 'tag', 'name', 'list', 'first', 'pct', 'pname', 'sale', 'rating', 'review', 'ai', 'copy', 'btn'];
const LABELS = ['BEST', 'NEW', '한정', '재입고', 'PRESTIGE'];   // 라벨 추천 (직접 써도 됨)
// 직접 쓰는 요소: 구좌 기본값(카드 모양 탭) + 카드마다 바꾸기(카드 문구). 카드 값이 비면 기본값. 소구문구는 상품마다라 따로
const DIRECT = ['label', 'pill', 'tag', 'copy', 'btn'];
const DEF0 = { label: '', pill: '', pillText: '', tag: '', copy: '', btn: '담기' };
const LABEL_DL = `<datalist id="labelList">${LABELS.map(l => `<option value="${l}">`).join('')}</datalist>`;
const PILLS = [['', '없음'], ['up', '가격 오름 예고 (특가 종료 시 n원 비싸져요)'], ['today', '오늘만 (하루특가)'], ['until', '남은 기간 (○/○까지)'], ['own', '직접 쓰기']];
const EFFICACY = ['면역', '다이어트', '치료', '개선', '예방', '해독'];   // 지금 툴 engine.efficacy_flags와 같은 쪽의 검사 (예시 단어)
let END = '2026-03-15';

// 아이디: 화면을 열 때마다 다른 앞머리(시간·난수)를 붙여 저장된 기획안의 아이디와 겹치지 않게 (2026-11-10)
// 전에는 c1, c2…처럼 번호만 써서, 예시 데이터가 먼저 쓴 번호와 저장된 다른 구좌의 카드 번호가 겹쳐 한 카드를 고르면 다른 카드도 같이 골라졌다
let uidN = 0; const UID_SALT = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5);
const uid = p => `${p}${UID_SALT}${(++uidN).toString(36)}`;
const slot = (seq = null, x = {}) => ({ id: uid('c'), seq, copy: '', label: '', tag: '', pill: '', pillText: '', btn: '', off: [], ...x });
const cardShape = preset => ({ order: [...ORDER], on: { ...PRESETS[preset] }, def: { ...DEF0 } });
let secs = [
  { id: 's1', name: '메인 비주얼', layout: 'hero', headline: COPY, subhead: '들고 나가는 봄, 한 병의 여유', role: '', scope: '', num: false, cta: '', ctaOn: false, ctaTo: '', refs: ['r1'], att: [], notes: '', moods: [{ id: 'm3', pts: new Set(['구도']) }] },
  { id: 's2', name: '첫 잔, 벚꽃', layout: 'feat', headline: '', subhead: '', role: '돗자리를 펴고 처음 따르는 봄 한 잔', scope: '시즌 한정 티', num: true, cta: '시즌 한정 더보기', ctaOn: true, ctaTo: '시즌 한정 카테고리', refs: ['r2', 'r4'], att: [], notes: '', moods: [],
    card: { order: [...ORDER], on: { ...PRESETS['할인율 강조'], pill: 1 }, def: { ...DEF0 } }, cards: [slot('P101', { label: 'BEST', tag: '봄 한정', pill: 'up' }), slot('P104', { tag: '보자기' }), slot('P106'), slot()] },
  { id: 's3', name: '가격대별 선물 추천', layout: 'grid2', headline: '', subhead: '예산에 맞춰 골라 보세요', role: '', scope: '선물 세트', num: true, cta: '', ctaOn: false, ctaTo: '', refs: ['r3'], att: [], notes: '', moods: [], tab: 0,
    card: cardShape('가격 표시'), tabs: [{ id: 't1', name: '1만원대', cards: [slot('P107'), slot()] }, { id: 't2', name: '2만원대', cards: [slot(), slot()] }, { id: 't3', name: '3만원 이상', cards: [slot('P110', { label: 'PRESTIGE', tag: '한정 보자기' }), slot()] }] },
  { id: 's4', name: '오늘의 하루특가', layout: 'deal-banner', headline: '', subhead: '', role: '', scope: '', num: false, cta: '', ctaOn: false, ctaTo: '', refs: [], att: [], notes: '', moods: [] },
  { id: 's5', name: '먼저 마셔 본 후기', layout: 'review', headline: '', subhead: '재구매가 많은 상품의 실제 후기', role: '', scope: '', num: true, cta: '', ctaOn: false, ctaTo: '', refs: ['r6'], att: [], notes: '', moods: [],
    // order = 화면에 보이는 후기 순서 (상품이 달라도 섞어서 바꿀 수 있음). show = 후기 카드에 함께 보일 상품 정보
    rv: { shape: 'mix', groups: [{ seq: 'P106', picks: [{ id: 'v1', title: '작고 간편해서 매일 손이 가요', titleSrc: '직접' }] }, { seq: 'P104', picks: [{ id: 'v3', title: '선물로 드렸더니 좋아하셨어요', titleSrc: '직접' }] }],
      order: ['v1', 'v3'], show: { img: 1, name: 1, price: 0 }, author: 'hide' } },
  { id: 's6', name: '피크닉 사진 인증', layout: 'ev-ugc', headline: '', subhead: '우리의 봄 피크닉을 보여 주세요', role: '', scope: '', num: true, cta: '참여하기', ctaOn: true, ctaTo: '참여 화면 (댓글 쓰기)', refs: ['r5'], att: [], notes: '', moods: [],
    ev: { how: '피크닉 사진과 함께 댓글 남기기', reward: '포인트', rewardText: '추첨 50명 1,000P', pick: '추첨', count: '50', when: '3/2(월) ~ 3/15(일)', login: true, notice: '' } },
  { id: 's7', name: '봄맞이 혜택', layout: 'benefit', headline: '', subhead: '', role: '', scope: '', num: false, cta: '혜택 받기', ctaOn: true, ctaTo: '쿠폰 받기', refs: ['r7'], att: [], notes: '', moods: [] },
  { id: 's8', name: '유의사항', layout: 'notice', headline: '', subhead: '', role: '', scope: '', num: false, cta: '', ctaOn: false, ctaTo: '', refs: [], att: [], notes: '', moods: [] },
];

// 문구 칸 합치기 (2026-11-07 결정): 제목 = 구좌 이름 + 구좌 제목, 설명 = 역할 한 줄 + 서브 카피. 더 쓰고 싶으면 '문구 한 줄 추가'
secs.forEach(s => { s.name = s.headline || s.name; s.role = s.role || s.subhead || ''; s.lines = []; s.cat = ''; delete s.headline; delete s.subhead; });
secs.find(s => s.id === 's2').lines = [{ id: 'l1', text: '오늘 돗자리 위에 처음 따를 차를 골라 보세요' }];
// ================= 상태 =================
let moodLink = false;   // 느낌 레퍼런스 '링크 붙이기' 칸 펼침
// openMore = 카드 문구를 펼쳐 둔 카드들 (여러 장 동시에, 2026-11-10). 카드 아이디가 겹치지 않아 구좌를 옮겨도 각자 상태를 지킴
let cur = 's2', tab = 'shape', drafts = {}, saved = new Set(), openJudge = null, openMore = new Set(), pickFor = null, pickTab = 'plan', q = '', moodAdd = false, refMore = false;
const cardOfEl = (s, el) => { const id = el?.closest?.('[data-slot]')?.dataset.slot; return id ? allCards(s).find(x => x.id === id) : null; };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const won = n => n == null ? '' : `${Math.round(n).toLocaleString('ko-KR')}원`;
const S = () => secs.find(s => s.id === cur);
const cardsOf = s => s.tabs ? s.tabs[s.tab].cards : (s.cards ||= []);
const allCards = s => s.tabs ? s.tabs.flatMap(t => t.cards) : (s.cards || []);
const numOf = s => secs.filter(x => x.num).indexOf(s) + 1;

// ================= 가격 (단계) · 판정 =================
const itemOf = seq => items.find(i => i.seq === seq);
const rateOf = seq => seq in drafts ? drafts[seq] : (itemOf(seq)?.rate ?? 0);
const r10 = n => Math.round(n / 10) * 10;
const extraOf = seq => EXTRAS.find(e => e.seqs.includes(seq)) || null;
// 정가 → 1단(할인 행 할인율) → 2단(추가 혜택, 있을 때만). 카드의 %는 정가 대비 최종
function priceOf(seq) {
  const p = P[seq], r = rateOf(seq), first = r10(p.price * (1 - r)), ex = extraOf(seq);
  const fin = extraPrice(first, p.price, ex);
  return { list: p.price, first, fin, ex, pct: Math.round((1 - fin / p.price) * 100), pname: ex ? `${ex.name}가` : r ? '할인가' : '판매가' };
}
// 판정은 최종 가격으로 (2단을 빼면 남는 게 실제보다 커 보임). 80% 이상 차단, 할인 후 원가율 45% 넘으면 주의
function judge(seq) {
  const p = P[seq], pr = priceOf(seq);
  if (pr.fin >= p.price) return { lv: 'none', t: '할인 없음', why: '할인 없이 구좌에 놓이는 상품이에요 (PROMO_WORK 큐레이션)' };
  if (1 - pr.fin / p.price >= 0.8) return { lv: 'err', t: '확인 필요', why: '할인율 80% 이상은 막혀요' };
  if (!p.cost) return { lv: 'none', t: '원가 없음', why: '원가 정보가 없는 상품이라 판정하지 않아요' };
  const cra = p.cost / (pr.fin / 1.1);
  return cra > TARGET ? { lv: 'warn', t: '주의', cra, why: `최종가 기준 할인 후 원가율이 기준(${Math.round(TARGET * 100)}%)을 넘어요` } : { lv: 'ok', t: '괜찮음', cra, why: `최종가 기준으로 기준(${Math.round(TARGET * 100)}%) 안이에요` };
}
// 가격 오름 예고: 행사 다음 날 상시 할인가를 찾았을 때만 (정가로 가정하지 않음, plans/20 4-4-1)
function pillUp(seq) {
  const p = P[seq], pr = priceOf(seq);
  if (p.after == null) return { ok: false, why: '행사가 끝난 다음 날 가격을 찾지 못했어요. 정가로 짐작하지 않아요. 직접 쓰거나 알약을 꺼 주세요' };
  const d = p.after - pr.fin;
  return d > 0 ? { ok: true, text: `특가 종료 시 ${d.toLocaleString('ko-KR')}원 비싸져요`, why: `끝난 다음 날 상시 할인가 ${won(p.after)} 기준` } : { ok: false, why: '끝난 다음 날 가격이 지금과 같거나 더 싸요' };
}
// 카드에 보일 값: 카드에 쓴 값, 비었으면 구좌 기본값
const valOf = (c, s, k) => c[k] || s.card.def?.[k] || '';
const pillOf = (c, s) => c.pill ? { pill: c.pill, own: c.pillText } : { pill: s.card.def?.pill || '', own: s.card.def?.pillText || '' };
function pillText(c, s) {
  const { pill, own } = pillOf(c, s);
  if (!pill) return '';
  if (pill === 'own') return own;
  if (pill === 'until') return END ? `${+END.slice(5, 7)}/${+END.slice(8)}까지` : '';   // 기간을 안 정한 기획안은 빈 칸
  if (!c.seq) return pill === 'today' ? '오늘만 00%' : '특가 종료 시 0원 비싸져요';   // 상품 고르기 전 예시
  if (pill === 'today') return `오늘만 ${priceOf(c.seq).pct}%`;
  const u = pillUp(c.seq); return u.ok ? u.text : '';
}
// 켜져 있는데 비어 있는 칸 (상품이 있는 카드만): 카드에서 숨기지 않고 점선으로, 목록·미리보기에서 알림
function gapsOf(s, c) {
  if (!c.seq) return [];
  const on = k => s.card.on[k] && !c.off.includes(k);
  return ['label', 'pill', 'appeal', 'tag', 'copy', 'btn'].filter(k => on(k) && !(k === 'pill' ? pillText(c, s) : k === 'appeal' ? itemOf(c.seq)?.appeal : valOf(c, s, k)));
}
const maxRate = seq => { const p = P[seq], ex = extraOf(seq); if (!p.cost) return 0; for (let r = 80; r >= 0; r--) { if (p.cost / (extraPrice(r10(p.price * (1 - r / 100)), p.price, ex) / 1.1) <= TARGET) return r; } return 0; };   // 기준 안 가장 깊은 1단 할인 (%)

// ================= 목록 · 와이어프레임 =================
function secState(s) {
  const k = kindOf(s.layout);
  if (k === 'product') { const all = allCards(s), done = all.filter(c => c.seq).length, g = all.reduce((n, c) => n + gapsOf(s, c).length, 0);
    return [`상품 ${done}/${all.length}${g ? ` · 빈 칸 ${g}` : ''}`, done === all.length && all.length > 0 && !g]; }
  if (k === 'review') { const n = s.rv.order.length; return [`후기 ${n}개`, n > 0]; }
  if (k === 'event') { const e = s.ev; const ok = e.how && e.reward && e.when; return [ok ? '운영 조건 있음' : '운영 조건 채우기', !!ok]; }
  if (k === 'deal') return ['하루특가 편성에서', true];
  return [s.name || s.role ? '문구 있음' : '문구 없음', !!(s.name || s.role)];
}
function renderList() {
  $('#secList').innerHTML = secs.map((s, i) => { const [t, ok] = secState(s); return `<li draggable="true" data-li="${s.id}"><button data-sec="${s.id}" ${s.id === cur ? 'aria-current="true"' : ''} aria-label="${i + 1}번 구좌 ${esc(s.name)} (Alt+↑↓로 옮기기)">
    <span class="n">${i + 1}</span><span class="nm">${s.num ? `${String(numOf(s)).padStart(2, '0')} ` : ''}${esc(s.name)}</span><span class="st"><span class="dot ${ok ? 'ok' : ''}"></span>${esc(t)} · ${esc(LNAME[s.layout])}</span></button>
    <span class="mv"><button class="ib" data-secmv="${s.id}:-1" ${i ? '' : 'disabled'} aria-label="${esc(s.name)} 위로">↑</button><button class="ib" data-secmv="${s.id}:1" ${i < secs.length - 1 ? '' : 'disabled'} aria-label="${esc(s.name)} 아래로">↓</button></span></li>`; }).join('');
}
// 구좌 순서 바꾸기 (↑↓, Alt+↑↓, 끌기). 번호(01, 02…)와 와이어프레임 순서가 함께 바뀜
function moveSec(id, d) {
  const i = secs.findIndex(s => s.id === id), j = i + d; if (i < 0 || j < 0 || j >= secs.length) return false;
  [secs[i], secs[j]] = [secs[j], secs[i]]; return true;
}
// 카드 한 장. 직접 쓰는 요소는 상품이 있든 없든 같은 값(카드 값 → 구좌 기본값). 켜져 있는데 비면 점선 자리로 남김 (사라지지 않게).
// 상품을 고르기 전에는 자동 요소(상품명·가격·별점)만 예시 글
function wCard(c, s) {
  const has = !!c.seq, p = has ? P[c.seq] : null, pr = has ? priceOf(c.seq) : null, it = has ? itemOf(c.seq) : null, on = k => s.card.on[k] && !c.off.includes(k);
  const gap = t => `<span class="gap">${t}</span>`, lab = valOf(c, s, 'label'), tag = valOf(c, s, 'tag'), pt = pillText(c, s), pk = pillOf(c, s).pill;
  const parts = { img: () => `<span class="img">${on('label') ? (lab ? `<span class="lab">${esc(lab)}</span>` : '<span class="lab gap">라벨 비어 있음</span>') : ''}</span>`, label: () => '',
    pill: () => pt ? `<span class="pill">${esc(pt).replace(/(\d[\d,]*원|\d+%)/, '<b>$1</b>')}</span>` : gap(!pk ? '알약 종류 미정' : pk === 'up' ? '알약: 가격 오름 계산 불가' : '알약 문구 비어 있음'),
    appeal: () => !has ? '<span class="ap">소구문구</span>' : it?.appeal ? `<span class="ap">${esc(it.appeal)}</span>` : gap('소구문구 비어 있음'), tag: () => '',
    name: () => `<span class="nm">${on('tag') ? (tag ? `[${esc(tag)}] ` : `${gap('[태그]')} `) : ''}${has ? esc(p.name) : '상품명'}</span>`,
    list: () => !has ? '<span class="op">정가</span>' : pr.fin < pr.list ? `<span class="op">${won(pr.list)}</span>` : '',
    first: () => !has ? '<span class="op">1단 가격</span>' : pr.ex ? `<span class="op">${won(pr.first)}</span>` : '', pct: () => '', pname: () => '',
    sale: () => `<span class="pr">${on('pct') && (!has || pr.pct > 0) ? `<span class="pct">${has ? pr.pct : '00'}%</span>` : ''}${on('pname') ? `<span class="pn">${has ? esc(pr.pname) : '가격 이름'}</span>` : ''}${on('sale') ? `<span class="sp">${has ? won(pr.fin) : '판매가'}</span>` : ''}</span>`,
    rating: () => !has ? '<span class="st">★ 별점(리뷰 수)</span>' : p.rating == null ? '' : `<span class="st">★ ${p.rating}(${p.reviews})</span>`,
    review: () => { if (!has) return '<span class="rv">“후기 한 줄”</span>'; const v = REVIEWS.find(r => r.seq === c.seq && r.best); return v ? `<span class="rv">“${esc(v.text.slice(0, 34))}…”</span>` : ''; },
    ai: () => '<span class="rv">AI 후기 요약 (연결 예정)</span>',
    copy: () => { const t = valOf(c, s, 'copy'); return t ? `<span>${esc(t)}</span>` : gap('카드 문구 비어 있음'); },
    btn: () => { const t = valOf(c, s, 'btn'); return t ? `<span class="bt">${esc(t)}</span>` : gap('버튼 문구 비어 있음'); } };
  // 가격 줄: 정가·1단은 위 줄, 할인율·가격 이름·판매가는 한 줄 (판매가를 끄면 줄 전체를 그리지 않음)
  return `<div class="w-card ${has ? 'f' : 'ph'}${openMore.has(c.id) ? ' sel' : ''}" data-card="${c.id}">${s.card.order.filter(k => on(k) || (k === 'sale' && (on('pct') || on('pname')))).map(k => parts[k]()).join('')}${has ? '' : '<span class="hint">상품 고르기</span>'}</div>`;
}
function wBody(s) {
  const k = kindOf(s.layout);
  if (s.layout === 'hero') return `<div class="w-hero"><b>${esc(s.name || '메인 카피')}</b>${s.role ? `<span class="cap">${esc(s.role)}</span>` : ''}${s.lines.filter(l => l.text).map(l => `<span class="cap">${esc(l.text)}</span>`).join('')}</div>`;
  if (k === 'deal') return '<div class="w-deal">오늘 특가 마감까지 00:00:00<br><span class="cap">날짜마다 바뀌어요 · 상품은 상품·할인의 하루특가 편성에서</span></div>';
  if (k === 'product') {
    const pills = s.tabs ? `<div class="w-pills">${s.tabs.map((t, j) => `<span class="${j === s.tab ? 'on' : ''}">${esc(t.name)}</span>`).join('')}</div>` : '';
    return `${pills}<div class="w-grid ${s.layout === 'grid3' ? 'g3' : s.layout === 'feat' ? 'feat' : 'g2'}">${cardsOf(s).map(c => wCard(c, s)).join('')}</div>`;
  }
  if (k === 'review') {
    const rv = s.rv, picks = rv.order.map(id => ({ v: REVIEWS.find(r => r.id === id), pk: rv.groups.flatMap(g => g.picks).find(x => x.id === id) })).filter(x => x.v && x.pk);
    if (!picks.length) return '<div class="w-event">후기를 아직 고르지 않았어요</div>';
    const prod = seq => { const p = P[seq], pr = priceOf(seq); return `<span class="rvp">${rv.show.img ? '<span class="pimg"></span>' : ''}<span>${rv.show.name ? `<span class="nm">${esc(p.name)}</span>` : ''}${rv.show.price ? `<span class="pr">${pr.pct > 0 ? `<span class="pct">${pr.pct}%</span>` : ''}<span class="sp">${won(pr.fin)}</span></span>` : ''}</span></span>`; };
    const card = ({ v, pk }, withProd) => `<div class="w-rv">${withProd ? prod(v.seq) : ''}${pk.title ? `<b>${esc(pk.title)}</b>` : ''}<span>${esc(v.text.length > 48 ? v.text.slice(0, 48) + '…' : v.text)}</span><span class="st">${'★'.repeat(v.rating)}</span></div>`;
    const showProd = rv.show.img || rv.show.name || rv.show.price;
    if (rv.shape === 'mix') return `<div class="w-rvwrap">${picks.map(x => card(x, showProd)).join('')}</div>`;
    // 상품별 묶음: 순서에서 처음 나온 상품 차례로, 상품 정보는 묶음 머리에 한 번
    const seqs = [...new Set(picks.map(x => x.v.seq))];
    return `<div class="w-rvwrap">${seqs.map(seq => `<div class="w-rvgrp">${showProd ? prod(seq) : ''}${picks.filter(x => x.v.seq === seq).map(x => card(x, false)).join('')}</div>`).join('')}</div>`;
  }
  if (k === 'event') { const e = s.ev; return `<div class="w-event"><span>${esc(e.how || '참여 방법')}</span><span>보상: ${esc(e.rewardText || e.reward || '미정')} · ${esc(e.when || '기간 미정')}</span>${s.ctaOn && s.cta ? `<span class="go">${esc(s.cta)}</span>` : ''}</div>`; }
  if (s.layout === 'notice') return '<div class="w-lines"><span></span><span></span><span></span></div>';
  if (s.layout === 'benefit') return '<div class="w-lines"><span class="y"></span><span class="y"></span><span class="y"></span></div>';
  return '<div class="w-lines"><span></span><span></span></div>';
}
function renderPhone() {
  if (!secs.length) { $('#phone').innerHTML = '<div class="w-empty"><b>빈 페이지</b><span class="cap">구좌를 추가하면 여기에 페이지 모양이 그려져요</span><button class="btn sm primary" data-secaddopen>첫 구좌 추가</button></div>'; return; }
  $('#phone').innerHTML = secs.map((s, i) => {
    const lines = s.lines.filter(l => l.text).map(l => `<span class="role">${esc(l.text)}</span>`).join('');
    const head = s.layout === 'hero' ? '' : `${s.num ? `<span class="num">${String(numOf(s)).padStart(2, '0')}</span>` : ''}<h4>${esc(s.name)}</h4>${s.role ? `<span class="role">${esc(s.role)}</span>` : ''}${lines}`;
    const tail = kindOf(s.layout) !== 'event' && s.ctaOn && s.cta ? `<span class="w-more">${esc(s.cta)}</span>` : '';   // 이벤트는 버튼이 조건 상자 안에
    return `<button class="ws" data-sec="${s.id}" ${s.id === cur ? 'aria-current="true"' : ''} aria-label="${i + 1}번 구좌 ${esc(s.name)} 편집"><span class="lbl">${i + 1}</span>${head}${wBody(s)}${tail}</button>`;
  }).join('');
}

// ================= 패널 =================
function tabsFor(s) {
  const k = kindOf(s.layout), mid = k === 'product' ? [['shape', '카드 모양'], ['products', '상품']] : k === 'deal' ? [['products', '상품']] : k === 'event' ? [['event', '운영 조건']] : k === 'review' ? [['review', '후기']] : [];
  return [['copy', '문구'], ...mid, ['refs', '레퍼런스'], ['notes', '디자인 요청']];
}
function renderPanel() {
  const s = S();
  if (!s) {   // 구좌가 하나도 없을 때: 추천 구성에서 시작하거나 빈 페이지에서 직접 (2026-11-10)
    $('#panel').innerHTML = `<div class="ph-b empty-st"><h2>아직 구좌가 없어요</h2><p class="hint">구좌 구성 추천에서 고르거나, 빈 페이지에서 필요한 구좌를 하나씩 추가해 만들 수 있어요. 추가한 구좌는 종류·순서를 언제든 바꿀 수 있어요.</p>
      <div class="chips-row"><button class="btn sm primary" data-secaddopen>첫 구좌 추가</button>${PLAN.id ? `<a class="btn sm" href="/v2/compose?id=${PLAN.id}">구좌 구성 추천 받기</a>` : ''}</div></div>`;
    return;
  }
  const i = secs.indexOf(s), tabs = tabsFor(s);
  if (!tabs.some(t => t[0] === tab)) tab = tabs[1]?.[0] === 'refs' ? 'copy' : tabs[1][0];
  $('#panel').innerHTML = `<div class="ph-h"><div class="ph-title"><h2>${esc(s.name || '제목 없는 구좌')}</h2>
        <span class="ph-acts"><button class="btn xs ghost" data-secdup title="이 구좌를 바로 아래에 복제">복제</button><button class="btn xs ghost danger" data-secdel title="이 구좌 지우기">삭제</button></span></div>
      <div class="overline">${String(i + 1).padStart(2, '0')}번째 구좌 · ${esc(LNAME[s.layout])}</div>
      <label class="row"><span class="cap">구좌 종류</span><select data-layout aria-label="구좌 종류 바꾸기 (문구·메모는 그대로)">${LAYOUTS.map(([g, ls]) => `<optgroup label="${g}">${ls.map(([k, n]) => `<option value="${k}" ${s.layout === k ? 'selected' : ''}>${n}</option>`).join('')}</optgroup>`).join('')}</select></label></div>
    <div class="ph-tabs"><div class="seg" role="tablist" aria-label="편집 패널">${tabs.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${n}${k === 'refs' && (s.att.length + s.moods.length) ? ` ${s.att.length + s.moods.length}` : ''}</button>`).join('')}</div></div>
    <div class="ph-b" id="pbody">${({ copy: copyTab, shape: shapeTab, products: productsTab, event: eventTab, review: reviewTab, refs: refsTab, notes: notesTab })[tab](s)}</div>`;
}
// 문구 탭: 고객에게 보이는 글(와이어프레임 위에서 아래 순서) / 기획용(안 보임)
function copyTab(s) {
  const hero = s.layout === 'hero', k = kindOf(s.layout);
  return `<span class="sub">고객에게 보이는 글 <span class="hint">와이어프레임 위에서 아래 순서</span></span>
    ${hero ? '' : `<label class="ck"><input type="checkbox" data-num ${s.num ? 'checked' : ''}> 번호 붙이기 (01, 02 …)</label>`}
    <label class="f"><span>${hero ? '메인 카피' : '제목'}</span><input type="text" data-sf="name" maxlength="60" value="${esc(s.name)}" placeholder="${hero ? '' : '예) 마중차, GIFT ROOM'}">
      <span class="hint">${hero ? '브리프에서 정한 메인 카피예요. 여기서 고치면 브리프에도 바뀌어요' : '구좌 목록에도 이 제목으로 보여요'}</span></label>
    <label class="f"><span>설명 <em>(선택) 제목 아래 한두 줄</em></span><textarea data-sf="role" maxlength="200" rows="2" placeholder="예) 첫 인사를 건네며 입맛을 돋궈줄 차">${esc(s.role)}</textarea></label>
    <div class="chips-row"><button class="btn xs" type="button" data-copy-polish>AI로 문구 다듬기</button><span class="hint">입력한 설명을 자연스럽고 감각적인 광고 문장으로</span></div>
    ${s.lines.map((l, j) => `<div class="f"><span class="l">추가 문구 ${j + 1}</span><div class="lnrow"><input type="text" data-line="${j}" maxlength="120" value="${esc(l.text)}" aria-label="추가 문구 ${j + 1}">
      <span class="tools"><button class="ib" data-linemv="${j}:-1" ${j ? '' : 'disabled'} aria-label="위로">↑</button><button class="ib" data-linemv="${j}:1" ${j < s.lines.length - 1 ? '' : 'disabled'} aria-label="아래로">↓</button><button class="ib" data-linedel="${j}" aria-label="추가 문구 ${j + 1} 삭제">✕</button></span></div></div>`).join('')}
    <div class="chips-row"><button class="btn xs" data-lineadd>+ 문구 한 줄 추가</button></div>
    <div class="f"><span class="l">버튼</span><label class="ck"><input type="checkbox" data-ctaon ${s.ctaOn ? 'checked' : ''}> 이 구좌에 버튼 넣기</label>
      ${s.ctaOn ? `<div class="two"><label class="f"><span class="hint">버튼 문구</span><input type="text" data-sf="cta" maxlength="30" value="${esc(s.cta)}" placeholder="${k === 'product' ? '예) 티백 더보기' : k === 'event' ? '예) 참여하기' : '예) 혜택 받기'}"></label>
        <label class="f"><span class="hint">어디로 <em>(선택)</em></span><input type="text" data-sf="ctaTo" maxlength="60" value="${esc(s.ctaTo)}" placeholder="예) 티백 카테고리, 쿠폰 받기"></label></div>` : '<span class="hint">버튼 없이 둬요. 언제든 다시 켤 수 있어요.</span>'}</div>
    <span class="sub">기획용 <span class="hint">고객에게 안 보여요</span></span>
    ${hero ? '' : `<label class="f"><span>담는 것 <em>(선택)</em></span><input type="text" data-sf="scope" maxlength="40" value="${esc(s.scope)}" placeholder="예) 티백, 선물 세트, 티푸드"></label>`}
    ${k === 'product' ? `<label class="f"><span>엑셀 카테고리명 <em>(선택) PROMO_WORK 카테고리명</em></span><input type="text" data-sf="cat" maxlength="40" value="${esc(s.cat)}" placeholder="비워 둬요">
      <span class="hint">지난 PROMO_WORK에는 비어 있거나('가을 차회') 제목과 다른 이름('혜택 02 쿠폰가')이 섞여 있어요. 어떻게 쓸지 멘토님께 확인 중이라 기본은 비워 둬요.${s.tabs ? ' 탭 구좌는 탭마다 정해요(확인 후).' : ''}</span></label>` : ''}
    ${window.CopyRecommendation ? window.CopyRecommendation.render(s.id) : '<p class="hint">AI 추천 모듈을 불러오지 못했어요. 페이지를 새로고침해 주세요.</p>'}`;
}
// 카드 모양 탭: 이 구좌의 카드 모두에 같은 모양 (요소 켜고 끄기·순서). 위에 견본 카드를 바로 보여줌
const sampleOf = s => cardsOf(s).find(c => c.seq) || slot();
const PH = { label: '예) BEST', tag: '예) 한정 보자기', copy: '예) 선물 포장 무료', btn: '예) 담기' }, MAX = { label: 20, tag: 20, copy: 60, btn: 20, pillText: 30 };
// 알약 고르기 (구좌 기본값이면 first = ['', '없음'], 카드면 ['', '구좌 기본값 따르기'])
const pillSel = (attr, val, first, upOk = true) => `<select ${attr} aria-label="알약 종류">${[first, ...PILLS.slice(1)].map(([v, n]) => `<option value="${v}" ${val === v ? 'selected' : ''} ${v === 'up' && !upOk && val !== 'up' ? 'disabled' : ''}>${n}${v === 'up' && !upOk ? ' — 계산 불가' : ''}</option>`).join('')}</select>`;
// 카드 모양 탭의 기본값 칸: 직접 쓰는 요소를 켜면 그 자리에서 이 구좌 카드 모두의 기본 글을 정함
function defRow(s, k) {
  const d = s.card.def, nm = ELS[k][0];
  if (k === 'appeal') return '<div class="def"><span class="hint">상품마다 달라요. 카드를 눌러 카드 문구에서 써요 (상품·할인·엑셀과 같은 값)</span></div>';
  if (k === 'pill') return `<div class="def">${pillSel('data-df="pill"', d.pill, ['', '없음'])}${d.pill === 'own' ? `<input type="text" data-df="pillText" maxlength="30" value="${esc(d.pillText)}" placeholder="예) 마지막 수량" aria-label="알약 기본 문구">` : ''}
    <span class="hint">카드마다 바꿀 수 있어요${d.pill === 'up' ? ' · 다음 날 가격을 못 찾은 상품은 빈 칸으로 보여요' : ''}</span></div>`;
  return `<div class="def"><input type="text" data-df="${k}" maxlength="${MAX[k]}" value="${esc(d[k])}" placeholder="${PH[k]}" aria-label="${nm} 기본값" ${k === 'label' ? 'list="labelList"' : ''}>
    <span class="hint">이 구좌 카드 모두 · 카드마다 바꿀 수 있어요</span></div>`;
}
function shapeTab(s) {
  const sample = sampleOf(s), sh = s.card;
  return `${LABEL_DL}<div class="f"><span class="l">견본 카드 <em>${sample.seq ? '첫 상품으로 보여요' : '상품이 없어도 예시 글로 자리를 채워요'}</em></span><div class="sample">${wCard(sample, s)}</div></div>
    <div class="f"><span class="l">카드 모양 <em>이 구좌의 카드 모두 · 순서는 ↑↓ · 직접 쓰는 요소는 켜면 기본 글을 바로 써요</em></span>
      <div class="chips-row"><span class="cap">빠른 설정</span>${Object.keys(PRESETS).map(k => `<button class="chip" data-preset="${k}">${k}</button>`).join('')}</div>
      <ul class="els">${sh.order.map((k, j) => `<li class="el ${sh.on[k] ? '' : 'off'}"><input type="checkbox" data-elon="${k}" ${sh.on[k] ? 'checked' : ''} ${k === 'ai' ? 'disabled' : ''} aria-label="${ELS[k][0]} 보이기">
        <span><span class="nm">${ELS[k][0]}</span> <span class="src">${ELS[k][1]}</span></span>
        <span class="tools"><button class="ib" data-elmv="${j}:-1" ${j ? '' : 'disabled'} aria-label="${ELS[k][0]} 위로">↑</button><button class="ib" data-elmv="${j}:1" ${j < sh.order.length - 1 ? '' : 'disabled'} aria-label="${ELS[k][0]} 아래로">↓</button></span>
        ${sh.on[k] && (DIRECT.includes(k) || k === 'appeal') ? defRow(s, k) : ''}</li>`).join('')}</ul>
      <span class="hint">요소 목록은 늘릴 수 있어요. 지금 목록은 자사몰 지난 페이지에서 본 것이에요.</span></div>
`;
}
function productsTab(s) {
  if (s.layout === 'deal-banner') return `<div class="info-box">하루특가는 날짜마다 상품이 바뀌어서 상품·할인의 하루특가 편성에서 정해요. 여기서는 구좌 모양과 문구만 정해요.</div>
    ${liveOn ? '<button class="btn sm" data-godeals>하루특가 편성 열기</button>' : '<button class="btn sm" data-toast="예시예요: 상품·할인의 하루특가 편성을 열어요">하루특가 편성 열기</button>'}`;
  const cards = cardsOf(s), nDraft = Object.keys(drafts).length, sh = s.card;
  const tabsEd = s.tabs ? `<div class="f"><span class="l">탭 <em>탭 하나가 PROMO_WORK 칸 하나 · 고객은 첫 탭을 먼저 봐요</em></span><div class="tabs-ed">${s.tabs.map((t, j) => `<div class="tabrow" ${j === s.tab ? 'aria-current="true"' : ''}>
        <input type="text" data-tabname="${j}" value="${esc(t.name)}" maxlength="40" aria-label="${j + 1}번 탭 이름">
        <span class="tools"><button class="ib" data-tabpick="${j}" aria-label="${esc(t.name)} 탭 상품 보기" title="이 탭 상품 보기">▸</button><button class="ib" data-tabmv="${j}:-1" ${j ? '' : 'disabled'} aria-label="위로">↑</button><button class="ib" data-tabmv="${j}:1" ${j < s.tabs.length - 1 ? '' : 'disabled'} aria-label="아래로">↓</button><button class="ib" data-tabdel="${j}" ${s.tabs.length > 1 ? '' : 'disabled'} aria-label="${esc(t.name)} 탭 삭제">✕</button></span></div>`).join('')}</div>
      <div><button class="btn xs" data-tabadd>+ 탭 추가</button></div></div>` : '';
  return `    ${tabsEd}
    <p class="hint">카드에 무엇을 보일지는 '카드 모양' 탭에서 정해요. 여기서는 상품·할인과 카드마다의 글(▸ 카드 문구)을 다뤄요. 와이어프레임의 카드를 눌러도 열려요.</p>
    <div class="f"><span class="l">카드${s.tabs ? ` · '${esc(s.tabs[s.tab].name)}' 탭` : ''} <em>${cards.filter(c => c.seq).length}/${cards.length}칸 · 할인율은 1단(할인 행), 금액은 최종가</em></span>
      ${cards.length > 1 ? `<div class="chips-row"><span class="hint">카드 문구는 여러 장을 함께 펼쳐 고칠 수 있어요</span><span class="grow"></span><button class="btn xs ghost" data-moreall="open">모두 펼치기</button><button class="btn xs ghost" data-moreall="close">모두 접기</button></div>` : ''}
      <ul class="slots">${cards.map((c, k) => slotHTML(c, k, s)).join('')}</ul>
      <div><button class="btn xs" data-addcard>+ 빈 카드</button></div></div>
    ${nDraft ? `<div class="applybar" role="status"><span class="grow">할인 ${nDraft}건을 바꿨어요. 반영하면 상품·할인에도 같은 값이 들어가요</span><button class="btn xs" data-undo>되돌리기</button><button class="btn xs primary" data-apply>반영</button></div>` : ''}`;
}
function slotHTML(c, k, s) {
  const open = openMore.has(c.id), g = gapsOf(s, c).length, more = `<button class="btn xs" data-more="${c.id}" aria-expanded="${open}">${open ? '▾' : '▸'} 카드 문구${g ? ` · 빈 칸 ${g}` : ''}</button>`;
  if (!c.seq) return `<li class="slot" data-slot="${c.id}"><div class="row1"><span class="nm none">카드 ${k + 1} · 상품 미정</span><span></span>${more}<button class="btn xs primary" data-pick="${c.id}">상품 고르기</button></div>${open ? cardMore(c, s) : ''}</li>`;
  const p = P[c.seq], pr = priceOf(c.seq), j = judge(c.seq), it = itemOf(c.seq);
  return `<li class="slot" data-slot="${c.id}"><div class="row1"><span class="nm" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="rate"><input type="number" data-rate="${c.seq}" min="0" max="90" step="1" value="${Math.round(rateOf(c.seq) * 100)}" aria-label="${esc(p.name)} 1단 할인율 (%)">%</span>
      <span class="fin">${won(pr.fin)}<small>${pr.ex ? `${esc(extraText(pr.ex))} · 정가 대비 ${pr.pct}%` : pr.pct ? `정가 대비 ${pr.pct}%` : '할인 없음'}</small></span>
      <button class="judge ${j.lv}" data-judge="${c.id}" aria-expanded="${openJudge === c.id}" title="눌러서 근거 보기">${j.t}</button></div>
    <div class="row2">${c.seq in drafts ? '<span class="draft">할인 바꿈</span>' : ''}${it?.source === 'excel' ? '<span class="tag">엑셀로 받음</span>' : ''}<span class="grow"></span>
      ${more}<button class="btn xs" data-pick="${c.id}">바꾸기</button><button class="ib" data-rmcard="${c.id}" aria-label="${esc(p.name)} 카드 삭제">✕</button></div>
    ${openJudge === c.id ? `<div class="row2"><div class="jpop">${j.cra != null ? `최종가 ${won(pr.fin)} 기준 할인 후 원가율 <b>${Math.round(j.cra * 100)}%</b> · ${esc(j.why)}<br>기준 안에서 가장 깊은 1단 할인은 <b>${maxRate(c.seq)}%</b>예요${pr.ex ? ` (${esc(pr.ex.name)} 포함)` : ''}. 원가 정보라 디자이너 기획안에는 넣지 않아요.` : esc(j.why)}</div></div>` : ''}
    ${open ? cardMore(c, s) : ''}</li>`;
}
// 카드 문구: 이 구좌에서 켜진 요소를 카드 순서대로. 직접 쓰는 요소는 입력칸(비우면 구좌 기본값), 자동 요소는 어디서 오는지만
function cardMore(c, s) {
  const d = s.card.def, ks = s.card.order.filter(k => s.card.on[k] && !c.off.includes(k)), short = k => ELS[k][0].replace(/ \(.*\)/, '');
  const mine = k => k === 'pill' ? !!c.pill : !!c[k];
  const state = k => mine(k) ? `<span class="tag">이 카드만</span><button class="btn xs ghost" data-cfreset="${k}">기본값으로</button>`
    : (k === 'pill' ? d.pill : d[k]) ? '<span class="hint">구좌 기본값을 쓰고 있어요</span>' : '';
  const field = k => {
    if (k === 'appeal') {
      if (!c.seq) return '<div class="f"><span class="l">소구문구</span><span class="hint">상품을 고르면 그 상품의 소구문구가 들어가요</span></div>';
      const it = itemOf(c.seq), fl = EFFICACY.filter(w => (it?.appeal || '').includes(w));
      return `<label class="f"><span>소구문구 <em>상품마다 · 상품·할인·엑셀과 같은 값 · 상품을 바꾸면 그 상품 것으로</em></span><input type="text" data-appeal="${c.seq}" maxlength="80" value="${esc(it?.appeal || '')}" placeholder="예) 세작, 우전, 홍우전까지 포함한">
        ${fl.length ? `<span class="warnline">효능으로 읽힐 수 있는 표현: ${fl.join(', ')}</span>` : ''}</label>`;
    }
    if (k === 'pill') {
      const up = c.seq ? pillUp(c.seq) : { ok: true }, cur = pillOf(c, s);
      return `<div class="f"><span class="l">알약 ${state(k)}</span>${pillSel('data-cf="pill"', c.pill, ['', `구좌 기본값 따르기 (${(PILLS.find(x => x[0] === d.pill) || PILLS[0])[1].replace(/ \(.*\)/, '')})`], up.ok)}
        ${c.pill === 'own' ? `<input type="text" data-cf="pillText" maxlength="30" value="${esc(c.pillText)}" placeholder="직접 쓰기" aria-label="알약 문구"><span class="hint">가격·기간 숫자를 쓰면 한 번 더 확인해 주세요</span>` : ''}
        ${cur.pill === 'up' && c.seq ? `<span class="hint">${esc(up.ok ? `${up.text} · ${up.why}` : `가격 오름 예고: ${up.why}`)}</span>` : ''}</div>`;
    }
    return `<label class="f"><span>${ELS[k][0]} ${state(k)}</span><input type="text" data-cf="${k}" maxlength="${MAX[k]}" value="${esc(c[k])}" placeholder="${d[k] ? esc(d[k]) : PH[k]}" ${k === 'label' ? 'list="labelList"' : ''}>
      ${!c[k] && !d[k] ? '<span class="hint">비어 있어요. 여기나 카드 모양 탭(구좌 기본값)에서 써 주세요</span>' : ''}</label>`;
  };
  const rows = ks.filter(k => DIRECT.includes(k) || k === 'appeal').map(field).join('');
  const auto = ks.filter(k => !DIRECT.includes(k) && !['appeal', 'img', 'ai', 'pct', 'pname'].includes(k));
  return `<div class="more">${LABEL_DL}
    ${rows || '<p class="hint">직접 쓰는 요소(라벨·알약·태그·카드 문구·버튼)가 모두 꺼져 있어요. 카드 모양 탭에서 켜요.</p>'}
    ${auto.length ? `<p class="hint">자동으로 채워요: ${auto.map(short).join(' · ')} — 상품 데이터에서 와요</p>` : ''}
    <div class="f"><span class="l">이 카드에서만 끄기</span><div class="chips-row">${s.card.order.filter(k => s.card.on[k]).map(k => `<button class="chip" data-off="${c.id}|${k}" aria-pressed="${c.off.includes(k)}">${short(k)}</button>`).join('')}</div></div></div>`;
}
function eventTab(s) {
  const e = s.ev, f = (lab, key, ph) => `<label class="f"><span>${lab}</span><input type="text" data-ev="${key}" value="${esc(e[key])}" placeholder="${esc(ph)}"></label>`;
  return `<div class="info-box">이벤트 구좌는 상품 대신 운영 조건을 채워요. 한글날(퀴즈·공유·댓글), 블프(공유 포인트) 페이지를 바탕으로 했어요.</div>
    ${f('참여 방법', 'how', '예) 피크닉 사진과 함께 댓글 남기기')}
    <div class="f"><span class="l">보상</span><div class="chips-row">${['포인트', '쿠폰', '경품', '없음'].map(r => `<button class="chip" data-evr="${r}" aria-pressed="${e.reward === r}">${r}</button>`).join('')}</div>
      <input type="text" data-ev="rewardText" value="${esc(e.rewardText)}" placeholder="예) 추첨 50명 1,000P"></div>
    <div class="two"><div class="f"><span class="l">당첨 방식</span><select data-ev="pick">${['선착순', '추첨', '참여자 전원'].map(v => `<option ${e.pick === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>${f('인원', 'count', '예) 100')}</div>
    ${f('기간·시간', 'when', '예) 매일 오전 8시 · 3/2~3/15')}
    <label class="ck"><input type="checkbox" data-evlogin ${e.login ? 'checked' : ''}> 로그인해야 참여할 수 있어요</label>
    <label class="f"><span>유의사항 <em>(선택)</em></span><textarea data-ev="notice" rows="3" maxlength="1000" placeholder="예) 부적절한 게시물은 예고 없이 삭제될 수 있어요">${esc(e.notice)}</textarea>
      <span class="hint">경품·포인트 지급, 참여자 정보, 공유 문구에는 운영·법무 기준이 있을 수 있어요. 기준을 확인한 뒤 유의사항 틀을 넣을 예정이에요.</span></label>`;
}
function reviewTab(s) {
  const rv = s.rv;
  const group = (g, gi) => {
    const list = REVIEWS.filter(r => r.seq === g.seq).sort((a, b) => (b.best - a.best) || b.rating - a.rating);
    return `<div class="box"><div class="f"><span class="l">${esc(P[g.seq].name)} <em>${P[g.seq].rating == null ? '후기 요약 없음' : `★ ${P[g.seq].rating} (${P[g.seq].reviews})`} · 자동</em></span></div>
      <div class="rvs">${list.map(v => { const pk = g.picks.find(x => x.id === v.id); return `<div class="rvi ${pk ? 'on' : ''}">
        <span class="meta"><span class="stars">${'★'.repeat(v.rating)}</span>${v.best ? '<span class="tag real">베스트</span>' : ''}${v.gift ? '<span class="tag">선물 언급</span>' : ''}${v.repeat ? '<span class="tag">재구매 언급</span>' : ''}<span>${v.date || ''}</span><span class="grow"></span>
          <button class="btn xs ${pk ? '' : 'primary'}" data-rvpick="${gi}|${v.id}">${pk ? '빼기' : '고르기'}</button></span>
        <span class="body">${esc(v.text)}</span>
        ${pk ? `<label class="f"><span>한 줄 제목 <em>(선택) ${esc(pk.titleSrc)}</em></span><input type="text" data-rvtitle="${gi}|${v.id}" maxlength="40" value="${esc(pk.title)}" placeholder="예) 작고 간편해서 매일 손이 가요">
          <span class="chips-row"><button class="chip" disabled title="AI 제목 제안은 아직 연결 전이에요">AI 제목 제안 · 준비 중</button></span></label>` : ''}</div>`; }).join('') || '<p class="hint">이 상품 후기가 아직 없어요</p>'}</div></div>`;
  };
  return `<div class="f"><span class="l">모양</span><div class="chips-row">${[['per', '상품별 후기 묶음'], ['mix', '후기 모음 (여러 상품)']].map(([v, n]) => `<button class="chip" data-rvshape="${v}" aria-pressed="${rv.shape === v}">${n}</button>`).join('')}</div>
      <span class="hint">상품 카드 안에 후기 한 줄을 넣으려면 상품 구좌의 카드 모양에서 '고객 후기 한 줄'을 켜요.</span></div>
    <div class="f"><span class="l">후기와 함께 보여줄 것 <em>자동 · 상품·할인 값 그대로</em></span><div class="chips-row">${[['img', '상품 이미지'], ['name', '상품명'], ['price', '가격']].map(([k, n]) => `<button class="chip" data-rvshow="${k}" aria-pressed="${!!rv.show[k]}">${n}</button>`).join('')}</div></div>
    <div class="f"><span class="l">보여줄 순서 <em>${rv.order.length}개 · ↑↓로 바꿔요${rv.shape === 'per' ? ' · 상품별 묶음은 먼저 나온 상품 차례로 묶여요' : ''}</em></span>
      ${rv.order.length ? `<ul class="els">${rv.order.map((id, j) => { const v = REVIEWS.find(r => r.id === id), pk = rv.groups.flatMap(g => g.picks).find(x => x.id === id); if (!v) return ''; return `<li class="el"><span class="cap">${j + 1}</span>
        <span><span class="nm">${esc(pk?.title || v.text.slice(0, 18) + '…')}</span> <span class="src">${esc(P[v.seq].name)}</span></span>
        <span class="tools"><button class="ib" data-rvmv="${j}:-1" ${j ? '' : 'disabled'} aria-label="위로">↑</button><button class="ib" data-rvmv="${j}:1" ${j < rv.order.length - 1 ? '' : 'disabled'} aria-label="아래로">↓</button></span></li>`; }).join('')}</ul>` : '<p class="hint">아래에서 후기를 고르면 여기 차례대로 쌓여요.</p>'}</div>
    <span class="sub">상품별 후기 고르기</span>
    ${rv.groups.map(group).join('')}
    <div><button class="btn xs" data-rvadd>+ 상품 추가</button></div>
    <div class="f"><span class="l">작성자 표시</span><div class="chips-row"><button class="chip" data-rvauthor="hide" aria-pressed="${rv.author === 'hide'}">숨김</button><button class="chip" disabled title="지금은 작성자 정보를 읽지 않아요 · 확인 필요">가린 아이디 (확인 필요)</button></div></div>
    <p class="hint">후기 본문은 원문 그대로 써요. 길면 잘라서 '…'로 보이고, 말을 바꾸지 않아요. 후기를 광고에 써도 되는지는 운영·법무 확인이 필요해요.</p>`;
}
function demoImg(w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 40}" height="${h * 40}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#f3f3f3"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#p)"/><rect x="0.5" y="0.5" width="${w * 40 - 1}" height="${h * 40 - 1}" fill="none" stroke="#dedede"/></svg>`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="">`;
}
function refCard(s, k) {
  const r = REFS[k], att = s.att.some(a => a.ref === k), canLay = r.layout && r.layout !== s.layout;
  return `<div class="ref ${att ? 'att' : ''}"><span class="thumb">${r.img ? `<img src="${esc(r.img)}" alt="">` : demoImg(r.r[0], r.r[1])}</span><div>
        <div class="rn">${esc(r.name)}</div><div class="cap"><span class="tag ${r.from === '자사몰' ? 'real' : ''}">${esc(r.from)}</span> ${esc(r.page || '')}</div><div class="why">${esc(r.why || '')}</div>
        <div class="ra"><button class="btn xs" data-refview="${k}">미리보기</button>
          <button class="btn xs ${att ? '' : 'primary'}" data-refatt="${k}" aria-pressed="${att}">${att ? '참고에서 빼기' : '참고로 붙이기'}</button>
          ${r.layout ? `<button class="btn xs" data-reflay="${k}" ${canLay ? '' : 'disabled'} title="${!canLay ? '지금과 같은 레이아웃이에요' : `${LNAME[r.layout]}로 바꿔요 · 문구·메모는 그대로`}">레이아웃 가져오기</button>` : ''}
          <button class="btn xs ghost" data-refsave="${k}" aria-pressed="${saved.has(k)}">${saved.has(k) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</button></div></div></div>`;
}
function refsTab(s) {
  const cand = s.refs.concat(Object.keys(REFS).filter(k => !s.refs.includes(k) && REFS[k].layout === s.layout).slice(0, 1));
  // 더 찾기: 위에 없는 레퍼런스 전부 (같은 구좌 종류 먼저). 라이브러리에 사진·핀터레스트로 모은 것도 여기 나와요
  const more = Object.keys(REFS).filter(k => !cand.includes(k)).sort((a, b) => (REFS[b].layout === s.layout) - (REFS[a].layout === s.layout));
  const moreBox = !refMore ? '' : `<div class="refmore" role="region" aria-label="레퍼런스 더 찾기">
      ${more.length ? `<p class="hint">${more.length}개 · 같은 구좌 종류(${esc(LNAME[s.layout])}) 먼저</p><div class="refs">${more.map(k => refCard(s, k)).join('')}</div>`
        : '<div class="empty-st"><b>더 보여 드릴 레퍼런스가 없어요</b><p class="hint">레퍼런스 라이브러리에서 핀터레스트 보드를 연결하거나 이미지·링크를 직접 추가하면 여기에서도 고를 수 있어요.</p></div>'}
      <a class="btn xs" href="/v2/library" target="_blank" rel="noopener">레퍼런스 라이브러리 새 탭으로 열기</a></div>`;
  return `<p class="hint">이 구좌에 참고할 <b>원본 구좌 레퍼런스</b>예요. 자사몰과 외부 페이지에서 잘라 낸 구좌예요.</p>
    <div class="refs">${cand.map(k => refCard(s, k)).join('') || '<p class="hint">이 구좌 종류의 예시가 아직 없어요</p>'}</div>
    <button class="btn sm" data-refmore aria-expanded="${refMore}">${refMore ? '더 찾기 닫기' : `레퍼런스 더 찾기 (${more.length})`}</button>
    ${moreBox}
    ${moodBlock(s)}`;
}
function moodBlock(s) {
  const ms = s.moods, left = Object.keys(MOODS).filter(k => !ms.some(m => m.id === k)).sort((a, b) => (MOODS[b].lib ? 2 + (MOODS[b].fav ? 1 : 0) : 0) - (MOODS[a].lib ? 2 + (MOODS[a].fav ? 1 : 0) : 0));
  return `<div class="f"><span class="sub">느낌 레퍼런스 <span class="hint">이 구좌의 색감·연출 참고 · 구조가 없어 레이아웃은 가져오지 않아요</span></span>
    ${ms.map(m => { const r = moodOf(m.id); return `<div class="ref att"><span class="thumb">${moodThumb(r)}</span><div>
      <div class="rn">${esc(r.name)}</div><div class="cap">${esc(r.src)} ${r.lib ? '<span class="tag real">라이브러리</span>' : r.gone ? '' : '<span class="tag demo-t">예시</span>'}</div>
      <div class="ra" role="group" aria-label="이 이미지에서 참고할 것"><span class="cap">참고할 것 <em>여러 개</em></span>${POINTS.map(p => `<button class="pt" data-mpt="${m.id}|${p}" aria-pressed="${m.pts.has(p)}">${p}</button>`).join('')}</div>
      <div class="ra"><button class="btn xs" data-mrm="${m.id}">빼기</button></div></div></div>`; }).join('')}
    <div><button class="btn xs" data-moodadd aria-expanded="${moodAdd}">+ 느낌 레퍼런스 추가</button> <label class="btn xs ghost">파일 첨부<input type="file" data-moodfile accept="image/*,.pdf" hidden></label> <button class="btn xs ghost" data-moodlink aria-expanded="${moodLink}">링크 붙이기</button></div>
    ${moodLink ? `<div class="two"><input type="text" id="moodUrl" placeholder="https://… (핀터레스트·외부 페이지 등)" aria-label="참고한 링크"><button class="btn xs primary" data-moodurl>붙이기</button></div>` : ''}
    <span class="hint">라이브러리에 없어도 그때 참고한 파일이나 링크를 붙일 수 있어요. 파일은 이 PC에서 미리보기만 하고, 링크는 주소만 저장해요 (열어 보지 않아요).</span>
    ${moodAdd ? `<p class="hint">${libMoods === 'err' ? '라이브러리를 불러오지 못해 예시만 보여요.' : '레퍼런스 라이브러리에 담은 것(즐겨찾기 먼저) → 예시 순서예요.'} <a class="lnk" href="/v2/library" target="_blank" rel="noopener">라이브러리 열기</a></p><div class="moods">${left.map(k => { const r = MOODS[k]; return `<button class="mood" data-madd="${k}" title="${esc(r.src)}"><span class="thumb">${moodThumb(r)}</span><span class="cap">${r.fav ? '★ ' : ''}${esc(r.name)}${r.lib ? '' : ' · 예시'}</span></button>`; }).join('') || '<span class="hint">더 고를 레퍼런스가 없어요</span>'}</div>` : ''}</div>`;
}
// 직접 붙인 느낌 레퍼런스: 이미지 파일은 미리보기, PDF·링크는 종류 표시 (서버로 보내지 않는 목업)
// 라이브러리(서버)에 저장된 레퍼런스를 느낌 목록에 더함 (2026-11-10). 기획안에는 id만 저장 → 불러오기 전·지운 뒤에도 깨지지 않게 moodOf
var libMoods;   // var: 첫 그리기가 이 줄보다 먼저 돌아도 오류 없게 (undefined = 불러오는 중)
function moodOf(id) { return MOODS[id] || { name: id.startsWith('own') ? (!libMoods ? '라이브러리 레퍼런스 (불러오는 중)' : '라이브러리에서 지운 레퍼런스') : '붙였던 파일·링크 (다시 붙여 주세요)', src: '', r: [3, 4], gone: true }; }
async function loadLibMoods() {
  try {
    const d = await v2api('/api/am/references'), fav = new Set(d.favorites || []);
    for (const x of d.items || []) {
      const img = x.img_file ? `/refimg/own/${x.img_file}` : x.pin_img ? `/refimg/pin?u=${encodeURIComponent(x.pin_img)}` : '';
      MOODS[x.id] = { name: x.name, src: x.source === 'Pinterest' ? 'Pinterest' : '라이브러리 · 직접 추가', img, kind: img ? undefined : '링크', url: x.link, r: [3, 4], lib: true, fav: fav.has(x.id) };
    }
    libMoods = 'ok';
  } catch { libMoods = 'err'; }
  if (tab === 'refs') renderPanel();
}
function moodThumb(r) { return r.img ? `<img src="${r.img}" alt="">` : r.kind ? `<span class="cap">${r.kind}</span>` : demoImg(r.r[0], r.r[1]); }
function addMood(s, m) { const id = uid('u'); MOODS[id] = m; s.moods.push({ id, pts: new Set() }); moodLink = false; render(); toast('느낌 레퍼런스로 붙였어요. 이 이미지에서 참고할 것을 골라 주세요'); }
function notesTab(s) {
  return `<label class="f"><span>디자이너에게 부탁할 것 <em>(선택)</em></span><textarea data-sf="notes" rows="5" maxlength="2000" placeholder="예) 피크닉 돗자리 위 연출 컷이 있으면 좋겠어요">${esc(s.notes)}</textarea></label>
    <div class="f"><span class="l">붙인 레퍼런스 <em>${s.att.length}개</em></span>${s.att.length ? s.att.map(a => { const r = REFS[a.ref]; return `<div class="ref att"><span class="thumb">${demoImg(r.r[0], r.r[1])}</span><div>
        <div class="rn">${esc(r.name)}</div><div class="cap">${r.from} · ${esc(r.page)}</div>
        <input type="text" data-attnote="${a.ref}" value="${esc(a.note)}" maxlength="120" placeholder="예) 탭 모양과 가격 위치" aria-label="${esc(r.name)}에서 참고할 것"></div></div>`; }).join('')
      : '<p class="hint">레퍼런스 탭에서 [참고로 붙이기]를 누르면 여기 모여요.</p>'}</div>
    <div class="f"><span class="l">이 구좌의 느낌 레퍼런스 <em>${s.moods.length}개</em></span><p class="hint">${s.moods.map(m => `${esc(moodOf(m.id).name)}${m.pts.size ? ` (${[...m.pts].join('·')})` : ''}`).join(' / ') || '레퍼런스 탭 아래에서 추가할 수 있어요.'}</p></div>
    <div class="f"><span class="l">기획안 전체 느낌 <em>브리프에서 고름 · 모든 구좌 공통</em></span><p class="hint">${BRIEF_MOODS.map(([id, pts]) => `${esc(MOODS[id].name)} (${pts.join('·')})`).join(' / ')}</p></div>
    <p class="hint">미리보기·내보내기의 디자이너 기획안에 그대로 들어가요. 원가와 판정은 넣지 않아요.</p>`;
}
function render() { renderList(); renderPhone(); renderPanel(); }

// ================= 상품 고르기 서랍 =================
function pickList() {
  const s = S(), inSec = new Set(allCards(s).map(c => c.seq).filter(Boolean)), mark = p => inSec.has(p.seq) ? '<span class="tag">이 구좌에 있음</span>' : '';
  const row = (p, meta) => `<li class="pitem"><span class="pn">${esc(p.name)} ${mark(p)}</span><span class="pm">${esc(meta)}</span><button class="btn xs ${inSec.has(p.seq) ? '' : 'primary'}" data-choose="${p.seq}">고르기</button></li>`;
  const meta = p => { const it = itemOf(p.seq); return `${p.seq} · ${won(p.price)}${it ? ` · 할인 ${Math.round(it.rate * 100)}%${it.source === 'excel' ? ' · 엑셀로 받음' : ''}` : ''}`; };
  if (pickTab === 'plan') return items.length ? `<p class="hint">상품·할인에 직접 넣었거나 엑셀로 받은 상품이에요. 고르면 그 할인율 그대로 들어가요.</p><ul class="plist">${items.map(i => row(P[i.seq], meta(P[i.seq]))).join('')}</ul>` : '<p class="hint">아직 이 기획안에 상품이 없어요.</p>';
  if (pickTab === 'search') { const qq = q.replace(/\s/g, '').toLowerCase(), hits = PRODUCTS.filter(p => !qq || p.name.replace(/\s/g, '').toLowerCase().includes(qq) || p.seq.toLowerCase().startsWith(qq))
      .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || (b.sales28 || 0) - (a.sales28 || 0)).slice(0, liveOn ? 30 : 99);
    return `<label class="search block ${q ? 'has-value' : ''}" id="pqS"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input type="search" id="pq" value="${esc(q)}" placeholder="상품명이나 SEQ로 찾기" aria-label="상품 찾기" autocomplete="off"><button class="clear" type="button" data-sclear aria-label="검색어 지우기"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></label><ul class="plist" id="phits">${hits.map(p => row(p, meta(p))).join('') || `<li class="search-meta none">'${esc(q)}'와 맞는 상품이 없어요. 다른 이름이나 SEQ로 찾아 주세요.</li>`}</ul>`; }
  if (liveOn) return recLive(row, meta);
  const grp = (t, sub, list) => `<div><h3>${t}</h3><p class="hint">${sub}</p><ul class="plist">${list.map(([p, m]) => row(p, m)).join('') || '<li class="hint">없어요</li>'}</ul></div>`;
  return `${grp('작년 비슷한 기획에서 쓴 상품', '봄맞이 티 컬렉션 (2026.03)', PRODUCTS.filter(p => p.ly).slice(0, 4).map(p => [p, meta(p)]))}
    ${grp('오래 행사에 안 쓴 상품', '마지막 행사가 오래된 순서', [...PRODUCTS].sort((a, b) => b.days - a.days).slice(0, 4).map(p => [p, `${meta(p)} · 마지막 행사 ${p.days}일 전`]))}
    ${grp('고른 키워드와 연결된 상품', "브리프 키워드 '피크닉' · '보온병'", PRODUCTS.filter(p => p.kw.length).map(p => [p, `${meta(p)} · ${p.kw.join(', ')}`]))}
    <p class="hint">추천은 예시 규칙이에요. 연결되면 실제 판매·행사 이력으로 골라요.</p>`;
}
function openPick(cardId) {
  pickFor = cardId; const s = S();
  $('#drawer').innerHTML = `<div class="dh"><div class="row"><h2 id="drH">상품 고르기</h2><button class="btn sm" data-close>닫기</button></div>
      <p class="cap">${esc(s.name)}${s.tabs ? ` · '${esc(s.tabs[s.tab].name)}' 탭` : ''}의 카드에 넣을 상품</p>
      <div class="seg" role="tablist" aria-label="상품 찾는 곳">${[['plan', `이 기획안 상품 ${items.length}`], ['search', '전체 검색'], ['rec', '추천']].map(([k, n]) => `<button role="tab" data-ptab="${k}" aria-selected="${pickTab === k}">${n}</button>`).join('')}</div></div>
    <div class="db">${pickList()}</div>`;
  $('#drawer').hidden = false; $('#scrim').hidden = false; $('#drawer [data-ptab][aria-selected="true"]').focus();
}
// 와이어프레임에서 카드를 누르면: 그 구좌의 상품 탭에서 그 카드의 '카드 문구'를 펼침 (키보드는 상품 탭의 [▸ 카드 문구])
function openCard(sid, cid) {
  cur = sid; const s = S(); if (s.tabs) s.tab = Math.max(0, s.tabs.findIndex(t => t.cards.some(c => c.id === cid)));
  tab = 'products'; openMore.add(cid); openJudge = null; render();
  document.querySelector(`[data-slot="${cid}"]`)?.scrollIntoView?.({ block: 'nearest' });
  refocus(`[data-slot="${cid}"] .more input, [data-slot="${cid}"] .more select`) || refocus(`[data-more="${cid}"]`);
}
function closePick() {
  const cardId = pickFor;
  $('#drawer').hidden = true; $('#scrim').hidden = true; pickFor = null;
  if (cardId) refocus(`[data-pick="${CSS.escape(cardId)}"]`);
}
function choose(seq) {
  const c = allCards(S()).find(x => x.id === pickFor); if (!c) return;
  // 카드 자리의 글(라벨·알약·태그·카드 문구·버튼)은 그대로, 상품을 따라가는 값(상품명·가격·소구문구)만 바뀜
  const kept = c.seq && c.seq !== seq && DIRECT.some(k => c[k]);
  c.seq = seq; c.keep = null; if (!itemOf(seq)) items.push({ seq, rate: 0, source: 'direct', appeal: '' });
  closePick(); render(); refocus(`[data-pick="${CSS.escape(c.id)}"]`);
  if (liveOn) loadReviews([seq]).then(n => n && render());
  toast(`${P[seq].name}을 넣었어요${kept ? '. 이 카드에 쓴 라벨·알약 등은 그대로예요' : ''}${itemOf(seq).rate ? '' : '. 할인율은 카드에서 정해요'}`);
}

// ================= 엑셀 =================
// PROMO_WORK 붙여넣기 13열 (지금 툴과 같음). 1단만 들어가고, 2단(추가 혜택)은 넣는 방법을 몰라 '검증' 시트·메모에만 (plans/20 4-4-2)
const XLS_COLS = ['요일(자동)', '시작일', '종료일', '프로모션명', '유형', 'SEQ코드', '상품명(자동)', '카테고리명', '소구문구', '할인구분', '정가(자동)', '할인율', '할인가(자동)'];
function templateRows() {
  const out = [];
  secs.filter(s => kindOf(s.layout) === 'product').forEach(s => {
    (s.tabs ? s.tabs.map(t => [`${s.name} · ${t.name}`, t.cat || '', t.cards]) : [[s.name, s.cat || '', s.cards || []]]).forEach(([where, cat, cards]) => cards.forEach(c => out.push({ where, cat, seq: c.seq || '', appeal: c.seq ? (itemOf(c.seq)?.appeal || '') : '', rate: c.seq ? Math.round(rateOf(c.seq) * 100) + '%' : '', ex: c.seq ? extraOf(c.seq) : null })));
  });
  return out;
}
function openTemplate() {
  const rows = templateRows();
  dlg('상품 엑셀 양식', '구좌 구성에 맞춘 양식', `맨 앞에 구좌·탭 열 하나, 그다음은 PROMO_WORK 붙여넣기와 같은 13열이에요. 카드 수만큼 줄이 들어가 있어요 (${rows.length}줄).`,
    `<div class="tscroll"><table class="t"><thead><tr><th>구좌·탭 (붙여넣지 않음)</th>${XLS_COLS.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td class="pre">${esc(r.where)}</td><td class="auto">-</td><td>${esc(liveOn ? PERIOD[0] : '2026-03-02')}</td><td>${esc(liveOn ? PERIOD[1] : '2026-03-15')}</td><td>${esc(liveOn ? PLAN.doc.title : '봄 피크닉')}</td><td>상시</td><td>${esc(r.seq)}</td><td class="auto">-</td><td>${esc(r.cat) || '<span class="auto">비움</span>'}</td><td>${esc(r.appeal)}</td><td>정율</td><td class="auto">-</td><td>${esc(r.rate)}</td><td class="auto">-</td></tr>`).join('')}</tbody></table></div>
     <p class="hint">맨 앞 '구좌·탭' 열은 올릴 때 어느 구좌인지 맞추는 열이라 PROMO_WORK에는 붙여 넣지 않아요 (그다음 열부터 복사). 카테고리명은 정한 구좌만 채우고 나머지는 비워 둬요. 회색 = PROMO_WORK에서 자동으로 채워지는 칸. 추가 혜택(얼리버드 등 2단)은 넣는 방법을 확인하기 전까지 '검증' 시트와 메모에만 적어요 (${rows.filter(r => r.ex).length}줄).</p>`,
    liveOn ? '<button class="btn sm primary" data-csvdown>CSV 내려받기 (엑셀로 열려요)</button>' : '<button class="btn sm primary" data-toast="예시예요: 실제로는 .xlsx 파일로 내려받아요">.xlsx 내려받기</button>');
}
function openUpload() {
  if (liveOn) { dlg('엑셀 올리기', '채운 양식(CSV)을 골라 주세요', '[엑셀 양식 받기]로 받은 파일을 엑셀에서 채우고 CSV로 저장한 파일이에요. 바뀌는 것을 먼저 보여 드려요.',
    '<label class="f"><span>파일</span><input type="file" accept=".csv,text/csv" data-csvup></label><p class="hint">맨 앞 \'구좌·탭\' 열로 구좌를 찾고, 같은 구좌·탭 안에서는 줄 순서대로 카드 1, 2, 3…에 넣어요. SEQ·소구문구·할인율만 읽어요.</p>', ''); return; }
  const chg = [['가격대별 선물 추천 · 2만원대', '카드 1', 'P108', 0.1], ['가격대별 선물 추천 · 2만원대', '카드 2', 'P109', 0.15], ['첫 잔, 벚꽃', '카드 4', 'P102', 0.2]];
  dlg('엑셀 올리기', '올린 파일: 봄피크닉_상품.xlsx (예시)', '바뀌는 것을 먼저 보여 드려요. 반영하면 상품·할인에도 같은 값이 들어가요.',
    `<table class="t"><thead><tr><th>구좌·탭</th><th>자리</th><th>지금</th><th>엑셀</th><th>할인율</th></tr></thead><tbody>${chg.map(([a, b, seq, r]) => `<tr class="chg"><td>${esc(a)}</td><td>${b}</td><td class="auto">비어 있음</td><td>${esc(P[seq].name)}</td><td>${Math.round(r * 100)}%</td></tr>`).join('')}</tbody></table>
     <p class="hint">'구좌·탭' 열이 이 기획안의 구좌·탭과 맞지 않는 줄, SEQ를 찾을 수 없는 줄은 반영하지 않고 따로 알려 드려요.</p>`, '<button class="btn sm primary" data-upapply>3건 반영</button>');
  $('#dlg').dataset.chg = JSON.stringify(chg);
}
function applyUpload() {
  JSON.parse($('#dlg').dataset.chg || '[]').forEach(([where, at, seq, rate]) => {
    const [sn, tn] = where.split(' · '), s = secs.find(x => x.name === sn); if (!s) return;
    const c = (tn ? s.tabs.find(t => t.name === tn).cards : s.cards)[+at.replace(/\D/g, '') - 1]; if (c) c.seq = seq;
    const it = itemOf(seq); if (it) { it.rate = rate; it.source = 'excel'; } else items.push({ seq, rate, source: 'excel', appeal: '' });
  });
  $('#dlg').close(); render(); toast('엑셀에서 3건을 반영했어요');
}
function dlg(o, h, sub, body, foot) { $('#dlgO').textContent = o; $('#dlgH').textContent = h; $('#dlgS').textContent = sub; $('#dlgB').innerHTML = body; $('#dlgF').innerHTML = foot; $('#dlg').showModal(); }

// ================= 동작 =================
const refocus = sel => { const el = document.querySelector(sel); el?.focus(); return !!el; };
document.addEventListener('click', e => {
  const t = e.target, s = S(), d = k => t.closest(`[data-${k}]`), v = k => d(k)?.dataset[k.replace(/-(.)/g, (_, c) => c.toUpperCase())];
  // 구좌 추가·삭제·실행 취소 (구좌가 하나도 없어도 동작)
  if (d('secaddopen') || t.closest('#secAdd')) { openAddSec(); return; }
  if (d('secadd')) { addSec(v('secadd')); return; }
  if (d('secdelgo')) { delSec(v('secdelgo')); return; }
  if (d('dlgclose')) { $('#dlg').close(); return; }
  if (d('toastundo') || t.closest('#undoBtn')) { undo(); return; }
  if (t.closest('#redoBtn')) { redo(); return; }
  if (d('refmore')) { refMore = !refMore; renderPanel(); refocus('[data-refmore]'); return; }
  if (!s) return;
  if (d('lineadd')) { s.lines.push({ id: uid('l'), text: '' }); render(); refocus(`[data-line="${s.lines.length - 1}"]`); return; }
  if (d('linedel')) { s.lines.splice(+v('linedel'), 1); render(); return; }
  if (d('linemv')) { const [j, dd] = v('linemv').split(':').map(Number); [s.lines[j], s.lines[j + dd]] = [s.lines[j + dd], s.lines[j]]; render(); refocus(`[data-linemv="${j + dd}:${dd}"]`); return; }
  if (d('secmv')) { const [id, dd] = v('secmv').split(':'); if (moveSec(id, +dd)) { render(); refocus(`[data-secmv="${id}:${dd}"]:not([disabled])`) || refocus(`[data-sec="${id}"]`); } return; }
  if (t.closest('#phone [data-card]')) { openCard(t.closest('[data-sec]').dataset.sec, t.closest('[data-card]').dataset.card); return; }
  if (d('sec')) { const fromList = !!t.closest('#secList'); cur = v('sec'); openJudge = null; render(); showSec(cur, fromList); return; }
  if (d('tab')) { tab = v('tab'); renderPanel(); refocus(`[data-tab="${tab}"]`); return; }
  if (d('close') || t.id === 'scrim') { closePick(); return; }
  if (d('ptab')) { pickTab = v('ptab'); openPick(pickFor); return; }
  if (d('choose')) { choose(v('choose')); return; }
  if (d('pick')) { openPick(v('pick')); return; }
  if (d('toast')) { toast(v('toast')); return; }
  if (d('godeals')) { PLAN.flush().then(() => location.assign(`/v2/deals?id=${PLAN.id}`)); return; }
  if (d('upapply')) { liveOn ? applyCsv() : applyUpload(); return; }
  if (!s) return;
  if (d('judge')) { openJudge = openJudge === v('judge') ? null : v('judge'); renderPanel(); refocus(`[data-judge="${v('judge')}"]`); return; }
  if (d('more')) { const id = v('more'); openMore.has(id) ? openMore.delete(id) : openMore.add(id); renderPanel(); renderPhone(); refocus(`[data-more="${id}"]`); return; }
  if (d('moreall')) { const all = cardsOf(s).map(c => c.id), open = v('moreall') === 'open'; all.forEach(id => open ? openMore.add(id) : openMore.delete(id)); renderPanel(); renderPhone(); refocus(`[data-moreall="${open ? 'close' : 'open'}"]`); return; }
  // 카드 삭제: 상품이 든 카드도 확인창 없이 바로 지우고 [되돌리기]를 준다 (가벼운 편집). 구좌 삭제만 확인창
  if (d('rmcard')) { const l = cardsOf(s), i = l.findIndex(c => c.id === v('rmcard')), c = l[i]; l.splice(i, 1); openMore.delete(c.id); render(); toast(c.seq ? `'${P[c.seq]?.name || c.seq}' 카드를 지웠어요` : '빈 카드를 지웠어요', true); return; }
  if (d('addcard')) { const c = slot(); cardsOf(s).push(c); render(); refocus(`[data-pick="${c.id}"]`); return; }
  if (d('secdel')) { askDelSec(s); return; }
  if (d('secdup')) { dupSec(s); return; }
  if (d('preset')) { s.card.on = { ...PRESETS[v('preset')] }; render(); toast(`'${v('preset')}'로 맞췄어요. 요소마다 다시 켜고 끌 수 있어요`); return; }
  if (d('elmv')) { const [j, dd] = v('elmv').split(':').map(Number), o = s.card.order; [o[j], o[j + dd]] = [o[j + dd], o[j]]; render(); refocus(`[data-elmv="${j + dd}:${dd}"]`); return; }
  if (d('off')) { const [cid, k] = v('off').split('|'), c = allCards(s).find(x => x.id === cid); c.off = c.off.includes(k) ? c.off.filter(x => x !== k) : c.off.concat(k); render(); refocus(`[data-off="${cid}|${k}"]`); return; }
  if (d('cfreset')) { const k = v('cfreset'), c = cardOfEl(s, d('cfreset')); if (c) { c[k] = ''; if (k === 'pill') c.pillText = ''; render(); refocus(`[data-slot="${c.id}"] [data-cf="${k}"]`); } return; }
  if (d('apply')) { Object.entries(drafts).forEach(([seq, r]) => { const it = itemOf(seq); if (it) it.rate = r; }); const n = Object.keys(drafts).length; drafts = {}; render(); toast(`할인 ${n}건을 반영했어요. 상품·할인에도 같은 값이에요`); return; }
  if (d('undo')) { drafts = {}; render(); toast('바꾼 할인을 되돌렸어요'); return; }
  if (d('tabpick')) { s.tab = +v('tabpick'); render(); return; }
  if (d('tabmv')) { const [j, dd] = v('tabmv').split(':').map(Number); [s.tabs[j], s.tabs[j + dd]] = [s.tabs[j + dd], s.tabs[j]]; s.tab = j + dd; render(); return; }
  if (d('tabdel')) { const j = +v('tabdel'); if (s.tabs[j].cards.some(c => c.seq) && !confirm(`'${s.tabs[j].name}' 탭의 상품도 이 구좌에서 빠져요. 지울까요?`)) return; s.tabs.splice(j, 1); s.tab = Math.min(s.tab, s.tabs.length - 1); render(); return; }
  if (d('tabadd')) { s.tabs.push({ id: uid('t'), name: '새 탭', cards: [slot(), slot()] }); s.tab = s.tabs.length - 1; render(); refocus(`[data-tabname="${s.tab}"]`); return; }
  if (d('evr')) { s.ev.reward = v('evr'); render(); return; }
  if (d('rvshape')) { s.rv.shape = v('rvshape'); render(); return; }
  if (d('rvauthor')) { s.rv.author = v('rvauthor'); render(); return; }
  if (d('rvpick')) { const [gi, id] = v('rvpick').split('|'), g = s.rv.groups[+gi], i = g.picks.findIndex(x => x.id === id); if (i >= 0) { g.picks.splice(i, 1); s.rv.order = s.rv.order.filter(x => x !== id); } else { g.picks.push({ id, title: '', titleSrc: '직접' }); s.rv.order.push(id); } render(); return; }
  if (d('rvshow')) { const k = v('rvshow'); s.rv.show[k] = s.rv.show[k] ? 0 : 1; render(); refocus(`[data-rvshow="${k}"]`); return; }
  if (d('rvmv')) { const [j, dd] = v('rvmv').split(':').map(Number), o = s.rv.order; [o[j], o[j + dd]] = [o[j + dd], o[j]]; render(); refocus(`[data-rvmv="${j + dd}:${dd}"]`); return; }
  if (d('rvadd')) { const used = s.rv.groups.map(g => g.seq), next = [...new Set(REVIEWS.map(r => r.seq))].find(x => !used.includes(x)); if (next) { s.rv.groups.push({ seq: next, picks: [] }); render(); } else toast(liveOn ? '후기가 있는 이 기획안 상품을 모두 넣었어요 (상품을 카드에 넣으면 그 후기도 여기 나와요)' : '예시 후기가 있는 상품을 모두 넣었어요'); return; }
  if (d('refview')) { const r = REFS[v('refview')]; dlg('원본 구좌 레퍼런스 · 미리보기', r.name, `${r.from} · ${r.page} — 미리보기만 해요. 이 구좌는 바뀌지 않아요.`, `<div class="thumb big">${demoImg(r.r[0], r.r[1])}</div><p class="hint">원본 비율 ${r.r[0]}:${r.r[1]} (예시). 원본 페이지 캡처가 아직 연결 전이라 전체 페이지는 볼 수 없어요.</p>`, ''); return; }
  if (d('refatt')) { const k = v('refatt'), i = s.att.findIndex(a => a.ref === k); if (i >= 0) s.att.splice(i, 1); else s.att.push({ ref: k, note: '' }); render(); toast(i >= 0 ? '참고에서 뺐어요' : '참고로 붙였어요. 디자인 요청 탭에서 참고할 것을 적을 수 있어요'); return; }
  if (d('reflay') && !d('reflay').disabled) { const r = REFS[v('reflay')]; setLayout(s, r.layout); render(); toast(`레이아웃을 '${LNAME[r.layout]}'로 가져왔어요. 문구·메모는 그대로예요`); return; }
  if (d('refsave')) { const k = v('refsave'); saved.has(k) ? saved.delete(k) : saved.add(k); renderPanel(); return; }
  if (d('moodlink')) { moodLink = !moodLink; renderPanel(); refocus(moodLink ? '#moodUrl' : '[data-moodlink]'); return; }
  if (d('moodurl')) { const raw = $('#moodUrl').value.trim(); let u; try { u = new URL(raw); } catch { u = null; }
    if (!u || !/^https?:$/.test(u.protocol)) { toast('http나 https로 시작하는 주소를 넣어 주세요'); return; }
    addMood(s, { name: u.hostname.replace(/^www\./, ''), src: `직접 첨부 · 링크 ${raw.length > 40 ? raw.slice(0, 40) + '…' : raw}`, kind: '링크', url: raw, r: [3, 4] }); return; }
  if (d('moodadd')) { moodAdd = !moodAdd; renderPanel(); refocus('[data-moodadd]'); return; }
  if (d('madd')) { s.moods.push({ id: v('madd'), pts: new Set() }); moodAdd = false; renderPanel(); return; }
  if (d('mrm')) { s.moods = s.moods.filter(m => m.id !== v('mrm')); renderPanel(); return; }
  if (d('mpt')) { const [id, p] = v('mpt').split('|'), m = s.moods.find(x => x.id === id); m.pts.has(p) ? m.pts.delete(p) : m.pts.add(p); renderPanel(); refocus(`[data-mpt="${id}|${p}"]`); return; }
});
// 구좌 종류 바꾸기: 문구·메모·레퍼런스는 그대로, 종류에 필요한 자료만 빈 값으로 만들어 둠 (이미 있던 상품·후기·조건은 지우지 않음)
function setLayout(s, ly) {
  s.layout = ly; const k = kindOf(ly);
  if (k === 'product') { s.card ||= cardShape('가격 표시'); if (!s.tabs) s.cards ||= [slot(), slot()]; }
  if (k === 'event') s.ev ||= { how: '', reward: '', rewardText: '', pick: '선착순', count: '', when: '', login: true, notice: '' };
  if (k === 'review') s.rv ||= { shape: 'mix', groups: liveOn ? [] : [{ seq: 'P106', picks: [] }], order: [], show: { img: 1, name: 1, price: 0 }, author: 'hide' };
}
document.addEventListener('input', e => {
  const t = e.target, s = S();
  if (t.id === 'pq') { t.closest('.search')?.classList.toggle('has-value', !!t.value); q = t.value; const tmp = document.createElement('div'); tmp.innerHTML = pickList(); $('#phits').outerHTML = tmp.querySelector('#phits').outerHTML; return; }
  if (!s) return;
  if (t.dataset.sf) { s[t.dataset.sf] = t.value; if (t.dataset.sf === 'name') syncHeroCopy(s); renderPhone(); renderList(); if (t.dataset.sf === 'name') $('#panel h2').textContent = s.name; return; }
  if (t.dataset.cf && t.tagName !== 'SELECT') { const c = cardOfEl(s, t); if (c) { c[t.dataset.cf] = t.value; renderPhone(); renderList(); } return; }
  if (t.dataset.df && t.tagName !== 'SELECT') { s.card.def[t.dataset.df] = t.value; renderPhone(); renderList(); const sm = $('#pbody .sample'); if (sm) sm.innerHTML = wCard(sampleOf(s), s); return; }
  if (t.dataset.appeal) { const it = itemOf(t.dataset.appeal); if (it) it.appeal = t.value; renderPhone(); return; }
  if (t.dataset.line != null) { s.lines[+t.dataset.line].text = t.value; renderPhone(); return; }
  if (t.dataset.tabname != null) { s.tabs[+t.dataset.tabname].name = t.value; renderPhone(); renderList(); return; }
  if (t.dataset.attnote) { s.att.find(a => a.ref === t.dataset.attnote).note = t.value; return; }
  if (t.dataset.ev) { s.ev[t.dataset.ev] = t.value; renderPhone(); renderList(); return; }
  if (t.dataset.rvtitle) { const [gi, id] = t.dataset.rvtitle.split('|'); s.rv.groups[+gi].picks.find(x => x.id === id).title = t.value; renderPhone(); return; }
});
document.addEventListener('change', e => {
  const t = e.target, s = S(); if (!s) return;
  if (t.dataset.rate) { const seq = t.dataset.rate, val = Math.min(90, Math.max(0, Math.round(+t.value || 0))) / 100; if (val === (itemOf(seq)?.rate ?? 0)) delete drafts[seq]; else drafts[seq] = val; renderPanel(); renderPhone(); refocus(`[data-rate="${seq}"]`); return; }
  if (t.matches('[data-layout]')) { setLayout(s, t.value); render(); toast(`구좌 종류를 '${LNAME[t.value]}'로 바꿨어요. 문구·메모는 그대로예요`); return; }
  if (t.dataset.elon) { s.card.on[t.dataset.elon] = t.checked ? 1 : 0; render(); refocus(`[data-elon="${t.dataset.elon}"]`); return; }
  if (t.dataset.cf === 'pill') { const c = cardOfEl(s, t); if (c) { c.pill = t.value; render(); refocus(`[data-slot="${c.id}"] [data-cf="pill"]`); } return; }
  if (t.dataset.df === 'pill') { s.card.def.pill = t.value; render(); refocus('[data-df="pill"]'); return; }
  if (t.matches('[data-num]')) { s.num = t.checked; render(); return; }
  if (t.matches('[data-ctaon]')) { s.ctaOn = t.checked; if (s.ctaOn && !s.cta) s.cta = kindOf(s.layout) === 'product' ? `${s.scope || s.name} 더보기` : kindOf(s.layout) === 'event' ? '참여하기' : '자세히 보기'; render(); refocus('[data-ctaon]'); return; }
  if (t.matches('[data-evlogin]')) { s.ev.login = t.checked; return; }
  if (t.matches('[data-moodfile]')) { const f = t.files[0]; if (!f) return; const isImg = f.type.startsWith('image/');
    if (!isImg && f.type !== 'application/pdf') { toast('이미지나 PDF 파일만 붙일 수 있어요'); return; }
    addMood(s, { name: f.name.length > 24 ? f.name.slice(0, 24) + '…' : f.name, src: '직접 첨부 · 파일', kind: isImg ? '' : 'PDF', img: isImg ? URL.createObjectURL(f) : '', r: [3, 4] }); return; }
});
// 검색창: ✕나 Esc로 지우기 (컴포넌트 27). Esc는 글자가 있으면 지우기 먼저, 없으면 서랍 닫기
document.addEventListener('click', e => { if (e.target.closest('#pqS [data-sclear]')) { q = ''; openPick(pickFor); $('#pq')?.focus(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && e.target.id === 'pq' && e.target.value) { e.preventDefault(); q = ''; openPick(pickFor); $('#pq')?.focus(); return; }
  if (e.key === 'Escape' && !$('#drawer').hidden) { e.preventDefault(); closePick(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[zZyY]$/.test(e.key)) {   // 실행 취소·다시 실행 (입력칸 안에서는 브라우저 기본 동작)
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault(); (e.key.toLowerCase() === 'y' || e.shiftKey) ? redo() : undo(); return;
  }
  const b = e.target.closest?.('#secList [data-sec]');
  if (b && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); const id = b.dataset.sec; if (moveSec(id, e.key === 'ArrowUp' ? -1 : 1)) { render(); refocus(`#secList [data-sec="${id}"]`); } }
});
// 구좌 목록 끌어서 옮기기
let dragSec = null;
$('#secList').addEventListener('dragstart', e => { const li = e.target.closest('[data-li]'); if (!li) return; dragSec = li.dataset.li; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
$('#secList').addEventListener('dragover', e => { const li = e.target.closest('[data-li]'); if (!li || !dragSec) return; e.preventDefault(); document.querySelectorAll('#secList [data-li]').forEach(x => x.classList.toggle('over', x === li && x.dataset.li !== dragSec)); });
$('#secList').addEventListener('dragend', () => { dragSec = null; document.querySelectorAll('#secList [data-li]').forEach(x => x.classList.remove('drag', 'over')); });
$('#secList').addEventListener('drop', e => { const li = e.target.closest('[data-li]'); if (!li || !dragSec) return; e.preventDefault();
  const item = secs.splice(secs.findIndex(s => s.id === dragSec), 1)[0]; secs.splice(secs.findIndex(s => s.id === li.dataset.li), 0, item); dragSec = null; render(); });
$('#xlsDown').addEventListener('click', openTemplate);
$('#xlsUp').addEventListener('click', openUpload);
$('#nextBtn').addEventListener('click', () => { if (Object.keys(drafts).length) { toast('반영하지 않은 할인이 있어요. 상품 탭에서 반영하거나 되돌려 주세요'); return; } if (!PLAN.id) { toast('예시예요: 미리보기·내보내기로 넘어가요'); return; } PLAN.flush().then(() => location.assign(`/v2/preview?id=${PLAN.id}`)); });
let toastT;
// undoable = 지우기·넣기처럼 되돌릴 수 있는 동작이면 알림에 [되돌리기]를 붙임 (6초)
function toast(t, undoable) {
  const el = $('#toast'), act = !!undoable && hist.past.length > 0;
  el.innerHTML = `<span>${esc(t)}</span>${act ? '<button type="button" class="tact" data-toastundo>되돌리기</button>' : ''}`;
  el.classList.toggle('act', act); el.classList.add('on'); clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on', 'act'), act ? 6000 : 2800);
}
let liveOn = false, lastE = null, KWS = [], PERIOD = ['', ''];

// ================= 실행 취소 · 다시 실행 (2026-11-10) =================
// 구좌·카드·문구·할인 상태가 바뀔 때마다 앞 상태를 기억 (최대 60번). 글자를 칠 때는 0.6초 모아서 한 번.
// 화면 이동(뒤로 가기)과는 따로: 이건 이 화면 안의 편집 이력만. 버튼 + Ctrl+Z / Ctrl+Shift+Z(또는 Ctrl+Y). 입력칸 안에서는 브라우저 기본 되돌리기
const hist = { past: [], future: [], cur: null, key: null };
const histKey = () => JSON.stringify([secs.map(toSection), items, PLAN.doc?.brief?.key_copy || '']);
const histSnap = () => ({ secs: structuredClone(secs), items: structuredClone(items), cur, briefCopy: PLAN.doc?.brief?.key_copy || '' });
function syncHist() { const u = $('#undoBtn'), r = $('#redoBtn'); if (u) u.disabled = !hist.past.length; if (r) r.disabled = !hist.future.length; }
function track() {
  const k = histKey();
  if (hist.key === null) { hist.key = k; hist.cur = histSnap(); syncHist(); return; }
  if (k === hist.key) return;
  hist.past.push(hist.cur); if (hist.past.length > 60) hist.past.shift();
  hist.future = []; hist.cur = histSnap(); hist.key = k; syncHist();
}
let trackT = null; const trackSoon = () => { clearTimeout(trackT); trackT = setTimeout(track, 600); };
function resetHist() { hist.past = []; hist.future = []; hist.key = null; hist.cur = null; track(); }
function restoreHist(st) {
  secs = structuredClone(st.secs); items = structuredClone(st.items);
  if (liveOn && PLAN.doc) PLAN.save(d => { d.brief.key_copy = st.briefCopy || ''; });
  cur = secs.some(x => x.id === st.cur) ? st.cur : secs.some(x => x.id === cur) ? cur : secs[0]?.id ?? null;
  hist.cur = st; hist.key = histKey(); renderBase(); saveEditor(); syncHist();
}
function undo() { clearTimeout(trackT); track(); if (!hist.past.length) { toast('되돌릴 편집이 없어요'); return; } hist.future.push(hist.cur); restoreHist(hist.past.pop()); toast('한 단계 되돌렸어요'); }
function redo() { if (!hist.future.length) { toast('다시 할 편집이 없어요'); return; } hist.past.push(hist.cur); restoreHist(hist.future.pop()); toast('다시 했어요'); }

// ================= 구좌 넣기 · 복제 · 지우기 (2026-11-10) =================
function newSec(ly) { const s = { id: uid('s'), name: LNAME[ly] || '새 구좌', layout: ly, role: '', scope: '', num: false, cta: '', ctaOn: false, ctaTo: '', refs: [], att: [], notes: '', moods: [], lines: [], cat: '' }; setLayout(s, ly); return s; }
function openAddSec() {
  const s = S();
  dlg('구좌 추가', '어떤 구좌를 추가할까요?', s ? `'${s.name}' 아래에 추가해요. 추가한 뒤에도 종류·순서를 바꿀 수 있어요.` : '첫 구좌를 추가해요. 추가한 뒤에도 종류·순서를 바꿀 수 있어요.',
    `<div class="addsec">${LAYOUTS.map(([g, ls]) => `<div class="f"><span class="l">${g}</span><div class="chips-row">${ls.map(([k, n]) => `<button type="button" class="chip" data-secadd="${k}">${n}</button>`).join('')}</div></div>`).join('')}</div>`, '');
}
function addSec(ly) {
  const s = newSec(ly), i = secs.findIndex(x => x.id === cur);
  secs.splice(i < 0 ? secs.length : i + 1, 0, s); cur = s.id; tab = 'copy'; $('#dlg').close();
  render(); showSec(s.id, true); toast(`'${s.name}' 구좌를 추가했어요`, true); refocus('[data-sf="name"]');
}
function dupSec(s) {
  const c = structuredClone(s); c.id = uid('s'); c.name = `${s.name} (복사)`.slice(0, 60);
  c.lines.forEach(l => { l.id = uid('l'); }); (c.tabs || []).forEach(x => { x.id = uid('t'); }); allCards(c).forEach(x => { x.id = uid('c'); });
  secs.splice(secs.indexOf(s) + 1, 0, c); cur = c.id; render(); showSec(c.id, true); toast(`'${s.name}' 구좌를 바로 아래에 복제했어요`, true);
}
function askDelSec(s) {
  const n = allCards(s).filter(c => c.seq).length;
  const what = [n && `카드 상품 ${n}개`, s.rv?.order.length && `고른 후기 ${s.rv.order.length}개`, s.ev?.how && '이벤트 운영 조건', (s.lines.length || s.role) && '설명·추가 문구', s.notes && '디자인 요청'].filter(Boolean);
  dlg('구좌 삭제', `'${s.name || '제목 없는 구좌'}' 구좌를 지울까요?`, what.length ? `이 구좌에 넣은 것(${what.join(', ')})도 함께 지워져요.` : '이 구좌는 아직 비어 있어요.',
    '<p class="hint">상품·할인의 할인 행(할인율·소구문구)은 지우지 않아요. 다른 구좌나 하루특가에서 계속 쓸 수 있어요. 지운 뒤에도 [실행 취소]로 되돌릴 수 있어요.</p>',
    `<button class="btn sm" data-dlgclose>취소</button><button class="btn sm danger" data-secdelgo="${s.id}">구좌 지우기</button>`);
}
function delSec(id) {
  const i = secs.findIndex(x => x.id === id); if (i < 0) return;
  const s = secs[i]; secs.splice(i, 1); allCards(s).forEach(c => openMore.delete(c.id));
  cur = secs[Math.min(i, secs.length - 1)]?.id ?? null; $('#dlg').close(); render(); toast(`'${s.name || '제목 없는 구좌'}' 구좌를 지웠어요`, true);
}
// 구좌를 고르면: 목록에서 골랐으면 와이어프레임의 그 구좌로 이동, 와이어프레임에서 골랐으면 목록에서 보이게. 고정 막대에 가리지 않게 scroll-margin
function showSec(id, fromList) {
  if (!id) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fromList) document.querySelector(`#phone [data-sec="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  else document.querySelector(`#secList [data-sec="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  const pb = $('#pbody'); if (pb) pb.scrollTop = 0;
}
render();   // 이력의 출발점은 파일 맨 끝에서 (toSection이 쓰는 함수가 다 준비된 뒤)
// ================= 기획안 잇기 (새 버전) =================
// 구좌 목록 = 기획안의 page.sections (구좌 구성에서 정한 것). 제목·설명·버튼·엑셀 카테고리명·디자인 요청·카드 상품(slots)은 원래 칸에,
// 추가 문구·번호·버튼 켜기·카드 모양·카드별 라벨·태그·알약·후기·이벤트 조건·레퍼런스는 구좌의 v2에 저장해요.
// 상품·할인 값(할인율·소구문구)은 상품·할인 화면과 같은 promo_rows: 카드에 넣거나 할인을 고치면 그 행을 고치고, 없으면 행을 더해요(지우지는 않음)
const edP = r => ({ seq: String(r.seq), name: r.name, price: r.price, cost: r.cost || 0, days: r.days_since_promo ?? '-', ly: (r.ly_next28 || 0) > 0, lyAmt: r.ly_next28 || 0,
  kw: [], after: null, rating: null, reviews: null, active: !!r.active, sales28: r.sales_28 || 0, category: r.category || '' });
function fromSection(x) {
  const v = x.v2 || {}, layout = x.layoutId || 'hero', k = kindOf(layout);
  const s = { id: x.sectionId, name: x.headline || x.name || '', layout, role: x.subhead || '', scope: v.scope || '', num: !!v.num,
    cta: x.cta || '', ctaOn: v.ctaOn ?? !!x.cta, ctaTo: v.ctaTo || '', refs: v.refs || [], att: [], notes: x.designNotes || '',
    // 느낌 레퍼런스의 참고할 것: 예전 이름 '글씨' → '글씨체'
    moods: (v.moods || []).map(m => ({ id: m.id, pts: new Set((m.pts || []).map(p => (p === '글씨' ? '글씨체' : p))) })), lines: (v.lines || []).map(l => ({ id: l.id, text: l.text || '' })), cat: x.zone_tag || '' };
  // 카드 = 저장된 slots (상품 목록에 없는 SEQ는 비워 보이되 저장할 때 그대로 돌려놓음)
  const ex = v.cards || {}, slots = x.slots || [];
  const mk = sl => { const e = ex[sl.slotId] || {}, ok = sl.seq && P[sl.seq];
    return slot(ok ? String(sl.seq) : null, { id: sl.slotId, copy: sl.customCopy || '', label: e.label || '', tag: e.tag || '', pill: e.pill || '', pillText: e.pillText || '', btn: e.btn || '', off: e.off || [], keep: !ok && sl.seq ? String(sl.seq) : null }); };
  if (k === 'product') {
    // 기본값(def)이 없던 기획안 = 버튼 '담기'만 기본 (예전에 고정이던 값)
    s.card = v.card?.order && v.card?.on ? { order: v.card.order, on: v.card.on, def: { ...DEF0, ...(v.card.def || {}) } } : cardShape('가격 표시');
    if (x.tabs?.length) { s.tab = 0; const first = x.tabs[0].tabId;
      s.tabs = x.tabs.map(t => { const cs = slots.filter(sl => (sl.tabId || first) === t.tabId).map(mk); return { id: t.tabId, name: t.label, cat: t.zone_tag || '', cards: cs.length ? cs : [slot(), slot()] }; }); }
    else s.cards = slots.length ? slots.map(mk) : [slot(), slot(), slot(), slot()];
  }
  s.copyRecommendation = v.copyRecommendation || null;
  if (k === 'review') s.rv = v.rv || { shape: 'mix', groups: [], order: [], show: { img: 1, name: 1, price: 0 }, author: 'hide' };
  if (k === 'event') s.ev = v.ev || { how: '', reward: '', rewardText: '', pick: '', count: '', when: '', login: true, notice: '' };
  return s;
}
const cut = (t, n) => String(t || '').slice(0, n);
const slotOut = (c, tabId) => ({ slotId: c.id, seq: c.seq || c.keep || null, items: null, placeholderStatus: c.seq || c.keep ? 'AVAILABLE' : 'UNDECIDED', customCopy: cut(c.copy, 200), tabId });
const cardExtra = s => Object.fromEntries(allCards(s).filter(c => c.label || c.tag || c.pill || c.pillText || c.btn || c.off.length)
  .map(c => [c.id, { label: cut(c.label, 20), tag: cut(c.tag, 20), pill: c.pill, pillText: cut(c.pillText, 30), btn: cut(c.btn, 20), off: c.off }]));
const defOut = d => ({ label: cut(d.label, 20), pill: d.pill || '', pillText: cut(d.pillText, 30), tag: cut(d.tag, 20), copy: cut(d.copy, 60), btn: cut(d.btn, 20) });
function toSection(s, i) {
  return { sectionId: s.id, order: i, name: cut(s.name, 40), headline: cut(s.name, 120), subhead: cut(s.role, 400), cta: cut(s.cta, 40),
    layoutId: s.layout, zone_tag: cut(s.cat, 40), designNotes: cut(s.notes, 2000),
    ...(s.tabs ? { tabs: s.tabs.map(t => ({ tabId: t.id, label: cut(t.name, 40), zone_tag: cut(t.cat, 40) })) } : {}),
    ...(s.card ? { slots: (s.tabs ? s.tabs.flatMap(t => t.cards.map(c => slotOut(c, t.id))) : (s.cards || []).map(c => slotOut(c, null))).slice(0, 40) } : {}),
    v2: { copyRecommendation: s.copyRecommendation || null, scope: cut(s.scope, 200), num: !!s.num, ctaOn: !!s.ctaOn, ctaTo: cut(s.ctaTo, 60), lines: (s.lines || []).map(l => ({ id: l.id, text: cut(l.text, 120) })),
      refs: s.refs || [], moods: (s.moods || []).map(m => ({ id: m.id, pts: [...m.pts] })),
      ...(s.card ? { card: { order: s.card.order, on: s.card.on, def: defOut(s.card.def) }, cards: cardExtra(s) } : {}), ...(s.rv ? { rv: s.rv } : {}), ...(s.ev ? { ev: s.ev } : {}) } };
}
// 이 화면의 할인(items) → 기획안 promo_rows (하루특가·조합 행은 건드리지 않음)
function rowsFromItems(d) {
  const rows = d.promo_rows ||= [], promo = cut(d.title, 60), per = d.brief?.period || {};
  for (const it of items) {
    const rate = Math.round(it.rate * 1000) / 1000, appeal = cut(it.appeal, 80);
    const r = rows.find(x => x.type !== '하루특가' && !x.items?.length && String(x.seq) === it.seq);
    if (r) { r.rate = rate; r.appeal = appeal; if (rate > 0 && r.type === '큐레이션') r.type = '상시'; }
    else rows.push({ promo, type: rate > 0 ? '상시' : '큐레이션', start: per.start || null, end: per.end || null, seq: it.seq, items: null, rate, appeal, category_tag: '', clearance: false, memo: '' });
  }
}
function saveEditor() {
  if (!liveOn) return;
  const out = secs.map(toSection), j = JSON.stringify([out, items]);
  if (j === lastE) return;
  lastE = j;
  PLAN.save(d => {
    const old = Object.fromEntries((d.page?.sections || []).map(x => [x.sectionId, x]));
    d.page = { ...(d.page || {}), sections: out.map(o => ({ ...(old[o.sectionId] || {}), ...o, v2: { ...(old[o.sectionId]?.v2 || {}), ...o.v2 } })) };
    rowsFromItems(d);
  });
}
// 후기·별점: 상품마다 /api/product/{seq}의 후기 요약 (리뷰 수·평균·근거 후기 2개, 작성자 없음)
async function loadReviews(seqs) {
  const got = await Promise.all([...new Set(seqs)].filter(q => P[q] && P[q].rating == null).slice(0, 60).map(q => PRODUCTS_API.detail(q).then(d => [q, d])));
  for (const [q, d] of got) {
    const r = d?.reviews; if (!r) continue;
    P[q].rating = r.avg == null ? null : r.avg.toFixed(1); P[q].reviews = r.n;
    (r.quotes || []).forEach((t, i) => { const id = `${q}_${i}`; if (!REVIEWS.some(x => x.id === id)) REVIEWS.push({ id, seq: q, rating: null, best: i === 0, date: '', gift: /선물|드렸|부모님|지인/.test(t), repeat: /재구매|또 ?구매|번째/.test(t), text: t }); });
  }
  return got.length;
}
// 상품 고르기 '추천' (실제 상품, 규칙): 작년 이맘때 잘 팔린 / 오래 행사에 안 쓴 / 브리프 키워드와 이름이 겹치는
function recLive(row, meta) {
  const act = PRODUCTS.filter(p => p.active), man = n => `${Math.round(n / 10000).toLocaleString('ko-KR')}만원`;
  const ly = act.filter(p => p.lyAmt > 0).sort((a, b) => b.lyAmt - a.lyAmt).slice(0, 5);
  const rest = act.filter(p => typeof p.days === 'number' && p.sales28 > 0).sort((a, b) => b.days - a.days).slice(0, 5);
  const kw = act.map(p => [p, KWS.filter(k => p.name.replace(/\s/g, '').includes(k.replace(/\s/g, '')))]).filter(([, m]) => m.length).sort((a, b) => b[0].sales28 - a[0].sales28).slice(0, 6);
  const grp = (t, sub, list) => `<div><h3>${t}</h3><p class="hint">${esc(sub)}</p><ul class="plist">${list.map(([p, m]) => row(p, m)).join('') || '<li class="hint">없어요</li>'}</ul></div>`;
  return `${grp('작년 이맘때 잘 팔린 상품', '앞으로 4주에 해당하는 작년 4주 매출순', ly.map(p => [p, `${meta(p)} · 작년 ${man(p.lyAmt)}`]))}
    ${grp('오래 행사에 안 쓴 상품', '최근 28일 판매가 있고 마지막 행사가 오래된 순서', rest.map(p => [p, `${meta(p)} · 마지막 행사 ${p.days}일 전`]))}
    ${grp('고른 키워드와 이름이 겹치는 상품', KWS.length ? `브리프 키워드 ${KWS.map(k => `'${k}'`).join(' · ')}` : '브리프에서 고른 키워드가 없어요', kw.map(([p, m]) => [p, `${meta(p)} · ${m.join(', ')}`]))}
    <p class="hint">판매 중인 상품만 · 실제 판매·행사 이력으로 고른 규칙이에요 (AI 아님).</p>`;
}
// ---------- 엑셀 (CSV): 양식 내려받기 / 채운 파일 올리기 ----------
const csvCell = v => { const t = String(v ?? ''); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
function csvParse(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function downloadCsv() {
  const rows = templateRows(), title = PLAN.doc?.title || '기획안';
  const body = [['구좌·탭', ...XLS_COLS], ...rows.map(r => [r.where, '', PERIOD[0], PERIOD[1], title, '상시', r.seq, '', r.cat, r.appeal, '정율', '', r.rate, ''])].map(r => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  a.download = `${title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)}_상품양식.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`양식을 내려받았어요 (${rows.length}줄). 엑셀에서 열어 SEQ·소구문구·할인율을 채운 뒤 CSV로 저장해 올려 주세요`);
}
let upPlan = [];
async function readCsv(f) {
  if (f.size > 2e6) { toast('2MB가 넘는 파일은 올릴 수 없어요'); return; }
  const buf = await f.arrayBuffer();
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('euc-kr').decode(buf); }   // 엑셀 'CSV(쉼표로 분리)'는 euc-kr
  const rows = csvParse(text.replace(/^﻿/, '')); if (rows[0]?.[0]?.trim() === '구좌·탭') rows.shift();
  const where = {}; secs.filter(s => s.card).forEach(s => (s.tabs ? s.tabs.map(t => [`${s.name} · ${t.name}`, s, t]) : [[s.name, s, null]]).forEach(([w, ss, t]) => { where[w] = { s: ss, t }; }));
  const seen = {}, bad = []; upPlan = [];
  rows.forEach((r, n) => {
    const w = (r[0] || '').trim(), seq = (r[6] || '').trim(), raw = (r[12] || '').trim(), rate = raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw) > 1 ? parseFloat(raw) / 100 : parseFloat(raw);
    const k = seen[w] = (seen[w] ?? -1) + 1;
    if (!seq) return;
    if (!where[w]) { bad.push(`${n + 2}줄: '${w}' 구좌·탭을 이 기획안에서 못 찾았어요`); return; }
    if (!P[seq]) { bad.push(`${n + 2}줄: SEQ ${seq}를 상품 목록에서 못 찾았어요`); return; }
    if (raw && !(rate >= 0 && rate < 0.9)) { bad.push(`${n + 2}줄: 할인율 '${raw}'을 읽지 못했어요 (예: 20%)`); return; }
    const cards = where[w].t ? where[w].t.cards : where[w].s.cards;
    upPlan.push({ w, sid: where[w].s.id, tid: where[w].t?.id || null, k, seq, rate: raw ? rate : null, appeal: (r[9] || '').trim().slice(0, 80), now: cards[k]?.seq ? P[cards[k].seq].name : '비어 있음' });
  });
  dlg('엑셀 올리기', `올린 파일: ${f.name}`, '바뀌는 것을 먼저 보여 드려요. 반영하면 상품·할인에도 같은 값이 들어가요.',
    `<table class="t"><thead><tr><th>구좌·탭</th><th>자리</th><th>지금</th><th>엑셀</th><th>할인율</th></tr></thead><tbody>${upPlan.map(x => `<tr class="chg"><td>${esc(x.w)}</td><td>카드 ${x.k + 1}</td><td class="auto">${esc(x.now)}</td><td>${esc(P[x.seq].name)}</td><td>${x.rate == null ? '그대로' : `${Math.round(x.rate * 100)}%`}</td></tr>`).join('') || '<tr><td colspan="5" class="cap">반영할 줄이 없어요</td></tr>'}</tbody></table>
     ${bad.length ? `<p class="warnline">반영하지 않는 줄 ${bad.length}개</p><ul class="mini">${bad.slice(0, 20).map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}`,
    upPlan.length ? `<button class="btn sm primary" data-upapply>${upPlan.length}건 반영</button>` : '');
}
function applyCsv() {
  for (const x of upPlan) {
    const s = secs.find(y => y.id === x.sid); if (!s) continue;
    const cards = x.tid ? s.tabs.find(t => t.id === x.tid).cards : s.cards;
    while (cards.length <= x.k) cards.push(slot());
    cards[x.k].seq = x.seq; cards[x.k].keep = null;
    const it = itemOf(x.seq) || (items.push({ seq: x.seq, rate: 0, source: 'excel', appeal: '' }), itemOf(x.seq));
    if (x.rate != null) it.rate = x.rate; if (x.appeal) it.appeal = x.appeal; it.source = 'excel';
  }
  const n = upPlan.length; upPlan = []; $('#dlg').close(); render(); loadReviews(items.map(i => i.seq)).then(k => k && render()); toast(`엑셀에서 ${n}건을 반영했어요`);
}
document.addEventListener('click', e => { if (e.target.closest('[data-csvdown]')) downloadCsv(); });
document.addEventListener('change', e => { if (e.target.matches?.('[data-csvup]') && e.target.files[0]) readCsv(e.target.files[0]); });

const renderBase = render;
render = function () { renderBase(); saveEditor(); track(); };
document.addEventListener('input', () => { setTimeout(saveEditor); trackSoon(); });
document.addEventListener('change', () => { setTimeout(saveEditor); setTimeout(track); });
PLAN.ready.then(async doc => {
  if (!doc) return;
  const list = (doc.page?.sections || []).slice().sort((a, b) => a.order - b.order);   // 비어 있으면 빈 페이지로 열고 '첫 구좌 넣기' (예시를 보여 주지 않음)
  let prods;
  try { prods = await PRODUCTS_API.all(); } catch (e) { toast(`상품을 불러오지 못해 예시로 보여요: ${e.message}`); return; }
  for (const k of Object.keys(P)) delete P[k];
  PRODUCTS = prods.filter(r => r.seq && r.price).map(edP); PRODUCTS.forEach(p => { P[p.seq] = p; });
  REVIEWS = []; EXTRAS = doc.v2?.extras || []; KWS = (doc.v2?.keywords || []).filter(Boolean);
  PERIOD = [doc.brief?.period?.start || '', doc.brief?.period?.end || '']; END = PERIOD[1];
  items = (doc.promo_rows || []).filter(r => r.type !== '하루특가' && r.seq && P[r.seq] && !r.items?.length)
    .map(r => ({ seq: String(r.seq), rate: r.type === '큐레이션' ? 0 : r.rate || 0, source: 'plan', appeal: r.appeal || '' }));
  items = items.filter((it, i) => items.findIndex(x => x.seq === it.seq) === i);
  secs = list.map(fromSection);
  const want = decodeURIComponent(((location.hash || "").match(/^#s=(.+)$/) || [])[1] || '');   // 미리보기 [구좌 보기]에서 온 구좌
  cur = secs.some(s => s.id === want) ? want : secs[0]?.id ?? null; tab = 'copy'; pickTab = 'plan'; openMore = new Set();
  // 이미 겹쳐 저장된 카드·탭 아이디가 있으면 새 아이디로 (카드마다 상품·문구가 따로 가게)
  const seenId = new Set();
  secs.forEach(s => { (s.tabs || []).forEach(t => { if (seenId.has(t.id)) t.id = uid('t'); seenId.add(t.id); }); allCards(s).forEach(c => { if (seenId.has(c.id)) c.id = uid('c'); seenId.add(c.id); }); });
  secs.forEach(s => { if (s.rv) s.rv.groups = s.rv.groups.filter(g => P[g.seq]); });   // 예시 상품(P106 등)이 남아 있으면 뺌
  liveOn = true; lastE = JSON.stringify([secs.map(toSection), items]);
  document.querySelector('.demo').innerHTML = '<b>이 기획안의 실제 내용이에요.</b> 구좌는 구좌 구성에서 정한 것, 상품·가격·원가·후기는 실제 데이터예요. 카드에 넣거나 할인을 고치면 상품·할인과 같은 값으로 저장돼요. 레퍼런스·느낌 이미지는 아직 예시예요. AI 카피 추천은 Claude 연결 상태에 따라 사용할 수 있어요.';
  renderBase(); resetHist();   // 불러온 상태가 이력의 출발점 (예시 화면으로 되돌아가지 않게)
  if (want) showSec(cur, true);
  // 후기·별점은 그린 뒤에 채운다 (2026-11-10: 후기를 다 받을 때까지 예시 화면이 보이고 고친 것도 저장되지 않던 것). 후기는 저장 값이 아니라 다시 그려도 저장하지 않음
  loadReviews([...items.map(i => i.seq), ...secs.flatMap(s => allCards(s).map(c => c.seq).filter(Boolean)), ...secs.flatMap(s => s.rv?.groups.map(g => g.seq) || [])])
    .then(n => { if (n && !document.activeElement?.matches?.('input, textarea, select, [contenteditable]')) render(); });   // 입력 중이면 끊지 않음 (다음 그리기 때 반영)
});

// 좁은 화면: 1200px 이하 편집 패널, 700px 이하 구좌 목록을 겹쳐 여는 창으로.
// 와이어프레임 위 [구좌 목록] [편집 패널 열기], 좁은 화면에서 구좌를 누르면 패널이 열림. [닫기]·Esc·바깥 누르기로 닫음
(() => {
  const narrow = n => matchMedia(`(max-width: ${n}px)`).matches;
  const body = document.body, stage = document.querySelector('.stage');
  if (!stage) return;
  const bar = document.createElement('div');
  bar.className = 'ed-bar';
  bar.innerHTML = '<button type="button" class="btn sm" data-ed="list" aria-controls="secList" aria-expanded="false">구좌 목록</button><button type="button" class="btn sm primary" data-ed="panel" aria-controls="panel" aria-expanded="false">편집 패널 열기</button>';
  stage.prepend(bar);
  const scrim = document.createElement('div'); scrim.className = 'ed-scrim'; scrim.hidden = true;
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn sm ed-close'; close.textContent = '닫기'; close.hidden = true;
  body.append(scrim, close);
  const on = k => body.classList.contains(`ed-${k}`);
  const sync = () => {
    const any = on('panel') || on('list');
    scrim.hidden = !any; close.hidden = !any;
    bar.querySelector('[data-ed="panel"]').setAttribute('aria-expanded', String(on('panel')));
    bar.querySelector('[data-ed="list"]').setAttribute('aria-expanded', String(on('list')));
  };
  const open = k => {
    const previous = on('panel') ? 'panel' : on('list') ? 'list' : null;
    if (previous === k) return;
    body.classList.remove('ed-panel', 'ed-list');
    if (k) body.classList.add(`ed-${k}`);
    sync();
    if (k) close.focus({ preventScroll: true });
    else bar.querySelector(`[data-ed="${previous}"]`)?.focus({ preventScroll: true });
  };
  bar.addEventListener('click', e => { const b = e.target.closest('[data-ed]'); if (b) open(on(b.dataset.ed) ? null : b.dataset.ed); });
  scrim.addEventListener('click', () => open(null));
  close.addEventListener('click', () => open(null));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !e.defaultPrevented && !$('#dlg').open && (on('panel') || on('list'))) {
      e.preventDefault(); open(null);
    }
  });
  document.addEventListener('click', e => { if (narrow(1200) && e.target.closest('button[data-sec], [data-secadd]')) open('panel'); });
  addEventListener('resize', () => { if (!narrow(1200) || (!narrow(700) && on('list'))) open(null); });
})();

// 편집 이력의 출발점 (예시 화면 또는 기획안을 불러오기 전 상태. 기획안을 불러오면 resetHist로 다시 잡음)
track();
loadLibMoods();

// 멘트추천기능과 연결: 원본 편집/저장/실행 취소 흐름을 그대로 사용한다.
function syncHeroCopy(s) {
  if (liveOn && PLAN.doc && s === secs.find(x => x.layout === 'hero')) {
    PLAN.save(d => { d.brief.key_copy = cut(s.name, 120); });
  }
}
window.CopyRecommendation?.connect({
  enabled: () => liveOn && !!PLAN.id,
  currentId: () => cur,
  snapshot(id) {
    const section = secs.find(x => x.id === id);
    return window.CopyRecommendationCore.snapshot({doc: PLAN.doc, section, sections: secs, products: P, rows: items, extras: EXTRAS});
  },
  async prepare(id) {
    if (!liveOn || !PLAN.id) throw Error('저장된 기획안에서 사용할 수 있어요.');
    if (!secs.some(x => x.id === id)) throw Error('구좌를 찾지 못했어요.');
    if (Object.keys(drafts).length) throw Error('미반영 할인이 있어요. 상품 탭에서 반영하거나 되돌린 뒤 추천해 주세요.');
    saveEditor(); await PLAN.flush();
  },
  paint(id) {
    if (id !== cur || tab !== 'copy') return;
    const body = $('#pbody'), top = body?.scrollTop || 0;
    renderPanel(); const next = $('#pbody'); if (next) next.scrollTop = top;
  },
  apply(id, patch, meta) {
    if (id !== cur) throw Error('추천받은 구좌로 돌아온 뒤 적용해 주세요.');
    const section = secs.find(x => x.id === id); if (!section) throw Error('구좌를 찾지 못했어요.');
    clearTimeout(trackT); track();
    Object.assign(section, patch); section.copyRecommendation = meta;
    if ('name' in patch) syncHeroCopy(section);
    render(); toast('AI 문구를 적용했어요. 직접 수정하거나 실행 취소할 수 있어요.', true);
  }
});
