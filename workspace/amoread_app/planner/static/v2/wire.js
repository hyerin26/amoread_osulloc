// 추출해 둔 레퍼런스 와이어프레임(planner/data/wireframes)을 화면 안에 그려 주는 공용 도구 (구좌 편집이 쓴다)
// - 구조 데이터는 서버(/api/am/ai/wire)에서 구좌 하나씩 받아 캐시한다. 구좌에는 {site, sec} 참조와 요약만 저장하고 요소는 저장하지 않는다 (공유 파일이 원본)
// - 화면 보안 설정(CSP) 때문에 태그 안 style은 못 쓰므로, 위치·크기는 요소를 만든 뒤 CSSOM(el.style)으로 넣는다
const Wire = (() => {
  const cache = new Map(), BODY = 300;
  const key = (site, sec) => `${site}|${sec}`;
  function get(site, sec) {
    const k = key(site, sec);
    if (!cache.has(k)) cache.set(k, v2api(`/api/am/ai/wire?site=${encodeURIComponent(site)}&sec=${sec}`).catch(e => { cache.delete(k); throw e; }));
    return cache.get(k);
  }
  const px = (el, o, s) => { for (const [a, v] of Object.entries(o)) el.style[a] = (v * s) + 'px'; };
  const mk = (cls, o, s, text) => { const d = document.createElement('span'); d.className = cls; px(d, o, s); if (text) d.textContent = text; return d; };
  // 글 종류 → 칸에 쓰는 이름 (원문은 옮기지 않고, 어떤 글이 들어가는 자리인지만 보여 준다)
  const TXT = { title: '제목 텍스트', body: '본문 텍스트', caption: '작은 글씨', name: '상품명', brand: '브랜드명', price: '가격', discount: '할인율', badge: '배지 문구', button: '버튼 문구' };
  // 요소 목록 d({w,h,y,elements})를 host(폭 width px)에 그린다. 글은 '텍스트' 칸으로, 이미지는 '이미지' 칸으로, 버튼·상자는 윤곽으로 (구조만 보이게)
  function paint(host, d, width) {
    const bw = d.w || BODY, w = width || host.clientWidth || bw, s = w / bw;
    host.classList.remove('wf-err'); host.replaceChildren();
    host.style.height = Math.max(24, d.h * s) + 'px';
    for (const e of d.elements) {
      if (e.off) continue;                                  // 옆으로 넘겨야 보이는 칸은 그리지 않는다
      const y = e.y - (d.y || 0); if (y + e.h < 0 || y > d.h) continue;
      if (e.t === 'img') {
        const box = mk('wf-i' + (e.w >= bw - 6 ? ' full' : ''), { left: e.x, top: y, width: e.w, height: e.h }, s);
        const small = e.w * s < 34 || e.h * s < 20;
        if (!small) { const lb = document.createElement('b'); lb.textContent = e.label && !/^이미지$/.test(e.label) ? e.label : '이미지'; box.append(lb); }
        host.append(box);
      } else if (e.t === 'pn') host.append(mk('wf-p k-' + (e.k || 'box'), { left: e.x, top: y, width: e.w, height: e.h }, s));
      else {                                                // 글: 어떤 글인지 이름을 붙인 칸 (글자 크기 = 위계, 줄 수만큼 반복)
        const fs = e.fs || 10, fsz = Math.max(6.5, Math.min(fs * s, 22)), lh = Math.max(fsz * 1.25, fs * s * 1.2);
        const lines = e.one ? 1 : Math.max(1, Math.min(8, Math.round(e.h / (fs * 1.25)))), name = TXT[e.k] || '텍스트';
        const t = mk('wf-t' + (e.fw >= 600 ? ' b' : '') + (e.k === 'title' ? ' ti' : '') + (e.one ? ' one' : ''), { left: e.x, top: y, width: e.w, height: Math.max(e.h, fs * 1.1) }, s);
        t.style.fontSize = fsz + 'px'; t.style.lineHeight = lh + 'px';
        if (e.al === 'center') t.style.textAlign = 'center'; else if (e.al === 'right') t.style.textAlign = 'right';
        t.textContent = e.one ? name : Array.from({ length: lines }, () => name).join(' ');
        host.append(t);
      }
    }
    return d;
  }
  async function draw(host, ref, width) {
    let d; try { d = await get(ref.site, ref.sec); } catch (e) { host.replaceChildren(); host.classList.add('wf-err'); host.textContent = '구조를 불러오지 못했어요'; return null; }
    return paint(host, d, width);
  }
  // 수집해 둔 화면에서 구조를 자동으로 뽑아 그린다 (추출된 와이어프레임이 없는 레퍼런스용)
  async function drawAuto(host, at, width) {
    let d; try { d = await Cap.skeleton(at.id, at); } catch (e) { host.replaceChildren(); host.classList.add('wf-err'); host.textContent = `이 구좌의 구조를 뽑지 못했어요 (${e.message === 'no match' ? '수집 화면에서 구좌 자리를 못 찾았어요' : e.message})`; return null; }
    paint(host, d, width); return d;
  }
  // [data-wf="사이트|구좌"] 칸을 그린다 (innerHTML로 칸만 넣은 뒤 부른다)
  function lazy(root = document) {
    root.querySelectorAll('[data-wf]:not([data-done])').forEach(el => {
      el.dataset.done = '1'; const [site, sec] = el.dataset.wf.split('|');
      draw(el, { site, sec: +sec }, el.clientWidth || BODY);
    });
  }
  // [data-sk] 칸: 수집 화면에서 구조 자동 추출 (data-id 페이지, data-y·data-h 또는 data-t·data-n 구좌 자리)
  function skLazy(root = document) {
    root.querySelectorAll('[data-sk]:not([data-done])').forEach(el => {
      el.dataset.done = '1';
      drawAuto(el, { id: el.dataset.id, y: el.dataset.y, h: el.dataset.h, t: el.dataset.t, n: el.dataset.n }, el.clientWidth || BODY).then(d => {
        const note = el.parentElement?.querySelector('.sk-note');
        if (d && note && d.share >= 0.85) note.textContent = '이 구좌는 거의 이미지 한 장(또는 이미지 슬라이드)이에요. 이미지 속 글자는 읽지 못해 구조가 단순하게 보여요';
        else if (d && note && !d.elements.length) note.textContent = '구조로 뽑을 요소를 찾지 못했어요';
        if (d && note && d.cut) note.textContent = `구좌가 길어서 (약 ${d.full}px) 앞부분만 보여 줘요. ` + note.textContent;
      });
    });
  }
  return { get, draw, paint, drawAuto, lazy, skLazy };
})();
