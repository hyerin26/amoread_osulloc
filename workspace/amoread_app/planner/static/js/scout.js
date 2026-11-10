// 트렌드 스카우트: 넓은 질의로 모은 글에서 규칙으로 뽑은 '요즘 뜨는 말' → 검색량 검증 → 오설록과 엮기(같은 것·곁들임·상황·대체·가치)
import { $, api, emit, esc, mmdd, pct, toast } from './core.js';

let data = null, queries = [];

export function initScout() {
  $('#scoutRun').addEventListener('click', run);
  $('#scoutBody').addEventListener('click', onClick);
  $('#scoutQ').addEventListener('click', onQClick);
}

export async function showScout() {
  try { data = await api('/api/scout'); } catch (e) { $('#scoutBody').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  render();
  try { queries = (await api('/api/settings/scout-queries')).items; } catch { queries = []; }
  renderQ();
}

async function run() {
  const b = $('#scoutRun'); b.disabled = true; b.textContent = '모으는 중… (30초 안팎)';
  try { data = await api('/api/scout/run', { method: 'POST' }); render(); toast(`글 ${data.docs}건에서 후보를 뽑았어요`); emit('alerts:reload'); }
  catch (e) { toast(e.message, 4500); }
  finally { b.disabled = false; b.textContent = '바깥 소식 모으기'; }
}

const ST = { '떠오르는 중': 'warn', '정점 근처': 'warn', '꾸준': 'ok', '식는 중': 'mute', '검색 적음': 'mute' };

function spark(series) {
  if (!series || series.length < 2) return '';
  const w = 120, h = 28, n = series.length;
  const pts = series.map((v, i) => `${(i / (n - 1) * w).toFixed(1)},${(h - 2 - v / 100 * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="tline sm" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="최근 12주 검색량"><polyline points="${pts}"/></svg>`;
}

function render() {
  $('#scoutState').textContent = data.run_at ? `${data.run_at} 모음 · 글 ${data.docs}건 · 질의 ${data.queries.length}개` : (data.has_keys ? '아직 모으지 않았어요' : '네이버 API 키 필요');
  $('#scoutRun').disabled = !data.has_keys;
  let html = '';
  if (!data.has_keys) {
    html += `<div class="card setup"><h2>네이버 키 하나로 스카우트와 검색량 검증을 둘 다 돌려요 <span class="cap">무료</span></h2>
      <ol class="sm"><li><b>네이버 클라우드 콘솔</b> → NAVER API HUB → 신청하기(약관 동의) → Application 등록 (예전 개발자센터 키는 안 돼요)</li>
      <li>API에 <b>검색</b>과 <b>검색어 트렌드</b>를 고르고 → Application 관리 › 인증 정보에서 Client ID·Secret 복사</li>
      <li><code>osulloc_ops\\.env</code>에 <code>NAVER_CLIENT_ID=…</code> <code>NAVER_CLIENT_SECRET=…</code> → 기획 도우미 다시 켜기</li></ol>
      <p class="cap">보내는 것: 아래 '넓은 질의'와 후보 말뿐 (실적·고객 정보 없음). 검색 API 하루 25,000회 (지금은 한시 무료, 유료 전환 때 미리 공지), 한 번 모을 때 약 ${(data.queries || []).length * 2}회.</p></div>`;
  }
  const cards = data.cards || [];
  if (cards.length) {
    html += `<div class="sec-head"><h2>요즘 뜨는 말 ${cards.length}개</h2><span class="cap">${esc(data.note)}</span></div><div class="scards">${cards.map(card).join('')}</div>`;
  } else if (data.has_keys) {
    html += '<div class="empty">[바깥 소식 모으기]를 누르면 넓은 질의로 최신 뉴스·블로그를 모아 후보를 뽑아요.</div>';
  }
  if ((data.dismissed || []).length) html += `<p class="cap mt8">버린 말 ${data.dismissed.length}개: ${data.dismissed.map(esc).join(', ')} <button class="btn ghost sm" data-clearall>모두 되살리기</button></p>`;
  $('#scoutBody').innerHTML = html;
}

function card(c) {
  const v = c.verify || {}, b = c.bridge || {};
  const st = v.status || (data.has_keys ? '검증 전' : '검증 불가(키 없음)');
  return `<article class="scard ${c.state === 'keep' ? 'kept' : ''}">
    <div class="row"><span class="status ${ST[v.status] || 'mute'}">${esc(st)}${v.momentum !== undefined && v.momentum !== null ? ` · 4주 ${v.momentum > 0 ? '+' : ''}${Math.round(v.momentum * 100)}%` : ''}</span><span class="tag plan">${esc(b.type || '')}</span>${c.state === 'keep' ? '<span class="tag run">계속 보는 중</span>' : ''}</div>
    <h3>${esc(c.term)}</h3>
    ${spark(v.series)}
    <div class="cap">글 ${c.docs}건${c.recent7 ? ` · 최근 7일 ${c.recent7}` : ''}${c.strong ? ` · 강한 신호 ${c.strong}` : ''}</div>
    <div class="bridge"><b>오설록 연결</b> ${esc(b.why || '')}${b.copy ? `<div class="copy">“${esc(b.copy)}” <span class="cap">카피 씨앗(규칙)</span></div>` : ''}
      ${(b.products || []).length ? `<div class="cap">추천 상품: ${b.products.slice(0, 3).map(p => esc(p.name)).join(' · ')}</div>` : ''}
      ${(c.flags || []).length ? `<div class="cap over">효능 표현 주의: ${esc(c.flags.join(', '))}</div>` : ''}</div>
    ${(c.sources || []).length ? `<ul class="src">${c.sources.slice(0, 3).map(x => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>` : esc(x.title)}${x.date ? ` <span class="cap">${mmdd(x.date)}</span>` : ''}</li>`).join('')}</ul>` : ''}
    <div class="acts"><button class="btn sm ghost" data-mark="dismiss" data-term="${esc(c.term)}">버리기</button>
      <button class="btn sm" data-mark="${c.state === 'keep' ? 'clear' : 'keep'}" data-term="${esc(c.term)}">${c.state === 'keep' ? '그만 보기' : '계속 보기'}</button>
      <span class="grow"></span><button class="btn sm ghost" data-tseason="${esc(c.term)}">이 시기 명분으로 남기기</button><button class="btn sm primary" data-plan="${esc(c.term)}">이 말로 기획 시작</button></div>
  </article>`;
}

async function onClick(e) {
  if (e.target.closest('[data-clearall]')) {
    for (const t of data.dismissed) { try { await api('/api/scout/mark', { method: 'POST', body: { term: t, status: 'clear' } }); } catch { /* 무시 */ } }
    showScout(); return;
  }
  const m = e.target.closest('[data-mark]');
  if (m) {
    try { await api('/api/scout/mark', { method: 'POST', body: { term: m.dataset.term, status: m.dataset.mark } }); } catch (err) { toast(err.message); return; }
    toast({ dismiss: '버렸어요. 다음 수집에서도 안 보여요', keep: '계속 볼게요. 다음 수집 때 검색량을 다시 확인해요', clear: '그만 볼게요' }[m.dataset.mark]);
    showScout(); return;
  }
  const ts = e.target.closest('[data-tseason]');
  if (ts) { emit('am:trend-season', { term: ts.dataset.tseason, memo: '트렌드 스카우트에서 찾은 말' }); return; }
  const p = e.target.closest('[data-plan]');
  if (p) {
    try {
      const r = await api('/api/scout/plan', { method: 'POST', body: { term: p.dataset.plan } });
      // R12: 트렌드는 명분 입구. 연결 상품은 후보 상품(역할 미정)으로만 담는다
      emit('am:trend-start', { term: r.term, rows: r.rows || [], source: '트렌드 스카우트', seed: r.bridge?.copy || '',
        rationale: `바깥 트렌드 '${r.term}'. ${r.bridge?.type || ''}: ${r.bridge?.why || ''}${r.bridge?.copy ? `
카피 씨앗: ${r.bridge.copy}` : ''}` });
      api('/api/scout/mark', { method: 'POST', body: { term: r.term, status: 'planned' } }).catch(() => {});
      
    } catch (err) { toast(err.message); }
  }
}

function renderQ() {
  $('#scoutQ').innerHTML = `<div class="qlist">${queries.map((q, i) => `<span class="qchip"><input type="text" value="${esc(q)}" data-qi="${i}"><button class="btn ghost sm" data-qdel="${i}">✕</button></span>`).join('')}</div>
    <div class="row mt8"><button class="btn sm" data-qadd>+ 질의 추가</button><button class="btn sm primary" data-qsave>저장</button><span class="cap">상품명을 넣으면 그 상품만 보게 돼요. '요즘 유행 ○○', '○○ 열풍', '편의점 신상 ○○'처럼 넓게.</span></div>`;
  $('#scoutQ').oninput = e => { const el = e.target; if (el.dataset.qi !== undefined) queries[+el.dataset.qi] = el.value; };
}

async function onQClick(e) {
  if (e.target.closest('[data-qadd]')) { queries.push(''); renderQ(); return; }
  const d = e.target.closest('[data-qdel]'); if (d) { queries.splice(+d.dataset.qdel, 1); renderQ(); return; }
  if (e.target.closest('[data-qsave]')) {
    try { const r = await api('/api/settings/scout-queries', { method: 'POST', body: { items: queries } }); toast(`질의 ${r.saved}개 저장`); showScout(); }
    catch (err) { toast(err.message); }
  }
}
