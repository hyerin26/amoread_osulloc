// ---------------- 예시 데이터 (가상) ----------------
// 종류로 묶음 (plans/22 §5: 회사 이름이 아니라 무엇을 알려 주나로)
const CH = { search: '검색', text: '글', video: '영상', ours: '우리 데이터' };
// 채널 설명: 연결 후보 (plans/20 3장). 지금은 모두 예시
const CH_SRC = { search: '네이버 검색광고·데이터랩, 구글 트렌드', text: '네이버 뉴스·블로그·카페, 붙여 넣은 트렌드 기사', video: '유튜브', ours: '명분 사전 씨앗, 지난 컨셉, 리뷰 언급' };
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
  const R = [0, 150, 255, 345], CX = 550, CY = 320, SX = 1.42, SY = 0.86, out = [];
  (function walk(n, a0, a1) {
    const a = (a0 + a1) / 2, r = R[n.depth];
    n.x = CX + Math.cos(a) * r * SX; n.y = CY + Math.sin(a) * r * SY; out.push(n);
    const tot = leaves(n); let s = a0;
    n.kids.forEach(c => { const w = (a1 - a0) * leaves(c) / tot; walk(c, s, s + w); c.parent = n; s += w; });
  })(root, -Math.PI / 2, Math.PI * 1.5);
  return out;
}

