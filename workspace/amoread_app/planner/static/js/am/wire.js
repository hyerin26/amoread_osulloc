// 구좌 와이어프레임: 고객 화면의 모바일 모양을 단순화해 그린다 (디자이너 v2.5.1 S06 기준)
// ④ 구좌 편집이 쓰고, ⑤ 디자이너 기획안도 같은 모양으로 맞출 예정 (plans/10 D6)
// - 가격은 ② 구좌 상품(상시·할인 없음)의 할인율을 읽기만 한다. 하루특가는 ②의 하루특가 행을 날짜별로 보여준다
// - 원가는 그리지 않는다. 상품 이미지는 출처가 정해지지 않아 자리 표시만
import { esc, mmdd, pct, state, won } from '../core.js';
import { dealPlanOf } from './store.js';

const isDeal = r => r.type === '하루특가';
export const keyOf = x => x.items && x.items.length ? `i:${x.items.map(i => `${i.seq}x${i.qty || 1}`).join('+')}` : (x.seq ? `s:${x.seq}` : '');
export const nameOf = x => x.items && x.items.length
  ? '신규 조합: ' + x.items.map(i => ((state.bySeq.get(String(i.seq)) || {}).name || i.seq) + (i.qty > 1 ? ` ${i.qty}개` : '')).join(' + ')
  : x.seq ? ((state.bySeq.get(String(x.seq)) || {}).name || `SEQ ${x.seq} (상품 정보 없음)`) : '상품 미정';
const listPrice = x => x.seq && !(x.items && x.items.length) ? (state.bySeq.get(String(x.seq)) || {}).price || null : null;

// 섹션 상품의 가격: { und } 또는 { lp 정가, sp 판매가, rate, curation }
export function priceOf(slot, rows) {
  if (!keyOf(slot)) return { und: '상품 미정' };
  const r = rows.find(x => !isDeal(x) && keyOf(x) === keyOf(slot));
  if (!r) return { und: '할인 미정' };
  const curation = r.type === '큐레이션', rate = curation ? 0 : (r.rate || 0), lp = listPrice(r);
  return { lp, sp: lp ? Math.round(lp * (1 - rate)) : null, rate, curation };
}
export function priceText(pr) {
  if (pr.und) return pr.und;
  if (pr.curation || !pr.rate) return `할인 없음${pr.lp ? ` · ${won(pr.lp)}원` : ''}`;
  return `상시 ${pct(pr.rate)}${pr.sp ? ` · ${won(pr.sp)}원` : ''}${pr.lp ? ` (정가 ${won(pr.lp)}원)` : ''}`;
}

// 하루특가 섹션이 보여줄 날짜: 기획안 기간(최대 62일), 기간이 없으면 하루특가 행의 날짜
export function dealDates(p) {
  const per = p.brief.period, out = [];
  if (per) {
    const [y, m, d] = per.start.split('-').map(Number);
    for (let i = 0; i < 62; i++) {
      const x = new Date(y, m - 1, d + i);
      const s = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      if (s > per.end) break; out.push(s);
    }
    return out;
  }
  return [...new Set((p.promo_rows || []).filter(isDeal).map(r => r.start))].sort();
}

const LABEL = { headline: '메인 카피', subhead: '서브 카피', cta: '버튼 문구' };
// 바로 고칠 수 있는 글: 비어 있으면 편집 화면에서는 안내 문구, 내보낼 때는 그리지 않는다
export function edText(s, f, editable) {
  const v = s[f] || '';
  return v ? esc(v).replace(/\n/g, '<br>') : editable ? `<span class="am-w-empty">${LABEL[f]}를 입력해 주세요.</span>` : '';
}
function ed(s, f, cls, editable) {
  if (!editable && !s[f]) return '';
  const attrs = editable ? ` data-ed="${f}" tabindex="0" role="button" aria-label="${LABEL[f]} 편집. Enter로 시작"` : '';
  return `<div class="${cls}"${attrs}>${edText(s, f, editable)}</div>`;
}

function priceHTML(pr, display) {
  if (pr.und) return `<span class="am-w-und">${esc(pr.und)}</span>`;
  if (display === 'name' || display === 'section') return '';
  if (!display) return '<span class="am-w-und">가격 노출 미정</span>';
  if (pr.curation || !pr.rate) return pr.lp ? `<span class="am-w-pr"><b>${won(pr.lp)}원</b></span>` : '';
  return `<span class="am-w-pr">${display === 'emphasis' ? `<b class="am-w-rate">${pct(pr.rate)}</b> ` : ''}<b class="am-w-sale">${pr.sp ? `${won(pr.sp)}원` : ''}</b>${pr.lp ? ` <s>${won(pr.lp)}원</s>` : ''}</span>`;
}
// 탭(필터) 구좌에서 지금 보고 있는 탭. 화면 상태라 저장하지 않는다. 처음엔 첫 탭 (plans/17 2-1, 사용자 결정: 미리보기도 첫 탭 + 눌러서 바꿔 보기)
const wireTab = new Map();
// 알약을 누르면 그 탭의 카드로 바꾼다. 처리했으면 true. 04·05 어디서든 클릭 위임으로 부른다
export function switchWireTab(e) {
  const b = e.target.closest('[data-wtab]'); if (!b) return false;
  const [id, i] = b.dataset.wtab.split('|'), n = +i, box = b.closest('.am-w-tabs');
  wireTab.set(id, n);
  box.querySelectorAll('[data-wtab]').forEach((x, j) => { x.classList.toggle('on', j === n); x.setAttribute('aria-selected', j === n); });
  box.querySelectorAll('[data-wpanel]').forEach((x, j) => { x.hidden = j !== n; });
  return true;
}

