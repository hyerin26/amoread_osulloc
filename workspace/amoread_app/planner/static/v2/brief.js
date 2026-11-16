// ---------------- 예시 데이터 (가상) ----------------
const OURS = { state: 'off' };   // 우리 데이터 (기획안이 열려 있을 때 loadOurs)
// 종류로 묶음 (plans/22 §5: 회사 이름이 아니라 무엇을 알려 주나로)
const CH = { search: '검색', text: '글', video: '영상', ours: '우리 데이터', trend: '트렌드' };
// 채널 설명: 연결 후보 (plans/20 3장). 지금은 모두 예시
const CH_SRC = { search: '네이버 검색광고·데이터랩, 구글 트렌드', text: '네이버 뉴스·블로그·카페, 붙여 넣은 트렌드 기사', video: '유튜브', trend: '공개 출처 탐색(매거진·뉴스에 반복된 소비 현상), 지금 뜨는 것(매주: 뉴스·쇼츠·MZ 뉴스레터에서 급상승한 이름)', ours: '명분 사전 씨앗, 지난 컨셉, 리뷰 언급' };
const KIND = { search: 'search', news: 'text', sns: 'text', trend: 'text', ours: 'ours' };   // 예전 채널 → 종류
const POST_SRC = { news: '뉴스', sns: '블로그', trend: '트렌드 기사' };
// k: 키워드, ch: 채널, flow: 검색 흐름(말로만, 숫자 없음), posts: 관련 글 제목(가상), ours: 우리 데이터(가상), kids: 다음 가지
const T = {
  '봄': { ch: [], kids: ['벚꽃', '피크닉', '새학기', '춘곤증', '미세먼지', '봄나물', '화이트데이', '산책', '봄비', '꽃가루'] },
  '벚꽃': { ch: ['search', 'news', 'sns'], flow: '3월 말에 크게 늘어요', posts: [['news', '올해 벚꽃 개화 예상 시기'], ['sns', '벚꽃 아래 티타임 기록']], ours: ['작년 봄 컨셉에 썼어요 (벚꽃 티타임)'], kids: ['벚꽃 명소', '핑크 디저트', '야간 벚꽃', '체리블라썸 한정'] },
  '피크닉': { ch: ['search', 'sns', 'trend'], flow: '3월부터 꾸준히 늘어요', posts: [['trend', '요즘 피크닉은 이렇게 차려요'], ['sns', '한강 피크닉 준비물 정리'], ['news', '봄 나들이 수요 늘어']], ours: ['지난 컨셉에 쓴 적 없어요', '리뷰에 "나들이" 언급 조금'], kids: ['도시락', '돗자리', '한강', '보온병', '아이스티', '캠핑'] },
  '새학기': { ch: ['search', 'news'], flow: '2월 말~3월 초에 몰려요', posts: [['news', '새 학기 준비 소비 늘어']], ours: ['명분 사전에 있어요 (학사)'], kids: ['신입생', '공부 루틴', '집중력', '선생님 선물'] },
  '춘곤증': { ch: ['search', 'sns'], flow: '3~4월에 늘어요', posts: [['sns', '오후 3시 졸음 이기는 법']], ours: ['지난 컨셉에 쓴 적 없어요'], kids: ['오후 3시', '리프레시', '사무실 간식', '카페인'] },
  '미세먼지': { ch: ['search', 'news'], flow: '날마다 오르내려요', posts: [['news', '봄철 미세먼지 주의보']], ours: [], kids: ['실내 활동', '홈카페', '따뜻한 차'] },
  '봄나물': { ch: ['search', 'trend'], flow: '3월에 늘어요', posts: [['trend', '제철 봄나물 레시피']], ours: [], kids: ['쑥', '냉이', '건강 식단'] },
  '화이트데이': { ch: ['search', 'news', 'ours'], flow: '3월 초에 몰려요', posts: [['news', '화이트데이 선물 트렌드']], ours: ['명분 사전에 있어요 (기념일)', '리뷰에 "선물" 언급 많아요'], kids: ['사탕 대신', '커플 선물', '답례'] },
  '산책': { ch: ['sns'], flow: '봄 내내 비슷해요', posts: [['sns', '동네 산책 코스 추천']], ours: [], kids: ['텀블러', '러닝', '동네 카페'] },
  '봄비': { ch: ['sns', 'search'], flow: '4월에 조금 늘어요', posts: [['sns', '비 오는 날 집에서']], ours: [], kids: ['빗소리', '따뜻한 차'] },
  '꽃가루': { ch: ['search', 'news'], flow: '4월에 늘어요', posts: [['news', '꽃가루 알레르기 시즌']], ours: ['효능처럼 읽힐 수 있어 문구 검토가 필요해요'], kids: [] },
  '도시락': { ch: ['search', 'sns'], flow: '주말마다 늘어요', posts: [['sns', '피크닉 도시락 메뉴']], ours: [], kids: ['샌드위치', '디저트 박스', '김밥'] },
  '보온병': { ch: ['search', 'trend'], flow: '3월에 늘어요', posts: [['trend', '들고 다니는 차, 요즘 텀블러']], ours: ['연결 상품: 휴대용 티 세트 (예시)'], kids: ['텀블러', '콜드브루 티'] },
  '아이스티': { ch: ['search', 'sns'], flow: '4월부터 늘어요', posts: [['sns', '홈메이드 아이스티']], ours: ['연결 상품: 콜드브루 티백 (예시)'], kids: ['콜드브루 티', '과일 티'] },
  '한강': { ch: ['sns', 'search'], flow: '주말마다 늘어요', posts: [['sns', '한강 노을 피크닉']], ours: [], kids: ['노을', '자전거'] },
  '홈카페': { ch: ['search', 'sns', 'trend'], flow: '꾸준해요', posts: [['trend', '홈카페 티 블렌딩']], ours: ['지난 컨셉에 썼어요 (겨울 홈카페)'], kids: ['티 블렌딩', '라떼'] },
  '쑥': { ch: ['search', 'trend'], flow: '3월에 늘어요', posts: [['trend', '쑥 디저트가 다시 뜬다']], ours: ['연결 상품: 쑥 블렌딩 티 (예시)'], kids: ['쑥라떼', '쑥 디저트'] },
  '사무실 간식': { ch: ['search', 'sns'], flow: '꾸준해요', posts: [['sns', '탕비실 간식 추천']], ours: ['리뷰에 "사무실" 언급 조금'], kids: ['티백', '스틱 차'] },
};
const info = k => T[k] || { ch: ['search'], flow: '예시 데이터가 아직 없어요', posts: [], ours: [], kids: [] };

