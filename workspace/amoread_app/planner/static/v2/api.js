// 새 버전에서 서버 부르기: 토큰은 페이지 meta에서 (예전 화면 core.js와 같은 방식). 실패하면 서버가 준 문구로 Error
const V2_TOKEN = document.querySelector('meta[name="planner-token"]').content;
async function v2api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-planner-token': V2_TOKEN, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* 빈 응답 */ }
  if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
  return data;
}
