// 끌어서 순서 바꾸기 (디자이너 v2.5.1 D-053 규칙을 우리 코드로 옮김)
// - 손잡이([data-drag])를 누르고 5px 넘게 움직이면 시작. 항목은 [data-sort-id]
// - 놓을 자리: 끄는 항목을 뺀 형제들의 화면 중간점 기준 앞·뒤 (삽입선은 .drop-before/.drop-after)
// - 목록 밖에 놓거나, Esc, 포인터 취소, 창 전환이면 취소. 목록 경계 64px 안에서는 자동 스크롤
// - 키보드: 손잡이에 초점을 두고 Alt+↑/↓
import { esc } from '../core.js';

export function sortable(box, { onMove, onStep, nameOf = () => '구좌', onCancel = () => {} }) {
  let d = null, raf = 0, suppress = false;
  const items = () => [...box.querySelectorAll('[data-sort-id]')];
  const clear = () => items().forEach(el => el.classList.remove('drop-before', 'drop-after'));
  const target = (x, y) => {
    const r = box.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top - 24 || y > r.bottom + 24) return null;
    const list = items().filter(el => el.dataset.sortId !== d.id).map(el => ({ el, r: el.getBoundingClientRect() }));
    if (!list.length) return null;
    const next = list.find(it => y < it.r.top + it.r.height / 2);
    const it = next || list[list.length - 1];
    return { el: it.el, id: it.el.dataset.sortId, after: !next };
  };
  const paint = () => {
    clear();
    const t = target(d.x, d.y);
    if (t) t.el.classList.add(t.after ? 'drop-after' : 'drop-before');
    d.ghost.style.left = `${Math.min(d.x + 16, innerWidth - 220)}px`;
    d.ghost.style.top = `${Math.min(d.y + 16, innerHeight - 60)}px`;
    d.ghost.classList.toggle('invalid', !t);
    d.ghost.lastChild.textContent = t ? '놓으면 이 위치로 옮겨요' : '목록 안에 놓아 주세요';
  };
  const tick = () => {
    if (!d) return;
    if (d.moved) {
      const sc = box.scrollHeight > box.clientHeight + 1 ? box : null;
      const top = sc ? sc.getBoundingClientRect().top : 0, bottom = sc ? sc.getBoundingClientRect().bottom : innerHeight, edge = 64;
      const dy = d.y - top < edge ? -Math.max(2, Math.min(12, (edge - (d.y - top)) / 5))
        : bottom - d.y < edge ? Math.max(2, Math.min(12, (edge - (bottom - d.y)) / 5)) : 0;
      if (dy) { if (sc) sc.scrollTop += dy; else window.scrollBy(0, dy); paint(); }
    }
    raf = requestAnimationFrame(tick);
  };
  const move = e => {
    if (!d || e.pointerId !== d.pointer) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.moved && Math.hypot(d.x - d.sx, d.y - d.sy) > 5) {
      d.moved = true; d.src.classList.add('drag-src'); document.body.classList.add('am-sorting');
      d.ghost = document.createElement('div'); d.ghost.className = 'am-drag-ghost'; d.ghost.setAttribute('aria-hidden', 'true');
      d.ghost.innerHTML = `<b>${esc(nameOf(d.id))}</b><small></small>`;
      document.body.appendChild(d.ghost);
    }
    if (d.moved) { e.preventDefault(); paint(); }
  };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); end({}, true); } };
  const onUp = e => end(e), onPtrCancel = e => end(e, true), onBlur = () => end({}, true);
  const off = () => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onPtrCancel); document.removeEventListener('keydown', onKey); window.removeEventListener('blur', onBlur);
  };
  function end(e, cancel = false) {
    if (!d || (e.pointerId !== undefined && e.pointerId !== d.pointer)) return;
    const t = !cancel && d.moved ? target(e.clientX, e.clientY) : null;
    const x = d; d = null;
    cancelAnimationFrame(raf); off(); clear();
    x.ghost?.remove(); x.src.classList.remove('drag-src'); document.body.classList.remove('am-sorting');
    if (x.moved) { suppress = true; setTimeout(() => { suppress = false; }, 150); }
    if (t) onMove(x.id, t.id, t.after);
    else if (x.moved) onCancel();
  }
  box.addEventListener('pointerdown', e => {
    const h = e.target.closest('[data-drag]');
    if (!h || e.button !== 0 || d) return;
    e.preventDefault();
    d = { id: h.dataset.drag, pointer: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, ghost: null, src: h.closest('[data-sort-id]') || h };
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onPtrCancel); document.addEventListener('keydown', onKey); window.addEventListener('blur', onBlur);
    raf = requestAnimationFrame(tick);
  });
  // 끌고 난 직후의 클릭은 '선택'으로 처리하지 않는다
  box.addEventListener('click', e => { if (suppress) { suppress = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  box.addEventListener('keydown', e => {
    const h = e.target.closest('[data-drag]');
    if (h && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); onStep(h.dataset.drag, e.key === 'ArrowUp' ? -1 : 1); }
  });
}
