// AMOREAD 공통 화면 부품: 선택지를 묻는 확인창, 버튼이 있는 알림
import { $, closeModal, esc, openModal } from '../core.js';

// 확인창: 고른 버튼의 값을 돌려준다. 바깥을 누르거나 Esc로 닫으면 null
// options: [{ label, value, primary?, danger? }]
export function ask(title, body, options) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; obs.disconnect(); closeModal(); resolve(v); };
    openModal(`<h2>${esc(title)}</h2>${body ? `<div class="am-ask-body">${body}</div>` : ''}
      <div class="foot am-ask-foot">${options.map((o, i) => `<button class="btn ${o.primary ? 'primary' : ''} ${o.danger ? 'danger' : ''}" data-ask="${i}">${esc(o.label)}</button>`).join('')}</div>`,
    m => {
      m.querySelector('.am-ask-foot').addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (b) finish(options[+b.dataset.ask].value); });
      m.querySelector('[data-ask]')?.focus();
    });
    // 다른 방법(Esc, 바깥 누르기)으로 닫히면 null
    const wrap = $('#modal');
    const obs = new MutationObserver(() => { if (wrap.classList.contains('hidden')) { obs.disconnect(); if (!done) { done = true; resolve(null); } } });
    obs.observe(wrap, { attributes: true, attributeFilter: ['class'] });
  });
}

// 버튼이 있는 알림 (화면 아래). actions: [{ label, run }]
let timer = null;
export function notify(msg, actions = [], ms = 7000) {
  let el = $('#amToast');
  if (!el) { el = document.createElement('div'); el.id = 'amToast'; el.className = 'am-toast hidden'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.innerHTML = `<span class="am-toast-msg">${esc(msg)}</span>${actions.map((a, i) => `<button class="btn sm" data-ta="${i}">${esc(a.label)}</button>`).join('')}<button class="btn ghost sm" data-ta="x" aria-label="알림 닫기">닫기</button>`;
  el.classList.remove('hidden');
  el.onclick = e => {
    const b = e.target.closest('[data-ta]'); if (!b) return;
    el.classList.add('hidden');
    if (b.dataset.ta !== 'x') actions[+b.dataset.ta].run();
  };
  clearTimeout(timer); timer = setTimeout(() => el.classList.add('hidden'), ms);
}
