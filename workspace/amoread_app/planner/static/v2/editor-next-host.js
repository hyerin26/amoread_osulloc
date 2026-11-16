// 신규 구좌편집기(v1.12)를 앱 안에서 여는 연결부. v1.12 스크립트보다 먼저 읽힌다 (editor-next.html 순서).
// (CSP style-src 'self' 대응은 v1.12 쪽 data-am-style 처리 — editor-ui-kit.js 끝)

// 1) 외부 저장 모드: v1.12가 브라우저 저장소(localStorage) 대신 이 화면이 주는 기획안 값을 쓰고, 새 구좌에 가상 상품·후기를 넣지 않는다.
window.AMOREAD_EDITOR_OPTIONS = { persistence: 'external' };

// 2) 기획안·상품·후기 연결. v1.12 스크립트가 모두 실행된 뒤(DOMContentLoaded) 시작한다.
//    - 기획안: v2/plan.js의 PLAN (주소 ?id=, /api/am/projects). 편집기 값 전체는 doc.editor_next, 같은 내용을 표준 형식 page.sections에도 쓴다
//      (2026-11-15부터 이 편집기가 03 구좌 편집의 유일한 편집기. 04 미리보기·내보내기·AI 추천이 page.sections를 읽음. 아래 enToLegacy)
//    - 상품: /api/products + /api/product/{seq} (v2/products.js PRODUCTS_API·extraPrice). 이 기획안의 상품만 (할인 행·후보 상품·기존 구좌 상품 칸)
//    - 가격: 정가 → 1단(기획안 할인 행 할인율, 10원 단위) → 2단(추가 혜택, api.js extraPrice). 기존 편집기·미리보기·상품·할인과 같은 식
//    - 후기: /api/product/{seq}의 상품별 요약(건수·평균·발췌 2개). 개별 별점·제목은 없어서 비워 둔다
const EN_SCHEMA = 'amoread-editor-next';
const EN_DRAFT = id => `amoread.editor-next.draft.${id}`;

// 도구 줄 왼쪽의 상태 한 줄. text = 짧은 요지(항상 보임), detail = [자세히]로 펼치는 설명.
// 오류는 접지 않고 전부 보인다 (무엇이 잘못됐고 어떻게 하면 되는지가 바로 읽혀야 함)
function enNotice(text, { error = false, action = null, detail = '' } = {}) {
  const el = document.getElementById('enNotice');
  if (!el) return;
  el.textContent = '';
  el.classList.toggle('is-error', error);
  el.classList.remove('is-open');
  const lead = document.createElement('span');
  lead.className = 'en-lead'; lead.textContent = text; lead.title = text;   // 좁아서 말줄임될 때 전체 문장
  el.append(lead);
  if (detail) {
    const more = document.createElement('span');
    more.className = 'en-more'; more.id = 'enNoticeMore'; more.textContent = detail;
    const t = document.createElement('button');
    t.type = 'button'; t.className = 'en-toggle'; t.textContent = '자세히';
    t.setAttribute('aria-expanded', 'false'); t.setAttribute('aria-controls', 'enNoticeMore');
    t.addEventListener('click', () => {
      const open = el.classList.toggle('is-open');
      t.setAttribute('aria-expanded', String(open)); t.textContent = open ? '접기' : '자세히';
    });
    el.append(' ', more, t);
  }
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'am-ed-button am-ed-button--sm'; b.textContent = action.label;
    b.addEventListener('click', action.run);
    el.append(' ', b);
  }
}
const enNow = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
// 임시 저장본: 서버 저장이 실패했을 때만 이 브라우저에 남긴다 (편의 기능. 저장소가 막혀 있으면 조용히 건너뜀)
const enDraft = {
  read(id) { try { const d = JSON.parse(localStorage.getItem(EN_DRAFT(id)) || 'null'); return d && d.snapshot ? d : null; } catch { return null; } },
  write(id, snapshot) { try { localStorage.setItem(EN_DRAFT(id), JSON.stringify({ at: enNow(), snapshot })); return true; } catch { return false; } },
  clear(id) { try { localStorage.removeItem(EN_DRAFT(id)); } catch { /* 저장소 없음 */ } },
};

