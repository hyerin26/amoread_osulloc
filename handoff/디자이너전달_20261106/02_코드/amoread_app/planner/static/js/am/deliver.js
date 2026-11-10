// ⑤ 확인·전달: 확인할 것 → 확정 → 내보내기 (plans/03 4장 ⑤, plans/05 R16, 디자이너 S07 동작)
// - 확인할 것: 단계 사이 어긋남(다음에 할 일) + 할인 검증 + 페이지 미정 항목. 막지 않고 알려만 준다
// - 확정: 예측을 고정 저장. 확정 후에도 고칠 수 있고, 바뀐 곳을 표시한다
// - 내보내기: PROMO_WORK 붙여넣기 엑셀, 팀 공유 요약, 디자이너 기획안(미리보기에서 디자인 요청을 바로 고치면 자동 저장, PDF는 인쇄 창, HTML은 정적 텍스트만)
// - 원가는 디자이너 기획안과 공유 요약에 넣지 않는다
import { $, $$, api, esc, man, mmdd, pct, state, won } from '../core.js';
import { am, dealPlanOf, dLabel, saveNow, scheduleSave, STATUS } from './store.js';
import { nextItems } from './next.js';
import { DISPLAYS } from './page.js';
import { ask, notify } from './ui.js';
import { ctxTags } from './meta.js';

const WD = '일월화수목금토';
const isDeal = r => r.type === '하루특가';
const keyOf = r => r.items && r.items.length ? `i:${r.items.map(i => `${i.seq}x${i.qty || 1}`).join('+')}` : (r.seq ? `s:${r.seq}` : '');
const nameOf = r => r.items && r.items.length
  ? r.items.map(i => (state.bySeq.get(String(i.seq)) || {}).name || i.seq).join(' + ')
  : ((state.bySeq.get(String(r.seq)) || {}).name || (r.seq ? `SEQ ${r.seq}` : '상품 미정'));
const priceOf = r => (r && r.seq && !r.items) ? (state.bySeq.get(String(r.seq)) || {}).price || null : null;
const saleOf = r => { const p = priceOf(r); return p ? Math.round(p * (1 - (r.rate || 0))) : null; };
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dispName = v => (DISPLAYS.find(d => d[0] === (v || '')) || [, '미정'])[1];

let docOpen = false, notesOn = true;

// ---------------------------------------------------------------- 미정 항목 (내보내기 전 확인, F-07-05)
function undecided(p) {
  const secs = p.page?.sections || [], rows = p.promo_rows || [];
  const nonDeal = rows.filter(r => !isDeal(r));
  const out = [];
  const slotsUnd = secs.reduce((a, s) => a + s.slots.filter(x => x.placeholderStatus !== 'AVAILABLE').length, 0);
  if (slotsUnd) out.push(`상품 미정 자리 ${slotsUnd}개`);
  const noPrice = secs.filter(s => s.layoutId !== 'deal-banner').reduce((a, s) => a + s.slots.filter(x => keyOf(x) && !nonDeal.some(r => keyOf(r) === keyOf(x))).length, 0);
  if (noPrice) out.push(`할인이 정해지지 않은 페이지 상품 ${noPrice}개`);
  const dispUnd = secs.filter(s => s.layoutId !== 'hero' && s.layoutId !== 'text-cta' && !s.price_display).length;
  if (dispUnd) out.push(`가격 노출 방식 미정 섹션 ${dispUnd}개`);
  if (secs.length) out.push('상품 이미지는 아직 연결되지 않아 모두 자리표시로 나가요');
  return out;
}