// ---------------- 상태 ----------------
// 홈 [시작]에서 고른 명분·씨앗이 중심 키워드 (없으면 예시 '봄'). 예시 가지는 '봄'에만 있어요
let ROOT = (new URLSearchParams(location.search).get('seed') || '').trim().slice(0, 20) || '봄';   // 기획안을 열면 저장된 명분으로 바뀜 (setRoot)
if (!T[ROOT]) T[ROOT] = { ch: [], kids: [] };
document.getElementById('rootName').textContent = ROOT;
let path = [ROOT];       // 지나온 길 (한 갈래만 펼침). path[i+1]은 path[i]의 가지
let center = 0;          // path에서 가운데에 놓인 위치 (3단계를 넘으면 가운데를 옮긴다)
let focus = ROOT;        // 옆 패널에 보이는 키워드
let picked = [];         // 고른 키워드
for (const d of Object.values(T)) if (d.ch) d.ch = [...new Set(d.ch.map(c => KIND[c] || c))];
T['피크닉'].videos = ['한강 피크닉 브이로그 · 봄 도시락 싸기', '피크닉 음료 3가지 만들기']; T['피크닉'].ch.push('video');
T['벚꽃'].videos = ['벚꽃 명소 산책 + 카페 투어']; T['벚꽃'].ch.push('video');
let chOn = new Set();    // 종류 필터 (비어 있으면 전체)
const MAX_DEPTH = 3;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
const visibleByCh = k => !chOn.size || info(k).ch.some(c => chOn.has(c));

// 보이는 나무: 가운데 키워드의 가지 + 펼친 갈래의 가지 (한 갈래만)
function tree() {
  const root = { k: path[center], depth: 0, kids: [] };
  let cur = root;
  for (let d = center; d < path.length; d++) {
    const k = path[d];
    cur.kids = info(k).kids.map(c => ({ k: c, depth: cur.depth + 1, kids: [] }));
    const nx = path[d + 1]; if (!nx) break;
    cur = cur.kids.find(c => c.k === nx); if (!cur) break;
  }
  return root;
}
// 방사형 배치: 잎 수에 비례해 각도를 나눈다 (펼친 갈래가 자리를 더 가져감)
function leaves(n) { return n.kids.length ? n.kids.reduce((s, c) => s + leaves(c), 0) : 1; }
function layout(root) {
  // 칸이 좁으면(휴대폰·좁은 창) 옆으로 퍼지는 대신 위아래로 퍼지게 한다 → 줄여 보여도 글자가 덜 작아짐
  const narrow = ($('#map').parentElement.clientWidth || 800) < 600;
  const R = [0, 150, 255, 345], CX = 550, CY = 320, SX = narrow ? 0.5 : 1.42, SY = narrow ? 1.5 : 0.86, out = [];
  (function walk(n, a0, a1) {
    const a = (a0 + a1) / 2, r = R[n.depth];
    n.x = CX + Math.cos(a) * r * SX; n.y = CY + Math.sin(a) * r * SY; out.push(n);
    const tot = leaves(n); let s = a0;
    n.kids.forEach(c => { const w = (a1 - a0) * leaves(c) / tot; walk(c, s, s + w); c.parent = n; s += w; });
  })(root, -Math.PI / 2, Math.PI * 1.5);
  return out;
}