// 기획안의 상품 → v1.12 카탈로그 형식 {id,name,listPrice,firstPrice,salePrice,priceLabel,...}
// ── 03에서 정하는 할인 (2026-11-16): 상품·할인과 같은 할인 행(doc.promo_rows)에 쓴다 → 할인율이 두 곳에 따로 생기지 않는다.
// 하루특가·묶음 행은 건드리지 않는다. rate > 0 이면 '상시' 행, 0이면 '할인 없음'(큐레이션) 행. 기간은 기획안 기간
function enRowsWithRate(d, seq, rate) {
  const rows = Array.isArray(d.promo_rows) ? d.promo_rows.map(r => ({ ...r })) : [];
  const per = (d.brief && d.brief.period) || {};
  const k = rows.findIndex(r => r && r.type !== '하루특가' && String(r.seq || '') === seq && !(r.items && r.items.length));
  const type = rate > 0 ? '상시' : '큐레이션';
  if (k >= 0) rows[k] = { ...rows[k], type, rate };
  else rows.push({ promo: String(d.title || '').slice(0, 60), type, start: per.start || null, end: per.end || null, seq, items: null, rate, appeal: '', category_tag: '', clearance: false, memo: '' });
  return rows.slice(0, 500);
}
const enRateOf = (d, seq) => { const r = (d.promo_rows || []).find(x => x && x.type !== '하루특가' && String(x.seq || '') === seq && !(x.items && x.items.length)); return r ? Number(r.rate) || 0 : null; };
async function enDiscountInfo(d, seqs) {   // 판정·기준 안 최대·지난 행사 (원가는 서버에만 있음)
  const items = [...new Set(seqs)].filter(q => /^\d{1,12}$/.test(q)).slice(0, 100).map(seq => ({ seq, rate: Math.min(0.9, enRateOf(d, seq) || 0) }));
  if (!items.length) return {};
  const res = await v2api('/api/am/discount/check', { items });
  return Object.fromEntries((res.items || []).map(x => [x.seq, { ...x, inRows: enRateOf(d, x.seq) !== null }]));
}
async function enCatalog(doc, onlySeqs) {   // onlySeqs: 그 상품만 만든다 (03에서 전체 상품을 찾아 넣을 때)
  const all = await PRODUCTS_API.all();
  const P = Object.fromEntries(all.map(p => [String(p.seq), p]));
  // 할인 행: 기존 편집기와 같은 기준 (하루특가·조합 행 제외)
  const rows = (doc.promo_rows || []).filter(r => r.type !== '하루특가' && r.seq && P[r.seq] && !(r.items && r.items.length));
  const rowOf = seq => rows.find(r => String(r.seq) === seq);
  const extras = (doc.v2 && doc.v2.extras) || [];
  const seqs = [...new Set(onlySeqs || [
    ...rows.map(r => String(r.seq)),
    ...(doc.pool || []).map(x => String(x.seq || '')),
    ...((doc.page && doc.page.sections) || []).flatMap(s => (s.slots || []).map(sl => String(sl.seq || ''))),
  ])].filter(seq => P[seq] && Number(P[seq].price) > 0);
  const details = await Promise.all(seqs.map(seq => PRODUCTS_API.detail(seq)));   // 실패한 상품은 null (후기 없음으로)
  const r10 = n => Math.round(n / 10) * 10;
  const products = seqs.map((seq, i) => {
    const p = P[seq], list = Number(p.price), row = rowOf(seq), rate = Number(row && row.rate) || 0;
    const first = r10(list * (1 - rate)), ex = extras.find(x => (x.seqs || []).includes(seq)) || null, fin = extraPrice(first, list, ex);
    const rv = details[i] && details[i].reviews;
    return {
      id: seq, name: String(p.name || seq), listPrice: list, rate, extraRate: fin < first ? 1 - fin / first : 0,
      firstPrice: first, salePrice: fin, priceLabel: ex ? `${ex.name}가` : rate ? '할인가' : '판매가',
      priceNote: rate || ex ? '이 기획안 할인 기준 판매가' : '정가(할인 행 없음)',
      rating: rv && rv.avg ? Number(rv.avg) : 0, reviews: rv ? Number(rv.n) || 0 : 0,
      quote: rv && rv.quotes && rv.quotes[0] ? String(rv.quotes[0]) : '', appeal: row && row.appeal ? String(row.appeal) : '',
    };
  });
  const reviews = seqs.flatMap((seq, i) => ((details[i] && details[i].reviews && details[i].reviews.quotes) || [])
    .map((q, k) => ({ id: `${seq}-q${k + 1}`, productId: seq, title: '', text: String(q), rating: null, source: 'app', sourceLabel: '앱 후기 요약 발췌' })));
  return { products, reviews, failed: details.filter(d => d === null).length };
}

