/* AMOREAD Editor Lab — independent demonstration catalog, no internal business data. */
window.AM_CATALOG = [
  {id:'grid2',name:'2열 상품',category:'상품',description:'상품을 두 열로 배치해 비교·탐색',keywords:'진열 큐레이션 2열 가격'},
  {id:'grid3',name:'3열 상품',category:'상품',description:'한 화면에서 더 많은 상품 노출',keywords:'진열 3열 목록'},
  {id:'feat',name:'대표 1 + 2열',category:'상품',description:'대표 상품과 연관 상품을 함께',keywords:'대표 메인 강조'},
  {id:'deal-banner',name:'날짜별 특가',category:'상품',description:'마감 시각·특가 메시지 강조',keywords:'데일리 딜 카운트다운'},
  {id:'custom',name:'자유 기획 · 레퍼런스 구좌',category:'안내·이야기',description:'기존 유형에 없는 구성의 위치를 먼저 확보하고 레퍼런스로 기획',keywords:'미정 자유 빈 구좌 레퍼런스 참조 스케치 독창적인 새로운 맞춤 기획'},
  {id:'hero',name:'메인 비주얼',category:'안내·이야기',description:'프로모션의 첫인상과 핵심 메시지',keywords:'히어로 배너 표지'},
  {id:'text-cta',name:'텍스트와 버튼',category:'안내·이야기',description:'짧은 메시지와 다음 행동 안내',keywords:'안내 바로가기'},
  {id:'split',name:'좌우 분할',category:'안내·이야기',description:'비주얼과 텍스트를 나란히 배치',keywords:'분할 이미지 소개'},
  {id:'benefit',name:'혜택 총정리',category:'안내·이야기',description:'혜택 내용과 조건을 구조화',keywords:'혜택 카드 할인 쿠폰'},
  {id:'story',name:'스토리(산지·제조·브랜드)',category:'안내·이야기',description:'브랜드·제품 이야기를 단계적으로',keywords:'브랜드 스토리 에디토리얼'},
  {id:'service',name:'포장·서비스 안내',category:'안내·이야기',description:'제공 서비스와 이용 조건 명시',keywords:'선물 포장 배송 쇼핑백'},
  {id:'detail',name:'상품 상세(체크포인트)',category:'안내·이야기',description:'제품의 선택 기준과 핵심 특징',keywords:'상품 장점 체크포인트'},
  {id:'timeline',name:'배송·일정 안내',category:'안내·이야기',description:'중요한 일정·단계·배송 흐름',keywords:'날짜 일정 출고 배송'},
  {id:'countdown',name:'카운트다운',category:'안내·이야기',description:'시간이 제한된 혜택의 종료 안내',keywords:'타이머 한정 마감'},
  {id:'notice',name:'유의사항',category:'안내·이야기',description:'조건·예외·필수 안내 정리',keywords:'주의 고지 안내'},
  {id:'ev-quiz',name:'퀴즈·테스트',category:'이벤트',description:'질문·선택지·참여 동선',keywords:'테스트 참여 퀴즈'},
  {id:'ev-share',name:'공유 유도',category:'이벤트',description:'공유 미션과 참여 혜택',keywords:'친구 초대 공유'},
  {id:'ev-ugc',name:'댓글·사진 인증',category:'이벤트',description:'인증 방법과 업로드 동선',keywords:'댓글 사진 UGC'},
  {id:'ev-stamp',name:'출석·스탬프',category:'이벤트',description:'진행도와 보상 단계 표시',keywords:'출석체크 체크인'},
  {id:'ev-draw',name:'뽑기·룰렛',category:'이벤트',description:'응모 결과와 당첨 방식',keywords:'룰렛 랜덤 추첨'},
  {id:'ev-coupon',name:'쿠폰 받기',category:'이벤트',description:'할인 쿠폰과 발급 조건',keywords:'발급 쿠폰 다운로드'},
  {id:'review',name:'후기 모음',category:'후기',description:'구매자의 후기와 상품 연결',keywords:'리뷰 별점 고객 평가'}
];
window.AM_PRODUCT_DEMO = [
 {seq:'D001',name:'봄날의 티 샘플러',price:28000,discount:20},
 {seq:'D002',name:'허브 티 컬렉션',price:34000,discount:15},
 {seq:'D003',name:'휴대용 티 보틀',price:24000,discount:10},
 {seq:'D004',name:'말차 스타터 키트',price:42000,discount:25},
 {seq:'D005',name:'선물용 티 세트',price:49000,discount:12},
 {seq:'D006',name:'아이스 티 팩',price:19000,discount:18}
];
const DEF = {
 'grid2': ['취향별 티 추천','상황에 맞게 골라 보세요'], 'grid3':['이번 주 추천 상품','한눈에 살펴보는 상품'], 'feat':['에디터의 선택','가장 먼저 소개할 상품'],
 'deal-banner':['오늘만 만나는 혜택','오늘의 특별한 가격을 확인해보세요'],
 'custom':['새로운 구좌 아이디어','구성 방식과 참고 사례를 정리해 주세요'],
 'hero':['봄의 시간을 선물하세요','여유로운 일상을 위한 작은 제안'],
 'text-cta':['나에게 맞는 한 잔을 찾아보세요','취향에 맞는 상품을 살펴보세요'],
 'split':['선물이 특별해지는 순간','정성스러운 구성과 여유로운 경험'],
 'benefit':['이번 프로모션 혜택','놓치지 말아야 할 혜택을 모았어요'],
 'story':['한 잔에 담긴 이야기','원료부터 일상의 경험까지'],
 'service':['선물 서비스를 소개합니다','마음을 전할 수 있도록 준비했어요'],
 'detail':['선택을 돕는 세 가지 포인트','상품을 고르기 전 확인해보세요'],
 'timeline':['일정 및 배송 안내','구매 전에 주요 일정을 확인하세요'],
 'countdown':['마감까지 남은 시간','기간 한정 혜택을 확인하세요'],
 'notice':['꼭 확인해 주세요','참여 전 유의사항을 확인해 주세요'],
 'ev-quiz':['내 취향에 맞는 차는?','간단한 질문으로 취향을 발견해요'],
 'ev-share':['친구와 함께 즐기는 이벤트','함께 공유하고 혜택을 확인해요'],
 'ev-ugc':['나의 티타임을 보여주세요','사진이나 댓글로 참여해요'],
 'ev-stamp':['매일 방문 스탬프','참여할수록 쌓이는 보상'],
 'ev-draw':['오늘의 행운을 확인하세요','참여하고 선물을 만나보세요'],
 'ev-coupon':['첫 만남의 선물','한정 혜택 쿠폰을 받아보세요'],
 'review':['먼저 만난 고객의 이야기','실제 경험으로 살펴보세요']
};
const ITEM_DEF={
 benefit:[['최대 20%','기간 한정 특별 할인'],['무료 배송','조건 충족 시 배송비 지원'],['추가 사은품','대상 상품 구매 시 제공']],
 service:[['선물 포장','선물의 의미를 더하는 포장 서비스'],['쇼핑백 동봉','전달하기 편리한 구성'],['메시지 카드','한 줄 마음을 함께 전해요']],
 detail:[['맛과 향','취향에 맞는 특징을 확인하세요'],['사용 방법','쉽게 즐길 수 있는 방법'],['선물 추천','어떤 상황에 어울리는지 안내']],
 story:[['시작','일상에 어울리는 차를 생각하다'],['선택','재료와 향의 균형을 찾다'],['경험','한 잔의 순간을 완성하다']],
 timeline:[['11월 12일','프로모션 시작'],['11월 18일','쿠폰 발급 마감'],['11월 20일','사은품 출고 예정']],
 notice:[['쿠폰 사용 조건','다른 쿠폰과 중복 적용 여부 확인'],['배송 안내','상세 일정은 주문 단계에서 확인'],['재고 안내','소진 시 사전 종료될 수 있음']],
 'ev-quiz':[['향긋한 차','가벼운 향을 선호해요'],['구수한 차','깊은 풍미를 선호해요']],
 'ev-stamp':[['DAY 1','출석 완료'],['DAY 2','오늘 참여'],['DAY 3','다음 보상']]
};
window.AM_makeSection = function(id, sectionId){
 const spec=window.AM_CATALOG.find(x=>x.id===id); const t=DEF[id]||[spec?.name||id,'구좌 설명'];
 const items=(ITEM_DEF[id]||[]).map((x,i)=>({id:'i'+i,label:x[0],text:x[1]}));
 return {id:sectionId||('sec_'+Math.random().toString(36).slice(2,9)),layout:id,title:t[0],subtitle:t[1],cta:['hero','split','text-cta','ev-quiz','ev-share','ev-ugc','ev-draw','ev-coupon','countdown'].includes(id)?'자세히 보기':'',items,productIds:['D001','D002','D003','D004'],align:'left',gap:'normal',notes:'',ref:'',featured:true};
};
