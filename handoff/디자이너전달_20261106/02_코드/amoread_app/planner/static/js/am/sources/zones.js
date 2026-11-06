// Zone(PROMO_WORK 카테고리명) 유형 나누기와 묶기. 화면·서버에 기대지 않는 규칙만 둔다 (plans/17)
// shortcut: 유형 판정은 표기 규칙(정규식)으로만 한다. 표기 정리 사전·자동 분류가 생기면 kindOf만 바꾼다 (plans/16 엔지니어 검증)

// 기본 진열 유형. 담당자가 유형을 새로 추가하거나 이름을 고칠 수 있어 구좌에는 글자로 저장한다
export const ZONE_KINDS = ['가격대', '취향·테마', '차 종류', '큐레이션', '포장·구성', '혜택 방식', '요일', '기타'];

// 페이지 진열 칸이 아닌 값: 비어 있음, '-', 숨김
export const notZone = z => !z || z === '-' || /미노출/.test(z);

const RULES = [
  ['요일', /^[월화수목금토일]\s/],
  ['가격대', /만\s*원|원\s*이상|원대|가격대/],
  ['혜택 방식', /혜택|균일가|할인|쿠폰|\d\s*\+\s*\d|정율|정액|페이백|사은품|%/],
  ['', /^\d+$|가이드\s*\d+$|ROOM$|\s0\d$/i],   // 번호뿐인 이름(가격대·혜택 다음에 본다): 뜻을 알 수 없어 담당자가 고르게 둔다
  ['포장·구성', /보자기|쇼핑백|보틀|\d+\s*입$|PRESTIGE|패키지/i],
  ['큐레이션', /인기|재구매|리뷰|후기|급상승|새로|NEW|베스트|BEST|순위|카트|트렌디|같이\s*구매|핫템/i],
  ['차 종류', /말차|허브|블렌디드|녹차|발효차|잎차|콤부|콜드브루|밀크티|티푸드|티웨어|아이스티|그린티|티세트|디저트|스프레드|비스코티|초콜릿|랑드샤|스킨케어/],
  ['취향·테마', /달콤|은은|무카페인|다양|하절|리추얼|티타임|민트|선물/],
];
export function kindOf(name) {
  const n = String(name || '').trim();
  for (const [k, re] of RULES) if (re.test(n)) return k;
  return '';
}

// 지난 행사 상품 행 → 진열 순서대로 [{ name, count }]. row(원천 행 번호)가 없으면 처음 나온 순서
export function zoneSeq(items) {
  const hasRow = items.some(x => Number.isFinite(x.row));
  const list = hasRow ? [...items].sort((a, b) => (a.row ?? 1e9) - (b.row ?? 1e9)) : items;
  const m = new Map();
  list.forEach(x => { const z = String(x.zone || '').trim(); if (notZone(z)) return; m.set(z, (m.get(z) || 0) + 1); });
  return { ordered: hasRow, zones: [...m].map(([name, count]) => ({ name, count, kind: kindOf(name) })) };
}

// 같은 유형 + 같은 칸 수인 Zone 2개 이상은 한 구좌 안 필터 탭이었을 가능성이 높아 묶음으로 낸다 (가설, plans/17 2-1)
// 묶음은 첫 Zone 자리에 둔다. 결과: [{ kind, zones: [..], group: bool }]
export function units(zones) {
  const key = z => z.kind ? `${z.kind}|${z.count}` : null;
  const size = new Map();
  zones.forEach(z => { const k = key(z); if (k) size.set(k, (size.get(k) || 0) + 1); });
  const out = [], at = new Map();
  zones.forEach(z => {
    const k = key(z);
    if (k && size.get(k) >= 2) {
      if (at.has(k)) { out[at.get(k)].zones.push(z); return; }
      at.set(k, out.length); out.push({ kind: z.kind, zones: [z], group: true });
    } else out.push({ kind: z.kind, zones: [z], group: false });
  });
  return out;
}

// 칸 수로 레이아웃 고르기: 3의 배수·5칸은 3열, 그 밖은 2열
export const layoutFor = n => (n % 3 === 0 || n === 5) && n !== 6 ? 'grid3' : 'grid2';
