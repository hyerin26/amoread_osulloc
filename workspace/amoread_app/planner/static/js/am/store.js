// AMOREAD 통합 기획안 — 현재 기획안 상태, 서버 저장(자동 저장), 공통 상수
import { api, emit } from '../core.js';

export const STATUS = { planning: '기획 중', confirmed: '확정', reflected: 'PROMO_WORK 반영됨' };
export const PURPOSES = ['전환·매출', '선물 수요', '신규 유입', '객단가 상승', '브랜드·신제품', '재고 소진'];
export const SECTION_GOALS = ['전환', '유입', '객단가', '브랜딩', '혜택 안내', '정보 안내'];

export const am = { cur: null, saveState: 'idle', saveError: '' };

export function uid(prefix) {
  const a = new Uint8Array(4); crypto.getRandomValues(a);
  return prefix + [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function blankBrief() {
  return { myeongbun: '', concept: '', customer: '', target: '', purpose: '', audience: '', background: '', constraints: '',
    benefits_note: '', period: null, page_kind: '이벤트', season_ref: null };
}

export function blankProject(over = {}) {
  return { id: null, title: '', status: 'planning', origin: { type: 'brief', ref: '' }, brief: blankBrief(),
    promo_rows: [], deal_plan: null, pool: [], page: null, links: null, rationale: '', ...over, brief: { ...blankBrief(), ...(over.brief || {}) } };
}

// 하루특가 설정 (하루 자리 수, 후보 상품). 없으면 기본값
export function dealPlanOf(p) {
  const d = p.deal_plan || {};
  return { slots: Math.max(1, Math.min(12, +d.slots || 4)), candidates: (d.candidates || []).slice(0, 100) };
}

// 서버 모델(api.ProjectReq)에 맞춰 보낼 값만 고른다
export function payload(p) {
  const b = { ...blankBrief(), ...p.brief };
  if (!b.period || !b.period.start) b.period = null;
  else b.period = { start: b.period.start, end: b.period.end && b.period.end >= b.period.start ? b.period.end : b.period.start };
  const page = p.page ? { sections: (p.page.sections || []).map((s, i) => ({ ...s, order: i + 1 })) } : null;
  return { id: p.id, title: p.title || '', status: p.status || 'planning', origin: p.origin || { type: 'brief', ref: '' },
    brief: b, promo_rows: p.promo_rows || [], deal_plan: p.deal_plan ? dealPlanOf(p) : null, pool: (p.pool || []).slice(0, 100), page, links: p.links || null, rationale: p.rationale || '',
    base_updated_at: p.updated_at || null };   // 그 사이 다른 화면이 저장했으면 서버가 409로 막음 (덮어쓰지 않음)
}

let inflight = null, again = false, timer = null;
async function doSave() {
  if (!am.cur) return;
  if (inflight) { again = true; return inflight; }
  am.saveState = 'saving'; emit('am:savestate');
  const target = am.cur;
  inflight = (async () => {
    try {
      const d = await api('/api/am/projects', { method: 'POST', body: payload(target) });
      target.id = d.id; target.updated_at = d.updated_at; target.created_at = d.created_at;
      if (am.cur === target) { am.saveState = 'saved'; am.saveError = ''; }
      emit('am:changed', d);
    } catch (e) {
      am.saveState = 'error'; am.saveError = e.message;   // 실패했으면 '저장됨'을 표시하지 않는다
    } finally {
      inflight = null; emit('am:savestate');
      if (again) { again = false; doSave(); }
    }
  })();
  return inflight;
}

export function scheduleSave() {
  am.saveState = 'dirty'; emit('am:savestate');
  clearTimeout(timer); timer = setTimeout(doSave, 700);
}
export async function saveNow() {
  clearTimeout(timer);
  while (inflight) { try { await inflight; } catch { /* 상태는 am.saveState에 */ } }
  again = false;
  await doSave();
  return am.cur;
}

export async function openProject(id) {
  const d = await api(`/api/am/projects/${encodeURIComponent(id)}`);
  am.cur = blankProject(d); am.cur.id = d.id; am.cur.updated_at = d.updated_at; am.cur.created_at = d.created_at;
  am.saveState = 'saved'; am.saveError = '';
  rememberCurrent(am.cur.id);
  return am.cur;
}

// 새 기획안은 만들자마자 한 번 저장해 ID를 받는다 (자동 저장이 겹쳐 중복 생성되지 않게)
export async function createProject(over = {}) {
  am.cur = blankProject(over);
  await saveNow();
  if (!am.cur.id) throw new Error(am.saveError || '기획안을 만들지 못했습니다');
  rememberCurrent(am.cur.id);
  return am.cur;
}

// 작업 중 기획안: 상단 칩에 보이고, 어디서 담기를 누르든 여기로 들어간다.
// 이 브라우저에만 ID를 기억한다 (편의 기능. 저장이 막힌 환경에서도 동작은 그대로)
const LS_CUR = 'amoread.current.v1';
export function rememberCurrent(id) {
  try { if (id) localStorage.setItem(LS_CUR, id); else localStorage.removeItem(LS_CUR); } catch { /* 저장소 없음 */ }
  emit('am:current');
}
export function savedCurrentId() { try { return localStorage.getItem(LS_CUR); } catch { return null; } }
export function clearCurrent() { am.cur = null; am.saveState = 'idle'; rememberCurrent(null); }

// 날짜 도우미
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const dDay = s => Math.round((parseD(s) - parseD(iso(new Date()))) / 86400000);
export const dLabel = s => { const n = dDay(s); return n > 0 ? `D-${n}` : n === 0 ? 'D-day' : `${-n}일 지남`; };
