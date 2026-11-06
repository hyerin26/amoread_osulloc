// 공통: API 호출, 숫자 표기, 작은 DOM 도우미, 앱 상태
const TOKEN = document.querySelector('meta[name="planner-token"]').content;

export const state = {
  meta: null, target: 0.45, products: [], bySeq: new Map(), patterns: null, claude: { available: false },
};

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const opt = { method, headers: { 'X-Planner-Token': TOKEN } };
  if (body instanceof FormData) opt.body = body;
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(path, opt);
  if (raw && res.ok) return res;
  let data = null;
  try { data = await res.json(); } catch { /* 빈 응답 */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `요청 실패 (${res.status})`);
    err.code = data && data.code; err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- 표기 ----------
export const won = v => (v === null || v === undefined || Number.isNaN(v)) ? '-' : Math.round(v).toLocaleString('ko-KR');
export const man = v => (v === null || v === undefined) ? '-' : (Math.round(v / 1000) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
export const pct = (v, d = 0) => (v === null || v === undefined || Number.isNaN(v)) ? '-' : `${(v * 100).toFixed(d)}%`;
export const qty = v => (v === null || v === undefined) ? '-' : Math.round(v).toLocaleString('ko-KR');
export function delta(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '<span class="mute">-</span>';
  const p = Math.round(v * 100);
  if (p === 0) return '<span class="mute">0%</span>';
  return p > 0 ? `<span class="up">▲${p}%</span>` : `<span class="dn">▼${-p}%</span>`;
}
export const mmdd = s => s ? `${s.slice(5, 7)}/${s.slice(8, 10)}` : '';
export function esc(s) {
  return String(s ?? '').replace(/[&<>"'{}()#]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    '{': '&#123;', '}': '&#125;', '(': '&#40;', ')': '&#41;', '#': '&#35;' }[c]));
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// CSP(style-src 'self') 때문에 HTML에 style 속성을 못 쓴다 → data-w(0~1)를 CSSOM으로 너비 적용
export function applyBars(root = document) {
  $$('[data-w]', root).forEach(el => { el.style.width = `${Math.max(0, Math.min(1, +el.dataset.w)) * 100}%`; });
}

export function bar(v, lowBelow = 0.2) {
  if (v === null || v === undefined) return '';
  return `<span class="bar ${v < lowBelow ? 'low' : ''}"><i data-w="${Math.max(0, v) / 0.6}"></i></span>`;
}

export function spark(series, w = 96, h = 24) {
  if (!series || !series.length) return '';
  const s = series.slice(-90), max = Math.max(1, ...s);
  const pts = s.map((v, i) => `${(i / (s.length - 1 || 1) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="최근 90일 일별 수량"><polyline points="${pts}"/></svg>`;
}

let toastTimer;
export function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

export function statusBadge(level) {
  return { ok: '<span class="status ok">✓ 통과</span>', warn: '<span class="status warn">! 주의</span>',
    error: '<span class="status error">✕ 오류</span>' }[level] || '';
}

export function prodTags(p) {
  const t = [];
  if (p.status && p.status.startsWith('보자기')) t.push('<span class="tag wrap" title="본품 원가 + 보자기 원가로 추정">보자기</span>');
  if (p.old_cost) t.push('<span class="tag old" title="상품장에 없어 예전 기준(손익예측 시트) 원가 사용">구 원가</span>');
  if (p.cost === null || p.cost === undefined) t.push('<span class="tag miss" title="상품장에 원가가 없음">원가 없음</span>');
  return t.join(' ');
}

export function promoBadges(p) {
  const out = [];
  (p.running || []).forEach(r => out.push(`<span class="tag run" title="${esc(r.promo)} ${esc(r.type)} ~${mmdd(r.end)}">진행 ${esc(r.type)} ${pct(r.rate)}</span>`));
  (p.upcoming || []).slice(0, 2).forEach(u => out.push(`<span class="tag plan" title="${esc(u.promo)} ${esc(u.type)} ${mmdd(u.start)}~${mmdd(u.end)}">예정 ${mmdd(u.start)} ${pct(u.rate)}</span>`));
  if ((p.upcoming || []).length > 2) out.push(`<span class="cap">+${p.upcoming.length - 2}</span>`);
  return out.join(' ');
}

// 화면 사이 이벤트 (예: 상품 → 기획안에 담기)
export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, e => fn(e.detail));

// 화면을 떠나기 전 확인 (예: 상품·할인의 저장하지 않은 변경). 가드 하나라도 false를 주면 이동하지 않는다
const leaveGuards = [];
export function addLeaveGuard(fn) { leaveGuards.push(fn); }
export async function canLeave(ctx = {}) {
  for (const g of leaveGuards) { if (!(await g(ctx))) return false; }
  return true;
}

export function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function maxDiscount(price, cost, target = state.target) {
  if (!price || cost === null || cost === undefined) return null;
  return 1 - cost * 1.1 / target / price;
}
export function costRatioAfter(price, cost, rate) {
  const sp = price * (1 - rate);
  return sp > 0 ? cost / (sp / 1.1) : null;
}

// 상품 고르기 드롭다운 (조합 계산기·짝 찾기·기획안 SEQ 입력에서 같이 씀)
export function attachPicker(input, dd, onPick, { filter = () => true } = {}) {
  let hi = -1, items = [];
  const close = () => { dd.classList.add('hidden'); hi = -1; };
  const render = () => {
    const q = input.value.replace(/\s/g, '').toLowerCase();
    if (!q) { close(); return; }
    items = state.products.filter(p => filter(p) && (String(p.seq) === q || String(p.name).replace(/\s/g, '').toLowerCase().includes(q)))
      .sort((a, b) => (b.sales_28 || 0) - (a.sales_28 || 0)).slice(0, 30);
    dd.innerHTML = items.length ? items.map((p, i) => `<div data-i="${i}" class="${i === hi ? 'hi' : ''}"><span>${esc(p.name)} <span class="cap">${p.seq}</span></span><span class="cap num">${won(p.price)}원 · 원가율 ${pct(p.cost_ratio)}</span></div>`).join('')
      : '<div class="mute">찾는 상품이 없습니다</div>';
    dd.classList.remove('hidden');
  };
  input.addEventListener('input', () => { hi = -1; render(); });
  input.addEventListener('keydown', e => {
    if (dd.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { hi = Math.min(items.length - 1, hi + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[Math.max(0, hi)]) { onPick(items[Math.max(0, hi)]); input.value = ''; close(); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  dd.addEventListener('mousedown', e => {
    const d = e.target.closest('[data-i]'); if (!d) return;
    onPick(items[+d.dataset.i]); input.value = ''; close(); e.preventDefault();
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}

// ---------- 팝오버 · 모달 · 시트 (브라우저 확인창 대신 사용) ----------
let popAnchor = null;
export function openPop(anchor, html, onMount) {
  const pop = $('#pop');
  pop.innerHTML = html; pop.classList.remove('hidden'); popAnchor = anchor;
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth;
  let left = r.left + window.scrollX + r.width / 2 - w / 2;
  left = Math.max(12, Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 12));
  let top = r.bottom + window.scrollY + 6;
  if (r.bottom + pop.offsetHeight + 12 > window.innerHeight) top = r.top + window.scrollY - pop.offsetHeight - 6;
  pop.style.left = `${left}px`; pop.style.top = `${top}px`;
  if (onMount) onMount(pop);
}
export function closePop() { $('#pop').classList.add('hidden'); popAnchor = null; }
document.addEventListener('mousedown', e => {
  if (popAnchor && !e.target.closest('#pop') && e.target !== popAnchor && !popAnchor.contains(e.target)) closePop();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePop(); closeModal(); closeSheet(); } });

export function openModal(html, onMount) {
  $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden');
  if (onMount) onMount($('#modalBody'));
}
export function closeModal() { $('#modal').classList.add('hidden'); }
document.addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close-modal]')) closeModal(); });

export function openSheet(html, onMount) {
  $('#sheet').innerHTML = html; $('#sheet').classList.remove('hidden'); $('#scrim').classList.remove('hidden');
  $('#sheet').scrollTop = 0;
  if (onMount) onMount($('#sheet'));
}
export function closeSheet() { $('#sheet').classList.add('hidden'); $('#scrim').classList.add('hidden'); emit('sheet:closed'); }
document.addEventListener('click', e => { if (e.target.id === 'scrim' || e.target.closest('[data-close-sheet]')) closeSheet(); });

// ---------- 아이콘 (이모지 대신 직접 그린 선 아이콘 한 벌, viewBox 24) ----------
const ICONS = {
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6M12 8v4.5l3 1.8"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  board: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M9 9v11"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 13 11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  trend: '<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>',
  // 아래는 디자이너 v2.5.1 ICON_PATHS와 같은 경로 (기획안 화면용)
  undo: '<path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12" transform="translate(0 -2)"/>',
  redo: '<path d="m15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12" transform="translate(0 -2)"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  grip: '<path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" stroke-width="3"/>',
  'panel-open': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16m-5-11-3 3 3 3"/>',
  'panel-close': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16m-7-11 3 3-3 3"/>',
  swap: '<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-left': '<path d="M20 12H4m6-6-6 6 6 6"/>',
  'arrow-up': '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  'arrow-down': '<path d="M12 4v16m-6-6 6 6 6-6"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ---------- 시그니처: 행사 리본 — 날짜 칸마다 상시 막대(녹) + 하루특가 점(귤) ----------
// rows: [{type, start, end}] · opts.from/to로 범위 고정, mini는 날짜 글자 없이 작게
export function ribbon(rows, { from, to, mini = false, maxDays = 42 } = {}) {
  const ds = rows.flatMap(r => [r.start, r.end || r.start]).filter(Boolean).sort();
  if (!ds.length && !from) return '';
  const d0 = new Date(from || ds[0]), d1 = new Date(to || ds[ds.length - 1]);
  const days = [];
  for (let d = new Date(d0); d <= d1 && days.length < maxDays; d.setDate(d.getDate() + 1)) days.push(d.toISOString().slice(0, 10));
  const deals = {}, sangsi = {};
  rows.forEach(r => {
    if (!r.start) return;
    if (r.type === '하루특가') deals[r.start] = (deals[r.start] || 0) + 1;
    else days.forEach(k => { if (k >= r.start && k <= (r.end || r.start)) sangsi[k] = (sangsi[k] || 0) + 1; });
  });
  const cells = days.map(k => {
    const wd = new Date(k).getDay(), n = deals[k] || 0, s = sangsi[k] || 0;
    const tip = `${mmdd(k)}(${'일월화수목금토'[wd]}) · 상시 ${s}개 · 하루특가 ${n}개`;
    return `<div class="d ${wd === 0 || wd === 6 ? 'we' : ''} ${wd === 1 ? 'mon' : ''}" title="${tip}">
      <div class="dots ${n >= 5 ? 'crowd' : ''}">${'<i></i>'.repeat(Math.min(n, 12))}</div>
      <div class="sb ${s ? 'on' : ''}"></div>
      <div class="dl">${wd === 1 || k === days[0] ? mmdd(k) : k.slice(8, 10)}</div></div>`;
  }).join('');
  return `<div class="ribbon ${mini ? 'mini' : ''}" role="img" aria-label="${mmdd(days[0])}~${mmdd(days[days.length - 1])} 행사 리듬">${cells}</div>`;
}
export const ribbonKey = () => '<span class="rkey"><span><i class="s"></i>상시</span><span><i class="d"></i>하루특가 1개</span></span>';

export const daysAgo = d => (d === null || d === undefined) ? '-' : (d <= 0 ? '진행 중' : `${Math.round(d)}일 전`);
