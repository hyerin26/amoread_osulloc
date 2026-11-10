// 실행 취소·다시 실행: 기획안의 페이지(③ 페이지 구성, ④ 구좌 편집)만 대상으로 한다.
// ② 할인 행과 하루특가는 수동 저장이라 대상 밖. 다른 단계에서 페이지를 고친 뒤 되돌려 덮지 않도록, 페이지 단계 밖으로 나가면 hub가 reset한다.
// 다른 모듈을 불러오지 않는다 (node 단위 시험용)
const LIMIT = 70;
let past = [], future = [], pid = null, listener = () => {};

export const snap = p => JSON.stringify(p.page ?? null);
export function setHistoryListener(fn) { listener = fn; }
export function resetHistory(id = null) { past = []; future = []; pid = id; listener(); }
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

// before: 바꾸기 전 snap(p). 바뀐 것이 없으면 기록하지 않는다
export function record(p, before) {
  if (pid !== p.id) { past = []; future = []; pid = p.id; }
  if (before === snap(p)) return false;
  past.push(before); if (past.length > LIMIT) past.shift();
  future = []; listener();
  return true;
}
export function undo(p) {
  if (pid !== p.id || !past.length) return false;
  future.push(snap(p)); p.page = JSON.parse(past.pop()); listener();
  return true;
}
export function redo(p) {
  if (pid !== p.id || !future.length) return false;
  past.push(snap(p)); p.page = JSON.parse(future.pop()); listener();
  return true;
}

// 구좌 순서 바꾸기 (디자이너 reorderSectionList와 같은 규칙): from을 to의 앞(after=false) 또는 뒤에 놓는다.
// 섹션 객체를 그대로 옮겨 sectionId, 슬롯, 카피, 디자인 요청이 함께 간다. 바뀌지 않으면 false
export function reorderById(list, from, to, after, key = 'sectionId') {
  const src = list.findIndex(x => x[key] === from), tgt = list.findIndex(x => x[key] === to);
  if (src < 0 || tgt < 0 || from === to) return false;
  const dst = tgt + (after ? 1 : 0) - (src < tgt ? 1 : 0);
  if (dst === src) return false;
  const [it] = list.splice(src, 1); list.splice(dst, 0, it);
  return true;
}