// ---------------------------------------------------------------- 그리기
export async function renderDeliver(el, side) {
  const p = am.cur;
  el.innerHTML = `<div class="am-stephead"><div class="grow"><div class="overline">05 · 미리보기·내보내기</div><h2>미리보기·내보내기</h2>
      <p>디자이너에게 보낼 기획안을 미리 보고, 확정한 뒤 엑셀과 공유 요약으로 내보내요. 확인할 것이 남아 있어도 내보낼 수 있어요.</p>${ctxTags(p)}</div></div>
  <div class="am-deliver">
    <section class="card" id="amDlvCheck"><h2>확인할 것</h2><div class="empty"><span class="spin"></span></div></section>
    <section class="card" id="amDlvConfirm"><h2>확정</h2><div class="empty"><span class="spin"></span></div></section>
    <section class="card" id="amDlvOut">
      <h2>내보내기</h2>
      <div class="am-dlv-outs">
        <div class="am-dlv-out"><h3>PROMO_WORK 붙여넣기 엑셀</h3><p class="cap">저장된 할인 행으로 만들어요. 할인 없음은 큐레이션, 할인율 빈칸으로 나가요. 공유 엑셀에는 직접 쓰지 않아요.</p>
          <button class="btn primary" data-out="xlsx">엑셀 내려받기</button></div>
        <div class="am-dlv-out"><h3>팀 공유 요약</h3><p class="cap">Teams나 메일에 붙여넣을 글이에요. 원가는 넣지 않아요.</p>
          <button class="btn" data-out="share">요약 보기·복사</button></div>
        <div class="am-dlv-out"><h3>디자이너 기획안</h3><p class="cap">구좌 순서대로 화면 구성과 디자인 요청을 나란히 보여줘요. 원가는 넣지 않아요.</p>
          <button class="btn" data-out="doc">${docOpen ? '미리보기 닫기' : '미리보기 열기'}</button></div>
      </div>
    </section>
    <section class="card ${docOpen ? '' : 'hidden'}" id="amDocCard"></section>
  </div>`;
  side.innerHTML = `<section class="card"><h2>이 단계에서</h2><ul class="am-plain">
      <li>확인할 것이 남아 있어도 내보낼 수 있어요. 내보내기 전에 한 번 더 알려줘요</li>
      <li>확정하면 그때의 예측을 고정해 두고, 행사가 끝나면 결과와 비교해요</li>
      <li>디자이너 기획안 미리보기에서 디자인 요청을 바로 고치면 자동 저장돼요</li></ul></section>`;
  el.querySelector('#amDlvOut').addEventListener('click', onOut);
  if (docOpen) paintDoc();
  paintCheck(); paintConfirm();
}

