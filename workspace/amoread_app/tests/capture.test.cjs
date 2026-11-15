// capture.js의 순수 함수(band: 구좌 제목·글 → 원본 띠 찾기) 시험. 실행: node --test tests/capture.test.cjs
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../planner/static/v2/capture.js'), 'utf8');
const ctx = { window: {}, document: {}, v2api: async () => ({}), console };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.Cap = Cap;', ctx);
const Cap = ctx.Cap;
const L = bands => ({ ph: 3000, vw: 390, bands });

test('제목이 띠 이름(st)과 같으면 그 띠', () => {
  const b = { y: 100, h: 300, st: '추천 상품', txt: '' };
  assert.strictEqual(Cap.band(L([{ y: 0, h: 100, st: '', txt: '' }, b]), '추천 상품', ''), b);
});
test('연결이 없으면 띠의 앞쪽 글로 찾는다 (공백·기호·대소문자 무시)', () => {
  const b = { y: 400, h: 300, st: '', txt: '쿠폰 10% 발급 받기 이벤트 안내' };
  assert.strictEqual(Cap.band(L([b]), '쿠폰 10% 발급', ''), b);
  assert.strictEqual(Cap.band(L([b]), 'x', '쿠폰10%발급받기이벤트'), b);
});
test('이미 다른 구좌가 쓴 이름(st)이면 글로 억지로 연결하지 않는다', () => {
  const used = { y: 0, h: 300, st: '혜택 안내', txt: '혜택 안내 내용' }, other = { y: 400, h: 300, st: '', txt: '혜택 안내 내용 비슷' };
  assert.strictEqual(Cap.band(L([used, other]), '혜택 안내', ''), used);   // 이름 일치가 우선
  assert.strictEqual(Cap.band(L([used, other]), '혜택 안내 (2)', ''), null);
});
test('너무 낮은 띠(h<8)와 빈 배치는 무시', () => {
  assert.strictEqual(Cap.band(L([{ y: 0, h: 4, st: 'a', txt: '' }]), 'a', ''), null);
  assert.strictEqual(Cap.band(null, 'a', ''), null);
  assert.strictEqual(Cap.band(L([]), 'a', ''), null);
});
test('짧은 제목은 글 연결에 쓰지 않는다 (오연결 방지)', () => {
  const b = { y: 0, h: 300, st: '', txt: '더보기 상품 모음' };
  assert.strictEqual(Cap.band(L([b]), '더보기', ''), null);
});
