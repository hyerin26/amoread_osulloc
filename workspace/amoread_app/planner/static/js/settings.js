// 데이터·설정: 데이터 갱신, 원가 파일(온라인 가이드) 올리기, 보자기 본품 지정, 기준 보기
import { $, api, emit, esc, pct, state, toast, won } from './core.js';

let wrapItems = [];
let polling = null;

export function initSettings() {
  $('#btnRebuild').addEventListener('click', () => rebuild(false));
  $('#btnRebuildFull').addEventListener('click', () => rebuild(true));
  $('#btnUpload').addEventListener('click', upload);
  $('#wrapAdd').addEventListener('click', () => { wrapItems.push({ wrap_seq: '', base_seq: '', memo: '' }); renderWrap(); });
  $('#wrapSave').addEventListener('click', saveWrap);
  $('#wrapTable').addEventListener('input', e => {
    const i = e.target.dataset.i, f = e.target.dataset.f; if (i === undefined) return;
    wrapItems[+i][f] = e.target.value; if (f !== 'memo') renderWrapNames();
  });
  $('#wrapTable').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { wrapItems.splice(+d.dataset.del, 1); renderWrap(); } });
  loadWrap();
}

export function renderSettings(metaResp) {
  const m = metaResp.meta;
  $('#setStatus').innerHTML = m ? `<dl class="kv">
      <dt>마지막 갱신</dt><dd>${esc(m.built_at)}</dd>
      <dt>판매실적</dt><dd>${esc((m.sales_files || []).join(', '))} · 마지막 날 <b>${esc(m.sales_last_day)}</b> (출고일 기준)</dd>
      <dt>원가</dt><dd>${esc(m.guide_file)} / ${esc(m.cost_sheet)} (이동평균가) · 상품장에 없는 SAP는 '1) 상품정보_손익예측' 원가</dd>
      <dt>할인정보 xlsm</dt><dd>원본 수정시각 ${esc(m.promo_workbook_modified)} (스냅샷 사본으로 읽음)</dd>
    </dl>` : '<div class="err-box">아직 데이터가 없습니다. [데이터 갱신]을 누르세요.</div>';
  $('#guideList').innerHTML = `<thead><tr><th>파일</th><th>위치</th><th>수정</th><th></th></tr></thead><tbody>${(metaResp.guides || []).map(g => `<tr><td>${esc(g.name)}</td><td>${esc(g.folder)}</td><td>${esc(g.modified)}</td><td>${g.in_use ? '<span class="tag run">사용 중</span>' : ''}</td></tr>`).join('')}</tbody>`;
  const r = m?.rules || {};
  $('#setRules').innerHTML = `<dl class="kv">
    <dt>할인 후 원가율</dt><dd>참고선 ${pct(r.target_cost_ratio ?? state.target)} (원가 ÷ (할인가 ÷ 1.1)): 넘어도 오류가 아니라 '주의'로만 표시하고, 할인율을 자동으로 낮추지 않아요</dd>
    <dt>보자기 원가</dt><dd>일반 ${won(r.wrap_cost)}원 · 한정 ${won(r.wrap_cost_limited)}원 (본품 원가에 더함)</dd>
    <dt>행사 실적 귀속</dt><dd>라인 할인율이 세팅 할인율 ±${pct(r.rate_match_tol)}p 이내인 판매, 종료 ${r.ship_lag_days ?? 1}일 뒤까지 (출고일 기준 실적 보정)</dd>
    <dt>재고</dt><dd>${esc(r.stock_note || '')}</dd>
    <dt>바꾸려면</dt><dd class="mute">osulloc_ops\\.env 에 PLANNER_TARGET_COST_RATIO, PLANNER_WRAP_COST, PLANNER_WRAP_COST_LIMITED 입력 후 프로그램 재시작</dd></dl>`;
  if (metaResp.rebuild?.running) watch();
}

async function rebuild(full) {
  try {
    const r = await api('/api/rebuild', { method: 'POST', body: { full } });
    if (!r.started) toast('이미 갱신 중입니다');
    watch();
  } catch (e) { toast(e.message); }
}

function watch() {
  const log = $('#rebuildLog'); log.classList.remove('hidden');
  $('#btnRebuild').disabled = $('#btnRebuildFull').disabled = true;
  clearInterval(polling);
  polling = setInterval(async () => {
    let s; try { s = await api('/api/rebuild'); } catch { return; }
    log.textContent = (s.log || []).join('\n') || '시작하는 중...';
    log.scrollTop = log.scrollHeight;
    if (!s.running) {
      clearInterval(polling); $('#btnRebuild').disabled = $('#btnRebuildFull').disabled = false;
      if (s.ok) { toast('데이터를 갱신했습니다'); emit('data:reload'); } else toast('갱신 실패: 로그를 확인하세요', 4000);
    }
  }, 1200);
}

async function upload() {
  const f = $('#guideFile').files[0];
  if (!f) { toast('파일을 고르세요'); return; }
  const fd = new FormData(); fd.append('file', f);
  $('#uploadMsg').textContent = '올리는 중...';
  try {
    const r = await api('/api/guide', { method: 'POST', body: fd });
    $('#uploadMsg').innerHTML = `<span class="good">✓ ${esc(r.sheet)} · 원가 있는 SAP ${r.sap_count}개</span>: 이제 [데이터 갱신]을 누르세요`;
    emit('meta:reload');
  } catch (e) { $('#uploadMsg').innerHTML = `<span class="over">✕ ${esc(e.message)}</span>`; }
}

async function loadWrap() {
  try { wrapItems = (await api('/api/settings/wrap')).items; } catch { wrapItems = []; }
  renderWrap();
}

function renderWrap() {
  $('#wrapTable').innerHTML = `<thead><tr><th>보자기 SEQ</th><th>보자기 상품</th><th>본품 SEQ</th><th>본품</th><th>메모</th><th></th></tr></thead><tbody>${wrapItems.map((w, i) => `<tr>
    <td><input type="text" class="w64" data-i="${i}" data-f="wrap_seq" value="${esc(w.wrap_seq)}"></td><td data-n="w${i}"></td>
    <td><input type="text" class="w64" data-i="${i}" data-f="base_seq" value="${esc(w.base_seq)}"></td><td data-n="b${i}"></td>
    <td><input type="text" data-i="${i}" data-f="memo" value="${esc(w.memo)}"></td><td><button class="btn ghost sm" data-del="${i}">삭제</button></td></tr>`).join('')}</tbody>`;
  renderWrapNames();
}

function renderWrapNames() {
  wrapItems.forEach((w, i) => {
    const a = state.bySeq.get(String(w.wrap_seq).trim()), b = state.bySeq.get(String(w.base_seq).trim());
    const ea = $(`[data-n="w${i}"]`), eb = $(`[data-n="b${i}"]`);
    if (ea) ea.innerHTML = a ? esc(a.name) : '<span class="mute">-</span>';
    if (eb) eb.innerHTML = b ? `${esc(b.name)} <span class="cap">원가 ${won(b.cost)}</span>` : '<span class="mute">-</span>';
  });
}

async function saveWrap() {
  try { const r = await api('/api/settings/wrap', { method: 'POST', body: { items: wrapItems } }); toast(`${r.saved}건 저장: [데이터 갱신]을 눌러 반영하세요`); loadWrap(); }
  catch (e) { toast(e.message); }
}
