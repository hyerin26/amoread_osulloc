const BK = window.BriefKeywords;
const OURS = {
  state: 'off'
};
const T = Object.create(null);
const LIVE = new Map();
const branchOrder = new Map();
const selectedEvidence = new Map();
let hiddenWords = new Set(),
  manualWords = [],
  conceptCandidates = [],
  conceptBasis = '';
let aiExpansions = [],
  mapPage = 0,
  keywordBusy = null,
  keywordMessage = '';
let researchEpoch = 0,
  aiEpoch = 0,
  researchReady = false;
let ROOT = BK.clean(new URLSearchParams(location.search).get('seed')) || '봄';
if (!BK.valid(ROOT)) ROOT = '봄';
let path = [ROOT],
  focus = ROOT,
  picked = [],
  chOn = new Set();
let keepFocus = null,
  titleTouched = false,
  sugPage = 0,
  rootEditing = false,   // 가운데 노드에서 명분을 고치는 중
  naverKeys = null;   // /api/connections: 네이버 키가 있는지 (결과가 비었을 때 안내 문구용)
const opened = new Set();   // 지도에서 펼친 키워드 (접기 전까지 유지)
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
} [c]));
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};
const info = k => T[k] || {
  kids: [],
  category: 'topic',
  source: 'manual'
};
const mapRoot = () => path[path.length - 1];
const sourceName = s => BK.sources[s] || '명분';

function addNode(k, props = {}) {
  k = BK.clean(k);
  if (!BK.valid(k)) return null;
  const node = T[k] || (T[k] = {
    kids: [],
    category: 'topic',
    source: 'manual'
  });
  Object.assign(node, props);
  return node;
}
addNode(ROOT, {
  source: 'root'
});
$('#rootName').textContent = ROOT;

