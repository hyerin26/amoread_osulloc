// 출처: 레퍼런스 (plans/15 2장). 결과는 { mode, basis, items }
// 지금은 DEMO: 디자이너 v2.5.1 예시 레퍼런스(가상 데이터, 원본 캠페인 이미지 아님). 그림은 구성 예시만 그린다
// 나중: 원본 HTML·캡처 수집, 구좌 분리, 태깅(엔지니어)으로 바꿀 때 이 파일만 바꾼다
// layout: 우리 레이아웃 ID. null이면 편집 가능한 배치가 없어 '참고자료로 첨부'만 된다

const REFS = [
  { id: 'R-01', title: '선물 대상별 카드 큐레이션', campaign: '연말 선물 큐레이션', cat: '상품 큐레이션', applicable: true, layout: 'grid2', reason: '선물 목적과 상품 비교에 맞아요', summary: '대상별 추천 상품을 카드 단위로 나눈 사례' },
  { id: 'R-02', title: '티 컬렉션 히어로 비주얼', campaign: '겨울의 차 한 잔', cat: '메인·비주얼', applicable: true, layout: 'hero', reason: '감성 중심의 첫 화면', summary: '큰 비주얼 하나와 카피를 쓴 사례' },
  { id: 'R-03', title: '단계형 혜택 강조', campaign: '스페셜 위크', cat: '혜택·프로모션', applicable: true, layout: 'benefit', reason: '혜택 정보가 눈에 잘 띄어요', summary: '혜택 핵심 숫자를 크게 보여 준 사례' },
  { id: 'R-04', title: '선물 패키지 이미지 연출', campaign: '기프트 스토리 에디토리얼', cat: '스토리', applicable: false, layout: null, reason: '이미지 조합과 선물 분위기 참고', summary: '시각 연출만 참고. 편집 가능한 배치는 없어요' },
  { id: 'R-05', title: '브랜드 스토리 장면', campaign: '제주에서 온 이야기', cat: '스토리', applicable: false, layout: null, reason: '감성 카피와 여백 참고', summary: '분위기를 전하기 위한 참고 전용' },
  { id: 'R-06', title: '기프트 선택 가이드', campaign: '연말 선물 큐레이션', cat: '스토리', applicable: false, layout: null, reason: '대상별 구매 고민을 푸는 흐름 참고', summary: '타깃별 선물 가이드 구좌. 참고 전용' },
  { id: 'R-07', title: '시즌 마지막 혜택 배너', campaign: '연말 선물 큐레이션', cat: '혜택·프로모션', applicable: true, layout: 'benefit', reason: '마무리 구매를 이끄는 구좌', summary: '캠페인 아래쪽의 혜택 강조 구좌' },
  { id: 'R-08', title: '스페셜 위크 상품 하이라이트', campaign: '스페셜 위크', cat: '상품 큐레이션', applicable: true, layout: 'split', reason: '대표 상품 2종을 대비해 보여 줘요', summary: '비대칭 상품 강조 구좌' },
];

// 캠페인 전체 순서 (R7 '원본 전체 페이지 보기'에서 쓴다)
const CAMPAIGNS = {
  '연말 선물 큐레이션': [['시즌 시작 비주얼', 'hero', null], ['선물 대상별 카드 큐레이션', 'grid2', 'R-01'], ['기프트 선택 가이드', 'text-cta', 'R-06'], ['시즌 마지막 혜택 배너', 'benefit', 'R-07']],
  '겨울의 차 한 잔': [['티 컬렉션 히어로 비주얼', 'hero', 'R-02'], ['겨울 티타임 제안', 'text-cta', null], ['추천 차 3종', 'grid3', null]],
  '스페셜 위크': [['시즌 혜택 인트로', 'hero', null], ['단계형 혜택 강조', 'benefit', 'R-03'], ['스페셜 위크 상품 하이라이트', 'split', 'R-08'], ['마감 안내', 'benefit', null]],
  '기프트 스토리 에디토리얼': [['패키지 이미지 인트로', 'hero', null], ['선물 패키지 이미지 연출', 'text-cta', 'R-04'], ['선물 받는 순간', 'grid2', null]],
  '제주에서 온 이야기': [['제주 스토리 시작', 'hero', null], ['브랜드 스토리 장면', 'text-cta', 'R-05'], ['제품으로 연결', 'grid2', null]],
};

export const REF_BASIS = '디자이너 예시 레퍼런스(가상 데이터)';
export const listRefs = () => ({ mode: 'demo', basis: [REF_BASIS], items: REFS });
export const byRef = id => REFS.find(r => r.id === id) || null;
export const campaignOf = name => (CAMPAIGNS[name] || []).map(([title, layout, refId]) => ({ title, layout, refId }));
