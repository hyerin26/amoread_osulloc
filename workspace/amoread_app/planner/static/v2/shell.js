// AMOREAD 새 버전 공통 틀: 상품·할인의 [← 원래 단계로]
document.addEventListener('click', e => {
  if (!e.target.closest('[data-v2back]')) return;
  if (document.referrer && new URL(document.referrer).origin === location.origin) history.back();
  else location.assign('/v2/editor');
});