// 마인드맵 툴팁: 키워드 알약의 출처·관심 신호 (알약에 담기엔 길어서). 화면 읽기 프로그램은 노드의 aria-label로 같은 내용을 듣는다
function showTip(n) {
  const tip = $('#mapTip'), box = $('.map-scroll');
  if (!n?.dataset.tip || !tip || !box) return hideTip();
  tip.textContent = n.dataset.tip;
  tip.hidden = false;
  const r = n.getBoundingClientRect(), b = box.getBoundingClientRect();
  tip.style.left = `${r.left - b.left + box.scrollLeft + r.width / 2}px`;
  tip.style.top = `${r.top - b.top + box.scrollTop - 6}px`;
}
function hideTip() { const tip = $('#mapTip'); if (tip) tip.hidden = true; }
// 가운데 노드에서 명분 고치기
function editRoot(on) {
  if (on && !researchReady) return;   // 기획안을 다 불러오기 전에는 고치지 않음 (예전 [이 명분으로 키워드 찾기]가 꺼져 있던 것과 같음)
  rootEditing = on;
  renderMap();
  if (on) { const i = $('#rootInput'); i?.focus(); i?.select(); i?.closest('.card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  else $('[data-root-edit]')?.focus();
}

function dataFor(k) {
  const own = LIVE.get(k)?.data;
  if (own) return own;
  // 지수는 같은 API 응답 안에서만 비교한다. 다른 검색에서 해당 단어가 실제로 조회된 경우만 신호로 사용.
  return [...LIVE.values()].map(r => r.data).find(d => d?.sources?.datalab?.items?.some(t => t.keyword === k));
}

function branchWords(base = mapRoot()) {
  const audience = $('#who').value.trim();
  const latest = aiExpansions.filter(e => e.parent === base).at(-1);
  const relevance = k => (latest?.items.some(x => x.keyword === k) ? 3 : 0) + (BK.trend(dataFor(k), k).change >= .2 ? 2 : 0) + (audience
    .includes(k) ? 2 : 0) + (productsFor(k).length ? 1 : 0);
  const all = [...new Set(info(base).kids)].filter(k => k !== base);
  const previous = branchOrder.get(base) || [];
  // 근거 응답이 도착할 때마다 노드가 이동하면 클릭 대상을 놓치므로 기존 가지 순서는 유지한다.
  const order = previous.filter(k => all.includes(k)).concat(all.filter(k => !previous.includes(k)).sort((a, b) => relevance(b) - relevance(
    a)));
  branchOrder.set(base, order);
  return order.filter(k => !hiddenWords.has(k) && (!chOn.size || chOn.has(info(k).source)));
}

function productsFor(k) {
  if (OURS.state !== 'ok') return [];
  const words = BK.clean(k).replace(/\s/g, '');
  return (OURS.prods || []).filter(p => words && String(p.name || '').replace(/\s/g, '').includes(words)).slice(0, 5);
}

function connectProducts() {
  if (OURS.state !== 'ok') return;
  for (const base of new Set([ROOT, mapRoot(), ...opened])) {
    const prods = [base, ...picked, ...info(base).kids.filter(k => info(k).source !== 'product')].flatMap(productsFor);
    for (const p of prods) {
      const k = BK.clean(String(p.name || '').replace(/[^가-힣A-Za-z0-9 ]/g, ' ')).slice(0, 20).trim();
      if (k === ROOT || k === base || !BK.valid(k)) continue;
      const node = addNode(k, {
        category: 'product',
        source: 'product',
        product: {
          seq: p.seq,
          name: p.name
        }
      });
      if (node && !info(base).kids.includes(k)) info(base).kids.push(k);
    }
  }
}

// 지도: 가운데는 늘 명분. 펼친 키워드(opened)의 가지는 바깥쪽 줄에 함께 그리고, 접기 전까지 남는다 (탐색한 키워드로 돌아가도 유지)
// 간격 (2026-11-16 다듬기: 38·44px로 붙어 있어 '옹졸하게' 보였다)
//   ROW1 = 1단 가지 한 칸 높이, ROW = 하위 가지 한 칸, GAP1 = 가운데 → 1단, GAPN = 부모 → 자식, ARC = 부채꼴 휨(가운데 줄이 위아래보다 이만큼 바깥)
//   펼친 가지가 있으면 가로가 길어지므로 휨·간격을 줄여 카드 폭 안에 들게 한다 (spacing())
const MAX_DEPTH = 3, KIDS_MAX = 8, ROW1 = 50, ROW = 36;
const spacing = () => (opened.size ? { GAP1: 60, GAPN: 40, ARC: 36 } : { GAP1: 76, GAPN: 48, ARC: 72 });
const parentOf = new Map();   // 지도에 그린 키워드 → 부모 (펼치기·접기·탐색 경로용)
function chainOf(k) {
  const out = [k];
  for (let p = parentOf.get(k), n = 0; p && n < 10; p = parentOf.get(p), n++) out.unshift(p);
  return out[0] === ROOT ? out : [ROOT];
}

function renderMap() {
  const svg = $('#map'),
    words = branchWords(ROOT),
    size = 12;
  const pages = Math.max(1, Math.ceil(words.length / size));
  mapPage = Math.min(mapPage, pages - 1);
  const shown = words.slice(mapPage * size, (mapPage + 1) * size);
  hideTip();
  svg.replaceChildren();
  const gE = svgEl('g', {}),
    gN = svgEl('g', {});
  svg.append(gE, gN);

  // 노드 = [고르기 동그라미] [키워드] 알약. 출처·관심 신호는 툴팁으로. 가운데 노드 오른쪽에는 명분 고치기 연필
  // anchor: 'c' 가운데 기준, 'r' 오른쪽 끝을 x에(왼쪽 가지), 'l' 왼쪽 끝을 x에(오른쪽 가지)
  function node(k, x, y, root = false, anchor = 'c', depth = 0) {
    const source = info(k).source,
      signal = BK.trend(dataFor(k), k),
      isPicked = picked.includes(k);
    const tip = root ? '' :
      `${sourceName(source)}${signal.change!==null ? signal.change>=.2?', 관심 상승':signal.change<=-.2?', 관심 하락':'' : ''}`;
    const g = svgEl('g', {
      class: `node ${root?'root':`keyword d${Math.min(depth, 2)}`}${isPicked?' picked':''}${focus===k?' focus':''}${opened.has(k)?' open':''}`,
      tabindex: 0,
      role: 'button',
      'data-k': k,
      'aria-label': `${k}${isPicked?', 고름':''}${tip?', '+tip:''}. Enter로 근거 보기, Space로 브리프에 담기`
    });
    if (tip) g.dataset.tip = tip;
    // 칩 규격 (Material 3 입력 칩, Atlassian·Toss 칩과 같은 8px 그리드): [여백][동그라미][8px][글자][(연필 자리)][여백]
    //   키워드: 높이 28 · 왼쪽 10 · 동그라미 12 · 간격 8 · 글자 · 오른쪽 12
    //   명분:   높이 36 · 왼쪽 12 · 동그라미 14 · 간격 8 · 글자 · 간격 4 · 연필 버튼 24(아이콘 14) · 오른쪽 6
    //   1단 키워드는 한 단계 크게(높이 32) → 가운데·1단·하위 세 단계가 크기로 구분된다 (2026-11-16)
    const S = root ? { h: 40, l: 14, d: 14, gap: 8, r: 8, btn: 24, btnGap: 4 }
      : depth <= 1 ? { h: 32, l: 12, d: 12, gap: 8, r: 14, btn: 0, btnGap: 0 } : { h: 28, l: 10, d: 12, gap: 8, r: 12, btn: 0, btnGap: 0 };
    const t = svgEl('text', { x, y, class: 'lbl' });
    t.textContent = k.length > 14 ? k.slice(0, 13) + '…' : k;
    g.append(t);
    gN.append(g);
    const tw = t.getComputedTextLength(),
      w = S.l + S.d + S.gap + tw + (root ? S.btnGap + S.btn + S.r : S.r),
      h = S.h,
      cx = anchor === 'r' ? x - w / 2 : anchor === 'l' ? x + w / 2 : x,
      x0 = cx - w / 2,
      dc = x0 + S.l + S.d / 2;   // 동그라미 가운데
    t.setAttribute('x', x0 + S.l + S.d + S.gap);
    g.insertBefore(svgEl('rect', { x: x0, y: y - h / 2, width: w, height: h, rx: h / 2 }), t);   // 알약 모양 (끝이 둥근 칩)
    const ck = svgEl('g', { class: `ck${isPicked ? ' on' : ''}`, 'data-pickk': k });
    ck.append(svgEl('rect', { class: 'hit', x: dc - 12, y: y - 12, width: 24, height: 24, rx: 6 }));   // 누르는 자리 24px
    ck.append(svgEl('circle', { cx: dc, cy: y, r: S.d / 2 }));
    if (isPicked) { const q = S.d / 12; ck.append(svgEl('path', { d: `M${dc - 3 * q} ${y}l${2.2 * q} ${2.2 * q} ${3.8 * q}-${4.4 * q}` })); }
    g.append(ck);
    if (root) {
      const ed = svgEl('g', { class: 'root-edit-btn', tabindex: 0, role: 'button', 'data-root-edit': '', 'aria-label': `명분 '${k}' 고치기` });
      const bx = x0 + w - S.r - S.btn, ex = bx + S.btn / 2;   // 버튼 왼쪽 끝, 아이콘 가운데
      ed.append(svgEl('rect', { class: 'hit', x: bx, y: y - S.btn / 2, width: S.btn, height: S.btn, rx: 6 }));
      // 연필: 디자인 시스템 아이콘 규격(24 그리드, 선 1.75)을 14px로. 세트에 '고치기' 아이콘이 없어 같은 규격으로 추가
      ed.append(svgEl('path', { d: 'M17 3.5a2.1 2.1 0 0 1 3 3L7.5 19 3 20.5 4.5 16Z M15 5.5l3 3', transform: `translate(${ex - 7} ${y - 7}) scale(${14 / 24})` }));
      const title = svgEl('title', {});
      title.textContent = '명분 고치기';
      ed.append(title);
      gN.append(ed);
    }
    return { w, cx };
  }

  // 1) 무엇을 그릴지: 가운데(명분) → 1줄(명분의 가지, 12개씩 나눠 보기) → 펼친 키워드의 가지 (줄마다 최대 8개, 3줄까지)
  parentOf.clear();
  const drawn = new Set([ROOT, ...shown]), tree = new Map(), H = new Map();
  shown.forEach(k => parentOf.set(k, ROOT));
  function grow(k, depth) {
    const kids = depth < MAX_DEPTH && opened.has(k) ? branchWords(k).filter(w => !drawn.has(w)).slice(0, KIDS_MAX) : [];
    kids.forEach(w => { drawn.add(w); parentOf.set(w, k); });
    tree.set(k, kids);
    H.set(k, Math.max(depth <= 1 ? ROW1 : ROW, kids.reduce((a, c) => a + grow(c, depth + 1), 0)));
    return H.get(k);
  }
  shown.forEach(k => grow(k, 1));
  // 2) 자리: 왼쪽·오른쪽에 번갈아. 펼친 키워드는 자기 가지 높이만큼 자리를 차지한다
  const CX = 550, CY = 320, spots = [];
  for (const side of [-1, 1]) {
    const items = shown.filter((_, i) => (i % 2 === 0) === (side < 0));
    let y = CY - items.reduce((a, k) => a + H.get(k), 0) / 2;
    const place = (k, depth, y0) => {
      spots.push({ k, depth, side, y: y0 + H.get(k) / 2 });
      let yy = y0;
      for (const c of tree.get(k)) { place(c, depth + 1, yy); yy += H.get(c); }
    };
    for (const k of items) { place(k, 1, y); y += H.get(k); }
  }
  // 3) 그리기: 가운데 먼저(너비를 알아야 선을 이음), 그다음 줄마다 (앞 줄의 가장 넓은 알약만큼 바깥으로)
  let rootHalf;
  if (rootEditing) {
    rootHalf = 140;
    const fo = svgEl('foreignObject', { x: CX - 140, y: CY - 22, width: 280, height: 44, class: 'root-edit' });
    fo.innerHTML = `<form xmlns="http://www.w3.org/1999/xhtml" id="rootForm" class="root-edit-form"><input type="text" id="rootInput" maxlength="20" required pattern="[가-힣A-Za-z0-9 ]{1,20}" aria-label="명분 (한글, 영문, 숫자, 공백 20자 이내)" value="${esc(ROOT)}"><button type="submit" class="btn sm primary">확인</button><button type="button" class="btn sm" data-root-cancel>취소</button></form>`;
    gN.append(fo);
  } else rootHalf = node(ROOT, CX, CY, true).w / 2;
  // 1단은 가운데 노드를 둘러싼 부채꼴: 가운데 높이 줄이 가장 바깥(ARC), 위아래 끝으로 갈수록 안쪽 → 둥글게 퍼진 지도.
  // 하위 가지는 부모 알약 바로 바깥(GAPN)에서 자라 가지마다 따로 뻗는다 (예전엔 깊이마다 한 세로줄에 모여 표처럼 보였음).
  // 가운데 → 지금 보고 있는 키워드까지의 선은 강조 (어디서 뻗어 나온 말인지 보이게)
  const onPath = new Set(chainOf(focus)), spotOf = new Map(spots.map(s => [s.k, s])), { GAP1, GAPN, ARC } = spacing();
  const edge = (x1, y1, x2, y2, depth, on) => {
    const mid = x1 + (x2 - x1) * .55;
    gE.append(svgEl('path', { class: `edge d${Math.min(depth, 2)}${on ? ' on' : ''}`, d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}` }));
  };
  const draw = (s, inner, py, px) => {
    const left = s.side < 0, { w, cx } = node(s.k, inner, s.y, false, left ? 'r' : 'l', s.depth);
    const near = left ? cx + w / 2 : cx - w / 2, outer = left ? cx - w / 2 : cx + w / 2;
    edge(px, py, near, s.y, s.depth, onPath.has(s.k) && focus !== ROOT);
    for (const c of tree.get(s.k) || []) draw(spotOf.get(c), outer + s.side * GAPN, s.y, outer);
  };
  for (const side of [-1, 1]) {
    const firsts = spots.filter(s => s.depth === 1 && s.side === side);
    const maxDy = Math.max(1, ...firsts.map(s => Math.abs(s.y - CY)));
    for (const s of firsts) {
      const t = Math.abs(s.y - CY) / maxDy;
      draw(s, CX + side * (rootHalf + GAP1 + ARC * (1 - t * t)), CY, CX + side * rootHalf);
    }
  }
  // 가지가 없을 때: 네이버로 찾는 중이면 그 안내, 다 찾았는데 비었으면 그때만 AI를 권한다 (AI는 자동으로 돌지 않음)
  const loading = LIVE.get(ROOT)?.state === 'loading', empty = !shown.length && !rootEditing;
  if (empty && loading) {
    const msg = svgEl('text', { class: 'map-empty', x: CX, y: CY + 60 });
    msg.textContent = '네이버에서 연관어를 찾고 있어요.';
    svg.append(msg);
  }
  const box = $('#mapEmpty');
  if (box) {
    box.hidden = !empty || loading || !!keywordBusy;
    const noKey = naverKeys && !naverKeys.naver && !naverKeys.searchad;
    $('#mapEmptyMsg').textContent = noKey ? '네이버 키가 연결되지 않아 검색 연관어를 찾지 못했어요. AI로 웹에서 찾아볼 수 있어요.'
      : '네이버 검색에서 찾은 연관어가 없어요. AI로 웹에서 더 찾아볼 수 있어요.';
  }
  // 크기: 그린 내용에 맞춰 실제 픽셀로 (펼친 정도에 따라 글자 크기가 크게 바뀌지 않게). 칸보다 넓으면 조금만 줄이고 그다음엔 가로로 밀어 봄
  try {
    // 여백 64: 가장 바깥 알약이 카드 끝에 붙지 않게. 최소 높이 360: 가지가 적어도 지도가 납작해 보이지 않게
    const bb = svg.getBBox(), vw = Math.max(640, bb.width + 64), vh = Math.max(360, bb.height + 64),
      cw = $('.map-scroll').clientWidth || vw, scale = Math.max(.8, Math.min(1, cw / vw));
    svg.setAttribute('viewBox', `${Math.round(bb.x + bb.width / 2 - vw / 2)} ${Math.round(bb.y + bb.height / 2 - vh / 2)} ${Math.round(vw)} ${Math.round(vh)}`);
    Object.assign(svg.style, { width: `${Math.round(vw * scale)}px`, height: `${Math.round(vh * scale)}px`, minWidth: '0' });
  } catch { /* 그리기 전(화면 밖)에는 그대로 */ }
  $('#mapPagination').innerHTML = pages > 1 ?
    `<button class="btn sm" data-map-page="${mapPage-1}" ${mapPage===0?'disabled':''}>이전 가지</button><span class="cap">${mapPage+1}/${pages}쪽, ${words.length}개</span><button class="btn sm" data-map-page="${mapPage+1}" ${mapPage===pages-1?'disabled':''}>다음 가지</button>` :
    '';
  $('#hiddenKeywords').innerHTML = hiddenWords.size ? `숨긴 키워드 ${hiddenWords.size}개 <button class="lnk" data-restore-hidden>다시 보기</button>` :
    '';
}

function renderPath() {
  $('#path').hidden = path.length < 2;   // 명분 하나뿐이면 '탐색한 키워드 수능'은 가운데 노드와 같은 말이라 뺀다
  $('#path').innerHTML = '<span class="cap">탐색한 키워드</span>' + path.map((k, i) =>
      `${i ? '<span class="sep">›</span>' : ''}<button data-path="${i}" ${i===path.length-1?'aria-current="true"':''}>${esc(k)}</button>`)
    .join('');
}

function renderFilters() {
  $('#chFilters').innerHTML = Object.entries(BK.sources).map(([c, n]) =>
    `<button class="chip" data-ch="${c}" aria-pressed="${chOn.has(c)}">${n}</button>`).join(' ');
  $('#chClear').hidden = !chOn.size;
}

function renderStatus() {
  const rec = LIVE.get(mapRoot());
  const period = PLAN.doc?.brief?.period;
  const count = branchWords().length;
  $('#researchStatus').textContent = rec?.state === 'loading' ? `‘${mapRoot()}’ 연관어를 네이버에서 찾고 있어요.` : rec?.state === 'error' ?
    `검색하지 못했어요. ${rec.msg}` : '';
  const t = aiExpansions.find(e => e.parent === mapRoot())?.fetched_at || rec?.data?.fetched_at;
  $('#aiKeywordExpand').disabled = !researchReady || !!keywordBusy;
  $('#aiKeywordExpand').textContent = keywordBusy ? 'AI가 찾는 중' : 'AI로 더 찾기';
  // 평소 안내 문장은 뺐다 (스크롤 줄이기, 2026-11-16). AI가 찾는 중이거나 결과 메시지가 있을 때만 한 줄
  const aiMsg = keywordBusy ? `AI가 ‘${keywordBusy.seed}’ 관련 웹 자료를 찾고 있어요.` : keywordMessage;
  $('#aiKeywordStatus').textContent = aiMsg;
  $('#aiKeywordStatus').hidden = !aiMsg;
  $('#mapDemo').textContent = t ? `조회 ${formatTime(t)}` : '근거 기반 탐색';
}

function formatTime(t) {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '조회일 미확인' : d.toLocaleString('ko-KR');
}

function liveSearch(rec, k) {
  if (rec?.state === 'loading') return '<p class="cap">검색 흐름을 불러오는 중…</p>';
  if (rec?.state === 'error') return `<p class="cap">검색 추이를 확인하지 못했어요. ${esc(rec.msg)}</p>`;
  const data = rec?.data || dataFor(k),
    {
      item: t,
      change,
      label
    } = BK.trend(data, k);
  if (!t) return '<p class="cap">연결된 검색 데이터가 없어요.</p>';
  const pts = t.weekly || [],
    last = pts.slice(-4),
    prev = pts.slice(-8, -4);
  return `<p><span class="tag ${change >= .2 && change !== null ? 'ok-t' : ''}">${label}</span></p>
    <p class="cap">최근 4주 ${esc(last[0]?.[0] || '')} ~ ${esc(last.at(-1)?.[0] || '')}${prev.length===4 ? ` / 이전 4주 ${esc(prev[0][0])} ~ ${esc(prev.at(-1)[0])}` : ''}</p>
    <p class="cap">최근 지수는 ${last.map(([,v])=>Math.round(v)).join(', ')}이에요.${change===null?'':` 이전 4주보다 ${Math.abs(Math.round(change*100))}% ${change>=0?'높아요':'낮아요'}.`}</p>
    <p class="cap">네이버 검색어 트렌드에서 가장 높은 주를 100으로 둔 지수예요.${t.peak_month ? ` 가장 높았던 달은 ${t.peak_month}월이에요.` : ''}</p>`;
}

function livePosts(rec) {
  if (rec?.state === 'loading') return '<p class="cap">관련 글을 불러오는 중…</p>';
  const s = rec?.data?.sources?.naver_search;
  if (s?.status !== 'ok') return '<p class="cap">관련 글을 찾지 못했어요. 네이버 검색 연결을 확인해 주세요.</p>';
  const rows = ['뉴스', '블로그'].flatMap(kind => s.items.filter(x => x.kind === kind).slice(0, 3));
  return rows.length ?
    `<ul>${rows.map(x=>`<li>${BK.safeURL(x.link)?`<a href="${esc(BK.safeURL(x.link))}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>`:esc(x.title)}<span class="cap">${esc(x.kind)}, ${esc(x.date || '게시일 미확인')}</span></li>`).join('')}</ul><p class="cap">최신순 검색 결과예요.</p>` :
    '<p class="cap">관련 글을 찾지 못했어요.</p>';
}

function restoreEvidence(word, ev) {
  return addNode(word, {
    category: ev.category || 'topic',
    source: ev.source || 'manual',
    ...(['ai_web', 'ai_idea'].includes(ev.source) ? {
      aiEvidence: ev
    } : {})
  });
}

function restoreExpansions() {
  for (const batch of aiExpansions) {
    const parent = addNode(batch.parent);
    if (!parent) continue;
    for (const ev of batch.items || []) {
      if (ev.keyword === batch.parent || !restoreEvidence(ev.keyword, ev)) continue;
      if (!parent.kids.includes(ev.keyword)) parent.kids.push(ev.keyword);
    }
  }
}

function webKeywordEvidence(k) {
  const ev = info(k).aiEvidence || selectedEvidence.get(k);
  if (!ev || !['ai_web', 'ai_idea'].includes(ev.source)) return '';
  const links = (ev.articles || []).filter(a => BK.safeURL(a.link));
  return `<h3>${ev.source==='ai_web'?'웹 근거 기반 AI 추천':'AI 아이디어'}</h3><p>${esc(ev.rationale || '')}</p>
    <p class="cap">${ev.source==='ai_web'?'AI가 웹 자료에서 찾은 제안이에요. 검색량이 늘었다는 뜻은 아니에요.':'웹에서 근거를 찾지 못한 아이디어예요.'}${ev.fetched_at?` ${esc(formatTime(ev.fetched_at))}에 찾았어요.`:''}</p>
    ${links.length?`<ul>${links.map(a=>`<li><a href="${esc(BK.safeURL(a.link))}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a><span class="cap">자료 게시일 ${esc(a.date || '미확인')}</span></li>`).join('')}</ul>`:''}`;
}
async function expandAIKeywords() {
  if (keywordBusy || !researchReady) return;
  const seed = mapRoot(),
    token = {
      seed,
      epoch: researchEpoch
    };
  keywordBusy = token;
  keywordMessage = '';
  renderStatus();
  const period = PLAN.doc?.brief?.period;
  try {
    const result = await v2api('/api/brief/keywords', {
      root: ROOT,
      seed,
      audience: $('#who').value.trim(),
      period: period ? `${period.start} ~ ${period.end}` : '',
      exclude: [...new Set([ROOT, ...info(seed).kids, ...hiddenWords])].filter(BK.valid).slice(0, 80)
    });
    if (token.epoch !== researchEpoch) return;
    const entries = [];
    for (const item of result.items || []) {
      if (!BK.valid(item.keyword) || item.keyword === seed) continue;
      const ev = {
        keyword: item.keyword,
        root: ROOT,
        category: 'topic',
        source: item.source === 'ai_web' ? 'ai_web' : 'ai_idea',
        fetched_at: result.fetched_at || '',
        change_4w: null,
        rationale: String(item.rationale || '').slice(0, 300),
        articles: (item.sources || []).filter(x => BK.safeURL(x.link)).slice(0, 2)
      };
      if (ev.source === 'ai_web' && !ev.articles.length) ev.source = 'ai_idea';
      restoreEvidence(ev.keyword, ev);
      if (!info(seed).kids.includes(ev.keyword)) info(seed).kids.push(ev.keyword);
      if (picked.includes(ev.keyword)) selectedEvidence.set(ev.keyword, ev);
      entries.push(ev);
    }
    if (entries.length) aiExpansions.push({
      parent: seed,
      fetched_at: result.fetched_at || '',
      items: entries.slice(0, 8)
    });
    aiExpansions = aiExpansions.slice(-10);
    branchOrder.delete(seed);
    mapPage = 0;
    chOn.clear();
    keywordMessage = result.message || (entries.length ? `‘${seed}’에서 AI 키워드 ${entries.length}개를 찾았어요. 키워드를 눌러 출처를 확인하세요.` :
      '새 키워드를 찾지 못했어요. 중심 단어나 타깃을 구체화하고 다시 시도해 보세요.');
    saveBrief();
  } catch (e) {
    if (token.epoch === researchEpoch) keywordMessage = `${e.message} 기존 키워드는 유지돼요. 다시 눌러 시도할 수 있어요.`;
  } finally {
    if (keywordBusy === token) keywordBusy = null;
    if (token.epoch === researchEpoch) render();
  }
}

function renderSide() {
  const k = focus,
    el = $('#side');
  const n = info(k),
    rec = n.source === 'product' ? null : researchReady ? live(k) : {
      state: 'loading'
    };
  const products = n.product ? [n.product] : productsFor(k);
  el.innerHTML =
    `<div class="overline">${k===ROOT?'중심 명분':sourceName(n.source)}</div><h2>${esc(k)}</h2>
    <p class="cap">${rec?.data?.fetched_at?`${esc(formatTime(rec.data.fetched_at))}에 조회했어요${rec.data.cached?' (저장된 결과)':''}.`:'아직 조회된 근거가 없어요.'}</p>
    ${webKeywordEvidence(k)}
    ${n.source==='product'?'':`<h3>관심 변화 <span class="tag">검색 데이터</span></h3>${liveSearch(rec,k)}${rec?.state==='error'?`<button class="btn sm" data-retry-keyword="${esc(k)}">근거 다시 찾기</button>`:''}<h3>관련 콘텐츠 <span class="tag">뉴스·블로그</span></h3>${livePosts(rec)}`}
    <h3>연결 상품</h3>${products.length?`<ul>${products.map(p=>`<li>${esc(p.name)} <span class="cap">상품번호 ${esc(p.seq)}</span></li>`).join('')}</ul>`:`<p class="cap">${OURS.state==='loading'?'상품을 불러오는 중…':OURS.state==='ok'?'이름이 일치하는 판매 중 상품이 없어요. 상품 연결은 별도로 검토해 주세요.':'상품 데이터 연결을 확인해 주세요.'}</p>`}
    ${(oursOf(k) || []).length ? `<h3>지난 기획·상품 근거</h3><ul>${oursOf(k).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <h3>기획에 활용하기 <span class="tag">AI 해석</span></h3><div id="keywordInterpretation"></div><button class="btn sm" data-ai-keyword="${esc(k)}">AI 활용 방향 보기</button>

    <div class="acts"><button class="btn ${picked.includes(k)?'':'primary'}" data-pick="${esc(k)}" aria-pressed="${picked.includes(k)}">${picked.includes(k)?'브리프에서 빼기':'브리프에 담기'}</button>${k!==ROOT&&n.source!=='product'&&(opened.has(k)||chainOf(k).length<=MAX_DEPTH)?`<button class="btn" data-open-k="${esc(k)}" aria-expanded="${opened.has(k)}">${opened.has(k)?'펼친 가지 접기':'이 말에서 더 펼치기'}</button>`:''}${k!==ROOT?`<button class="lnk" data-hide="${esc(k)}">이 추천 숨기기</button>`:''}</div>`;
  const interpretation = aiNotes.get(k);
  if (interpretation) $('#keywordInterpretation').textContent = interpretation;
}
const aiNotes = new Map();

function renderDock() {
  $('#picked').innerHTML = picked.length ? `<span class="cap">${picked.length}/30개</span>` + picked.map(k =>
    `<span class="pk"><button data-focus="${esc(k)}" aria-label="${esc(k)} 근거 보기">${esc(k)}</button><button data-unpick="${esc(k)}" aria-label="${esc(k)} 빼기">✕</button></span>`
  ).join('') : '<span class="cap">지도에서 동그라미를 누르면 여기 담겨요</span>';
  renderSugs();
  renderConcepts();
  if (typeof renderMoods === 'function') renderMoods();
}
const METHODS = [
  ['장면형', k => `${k}에 차 한 잔을 더하면`],
  ['재정의형', k => `${ROOT}, ${k}에서 찾은 여유`],
  ['감각 묘사형', k => `${k} 사이로 번지는 찻잎 향`],
  ['질문형', k => `${ROOT}, ${k} 준비됐나요?`],
  ['대비형', k => `바쁜 일상에도 ${k}의 여유`],
  ['초대형', k => `${k} 티타임에 초대해요`]
];

function copyIdeas() {
  const ks = picked.length ? picked : [ROOT],
    out = [];
  for (const k of ks)
    for (const [m, f] of METHODS) out.push({
      m,
      t: f(k),
      k
    });
  const c = $('#concept').value.trim();
  return c ? [{
    m: '컨셉 그대로',
    t: c,
    k: ''
  }, ...out] : out;
}

function renderSugs() {
  const all = copyIdeas(),
    n = 3,
    start = (sugPage * n) % all.length,
    cur = $('#copy').value;
  const show = Array.from({
    length: Math.min(n, all.length)
  }, (_, i) => all[(start + i) % all.length]);
  $('#sugBasis').textContent =
    `근거: ${picked.length?`고른 키워드(${picked.join(', ')})`:`명분(${ROOT})`}${$('#concept').value.trim()?', 컨셉':''}${$('#who').value.trim()?', 누구에게':''}`;
  $('#sugs').innerHTML = show.map(s =>
    `<button class="sug" data-copy="${esc(s.t.slice(0,60))}" aria-pressed="${cur===s.t}"><span class="c">${esc(s.t)}</span><span class="tag">${esc(s.m)}</span></button>`
  ).join('');
  $('#footNote').textContent = cur.trim() ? '' : '메인 카피가 비어 있어도 넘어갈 수 있어요.';
}

function renderConcepts() {
  $('#conceptCandidates').innerHTML = conceptCandidates.map((c, i) =>
    `<button class="sug concept-candidate" data-concept="${i}"><span class="c">${esc(c.text || c)}</span><span class="cap">${esc(c.rationale || conceptBasis)}</span><span class="tag">${c.source==='ai'?'AI 해석':'키워드 조합'}</span></button>`
  ).join('');
}

function render() {
  connectProducts();
  renderPath();
  renderFilters();
  renderMap();
  renderStatus();
  renderSide();
  renderDock();
  if (keepFocus) {
    [...$('#map').querySelectorAll('.node')].find(n => n.dataset.k === keepFocus)?.focus();
    keepFocus = null;
  }
}

function autoTitle() {
  if (titleTouched) return;
  const c = $('#concept').value.trim();
  $('#title').value = c ? `${ROOT} · ${c}` : `${ROOT}${picked.length?` · ${picked.join(', ')}`:''} 기획안`;
}

function pick(k) {
  if (!BK.valid(k)) return;
  if (picked.includes(k)) {
    picked = picked.filter(x => x !== k);
    selectedEvidence.delete(k);
  } else {
    if (picked.length >= 30) {
      toast('키워드는 30개까지 담을 수 있어요');
      return;
    }
    picked.push(k);
    selectedEvidence.set(k, BK.evidence(k, info(k), dataFor(k), ROOT));
  }
  invalidateConcepts();
  autoTitle();
  render();
  saveBrief();
}

function invalidateConcepts() {
  aiEpoch++;
  conceptCandidates = [];
  conceptBasis = '';
}

// 펼치기·접기: 가운데는 그대로 두고 그 키워드의 가지를 바깥 줄에 더한다. 접으면 그 아래 펼친 것도 함께 접는다
function openK(k) {
  if (info(k).source === 'product' || k === ROOT) return;
  if (opened.has(k)) {
    for (const o of [...opened]) if (chainOf(o).includes(k)) opened.delete(o);
    path = chainOf(k).slice(0, -1);
  } else {
    opened.add(k);
    path = chainOf(k);
  }
  focus = k;
  keywordMessage = '';
  live(k);
  render();
}

function live(k, refresh = false) {
  if (LIVE.has(k) && !refresh) return LIVE.get(k);
  const rec = {
    state: 'loading',
    epoch: researchEpoch
  };
  LIVE.set(k, rec);
  v2api('/api/keywords/expand', {
    q: k,
    refresh
  }).then(d => {
    if (rec.epoch !== researchEpoch || LIVE.get(k) !== rec) return;
    rec.state = 'ok';
    rec.data = d;
    applyBranches(k, d);
    for (const w of picked)
      if (w === k) selectedEvidence.set(w, BK.evidence(w, info(w), d, selectedEvidence.get(w)?.root || ROOT));
    if (picked.includes(k)) saveBrief();
  }).catch(e => {
    if (rec.epoch === researchEpoch) {
      rec.state = 'error';
      rec.msg = e.message;
    }
  }).finally(() => {
    if (rec.epoch === researchEpoch && LIVE.get(k) === rec) render();
  });
  return rec;
}

function applyBranches(k, d) {
  const parent = addNode(k),
    ad = d.sources?.searchad?.status === 'ok' ? d.sources.searchad.items : [];
  const rows = [...ad.slice(0, 12).map(x => ({
    word: x.keyword,
    source: 'searchad'
  })), ...(d.words || []).map(word => ({
    word,
    source: 'content'
  }))];
  for (const r of rows) {
    const w = BK.clean(r.word);
    if (w === k || path.includes(w) || !BK.valid(w)) continue;
    const node = addNode(w);
    if (node.source === 'manual' && !manualWords.some(x => x.keyword === w)) node.source = r.source;
    if (!parent.kids.includes(w)) parent.kids.push(w);
  }
}

function selectFocus(k) {
  focus = k;
  keepFocus = k;
  render();
}
$('#map').addEventListener('click', e => {
  if (e.target.closest('[data-root-edit]')) { editRoot(true); return; }
  if (e.target.closest('[data-root-cancel]')) { editRoot(false); return; }
  const ck = e.target.closest('[data-pickk]');   // 왼쪽 동그라미 = 브리프에 담기·빼기
  if (ck) { keepFocus = ck.dataset.pickk; pick(ck.dataset.pickk); return; }
  const n = e.target.closest('.node');
  if (n) selectFocus(n.dataset.k);
});
$('#map').addEventListener('mouseover', e => { const n = e.target.closest('.node'); n ? showTip(n) : hideTip(); });
$('#map').addEventListener('mouseleave', hideTip);
$('#map').addEventListener('focusin', e => showTip(e.target.closest('.node')));
$('#map').addEventListener('focusout', hideTip);
$('#map').addEventListener('submit', e => {
  if (e.target.id !== 'rootForm') return;
  e.preventDefault();   // 같은 명분이어도 다시 찾는다 (예전 [이 명분으로 키워드 찾기]와 같음)
  if (applyRootInput()) { editRoot(false); toast('명분을 반영하고 키워드를 다시 찾고 있어요. 작성한 내용은 유지했어요'); }
});
$('#map').addEventListener('input', e => { if (e.target.id === 'rootInput') e.target.setCustomValidity(''); });
$('#map').addEventListener('keydown', e => {
  if (e.key === 'Escape' && (e.target.id === 'rootInput' || e.target.closest('#rootForm'))) { e.preventDefault(); editRoot(false); return; }
  if (e.target.closest('[data-root-edit]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); editRoot(true); return; }
  const n = e.target.closest('.node');
  if (!n) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    selectFocus(n.dataset.k);
  }
  if (e.key === ' ') {
    e.preventDefault();
    keepFocus = n.dataset.k;
    pick(n.dataset.k);
  }
});
document.addEventListener('click', e => {
  const t = e.target;
  const page = t.closest('[data-map-page]');
  if (page) {
    mapPage = Math.max(0, +page.dataset.mapPage);
    renderMap();
    return;
  }
  const b = t.closest('[data-pick],[data-unpick]');
  if (b) {
    pick(b.dataset.pick || b.dataset.unpick);
    return;
  }
  const f = t.closest('[data-focus]');
  if (f) {
    selectFocus(f.dataset.focus);
    return;
  }
  const o = t.closest('[data-open-k]');
  if (o) {
    openK(o.dataset.openK);
    return;
  }
  const pa = t.closest('[data-path]');
  if (pa) {
    mapPage = 0;
    keywordMessage = '';
    path = path.slice(0, +pa.dataset.path + 1);
    focus = mapRoot();
    render();
    return;
  }
  const c = t.closest('[data-ch]');
  if (c) {
    mapPage = 0;
    chOn.has(c.dataset.ch) ? chOn.delete(c.dataset.ch) : chOn.add(c.dataset.ch);
    render();
    return;
  }
  const h = t.closest('[data-hide]');
  if (h) {
    if (hiddenWords.size >= 100) {
      toast('숨길 수 있는 키워드는 100개까지예요');
      return;
    }
    hiddenWords.add(h.dataset.hide);
    focus = mapRoot();
    render();
    saveBrief();
    return;
  }
  if (t.closest('[data-restore-hidden]')) {
    hiddenWords.clear();
    render();
    saveBrief();
    return;
  }
  const ed = t.closest('[data-edit]');
  if (ed) {
    if (ed.dataset.edit === '명분') editRoot(true);   // 위쪽 '명분' 칩도 가운데 노드에서 고친다
    else toast(`${ed.dataset.edit}은 기획안을 시작할 때 정한 값이에요`);
    return;
  }
  const retry = t.closest('[data-retry-keyword]');
  if (retry) {
    live(retry.dataset.retryKeyword, true);
    render();
    return;
  }
  if (t.closest('[data-ai-more]')) {   // 지도가 비었을 때의 [AI로 더 찾기] = 위쪽 버튼과 같음
    $('#aiKeywordExpand').click();
    return;
  }
  const ai = t.closest('[data-ai-keyword]');
  if (ai) {
    requestAI('keyword', [ai.dataset.aiKeyword], ai);
    return;
  }
  const concept = t.closest('[data-concept]');
  if (concept) {
    const c = conceptCandidates[+concept.dataset.concept];
    $('#concept').value = (c.text || c).slice(0, 120);
    autoTitle();
    renderSugs();
    saveBrief();
    $('#concept').focus();
  }
});

function applyRootInput() {
  const k = BK.clean($('#rootInput').value);
  if (!BK.valid(k)) {
    $('#rootInput').setCustomValidity('한글·영문·숫자·공백 20자 이내로 입력해 주세요');
    $('#rootInput').reportValidity();
    return false;
  }
  researchEpoch++;
  branchOrder.clear();
  aiNotes.clear();
  LIVE.clear();
  keywordBusy = null;
  keywordMessage = '';
  mapPage = 0;
  for (const key of Object.keys(T)) delete T[key];
  if (k !== ROOT) {
    manualWords = [];
    hiddenWords.clear();
    aiExpansions = [];
  }
  for (const [word, ev] of selectedEvidence) restoreEvidence(word, ev);
  setRoot(k);
  for (const ev of manualWords) {
    restoreEvidence(ev.keyword, ev);
    if (ev.keyword !== ROOT && !info(ROOT).kids.includes(ev.keyword)) info(ROOT).kids.push(ev.keyword);
  }
  restoreExpansions();
  invalidateConcepts();
  autoTitle();
  saveBrief();
  live(ROOT, true);
  render();
  return true;
}
$('#aiKeywordExpand').addEventListener('click', () => {
  const ri = $('#rootInput');   // 가운데 노드에서 고치던 명분이 있으면 먼저 반영
  if (ri && BK.clean(ri.value) !== ROOT && !applyRootInput()) return;
  if (rootEditing) editRoot(false);
  expandAIKeywords();
});
$('#manualForm').addEventListener('submit', e => {
  e.preventDefault();
  const k = BK.clean($('#manualKeyword').value);
  if (!BK.valid(k)) {
    toast('한글·영문·숫자·공백 20자 이내로 추가해 주세요');
    return;
  }
  if (manualWords.length >= 30) {
    toast('직접 추가한 키워드는 30개까지 저장할 수 있어요');
    return;
  }
  addNode(k, {
    category: 'topic',
    source: 'manual'
  });
  if (k !== mapRoot() && !info(mapRoot()).kids.includes(k)) info(mapRoot()).kids.push(k);
  hiddenWords.delete(k);
  manualWords = manualWords.filter(x => x.keyword !== k).concat(BK.evidence(k, info(k), null, ROOT));
  $('#manualKeyword').value = '';
  focus = k;
  render();
  saveBrief();
});
$('#chClear').addEventListener('click', () => {
  chOn.clear();
  mapPage = 0;
  render();
});
$('#resetBtn').addEventListener('click', () => {
  path = [ROOT];
  focus = ROOT;
  chOn.clear();
  mapPage = 0;
  render();
});
$('#connBtn').addEventListener('click', () => {
  location.href = '/v2/settings#conn';
});
$('#title').addEventListener('input', () => {
  titleTouched = true;
});
$('#concept').addEventListener('input', () => {
  autoTitle();
  renderSugs();
});
$('#who').addEventListener('input', () => {
  branchOrder.clear();
  invalidateConcepts();
  renderConcepts();
  renderSugs();
  renderStatus();
  renderMap();
});
$('#copy').addEventListener('input', renderSugs);
$('#sugs').addEventListener('click', e => {
  const s = e.target.closest('[data-copy]');
  if (!s) return;
  $('#copy').value = s.dataset.copy;
  renderSugs();
  $('#copy').focus();
});
$('#moreSug').addEventListener('click', () => {
  sugPage++;
  renderSugs();
});
$('#conceptIdeas').addEventListener('click', () => {
  if (!picked.length) {
    toast('먼저 키워드를 담아 주세요');
    return;
  }
  aiEpoch++;
  const ks = picked.slice(0, 5),
    a = ks[0],
    b = ks[1] || ROOT;
  conceptBasis = `키워드 조합: ${ROOT}, ${ks.join(', ')}${$('#who').value.trim()?` / ${$('#who').value.trim()}`:''}`;
  conceptCandidates = [`${a}와 함께하는 ${b} 티타임`, `${ROOT}, ${a}의 마음을 ${b}에 담다`, `${a}에서 ${b}까지, 일상에 더하는 차 한 잔`].map(text => ({
    text: text.slice(0, 120),
    rationale: conceptBasis.slice(0, 300),
    source: 'combination',
    keywords: ks
  }));
  renderConcepts();
  saveBrief();
});
$('#aiConceptIdeas').addEventListener('click', e => {
  if (!picked.length) {
    toast('먼저 키워드를 담아 주세요');
    return;
  }
  requestAI('concept', picked.slice(0, 5), e.currentTarget);
});

function keywordTitles(k) {
  const articles = [...(info(k).aiEvidence?.articles || []), ...(LIVE.get(k)?.data?.sources?.naver_search?.items || []), ...(
    selectedEvidence.get(k)?.articles || [])];
  return [...new Set(articles.map(x => x.title).filter(Boolean))].slice(0, 3);
}
async function requestAI(mode, words, btn) {
  const epoch = aiEpoch,
    root = ROOT,
    word = words[0],
    target = mode === 'concept' ? $('#conceptCandidates') : $('#keywordInterpretation');
  btn.disabled = true;
  target.textContent = 'AI가 근거를 바탕으로 제안을 만들고 있어요…';
  try {
    const b = PLAN.doc?.brief || {},
      d = await v2api('/api/brief/recommendations', {
        mode,
        root,
        keywords: words,
        audience: $('#who').value.trim(),
        period: b.period ? `${b.period.start} ~ ${b.period.end}` : '',
        evidence: words.map(k => ({
          keyword: k,
          search_signal: BK.trend(dataFor(k), k).label,
          titles: keywordTitles(k)
        }))
      });
    if (epoch !== aiEpoch || root !== ROOT) return;
    if (mode === 'concept') {
      conceptCandidates = d.suggestions.map(s => ({
        ...s,
        source: 'ai'
      }));
      conceptBasis = `AI 해석: ${ROOT}, ${words.join(', ')}`;
      renderConcepts();
      saveBrief();
    } else {
      const s = d.suggestions[0];
      aiNotes.set(word, `${s.text} — ${s.rationale}`);
      if (focus === word && $('#keywordInterpretation')) $('#keywordInterpretation').textContent = aiNotes.get(word);
    }
  } catch (e) {
    if (epoch === aiEpoch && root === ROOT && (mode === 'concept' || focus === word)) {
      const el = mode === 'concept' ? $('#conceptCandidates') : $('#keywordInterpretation');
      if (el) el.textContent = `${e.message} 다시 눌러 시도할 수 있어요.`;
    }
  } finally {
    btn.disabled = false;
  }
}
v2api('/api/connections').then(c => {
  naverKeys = c.keys;
  renderMap();
  $('#connTxt').textContent = c.keys.naver && c.keys.searchad ? '네이버 검색과 검색광고가 연결돼 있어요.' : !c.keys.naver && !c.keys.searchad ? '네이버 검색과 검색광고 키가 없어요.' : c.keys.naver ? '네이버 검색은 연결돼 있고 검색광고 키는 없어요.' : '검색광고는 연결돼 있고 네이버 검색 키는 없어요.';
}).catch(() => {
  $('#connTxt').textContent = '연결 상태를 확인하지 못했어요';
});

// ---------------- 느낌 레퍼런스 ----------------
// 2026-11-10: 레퍼런스 라이브러리에 저장된 것(직접 추가·Pinterest에서 담은 것)을 먼저, 그다음 예시. tags로 브리프(명분·고른 키워드)에 맞는 것을 앞으로
const MOODS = [
  { id: 'm1', name: '돗자리 위 티타임', src: '외부 사례 · 봄 피크닉', tags: ['봄', '피크닉', '돗자리'], pts: ['색감', '소품'], r: [2, 3], demo: true },
  { id: 'm2', name: '연둣빛 봄 색감', src: '외부 캠페인 일부', tags: ['봄', '벚꽃'], pts: ['색감'], r: [4, 5], demo: true },
  { id: 'm3', name: '보온병 들고 산책', src: '외부 사례 · 아웃도어', tags: ['보온병', '산책', '피크닉'], pts: ['구도'], r: [9, 16], demo: true },
  { id: 'm4', name: '벚꽃 아래 찻잔', src: '자사몰 지난 행사 일부', tags: ['벚꽃', '봄'], pts: ['색감', '구도'], r: [3, 4], demo: true },
  { id: 'm5', name: '손글씨 봄 타이포', src: '외부 사례 · 시즌 타이포', tags: ['봄'], pts: ['글씨체'], r: [1, 1], demo: true },
  { id: 'm6', name: '한강 노을 피크닉', src: '외부 캠페인 일부', tags: ['한강', '피크닉'], pts: ['색감'], r: [3, 4], demo: true },
];
const POINTS = ['색감', '구도', '소품', '글씨체', '카피 톤'];
const CLSN_B = { season: '시즌', brand: '브랜드기획전', launch: '런칭', collab: '콜라보', clear: '클리어런스' };
const moodSel = new Map();   // 고른 느낌 레퍼런스 → 참고할 점
var libState = '';           // '' 불러오는 중 / ok / err (var: 이 줄보다 먼저 renderMoods가 불려도 오류 없게)
function moodImg(w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 40}" height="${h * 40}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#eef5ef"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#p)"/><rect x="0.5" y="0.5" width="${w * 40 - 1}" height="${h * 40 - 1}" fill="none" stroke="#dedede"/></svg>`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="">`;
}
const moodPic = m => (m.img ? `<img src="${esc(m.img)}" alt="" loading="lazy">` : m.kind ? `<span class="cap">${esc(m.kind)}</span>` : moodImg(m.r[0], m.r[1]));
async function loadLibMoods() {
  try {
    const d = await v2api('/api/am/references'), fav = new Set(d.favorites || []);
    for (const x of d.items || []) {
      if (MOODS.some(m => m.id === x.id)) continue;
      const img = x.img_file ? `/refimg/own/${x.img_file}` : x.pin_img ? `/refimg/pin?u=${encodeURIComponent(x.pin_img)}` : '';
      MOODS.push({ id: x.id, lib: true, fav: fav.has(x.id), name: x.name, src: x.source === 'Pinterest' ? 'Pinterest' : '라이브러리 · 직접 추가', img, kind: img ? '' : '링크', url: x.link,
        kindName: x.kind === 'etc' ? x.kind_label : { page: '전체 프로모션', sec: '구좌 사례', mood: '느낌', event: '이벤트 아이디어' }[x.kind] || '', season: x.season, cls: x.cls, pts: x.pts || [], tags: [x.season, ...(x.tags || []), ...(x.name || '').split(/\s+/)].filter(Boolean), memo: x.memo, r: [3, 4] });
    }
    libState = 'ok';
  } catch { libState = 'err'; }
  renderMoods();
}
function renderMoods() {
  const keys = [ROOT, ...picked], score = m => m.tags.filter(t => keys.includes(t)).length + (m.fav ? 0.5 : 0);
  const own = MOODS.filter(m => m.own), lib = MOODS.filter(m => m.lib).sort((a, b) => score(b) - score(a)).slice(0, 8), demo = MOODS.filter(m => m.demo).sort((a, b) => score(b) - score(a)).slice(0, lib.length ? 3 : 5);
  const list = own.concat(lib, demo);   // 직접 붙인 것 → 라이브러리 → 예시
  $('#moodBasis').textContent = libState === 'err' ? '라이브러리를 불러오지 못해 예시만 보여요.' : '';   // 정렬 설명은 뺌 (스크롤 줄이기)
  const tag = $('#moodSrcTag'); if (tag) { tag.textContent = lib.length ? `라이브러리 ${lib.length}개, 예시 ${demo.length}개` : '예시'; tag.className = `tag ${lib.length ? 'real' : 'demo-t'}`; }
  $('#moods').innerHTML = list.map(m => `<div class="mwrap"><button class="mood" data-mood="${m.id}" aria-pressed="${moodSel.has(m.id)}" title="${esc(m.src)}"><span class="fr">${moodPic(m)}</span><span class="mn">${m.fav ? '★ ' : ''}${esc(m.name)}</span><span class="cap">${esc(m.src)}${m.demo ? ' · 예시' : ''}</span></button>
    <button class="mdet" type="button" data-mdet="${m.id}" aria-label="${esc(m.name)} 자세히 보기">자세히</button></div>`).join('');
  $('#moodPicked').innerHTML = [...moodSel].map(([id, pts]) => { const m = MOODS.find(x => x.id === id); return `<div class="mpick" role="group" aria-label="${esc(m.name)}에서 참고할 것"><b>${esc(m.name)}</b><span class="cap">이 이미지에서 참고할 것 <em>여러 개 고를 수 있어요</em></span>
    ${POINTS.map(p => `<button class="pt" data-pt="${id}|${p}" aria-pressed="${pts.has(p)}">${p}</button>`).join('')}</div>`; }).join('');
  if (drawerId) renderMoodDrawer();
}
// 4-4: 상세는 브리프 위에 옆 서랍으로 (목록 페이지로 가지 않음). 고르기·빼기도 서랍에서
var drawerId = null, drawerFrom = null;
function renderMoodDrawer() {
  const m = MOODS.find(x => x.id === drawerId), d = $('#refDrawer');
  d.hidden = !m; $('#refScrim').hidden = !m; if (!m) return;
  const on = moodSel.has(m.id);
  const kv = [['출처', m.src + (m.demo ? ' (예시)' : '')], m.kindName && ['종류', m.kindName], m.cls && ['분류', CLSN_B[m.cls] || m.cls], m.season && ['명분·시즌', m.season], m.pts?.length && ['참고할 것', m.pts.join(', ')], m.memo && ['메모', m.memo]].filter(Boolean);
  d.innerHTML = `<div class="dh"><div><div class="ov">느낌 레퍼런스${m.demo ? ' · 예시' : m.lib ? ' · 라이브러리' : ' · 직접 붙임'}</div><h2 id="rdH">${esc(m.name)}</h2></div><button class="btn sm" data-mclose>닫기</button></div>
    <div class="db"><figure class="dfig">${moodPic(m)}</figure>
      <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}${m.url ? `<dt>링크</dt><dd><a class="lnk" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</a></dd>` : ''}</dl>
      <div class="row"><button class="btn sm ${on ? '' : 'primary'}" data-mtoggle="${m.id}">${on ? '이 브리프에서 빼기' : '이 브리프에 고르기'}</button>${m.lib ? '<a class="btn sm ghost" href="/v2/library#mood" target="_blank" rel="noopener">라이브러리에서 열기</a>' : ''}</div>
      ${m.demo ? '<p class="cap">예시 이미지예요. 레퍼런스 라이브러리에 직접 추가하거나 Pinterest에서 담은 것은 여기에 실제 이미지로 보여요.</p>' : ''}</div>`;
}
function openMoodDrawer(id, from) { drawerId = id; drawerFrom = from; renderMoodDrawer(); $('#refDrawer [data-mclose]')?.focus(); }
function closeMoodDrawer() { drawerId = null; renderMoodDrawer(); drawerFrom?.isConnected ? drawerFrom.focus() : $(`[data-mdet]`)?.focus(); drawerFrom = null; }
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-mclose]') || t.id === 'refScrim') { closeMoodDrawer(); return; }
  const tg = t.closest('[data-mtoggle]'); if (tg) { const id = tg.dataset.mtoggle; moodSel.has(id) ? moodSel.delete(id) : moodSel.set(id, new Set()); renderMoods(); $('#refDrawer [data-mtoggle]')?.focus(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerId) { e.preventDefault(); closeMoodDrawer(); } });
$('#moods').addEventListener('click', e => {
  const dt = e.target.closest('[data-mdet]'); if (dt) { openMoodDrawer(dt.dataset.mdet, dt); return; }
  const b = e.target.closest('[data-mood]'); if (!b) return; const id = b.dataset.mood; moodSel.has(id) ? moodSel.delete(id) : moodSel.set(id, new Set()); renderMoods(); $(`[data-mood="${id}"]`)?.focus(); });
$('#moodPicked').addEventListener('click', e => { const b = e.target.closest('[data-pt]'); if (!b) return; const [id, p] = b.dataset.pt.split('|'), s = moodSel.get(id); s.has(p) ? s.delete(p) : s.add(p); renderMoods(); $(`[data-pt="${id}|${p}"]`)?.focus(); });
// 직접 붙이기: 이미지는 이 PC에서 미리보기만, PDF·링크는 종류 표시. 붙이면 바로 고른 상태 (라이브러리에 남기려면 라이브러리에서 추가)
let ownN = 0;
function addOwn(m) { const id = `att${++ownN}`; MOODS.push({ id, own: true, tags: [], r: [3, 4], ...m }); moodSel.set(id, new Set()); renderMoods(); toast('느낌 레퍼런스로 붙였어요. 이 이미지에서 참고할 것을 골라 주세요'); }
$('#moodFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const isImg = f.type.startsWith('image/');
  if (!isImg && f.type !== 'application/pdf') { toast('이미지나 PDF 파일만 붙일 수 있어요'); return; }
  addOwn({ name: f.name.length > 16 ? f.name.slice(0, 16) + '…' : f.name, src: '직접 첨부 · 파일', kind: isImg ? '' : 'PDF', img: isImg ? URL.createObjectURL(f) : '' }); e.target.value = ''; });
$('#moodLinkBtn').addEventListener('click', e => { const row = $('#moodLinkRow'); row.hidden = !row.hidden; e.currentTarget.setAttribute('aria-expanded', !row.hidden); if (!row.hidden) $('#moodUrl').focus(); });
$('#moodUrlAdd').addEventListener('click', () => { const raw = $('#moodUrl').value.trim(); let u; try { u = new URL(raw); } catch { u = null; }
  if (!u || !/^https?:$/.test(u.protocol)) { toast('http나 https로 시작하는 주소를 넣어 주세요'); return; }
  addOwn({ name: u.hostname.replace(/^www\./, ''), src: '직접 첨부 · 링크', kind: '링크', url: raw }); $('#moodUrl').value = ''; $('#moodLinkRow').hidden = true; });
// 라이브러리는 새 탭으로 (쓰던 브리프는 그대로). 거기서 담은 것은 이 화면을 다시 열면 목록에 나옴
$('#moodLib').addEventListener('click', () => { window.open('/v2/library#mood', '_blank', 'noopener'); });
addEventListener('focus', () => { if (libState) loadLibMoods(); });   // 라이브러리 탭에서 돌아오면 새로 담은 것 반영
loadLibMoods();
$('#nextBtn').addEventListener('click', () => {
  if (!picked.length && !$('#concept').value.trim()) { toast('키워드를 하나 이상 고르거나 컨셉을 적어 주세요'); return; }
  const empty = !$('#copy').value.trim();
  if (!PLAN.id) { toast(`${empty ? '메인 카피가 비어 있어요. 구좌 구성 화면에서도 쓸 수 있어요. ' : ''}예시 기획안이에요: 홈에서 기획안을 만들면 구좌 구성으로 넘어가요`); return; }
  saveBrief();
  if (empty) toast('메인 카피가 비어 있어요. 구좌 구성 화면에서도 쓸 수 있어요');
  PLAN.flush().then(() => setTimeout(() => location.assign(`/v2/compose?id=${PLAN.id}`), empty ? 800 : 0));   // 저장을 마친 뒤 이동
});
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }

autoTitle(); render();

// ================= 기획안 잇기 (새 버전) =================
// 기획안을 열면 저장된 명분·키워드·컨셉·누구에게·메인 카피를 채우고, 고칠 때마다 저장 (plan.js)
const CLSN = {
  season: '시즌',
  brand: '브랜드기획전',
  launch: '런칭',
  collab: '콜라보',
  clear: '클리어런스'
};
const mdw = d => {
  const t = new Date(`${d}T00:00:00`);
  return `${t.getMonth() + 1}/${t.getDate()}(${'일월화수목금토'[t.getDay()]})`;
};

function setRoot(r) {
  ROOT = BK.clean(r);
  addNode(ROOT, {
    source: 'root'
  });
  $('#rootName').textContent = ROOT;
  opened.clear();
  path = [ROOT];
  focus = ROOT;
}

function saveBrief() {
  PLAN.save(d => {
    d.title = $('#title').value.trim().slice(0, 80) || d.title;
    d.brief = {
      ...d.brief,
      myeongbun: ROOT,
      season_ref: d.brief?.myeongbun === ROOT ? d.brief?.season_ref : null,
      concept: $('#concept').value.trim().slice(0, 300),
      audience: $('#who').value.trim().slice(0, 300),
      key_copy: $('#copy').value.trim().slice(0, 120)
    };
    d.v2.seed = ROOT;
    d.v2.keyword_research = {
      root: ROOT,
      hidden: [...hiddenWords].slice(0, 100),
      manual: manualWords.slice(0, 30),
      ai_expansions: aiExpansions.slice(-10),
      evidence: picked.map(k => selectedEvidence.get(k) || BK.evidence(k, info(k), dataFor(k), ROOT)),
      concept_candidates: conceptCandidates.map(c => ({
        text: (c.text || c).slice(0, 120),
        rationale: (c.rationale || conceptBasis).slice(0, 300),
        source: c.source || 'combination',
        keywords: (c.keywords || []).slice(0, 5)
      })).slice(0, 3),
      concept_basis: conceptBasis.slice(0, 500)
    };
    d.v2.keywords = picked.filter(k => k.length <= 20).slice(0, 30);
    const hero = d.page?.sections?.find(s => s.layoutId === 'hero');
    if (hero) hero.headline = d.brief.key_copy;

  });
}
// ---------- 우리 데이터 (기획안이 열려 있을 때, 실제): 명분 사전 · 지난 컨셉 · 이름이 겹치는 판매 중 상품 · 효능 표현 ----------
// 서버 안에서만 읽어요 (밖으로 보내지 않음). 규칙: 띄어쓰기를 뺀 키워드가 이름·컨셉에 들어 있으면 연결
const EFFICACY = ['면역', '다이어트', '치료', '개선', '예방', '해독', '감기', '비염', '알레르기'];

function loadOurs() {
  OURS.state = 'loading';
  const get = u => v2api(u).catch(() => null);
  Promise.all([get('/api/seasons'), get('/api/am/concepts?limit=200'), get('/api/products')]).then(([sea, con, pr]) => {

    Object.assign(OURS, {
      state: pr ? 'ok' : 'error',
      seasons: sea?.items || [],
      concepts: con?.items || [],
      prods: (pr?.products || []).filter(x => x.active)
    });
    render();
  });
}

function oursOf(k) {
  if (OURS.state !== 'ok') return OURS.state === 'loading' ? [] : null;
  const kk = String(k).replace(/\s/g, ''),
    has = t => String(t || '').replace(/\s/g, '').includes(kk),
    out = [];
  const sea = OURS.seasons.filter(m => has(m.name) || has(m.keyword) || (m.seeds || []).some(has));
  if (sea.length) out.push(`명분 사전에 있어요: ${sea.slice(0, 3).map(m => `${m.name} (${m.kind})`).join(', ')}`);
  const con = OURS.concepts.filter(c => c.id !== PLAN.id && (has(c.title) || has(c.myeongbun) || has(c.concept)));
  out.push(con.length ?
    `지난 컨셉에 썼어요: ${con.slice(0, 2).map(c => `${c.title} (${String(c.date || '').slice(0, 7)})`).join(', ')}${con.length > 2 ? ` 외 ${con.length - 2}개` : ''}` :
    '불러온 지난 기획안에서 일치하는 키워드를 찾지 못했어요');
  const pr = OURS.prods.filter(x => has(x.name)).sort((a, b) => (b.sales_28 || 0) - (a.sales_28 || 0));
  if (pr.length) out.push(`이름이 겹치는 판매 중 상품 ${pr.length}개: ${pr.slice(0, 3).map(x => x.name).join(', ')}${pr.length > 3 ? ' …' : ''}`);
  if (EFFICACY.some(w => String(k).includes(w))) out.push('효능처럼 읽힐 수 있어 문구 검토가 필요해요');
  return out;
}
PLAN.ready.then(doc => {
  researchReady = true;
  if (doc) {
    loadOurs();
  } // 상품·지난 기획 연결
  if (!doc) {
    live(ROOT);
    render();
    return;
  }
  researchEpoch++;
  LIVE.clear();
  const b = doc.brief || {};
  const savedRoot = BK.clean(b.myeongbun || doc.v2.seed || ROOT).slice(0, 20);
  setRoot(BK.valid(savedRoot) ? savedRoot : ROOT);
  picked = (doc.v2.keywords || []).filter(BK.valid).slice(0, 30);
  const research = doc.v2.keyword_research || {};
  for (const ev of research.evidence || []) {
    if (picked.includes(ev.keyword)) {
      selectedEvidence.set(ev.keyword, ev);
      restoreEvidence(ev.keyword, ev);
    }
  }
  if (research.root === ROOT) {
    hiddenWords = new Set(research.hidden || []);
    manualWords = research.manual || [];
    for (const ev of manualWords) {
      if (restoreEvidence(ev.keyword, ev)) info(ROOT).kids.push(ev.keyword);
    }
    aiExpansions = research.ai_expansions || [];
    restoreExpansions();
    conceptCandidates = research.concept_candidates || [];
    conceptBasis = research.concept_basis || '';
  }
  $('#title').value = doc.title || '';
  titleTouched = !!doc.title;
  $('#concept').value = b.concept || '';
  $('#who').value = b.audience || '';
  $('#copy').value = b.key_copy || '';
  const fact = (k, html) => {
    const el = document.querySelector(`[data-edit="${k}"]`);
    if (el) el.innerHTML = html;
  };
  fact('분류', esc(CLSN[doc.v2.cls] || '분류 미정'));
  fact('기간', `<span class="k">기간</span>${b.period ? `${mdw(b.period.start)} ~ ${mdw(b.period.end)}` : '날짜 미정'}`);
  fact('페이지', `<span class="k">페이지</span>${esc(b.page_kind || '이벤트')}`);
  live(ROOT);
  render();
});
document.addEventListener('input', e => {
  if (['title', 'concept', 'who', 'copy'].includes(e.target.id)) saveBrief();
});
document.addEventListener('click', e => {
  if (e.target.closest('#sugs [data-copy]')) setTimeout(saveBrief);
}); // 제안 문장을 메인 카피로 (키워드 고르기는 pick()에서 저장)