// 가지가 어디서 왔는지 노드 안에 작은 글로 (색을 늘리지 않고 글로 구분). 범례도 지금 보이는 것만
const SRC_MARK = { signal: '반복', rising: '뜨는 중', inspire: '영감' };
const SRC_SAY = { signal: '반복 = 매거진·뉴스 여러 곳에 반복된 현상', rising: '뜨는 중 = 이번 주 뉴스·쇼츠에서 급상승', inspire: '영감 = 오늘의 영감에 나온 판매 기법' };
const markOf = k => SRC_MARK[T[k]?.trend?.type] || '';
function renderMap() {
  const svg = $('#map'); svg.innerHTML = '';
  const nodes = layout(tree()), onPath = new Set(path.slice(center));
  // 1) 노드 크기를 먼저 잰다 (글 길이 + 출처 표시)
  const probe = svgEl('text', { class: 'probe' }); svg.append(probe);
  const tw = txt => { probe.textContent = txt; return probe.getComputedTextLength(); };
  probe.setAttribute('font-size', '14'); probe.setAttribute('font-weight', '500');
  nodes.forEach(n => {
    n.mk = n.depth > 0 ? markOf(n.k) : '';
    probe.setAttribute('font-size', n.depth === 0 ? '16' : '14'); n.tw = tw(n.k);
    probe.setAttribute('font-size', '11'); n.mw = n.mk ? tw(n.mk) + 10 : 0;
    n.w = Math.max(64, n.tw + n.mw + (n.depth === 0 ? 60 : 48)); n.h = n.depth === 0 ? 44 : 36;
  });
  probe.remove();
  relax(nodes, onPath);
  const gE = svgEl('g', {}), gN = svgEl('g', {}); svg.append(gE, gN);
  nodes.forEach(n => {
    if (n.parent) {
      const on = onPath.has(n.k) && onPath.has(n.parent.k);
      const mx = (n.x + n.parent.x) / 2;
      gE.append(svgEl('path', { class: `edge${on ? ' on' : ''}`, d: `M${n.parent.x},${n.parent.y} Q${mx},${n.parent.y} ${n.x},${n.y}` }));
    }
    const kids = info(n.k).kids.length, isOpen = n.depth > 0 && kids > 0 && path.indexOf(n.k) > 0;   // path = 펼쳐 둔 갈래. 맨 끝 키워드도 가지가 보이므로 펼침
    const cls = ['node', n.depth === 0 ? 'root' : '', isOpen ? 'open' : '', picked.includes(n.k) ? 'picked' : '', focus === n.k ? 'focus' : '',
      n.depth > 0 && !visibleByCh(n.k) && !onPath.has(n.k) ? 'dim' : ''].filter(Boolean).join(' ');
    // 노드 = [고르기 동그라미] [키워드] [출처] [펼침 표시]. 누르면 펼치기·접기, 동그라미를 누르면 고르기·빼기
    const isPicked = picked.includes(n.k), canOpen = n.depth === 0 ? path.length > 1 : kids > 0;
    const g = svgEl('g', { class: cls, tabindex: 0, role: 'button', 'data-k': n.k, 'aria-expanded': canOpen ? String(n.depth === 0 ? path.length > 1 : isOpen) : null,
      'aria-label': `${n.k}${n.mk ? ` (${n.mk})` : ''}${isPicked ? ', 고름' : ''}${canOpen ? (isOpen || (n.depth === 0 && path.length > 1) ? ', 펼침 · 누르면 접어요' : `, 가지 ${kids}개 · 누르면 펼쳐요`) : ''}. Space로 고르기` });
    if (!canOpen) g.removeAttribute('aria-expanded');
    const w = n.w, h = n.h, x0 = n.x - w / 2;
    g.append(svgEl('rect', { x: x0, y: n.y - h / 2, width: w, height: h, rx: 8 }));
    const t = svgEl('text', { x: n.mk ? x0 + 34 + n.tw / 2 : n.x + 10, y: n.y }); t.textContent = n.k; g.append(t);
    if (n.mk) { const m = svgEl('text', { class: 'src', x: x0 + 34 + n.tw + 8, y: n.y }); m.textContent = n.mk; g.append(m); }
    gN.append(g);
    // 고르기 동그라미 (누르는 자리 28px)
    const ck = svgEl('g', { class: `ck${isPicked ? ' on' : ''}`, 'data-pickk': n.k });
    ck.append(svgEl('rect', { class: 'hit', x: x0 + 2, y: n.y - 14, width: 28, height: 28, rx: 6 }));
    ck.append(svgEl('circle', { cx: x0 + 16, cy: n.y, r: 8 }));
    if (isPicked) ck.append(svgEl('path', { d: `M${x0 + 12} ${n.y}l3 3 5-6` }));
    g.append(ck);
    // 펼침 표시: 접힘 = +가지 수, 펼침 = 접기 표시(가로선)
    if (n.depth > 0 && kids && !isOpen) { const m = svgEl('text', { class: 'more', x: n.x + w / 2 + 12, y: n.y }); m.textContent = `+${kids}`; g.append(m); }
    if ((n.depth > 0 && isOpen) || (n.depth === 0 && path.length > 1)) g.append(svgEl('path', { class: 'fold', d: `M${n.x + w / 2 + 8} ${n.y}h10` }));
  });
  fitMap(svg);
  const kinds = [...new Set(nodes.filter(n => n.depth > 0).map(n => T[n.k]?.trend?.type).filter(Boolean))];
  const lg = $('#mapLegend'); if (lg) { lg.hidden = !kinds.length; lg.textContent = kinds.map(k => SRC_SAY[k]).join(' · '); }
}
// 겹침 풀기: 가지를 펼치면 나머지 가지가 좁은 각도에 몰려 서로 겹쳤다 (2026-11-16). 겹친 두 노드를 위아래로 조금씩 밀어낸다.
// 가운데 키워드와 펼쳐 둔 길(path)은 그대로 두고 나머지만 움직인다 (+가지 수 표시 자리까지 포함해 잰다)
function relax(nodes, fixed) {
  const GX = 30, GY = 8;
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) >= (a.w + b.w) / 2 + GX || Math.abs(dy) >= (a.h + b.h) / 2 + GY) continue;
      const need = (a.h + b.h) / 2 + GY - Math.abs(dy), dir = dy === 0 ? (j % 2 ? 1 : -1) : Math.sign(dy);
      const fa = a.depth === 0 || fixed.has(a.k), fb = b.depth === 0 || fixed.has(b.k);
      if (fa && fb) continue;
      if (fa) b.y += dir * need; else if (fb) a.y -= dir * need; else { a.y -= dir * need / 2; b.y += dir * need / 2; }
      moved = true;
    }
    if (!moved) break;
  }
}
// 고정 크기(1100×640)를 통째로 줄이면 노트북 폭에서 글자가 6px까지 작아졌다 (2026-11-16) → 그린 내용의 테두리에 맞춰 보기 영역을 정한다.
// 칸 폭보다 좁은 내용은 1:1 그대로(키우지 않음), 넓으면 그만큼만 줄인다
function fitMap(svg) {
  const b = svg.getBBox(); if (!b.width) return;
  const pad = 24, cw = svg.parentElement.clientWidth || 800;
  const w = Math.max(b.width + pad * 2, cw), h = Math.max(b.height + pad * 2, 320);
  svg.setAttribute('viewBox', `${b.x + b.width / 2 - w / 2} ${b.y + b.height / 2 - h / 2} ${w} ${h}`);
}

