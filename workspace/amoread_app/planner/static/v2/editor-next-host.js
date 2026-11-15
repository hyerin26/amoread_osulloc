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
async function enCatalog(doc) {
  const all = await PRODUCTS_API.all();
  const P = Object.fromEntries(all.map(p => [String(p.seq), p]));
  // 할인 행: 기존 편집기와 같은 기준 (하루특가·조합 행 제외)
  const rows = (doc.promo_rows || []).filter(r => r.type !== '하루특가' && r.seq && P[r.seq] && !(r.items && r.items.length));
  const rowOf = seq => rows.find(r => String(r.seq) === seq);
  const extras = (doc.v2 && doc.v2.extras) || [];
  const seqs = [...new Set([
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
    if (EN_PRODUCT_LAYOUTS.includes(s.layout)) {
      const ids = (s.productIds || []).map(String).filter(seq => /^\d{1,12}$/.test(seq));
      const picked = ids.map(seq => bySeq.get(seq) || { slotId: enSlotId(), tabId: firstTab, seq, items: null, placeholderStatus: 'AVAILABLE', customCopy: '' });
      const empty = ids.length ? [] : pSlots.filter(x => x && !x.seq && !(x.items && x.items.length));   // 상품을 아직 안 고른 자리는 유지
      slots = [...picked, ...foreign.filter(x => !picked.includes(x)), ...empty].slice(0, 40);
    }
    const lines = (s.lines || []).slice(0, 10).map((l, k) => ({ id: (pv.lines && pv.lines[k] && pv.lines[k].id) || `l${k + 1}`, text: enCut(l && l.text, 120) }));
    const ai = window.EN_AI_META[s.id] || pv.copyRecommendation;
    return {
      ...p, sectionId: s.id, order: i, name: enCut(s.name, 40), headline: enCut(s.name, 120), subhead: enCut(s.role, 400),
      cta: enCut(s.cta, 40), layoutId: s.layout, zone_tag: enCut(s.cat, 40), designNotes: enCut(s.notes, 2000), slots,
      v2: { ...pv, scope: enCut(s.scope, 200), num: !!s.num, ctaOn: !!s.ctaOn, ctaTo: enCut(s.ctaTo, 60), lines,
        ...(s.card ? { card: { order: s.card.order, on: s.card.on, def: s.card.def } } : {}), ...(ai ? { copyRecommendation: ai } : {}) },
    };
  });
}
// page.sections가 이 편집기 밖(02 구좌 구성 등)에서 바뀌었는지 알아보는 지문 (구좌 id·유형·제목·설명·상품 SEQ만)
function enLegacyMark(sections) {
  const s = JSON.stringify((Array.isArray(sections) ? sections : []).map(x => [x.sectionId, x.layoutId, x.headline || '', x.subhead || '', (x.slots || []).map(y => y.seq || '')]));
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `${s.length}:${h.toString(36)}`;
}

async function enConnect() {
  const API = window.AMOREAD_EDITOR_API;
  const doc = await PLAN.ready;
  if (!doc) {
    enNotice('예시 기획안이에요 · 저장하지 않아요', { detail: '상품·후기는 편집기에 들어 있는 가상 데이터예요. 홈에서 기획안을 열면 그 기획안의 상품·할인과 저장이 연결돼요.' });
    return;
  }
  let cat, catError = '';
  try { cat = await enCatalog(doc); } catch (e) { cat = { products: [], reviews: [], failed: 0 }; catError = e.message; }
  API.setCatalog({ products: cat.products, reviews: cat.reviews, note: `앱 후기 요약 발췌 ${cat.reviews.length}건 (상품 ${cat.products.length}개)` });
  const known = new Set(cat.products.map(p => p.id));

  const en = doc.editor_next && doc.editor_next.schema === EN_SCHEMA ? doc.editor_next : null;
  const legacy = (doc.page && doc.page.sections) || [];
  // 어떤 값을 열지: ① 편집기 저장본이 있고 page.sections가 그 뒤로 안 바뀌었으면 저장본
  //               ② 02 구좌 구성 등에서 page.sections가 바뀌었으면 page.sections를 기준으로 다시 맞춤 (같은 구좌 id는 편집기 세부값 유지)
  //               ③ 저장본이 없으면 page.sections에서 가져옴
  let start, how;
  try {
    if (en && en.snapshot && (!en.synced || en.synced === enLegacyMark(legacy) || !legacy.length)) { start = en.snapshot; how = 'saved'; }
    else {
      const fresh = API.fromLegacyPage(doc.page);
      if (en && en.snapshot) {
        const old = new Map((en.snapshot.sections || []).map(s => [s.id, s]));
        fresh.sections = fresh.sections.map(f => {
          const o = old.get(f.id);
          return o && o.layout === f.layout ? { ...o, name: f.name, role: f.role, productIds: EN_PRODUCT_LAYOUTS.includes(f.layout) ? f.productIds : o.productIds, notes: f.notes } : f;
        });
        how = 'resynced';
      } else how = 'imported';
      start = fresh;
    }
    API.importSnapshot(start);
  } catch (e) {
    // 저장본을 열 수 없으면 덮어쓰지 않도록 저장을 연결하지 않는다
    enNotice(`구좌 편집 저장본을 열지 못했어요(${e.message}). 저장된 값을 지키기 위해 이 화면의 저장을 껐어요. 담당자에게 알려 주세요.`, { error: true });
    return;
  }
  const base = { saved: `저장본을 열었어요 (마지막 저장 ${String(doc.updated_at || '').slice(5, 16)})`,
    resynced: `02 구좌 구성에서 바뀐 구좌 ${legacy.length}개에 맞춰 다시 가져왔어요`,
    imported: `구좌 ${legacy.length}개를 가져왔어요` }[how];
  const lead = `${base} · 상품 ${cat.products.length}개${cat.failed ? ` (후기 못 불러옴 ${cat.failed}개)` : ''}`;
  const detail = '여기서 고친 문구·상품·순서는 04 미리보기·내보내기와 AI 카피 추천에 그대로 이어져요. 가격은 이 기획안의 할인 행 기준이고, 이미지는 앱 데이터에 없어 자리만 표시해요.';
  if (catError) enNotice(`상품·후기를 불러오지 못했어요: ${catError}. 상품 없이 편집할 수 있어요.`, { error: true });
  else enNotice(lead, { detail });

  // 서버보다 새 임시 저장본이 있으면 복원할지 묻는다 (자동으로 덮어쓰지 않음)
  const draft = enDraft.read(doc.id);
  if (draft && draft.at > String(doc.updated_at || '')) {
    enNotice(`저장하지 못한 작성 내용(${draft.at.slice(0, 16)})이 이 브라우저에 남아 있어요.`, { error: true, action: { label: '임시 저장본 불러오기', run: () => { API.importSnapshot(draft.snapshot); enNotice('임시 저장본을 불러왔어요. 저장 중이에요.'); push(draft.snapshot); } } });
  }

  PLAN.sendEditorNext = true;
  let last = null;
  const push = snapshot => {
    last = snapshot;
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
  if (how !== 'saved' || !en.synced || enLegacyMark(enToLegacy(now, legacy, known)) !== enLegacyMark(legacy)) push(now);
  addEventListener('plan:saved', e => {
    if (e.detail.ok) { enDraft.clear(doc.id); return; }
    const kept = last && enDraft.write(doc.id, last);
    enNotice(`저장하지 못했어요: ${e.detail.error}${kept ? ' · 작성 내용은 이 브라우저에 임시로 보관했어요.' : ''}`,
      { error: true, action: { label: '새로고침', run: () => location.reload() } });
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