async function paintCheck() {
  const box = $('#amDlvCheck'); if (!box) return;
  const p = am.cur;
  const [items, chk] = await Promise.all([
    nextItems(p, {}),
    p.promo_rows.length ? api('/api/am/check', { method: 'POST', body: { rows: p.promo_rows } }).catch(() => null) : Promise.resolve(null),
  ]);
  if (!$('#amDlvCheck')) return;
  const und = undecided(p);
  const issues = (chk?.rows || []).filter(r => r.level !== 'ok');
  box.innerHTML = `<div class="sec-head"><h2>확인할 것</h2>
      <span class="am-badge ${chk?.summary?.errors ? 'err' : ''}">할인 오류 ${chk?.summary?.errors ?? 0}</span>
      <span class="am-badge ${chk?.summary?.warnings ? 'warn' : ''}">할인 주의 ${chk?.summary?.warnings ?? 0}</span></div>
    ${items.length ? `<h3>단계 사이에서 맞출 것</h3><ul class="am-nextlist">${items.map(it => `<li><button class="am-nextitem" data-go-step="${it.step}" ${it.sub ? `data-go-sub="${it.sub}"` : ''}>${esc(it.text)}</button></li>`).join('')}</ul>` : '<p class="sm">단계 사이에서 맞지 않는 곳이 없어요.</p>'}
    ${issues.length ? `<h3>할인 행 오류·주의 ${issues.length}개</h3><ul class="am-plain">${issues.slice(0, 8).map(r => `<li>${esc(r.name || nameOf(r))} ${r.type === '하루특가' ? mmdd(r.start) : ''}: ${esc([...(r.errors || []), ...(r.warnings || [])].join(', '))}</li>`).join('')}${issues.length > 8 ? `<li class="cap">외 ${issues.length - 8}개는 03 상품·혜택에서 볼 수 있어요</li>` : ''}</ul>` : ''}
    ${und.length ? `<h3>미정 항목</h3><ul class="am-plain">${und.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
  box.onclick = e => {
    const g = e.target.closest('[data-go-step]'); if (!g) return;
    document.dispatchEvent(new CustomEvent('am:go-step', { detail: { step: g.dataset.goStep, sub: g.dataset.goSub } }));
  };
}

async function paintConfirm() {
  const box = $('#amDlvConfirm'); if (!box) return;
  const p = am.cur;
  let res = null;
  try { res = await api(`/api/am/projects/${p.id}/result`); } catch (e) { box.innerHTML = `<h2>확정</h2><div class="err-box">${esc(e.message)}</div>`; return; }
  if (!$('#amDlvConfirm')) return;
  const ch = res.changes, rf = res.reflect, ac = res.actual;
  const ended = p.brief.period && p.brief.period.end < new Date().toISOString().slice(0, 10);
  box.innerHTML = `<div class="sec-head"><h2>확정</h2><span class="am-badge st-${esc(p.status)}">${esc(STATUS[p.status] || '')}</span></div>
    ${ch.confirmed
      ? `<p class="sm">${esc(ch.confirmed_at)}에 확정했어요.${ch.total ? ` 확정 이후 바뀐 곳 ${ch.total}개 (추가 ${ch.added}, 삭제 ${ch.removed}, 할인율 변경 ${ch.rate_changed})` : ' 확정 이후 바뀐 곳이 없어요.'}</p>
         <div class="row wrap"><button class="btn" data-cf="again">${ch.total ? '다시 확정' : '다시 확정 (예측 새로 고정)'}</button></div>`
      : `<p class="sm">확정하면 지금의 예측(예상 수량, 예상 매출)을 고정해 두고, 행사가 끝나면 결과와 비교해요. 확정한 뒤에도 고칠 수 있어요.</p>
         <div class="row wrap"><button class="btn primary" data-cf="confirm" ${p.promo_rows.length ? '' : 'disabled'}>확정하기</button></div>`}
    <h3>PROMO_WORK 반영</h3>
    <p class="sm">${rf.rows ? `PROMO_WORK에서 이 기획안의 행 ${rf.found}/${rf.rows}개를 찾았어요 (데이터 갱신 ${esc((rf.data_built_at || '').slice(5, 16))} 기준).` : '비교할 행이 없어요.'}
      ${rf.found && p.status !== 'reflected' ? '' : ''}</p>
    ${rf.found && p.status !== 'reflected' ? '<div class="row"><button class="btn" data-cf="reflected">PROMO_WORK 반영됨으로 표시</button></div>' : ''}
    ${rf.rows && !rf.found ? '<p class="cap">엑셀을 PROMO_WORK에 붙여넣고 설정에서 데이터를 갱신하면 여기서 확인돼요.</p>' : ''}
    ${ac.snapshot ? `<h3>결과 보기</h3>${ac.matched
      ? `<p class="sm">실적이 맞춰진 행 ${ac.matched}/${ac.rows.length}개 · 예상 ${man(ac.expected_sum)}만원, 실적 ${man(ac.actual_sum)}만원${ac.ratio !== null ? ` (${Math.round(ac.ratio * 100)}%)` : ''}</p>
         <div class="tbl-wrap"><table class="t compact"><thead><tr><th>상품</th><th>유형</th><th>시작</th><th class="num">할인</th><th class="num">예상(만원)</th><th class="num">실적(만원)</th><th class="num">달성</th><th>상태</th></tr></thead><tbody>
         ${ac.rows.map(r => `<tr><td class="name"><span class="n">${esc(r.name || r.seq)}</span></td><td>${esc(r.type)}</td><td class="num">${mmdd(r.start)}</td><td class="num">${pct(r.rate)}</td>
           <td class="num">${man(r.expected_sales)}</td><td class="num">${r.actual_sales !== null && r.actual_sales !== undefined ? man(r.actual_sales) : '-'}</td><td class="num">${r.ratio !== null && r.ratio !== undefined ? Math.round(r.ratio * 100) + '%' : '-'}</td><td class="cap">${esc(r.status || '')}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="cap">${ended ? '아직 실적이 맞춰진 행이 없어요. ' : '행사가 끝나면 '}${esc(ac.note)}</p>`}` : ''}`;
  box.onclick = async e => {
    const b = e.target.closest('[data-cf]'); if (!b) return;
    if (b.dataset.cf === 'reflected') { p.status = 'reflected'; await saveNow(); notify('PROMO_WORK 반영됨으로 표시했어요'); document.dispatchEvent(new CustomEvent('am:status')); paintConfirm(); return; }
    await saveNow();
    try {
      const d = await api(`/api/am/projects/${p.id}/confirm`, { method: 'POST' });
      p.snapshot = d.snapshot; p.status = d.status; p.updated_at = d.updated_at;
      notify(b.dataset.cf === 'again' ? '지금 예측으로 다시 확정했어요' : '확정했어요. 행사가 끝나면 결과를 여기서 볼 수 있어요');
      document.dispatchEvent(new CustomEvent('am:status'));
      paintConfirm();
    } catch (err) { notify(err.message); }
  };
}

// ---------------------------------------------------------------- 내보내기
async function confirmUndecided(what) {
  const und = undecided(am.cur).filter(x => !x.startsWith('상품 이미지'));
  if (!und.length) return true;
  const v = await ask('이 상태로 내보낼까요?', `<p class="sm">${esc(what)}에 아직 정하지 않은 항목이 있어요. 출력물에는 '미정'으로 표시돼요.</p><ul class="am-plain">${und.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`,
    [{ label: '닫기', value: null }, { label: '이 상태로 내보내기', value: 'go', primary: true }]);
  return v === 'go';
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const safeName = s => String(s || '기획안').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

async function onOut(e) {
  const b = e.target.closest('[data-out]'); if (!b) return;
  const p = am.cur;
  if (b.dataset.out === 'xlsx') {
    if (!p.promo_rows.length) { notify('저장된 할인 행이 없어요'); return; }
    await saveNow();
    try {
      const brief = [p.brief.myeongbun && `명분: ${p.brief.myeongbun}`, p.brief.concept && `컨셉: ${p.brief.concept}`, p.brief.target && `목표: ${p.brief.target}`].filter(Boolean).join('\n');
      const res = await api('/api/am/export', { method: 'POST', body: { title: p.title, brief, rationale: p.rationale || '', source: '기획안', rows: p.promo_rows }, raw: true });
      download(`기획안_${safeName(p.title)}.xlsx`, await res.blob());
      notify('엑셀 다운로드를 시작했어요. PROMO_WORK에는 [선택하여 붙여넣기 → 값]으로 붙여 주세요');
    } catch (err) { notify(err.message); }
    return;
  }
  if (b.dataset.out === 'share') {
    const text = shareText(p);
    const v = await ask('팀 공유 요약', `<textarea class="am-sharetext" readonly rows="16">${esc(text)}</textarea>`, [{ label: '닫기', value: null }, { label: '복사', value: 'copy', primary: true }]);
    if (v === 'copy') { try { await navigator.clipboard.writeText(text); notify('복사했어요'); } catch { notify('복사하지 못했어요. 글을 직접 선택해 복사해 주세요'); } }
    return;
  }
  if (b.dataset.out === 'doc') {
    docOpen = !docOpen;
    b.textContent = docOpen ? '미리보기 닫기' : '미리보기 열기';
    $('#amDocCard').classList.toggle('hidden', !docOpen);
    if (docOpen) { paintDoc(); $('#amDocCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
}

function shareText(p) {
  const b = p.brief, rows = p.promo_rows;
  const per = b.period ? `${b.period.start} ~ ${b.period.end}` : '날짜 미정';
  const zones = new Map();
  rows.filter(r => !isDeal(r)).forEach(r => { const z = r.category_tag || 'Zone 미지정'; if (!zones.has(z)) zones.set(z, []); zones.get(z).push(r); });
  const deals = new Map();
  rows.filter(isDeal).forEach(r => { if (!deals.has(r.start)) deals.set(r.start, []); deals.get(r.start).push(r); });
  return [
    `[기획안] ${p.title}`, `기간 ${per}`, b.myeongbun && `명분 ${b.myeongbun}`, b.concept && `컨셉 ${b.concept}`, b.target && `목표 ${b.target}`, '',
    ...(zones.size ? ['■ 구좌 상품', ...[...zones.entries()].flatMap(([z, rs]) => [`${z} (${rs.length}개)`, ...rs.map(r => `  · ${nameOf(r)} ${r.type === '큐레이션' ? '할인 없음' : pct(r.rate)}`)]), ''] : []),
    ...(deals.size ? ['■ 하루특가', ...[...deals.entries()].sort().map(([d, rs]) => `${mmdd(d)}(${WD[parse(d).getDay()]}) ${rs.map(r => `${nameOf(r)} ${pct(r.rate)}`).join(', ')}`), ''] : []),
    ...((p.page?.sections || []).length ? ['■ 페이지 구성', ...p.page.sections.map((s, i) => `${i + 1}. ${s.name}${s.purpose ? ` (${s.purpose})` : ''}`), ''] : []),
    `상태 ${STATUS[p.status] || ''}${p.snapshot ? ` · 확정 ${p.snapshot.confirmed_at}` : ''}`,
  ].filter(x => x !== false && x !== undefined && x !== '' || x === '').join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------- 디자이너 기획안
function slotLine(sl, sec, rows) {
  const r = rows.find(x => !isDeal(x) && keyOf(x) === keyOf(sl));
  const name = keyOf(sl) ? nameOf(sl) : '상품 미정';
  let price = '';
  const d = sec.price_display || '';
  if (!r && keyOf(sl)) price = '할인 미정';
  else if (r) {
    const sp = saleOf(r), lp = priceOf(r);
    if (d === 'emphasis') price = r.type === '큐레이션' || !r.rate ? (lp ? `${won(lp)}원` : '') : `${pct(r.rate)} ${sp ? won(sp) + '원' : ''}${lp ? ` (정가 ${won(lp)}원)` : ''}`;
    else if (d === 'price') price = r.type === '큐레이션' || !r.rate ? (lp ? `${won(lp)}원` : '') : `${sp ? won(sp) + '원' : ''}${lp ? ` (정가 ${won(lp)}원)` : ''}`;
    else if (d === 'name' || d === 'section') price = '';
    else price = '가격 노출 미정';
  }
  return { name, price, undecided: !keyOf(sl) };
}

// editable: 미리보기(디자인 요청을 바로 고침) / false: 내보내는 정적 문서
function docBody(p, editable) {
  const b = p.brief, rows = p.promo_rows, secs = p.page?.sections || [];
  const slots = dealPlanOf(p).slots;
  const deals = new Map();
  rows.filter(isDeal).forEach(r => { if (!deals.has(r.start)) deals.set(r.start, []); deals.get(r.start).push(r); });
  const head = `<header class="am-doc-head"><p class="cap am-doc-kicker">AMOREAD · 프로모션 기획안</p><h1>${esc(p.title)}</h1>
    <p>${esc(b.period ? `${b.period.start} ~ ${b.period.end}` : '날짜 미정')}${b.page_kind && b.page_kind !== '없음' ? ` · ${esc(b.page_kind)} 페이지` : ''}</p>
    ${b.myeongbun ? `<p><span class="k">명분</span> ${esc(b.myeongbun)}</p>` : ''}${b.concept ? `<p><span class="k">컨셉</span> ${esc(b.concept)}</p>` : ''}
    ${b.audience || b.customer ? `<p><span class="k">고객</span> ${esc([b.audience, b.customer].filter(Boolean).join(', '))}</p>` : ''}
    ${b.benefits_note ? `<p><span class="k">혜택</span> ${esc(b.benefits_note)}</p>` : ''}</header>`;
  if (!secs.length) return head + '<p class="am-doc-empty">페이지 구성이 아직 없어요. 02 구성에서 구좌를 만들면 여기에 보여요.</p>';
  const body = secs.map((s, i) => {
    let wire;
    if (s.layoutId === 'deal-banner') {
      const ds = [...deals.entries()].sort((x, y) => x[0].localeCompare(y[0]));
      wire = `<p class="am-doc-meta">하루 ${slots}자리 · 날짜마다 상품이 바뀌는 영역</p>${ds.length ? `<table class="am-doc-table"><tbody>${ds.map(([d, rs]) => `<tr><th>${mmdd(d)}(${WD[parse(d).getDay()]})</th><td>${rs.map(r => `${esc(nameOf(r))} ${pct(r.rate)}`).join(', ')}${rs.length < slots ? ` <span class="am-doc-und">빈 자리 ${slots - rs.length}</span>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="am-doc-und">하루특가 미정</p>'}`;
    } else {
      const lines = s.slots.map(sl => slotLine(sl, s, rows));
      wire = `${s.headline ? `<p class="am-doc-hl">${esc(s.headline)}</p>` : ''}${s.subhead ? `<p>${esc(s.subhead)}</p>` : ''}
        ${s.price_display === 'section' && s.section_price ? `<p class="am-doc-sprice">섹션 대표 가격 ${won(s.section_price)}원</p>` : ''}
        ${lines.length ? `<ul class="am-doc-prods">${lines.map(l => `<li><span class="am-doc-img">이미지 미확정</span><span>${esc(l.name)}${l.undecided ? ' <span class="am-doc-und">미정</span>' : ''}</span>${l.price ? `<span class="am-doc-price ${/미정/.test(l.price) ? 'und' : ''}">${esc(l.price)}</span>` : ''}</li>`).join('')}</ul>` : ''}
        ${s.cta ? `<p class="am-doc-cta">${esc(s.cta)}</p>` : ''}`;
    }
    const note = editable
      ? `<textarea class="am-doc-note-in" data-note="${esc(s.sectionId)}" rows="4" maxlength="2000" placeholder="디자인 요청을 적어 주세요">${esc(s.designNotes)}</textarea>`
      : `<p>${s.designNotes ? esc(s.designNotes).replace(/\n/g, '<br>') : '<span class="am-doc-und">따로 남긴 요청사항이 없어요</span>'}</p>`;
    return `<section class="am-doc-row"><div class="am-doc-wire"><h2><span class="n">${String(i + 1).padStart(2, '0')}</span> ${esc(s.name || '이름 없는 섹션')}</h2>
        <p class="am-doc-meta">${esc([s.purpose && `목표 ${s.purpose}`, s.role, `가격 노출 ${dispName(s.price_display)}`].filter(Boolean).join(' · '))}</p>${wire}</div>
      <div class="am-doc-note"><h3>디자인 요청</h3>${note}</div></section>`;
  }).join('');
  return head + body;
}

function paintDoc() {
  const card = $('#amDocCard'); if (!card) return;
  card.innerHTML = `<div class="sec-head"><h2>디자이너 기획안 미리보기</h2><span class="grow"></span>
      <label class="ck"><input type="checkbox" id="amDocNotes" ${notesOn ? 'checked' : ''}> 요청사항 보기</label>
      <button class="btn sm" id="amDocHtml">HTML 내보내기</button><button class="btn sm primary" id="amDocPdf">PDF로 저장</button></div>
    <p class="cap">디자인 요청은 여기서 바로 고치면 자동 저장돼요. 원가와 내부 검증 정보는 넣지 않아요.</p>
    <div class="am-doc ${notesOn ? '' : 'no-notes'}" id="amDoc">${docBody(am.cur, true)}</div>`;
  $('#amDocNotes').addEventListener('change', e => { notesOn = e.target.checked; $('#amDoc').classList.toggle('no-notes', !notesOn); });
  card.querySelector('#amDoc').addEventListener('input', e => {
    const t = e.target.closest('[data-note]'); if (!t) return;
    const s = (am.cur.page?.sections || []).find(x => x.sectionId === t.dataset.note);
    if (s) { s.designNotes = t.value; scheduleSave(); }
  });
  $('#amDocHtml').addEventListener('click', exportHtml);
  $('#amDocPdf').addEventListener('click', printPdf);
}

const DOC_CSS = `body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#141414;margin:24px;font-size:14px;line-height:22px}
h1{font-size:28px;line-height:36px;margin:0 0 4px}h2{font-size:16px;margin:0 0 4px}h3{font-size:13px;margin:0 0 6px;color:#666}
.am-doc-head{border-bottom:1px solid #dedede;padding-bottom:12px;margin-bottom:16px}.am-doc-head p{margin:2px 0}.k{color:#666;margin-right:6px}.am-doc-kicker{font-size:12px;color:#666;margin:0 0 4px}
.am-doc-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px;border:1px solid #dedede;border-radius:12px;padding:14px;margin-bottom:12px;break-inside:avoid}
.no-notes .am-doc-row{grid-template-columns:1fr}.no-notes .am-doc-note{display:none}
.am-doc-meta{color:#666;font-size:12px;margin:0 0 8px}.n{color:#666}.am-doc-hl{font-size:16px;font-weight:600}
.am-doc-prods{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.am-doc-prods li{border:1px solid #dedede;border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px}
.am-doc-img{display:block;height:64px;border-radius:6px;background:#f3f3f3;color:#666;font-size:12px;text-align:center;line-height:64px}
.am-doc-price{color:#b52e10;font-weight:600}.am-doc-price.und,.am-doc-und{color:#666;font-weight:400;font-size:12px}
.am-doc-sprice{font-weight:600;color:#b52e10}.am-doc-cta{display:inline-block;background:#141414;color:#fff;border-radius:8px;padding:6px 14px}
.am-doc-table th{text-align:left;padding:4px 10px 4px 0;white-space:nowrap;color:#666;font-weight:500}.am-doc-table td{padding:4px 0}
.am-doc-note{background:#fafafa;border-radius:8px;padding:10px}@page{size:A4 landscape;margin:12mm}`;

async function exportHtml() {
  if (!(await confirmUndecided('디자이너 기획안'))) return;
  await saveNow();
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(am.cur.title)} 디자이너 기획안</title><style>${DOC_CSS}</style></head><body>
<div class="${notesOn ? '' : 'no-notes'}">${docBody(am.cur, false)}</div></body></html>`;
  download(`디자이너기획안_${safeName(am.cur.title)}.html`, new Blob([html], { type: 'text/html;charset=utf-8' }));
  notify('HTML 파일 다운로드를 시작했어요. 원가는 넣지 않았어요');
}

async function printPdf() {
  if (!(await confirmUndecided('디자이너 기획안'))) return;
  await saveNow();
  let root = $('#amPrintRoot');
  if (!root) { root = document.createElement('div'); root.id = 'amPrintRoot'; document.body.appendChild(root); }
  root.innerHTML = `<div class="am-doc ${notesOn ? '' : 'no-notes'}">${docBody(am.cur, false)}</div>`;
  document.body.classList.add('am-printing');
  const done = () => { document.body.classList.remove('am-printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  notify('인쇄 창에서 ‘PDF로 저장’과 ‘A4 가로’를 선택해 주세요');
  window.print();
  setTimeout(done, 1500);   // afterprint가 오지 않는 브라우저 대비
}

export function deliverStepState(p) {
  if (p.status === 'reflected') return ['PROMO_WORK 반영됨', 'ok'];
  if (p.snapshot) return [`확정 ${mmdd((p.snapshot.confirmed_at || '').slice(0, 10))}`, 'ok'];
  return ['확정 전', 'mute'];
}
