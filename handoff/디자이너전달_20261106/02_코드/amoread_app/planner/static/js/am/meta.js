// 기획안 정보 작은 표시: 각 단계 제목 아래에 기간·D-day, 상태, 페이지 유형, 명분을 한 줄로 (plans/15 1장)
// 앱 막대에는 이름만 두고 나머지는 여기와 이름을 누르면 열리는 정보 창에 둔다
import { esc, mmdd } from '../core.js';
import { am, dLabel, STATUS } from './store.js';

export function ctxTags(p = am.cur) {
  if (!p) return '';
  const b = p.brief, per = b.period;
  return `<div class="am-ctx">${[
    `<span class="am-badge plan">${per ? `${mmdd(per.start)}~${mmdd(per.end)} · ${esc(dLabel(per.start))}` : '날짜 미정'}</span>`,
    `<span class="am-badge st-${esc(p.status)}">${esc(STATUS[p.status] || '기획 중')}</span>`,
    `<span class="am-badge">${b.page_kind === '없음' ? '페이지 없음' : `${esc(b.page_kind)} 페이지`}</span>`,
    b.myeongbun ? `<span class="am-badge">명분 ${esc(b.myeongbun.slice(0, 20))}</span>` : '',
  ].join('')}</div>`;
}
