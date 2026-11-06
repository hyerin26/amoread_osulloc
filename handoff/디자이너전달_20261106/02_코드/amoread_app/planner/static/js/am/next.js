// '다음에 할 일': 단계끼리 어긋난 곳을 찾아 알려준다 (plans/03 5장, plans/05 R1·R5). 자동으로 고치지 않는다.
// 기준은 저장된 값이다 (② 상품·할인은 저장한 할인 행만 본다).
import { api, mmdd, state, won } from '../core.js';
import { dealPlanOf } from './store.js';

const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nextDay = s => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

let checkCache = { key: '', summary: null };
async function checkSummary(rows) {
  const key = JSON.stringify(rows);
  if (checkCache.key === key) return checkCache.summary;
  try { checkCache = { key, summary: (await api('/api/am/check', { method: 'POST', body: { rows } })).summary }; }
  catch { checkCache = { key, summary: null }; }
  return checkCache.summary;
}

const isDeal = r => r.type === '하루특가';
const seqKey = r => r.items && r.items.length ? `i:${r.items.map(i => `${i.seq}x${i.qty}`).join('+')}` : (r.seq ? `s:${r.seq}` : '');

// 반환: [{ text, step, sub?: 'deals', act?: 'deal-section' }] 중요한 순서
export async function nextItems(p, { dirty = false, sched = null } = {}) {
  const b = p.brief || {}, rows = p.promo_rows || [], per = b.period;
  const secs = p.page?.sections || [];
  const hasPage = !!p.page || b.page_kind !== '없음';
  const out = [];

  if (dirty) out.push({ text: '03 상품·혜택에 저장하지 않은 변경이 있어요', step: 'promo' });
  if (!(b.myeongbun || '').trim()) out.push({ text: '명분과 컨셉을 정해 보세요', step: 'brief' });
  else if (!(b.concept || '').trim()) out.push({ text: '컨셉을 한 줄로 정해 보세요', step: 'brief' });
  if (!per) out.push({ text: '기간을 정하면 캘린더와 제작 일정에 보여요', step: 'brief' });

  if (rows.length) {
    const s = await checkSummary(rows);
    if (s && s.errors) out.push({ text: `할인 행 오류 ${s.errors}건이 있어요`, step: 'promo' });
  }

  const deals = rows.filter(isDeal);
  // R1: 하루특가가 있는데 페이지에 하루특가 섹션이 없음
  if (deals.length && hasPage && !secs.some(s => s.layoutId === 'deal-banner')) {
    const first = deals.map(r => r.start).filter(Boolean).sort()[0];
    out.push({ text: `${first ? mmdd(first) + '부터 ' : ''}하루특가가 있는데 페이지에 하루특가 섹션이 없어요`, step: 'page', act: 'deal-section', actLabel: '섹션 추가' });
  }
  // R5: 하루특가 날짜가 기획안 기간 밖
  if (per && deals.length) {
    const out5 = deals.filter(r => r.start < per.start || r.start > per.end).map(r => r.start).sort();
    if (out5.length) out.push({ text: `하루특가 ${out5.length}개가 기획안 기간(${mmdd(per.start)}~${mmdd(per.end)}) 밖이에요 (${mmdd(out5[0])} 등)`, step: 'promo', sub: 'deals' });
  }
  // R6: 하루특가 섹션은 있는데 앞으로의 날짜에 빈 자리가 있음
  if (per && secs.some(s => s.layoutId === 'deal-banner')) {
    const slots = dealPlanOf(p).slots, today = isoToday();
    const cnt = {}; deals.forEach(r => { cnt[r.start] = (cnt[r.start] || 0) + 1; });
    let empty = 0; const days = [];
    for (let d = per.start < today ? today : per.start, i = 0; d <= per.end && i < 62; d = nextDay(d), i++) {
      const e = Math.max(0, slots - (cnt[d] || 0));
      if (e) { empty += e; if (days.length < 3) days.push(d); }
    }
    if (empty) out.push({ text: `하루특가 빈 자리 ${empty}개 (${days.map(mmdd).join(', ')}${empty > days.length ? ' 등' : ''})`, step: 'promo', sub: 'deals' });
  }
  // 상시 할인 기간이 브리프 기간과 다름
  if (per) {
    const sang = rows.filter(r => !isDeal(r) && r.start);
    if (sang.length) {
      const s0 = sang.map(r => r.start).sort()[0], e0 = sang.map(r => r.end || r.start).sort().pop();
      if (s0 < per.start || e0 > per.end) out.push({ text: `할인 기간(${mmdd(s0)}~${mmdd(e0)})이 브리프 기간(${mmdd(per.start)}~${mmdd(per.end)})과 달라요`, step: 'brief' });
    }
  }
  // 할인 상품과 페이지 섹션 상품 맞추기 (하루특가 섹션은 제외)
  if (secs.length) {
    const placed = new Set(secs.filter(s => s.layoutId !== 'deal-banner').flatMap(s => s.slots.map(seqKey)).filter(Boolean));
    const priced = new Set(rows.filter(r => !isDeal(r)).map(seqKey).filter(Boolean));
    const notPlaced = [...priced].filter(k => !placed.has(k)).length;
    const notPriced = [...placed].filter(k => !priced.has(k)).length;
    if (notPlaced) out.push({ text: `구좌 상품 ${notPlaced}개가 페이지에 아직 없어요`, step: 'page' });
    if (notPriced) out.push({ text: `페이지에 놓였지만 03 상품·혜택에 없는 상품이 ${notPriced}개 있어요`, step: 'promo', sub: 'rows' });
    // R19: 섹션 가격 노출 방식과 할인이 어긋남 (노출 방식을 정한 섹션만)
    const rowFor = sl => rows.find(r => !isDeal(r) && seqKey(r) === seqKey(sl));
    const saleOf = r => { if (!r || r.items || !r.seq) return null; const p = state.bySeq.get(String(r.seq)); return p && p.price ? Math.round(p.price * (1 - (r.rate || 0))) : null; };
    for (const sec of secs.filter(x => x.layoutId !== 'deal-banner')) {
      if (sec.price_display === 'section' && sec.section_price) {
        const k = sec.slots.filter(sl => { const v = saleOf(rowFor(sl)); return v !== null && v !== sec.section_price; }).length;
        if (k) out.push({ text: `「${sec.name}」은 섹션 대표 가격 ${won(sec.section_price)}원인데 가격이 다른 상품이 ${k}개 있어요`, step: 'page' });
      }
      if (sec.price_display === 'emphasis') {
        const k = sec.slots.filter(sl => seqKey(sl) && (() => { const r = rowFor(sl); return !r || r.type === '큐레이션' || !r.rate; })()).length;
        if (k) out.push({ text: `할인율 강조 섹션 「${sec.name}」에 할인 없는 상품이 ${k}개 있어요`, step: 'page' });
      }
    }
  } else if (hasPage && rows.length) {
    out.push({ text: '상품은 정해졌는데 구좌 구성이 아직 없어요. 02 구성에서 구좌를 만들어 보세요', step: 'page' });
  }
  // 제작 일정: 다음 마감이 3업무일 안
  if (sched && sched.steps) {
    const nx = sched.steps.find(s => s.state !== 'past');
    if (nx && (nx.state === 'today' || nx.wd_left <= 3)) out.push({ text: `${nx.label} 마감이 ${mmdd(nx.date)}(${nx.dow})예요${nx.state === 'today' ? ' (오늘)' : ` (${nx.wd_left}업무일 후)`}`, step: 'brief' });
  }
  return out;
}
