// AMOREAD 새 버전 공통 틀: 상품·할인의 [← 원래 단계로]
document.addEventListener('click', e => {
  if (!e.target.closest('[data-v2back]')) return;
  if (document.referrer && new URL(document.referrer).origin === location.origin) history.back();
  else location.assign('/v2/editor');
});

// 고정 머리막대(윗줄 + 기획안 막대) 높이 → CSS 변수 --v2-head-h (2026-11-10)
// 고정 패널·'그 구좌로 이동'이 막대 밑에 가리지 않게. 좁은 화면에서 기획안 막대가 고정이 아니면 윗줄만 셈
(() => {
  const top = document.querySelector('.v2top'), plan = document.querySelector('.v2plan');
  const set = () => {
    const h = (top?.offsetHeight || 0) + (plan && getComputedStyle(plan).position === 'sticky' ? plan.offsetHeight : 0);
    document.documentElement.style.setProperty('--v2-head-h', `${h}px`);
  };
  set(); addEventListener('resize', set);
  if (window.ResizeObserver) { const ro = new ResizeObserver(set); [top, plan].forEach(el => el && ro.observe(el)); }
})();

// 기획안 막대의 [다음: …] 하나로 앞으로 간다 (2026-11-10 길잡이 정리).
// 화면마다 원래 있던 다음 버튼(#nextBtn: 저장 마치기·반영 안 한 할인 확인 등)을 대신 눌러 같은 동작을 쓴다. 화면 안의 그 버튼은 CSS로 숨김.
// plan.js의 '저장 기다렸다 이동' 처리보다 먼저 받아서 두 번 이동하지 않게 한다.
document.addEventListener('click', e => {
  const nb = e.target.closest('.v2plan .v2next');
  if (!nb || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const inPage = document.querySelector('.v2plan ~ main #nextBtn');
  if (!inPage) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  inPage.click();
}, true);

// 글자 아이콘 → SVG 아이콘 한 벌 (2026-11-10, v2.5.1: 24×24, 선 1.75, 둥근 끝).
// 버튼·링크 안에서 글 맨 앞/맨 뒤에 붙은 기호만 바꾼다 (본문의 '34,000 → 26,180', '5일 × 4자리' 같은 글은 그대로).
// 화면 JS가 다시 그려도 새로 생긴 버튼에 계속 적용. 기호뿐인 버튼에 이름이 없으면 이름(aria-label)을 붙인다.
(() => {
  const P = {
    '↑': '<path d="M12 19V5M6 11l6-6 6 6"/>', '↓': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    '←': '<path d="M19 12H5M11 6l-6 6 6 6"/>', '→': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    '✕': '<path d="M6 6l12 12M18 6L6 18"/>', '+': '<path d="M12 5v14M5 12h14"/>',
    '★': '<path class="fill" d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/>',
    '☆': '<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/>',
    '✦': '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/>',
    '▾': '<path d="M6 9l6 6 6-6"/>', '▸': '<path d="M9 6l6 6-6 6"/>', '›': '<path d="M9 6l6 6-6 6"/>',
  };
  const NAME = { '↑': '위로', '↓': '아래로', '✕': '닫기', '★': '즐겨찾기 해제', '☆': '즐겨찾기', '+': '추가' };
  const LEAD = /^(\s*)([↑↓←✕★☆✦+])(?=\s|$)\s*/, TAIL = /\s*([→▾▸›])(\s*)$/;
  const svg = (g, kind) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.setAttribute('class', `v2ic ${kind}`); s.innerHTML = P[g]; return s; };
  const fix = tn => {
    const el = tn.parentElement;
    if (!el || el.closest('svg, textarea, input, select, [contenteditable], .v2ic')) return;
    const host = el.closest('button, a, [role="button"], summary');
    if (!host) return;
    let t = tn.nodeValue, m;
    if ((m = LEAD.exec(t)) && P[m[2]]) {
      const g = m[2]; tn.nodeValue = t.slice(m[0].length);
      const solo = !host.textContent.trim();
      el.insertBefore(svg(g, solo ? 'v2ic-solo' : 'v2ic-l'), tn);
      if (solo && !host.getAttribute('aria-label')) host.setAttribute('aria-label', host.title || NAME[g] || '');
      t = tn.nodeValue;
    }
    if ((m = TAIL.exec(t)) && P[m[1]]) { tn.nodeValue = t.slice(0, m.index); el.insertBefore(svg(m[1], 'v2ic-r'), tn.nextSibling); }
  };
  const scan = root => {
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (/[↑↓←→✕★☆✦+▾▸›]/.test(n.nodeValue) ? 1 : 3) });
    const list = []; while (w.nextNode()) list.push(w.currentNode);
    list.forEach(fix);
  };
  scan(document.body);
  new MutationObserver(ms => ms.forEach(m => { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(scan); }))
    .observe(document.body, { childList: true, subtree: true, characterData: true });
})();

// 데이터 출처 표시 (2026-11-10): 화면 위 노란 안내 띠(.demo) 대신 윗줄에 '실제 데이터 / 일부 예시 / 예시 데이터'.
// 누르면 원래 안내 문구가 작은 창으로 열린다. 화면 JS가 안내 문구를 바꾸면(innerHTML) 표시도 따라 바뀐다.
(() => {
  const demo = document.querySelector('.demo');
  const host = document.querySelector('.v2top .v2grow');
  if (!demo || !host) return;
  demo.id = demo.id || 'v2demo';
  demo.classList.add('v2pop');
  demo.setAttribute('role', 'dialog');
  demo.setAttribute('aria-label', '이 화면의 데이터 출처');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'v2src';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', demo.id);
  host.after(btn);
  const label = () => {
    // 굵은 첫 문장이 '예시 화면이에요'면 예시, 아니면 실제. 나머지 문구에 예시·연결 전이 섞이면 '일부 예시'
    const lead = ((demo.querySelector('b') || {}).textContent || '').trim();
    const rest = (demo.textContent || '').replace(lead, '');
    const kind = /예시|가상/.test(lead) ? 'demo' : /예시|가상|연결 전|연결되지|아직/.test(rest) ? 'mix' : 'real';
    btn.dataset.kind = kind;
    btn.innerHTML = `<span class="dot" aria-hidden="true"></span>${{ real: '실제 데이터', mix: '실제 데이터 · 일부 예시', demo: '예시 데이터' }[kind]}`;
    btn.title = '이 화면의 숫자가 어디서 왔는지 보기';
    btn.setAttribute('aria-label', `데이터 출처: ${{ real: '실제 데이터', mix: '실제 데이터 · 일부 예시', demo: '예시 데이터' }[kind]}`);   // 폰 폭에서는 글자를 숨기고 점만 보여서
  };
  const set = open => { demo.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => set(!demo.classList.contains('open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && demo.classList.contains('open')) { set(false); btn.focus(); } });
  document.addEventListener('click', e => { if (demo.classList.contains('open') && !demo.contains(e.target) && !btn.contains(e.target)) set(false); });
  new MutationObserver(label).observe(demo, { childList: true, characterData: true, subtree: true });
  label();
})();