function renderPath() {
  $('#path').innerHTML = '<span class="cap">지나온 길</span>' + path.map((k, i) =>
    `${i ? '<span class="sep" aria-hidden="true">›</span>' : ''}<button data-path="${i}" ${i === path.length - 1 ? 'aria-current="true"' : ''}>${esc(k)}</button>`).join('');
}
function renderFilters() {
  $('#chFilters').innerHTML = Object.entries(CH).map(([c, n]) => `<button class="chip" data-ch="${c}" aria-pressed="${chOn.has(c)}" title="${esc(CH_SRC[c])}">${n}</button>`).join(' ');
  $('#chClear').hidden = !chOn.size;
}
function renderSide() {
  const k = focus, d = info(k), el = $('#side');
  if (k === ROOT && center === 0) {
    const rec = live(k);
    el.innerHTML = `<div class="overline">중심 키워드 · 명분</div><h2>${esc(k)}</h2>${rootEditor()}
      <p class="sub">${info(k).kids.length ? '여기서 뻗어 나간 키워드 중 마음에 드는 걸 눌러 보세요. 명분을 그대로 써도 좋으면 중심 키워드를 골라도 돼요.' : rec.state === 'loading' ? '가지를 찾는 중이에요…' : '이 말과 함께 나온 말을 찾지 못했어요. 검색광고 키를 넣으면 연관 키워드로도 찾아요.'}</p>
      <h3>검색 <span class="tag ok-t">실제</span></h3>${liveSearch(rec)}
      <h3>글 <span class="tag ok-t">실제</span></h3>${livePosts(rec)}
      <h3>트렌드 <span class="tag ok-t">실제</span></h3>${trendRoot()}
      <div class="acts"><button class="btn" data-pick="${esc(k)}">${picked.includes(k) ? '고른 키워드에서 빼기' : '이 키워드 그대로 쓰기'}</button></div>`;
    return;
  }
  const canOpen = d.kids.length > 0, isOpen = canOpen && path.indexOf(k) > 0;
  const deep = path.indexOf(k) >= 0 ? path.indexOf(k) - center : parentOf(k) - center + 1;
  const rec = live(k);
  const ours = oursOf(k);
  el.innerHTML = `<div class="overline">키워드${ours ? '' : ' <span class="tag demo-t">우리 데이터는 예시</span>'}</div><h2>${esc(k)}</h2>
    <h3>어디서 왔나요</h3><div class="tags">${d.ch.map(c => `<span class="tag" title="${esc(CH_SRC[c])}">${CH[c]}</span>`).join('') || '<span class="cap">-</span>'}</div>
    ${d.trend ? trendSide(d.trend) : ''}
    <h3>검색 <span class="tag ok-t">실제</span></h3>${liveSearch(rec)}
    <h3>글 <span class="tag ok-t">실제</span></h3>${livePosts(rec)}
    <h3>영상</h3><p class="cap">유튜브는 아직 연결 전이에요</p>
    <h3>우리 데이터${ours ? ' <span class="tag ok-t">실제</span>' : ''}</h3>${(ours || d.ours).length ? `<ul>${(ours || d.ours).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p class="cap">${ours === null && OURS.state === 'loading' ? '불러오는 중…' : '연결된 내용이 없어요'}</p>`}
    <div class="acts">
      <button class="btn ${picked.includes(k) ? '' : 'primary'}" data-pick="${esc(k)}" aria-pressed="${picked.includes(k)}">${picked.includes(k) ? '고른 키워드에서 빼기' : '이 키워드 고르기'}</button>
      <p class="cap">${!canOpen ? '이 키워드에서 더 뻗은 말이 없어요.' : isOpen ? '펼쳐 둔 키워드예요. 마인드맵에서 한 번 더 누르면 접혀요.' : `마인드맵에서 이 키워드를 누르면 가지 ${d.kids.length}개가 펼쳐져요${deep >= MAX_DEPTH ? ' (화면이 넘치면 한 단계 위를 가운데로 옮겨요)' : ''}.`} 키워드는 여러 개 고를 수 있어요.</p>
    </div>`;
}
function renderDock() {
  $('#picked').innerHTML = (picked.length ? `<span class="cap">${picked.length}개 · 여러 개 고를 수 있어요</span>` + picked.map(k => `<span class="pk">${esc(k)}<button data-unpick="${esc(k)}" aria-label="${esc(k)} 빼기">✕</button></span>`).join('')
    : '<span class="cap">마인드맵에서 키워드 왼쪽 동그라미를 눌러 고르세요. 여러 개 고를 수 있어요.</span>');
  renderSugs();
  if (typeof renderMoods === 'function') renderMoods();   // 고른 키워드가 바뀌면 느낌 레퍼런스 순서도 다시
}
// 메인 카피 제안 (DEMO): 고른 키워드·명분으로 방법별 틀에 끼운 문장. 나중에 카피 사례·방법론 출처로 바꾼다 (plans/15 2장 '제안 출처')
const METHODS = [
  ['장면형', k => `${k}에 차 한 잔을 더하면`],
  ['재정의형', k => `봄은 ${k}의 계절`],
  ['감각 묘사형', k => `${k} 사이로 번지는 찻잎 향`],
  ['질문형', k => `이번 봄, ${k} 준비됐나요?`],
  ['대비형', k => `바쁜 봄에도 ${k}의 여유`],
  ['한정형', k => `봄에만 만나는 ${k} 티타임`],
];
let sugPage = 0;
function copyIdeas() {
  const ks = picked.length ? picked : [ROOT], out = [];
  for (let i = 0; i < METHODS.length * ks.length; i++) { const [m, f] = METHODS[i % METHODS.length], k = ks[Math.floor(i / METHODS.length) % ks.length]; out.push({ m, t: f(k), k }); }
  const c = $('#concept').value.trim();
  return c ? [{ m: '컨셉 그대로', t: c, k: '' }, ...out] : out;
}
function renderSugs() {
  const all = copyIdeas(), n = 3, start = (sugPage * n) % all.length, cur = $('#copy').value;
  const show = Array.from({ length: Math.min(n, all.length) }, (_, i) => all[(start + i) % all.length]);
  const who = $('#who').value.trim();
  $('#sugBasis').textContent = `근거: ${picked.length ? `고른 키워드(${picked.join(', ')})` : '명분(봄)'}${$('#concept').value.trim() ? ' · 컨셉' : ''}${who ? ' · 누구에게' : ''}`;
  $('#sugs').innerHTML = show.map(s => `<button class="sug" data-copy="${esc(s.t)}" aria-pressed="${cur === s.t}"><span class="c">${esc(s.t)}</span><span class="tag">${esc(s.m)}</span></button>`).join('');
  $('#footNote').textContent = cur.trim() ? '' : '메인 카피가 비어 있어도 넘어갈 수 있어요. 구좌 구성 화면에서도 쓸 수 있어요.';
}
addEventListener('resize', () => { clearTimeout(window.__mapT); window.__mapT = setTimeout(renderMap, 120); });   // 넓음·좁음이 바뀌면 배치부터 다시
let keepFocus = null;   // 다시 그린 뒤에도 키보드 위치를 잃지 않게
function render() { renderPath(); renderFilters(); renderMap(); renderSide(); renderDock();
  if (keepFocus) { document.querySelector(`.node[data-k="${CSS.escape(keepFocus)}"]`)?.focus(); keepFocus = null; } }

// ---------------- 동작 ----------------
function parentOf(k) {   // 보이는 나무에서 k의 부모 (path 위에서 찾음)
  for (let i = center; i < path.length; i++) if (info(path[i]).kids.includes(k)) return i;
  return -1;
}
function openK(k) {
  if (!info(k).kids.length) return;
  let i = path.indexOf(k);
  if (i < 0) { const p = parentOf(k); if (p < 0) return; path = path.slice(0, p + 1).concat(k); i = path.length - 1; }
  else path = path.slice(0, i + 1);
  if (i - center >= MAX_DEPTH) center = i - 1;   // 3단계를 넘으면 한 단계 위를 가운데로
  focus = k; render();
}
function pick(k) { picked = picked.includes(k) ? picked.filter(x => x !== k) : picked.concat(k); autoTitle(); render(); saveBrief(); }
let titleTouched = false;
function autoTitle() { if (titleTouched) return; const c = $('#concept').value.trim(); $('#title').value = c ? `${ROOT} · ${c}` : `${ROOT}${picked.length ? ` · ${picked.join(', ')}` : ''} 기획안`; }
// 펼치기·접기 (2026-11-10): 한 번 누르면 펼침(+근거 보기), 다시 누르면 그 갈래를 접음. 가운데(명분)를 누르면 처음 모양으로
function closeK(k) {
  const i = path.indexOf(k);
  if (i < 0) return;
  if (i === 0) { path = [ROOT]; center = 0; return; }
  path = path.slice(0, i);   // k와 그 아래 갈래를 접음 (k는 부모 밑에 그대로 보임)
  if (center > path.length - 1) center = Math.max(0, path.length - 2);
}
function toggleK(k) {
  const i = path.indexOf(k), open = i > 0 || (i === 0 && path.length > 1);
  focus = k;
  if (open) { closeK(k); render(); return; }
  if (info(k).kids.length) openK(k); else render();
}
$('#map').addEventListener('click', e => {
  const ck = e.target.closest('[data-pickk]'); if (ck) { pick(ck.dataset.pickk); return; }
  const g = e.target.closest('.node'); if (!g) return;
  toggleK(g.dataset.k);
});
$('#map').addEventListener('keydown', e => {
  const g = e.target.closest('.node'); if (!g) return;
  keepFocus = g.dataset.k;
  if (e.key === 'Enter') { e.preventDefault(); toggleK(g.dataset.k); }
  else if (e.key === ' ') { e.preventDefault(); pick(g.dataset.k); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); openK(g.dataset.k); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); closeK(g.dataset.k); render(); }
  else keepFocus = null;
});
document.addEventListener('click', e => {
  const t = e.target;
  const p = t.closest('[data-pick]'); if (p) { pick(p.dataset.pick); return; }
  const o = t.closest('[data-open-k]'); if (o) { openK(o.dataset.openK); return; }
  const u = t.closest('[data-unpick]'); if (u) { pick(u.dataset.unpick); return; }
  const pa = t.closest('[data-path]');
  if (pa) { const i = +pa.dataset.path; path = path.slice(0, i + 1); center = Math.min(center, Math.max(0, i - 1)); if (i === 0) center = 0; focus = path[i]; render(); return; }
  const c = t.closest('[data-ch]'); if (c) { chOn.has(c.dataset.ch) ? chOn.delete(c.dataset.ch) : chOn.add(c.dataset.ch); render(); return; }
  if (t.closest('[data-root-edit]')) { rootEdit = !rootEdit; focus = ROOT; path = [ROOT]; center = 0; render(); if (rootEdit) $('#rootIn')?.focus(); return; }
  const rs = t.closest('[data-root-set]'); if (rs) { renameRoot(rs.dataset.rootSet); return; }
  if (t.closest('[data-root-go]')) { renameRoot($('#rootIn')?.value || ''); return; }
  const ed = t.closest('[data-edit]'); if (ed && ed.dataset.edit === '명분') { rootEdit = true; focus = ROOT; path = [ROOT]; center = 0; render(); $('#rootIn')?.focus(); return; }
  if (ed) { toast(`${ed.dataset.edit}은(는) 기획안을 시작할 때 정한 값이에요. 여기서 바로 고치는 기능은 준비 중이에요`); return; }
});
$('#chClear').addEventListener('click', () => { chOn.clear(); render(); });
// AI는 필요한 자리에 버튼으로만 (찻잎이 대화창 없음). 보내는 것: 고른 키워드·컨셉·명분뿐
// AI 제안은 멘트추천기능/brief-plugin.js에서 기존 로컬 서버로 연결한다.
$('#connBtn').addEventListener('click', () => { location.href = '/v2/settings#conn'; });
// ================= 실제 데이터 (새 버전) =================
// 근거 패널의 '검색'·'글'은 네이버(NAVER API HUB)에서 받아요. 키워드를 눌러 근거를 볼 때만 부르고(지나가기만 해선 안 부름),
// 같은 키워드는 이 화면에서 한 번만, 서버도 6시간 캐시. 가지(마인드맵)는 아직 예시 — 검색광고 키를 넣으면 연관 키워드로 바꿀 자리
const LIVE = new Map();   // 키워드 → { state: 'loading' | 'ok' | 'error', data, msg }
function live(k) {
  if (LIVE.has(k)) return LIVE.get(k);
  const rec = { state: 'loading' };
  LIVE.set(k, rec);
  v2api('/api/keywords/expand', { q: k })
    .then(d => { rec.state = 'ok'; rec.data = d; rec.grew = applyBranches(k, d); })
    .catch(e => { rec.state = 'error'; rec.msg = e.message; })
    .finally(() => { if (rec.grew) render(); else if (focus === k) renderSide(); });
  return rec;
}
// 가지: 검색광고 연관 키워드(키가 있으면 먼저) + 이 말이 나온 뉴스·블로그에서 여러 글에 함께 나온 말. 이미 펼쳐 둔 갈래는 바꾸지 않음
function applyBranches(k, d) {
  const t = T[k] || (T[k] = { ch: ['text'], flow: '', posts: [], ours: [], kids: [] });
  if (t.realKids || (path.includes(k) && path.indexOf(k) < path.length - 1)) return false;
  const ad = d.sources.searchad?.status === 'ok' ? d.sources.searchad.items.map(x => x.keyword) : [];
  const seen = new Set([k, ...path]), kids = [];
  for (const w of [...ad.slice(0, 5), ...(d.words || [])]) {
    const x = String(w).trim().slice(0, 20);
    if (!x || seen.has(x)) continue;
    seen.add(x); kids.push(x);
    if (kids.length >= 8) break;
  }
  if (!kids.length) return false;
  for (const w of kids) if (!T[w]) T[w] = { ch: [ad.includes(w) ? 'search' : 'text'], flow: '', posts: [], ours: [], kids: [] };
  t.kids = kids; t.realKids = true;
  if (k === ROOT) addTrendKids(false);
  return true;
}
const trendWords = t => t.change_4w == null ? '' : t.change_4w >= 0.2 ? '요즘 오르는 중' : t.change_4w <= -0.2 ? '요즘 줄어드는 중' : '꾸준해요';
function liveSearch(rec) {
  if (rec.state === 'loading') return '<p class="cap">네이버에서 불러오는 중…</p>';
  if (rec.state === 'error') return `<p class="cap">불러오지 못했어요: ${esc(rec.msg)}</p>`;
  const s = rec.data.sources.datalab;
  if (s.status !== 'ok') return `<p class="cap">${s.status === 'no_key' ? '검색어 트렌드가 연결되지 않았어요 (⚙ 설정·데이터)' : esc(s.message || '불러오지 못했어요')}</p>`;
  const t = s.items.find(x => x.keyword === rec.data.seed) || s.items[0];
  if (!t || !t.weekly.length) return '<p class="cap">검색 흐름 데이터가 없어요</p>';
  const say = [trendWords(t), t.peak_month ? `${t.peak_month}월에 가장 많이 찾아요` : ''].filter(Boolean).join(' · ');
  const last4 = t.weekly.slice(-4).map(([, v]) => Math.round(v)).join(' → ');
  const base = s.items.length > 1 ? '함께 받은 연관 키워드 중 가장 많이 찾은 주 = 100' : '1년 중 가장 많이 찾은 주 = 100';
  return `<p>${say || '흐름을 말하기엔 검색이 적어요'}</p>
    <p class="cap">최근 4주 지수 ${last4} (${base}) · 4주 변화 ${t.change_4w == null ? '-' : `${t.change_4w > 0 ? '+' : ''}${Math.round(t.change_4w * 100)}%`} · 네이버 검색어 트렌드</p>`;
}
function livePosts(rec) {
  if (rec.state === 'loading') return '<p class="cap">불러오는 중…</p>';
  if (rec.state === 'error') return '';
  const s = rec.data.sources.naver_search;
  if (s.status !== 'ok') return `<p class="cap">${s.status === 'no_key' ? '네이버 검색이 연결되지 않았어요 (⚙ 설정·데이터)' : esc(s.message || '불러오지 못했어요')}</p>`;
  const pick = kind => s.items.filter(x => x.kind === kind).slice(0, 3);
  const rows = [...pick('뉴스'), ...pick('블로그')];
  if (!rows.length) return '<p class="cap">관련 글이 없어요</p>';
  // 링크는 서버에서 http·https만 남긴 것. 새 탭으로, 이 화면 주소는 넘기지 않음
  const li = x => `<li>${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>` : esc(x.title)}<span class="cap">${esc(x.kind)}${x.date ? ` · ${esc(x.date)}` : ''}</span></li>`;
  return `<ul>${rows.map(li).join('')}</ul><p class="cap">네이버 검색 · 관련 높은 순${rec.data.cached ? ' · 6시간 안에 받아 둔 것' : ''}</p>`;
}
// ================= 트렌드 키워드 (amoread/trend) =================
// 두 가지를 중심 키워드의 가지로 붙이고, 누르면 근거 패널에 근거를 보여 준다 (화면 모양은 그대로, 분류 '트렌드'만 늘어남)
//  1) 공개 출처 탐색: 명분으로 매거진·뉴스를 검색해 여러 매체에 반복된 소비 현상 (기획 기간이 있으면 그 기간 기준). 15~25초, 서버 15분 캐시
//  2) 지금 뜨는 것: 매주 한 번 뉴스·쇼츠·MZ 뉴스레터에서 급상승한 이름을 찾아 둔 것 (명분과 상관없이 전체에서. 명분과 겹치는 것을 앞에)
// 수치는 검색 결과 안의 서로 다른 기사 수 — 검색량·SNS 반응·판매량이 아님 (패널에도 그렇게 적음)
//  3) 오늘의 영감: 보관함에 저장한 카드(먼저)와 오늘의 카드에 나온 판매 기법 (룰렛·출석·콜라보…) — 다른 몰이 실제로 쓴 방식
const TREND = { disc: null, rise: null, insp: null };   // disc: {state, data, msg} · rise: {state, data} · insp: {state, cards}
const TREND_MAX = { signal: 3, rising: 3, inspire: 2 };
function trendBranches() {   // 중심 키워드 아래 붙일 트렌드 가지 [{k, trend}]
  const out = [], seen = new Set([ROOT]);
  const add = (k, tr) => { const x = String(k || '').trim().slice(0, 20); if (!x || seen.has(x)) return; seen.add(x); out.push({ k: x, trend: tr }); };
  const sig = TREND.disc?.state === 'ok' ? TREND.disc.data.signals.filter(x => x.branch) : [];
  sig.slice(0, TREND_MAX.signal).forEach(x => add(x.label, { type: 'signal', ...x }));
  if (TREND.rise?.state === 'ok') {
    const d = TREND.rise.data, live = [...d.category.items, ...d.general.items].filter(x => x.live);
    const near = x => [x.term, x.what, ...(x.evidence || []).map(e => e.title)].join(' ').includes(ROOT);
    live.sort((a, b) => near(b) - near(a));
    live.slice(0, TREND_MAX.rising).forEach(x => add(x.term, { type: 'rising', date: (x.kind === 'category' ? d.category : d.general).date, ...x }));
  }
  if (TREND.insp?.state === 'ok') {   // 판매 기법 이름별로 묶는다. 저장한 카드·명분이 들어간 카드가 있는 기법이 앞
    const by = new Map();
    for (const c of TREND.insp.cards) {
      const m = c.kind === 'mech' ? (c.hits || [])[0]?.name : ''; if (!m) continue;
      const g = by.get(m) || { name: m, cards: [], score: 0 }; by.set(m, g);
      if (g.cards.some(x => x.id === c.id)) continue;
      g.cards.push(c); g.score += (c.saved ? 2 : 0) + ([c.title, c.campaign, c.text].join(' ').includes(ROOT) ? 3 : 0) + 1;
    }
    [...by.values()].sort((a, b) => b.score - a.score).slice(0, TREND_MAX.inspire)
      .forEach(g => add(g.name, { type: 'inspire', name: g.name, desc: g.cards[0].desc || '', cards: g.cards.slice(0, 3) }));
  }
  return out;
}
// 중심 키워드의 가지에 트렌드 가지를 더한다 (이미 있는 말은 그 가지에 '트렌드' 표시만). 펼쳐 둔 갈래는 건드리지 않음
function addTrendKids(redraw = true) {
  const t = T[ROOT] || (T[ROOT] = { ch: [], kids: [] }), words = trendBranches();
  if (!words.length) return;
  const mine = new Set(words.map(w => w.k));
  const other = t.kids.filter(k => !mine.has(k) && !T[k]?.trend);   // 이전에 붙였던 트렌드 가지는 새 결과로 바꾼다
  for (const w of words) {
    const d = T[w.k] || (T[w.k] = { ch: [], flow: '', posts: [], ours: [], kids: [] });
    d.trend = w.trend; if (!d.ch.includes('trend')) d.ch.push('trend');
  }
  t.kids = [...other.slice(0, 14 - words.length), ...words.map(w => w.k)];   // 가지가 많아도 트렌드 가지 자리는 남긴다
  if (redraw) render();
}
function loadTrend(doc) {
  const p = doc?.brief?.period || {};
  const q = ROOT;
  TREND.disc = { state: 'loading' };
  v2api('/api/am/trend/discover', { q, start: p.start || '', end: p.end || '' })
    .then(d => { if (q !== ROOT) return; TREND.disc = { state: 'ok', data: d }; addTrendKids(); })
    .catch(e => { if (q !== ROOT) return; TREND.disc = { state: 'error', msg: e.message }; if (focus === ROOT) renderSide(); });
  if (TREND.rise?.state === 'ok') { addTrendKids(); return; }   // 지금 뜨는 것·영감은 중심 키워드와 상관없이 한 번만 받는다
  Promise.allSettled([v2api('/api/am/ai/inspire/saved'), v2api('/api/am/ai/inspire/deck')]).then(([sv, dk]) => {
    const cards = [...(sv.value?.items || []).map(c => ({ ...c, saved: true })), ...(dk.value?.cards || [])];
    TREND.insp = { state: 'ok', cards };
    addTrendKids();
  });
  TREND.rise = { state: 'loading' };
  v2api('/api/am/trend/rising')
    .then(d => { TREND.rise = { state: 'ok', data: d }; addTrendKids(); })
    .catch(e => { TREND.rise = { state: 'error', msg: e.message }; if (focus === ROOT) renderSide(); });
}
const evList = ev => (ev || []).length ? `<ul>${ev.map(x => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>` : esc(x.title)}<span class="cap">${esc([x.publisher, x.day].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : '';
const COUNT_NOTE = '<p class="cap">검색 결과 안의 서로 다른 기사 수예요. 검색량·SNS 반응·판매량이 아니에요.</p>';
// 중심 키워드 이름 고치기: 캘린더 명분이 '연말정산 시즌'처럼 검색에 안 맞는 말을 달고 오면, 검색할 이름만 바꾼다
// 기획안에는 v2.root_kw로 저장 (명분 자체는 그대로). 바꾸면 가지·근거·트렌드를 새 이름으로 다시 찾는다
let rootEdit = false;
const SEASON_TAIL = /\s*(시즌|기간|주간|위크|데이즈|행사|기획전|이벤트)$/;
function rootEditor() {
  const tip = SEASON_TAIL.test(ROOT) ? ROOT.replace(SEASON_TAIL, '').trim() : '';
  if (!rootEdit) return `<div class="sugbar"><button class="btn sm" data-root-edit>검색할 이름 고치기</button>${tip ? `<button class="btn sm" data-root-set="${esc(tip)}">'${esc(tip)}'(으)로 찾기</button>` : ''}</div>`;
  return `<div class="sugbar"><input type="text" id="rootIn" maxlength="20" value="${esc(ROOT)}" aria-label="검색할 중심 키워드"><button class="btn sm primary" data-root-go>이 이름으로 찾기</button><button class="btn sm" data-root-edit>닫기</button></div>
    <p class="cap">검색에 쓰는 이름만 바뀌어요. 캘린더의 명분은 그대로예요.</p>`;
}
function renameRoot(v) {
  const name = String(v || '').trim().slice(0, 20);
  rootEdit = false;
  if (!name || name === ROOT) { render(); return; }
  setRoot(name);
  TREND.disc = null;
  PLAN.save(d => { d.v2.root_kw = name; });
  loadTrend(PLAN.doc);
  render();
  toast(`'${name}'(으)로 다시 찾을게요`);
}
// 중심 키워드 패널: 트렌드 가지를 어떻게 찾았는지 한눈에
function trendRoot() {
  const ds = TREND.disc, rs = TREND.rise;
  const a = !ds || ds.state === 'loading' ? '매거진·뉴스에서 찾는 중이에요 (20초쯤)…'
    : ds.state === 'error' ? `공개 출처를 검색하지 못했어요: ${esc(ds.msg)}`
    : (() => { const sig = ds.data.signals, br = sig.filter(x => x.branch); const p = ds.data.period;
        return br.length ? `매거진·뉴스에 반복된 현상 ${br.length}개 중 ${Math.min(br.length, TREND_MAX.signal)}개를 가지로 붙였어요${p?.state === 'future' ? ' (기획 기간이 아직 오지 않아 최근 30일 기준)' : p ? ' (기획 기간 기준)' : ''}.`
          : sig.length ? `여러 매체에 반복된 현상은 없었어요 (참고 신호 ${sig.length}개).` : esc(ds.data.reason || '반복된 현상을 찾지 못했어요.'); })();
  const b = !rs || rs.state === 'loading' ? '지금 뜨는 것을 불러오는 중…'
    : rs.state === 'error' ? `지금 뜨는 것을 불러오지 못했어요: ${esc(rs.msg)}`
    : (() => { const d = rs.data, n = [...d.general.items, ...d.category.items].filter(x => x.live).length, at = d.general.date || d.category.date;
        return at ? `지금 뜨는 것 ${n}개 중 ${Math.min(n, TREND_MAX.rising)}개를 가지로 붙였어요 (${esc(at)} 기준, 매주 새로 찾아요).` : '지금 뜨는 것은 아직 찾은 적이 없어요. 매일 아침 자동 확인이 일주일에 한 번 찾아요.'; })();
  const ins = TREND.insp?.state === 'ok' ? trendBranches().filter(w => w.trend.type === 'inspire').length : 0;
  const c = ins ? ` 오늘의 영감(보관함·오늘의 카드)에 나온 판매 기법 ${ins}개도 붙였어요.` : '';
  return `<p>${a}</p><p class="cap">${b}${c}</p>`;
}
// 트렌드 가지 패널: 무엇이 얼마나 반복됐는지, 근거 기사, (지금 뜨는 것이면) 오설록 아이디어
function trendSide(tr) {
  if (tr.type === 'inspire') {
    return `<h3>오늘의 영감 <span class="tag ok-t">실제</span></h3>
      <p>${esc(tr.desc || '다른 몰이 실제로 쓴 판매 방식이에요.')}</p>
      <ul>${tr.cards.map(c => { const nm = String(c.campaign || c.title || '').slice(0, 40) + (String(c.campaign || c.title || '').length > 40 ? '…' : ''); return `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(nm)}</a>` : esc(nm)}<span class="cap">${esc([c.brand, c.saved ? '보관함에 저장한 카드' : '오늘의 카드'].filter(Boolean).join(' · '))}</span>${c.note?.do ? `<span class="cap">오설록이라면: ${esc(c.note.do)}</span>` : ''}</li>`; }).join('')}</ul>
      <p class="cap"><a href="/v2/inspire">오늘의 영감에서 보기</a></p>`;
  }
  if (tr.type === 'signal') {
    const ch = tr.change && tr.change.before != null ? ` · 전년 같은 기간 ${tr.change.before}건` : '';
    return `<h3>트렌드 <span class="tag ok-t">실제</span></h3>
      <p>${esc(tr.level)} · 서로 다른 기사 ${tr.stories}건 · 매체 ${tr.publishers}곳${ch}</p>
      <p class="cap">명분 '${esc(ROOT)}'로 매거진·뉴스를 검색했을 때 ${tr.semantic ? '뜻이 가까운 제목끼리' : '제목에 이 말이 반복된'} 묶음이에요.</p>
      ${evList(tr.evidence)}${COUNT_NOTE}`;
  }
  const c = tr.counts || {}, i = tr.idea;
  return `<h3>지금 뜨는 것 <span class="tag ok-t">실제</span></h3>
    <p>${esc(tr.stage)}${tr.what ? ` · ${esc(tr.what)}` : ''}</p>
    <p class="cap">최근 14일 ${c.recent ?? '-'}건 · 15~45일 전 ${c.mid ?? '-'}건 · 46일~1년 전 ${c.old ?? '-'}건${tr.change ? ` · 지난주 대비 ${esc(tr.change)}` : ''} · ${esc(tr.date || '')} 기준</p>
    ${evList(tr.evidence)}${COUNT_NOTE}
    ${i ? `<h3>오설록이라면 <span class="tag">AI 제안</span></h3>
      <p><b>${esc(i.title)}</b>${i.placement ? ` · ${esc(i.placement)}` : ''}</p>
      ${i.link ? `<p class="cap">${esc(i.link)}</p>` : ''}<p>${esc(i.what)}</p>
      <p class="cap">${i.phrase ? `문구 예: ${esc(i.phrase)}` : ''}${i.products.length ? ` · 상품: ${esc(i.products.join(', '))}` : ''}${i.needs_check ? ` · 확인 필요: ${esc(i.needs_check)}` : ''}</p>` : ''}`;
}
// 연결 상태 한 줄: 화면을 열 때 한 번 (키 값은 오지 않고 있음/없음만)
v2api('/api/connections').then(c => {
  const on = v => v ? '연결됨' : '키 없음';
  $('#connTxt').textContent = `연결: 네이버 ${on(c.keys.naver)} · 검색광고 ${on(c.keys.searchad)} · 유튜브 연결 전 · 구글 트렌드 신청 전`;
}).catch(() => { $('#connTxt').textContent = '연결 상태를 불러오지 못했어요'; });

$('#resetBtn').addEventListener('click', () => { path = [ROOT]; center = 0; focus = ROOT; render(); });
$('#title').addEventListener('input', () => { titleTouched = true; });
$('#concept').addEventListener('input', () => { autoTitle(); renderSugs(); });
$('#who').addEventListener('input', renderSugs);
$('#copy').addEventListener('input', renderSugs);
$('#sugs').addEventListener('click', e => { const s = e.target.closest('[data-copy]'); if (!s) return; $('#copy').value = s.dataset.copy; renderSugs(); $('#copy').focus(); });
$('#moreSug').addEventListener('click', () => { sugPage++; renderSugs(); });

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
  $('#moodBasis').textContent = `명분 '${ROOT}'${picked.length ? ` · 고른 키워드(${picked.join(', ')})` : ''}에 맞는 것을 앞에 두었어요${libState === 'err' ? ' · 라이브러리를 불러오지 못해 예시만 보여요' : ''}`;
  const tag = $('#moodSrcTag'); if (tag) { tag.textContent = lib.length ? `라이브러리 ${lib.length} · 예시 ${demo.length}` : '예시'; tag.className = `tag ${lib.length ? 'real' : 'demo-t'}`; }
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
document.addEventListener('keydown', e => { if (e.target.id === 'rootIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); renameRoot(e.target.value); } else if (e.target.id === 'rootIn' && e.key === 'Escape') { rootEdit = false; render(); } });
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
const CLSN = { season: '시즌', brand: '브랜드기획전', launch: '런칭', collab: '콜라보', clear: '클리어런스' };
const mdw = d => { const t = new Date(`${d}T00:00:00`); return `${t.getMonth() + 1}/${t.getDate()}(${'일월화수목금토'[t.getDay()]})`; };
function setRoot(r) {
  ROOT = r; if (!T[ROOT]) T[ROOT] = { ch: [], kids: [] };
  $('#rootName').textContent = ROOT; path = [ROOT]; center = 0; focus = ROOT;
}
function saveBrief() {
  PLAN.save(d => {
    d.title = $('#title').value.trim().slice(0, 80) || d.title;
    d.brief = { ...d.brief, concept: $('#concept').value.trim().slice(0, 300), audience: $('#who').value.trim().slice(0, 300), key_copy: $('#copy').value.trim().slice(0, 120) };
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
    const dm = document.querySelector('.demo'); if (dm) dm.innerHTML = dm.innerHTML.replace('우리 데이터, 메인 카피 제안은 아직 예시예요.', '우리 데이터는 실제(명분 사전·지난 컨셉·상품)예요. 메인 카피 제안은 고른 키워드를 넣은 카피 틀, 느낌 레퍼런스는 라이브러리에서 모은 것과 예시예요.');
    Object.assign(OURS, { state: 'ok', seasons: sea?.items || [], concepts: con?.items || [], prods: (pr?.products || []).filter(x => x.active) });
    renderSide();
  });
}
function oursOf(k) {
  if (OURS.state !== 'ok') return OURS.state === 'loading' ? [] : null;
  const kk = String(k).replace(/\s/g, ''), has = t => String(t || '').replace(/\s/g, '').includes(kk), out = [];
  const sea = OURS.seasons.filter(m => has(m.name) || has(m.keyword) || (m.seeds || []).some(has));
  if (sea.length) out.push(`명분 사전에 있어요: ${sea.slice(0, 3).map(m => `${m.name} (${m.kind})`).join(', ')}`);
  const con = OURS.concepts.filter(c => c.id !== PLAN.id && (has(c.title) || has(c.myeongbun) || has(c.concept)));
  out.push(con.length ? `지난 컨셉에 썼어요: ${con.slice(0, 2).map(c => `${c.title} (${String(c.date || '').slice(0, 7)})`).join(', ')}${con.length > 2 ? ` 외 ${con.length - 2}개` : ''}` : '지난 컨셉·기획안에 쓴 적 없어요');
  const pr = OURS.prods.filter(x => has(x.name)).sort((a, b) => (b.sales_28 || 0) - (a.sales_28 || 0));
  if (pr.length) out.push(`이름이 겹치는 판매 중 상품 ${pr.length}개: ${pr.slice(0, 3).map(x => x.name).join(', ')}${pr.length > 3 ? ' …' : ''}`);
  if (EFFICACY.some(w => String(k).includes(w))) out.push('효능처럼 읽힐 수 있어 문구 검토가 필요해요');
  return out;
}
PLAN.ready.then(doc => {
  queueMicrotask(() => loadTrend(doc));   // 명분(setRoot)이 정해진 뒤에 찾는다
  if (doc) { loadOurs(); const md0 = document.getElementById('mapDemo'); if (md0) md0.hidden = true; }   // 기획안을 열면 가지·근거는 실제 → '예시 데이터' 태그 숨김
  if (!doc) return;
  const b = doc.brief || {};
  setRoot((doc.v2.root_kw || b.myeongbun || doc.v2.seed || ROOT).slice(0, 20));
  picked = (doc.v2.keywords || []).slice();
  $('#title').value = doc.title || ''; titleTouched = !!doc.title;
  $('#concept').value = b.concept || ''; $('#who').value = b.audience || ''; $('#copy').value = b.key_copy || '';
  const fact = (k, html) => { const el = document.querySelector(`[data-edit="${k}"]`); if (el) el.innerHTML = html; };
  fact('분류', esc(CLSN[doc.v2.cls] || '분류 미정'));
  fact('기간', `<span class="k">기간</span>${b.period ? `${mdw(b.period.start)} ~ ${mdw(b.period.end)}` : '날짜 미정'}`);
  fact('페이지', `<span class="k">페이지</span>${esc(b.page_kind || '이벤트')}`);
  render();
});
document.addEventListener('input', e => { if (['title', 'concept', 'who', 'copy'].includes(e.target.id)) saveBrief(); });
document.addEventListener('click', e => { if (e.target.closest('#sugs [data-copy]')) setTimeout(saveBrief); });   // 제안 문장을 메인 카피로 (키워드 고르기는 pick()에서 저장)
