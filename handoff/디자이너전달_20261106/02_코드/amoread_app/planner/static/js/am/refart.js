// '기획에 참고할 섹션' (디자이너 v2.5.1 reference-tile·reference-viewer 이식)
// 레퍼런스 섹션을 구성 예시 그림(가상)으로 보여 주고, 크게 보기에서 '선택한 섹션 ↔ 전체 프로모션'을 오간다.
// 보기만으로는 기획안을 바꾸지 않는다. 바꾸는 건 [레이아웃 적용]·[참고로 첨부]를 눌렀을 때만 (제품 맥락: 미리보기/첨부/적용 구분)
import { esc, icon, openModal, closeModal } from '../core.js';
import { byRef, campaignOf } from './sources/references.js';

const kindOf = layout => layout === 'hero' ? 'hero' : layout === 'benefit' || layout === 'deal-banner' ? 'benefit' : ['grid2', 'grid3', 'split'].includes(layout) ? 'grid' : 'story';
export const capability = r => r.applicable && r.layout ? '배치 복사 가능' : '참고자료만 첨부';

// 섹션 하나의 구성 예시. i: 프로모션 안 순서
function sample(title, layout, i, cur = false) {
  const k = kindOf(layout), n = layout === 'grid3' ? 3 : 2;
  return `<div class="am-rs am-rs-${k} ${cur ? 'cur' : ''}"><div class="am-rs-idx">${String(i + 1).padStart(2, '0')} · 섹션 예시</div>
    ${k === 'hero' ? '<div class="am-rs-img am-rs-heroimg">메인 이미지</div>' : ''}
    <div class="am-rs-copy"><strong>${esc(title)}</strong><span class="am-rs-line"></span><span class="am-rs-line short"></span></div>
    ${k === 'grid' ? `<div class="am-rs-grid ${layout === 'split' ? 'split' : ''} ${n === 3 ? 'g3' : ''}">${'<div><div class="am-rs-img">상품 이미지</div><span class="am-rs-line"></span></div>'.repeat(n)}</div>` : ''}
    ${k === 'benefit' ? '<div class="am-rs-benefit">혜택과 조건을 안내하는 영역</div>' : ''}
    ${k === 'story' ? '<div class="am-rs-img am-rs-story">스토리 이미지</div>' : ''}
    <div class="am-rs-cta">버튼 영역</div></div>`;
}
const pos = r => Math.max(0, campaignOf(r.campaign).findIndex(p => p.refId === r.id));

export function refArt(r, mode = 'section') {
  const parts = mode === 'campaign' ? campaignOf(r.campaign) : [{ title: r.title, layout: r.layout, refId: r.id }];
  return `<div class="am-rart" aria-hidden="true"><div class="am-rpage"><div class="am-rbar">OSULLOC <span>구성 예시</span></div>
    ${parts.map((p, i) => sample(p.title, p.layout, mode === 'campaign' ? i : pos(r), mode === 'campaign' && p.refId === r.id)).join('')}</div></div>`;
}

// 타일: 그림 + 섹션 1개 · 원본 캠페인 + 제목 + 참고할 포인트 + 가져올 수 있는 범위
export function refTile(r, extra = '') {
  return `<div class="am-rtile"><button type="button" class="am-rtile-open" data-refopen="${esc(r.id)}" aria-label="${esc(r.title)} 크게 보기">${refArt(r)}
      <span class="am-rart-more">섹션 크게 보기 ${icon('arrow-right')}</span></button>
    <div class="am-rtile-copy"><div class="am-runit">섹션 1개 · ${esc(r.campaign)}</div><h4>${esc(r.title)}</h4>
      <p><b>참고할 포인트</b> ${esc(r.reason)}</p>${r.why ? `<p class="cap">이 구좌와 맞는 점: ${esc(r.why)}</p>` : ''}
      <span class="tag ${r.applicable && r.layout ? 'green' : ''}">${capability(r)}</span>${extra}</div></div>`;
}

// 크게 보기. state: { applied, attached }, on: { apply(r), attach(r) }
export function openRefViewer(id, state, on) {
  let view = 'section';
  const draw = body => {
    const r = byRef(id); if (!r) return;
    const parts = campaignOf(r.campaign), full = view === 'campaign';
    body.innerHTML = `<div class="am-rview"><header class="am-rview-h"><div><div class="am-runit">${esc(r.campaign)} / ${full ? '전체 프로모션' : '선택한 섹션'}</div><h2>${esc(full ? r.campaign : r.title)}</h2></div>
        <button class="btn ghost sm am-iconbtn" data-close-modal aria-label="닫기">${icon('close')}</button></header>
      <div class="am-rview-b"><div class="am-rview-main">
          <div class="seg" role="radiogroup" aria-label="보기 범위"><button type="button" role="radio" data-rv="section" aria-checked="${!full}" class="${full ? '' : 'on'}">선택한 섹션</button>
            <button type="button" role="radio" data-rv="campaign" aria-checked="${full}" class="${full ? 'on' : ''}">전체 프로모션 · ${parts.length}개 섹션</button></div>
          <div class="am-rview-doc">${refArt(r, view)}</div></div>
        <aside class="am-rview-side"><p class="cap">${full ? '위에서 아래로 섹션 순서를 확인해 보세요. 선택한 섹션은 선으로 표시했어요.' : '이미지와 제목, 상품, 버튼을 어떻게 배치했는지 살펴보세요. 전체 프로모션으로 바꾸면 앞뒤 섹션도 볼 수 있어요.'}</p>
          <dl class="am-dl"><div><dt>원본 캠페인</dt><dd>${esc(r.campaign)}</dd></div><div><dt>섹션 유형</dt><dd>${esc(r.cat)}</dd></div><div><dt>가져올 수 있는 범위</dt><dd>${capability(r)}</dd></div></dl>
          <div class="info-box"><b>이 구좌에서 참고할 포인트</b><br>${esc(r.reason)}. ${esc(r.summary)}</div>
          <div class="am-rview-act">
            ${r.applicable && r.layout ? `<button class="btn primary" data-rva="apply" ${state.applied === r.id ? 'disabled' : ''}>${state.applied === r.id ? '이 구좌에 적용함' : '이 구좌에 레이아웃 적용'}</button>` : ''}
            <button class="btn" data-rva="attach" ${state.attached.has(r.id) ? 'disabled' : ''}>${state.attached.has(r.id) ? '참고로 첨부함' : '참고로 첨부'}</button></div>
          <p class="cap">${r.applicable && r.layout ? '레이아웃을 적용해도 구좌의 문구와 연결한 상품은 그대로예요.' : '편집할 수 있는 배치는 아직 없어요. 디자이너 요청에 참고자료로 첨부할 수 있어요.'}</p>
          <p class="cap">실제 캠페인 이미지를 연결하기 전의 구성 예시예요 (가상 데이터).</p></aside></div></div>`;
  };
  openModal('', body => {
    draw(body);
    body.onclick = e => {
      const v = e.target.closest('[data-rv]'); if (v) { view = v.dataset.rv; draw(body); body.querySelector(`[data-rv="${view}"]`)?.focus(); return; }
      const a = e.target.closest('[data-rva]'); if (!a || a.disabled) return;
      closeModal(); on[a.dataset.rva](byRef(id));
    };
    body.querySelector('[data-rv="section"]')?.focus();
  });
}