function renderMap() {
  const svg = $('#map'); svg.innerHTML = '';
  const nodes = layout(tree()), onPath = new Set(path.slice(center));
  const gE = svgEl('g', {}), gN = svgEl('g', {}); svg.append(gE, gN);
  nodes.forEach(n => {
    if (n.parent) {
      const on = onPath.has(n.k) && onPath.has(n.parent.k);
      const mx = (n.x + n.parent.x) / 2, my = (n.y + n.parent.y) / 2;
      gE.append(svgEl('path', { class: `edge${on ? ' on' : ''}`, d: `M${n.parent.x},${n.parent.y} Q${mx},${n.parent.y} ${n.x},${n.y}` }));
    }
    const kids = info(n.k).kids.length, isOpen = onPath.has(n.k) && n.depth > 0 && path.indexOf(n.k) < path.length - 1;
    const cls = ['node', n.depth === 0 ? 'root' : '', isOpen ? 'open' : '', picked.includes(n.k) ? 'picked' : '', focus === n.k ? 'focus' : '',
      n.depth > 0 && !visibleByCh(n.k) && !onPath.has(n.k) ? 'dim' : ''].filter(Boolean).join(' ');
    const g = svgEl('g', { class: cls, tabindex: 0, role: 'button', 'data-k': n.k,
      'aria-label': `${n.k}${picked.includes(n.k) ? ', 고름' : ''}${kids && n.depth > 0 && !isOpen ? `, 가지 ${kids}개 더 있음` : ''}` });
    const t = svgEl('text', { x: n.x, y: n.y }); t.textContent = n.k; g.append(t); gN.append(g);
    const w = Math.max(48, t.getComputedTextLength() + (n.depth === 0 ? 40 : 28)), h = n.depth === 0 ? 44 : 34;
    g.insertBefore(svgEl('rect', { x: n.x - w / 2, y: n.y - h / 2, width: w, height: h, rx: 8 }), t);
    if (n.depth > 0 && kids && !isOpen) { const m = svgEl('text', { class: 'more', x: n.x + w / 2 + 10, y: n.y }); m.textContent = `+${kids}`; g.append(m); }
  });
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
    el.innerHTML = `<div class="overline">중심 키워드 · 명분</div><h2>${esc(k)}</h2>
      <p class="sub">${info(k).kids.length ? '여기서 뻗어 나간 키워드 중 마음에 드는 걸 눌러 보세요. 명분을 그대로 써도 좋으면 중심 키워드를 골라도 돼요.' : rec.state === 'loading' ? '가지를 찾는 중이에요…' : '이 말과 함께 나온 말을 찾지 못했어요. 검색광고 키를 넣으면 연관 키워드로도 찾아요.'}</p>
      <h3>검색 <span class="tag ok-t">실제</span></h3>${liveSearch(rec)}
      <h3>글 <span class="tag ok-t">실제</span></h3>${livePosts(rec)}
      <div class="acts"><button class="btn" data-pick="${esc(k)}">${picked.includes(k) ? '고른 키워드에서 빼기' : '이 키워드 그대로 쓰기'}</button></div>`;
    return;
  }
  const canOpen = d.kids.length > 0, isOpen = path.includes(k) && path.indexOf(k) < path.length - 1;
  const deep = path.indexOf(k) >= 0 ? path.indexOf(k) - center : parentOf(k) - center + 1;
  const rec = live(k);
  el.innerHTML = `<div class="overline">키워드 <span class="tag demo-t">우리 데이터는 예시</span></div><h2>${esc(k)}</h2>
    <h3>어디서 왔나요</h3><div class="tags">${d.ch.map(c => `<span class="tag" title="${esc(CH_SRC[c])}">${CH[c]}</span>`).join('') || '<span class="cap">-</span>'}</div>
    <h3>검색 <span class="tag ok-t">실제</span></h3>${liveSearch(rec)}
    <h3>글 <span class="tag ok-t">실제</span></h3>${livePosts(rec)}
    <h3>영상</h3><p class="cap">유튜브는 아직 연결 전이에요</p>
    <h3>우리 데이터</h3>${d.ours.length ? `<ul>${d.ours.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="cap">연결된 내용이 없어요</p>'}
    <div class="acts">
      <button class="btn primary" data-pick="${esc(k)}">${picked.includes(k) ? '고른 키워드에서 빼기' : '이 키워드 고르기'}</button>
      <button class="btn" data-open-k="${esc(k)}" ${canOpen && !isOpen ? '' : 'disabled'}>${!canOpen ? '더 펼칠 키워드가 없어요' : isOpen ? '펼쳐 둔 갈래예요' : deep >= MAX_DEPTH ? '가운데로 옮겨서 펼치기' : `더 펼치기 (${d.kids.length})`}</button>
    </div>`;
}
function renderDock() {
  $('#picked').innerHTML = '<span class="l">고른 키워드</span>' + (picked.length ? picked.map(k => `<span class="pk">${esc(k)}<button data-unpick="${esc(k)}" aria-label="${esc(k)} 빼기">✕</button></span>`).join('')
    : '<span class="cap">마인드맵에서 키워드를 골라 주세요. 여러 개 골라도 돼요.</span>');
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
let clickT = null;
$('#map').addEventListener('click', e => {
  const g = e.target.closest('.node'); if (!g) return;
  const k = g.dataset.k;
  if (clickT && clickT.k === k) { clearTimeout(clickT.t); clickT = null; openK(k); return; }   // 두 번 누르면 펼치기
  focus = k; render();
  clickT = { k, t: setTimeout(() => { clickT = null; }, 320) };
});
$('#map').addEventListener('keydown', e => {
  const g = e.target.closest('.node'); if (!g) return;
  keepFocus = g.dataset.k;
  if (e.key === 'Enter') { e.preventDefault(); focus = g.dataset.k; render(); }
  else if (e.key === ' ') { e.preventDefault(); pick(g.dataset.k); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); openK(g.dataset.k); }
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
  const ed = t.closest('[data-edit]'); if (ed) { toast(`예시예요: ${ed.dataset.edit}을 여기서 바로 고칠 수 있어요`); return; }
});
$('#chClear').addEventListener('click', () => { chOn.clear(); render(); });
// AI는 필요한 자리에 버튼으로만 (찻잎이 대화창 없음). 보내는 것: 고른 키워드·컨셉·명분뿐
$('#aiSug').addEventListener('click', () => toast('예시예요: 고른 키워드·컨셉으로 AI가 메인 카피 3개를 더 제안해요. 매출·원가·고객 정보는 보내지 않아요'));
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

// ---------------- 느낌 레퍼런스 (예시) ----------------
// 수집 예정: 핀터레스트 공개 보드 등(엔지니어 검증) + 담당자가 붙여 넣기. tags로 브리프(명분·고른 키워드)에 맞는 것을 먼저
const MOODS = [
  { id: 'm1', name: '돗자리 위 티타임', src: '핀터레스트 보드 · 봄 피크닉', tags: ['봄', '피크닉', '돗자리'], r: [2, 3] },
  { id: 'm2', name: '연둣빛 봄 색감', src: '외부 캠페인 일부', tags: ['봄', '벚꽃'], r: [4, 5] },
  { id: 'm3', name: '보온병 들고 산책', src: '핀터레스트 보드 · 아웃도어', tags: ['보온병', '산책', '피크닉'], r: [9, 16] },
  { id: 'm4', name: '벚꽃 아래 찻잔', src: '자사몰 지난 행사 일부', tags: ['벚꽃', '봄'], r: [3, 4] },
  { id: 'm5', name: '손글씨 봄 타이포', src: '핀터레스트 보드 · 시즌 타이포', tags: ['봄'], r: [1, 1] },
  { id: 'm6', name: '한강 노을 피크닉', src: '외부 캠페인 일부', tags: ['한강', '피크닉'], r: [3, 4] },
];
const POINTS = ['색감', '구도', '소품', '글씨', '카피 톤'];
const moodSel = new Map();   // 고른 느낌 레퍼런스 → 참고할 점
function moodImg(w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 40}" height="${h * 40}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#eef5ef"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#p)"/><rect x="0.5" y="0.5" width="${w * 40 - 1}" height="${h * 40 - 1}" fill="none" stroke="#dedede"/></svg>`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="">`;
}
function renderMoods() {
  const keys = [ROOT, ...picked], score = m => m.tags.filter(t => keys.includes(t)).length;
  const own = MOODS.filter(m => m.own), list = own.concat([...MOODS].filter(m => !m.own).sort((a, b) => score(b) - score(a)).slice(0, 5));   // 직접 붙인 것은 늘 앞에
  $('#moodBasis').textContent = `명분 '${ROOT}'${picked.length ? ` · 고른 키워드(${picked.join(', ')})` : ''}로 먼저 거른 이미지예요`;
  $('#moods').innerHTML = list.map(m => `<button class="mood" data-mood="${m.id}" aria-pressed="${moodSel.has(m.id)}" title="${esc(m.src)}"><span class="fr">${m.img ? `<img src="${m.img}" alt="">` : m.kind ? `<span class="cap">${m.kind}</span>` : moodImg(m.r[0], m.r[1])}</span><span class="mn">${esc(m.name)}</span><span class="cap">${esc(m.src)}</span></button>`).join('');
  $('#moodPicked').innerHTML = [...moodSel].map(([id, pts]) => { const m = MOODS.find(x => x.id === id); return `<div class="mpick"><b>${esc(m.name)}</b><span class="cap">참고할 점</span>
    ${POINTS.map(p => `<button class="pt" data-pt="${id}|${p}" aria-pressed="${pts.has(p)}">${p}</button>`).join('')}</div>`; }).join('');
}
$('#moods').addEventListener('click', e => { const b = e.target.closest('[data-mood]'); if (!b) return; const id = b.dataset.mood; moodSel.has(id) ? moodSel.delete(id) : moodSel.set(id, new Set()); renderMoods(); $(`[data-mood="${id}"]`)?.focus(); });
$('#moodPicked').addEventListener('click', e => { const b = e.target.closest('[data-pt]'); if (!b) return; const [id, p] = b.dataset.pt.split('|'), s = moodSel.get(id); s.has(p) ? s.delete(p) : s.add(p); renderMoods(); $(`[data-pt="${id}|${p}"]`)?.focus(); });
// 직접 붙이기: 이미지는 이 PC에서 미리보기만, PDF·링크는 종류 표시. 붙이면 바로 고른 상태
let ownN = 0;
function addOwn(m) { const id = `own${++ownN}`; MOODS.push({ id, own: true, tags: [], r: [3, 4], ...m }); moodSel.set(id, new Set()); renderMoods(); toast('느낌 레퍼런스로 붙였어요. 참고할 점을 골라 주세요'); }
$('#moodFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const isImg = f.type.startsWith('image/');
  if (!isImg && f.type !== 'application/pdf') { toast('이미지나 PDF 파일만 붙일 수 있어요'); return; }
  addOwn({ name: f.name.length > 16 ? f.name.slice(0, 16) + '…' : f.name, src: '직접 첨부 · 파일', kind: isImg ? '' : 'PDF', img: isImg ? URL.createObjectURL(f) : '' }); e.target.value = ''; });
$('#moodLinkBtn').addEventListener('click', e => { const row = $('#moodLinkRow'); row.hidden = !row.hidden; e.currentTarget.setAttribute('aria-expanded', !row.hidden); if (!row.hidden) $('#moodUrl').focus(); });
$('#moodUrlAdd').addEventListener('click', () => { const raw = $('#moodUrl').value.trim(); let u; try { u = new URL(raw); } catch { u = null; }
  if (!u || !/^https?:$/.test(u.protocol)) { toast('http나 https로 시작하는 주소를 넣어 주세요'); return; }
  addOwn({ name: u.hostname.replace(/^www\./, ''), src: '직접 첨부 · 링크', kind: '링크', url: raw }); $('#moodUrl').value = ''; $('#moodLinkRow').hidden = true; });
$('#moodLib').addEventListener('click', () => toast('예시예요: 레퍼런스 라이브러리의 느낌 레퍼런스 탭을 열어요'));
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
  });
}
PLAN.ready.then(doc => {
  if (!doc) return;
  const b = doc.brief || {};
  setRoot((b.myeongbun || doc.v2.seed || ROOT).slice(0, 20));
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