const card = (name, price, copy = '') => `<div class="am-w-card"><span class="am-w-img" aria-hidden="true">이미지</span><span class="am-w-name">${esc(name)}</span>${price}${copy ? `<span class="am-w-copy">${esc(copy)}</span>` : ''}</div>`;

// s: 섹션, p: 기획안. date: 하루특가 섹션에서 보여줄 날짜
export function wireSection(s, p, { editable = false, date = null } = {}) {
  const rows = p.promo_rows || [];
  const hl = cls => ed(s, 'headline', cls, editable), sh = cls => ed(s, 'subhead', cls, editable), cta = ed(s, 'cta', 'am-w-cta', editable);
  const sprice = s.price_display === 'section' && s.section_price ? `<p class="am-w-sprice">${won(s.section_price)}원</p>` : '';
  // 상품 카드가 없는 레이아웃에 연결된 상품: 지우지 않고 남겨 두되 배치되지 않았음을 알린다 (디자이너 unplaced 안내)
  const unplaced = s.slots.length ? `<p class="am-w-unplaced">상품 ${s.slots.length}개를 아직 배치하지 않았어요. 레이아웃을 확인해 주세요.</p>` : '';
  switch (s.layoutId) {
    case 'hero':
      return `<div class="am-w-hero">${hl('am-w-hero-t')}${sh('am-w-sub')}</div>${cta}${unplaced}`;
    case 'text-cta':
      return `<div class="am-w-pad">${hl('am-w-title')}${sh('am-w-sub')}${cta}${unplaced}</div>`;
    case 'benefit':
      return `<div class="am-w-pad"><div class="am-w-benefit">${hl('am-w-title')}${sh('am-w-sub am-w-strong')}<span class="am-w-cap">프로모션 혜택</span></div>${cta}${unplaced}</div>`;
    case 'deal-banner': {
      const n = dealPlanOf(p).slots;
      const day = date ? rows.filter(r => isDeal(r) && r.start === date) : [];
      const cards = day.map(r => card(nameOf(r), r.rate ? `<span class="am-w-pr"><b class="am-w-rate">${pct(r.rate)}</b> <b class="am-w-sale">${(() => { const lp = listPrice(r); return lp ? `${won(Math.round(lp * (1 - r.rate)))}원` : ''; })()}</b></span>` : ''))
        .concat(Array.from({ length: Math.max(0, n - day.length) }, () => '<div class="am-w-card am-w-gap"><span class="am-w-img" aria-hidden="true"></span><span class="am-w-und">빈 자리</span></div>'));
      return `<div class="am-w-pad">${hl('am-w-title')}${sh('am-w-sub')}<p class="am-w-date">${date ? `${mmdd(date)} 하루특가 · 하루 ${n}자리` : '날짜를 고르면 그날 상품을 보여줘요'}</p>
        <div class="am-w-grid g3">${cards.join('')}</div>${cta}</div>`;
    }
    default: {   // grid2, grid3, split
      const g = s.layoutId === 'grid3' ? 'g3' : s.layoutId === 'split' ? 'split' : 'g2';
      const grid = list => list.length ? `<div class="am-w-grid ${g}">${list.map(sl => card(keyOf(sl) ? nameOf(sl) : '상품 미정', priceHTML(priceOf(sl, rows), s.price_display || ''), sl.customCopy)).join('')}</div>`
        : '<p class="am-w-und">아직 연결한 상품이 없어요</p>';
      const tabs = s.tabs || [];
      let body = grid(s.slots);
      if (tabs.length) {   // 알약 필터 + 탭마다 카드 묶음. 보고 있는 탭만 보이고 나머지는 숨겨 둔다
        const cur = Math.min(wireTab.get(s.sectionId) || 0, tabs.length - 1);
        body = `<div class="am-w-tabs"><div class="am-w-pills" role="tablist" aria-label="${esc(s.name || '구좌')} 필터">${tabs.map((t, i) =>
          `<button type="button" role="tab" class="am-w-pill ${i === cur ? 'on' : ''}" aria-selected="${i === cur}" data-wtab="${esc(s.sectionId)}|${i}">${esc(t.label || '탭')}</button>`).join('')}</div>
          ${tabs.map((t, i) => `<div data-wpanel ${i === cur ? '' : 'hidden'}>${grid(s.slots.filter(x => x.tabId ? x.tabId === t.tabId : i === 0))}</div>`).join('')}</div>`;
      }
      return `<div class="am-w-pad">${hl('am-w-title')}${sh('am-w-sub')}${sprice}${body}${cta}</div>`;
    }
  }
}
