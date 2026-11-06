// 출처: 구좌별 레퍼런스 추천 (plans/15 2장). 결과는 { mode, basis, items }
// 지금은 DEMO: 구좌의 레이아웃·종류가 맞는 예시를 순서대로 놓을 뿐이다. 점수·적합도는 근거가 없어 보여 주지 않는다 ('시연용 순위')
// 나중: 조건 검색 + 의미 기반 추천과 추천 이유(엔지니어)로 바꿀 때 이 파일만 바꾼다
import { listRefs } from './references.js';

const CAT_OF = { hero: '메인·비주얼', grid2: '상품 큐레이션', grid3: '상품 큐레이션', split: '상품 큐레이션', benefit: '혜택·프로모션', 'deal-banner': '혜택·프로모션', 'text-cta': '스토리' };

export function recommendRefs(s, p, n = 3) {
  const gift = /선물/.test(p.brief?.purpose || '');
  const items = listRefs().items.map(r => {
    const why = [];
    let k = 0;
    if (r.layout && r.layout === s.layoutId) { k += 3; why.push('같은 레이아웃'); }
    if (r.cat === CAT_OF[s.layoutId]) { k += 2; why.push(`같은 구좌 종류(${r.cat})`); }
    if (gift && /선물/.test(r.title + r.reason)) { k += 1; why.push('브리프 목적이 선물'); }
    return { r, k, why };
  }).filter(x => x.k > 0).sort((a, b) => b.k - a.k).slice(0, n);
  return { mode: 'demo', basis: ['구좌 레이아웃·종류가 맞는 예시 레퍼런스를 순서대로 (시연용 순위)'], items: items.map(x => ({ ...x.r, why: x.why.join(' · ') })) };
}