// ── 표준 형식(page.sections)과 잇기 (2026-11-15, plans/27 §12) ─────────────────────────────
// 이 편집기가 03 구좌 편집의 유일한 편집기다. 저장할 때마다 편집기 값(editor_next.snapshot)을 앱 표준 형식 page.sections로도 써서
// 04 미리보기·내보내기·AI 카피 추천(서버가 page.sections에서 구좌를 찾음)이 같은 내용을 본다.
// 편집기가 모르는 값(탭, 가격 표시, 레이아웃 출처, 디자이너 레퍼런스, 묶음 상품 등)은 이전 page.sections에서 그대로 이어 받는다.
const EN_PRODUCT_LAYOUTS = ['grid2', 'grid3', 'feat', 'deal-banner'];
window.EN_AI_META = window.EN_AI_META || {};   // 구좌별 AI 카피 적용 기록 → v2.copyRecommendation (editor-next-ai.js가 채움)
const enCut = (v, n) => String(v ?? '').slice(0, n);
const enSlotId = () => `slot-${Math.random().toString(36).slice(2, 10)}`;
function enToLegacy(snapshot, prevSections, knownSeqs) {
  const prev = new Map((Array.isArray(prevSections) ? prevSections : []).filter(x => x && x.sectionId).map(x => [x.sectionId, x]));
  return (snapshot.sections || []).slice(0, 40).map((s, i) => {
    const p = prev.get(s.id) || {}, pv = p.v2 && typeof p.v2 === 'object' ? p.v2 : {};
    const pSlots = Array.isArray(p.slots) ? p.slots : [], firstTab = (p.tabs && p.tabs[0] && p.tabs[0].tabId) || null;
    const bySeq = new Map(pSlots.filter(x => x && x.seq).map(x => [String(x.seq), x]));
    // 편집기가 모르는 칸(카탈로그에 없는 SEQ, 묶음 상품)은 지우지 않고 남긴다
    const foreign = pSlots.filter(x => x && ((x.items && x.items.length) || (x.seq && !knownSeqs.has(String(x.seq)))));
    let slots = pSlots;
    const ft = EN_FTAB_LAYOUTS.includes(s.layout) ? enFtabs(s) : null;
    if (ft) {
      // 탭 구좌 (plans/28): 칸은 '탭|SEQ'로 찾는다 → 같은 상품이 여러 탭에 있어도 칸이 사라지지 않음. 없는 탭의 칸은 첫 탭으로
      const tabIds = new Set(ft.map(t => t.id)), first = ft.length ? ft[0].id : null;
      const tabOf = x => (first ? (tabIds.has(x.tabId) ? x.tabId : first) : null);
      const at = (x, id) => { const c = { ...x }; if (id) c.tabId = id; else delete c.tabId; return c; };
      const byKey = new Map();
      pSlots.filter(x => x && x.seq).forEach(x => { const k = `${tabOf(x)}|${x.seq}`; if (!byKey.has(k)) byKey.set(k, x); });
      const ids = (s.productIds || []).map(String).filter(seq => /^\d{1,12}$/.test(seq));
      const groups = ft.length ? ft : [{ id: null, productIds: ids }];   // 탭을 없앴으면 모든 상품을 한 구좌로
      const used = new Set(), filled = new Set();
      const picked = groups.flatMap(t => t.productIds.filter(seq => /^\d{1,12}$/.test(seq)).map(seq => {
        filled.add(t.id);
        const o = byKey.get(`${t.id}|${seq}`);
        if (o) { used.add(o); return at(o, t.id); }
        return at({ slotId: enSlotId(), seq, items: null, placeholderStatus: 'AVAILABLE', customCopy: '' }, t.id);
      }));
      // 탭 구좌는 빈 칸을 저장하지 않는다 (plans/30 §3-2, 화면에만 탭마다 그림). 탭으로 나누기 전에 저장된 빈 칸도 여기서 정리.
      // 문구를 적어 둔 빈 칸(customCopy)만 그 탭에 남긴다
      const empty = pSlots.filter(x => x && !x.seq && !(x.items && x.items.length) && String(x.customCopy || '').trim() && !filled.has(tabOf(x)));
      slots = [...picked, ...foreign.filter(x => !used.has(x)).map(x => at(x, tabOf(x))), ...empty.map(x => at(x, tabOf(x)))].slice(0, 40);
    } else if (EN_PRODUCT_LAYOUTS.includes(s.layout)) {
      const ids = (s.productIds || []).map(String).filter(seq => /^\d{1,12}$/.test(seq));
      const picked = ids.map(seq => bySeq.get(seq) || { slotId: enSlotId(), tabId: firstTab, seq, items: null, placeholderStatus: 'AVAILABLE', customCopy: '' });
      // 남은 칸 = 편집기 미리보기의 빈 카드 자리와 같은 수 (app.js productSlotTotal과 같은 셈) → 04 미리보기도 '4칸'으로 같게
      let empty = [];
      if (s.layout !== 'deal-banner') {
        const cols = Number(s.layoutColumns && s.layoutColumns[s.layout]) || { grid2: 2, grid3: 3, feat: 2 }[s.layout] || 2;
        const total = Math.max(Number(s.slotCount) || (s.layout === 'feat' ? Math.max(2, cols) : cols * 2), ids.length);
        const prevEmpty = pSlots.filter(x => x && !x.seq && !(x.items && x.items.length));   // 아직 안 고른 자리는 원래 칸(id)을 다시 쓴다
        empty = Array.from({ length: Math.max(0, total - ids.length) }, (_, k) => prevEmpty[k] || { slotId: enSlotId(), tabId: firstTab, seq: null, items: null, placeholderStatus: 'UNDECIDED', customCopy: '' });
      } else if (!ids.length) empty = pSlots.filter(x => x && !x.seq && !(x.items && x.items.length));
      slots = [...picked, ...foreign.filter(x => !picked.includes(x)), ...empty].slice(0, 40);
    }
    const lines = (s.lines || []).slice(0, 10).map((l, k) => ({ id: (pv.lines && pv.lines[k] && pv.lines[k].id) || `l${k + 1}`, text: enCut(l && l.text, 120) }));
    const ai = window.EN_AI_META[s.id] || pv.copyRecommendation;
    // 붙인 레퍼런스 → v2.att (예전 편집기와 같은 형식: 04 미리보기·인계가 이 값을 읽는다)
    const att = (s.refs || []).filter(r => r && r.id && r.attached !== false).slice(0, 8).map(r => ({
      ref: enCut(r.id, 80), note: enCut(r.note, 120), name: enCut(r.name, 60), page: enCut(r.from, 60), from: '',
      url: /^https?:\/\//i.test(r.url || '') ? enCut(r.url, 300) : '' }));
    return {
      ...p, sectionId: s.id, order: i, name: enCut(s.name, 40), headline: enCut(s.name, 120), subhead: enCut(s.role, 400),
      cta: enCut(s.cta, 40), layoutId: s.layout, zone_tag: enCut(s.cat, 40), designNotes: enCut(s.notes, 2000), slots,
      ...(ft ? { zone_kind: p.zone_kind || (ft.length ? '탭' : ''), tabs: ft.map(t => ({ ...((p.tabs || []).find(x => x && x.tabId === t.id) || {}), tabId: t.id, label: enCut(t.label, 40), zone_tag: enCut(t.zone, 40) })) } : {}),
      v2: { ...pv, scope: enCut(s.scope, 200), num: !!s.num, ctaOn: !!s.ctaOn, ctaTo: enCut(s.ctaTo, 60), lines, att,
        ...(s.card ? { card: { order: s.card.order, on: s.card.on, def: s.card.def } } : {}), ...(ai ? { copyRecommendation: ai } : {}) },
    };
  });
}
// ── 레퍼런스 고를 목록 (2026-11-16): ① AI 추천 모듈이 수집본에서 찾은 '이 구좌와 비슷한 사례' ② 레퍼런스 라이브러리(직접 모은 것·핀터레스트)
// 둘 중 하나가 실패해도 나머지는 보여 준다. 둘 다 실패하면 편집기가 '불러오지 못했어요 · 링크로 붙이기'를 보여 준다
let enLibWait = null;
function enLibRefs() {
  if (!enLibWait) enLibWait = v2api('/api/am/references').then(d => {
    const fav = new Set(d.favorites || []);
    return (d.items || []).map(x => ({ id: String(x.id), name: x.name || '레퍼런스', from: x.source === 'Pinterest' ? 'Pinterest' : '라이브러리 · 직접 추가',
      url: x.link || '', why: fav.has(x.id) ? '★ 즐겨찾기' : '', group: '레퍼런스 라이브러리', fav: fav.has(x.id) }))
      .sort((a, b) => b.fav - a.fav);
  });
  enLibWait.catch(() => { enLibWait = null; });   // 실패하면 다음에 다시 시도
  return enLibWait;
}
async function enRefSource(doc, s) {
  const d = PLAN.doc || doc;
  const [rec, lib, box] = await Promise.allSettled([
    v2api('/api/am/ai/references', { section: { layoutId: s.layout, name: String(s.name || '').slice(0, 40), purpose: String(s.role || '').slice(0, 20) }, n: 8,
      doc: { id: d.id || '', title: d.title || '', brief: d.brief || {}, v2: { cls: (d.v2 && d.v2.cls) || '', seed: (d.v2 && d.v2.seed) || '', keywords: (d.v2 && d.v2.keywords) || [] } } }),
    enLibRefs(),
    v2api('/api/am/ai/inspire/saved')]);   // ③ 오늘의 영감 보관함에 저장한 구좌 (통합 브랜치 editor-next-refs.js에서 옮김, 2026-11-16)
  if (rec.status === 'rejected' && lib.status === 'rejected' && box.status === 'rejected') throw rec.reason;
  const out = [], seen = new Set();
  const lib1 = id => `/v2/library#open=${encodeURIComponent(id)}`;   // 레퍼런스 화면에서 그 구좌를 바로 연다
  if (rec.status === 'fulfilled' && rec.value && rec.value.mode === 'ai')
    for (const it of rec.value.items || []) { seen.add(String(it.id)); out.push({ id: String(it.id), name: it.title || '레퍼런스', from: [it.from, it.campaign].filter(Boolean).join(' · '), url: it.url || '', why: it.why || it.reason || '', group: '이 구좌와 비슷한 사례', live: true, lib: lib1(it.id) }); }
  if (box.status === 'fulfilled')
    for (const x of ((box.value && box.value.items) || []).filter(v => v && v.ref && !seen.has(String(v.ref))).slice(0, 12))
      out.push({ id: String(x.ref), name: x.psec || x.title || '레퍼런스', from: [x.brand, x.campaign].filter(Boolean).join(' · '), url: x.url || '', why: x.memo ? `메모 · ${x.memo}` : (x.kind_name || ''), group: '오늘의 영감 보관함', live: true, lib: lib1(x.ref) });
  if (lib.status === 'fulfilled') out.push(...lib.value);
  return out;
}
// 담당자가 사례를 붙이거나 뺐을 때 AI 모듈에 기록 → 다음 추천 순서에 반영 (화면 변화 없음, id만 보냄)
const enRefPicked = doc => (r, added, s) => {
  if (!r || !r.live) return;
  v2api('/api/am/ai/feedback', { event: added ? 'pick_ref' : 'drop_ref', doc_id: doc.id || '', ref_id: String(r.id).slice(0, 80), section: String(s.layout || '').slice(0, 40) }).catch(() => {});
};

// 편집기의 탭 구좌 값 (plans/28). null = 탭을 모르던 저장본 → 이전 tabs를 그대로 둔다 / [] = 탭을 없앰 (productIds = 합친 상품)
// 편집기에서 s.productIds는 지금 보는 탭(s.ftabCur, 없으면 첫 탭)의 상품이고, 다른 탭 상품은 s.ftabs[].productIds에 있다
const EN_FTAB_LAYOUTS = ['grid2', 'grid3', 'feat'];   // app.js FTAB_LAYOUTS와 같게
function enFtabs(s) {
  if (!Array.isArray(s.ftabs)) return null;
  const tabs = s.ftabs.filter(t => t && /^[A-Za-z0-9_-]{1,40}$/.test(t.id || '')).slice(0, 12);
  const cur = tabs.find(t => t.id === s.ftabCur) || tabs[0];
  return tabs.map(t => ({ ...t, productIds: [...new Set(((t === cur ? s.productIds : t.productIds) || []).map(String))] }));
}
// page.sections가 이 편집기 밖(02 구좌 구성 등)에서 바뀌었는지 알아보는 지문 (구좌 id·유형·제목·설명·상품 SEQ, 탭 구좌면 탭과 칸의 탭)
// 탭이 없는 구좌는 예전 지문과 같다 → 업데이트 뒤 처음 열 때 쓸데없이 '다시 맞춤'이 생기지 않음
function enLegacyMark(sections) {
  const s = JSON.stringify((Array.isArray(sections) ? sections : []).map(x => {
    const r = [x.sectionId, x.layoutId, x.headline || '', x.subhead || '', (x.slots || []).map(y => y.seq || '')];
    if (x.tabs && x.tabs.length) r.push(x.tabs.map(t => [t.tabId, t.label || '']), (x.slots || []).map(y => y.tabId || ''));
    return r;
  }));
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `${s.length}:${h.toString(36)}`;
}

async function enConnect() {
  const API = window.AMOREAD_EDITOR_API;
  const doc = await PLAN.ready;
  if (!doc && new URLSearchParams(location.search).get('id')) {
    // 주소에 기획안이 있는데 못 엶(지워짐·잘못된 주소·서버 문제): '예시 기획안'이라고만 하면 내 기획안이 사라진 것처럼 보인다
    enNotice('이 기획안을 열지 못했어요. 지워졌거나 주소가 잘못됐을 수 있어요. 아래는 예시 화면이라 저장하지 않아요.', { error: true, action: { label: '기획안 목록으로', run: () => { location.href = '/v2/home'; } } });
    return;
  }
  if (!doc) {
    enNotice('예시 기획안이에요 · 저장하지 않아요', { detail: '상품·후기는 편집기에 들어 있는 가상 데이터예요. 홈에서 기획안을 열면 그 기획안의 상품·할인과 저장이 연결돼요.' });
    return;
  }
  let cat, catError = '';
  try { cat = await enCatalog(doc); } catch (e) { cat = { products: [], reviews: [], failed: 0 }; catError = e.message; }
  API.setCatalog({ products: cat.products, reviews: cat.reviews, note: `앱 후기 요약 발췌 ${cat.reviews.length}건 (상품 ${cat.products.length}개)` });
  const known = new Set(cat.products.map(p => p.id));
  if (API.setRefSource) API.setRefSource(s => enRefSource(doc, s), { onPick: enRefPicked(doc) });
  // 전체 상품에서 찾아 넣기 (2026-11-16): 상품표 전체(/api/products)에서 찾고, 넣으면 이 기획안 상품 목록(편집기 카탈로그)과
  // 상품·할인의 후보 상품(doc.pool)에 같이 들어간다 → 할인은 상품·할인에서 정한다. 이미 할인 행·후보에 있으면 후보에 다시 넣지 않는다
  if (API.setProductFinder) API.setProductFinder({
    async search(q) {
      const k = String(q || '').trim().toLowerCase();
      if (!k) return [];
      const all = await PRODUCTS_API.all(), inPlan = new Set(cat.products.map(p => p.id));
      const hits = all.filter(p => Number(p.price) > 0 && (String(p.name || '').toLowerCase().includes(k) || String(p.seq) === k))
        .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0))
        .slice(0, 20).map(p => ({ id: String(p.seq), name: String(p.name || p.seq), price: Number(p.price), active: !!p.active, inPlan: inPlan.has(String(p.seq)) }));
      try { const info = await enDiscountInfo(PLAN.doc || doc, hits.map(h => h.id)); hits.forEach(h => { h.info = info[h.id] || null; }); } catch { /* 판정을 못 받아도 찾기는 된다 */ }
      return hits;
    },
    info: seqs => enDiscountInfo(PLAN.doc || doc, seqs),
    // 할인율 정하기 (rate 0~0.8, null = 행을 만들지 않음). 저장 뒤 편집기 카탈로그의 가격도 새 할인으로 바꾼다
    async setRate(seq, rate) {
      seq = String(seq); rate = Math.round(Math.min(0.8, Math.max(0, Number(rate) || 0)) * 100) / 100;
      if (!/^\d{1,12}$/.test(seq)) throw new Error('상품 번호가 올바르지 않아요');
      PLAN.save(d => {
        d.promo_rows = enRowsWithRate(d, seq, rate);
        if (Array.isArray(d.pool)) d.pool = d.pool.filter(x => String(x.seq) !== seq);   // 할인 상품이 됐으니 후보에서는 뺀다 (상품·할인과 같게)
      });
      const now = PLAN.doc || doc;
      const one = await enCatalog({ ...now, promo_rows: enRowsWithRate(now, seq, rate) }, [seq]);
      if (one.products.length) {
        const k = cat.products.findIndex(p => p.id === seq);
        if (k >= 0) cat.products[k] = one.products[0]; else { cat.products.push(one.products[0]); cat.reviews.push(...one.reviews); known.add(seq); }
        API.setCatalog({ products: cat.products, reviews: cat.reviews });
      }
      return (await enDiscountInfo({ ...now, promo_rows: enRowsWithRate(now, seq, rate) }, [seq]))[seq] || null;
    },
    async add(seq, rate) {
      seq = String(seq);
      if (!/^\d{1,12}$/.test(seq)) throw new Error('상품 번호가 올바르지 않아요');
      if (!cat.products.some(p => p.id === seq)) {
        const one = await enCatalog(PLAN.doc || doc, [seq]);
        if (!one.products.length) throw new Error('상품 정보를 찾지 못했어요');
        cat.products.push(...one.products); cat.reviews.push(...one.reviews); known.add(seq);
        API.setCatalog({ products: cat.products, reviews: cat.reviews, note: `앱 후기 요약 발췌 ${cat.reviews.length}건 (상품 ${cat.products.length}개)` });
      }
      if (rate !== null && rate !== undefined && rate !== '') { await this.setRate(seq, rate); return true; }   // 할인율을 적었으면 할인 상품으로
      PLAN.save(d => {
        const pool = Array.isArray(d.pool) ? d.pool : [];
        if (!pool.some(x => String(x.seq) === seq) && !(d.promo_rows || []).some(r => String(r.seq) === seq) && pool.length < 100)
          d.pool = [...pool, { seq, items: null, memo: '', source: '구좌 편집에서 담음' }];
      });
      return true;
    },
  });

  const en = doc.editor_next && doc.editor_next.schema === EN_SCHEMA ? doc.editor_next : null;
  const legacy = (doc.page && doc.page.sections) || [];
  // 어떤 값을 열지: ① 편집기 저장본이 있고 page.sections가 그 뒤로 안 바뀌었으면 저장본
  //               ② 02 구좌 구성 등에서 page.sections가 바뀌었으면 page.sections를 기준으로 다시 맞춤 (같은 구좌 id는 편집기 세부값 유지)
  //               ③ 저장본이 없으면 page.sections에서 가져옴
  let start, how;
  try {
    if (en && en.snapshot && (!en.synced || en.synced === enLegacyMark(legacy) || !legacy.length)) {
      // 탭을 모르던 때의 저장본이면 탭은 page.sections에서 채운다 (plans/28)
      const leg = new Map(API.fromLegacyPage(doc.page).sections.filter(f => f.ftabs).map(f => [f.id, f]));
      start = { ...en.snapshot, sections: (en.snapshot.sections || []).map(s => {
        const L = s.ftabs === undefined && leg.get(s.id);
        return L && L.layout === s.layout ? { ...s, ftabs: L.ftabs, ftabCur: L.ftabCur, productIds: L.productIds } : s;
      }) };
      how = 'saved';
    } else if (!legacy.length) {
      // 02 구좌 구성을 아직 안 함: 빈 메인 비주얼 하나로 시작 (고치기 전에는 저장하지 않음 → 02의 '구좌 없음' 상태를 바꾸지 않는다)
      start = API.fromLegacyPage({ sections: [{ sectionId: 's1', layoutId: 'hero', headline: '메인 비주얼' }] }); how = 'empty';
    } else {
      const fresh = API.fromLegacyPage(doc.page);
      if (en && en.snapshot) {
        const old = new Map((en.snapshot.sections || []).map(s => [s.id, s]));
        fresh.sections = fresh.sections.map(f => {
          const o = old.get(f.id);
          // 탭은 02(page.sections)가 기준: 02에서 탭을 없앴으면 []
          return o && o.layout === f.layout ? { ...o, name: f.name, role: f.role, productIds: EN_PRODUCT_LAYOUTS.includes(f.layout) ? f.productIds : o.productIds, slotCount: f.slotCount ?? o.slotCount, notes: f.notes,
            ftabs: f.ftabs || (o.ftabs ? [] : undefined), ftabCur: f.ftabCur } : f;
        });
        how = 'resynced';
      } else how = 'imported';
      start = fresh;
    }
    // 레퍼런스를 다루기 전에 저장된 편집기 값은 refs가 비어 있다 → 예전 편집기에서 붙인 레퍼런스(v2.att)를 한 번 가져온다
    // (붙인 것을 여기서 모두 빼면 att도 []로 저장되므로 다시 살아나지 않는다)
    const attOf = new Map(legacy.filter(x => x && x.sectionId && x.v2 && Array.isArray(x.v2.att) && x.v2.att.length).map(x => [x.sectionId, x.v2.att]));
    if (attOf.size) {
      const viaLegacy = API.fromLegacyPage({ sections: legacy.filter(x => attOf.has(x.sectionId)) });
      const refsOf = new Map(viaLegacy.sections.map(x => [x.id, x.refs || []]));
      start = { ...start, sections: start.sections.map(x => (!x.refs || !x.refs.length) && refsOf.get(x.id) && refsOf.get(x.id).length ? { ...x, refs: refsOf.get(x.id) } : x) };
    }
    API.importSnapshot(start);
  } catch (e) {
    // 저장본을 열 수 없으면 덮어쓰지 않도록 저장을 연결하지 않는다
    enNotice(`구좌 편집 저장본을 열지 못했어요(${e.message}). 저장된 값을 지키기 위해 이 화면의 저장을 껐어요. 담당자에게 알려 주세요.`, { error: true });
    return;
  }
  const base = { saved: `저장본을 열었어요 (마지막 저장 ${String(doc.updated_at || '').slice(5, 16)})`,
    resynced: `02 구좌 구성에서 바뀐 구좌 ${legacy.length}개에 맞춰 다시 가져왔어요`,
    imported: `구좌 ${legacy.length}개를 가져왔어요`,
    empty: '아직 고른 구좌가 없어요' }[how];
  const lead = `${base} · 상품 ${cat.products.length}개${cat.failed ? ` (후기 못 불러옴 ${cat.failed}개)` : ''}`;
  const detail = '여기서 고친 문구·상품·순서는 04 미리보기·내보내기와 AI 카피 추천에 그대로 이어져요. 가격은 이 기획안의 할인 행 기준이고, 이미지는 앱 데이터에 없어 자리만 표시해요.';
  if (catError) enNotice(`상품·후기를 불러오지 못했어요: ${catError}. 상품 없이 편집할 수 있어요.`, { error: true });
  else if (how === 'empty') enNotice(base, { detail: '02 구좌 구성에서 추천 구성을 고르면 그 구좌들이 여기 와요. 여기서 [＋ 구좌]로 하나씩 만들어도 돼요.', action: { label: '02 구좌 구성으로', run: () => { location.href = `/v2/compose?id=${encodeURIComponent(doc.id)}`; } } });
  else enNotice(lead, { detail });

  // 서버보다 새 임시 저장본이 있으면 복원할지 묻는다 (자동으로 덮어쓰지 않음)
  const draft = enDraft.read(doc.id);
  if (draft && draft.at > String(doc.updated_at || '')) {
    enNotice(`저장하지 못한 작성 내용(${draft.at.slice(0, 16)})이 이 브라우저에 남아 있어요.`, { error: true, action: { label: '임시 저장본 불러오기', run: () => { API.importSnapshot(draft.snapshot); enNotice('임시 저장본을 불러왔어요. 저장 중이에요.'); push(draft.snapshot); } } });
  }

  PLAN.sendEditorNext = true;
  let last = null, failing = false;
  const push = snapshot => {
    last = snapshot;
    // 저장이 막힌 동안(다른 창에서 바뀜·서버 꺼짐)에는 plan.js가 보내지 않고 기다리므로, 고칠 때마다 임시 보관본을 새로 쓴다
    if (failing) enDraft.write(doc.id, snapshot);
    PLAN.save(d => {
      const sections = enToLegacy(snapshot, d.page && d.page.sections, known);
      d.page = { ...(d.page || {}), sections };
      d.editor_next = { schema: EN_SCHEMA, version: 1, editor: API.version, snapshot, synced: enLegacyMark(sections) };
    });
  };
  window.EN_PUSH_NOW = () => push(API.exportSnapshot());   // AI 카피 적용 기록처럼 편집기 밖 값이 바뀌었을 때
  API.subscribe(push);
  // 처음 열었을 때 page.sections가 편집기 값과 다르면(처음 가져옴·다시 맞춤·옛 저장본) 한 번 맞춰 둔다
  //  → 고치지 않고 바로 04 미리보기나 AI 추천으로 가도 같은 내용
  const now = API.exportSnapshot();
  if (how !== 'empty' && (how !== 'saved' || !en.synced || enLegacyMark(enToLegacy(now, legacy, known)) !== enLegacyMark(legacy))) push(now);
  addEventListener('plan:saved', e => {
    failing = !e.detail.ok;
    if (e.detail.ok) { enDraft.clear(doc.id); return; }
    // 어떻게 할지(다시 시도·새로 불러오기·내 것으로 저장)는 화면 아래 저장 띠(plan.js)가 묻는다. 여기서는 작성 내용을 지킨 사실만 알린다
    const kept = last && enDraft.write(doc.id, last);
    enNotice(`${e.detail.stale ? '다른 창에서 이 기획안이 바뀌어 저장을 멈췄어요' : '저장하지 못했어요'}${kept ? '. 쓰던 내용은 이 브라우저에 임시로 보관했어요' : ''}. 화면 아래 안내에서 어떻게 할지 골라 주세요.`, { error: true });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  enConnect().catch(e => enNotice(`신규 편집기를 준비하지 못했어요: ${e.message}`, { error: true }));
});

// 4) [검수 · n]: 남은 항목 수를 data-issues로 넘겨 CSS가 남아 있을 때만 주의 색을 쓰게 한다 (v1.12는 글자만 바꿈)
(() => {
  const n = document.getElementById('iaIssueCount'), b = document.getElementById('iaCheckAll');
  if (!n || !b) return;
  const sync = () => { const m = /(\d+)/.exec(n.textContent || ''); if (m) b.dataset.issues = m[1]; else delete b.dataset.issues; };
  new MutationObserver(sync).observe(n, { childList: true, characterData: true, subtree: true });
  sync();
})();

// 5) 요소 넣기 패널 (plans/27 §11): 목록 머리 [＋ 요소] → v1.12의 '추가' 보기(library)를 켜고 왼쪽 칸 옆 패널로 보인다.
//    닫기(×·Esc·다시 누르기) → 편집 보기(sections). 패널 머리에 어느 구좌에 들어가는지 표시
document.addEventListener('DOMContentLoaded', () => {
  const lib = document.getElementById('component-library');
  const openBtn = document.getElementById('enInsertOpen'), to = document.getElementById('enInsertTo');
  const rail = m => document.querySelector(`.cb-rail [data-cb-rail="${m}"]`);
  if (!lib || !openBtn) return;
  const isOpen = () => !lib.hidden;
  const sync = () => {
    openBtn.setAttribute('aria-expanded', String(isOpen()));
    const t = document.getElementById('insTitle');
    if (to) to.textContent = isOpen() && t && t.textContent ? `‘${t.textContent}’에 넣어요` : '';
  };
  openBtn.addEventListener('click', () => { rail(isOpen() ? 'sections' : 'library')?.click(); });
  document.getElementById('enInsertClose')?.addEventListener('click', () => { rail('sections')?.click(); openBtn.focus(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen() && !document.querySelector('dialog[open]')) { rail('sections')?.click(); openBtn.focus(); }
  });
  new MutationObserver(sync).observe(lib, { attributes: true, attributeFilter: ['hidden'] });
  const ins = document.getElementById('insTitle'); if (ins) new MutationObserver(sync).observe(ins, { childList: true, characterData: true, subtree: true });
  sync();
});

// 3) 미리보기 칸 도구 줄의 [내보내기] 메뉴(<details>): 하나 고르면 닫고, 바깥을 누르거나 Esc면 닫는다
(() => {
  const menu = () => document.querySelector('.en-menu');
  document.addEventListener('click', e => {
    const m = menu(); if (!m || !m.open) return;
    if (e.target.closest('.en-menu-pop button') || !m.contains(e.target)) m.open = false;
  });
  document.addEventListener('keydown', e => {
    const m = menu(); if (e.key !== 'Escape' || !m || !m.open) return;
    m.open = false; m.querySelector('summary').focus();
  });
})();
