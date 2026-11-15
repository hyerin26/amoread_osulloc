// 설정 › 매일 아침 자동 확인: 버튼으로 켜고 끈다 (예전엔 PowerShell 명령을 직접 쳐야 했다). 서버 /api/am/ai/auto
// 켜 두면 매일 정한 시각(그때 꺼져 있었으면 켜진 뒤)에 마켓별 새 프로모션을 찾고, '오늘의 영감' 카드의 화면 사진까지 받아 둔다
(() => {
  const box = document.getElementById('auto'); if (!box) return;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const say = m => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 3200); };
  let S = null, busy = false, err = '', pollT = null;
  const NAME = { osulloc: '오설록', kurly: '컬리', '29cm': '29CM', oliveyoung: '올리브영', zigzag: '지그재그' };
  function render() {
    if (!S) { box.innerHTML = `<div class="sec-head"><div><h2 id="autoH">매일 아침 자동 확인</h2><span class="cap">${err ? `상태를 읽지 못했어요 (${esc(err)})` : '상태를 읽는 중…'}</span></div>${err ? '<button class="btn sm" data-auto-reload>다시 읽기</button>' : ''}</div>`; return; }
    const res = Object.entries(S.results || {});
    const bad = res.filter(([, r]) => !r.ok).length;
    box.innerHTML = `<div class="sec-head"><div><h2 id="autoH">매일 아침 자동 확인</h2>
        <span class="cap">${S.on ? `켜져 있어요 · 매일 ${esc(S.at)}` : '꺼져 있어요'}${S.running ? ' · 지금 확인하는 중…' : ''}</span></div>
      ${S.supported ? `<label class="autoat"><span class="cap">시각</span><input type="time" id="autoAt" value="${esc(S.at)}" ${busy ? 'disabled' : ''} aria-label="매일 확인할 시각"></label>
        <button class="btn sm ${S.on ? '' : 'primary'}" data-auto-toggle ${busy ? 'disabled' : ''}>${busy ? '바꾸는 중…' : S.on ? '끄기' : '켜기'}</button>
        <button class="btn sm" data-auto-run ${busy || S.running ? 'disabled' : ''}>${S.running ? '확인하는 중…' : '지금 한 번 확인'}</button>` : ''}</div>
      <p class="cap">켜 두면 매일 이 시각에 마켓별 새 프로모션을 찾고, <a class="lnk" href="/v2/inspire">오늘의 영감</a> 카드의 화면 사진까지 받아 둬요. 그 시각에 PC가 꺼져 있었으면 켜진 뒤(로그인할 때) 돌아요. 하루에 한 번만 돌고, 10~20분쯤 걸려요. 프로그램 창을 열어 두지 않아도 돼요.</p>
      ${!S.supported ? '<p class="cap warn">이 PC의 운영체제에서는 자동 실행을 등록할 수 없어요. [지금 한 번 확인]은 쓸 수 있어요.</p><div class="row"><button class="btn sm" data-auto-run>지금 한 번 확인</button></div>' : ''}
      ${S.on && S.at !== (document.getElementById('autoAt')?.value || S.at) ? '' : ''}
      <dl class="autokv"><dt>마지막 확인</dt><dd>${S.last_run ? esc(S.last_run) : '아직 없어요'}${S.last_ok && S.last_ok !== S.last_run ? ` <span class="cap">(전부 성공한 건 ${esc(S.last_ok)})</span>` : ''}</dd>
        ${res.length ? `<dt>마켓별 결과</dt><dd>${res.map(([k, r]) => `<span class="autor ${r.ok ? '' : 'bad'}">${esc(NAME[k] || k)} ${r.ok ? `${r.found ?? 0}개 찾음${r.new != null ? ` · 새 것 ${r.new}` : ''}` : '실패'}</span>`).join('')}${bad ? `<span class="cap">실패한 마켓은 다음 확인 때 다시 해요</span>` : ''}</dd>` : ''}
        ${S.inspire ? `<dt>오늘의 영감 화면</dt><dd>${esc(S.inspire.msg || '')} <span class="cap">${esc(S.inspire.at || '')}</span></dd>` : ''}</dl>`;
  }
  async function load() {
    try { S = await v2api('/api/am/ai/auto'); err = ''; } catch (e) { S = null; err = e.message; }
    render();
    clearTimeout(pollT); if (S?.running) pollT = setTimeout(load, 5000);   // 도는 동안은 5초마다 다시 읽는다
  }
  box.addEventListener('click', async e => {
    if (e.target.closest('[data-auto-reload]')) { load(); return; }
    if (e.target.closest('[data-auto-toggle]')) {
      const on = !S.on, at = document.getElementById('autoAt')?.value || S.at;
      busy = true; render();
      try { const r = await v2api('/api/am/ai/auto', { on, at }); if (!r.ok) throw new Error(r.error || '바꾸지 못했어요'); S = r; say(on ? `켰어요. 매일 ${r.at}에 확인해요` : '껐어요'); }
      catch (er) { say(er.message); }
      busy = false; render(); return;
    }
    if (e.target.closest('[data-auto-run]')) {
      try { const r = await v2api('/api/am/ai/auto/run', {}); S = { ...S, ...r }; say(r.already ? '이미 확인하는 중이에요' : '확인을 시작했어요. 10~20분쯤 걸려요 (다른 화면으로 가도 계속돼요)'); }
      catch (er) { say(er.message); }
      load();
    }
  });
  // 켜진 상태에서 시각을 바꾸면 그 시각으로 다시 등록
  box.addEventListener('change', async e => {
    if (e.target.id !== 'autoAt' || !S?.on || !e.target.value) return;
    busy = true; render();
    try { const r = await v2api('/api/am/ai/auto', { on: true, at: e.target.value }); if (!r.ok) throw new Error(r.error || '바꾸지 못했어요'); S = r; say(`매일 ${r.at}로 바꿨어요`); }
    catch (er) { say(er.message); }
    busy = false; render();
  });
  load();
})();
