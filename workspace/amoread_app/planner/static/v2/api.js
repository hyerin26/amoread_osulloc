// 새 버전에서 서버 부르기: 토큰은 페이지 meta에서 (예전 화면 core.js와 같은 방식). 실패하면 서버가 준 문구로 Error (e.status = 응답 번호, e.code = 서버가 준 종류, e.data = 응답 내용)
let V2_TOKEN = document.querySelector('meta[name="planner-token"]').content;
// 토큰은 서버를 켤 때마다 새로 만들어진다 → 서버를 다시 켠 뒤 열어 둔 창은 모든 요청이 401로 실패했다 (저장도 실패).
// 401이면 지금 화면을 다시 받아 새 토큰만 꺼내 한 번 더 시도한다 (새로고침과 같은 일이지만 고치던 내용은 그대로)
let tokenWait = null;
function v2renewToken() {
  if (!tokenWait) {
    tokenWait = fetch(location.pathname, { cache: 'no-store' }).then(r => r.text()).then(html => {
      const t = new DOMParser().parseFromString(html, 'text/html').querySelector('meta[name="planner-token"]')?.content;
      if (!t) throw new Error('새 토큰을 받지 못했어요');
      V2_TOKEN = t;
    });
    tokenWait.catch(() => {}).then(() => { tokenWait = null; });
  }
  return tokenWait;
}
async function v2fetch(path, init = {}) {   // 토큰을 붙여 보내고, 401이면 토큰을 새로 받아 한 번 더
  const go = () => fetch(path, { ...init, headers: { ...(init.headers || {}), 'x-planner-token': V2_TOKEN } });
  let res = await go();
  if (res.status === 401) { try { await v2renewToken(); res = await go(); } catch { /* 처음 응답 그대로 */ } }
  return res;
}
async function v2api(path, body) {
  const res = await v2fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* 빈 응답 */ }
  if (!res.ok) {
    if (data.code === 'no_data') v2noData();
    throw Object.assign(new Error(data.error || `서버 오류 (${res.status})`), { status: res.status, code: data.code || '', data });
  }
  return data;
}
// 원가·실적 데이터가 없는 PC: 화면마다 잠깐 뜨는 알림만으로는 왜 예시가 보이는지, 어디서 고치는지 알 수 없었다 → 맨 위에 계속 보이는 안내 + 설정으로 가는 링크 (화면당 한 번)
function v2noData() {
  if (document.getElementById('v2nodata') || location.pathname.endsWith('/settings')) return;
  const bar = document.createElement('div'); bar.id = 'v2nodata'; bar.className = 'v2notice'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>상품·원가·실적 데이터가 아직 없어서 상품과 일정 일부가 <b>예시</b>로 보여요.</span><a href="/v2/settings#data">설정 › 데이터 상태에서 [데이터 갱신] 하기</a>';
  const main = document.querySelector('main'); if (main) main.prepend(bar); else document.body.prepend(bar);
}
