// 수집해 둔 페이지(그려서 저장한 HTML+CSS)를 화면 안에 격리해 그리는 공용 도구 (레퍼런스 화면·구성 추천 화면이 같이 쓴다)
// - 페이지마다 한 번만 받아 풀어 두고(캐시), 구좌 잘라 보기는 화면에 보일 때만 하나씩 그린다 (한꺼번에 그리면 느려서)
// - 섀도 DOM + CSSOM 스타일시트: 화면 보안 설정(CSP)을 풀지 않고 칸(iframe) 없이 어느 브라우저에서나 보인다
const Cap = (() => {
  const cache = new Map(), W = 390;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function load(id) {
    if (!cache.has(id)) {
      cache.set(id, v2api('/api/am/ai/capture?id=' + encodeURIComponent(id)).then(d => {
        // 태그 안 style="…"을 파싱하는 순간 CSP가 위반으로 기록한다(막히지는 않지만 콘솔에 수백 줄) → 파싱 전에 다른 이름으로 바꿔 두었다가 아래에서 CSSOM으로 입힌다
        const safe = String(d.html || '').replace(/<style\b/gi, '<script type="text/x-css"').replace(/<\/style\s*>/gi, '</script>')   // <style> 요소도 파싱만으로 CSP 위반이 기록되므로 실행되지 않는 글 덩어리로 바꿔 둔다
          .replace(/(\s)style\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, sp, q, a, b) => `${sp}data-sty="${String(a ?? b).replace(/"/g, '&quot;')}"`);
        const doc = new DOMParser().parseFromString(safe, 'text/html');
        const css = [...doc.querySelectorAll('script[type="text/x-css"]')].map(x => x.textContent).join('\n'); doc.querySelectorAll('script[type="text/x-css"]').forEach(x => x.remove());
        const noUrl = v => v.replace(/url\(\s*(['"]?)(?!data:|#)[^)]*?\1\s*\)/gi, 'url("data:,")');
        const sty = []; doc.body.querySelectorAll('[data-sty]').forEach(e => { e.dataset.cs = sty.length; sty.push(noUrl(e.getAttribute('data-sty'))); e.removeAttribute('data-sty'); });
        doc.querySelectorAll('img,source,video,audio,image,use,link').forEach(e => ['src', 'srcset', 'poster', 'href', 'xlink:href'].forEach(a => { if (/^(?!data:|#|\s*$)/i.test(e.getAttribute(a) || '')) e.removeAttribute(a); }));   // 이미지 파일은 저장하지 않으므로 바깥 주소는 지운다 (회색 자리만 보임)
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css.replace(/url\(\s*(['"]?)(?!data:|#)[^)]*?\1\s*\)/gi, 'url("data:,")')   // 이미지·글꼴 주소는 모두 비운다: 파일을 저장하지 않아 어차피 안 뜨고, 남겨 두면 바깥 주소는 CSP 오류로, 안쪽 주소(/kr/…)는 우리 서버 404로 콘솔에 쌓인다
          .replace(/:root/g, ':host').replace(/(^|[},\s])html(?=[\s,{.:#\[>+~])/g, '$1:host').replace(/(^|[},\s])body(?=[\s,{.:#\[>+~])/g, '$1.cbody'));
        return { doc, sty, sheet };
      }).catch(e => { cache.delete(id); throw e; }));
    }
    return cache.get(id);
  }
  async function mount(host, id) {
    const c = await load(id);
    const sh = host.shadowRoot || host.attachShadow({ mode: 'open' });
    sh.adoptedStyleSheets = [c.sheet];
    const wrap = document.createElement('div'); wrap.className = `cbody ${c.doc.body.className}`;
    wrap.append(...[...c.doc.body.childNodes].map(n => document.importNode(n, true)));
    sh.replaceChildren(wrap);
    wrap.querySelectorAll('[data-cs]').forEach(e => { e.style.cssText = c.sty[+e.dataset.cs]; });
  }
  const px = (el, o) => { for (const [a, v] of Object.entries(o)) el.style[a] = v + 'px'; };   // 위치·크기는 CSSOM으로 (태그 안 style 금지)
  // 원본 구좌 하나(세로 y~y+h)만 잘라 틀(el)에 맞춰 보여 준다. 가로를 틀에 맞추고, 구좌가 틀보다 길면 위쪽부터 보인다
  async function crop(el, id, y, h) {
    const bw = el.clientWidth, bh = el.clientHeight; if (!bw || !bh) return;
    const s = bw / W, hh = Math.min(h * s, bh);
    const clip = document.createElement('span'); clip.className = 'cclip'; px(clip, { width: bw, height: hh, top: (bh - hh) / 2 });
    const inner = document.createElement('span'); inner.className = 'cinner'; px(inner, { width: W });
    clip.append(inner); el.append(clip);
    const c = await load(id), part = await slice(id, c, y, h);
    const sh = inner.shadowRoot || inner.attachShadow({ mode: 'open' }); sh.adoptedStyleSheets = [c.sheet];
    if (!part) { inner.style.transform = `scale(${s}) translateY(${-y}px)`; await mount(inner, id); el.style.background = '#fff'; return; }
    sh.replaceChildren(part.wrap);
    part.wrap.querySelectorAll('[data-cs]').forEach(e => { e.style.cssText = c.sty[+e.dataset.cs]; });
    const first = part.wrap.querySelector('[data-first]'), ir = inner.getBoundingClientRect();
    const top = first.getBoundingClientRect().top - ir.top;   // 앞 형제를 뺀 만큼 올라간 자리 (아직 크기 변환 전이라 원래 px)
    inner.style.transform = `scale(${s}) translateY(${-(top + y - part.top)}px)`;
    el.style.background = '#fff';   // 그려진 뒤에야 밑그림(글 카드)을 가린다
  }
  // 구좌 하나만 그리기: 페이지를 화면 밖에 한 번 그려 요소마다 세로 위치를 재 두고(페이지당 한 번), 구좌 띠(y~y+h)에 걸친 요소만 남긴 사본을 만든다.
  // 예전엔 크롭마다 페이지 전체(요소 수천 개)를 그려 크롭 하나에 50ms 넘게 걸리고 스크롤할수록 화면이 무거워졌다. 못 줄이면 null → 전체를 그린다
  const geo = new Map();
  async function measure(id, c) {
    if (!geo.has(id)) geo.set(id, (async () => {
      const host = document.createElement('div');
      host.style.position = 'absolute'; host.style.left = '-9999px'; host.style.top = '0'; host.style.width = W + 'px'; host.style.visibility = 'hidden'; host.style.contain = 'layout paint';
      document.body.append(host);
      try {
        const sh = host.attachShadow({ mode: 'open' }); sh.adoptedStyleSheets = [c.sheet];
        const wrap = document.createElement('div'); wrap.className = `cbody ${c.doc.body.className}`;
        wrap.append(...[...c.doc.body.childNodes].map(n => document.importNode(n, true))); sh.append(wrap);
        wrap.querySelectorAll('[data-cs]').forEach(e => { e.style.cssText = c.sty[+e.dataset.cs]; });
        const hr = host.getBoundingClientRect(), src = [...c.doc.body.querySelectorAll('*')], out = [...wrap.querySelectorAll('*')], pos = new Map();
        if (src.length !== out.length) return null;
        out.forEach((e, i) => { const r = e.getBoundingClientRect(); pos.set(src[i], [r.top - hr.top, r.bottom - hr.top, r.height > 0 || r.width > 0]); });
        return pos;
      } catch (e) { return null; } finally { host.remove(); }
    })());
    return geo.get(id);
  }
  // 구좌 글로 원본 화면 속 위치(y·h) 찾기: 띠에 제목이 연결되지 않은 페이지, 같은 제목 구좌가 여럿인 페이지에서 '이 구좌 위치'를 표시할 때 쓴다
  async function locate(id, text, tl) {
    const c = await load(id), t = findEl(c, text, tl); if (!t) return null;
    const pos = await measure(id, c), p = pos && pos.get(t);
    return p && p[1] - p[0] >= 24 ? { y: p[0], h: p[1] - p[0] } : null;
  }
  async function slice(id, c, y, h) {
    const pos = await measure(id, c); if (!pos) return null;
    const y2 = y + h, hit = n => { const p = pos.get(n); return p && p[2] && p[1] > y && p[0] < y2; };
    let node = c.doc.body;
    for (;;) {   // 띠를 혼자 다 덮는 자식이 있으면 그 안으로 내려간다
      const kids = [...node.children].filter(hit);
      if (kids.length !== 1) break;
      const p = pos.get(kids[0]); if (p[0] > y + 1 || p[1] < y2 - 1) break;
      node = kids[0];
    }
    const kids = [...node.children], idx = kids.map((k, i) => (hit(k) ? i : -1)).filter(i => i >= 0);
    if (!idx.length || node === c.doc.body && idx.length === kids.length) return null;
    const keep = kids.slice(idx[0], idx[idx.length - 1] + 1);
    const path = []; for (let n = node; n && n !== c.doc.body; n = n.parentElement) path.unshift(n);
    const wrap = document.createElement('div'); wrap.className = `cbody ${c.doc.body.className}`; let cur = wrap;
    path.forEach(n => { const k = document.importNode(n, false); cur.append(k); cur = k; });
    keep.forEach((n, i) => { const k = document.importNode(n, true); if (!i) k.setAttribute('data-first', ''); cur.append(k); });
    return { wrap, top: pos.get(keep[0])[0] };
  }

  // ---- 요소 단위 잘라 보기: 위치(y)로 못 자르는 구좌(옆으로 넘기는 슬라이드, 쪼개진 상품 목록)용 ----
  // 저장된 HTML에서 구좌 글이 들어 있는 가장 작은 요소를 찾고, 글 길이가 구좌와 비슷해질 때까지 위로 올라가 그 요소만 그린다
  const tcache = new Map();
  function texts(c) {   // 요소별 공백 뺀 글 (페이지당 한 번 계산)
    if (!tcache.has(c)) {
      const m = new Map(), walk = n => { if (n.nodeType === 3) return nz(n.nodeValue); if (n.nodeType !== 1) return ''; let t = ''; for (const k of n.childNodes) t += walk(k); m.set(n, t); return t; };
      walk(c.doc.body); tcache.set(c, m);
    }
    return tcache.get(c);
  }
  function findEl(c, text, tl) {
    // 구좌 글은 '제목. 제목 본문…'처럼 제목이 겹쳐 있어 앞 글이 저장본과 다를 수 있다 → 글 앞부분의 여러 구간(조각) 중 하나라도 들어 있는 가장 안쪽 요소를 쓴다
    const full = nz(text); if (full.length < 5 || (tl || 0) < 12) return null;   // '더보기' 같은 짧은 라벨은 잘라 봐야 의미가 없다
    const keys = [...new Set([full.slice(0, 24), full.slice(full.length > 40 ? Math.floor(full.length / 2) - 10 : 0, full.length > 40 ? Math.floor(full.length / 2) + 10 : 0), full.slice(-16)].filter(k => k.length >= 5))];
    const m = texts(c); let best = null;
    for (const k of keys) { for (const [el, t] of m) { if (!t.includes(k)) continue; if (!best || t.length < m.get(best).length) best = el; } if (best) break; }   // 가장 짧은 글을 가진 = 가장 안쪽
    if (!best) return null;
    const want = Math.max((tl || 0) * 0.85, full.length), cap = want * 2.2 + 80;
    while (m.get(best).length < want * 0.9) {   // 글이 구좌만큼 될 때까지 위로. 다른 구좌까지 섞이기 직전에서 멈춘다 (가능한 만큼만 보여 줌)
      const up = best.parentElement; if (!up || up === c.doc.body || m.get(up).length > cap) break; best = up;
    }
    return m.get(best).length > cap ? null : best;
  }
  function pruned(c, target) {   // 조상 껍데기(클래스)는 남겨 CSS가 그대로 먹게 하고, 형제는 뺀다. 조상의 인라인 스타일(슬라이드 이동 등)은 버린다
    const path = []; for (let n = target; n && n !== c.doc.body; n = n.parentElement) path.unshift(n);
    const wrap = document.createElement('div'); wrap.className = `cbody ${c.doc.body.className}`; let cur = wrap;
    path.forEach((n, i) => { const k = i === path.length - 1 ? document.importNode(n, true) : document.importNode(n, false); if (i === path.length - 1) k.setAttribute('data-target', ''); if (i < path.length - 1) k.removeAttribute('data-cs'); cur.append(k); cur = k; });
    return wrap;
  }
  async function cropEl(el, id, text, tl) {
    const c = await load(id), bw = el.clientWidth, bh = el.clientHeight; if (!bw || !bh) return;
    const t = findEl(c, text, tl); if (!t) throw new Error('no match');
    const s = bw / W, clip = document.createElement('span'); clip.className = 'cclip'; px(clip, { width: bw, height: bh });
    const inner = document.createElement('span'); inner.className = 'cinner'; px(inner, { width: W }); inner.style.transform = `scale(${s})`;
    clip.append(inner); el.append(clip);
    const sh = inner.attachShadow({ mode: 'open' }); sh.adoptedStyleSheets = [c.sheet];
    const wrap = pruned(c, t); sh.replaceChildren(wrap);
    wrap.querySelectorAll('[data-cs]').forEach(e => { e.style.cssText = c.sty[+e.dataset.cs]; });
    const tr = wrap.querySelector('[data-target]').getBoundingClientRect(), ir = inner.getBoundingClientRect();
    const top = (tr.top - ir.top) / s, h = tr.height / s;
    if (h < 24) throw new Error('empty');
    inner.style.transform = `scale(${s}) translateY(${-top}px)`;
    const vh = Math.min(h * s, bh); px(clip, { height: vh }); clip.style.top = (bh - vh) / 2 + 'px'; el.style.background = '#fff';
  }
  // 구좌 하나의 칸 수(가로로 나란한 카드 수)를 수집한 화면을 실제로 그려 재 본다 (수집 때 잰 값은 6에서 잘려 있어 쓸 수 없다)
  async function cols(id, y, h) {
    const c = await load(id), host = document.createElement('div');
    host.style.position = 'absolute'; host.style.left = '-9999px'; host.style.top = '0'; host.style.width = W + 'px'; host.style.visibility = 'hidden';
    document.body.append(host);
    try {
      const sh = host.attachShadow({ mode: 'open' }); sh.adoptedStyleSheets = [c.sheet];
      const wrap = document.createElement('div'); wrap.className = `cbody ${c.doc.body.className}`;
      wrap.append(...[...c.doc.body.childNodes].map(n => document.importNode(n, true))); sh.append(wrap);
      wrap.querySelectorAll('[data-cs]').forEach(e => { e.style.cssText = c.sty[+e.dataset.cs]; });
      const hr = host.getBoundingClientRect(), rows = new Map();
      wrap.querySelectorAll('*').forEach(e => {
        const q = e.getBoundingClientRect(), top = q.top - hr.top;
        if (top < y - 2 || top > y + h - 20 || q.width < 50 || q.width > W * 0.6 || q.height < 60) return;
        const k = Math.round(top / 8); if (!rows.has(k)) rows.set(k, new Set()); rows.get(k).add(Math.round((q.left - hr.left) / 12));
      });
      let best = 1; rows.forEach(set => { if (set.size > best) best = set.size; });
      return Math.min(best, 4);
    } finally { host.remove(); }
  }
  // 목록 안의 [data-crop] 칸을 화면에 보일 때만 하나씩 그린다. 실패하면 칸을 비워 밑그림(구성도)이 그대로 보이게 한다
  const queue = []; let busy = false;
  async function pump() {
    if (busy) return; busy = true;
    while (queue.length) {
      const el = queue.shift(); if (!el.isConnected || el.dataset.done) continue;
      const r = el.getBoundingClientRect();   // 줄 서 있는 사이 화면에서 멀리 벗어났으면(빨리 내려간 경우) 그리지 않고 다시 보일 때 줄을 세운다
      if (io && (r.bottom < -900 || r.top > innerHeight + 900)) { io.observe(el); continue; }
      el.dataset.done = '1';
      try { if (el.dataset.y !== undefined) await crop(el, el.dataset.id, +el.dataset.y, +el.dataset.h); else await cropEl(el, el.dataset.id, el.dataset.t, +el.dataset.n); } catch (e) { el.querySelector('.cclip')?.remove(); }
      await new Promise(r => setTimeout(r, 15));
    }
    busy = false;
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target); } }); pump(); }, { rootMargin: '200px' }) : null;
  function lazy(root = document) { root.querySelectorAll('[data-crop]:not([data-done])').forEach(el => { if (io) io.observe(el); else { queue.push(el); } }); if (!io) pump(); }
  // 원본 전체 페이지 + 구좌 띠 박스. mark = 강조할 구좌 이름(구좌 제목)
  async function whole(host, id, layout, mark, sx) {   // sx = {t: 구좌 글 앞부분, n: 글 길이} — 띠로 못 찾을 때 글로 자리를 찾는다
    const mb = band(layout, mark), bands = (layout.bands || []).filter(b => b.h >= 8 && (b.st || b.role || b === mb)), n = { i: 0 };
    host.innerHTML = `<div class="wv"><div class="wvf" aria-label="수집 당시 화면"></div>${bands.map(b => { const tag = b.st || b.role; n.i++; const used = mb && b === mb;
      return `<div class="wb ${used ? 'used' : ''}" data-y="${b.y}" data-h="${b.h}"><div class="wbt"><span>${n.i}. ${esc(String(tag).slice(0, 22))}</span>${used ? '<b class="here">가져온 구좌</b>' : ''}</div></div>`; }).join('')}</div>`;
    const wv = host.querySelector('.wv'), f = host.querySelector('.wvf'); px(wv, { height: layout.ph }); px(f, { height: layout.ph });
    host.querySelectorAll('.wb').forEach(e => px(e, { top: +e.dataset.y, height: +e.dataset.h }));
    try { await mount(f, id); } catch (e) { f.textContent = `화면을 불러오지 못했어요: ${e.message}`; }
    if (mark && !mb && sx?.t) {
      const at = await locate(id, sx.t, sx.n || 0).catch(() => null);
      if (at && wv.isConnected) { wv.insertAdjacentHTML('beforeend', `<div class="wb used"><div class="wbt"><span>${esc(String(mark).slice(0, 22))}</span><b class="here">가져온 구좌</b></div></div>`); px(wv.lastElementChild, { top: at.y, height: at.h }); }
    }
    host.querySelector('.wb.used')?.scrollIntoView({ block: 'center' });
  }
  // 구좌 제목이 띠에 연결돼 있으면 그 띠, 아니면 띠의 앞쪽 글에 제목·본문 첫머리가 들어 있는 띠 (연결이 빠진 구좌용)
  const nz = t => String(t || '').toLowerCase().replace(/[^0-9a-z\u3131-\u318e\uac00-\ud7a3]/g, '');   // 공백·기호·대소문자 차이는 무시
  function band(layout, title, text) {
    const bs = (layout?.bands || []).filter(b => b.h >= 8); if (!bs.length) return null;
    const hit = bs.find(b => title && b.st === title); if (hit) return hit;
    const t = nz(title).slice(0, 10), x = nz(text).slice(0, 14), taken = new Set(bs.filter(b => b.st).map(b => b.st));
    if (taken.has(title)) return null;
    return bs.find(b => !b.st && b.txt && ((t.length >= 4 && nz(b.txt).includes(t)) || (x.length >= 8 && nz(b.txt).includes(x)))) || null;
  }
  return { mount, crop, cropEl, cols, lazy, whole, band, load, locate };
})();
