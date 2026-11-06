// 출처: 구좌 구성안 (plans/15 2장, plans/17). 결과는 { mode, basis, items }
// 지금은 DEMO(규칙): 지난 진열 구성 = PROMO_WORK 지난 상시 할인의 카테고리명(Zone), 비슷한 행사 = 명분 단어·시기 규칙
// 나중: 비슷한 행사 고르기·Zone 표기 정리를 엔지니어가 만들면 pastOutlines만 바꾼다
import { api } from '../../core.js';
import { units, zoneSeq } from './zones.js';

// 목적별 기본 구성 (규칙 기반 예시): [구좌명, 레이아웃, 섹션 목표]
const TEMPLATES = {
  '선물 수요': [['메인 비주얼', 'hero', '브랜딩'], ['선물 큐레이션', 'grid2', '전환'], ['금액대별 선물', 'grid3', '객단가'], ['혜택 안내', 'benefit', '혜택 안내'], ['브랜드 스토리', 'split', '브랜딩']],
  '전환·매출': [['메인 비주얼', 'hero', '브랜딩'], ['베스트 상품', 'grid2', '전환'], ['하루특가', 'deal-banner', '전환'], ['혜택 안내', 'benefit', '혜택 안내']],
  '신규 유입': [['메인 비주얼', 'hero', '유입'], ['처음이라면 이 차부터', 'grid3', '유입'], ['첫 구매 혜택', 'benefit', '혜택 안내'], ['브랜드 스토리', 'split', '브랜딩']],
  '객단가 상승': [['메인 비주얼', 'hero', '브랜딩'], ['세트 구성', 'grid2', '객단가'], ['함께 사면 좋은 상품', 'grid3', '객단가'], ['혜택 안내', 'benefit', '혜택 안내']],
  '브랜드·신제품': [['메인 비주얼', 'hero', '브랜딩'], ['신제품 소개', 'split', '정보 안내'], ['추천 상품', 'grid2', '전환'], ['브랜드 이야기', 'text-cta', '브랜딩']],
  '재고 소진': [['메인 비주얼', 'hero', '전환'], ['특가 상품', 'grid3', '전환'], ['혜택 안내', 'benefit', '혜택 안내']],
};
const DEFAULT_TEMPLATE = [['메인 비주얼', 'hero', '브랜딩'], ['추천 상품', 'grid2', '전환'], ['혜택 안내', 'benefit', '혜택 안내']];

export function purposeOutline(purpose) {
  return { mode: 'demo', basis: [purpose ? `브리프 목적 '${purpose}'` : '기본 순서'],
    items: (TEMPLATES[purpose] || DEFAULT_TEMPLATE).map(([name, layoutId, goal]) => ({ name, layoutId, purpose: goal })) };
}

// ---------------- 지난 진열 구성 ----------------
let wavesP = null;
const details = new Map();   // 회차 key → 상세 (한 번 받은 것은 다시 받지 않음)
const words = s => String(s || '').split(/[\s,·/()]+/).map(w => w.replace(/^\d+/, '')).filter(w => w.length >= 2);
const bare = s => String(s || '').replace(/\s/g, '');

function rank(w, p) {
  const ref = p.brief?.period?.start || new Date().toISOString().slice(0, 10);
  const hit = [...words(p.brief?.myeongbun), ...words(p.title)].find(x => bare(w.promo).includes(x));
  const d = Math.abs(+ref.slice(5, 7) - +w.start.slice(5, 7)), md = Math.min(d, 12 - d);
  const why = [hit && `같은 명분 단어 '${hit}'`, md <= 1 && '비슷한 시기'].filter(Boolean);
  return { k: (hit ? 100 : 0) + (md <= 1 ? 30 : md <= 2 ? 10 : 0), why: why.join(' · ') || '최근 행사' };
}

export async function pastOutlines(p, n = 3) {
  wavesP = wavesP || api('/api/review').then(d => d.waves || []).catch(e => { wavesP = null; throw e; });
  const waves = (await wavesP).filter(w => w.type === '상시' && w.status === '완료');
  const cands = waves.map(w => ({ w, ...rank(w, p) })).sort((a, b) => b.k - a.k || b.w.start.localeCompare(a.w.start)).slice(0, 8);
  await Promise.all(cands.filter(c => !details.has(c.w.key)).map(c =>
    api(`/api/review/wave?key=${encodeURIComponent(c.w.key)}`).then(d => details.set(c.w.key, d)).catch(() => {})));
  const items = [];
  cands.forEach(({ w, why }) => {
    const d = details.get(w.key); if (!d) return;
    const { zones, ordered } = zoneSeq((d.items_detail || []).map(x => ({ zone: x.zone, row: x.row })));
    if (zones.length >= 2) items.push({ key: w.key, promo: w.promo, start: w.start, end: w.end, rows: w.rows, why, ordered, units: units(zones) });
  });
  return { mode: 'demo', basis: ['PROMO_WORK 지난 상시 할인의 카테고리명(Zone)', '비슷한 행사는 명분 단어·시기 규칙으로 고름', 'Zone 유형은 이름을 보고 규칙으로 나눈 초안'], items: items.slice(0, n) };
}
