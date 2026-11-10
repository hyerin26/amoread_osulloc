// 출처: 대표 카피 제안 (plans/15 2장). 결과는 { mode, basis, items }
// 지금은 DEMO: 브리프의 명분·콘셉트·목적·타깃으로 규칙 문장을 만든다. AI를 쓰지 않는다
// 나중: AI(로컬 Claude Code 또는 다른 모델, 미정)·카피 사례 참고로 바꿀 때 이 파일의 copyIdeas만 바꾼다 (plans/16)

const last = w => { const c = (w || '').charCodeAt((w || '').length - 1); return c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : -1; };
const eul = w => w + (last(w) > 0 ? '을' : '를');                // 받침 있으면 '을'
const ro = w => w + (last(w) > 0 && last(w) !== 8 ? '으로' : '로');  // 받침 있으면 '으로', ㄹ 받침은 '로'
const head = s => String(s || '').split(/[,.(·]/)[0].trim();     // '입동, 첫 추위가 오는 때' → '입동'

const BY_PURPOSE = {
  '선물 수요': m => `${m ? `${m}, ` : ''}마음을 전하는 차 선물`,
  '전환·매출': m => `${m ? `${m}에만` : '지금만'} 만나는 혜택`,
  '신규 유입': () => '처음 만나는 오늘의 차',
  '객단가 상승': () => '함께 즐기면 더 좋은 차 세트',
  '브랜드·신제품': (m, c) => `새로운 차, ${c || '지금 만나 보세요'}`,
  '재고 소진': () => '놓치면 아쉬운 마지막 혜택',
};

export function copyIdeas(p) {
  const b = p.brief || {}, m = head(b.myeongbun), c = String(b.concept || '').trim(), a = head(b.audience), pur = b.purpose || '';
  const out = [];
  if (m && c) out.push(`${m}, ${c}`);
  if (m) out.push(`${eul(m)} 맞이하는 차 한 잔`);
  if (c) out.push(`${ro(c)} 채우는 ${m || '이번'} 시즌`);
  if (BY_PURPOSE[pur]) out.push(BY_PURPOSE[pur](m, c));
  if (a) out.push(`${eul(a)} 위한 ${c || '차 선물'}`);
  const basis = [m && '명분', c && '콘셉트', pur && '목적', a && '타깃'].filter(Boolean);
  return { mode: 'demo', basis, items: [...new Set(out)].filter(s => s.length <= 60).slice(0, 5) };
}
